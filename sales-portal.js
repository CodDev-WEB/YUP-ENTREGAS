(() => {
 const $=id=>document.getElementById(id);
 const backend=window.YupBackend;
 let profile=null, neighborhoods=[];
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function loginMessage(text,type=""){const el=$("salesLoginMessage");el.textContent=text;el.className="sales-message"+(type?" "+type:"");}
 function deliveryMessage(text,type=""){const el=$("salesDeliveryMessage");el.textContent=text;el.className="sales-message"+(type?" "+type:"");}
 function showLogin(){ $("salesLoginView").hidden=false;$("salesAppView").hidden=true;$("salesLogout").hidden=true; }
 async function loadPortal(){
  if(!profile||profile.role!=="sales"){showLogin();return;}
  $("salesLoginView").hidden=true;$("salesAppView").hidden=false;$("salesLogout").hidden=false;
  $("salesUserName").textContent=profile.display_name||"vendedora";
  const form=$("salesDeliveryForm"),select=form.elements.neighborhood;
  try{
   neighborhoods=await backend.listNeighborhoods();
   select.innerHTML='<option value="">Selecione o bairro</option>'+neighborhoods.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join("");
   if(!neighborhoods.length)deliveryMessage("Nenhum bairro ativo foi cadastrado. Peça à administração para revisar o cadastro de bairros.","error");
  }catch(error){deliveryMessage("Não foi possível carregar os bairros: "+error.message,"error");}
  await loadRecent();
 }
 async function loadRecent(){
  const target=$("salesRecentList");
  try{
   const {data:{user},error:userError}=await backend.client.auth.getUser();
   if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
   const {data,error}=await backend.client.from("deliveries").select("id,order_no,address,priority,status,created_at,neighborhoods(name)").eq("created_by",user.id).is("journey_id",null).order("created_at",{ascending:false}).limit(30);
   if(error)throw error;
   if(!data?.length){target.innerHTML='<div class="sales-empty">Você ainda não cadastrou entregas.</div>';return;}
   target.innerHTML=data.map(item=>'<article class="sales-order"><strong>'+esc(item.order_no||"Pedido sem número")+' · '+esc(item.address)+'</strong><span>'+esc(item.neighborhoods?.name||"Bairro não informado")+' · '+esc(({pending:"Pendente",in_transit:"Em deslocamento",at_destination:"No endereço",completed:"Concluída",failed:"Não realizada"})[item.status]||item.status)+'</span><small>Cadastrada em '+new Date(item.created_at).toLocaleString("pt-BR")+'</small><span class="sales-pill">'+esc(({normal:"Prioridade normal",high:"Prioridade alta",scheduled:"Agendada"})[item.priority]||item.priority)+'</span></article>').join("");
  }catch(error){target.innerHTML='<div class="sales-empty">Não foi possível carregar os cadastros. '+esc(error.message)+'</div>';}
 }
 $("salesLoginForm").addEventListener("submit",async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
  button.disabled=true;loginMessage("Validando acesso…");
  try{
   const result=await backend.signIn(form.elements.email.value.trim(),form.elements.password.value);
   if(!result.ok){loginMessage(result.message||"Não foi possível entrar. Verifique suas credenciais e a configuração do Supabase.","error");return;}
   if(result.profile.role!=="sales"){
    await backend.signOut();
    loginMessage("Este acesso não é de vendas. Use o portal correspondente ao seu perfil ou solicite à administração a criação do perfil de vendedora.","error");return;
   }
   profile=result.profile;form.reset();await loadPortal();
  }catch(error){loginMessage("Falha ao entrar: "+error.message,"error");}
  finally{button.disabled=false;}
 });
 $("salesDeliveryForm").addEventListener("submit",async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
  const data=new FormData(form),address=String(data.get("address")||"").trim();
  if(!address){deliveryMessage("Informe o endereço completo.","error");return;}
  if(!data.get("neighborhood")){deliveryMessage("Selecione o bairro.","error");return;}
  button.disabled=true;deliveryMessage("Cadastrando entrega…");
  try{
   const result=await backend.createDelivery({journeyId:null,orderReference:data.get("orderReference"),neighborhoodId:data.get("neighborhood"),address,reference:data.get("reference"),mapLink:data.get("mapLink"),priority:data.get("priority")||"normal"});
   form.reset();deliveryMessage("Entrega cadastrada com sucesso. O pedido já está disponível para ser selecionado pelo entregador.","success");
   await loadRecent();
  }catch(error){deliveryMessage("Não foi possível cadastrar. "+error.message,"error");}
  finally{button.disabled=false;}
 });
 $("salesLogout").addEventListener("click",async()=>{await backend.signOut();profile=null;showLogin();loginMessage("Você saiu do portal.");});
 async function init(){
  if(!backend){loginMessage("O sistema de acesso não foi carregado. Atualize a página ou confira a configuração do Supabase.","error");return;}
  try{
   const result=await backend.getSessionProfile();
   if(result.ok&&result.authenticated){
    if(result.profile.role==="sales"){profile=result.profile;await loadPortal();return;}
    await backend.signOut();
    loginMessage("Esta página é exclusiva para o perfil de vendas. Entre com o usuário correto.");
    return;
   }
   if(result.reason==="missing-config")loginMessage("A configuração do Supabase está pendente. Peça à administração para configurar o acesso.","error");
  }catch(error){loginMessage("Não foi possível verificar a sessão: "+error.message,"error");}
 }
 init();
})();