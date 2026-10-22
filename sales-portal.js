(() => {
 const $=id=>document.getElementById(id);
 const backend=window.YupBackend;
 let profile=null, neighborhoods=[];
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function deliveryMessage(text,type=""){const el=$("salesDeliveryMessage");el.textContent=text;el.className="sales-message"+(type?" "+type:"");}
 async function loadPortal(){
  if(!profile||profile.role!=="sales")return;
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
   const {data,error}=await backend.client.from("deliveries").select("id,order_no,customer_order_ref,address,priority,status,created_at,neighborhoods(name)").eq("created_by",user.id).order("created_at",{ascending:false}).limit(30);
   if(error)throw error;
   if(!data?.length){target.innerHTML='<div class="sales-empty">Você ainda não cadastrou entregas.</div>';return;}
   target.innerHTML=data.map(item=>'<article class="sales-order"><strong>'+esc(item.customer_order_ref||("Entrega "+item.order_no))+' · '+esc(item.address)+'</strong><span>'+esc(item.neighborhoods?.name||"Bairro não informado")+' · '+esc(({pending:"Pendente",in_transit:"Em deslocamento",at_destination:"No endereço",completed:"Concluída",failed:"Não realizada"})[item.status]||item.status)+'</span><small>Cadastrada em '+new Date(item.created_at).toLocaleString("pt-BR")+'</small><span class="sales-pill">'+esc(({normal:"Prioridade normal",high:"Prioridade alta",scheduled:"Agendada"})[item.priority]||item.priority)+'</span></article>').join("");
  }catch(error){target.innerHTML='<div class="sales-empty">Não foi possível carregar os cadastros. '+esc(error.message)+'</div>';}
 }
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
 $("salesRefresh")?.addEventListener("click",loadRecent);
 async function init(){
  if(!backend){deliveryMessage("O sistema de acesso não foi carregado. Atualize a página.", "error");return;}
  try{
   const result=await backend.getSessionProfile();
   if(result.ok&&result.authenticated&&result.profile.role==="sales"){profile=result.profile;await loadPortal();return;}
   deliveryMessage("Esta área é exclusiva para o perfil de vendas. Saia e entre com uma conta autorizada.", "error");
  }catch(error){deliveryMessage("Não foi possível verificar a sessão: "+error.message,"error");}
 }
 init();
})();
