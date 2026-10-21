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
  async function listOperations() {
    const client = await requireReady();
    const {data:journeys,error:jError} = await client.from("journeys").select("id,order_number,driver_id,vehicle_id,status,odometer_start,odometer_end,started_at_server,finished_at_server,drivers(id,registration_no,full_name),vehicles(id,code,plate)").order("started_at_server",{ascending:false});
    if (jError) throw jError;
    const ids = (journeys || []).map(j => j.id);
    let deliveries = [];
    if (ids.length) {
      const {data,error} = await client.from("deliveries").select("id,journey_id,order_no,neighborhood_id,address,reference,map_link,priority,status,result_note,sequence_no,created_at,updated_at,neighborhoods(name),delivery_events(id,event_type,occurred_at_device,received_at_server,note)").in("journey_id",ids).order("sequence_no");
      if (error) throw error;
      deliveries = data || [];
    }
    return {journeys:journeys || [],deliveries};
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
  async function startJourney({driverId,vehicleId,odometerStart}) {
    const client = await requireReady();
    const {data,error} = await client.from("journeys").insert({driver_id:driverId,vehicle_id:vehicleId,odometer_start:Number(odometerStart),status:"open"}).select("id,driver_id,vehicle_id,status,odometer_start,started_at_server").single();
    if (error) throw error;
    return data;
  }
  async function finishJourney({journeyId,odometerEnd}) {
    const client = await requireReady();
    const {data,error} = await client.from("journeys").update({status:"finished",odometer_end:Number(odometerEnd)}).eq("id",journeyId).eq("status","open").select("id,status,odometer_end,finished_at_server").single();
    if (error) throw error;
    return data;
  }
  async function createDelivery(input) {
    const client = await requireReady();
    const {data,error} = await client.from("deliveries").insert({
      journey_id:input.journeyId,neighborhood_id:input.neighborhoodId || null,
      address:String(input.address).trim(),reference:String(input.reference || "").trim() || null,
      map_link:String(input.mapLink || "").trim() || null,priority:input.priority,status:"pending",sequence_no:input.sequenceNo
    }).select("id,journey_id,order_no,status,sequence_no").single();
    if (error) throw error;
    return data;
  }
  async function updateDeliveryStatus({deliveryId,status,note}) {
    const client = await requireReady();
    const {data:delivery,error:readError} = await client.from("deliveries").select("id,journey_id,status").eq("id",deliveryId).single();
    if (readError) throw readError;
    const transitions = {pending:["in_transit","failed"],in_transit:["at_destination","completed","failed"],at_destination:["completed","failed"]};
    if (!(transitions[delivery.status] || []).includes(status)) throw new Error("Transição de status não permitida.");
    const {data:{user},error:userError} = await client.auth.getUser();
    if (userError || !user) throw new Error("Sessão expirada. Entre novamente.");
    const {data:updated,error} = await client.from("deliveries").update({status,result_note:note || null}).eq("id",deliveryId).eq("status",delivery.status).select("id,status").single();
    if (error) throw error;
    const eventMap = {in_transit:"departure",at_destination:"arrival",completed:"completed",failed:"failed"};
    const {error:eventError} = await client.from("delivery_events").insert({
      delivery_id:deliveryId,event_type:eventMap[status],actor_profile_id:user.id,idempotency_key:crypto.randomUUID(),note:note || null
    });
    if (eventError) throw new Error("Status atualizado, mas não foi possível registrar o evento: " + eventError.message);
    return updated;
  }
  window.YupBackend={connect,signIn,signOut,getSessionProfile,subscribeToOperations,listDrivers,listVehicles,listNeighborhoods,listOperations,startJourney,finishJourney,createDelivery,updateDeliveryStatus,recordJourneyLocation,listJourneyLocationPoints,get client(){return state.client;},get profile(){return state.profile;} };
})();
