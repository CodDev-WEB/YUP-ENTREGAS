(() => {
 const $=id=>document.getElementById(id);
 const backend=window.YupBackend;
 let profile=null, neighborhoods=[];
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function deliveryMessage(text,type=""){const el=$("salesDeliveryMessage");el.textContent=text;el.className="sales-message"+(type?" "+type:"");}
 const salesForm=$("salesDeliveryForm");
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
 salesForm.addEventListener("input",event=>{
  const field=event.target;
  if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement))return;
  if(field.type==="url"||field.type==="email"||field.type==="password"||field.type==="number"||field.name==="postalCode")return;
  const start=field.selectionStart,end=field.selectionEnd,upper=field.value.toLocaleUpperCase("pt-BR");
  if(field.value!==upper){field.value=upper;if(typeof start==="number"&&typeof end==="number")field.setSelectionRange(start,end);}
 });
 const onlyDigits=value=>String(value||"").replace(/\D/g,"");
 function formatCep(value){const digits=onlyDigits(value).slice(0,8);return digits.length>5?digits.slice(0,5)+"-"+digits.slice(5):digits;}
 const cepField=salesForm.elements.postalCode,numberField=salesForm.elements.houseNumber,addressField=salesForm.elements.address,complementField=salesForm.elements.complement,neighborhoodField=salesForm.elements.neighborhood;
 let cepLookupToken=0,lastLookedUpCep="";
 cepField.addEventListener("input",()=>{cepField.value=formatCep(cepField.value);const digits=onlyDigits(cepField.value);if(digits.length===8&&digits!==lastLookedUpCep){lastLookedUpCep=digits;lookupCep();}else if(digits.length<8){lastLookedUpCep="";}});
 async function lookupCep(){
  const cep=onlyDigits(cepField.value);
  if(cep.length!==8){deliveryMessage("Digite um CEP válido com 8 números ou preencha o endereço manualmente.");return;}
  const token=++cepLookupToken;lastLookedUpCep=cep;
  deliveryMessage("Consultando CEP…");
  try{
   const response=await fetch("https://viacep.com.br/ws/"+cep+"/json/");
   if(!response.ok)throw new Error("Serviço de CEP indisponível.");
   const result=await response.json();
   if(token!==cepLookupToken)return;
   if(result.erro)throw new Error("CEP não encontrado. Você pode preencher o endereço manualmente.");
   if(result.logradouro)addressField.value=result.logradouro;
   if(result.bairro){
    const match=[...neighborhoodField.options].find(option=>option.value&&option.textContent.trim().toLocaleLowerCase("pt-BR")===result.bairro.trim().toLocaleLowerCase("pt-BR"));
    if(match)neighborhoodField.value=match.value;
    else deliveryMessage("CEP localizado. Bairro retornado: "+result.bairro+". Selecione um bairro cadastrado; se necessário, peça à administração para cadastrá-lo.");
   }
   if(result.localidade||result.uf){
    const cityState=[result.localidade,result.uf].filter(Boolean).join("/");
    const current=addressField.value.trim();
    if(current&&!current.toLocaleLowerCase("pt-BR").includes(cityState.toLocaleLowerCase("pt-BR")))addressField.value=current+" - "+cityState;
   }
   if(!result.bairro||[...neighborhoodField.options].some(option=>option.value===neighborhoodField.value&&option.textContent.trim().toLocaleLowerCase("pt-BR")===String(result.bairro||"").trim().toLocaleLowerCase("pt-BR")))deliveryMessage("Endereço localizado pelo CEP. Informe o número do imóvel e confira os dados antes de cadastrar.","success");
   numberField.focus();
  }catch(error){if(token===cepLookupToken)deliveryMessage(error.message+" O preenchimento manual continua disponível.","error");}
 }
 cepField.addEventListener("change",lookupCep);
 cepField.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();lookupCep();}});
 async function loadRecent(){
  const target=$("salesRecentList");
  try{
   const {data:{user},error:userError}=await backend.client.auth.getUser();
   if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
   const {data,error}=await backend.client.from("deliveries").select("id,journey_id,order_no,customer_order_ref,address,reference,map_link,neighborhood_id,priority,status,created_at,neighborhoods(name)").eq("created_by",user.id).order("created_at",{ascending:false}).limit(30);
   if(error)throw error;
   if(!data?.length){target.innerHTML='<div class="sales-empty">Você ainda não cadastrou entregas.</div>';return;}
   target.innerHTML=data.map(item=>{
    const locked=Boolean(item.journey_id);
    const state=({pending:"Pendente",in_transit:"Em deslocamento",at_destination:"No endereço",completed:"Concluída",failed:"Não realizada"})[item.status]||item.status;
    return '<article class="sales-order"><strong>'+esc(item.customer_order_ref||("Entrega "+item.order_no))+' · '+esc(item.address)+'</strong><span>'+esc(item.neighborhoods?.name||"Bairro não informado")+' · '+esc(state)+'</span><small>Cadastrada em '+new Date(item.created_at).toLocaleString("pt-BR")+'</small><span class="sales-pill">'+esc(({normal:"Prioridade normal",high:"Prioridade alta",scheduled:"Agendada"})[item.priority]||item.priority)+'</span><div class="sales-order-actions"><button type="button" class="button secondary" data-sales-edit="'+esc(item.id)+'">Alterar / corrigir</button>'+(locked?'<span class="sales-pill">Vinculada à jornada · exclusão bloqueada</span>':'<button type="button" class="button danger" data-sales-delete="'+esc(item.id)+'">Excluir</button>')+'</div></article>';
   }).join("");
   target.querySelectorAll("[data-sales-edit]").forEach(button=>button.addEventListener("click",()=>editDelivery(data.find(item=>item.id===button.dataset.salesEdit))));
   target.querySelectorAll("[data-sales-delete]").forEach(button=>button.addEventListener("click",()=>deleteDelivery(data.find(item=>item.id===button.dataset.salesDelete))));
  }catch(error){target.innerHTML='<div class="sales-empty">Não foi possível carregar os cadastros. '+esc(error.message)+'</div>';}
 }
 $("salesDeliveryForm").addEventListener("submit",async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
  const data=new FormData(form);
  const street=String(data.get("address")||"").trim();
  const houseNumber=String(data.get("houseNumber")||"").trim();
  const complement=String(data.get("complement")||"").trim();
  const cep=String(data.get("postalCode")||"").trim();
  const address=[street,houseNumber?"Nº "+houseNumber:"",complement].filter(Boolean).join(", ");
  if(!street){deliveryMessage("Informe o logradouro/endereço ou preencha manualmente.","error");return;}
  if(!data.get("neighborhood")){deliveryMessage("Selecione o bairro. O CEP pode sugerir o bairro, mas você também pode selecioná-lo manualmente.","error");return;}
  if(cep&&onlyDigits(cep).length!==8){deliveryMessage("O CEP deve conter 8 números ou ficar vazio para preenchimento manual.","error");return;}
  button.disabled=true;deliveryMessage("Cadastrando entrega…");
  try{
   const result=await backend.createDelivery({journeyId:null,orderReference:data.get("orderReference"),neighborhoodId:data.get("neighborhood"),address,reference:data.get("reference"),mapLink:data.get("mapLink"),priority:data.get("priority")||"normal"});
   form.reset();deliveryMessage("Entrega cadastrada com sucesso. O pedido já está disponível para ser selecionado pelo entregador.","success");
   await loadRecent();
  }catch(error){deliveryMessage("Não foi possível cadastrar. "+error.message,"error");}
  finally{button.disabled=false;}
 });
 async function editDelivery(item){
  if(!item)return;
  const orderReference=prompt("Número do pedido (deixe vazio se não houver):",item.customer_order_ref||"");if(orderReference===null)return;
  const address=prompt("Endereço completo (logradouro, número e complemento):",item.address||"");if(address===null)return;
  const neighborhoodList=neighborhoods.map((n,i)=>(i+1)+". "+n.name).join("\n");
  const currentIndex=Math.max(0,neighborhoods.findIndex(n=>n.id===item.neighborhood_id));
  const choice=prompt("Informe o número do bairro cadastrado:\n"+neighborhoodList,String(currentIndex+1));if(choice===null)return;
  const chosen=neighborhoods[Number(choice)-1];if(!chosen){deliveryMessage("Bairro inválido. Nenhuma alteração foi salva.","error");return;}
  const reference=prompt("Referência (opcional):",item.reference||"");if(reference===null)return;
  const mapLink=prompt("Link de localização (opcional):",item.map_link||"");if(mapLink===null)return;
  const priorities=["normal","high","scheduled"];
  const defaultPriority=priorities.indexOf(item.priority)+1;
  const priorityChoice=prompt("Prioridade: 1 = Normal, 2 = Alta, 3 = Agendada",String(defaultPriority>0?defaultPriority:1));if(priorityChoice===null)return;
  const priority=priorities[Number(priorityChoice)-1];if(!priority){deliveryMessage("Prioridade inválida. Nenhuma alteração foi salva.","error");return;}
  if(!address.trim()){deliveryMessage("O endereço não pode ficar vazio.","error");return;}
  try{
   deliveryMessage("Salvando correções…");
   const {data:{user},error:userError}=await backend.client.auth.getUser();if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
   const {error}=await backend.client.from("deliveries").update({customer_order_ref:orderReference.trim()||null,address:address.trim().toLocaleUpperCase("pt-BR"),neighborhood_id:chosen.id,reference:reference.trim().toLocaleUpperCase("pt-BR")||null,map_link:mapLink.trim()||null,priority}).eq("id",item.id).eq("created_by",user.id);
   if(error)throw error;
   deliveryMessage(item.journey_id?"Entrega corrigida. Como já está vinculada a uma jornada, a opção de exclusão permanece bloqueada.":"Entrega atualizada com sucesso.","success");
   await loadRecent();
  }catch(error){deliveryMessage("Não foi possível atualizar a entrega: "+error.message,"error");}
 }
 async function deleteDelivery(item){
  if(!item)return;
  if(item.journey_id){deliveryMessage("Esta entrega já está vinculada a uma jornada e não pode ser excluída pelo vendedor.","error");return;}
  if(!confirm("Excluir definitivamente a entrega "+(item.customer_order_ref||item.order_no)+"? Esta ação não pode ser desfeita."))return;
  try{
   deliveryMessage("Excluindo entrega…");
   const {data:{user},error:userError}=await backend.client.auth.getUser();if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
   const {data,error}=await backend.client.from("deliveries").delete().eq("id",item.id).eq("created_by",user.id).is("journey_id",null).select("id");
   if(error)throw error;
   if(!data?.length)throw new Error("Nenhuma linha foi excluída. A entrega pode ter sido vinculada a uma jornada ou a política de acesso bloqueou a operação.");
   deliveryMessage("Entrega excluída com sucesso.","success");await loadRecent();
  }catch(error){deliveryMessage("Não foi possível excluir a entrega: "+error.message,"error");}
 }
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
