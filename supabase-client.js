(() => {
  const state = { client: null, profile: null, channel: null };
  async function connect() {
    const cfg = window.YUP_SUPABASE_CONFIG;
    if (!cfg?.url || !cfg?.anonKey || cfg.url.includes("SEU-PROJETO")) return { ok:false, reason:"missing-config" };
    if (state.client) return { ok:true, client:state.client };
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    state.client = createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:5}}});
    return { ok:true, client:state.client };
  }
  async function loadProfile() {
    const { data:{user}, error:authError } = await state.client.auth.getUser();
    if (authError || !user) return null;
    const { data,error } = await state.client.from("profiles").select("id,display_name,role,active").eq("id",user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function signIn(email,password) {
    const connection=await connect(); if(!connection.ok) return connection;
    const {error}=await state.client.auth.signInWithPassword({email,password});
    if(error) return {ok:false,reason:"auth-error",message:error.message};
    const profile=await loadProfile();
    if(!profile || !profile.active){await state.client.auth.signOut();return {ok:false,reason:"profile-inactive"};}
    state.profile=profile; return {ok:true,profile};
  }
  async function getSessionProfile() {
    const connection=await connect(); if(!connection.ok) return connection;
    const {data:{session}}=await state.client.auth.getSession();
    if(!session) return {ok:true,authenticated:false};
    const profile=await loadProfile();
    if(!profile || !profile.active){await state.client.auth.signOut();return {ok:true,authenticated:false};}
    state.profile=profile; return {ok:true,authenticated:true,profile};
  }
  async function signOut() {
    if(state.channel && state.client) await state.client.removeChannel(state.channel);
    state.channel=null; state.profile=null;
    return state.client?.auth.signOut();
  }
  function subscribeToOperations(onChange) {
    if(!state.client) throw new Error("Supabase ainda não conectado.");
    if(state.channel) state.client.removeChannel(state.channel);
    state.channel=state.client.channel("yup-operations")
      .on("postgres_changes",{event:"*",schema:"public",table:"journeys"},onChange)
      .on("postgres_changes",{event:"*",schema:"public",table:"deliveries"},onChange)
      .on("postgres_changes",{event:"*",schema:"public",table:"delivery_events"},onChange)
      .on("postgres_changes",{event:"*",schema:"public",table:"journey_location_points"},onChange).subscribe();
    return state.channel;
  }
  async function requireReady() {
    const connection = await connect();
    if (!connection.ok) throw new Error("Supabase não está configurado.");
    if (!state.profile) throw new Error("Faça login antes de acessar os dados operacionais.");
    return state.client;
  }
  async function listDrivers() {
    const client = await requireReady();
    let query = client.from("drivers").select("id,profile_id,registration_no,full_name,active").eq("active", true).order("full_name");
    if (state.profile.role === "driver") query = query.eq("profile_id", state.profile.id);
    const {data,error} = await query;
    if (error) throw error;
    return data || [];
  }
  async function listVehicles() {
    const client = await requireReady();
    const {data,error} = await client.from("vehicles").select("id,code,plate,make_model,active").order("code");
    if (error) throw error;
    return data || [];
  }
  async function listNeighborhoods() {
    const client = await requireReady();
    const {data,error} = await client.from("neighborhoods").select("id,name").eq("active",true).order("name");
    if (error) throw error;
    return data || [];
  }
  async function listRoutePlans() {
    const client = await requireReady();
    const {data,error} = await client.from("route_plans")
      .select("id,title,assigned_driver_id,status,created_at,created_by,drivers(id,full_name,registration_no),route_plan_stops(id,sequence_no,neighborhood_id,address,reference,map_link,priority,neighborhoods(name))")
      .order("created_at",{ascending:false});
    if(error) throw error;
    return (data||[]).map(plan=>({...plan,route_plan_stops:(plan.route_plan_stops||[]).sort((a,b)=>a.sequence_no-b.sequence_no)}));
  }
  async function createRoutePlan({title,driverId,stops}) {
    const client = await requireReady();
    const {data:{user},error:userError} = await client.auth.getUser();
    if(userError||!user) throw new Error("Sessão expirada. Entre novamente.");
    const {data:plan,error} = await client.from("route_plans").insert({
      title:String(title||"").trim(),assigned_driver_id:driverId,status:"assigned",created_by:user.id
    }).select("id,title,assigned_driver_id,status,created_at").single();
    if(error) throw error;
    try {
      const rows=(stops||[]).map((stop,index)=>({
        route_plan_id:plan.id,sequence_no:index+1,neighborhood_id:stop.neighborhoodId||null,
        address:String(stop.address||"").trim(),reference:String(stop.reference||"").trim()||null,
        map_link:String(stop.mapLink||"").trim()||null,priority:stop.priority||"normal"
      }));
      if(!rows.length) throw new Error("Adicione pelo menos uma parada à rota.");
      const {error:stopsError}=await client.from("route_plan_stops").insert(rows);
      if(stopsError) throw stopsError;
    } catch(error) {
      await client.from("route_plans").delete().eq("id",plan.id);
      throw error;
    }
    return plan;
  }
  async function listOperations() {
    const client = await requireReady();
    const {data:journeys,error:jError} = await client.from("journeys").select("id,order_number,driver_id,vehicle_id,route_plan_id,status,odometer_start,odometer_end,started_at_server,finished_at_server,drivers(id,registration_no,full_name),vehicles(id,code,plate,vehicle_type)").order("started_at_server",{ascending:false});
    if (jError) throw jError;
    const {data:deliveries,error:dError}=await client.from("deliveries").select("id,journey_id,order_no,neighborhood_id,address,reference,map_link,latitude,longitude,priority,status,result_note,sequence_no,created_at,updated_at,created_source,created_by,neighborhoods(name),delivery_events(id,event_type,occurred_at_device,received_at_server,note)").order("created_at",{ascending:false}).limit(5000);
    if(dError)throw dError;
    return {journeys:journeys || [],deliveries:deliveries || []};
  }
  async function recordJourneyLocation({journeyId,latitude,longitude,accuracy,speed,heading,capturedAt}) {
    const client = await requireReady();
    const {data,error} = await client.from("journey_location_points").insert({
      journey_id:journeyId,latitude:Number(latitude),longitude:Number(longitude),
      accuracy_m:accuracy==null?null:Number(accuracy),speed_mps:speed==null?null:Number(speed),
      heading_deg:heading==null?null:Number(heading),captured_at_device:capturedAt||new Date().toISOString()
    }).select("id,journey_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,captured_at_device,received_at_server").single();
    if(error)throw error;
    return data;
  }
  async function listJourneyLocationPoints(journeyId) {
    const client = await requireReady();
    const {data,error} = await client.from("journey_location_points")
      .select("id,journey_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,captured_at_device,received_at_server")
      .eq("journey_id",journeyId).order("captured_at_device",{ascending:true}).limit(10000);
    if(error)throw error;
    return data||[];
  }
  async function listJourneyLocationPointsForJourneys(journeyIds) {
    const client = await requireReady();
    const ids=[...new Set((journeyIds||[]).filter(Boolean))];
    if(!ids.length)return [];
    const results=[];
    for(let i=0;i<ids.length;i+=100){
      const batch=ids.slice(i,i+100);
      const {data,error}=await client.from("journey_location_points")
        .select("id,journey_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,captured_at_device,received_at_server")
        .in("journey_id",batch).order("captured_at_device",{ascending:true}).limit(10000);
      if(error)throw error;
      results.push(...(data||[]));
    }
    return results;
  }
  async function startJourney({driverId,vehicleId,odometerStart,routePlanId=null}) {
    const client = await requireReady();
    let plan=null;
    if(routePlanId){
      const {data,error}=await client.from("route_plans")
        .select("id,title,assigned_driver_id,status,route_plan_stops(id,sequence_no,neighborhood_id,address,reference,map_link,priority)")
        .eq("id",routePlanId).eq("assigned_driver_id",driverId).eq("status","assigned").single();
      if(error) throw error;
      plan=data;
      if(!plan.route_plan_stops?.length) throw new Error("Esta rota não possui paradas cadastradas.");
    }
    const {data,error} = await client.rpc("start_journey_with_route", {
      p_driver_id: driverId,
      p_vehicle_id: vehicleId,
      p_odometer_start: Number(odometerStart),
      p_route_plan_id: routePlanId || null
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }
  async function finishJourney({journeyId,odometerEnd}) {
    const client = await requireReady();
    const {data,error} = await client.from("journeys").update({status:"finished",odometer_end:Number(odometerEnd)}).eq("id",journeyId).eq("status","open").select("id,status,odometer_end,finished_at_server").single();
    if (error) throw error;
    return data;
  }
  async function createDelivery(input) {
    const client = await requireReady();
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
    const address=String(input.address||"").trim().toLocaleUpperCase("pt-BR");
    if(!address)throw new Error("Informe o endereço da entrega.");
    const {data,error}=await client.from("deliveries").insert({
      journey_id:input.journeyId||null,created_by:user.id,
      created_source:input.journeyId?"driver":"management",
      customer_order_ref:String(input.orderReference||"").trim()||null,
      neighborhood_id:input.neighborhoodId||null,address,
      reference:String(input.reference||"").trim().toLocaleUpperCase("pt-BR")||null,
      map_link:String(input.mapLink||"").trim()||null,
      latitude:input.latitude==null?null:Number(input.latitude),
      longitude:input.longitude==null?null:Number(input.longitude),
      priority:input.priority||"normal",status:"pending",sequence_no:input.sequenceNo||1
    }).select("id,journey_id,order_no,status,sequence_no,created_source").single();
    if(error)throw error;
    return data;
  }
  async function assignDeliveriesToJourney({journeyId,deliveryIds}) {
    const client=await requireReady();
    const ids=[...new Set((deliveryIds||[]).filter(Boolean))];
    if(!journeyId||!ids.length)throw new Error("Selecione pelo menos uma entrega pendente.");
    const {data:journey,error:jError}=await client.from("journeys").select("id,status").eq("id",journeyId).eq("status","open").single();
    if(jError)throw jError;
    const {data:existing,error:eError}=await client.from("deliveries").select("id,sequence_no").eq("journey_id",journeyId).order("sequence_no",{ascending:false}).limit(1);
    if(eError)throw eError;
    let sequence=(existing?.[0]?.sequence_no||0)+1;
    const assigned=[];
    for(const id of ids){
      const {data,error}=await client.from("deliveries").update({journey_id:journeyId,sequence_no:sequence,status:"pending"}).eq("id",id).is("journey_id",null).eq("status","pending").select("id,journey_id,sequence_no").maybeSingle();
      if(error)throw error;
      if(data){assigned.push(data);sequence++;}
    }
    if(!assigned.length)throw new Error("As entregas selecionadas já foram atribuídas ou não estão pendentes. Atualize a lista.");
    return assigned;
  }
  async function updateDeliveryStatus({deliveryId,status,note}) {
    const client = await requireReady();
    const {data,error} = await client.rpc("update_delivery_status_with_event", {
      p_delivery_id: deliveryId,
      p_status: status,
      p_note: note || null,
      p_idempotency_key: crypto.randomUUID()
    });
    if (error) throw error;
    return data;
  }
  window.YupBackend={connect,signIn,signOut,getSessionProfile,subscribeToOperations,listDrivers,listVehicles,listNeighborhoods,listOperations,listRoutePlans,createRoutePlan,startJourney,finishJourney,createDelivery,assignDeliveriesToJourney,updateDeliveryStatus,recordJourneyLocation,listJourneyLocationPoints,listJourneyLocationPointsForJourneys,get client(){return state.client;},get profile(){return state.profile;} };
})();
