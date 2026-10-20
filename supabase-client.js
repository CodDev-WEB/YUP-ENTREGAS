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
      .on("postgres_changes",{event:"*",schema:"public",table:"delivery_events"},onChange).subscribe();
    return state.channel;
  }
  window.YupBackend={connect,signIn,signOut,getSessionProfile,subscribeToOperations,get client(){return state.client;},get profile(){return state.profile;}};
})();
