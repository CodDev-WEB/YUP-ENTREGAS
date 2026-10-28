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
 function closeSalesEditModal(){document.getElementById("salesEditModal")?.remove();}
 async function editDelivery(item){
  if(!item)return;
  closeSalesEditModal();
  const modal=document.createElement("div");
  modal.id="salesEditModal";modal.className="sales-modal-backdrop";modal.innerHTML='<section class="sales-modal" role="dialog" aria-modal="true" aria-labelledby="salesEditTitle"><header class="sales-modal-head"><div><p class="eyebrow">CORREÇÃO DE PEDIDO</p><h2 id="salesEditTitle">Alterar / corrigir entrega</h2><p>Revise os dados e salve as alterações.</p></div><button type="button" class="sales-modal-close" aria-label="Fechar">×</button></header><form id="salesEditForm" class="form-grid"><label>Número do pedido (opcional)<input name="orderReference" maxlength="80"></label><label class="sales-cep-priority">CEP<input name="postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000"></label><label>Número do imóvel<input name="houseNumber" maxlength="20" placeholder="Nº da casa/loja"></label><label class="wide">Logradouro / endereço<input name="address" required maxlength="300" autocomplete="street-address"></label><label>Complemento (opcional)<input name="complement" maxlength="120" placeholder="Casa, bloco, apartamento…"></label><label>Bairro<select name="neighborhood" required></select></label><label>Referência (opcional)<input name="reference" maxlength="250"></label><label>Prioridade<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="scheduled">Agendada</option></select></label><label class="wide">Link de localização (opcional)<input name="mapLink" type="url"></label><footer class="sales-modal-actions"><button type="button" class="button secondary" data-sales-cancel>Cancelar</button><button type="submit" class="button primary">Salvar correções</button></footer><p class="sales-message" id="salesEditMessage" role="status"></p></form></section>';
  document.body.append(modal);
  const form=modal.querySelector("#salesEditForm"),msg=modal.querySelector("#salesEditMessage"),close=()=>modal.remove();
  const show=(text,type="")=>{msg.textContent=text;msg.className="sales-message"+(type?" "+type:"");};
  form.elements.orderReference.value=item.customer_order_ref||"";
  form.elements.address.value=item.address||"";
  form.elements.houseNumber.value="";
  form.elements.complement.value="";
  form.elements.postalCode.value="";
  form.elements.reference.value=item.reference||"";
  form.elements.mapLink.value=item.map_link||"";
  form.elements.priority.value=item.priority||"normal";
  form.elements.neighborhood.innerHTML='<option value="">Selecione o bairro</option>'+neighborhoods.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join("");
  form.elements.neighborhood.value=item.neighborhood_id||"";
  form.addEventListener("input",event=>{const field=event.target;if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)||["url","email","password","number"].includes(field.type))return;const a=field.selectionStart,b=field.selectionEnd,upper=field.value.toLocaleUpperCase("pt-BR");if(upper!==field.value){field.value=upper;if(typeof a==="number"&&typeof b==="number")field.setSelectionRange(a,b);}});
  const modalCep=form.elements.postalCode;
  let modalCepToken=0,lastModalCep="";
  modalCep.addEventListener("input",()=>{modalCep.value=formatCep(modalCep.value);const digits=onlyDigits(modalCep.value);if(digits.length===8&&digits!==lastModalCep){lastModalCep=digits;lookupModalCep();}else if(digits.length<8)lastModalCep="";});
  async function lookupModalCep(){
   const cep=onlyDigits(modalCep.value);if(cep.length!==8){show("Digite um CEP válido ou preencha o endereço manualmente.");return;}
   const token=++modalCepToken;lastModalCep=cep;show("Consultando CEP…");
   try{
    const response=await fetch("https://viacep.com.br/ws/"+cep+"/json/");if(!response.ok)throw new Error("Serviço de CEP indisponível.");
    const result=await response.json();if(token!==modalCepToken)return;if(result.erro)throw new Error("CEP não encontrado; preencha o endereço manualmente.");
    if(result.logradouro)form.elements.address.value=result.logradouro.toLocaleUpperCase("pt-BR");
    if(result.bairro){const match=[...form.elements.neighborhood.options].find(option=>option.value&&option.textContent.trim().toLocaleLowerCase("pt-BR")===result.bairro.trim().toLocaleLowerCase("pt-BR"));if(match)form.elements.neighborhood.value=match.value;}
    show("Endereço localizado. Confira o bairro e informe o número do imóvel.","success");form.elements.houseNumber.focus();
   }catch(error){if(token===modalCepToken)show(error.message+" O preenchimento manual continua disponível.","error");}
  }
  modalCep.addEventListener("change",lookupModalCep);
  modalCep.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();lookupModalCep();}});
  modal.querySelector(".sales-modal-close").addEventListener("click",close);
  modal.querySelector("[data-sales-cancel]").addEventListener("click",close);
  modal.addEventListener("click",event=>{if(event.target===modal)close();});
  form.addEventListener("submit",async event=>{
   event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;
   const data=new FormData(form),street=String(data.get("address")||"").trim(),houseNumber=String(data.get("houseNumber")||"").trim(),complement=String(data.get("complement")||"").trim(),cep=String(data.get("postalCode")||"").trim(),neighborhoodId=String(data.get("neighborhood")||"");
   const address=[street,houseNumber?"Nº "+houseNumber:"",complement].filter(Boolean).join(", ");
   if(!street||!neighborhoodId){show("Preencha o endereço e selecione o bairro.","error");button.disabled=false;return;}
   if(cep&&onlyDigits(cep).length!==8){show("O CEP deve conter 8 números ou ficar vazio para preenchimento manual.","error");button.disabled=false;return;}
   try{
    show("Salvando correções…");
    const {data:{user},error:userError}=await backend.client.auth.getUser();if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
    const {data:updated,error}=await backend.client.from("deliveries").update({customer_order_ref:String(data.get("orderReference")||"").trim()||null,address:address.toLocaleUpperCase("pt-BR"),neighborhood_id:neighborhoodId,reference:String(data.get("reference")||"").trim().toLocaleUpperCase("pt-BR")||null,map_link:String(data.get("mapLink")||"").trim()||null,priority:String(data.get("priority")||"normal")}).eq("id",item.id).eq("created_by",user.id).select("id,journey_id");
    if(error)throw error;if(!updated?.length)throw new Error("Nenhuma alteração foi gravada. Confira suas permissões ou se a entrega mudou de responsável.");
    show("Correção salva no sistema.","success");
    deliveryMessage(item.journey_id?"Entrega corrigida. A exclusão continua bloqueada porque a entrega já está vinculada a uma jornada.":"Entrega atualizada com sucesso.","success");
    await loadRecent();setTimeout(close,650);
   }catch(error){show("Não foi possível atualizar: "+error.message,"error");}
   finally{button.disabled=false;}
  });
  form.elements.orderReference.focus();
 }
 async function deleteDelivery(item){
  if(!item)return;
  if(item.journey_id){deliveryMessage("Esta entrega já está vinculada a uma jornada e não pode ser excluída pelo vendedor.","error");return;}
  const modal=document.createElement("div");
  modal.className="sales-modal-backdrop";
  modal.innerHTML='<section class="sales-modal sales-delete-modal" role="dialog" aria-modal="true" aria-labelledby="salesDeleteTitle"><header class="sales-modal-head"><div><p class="eyebrow">CONFIRMAR EXCLUSÃO</p><h2 id="salesDeleteTitle">Excluir entrega?</h2><p>Esta ação não pode ser desfeita.</p></div><button type="button" class="sales-modal-close" aria-label="Fechar">×</button></header><p class="sales-delete-description"></p><p class="sales-message" role="status"></p><footer class="sales-modal-actions"><button type="button" class="button secondary" data-cancel>Cancelar</button><button type="button" class="button danger" data-confirm-delete>Excluir entrega</button></footer></section>';
  document.body.append(modal);
  modal.querySelector(".sales-delete-description").textContent=(item.customer_order_ref||("Entrega "+item.order_no))+" · "+item.address;
  const close=()=>modal.remove();
  modal.querySelector(".sales-modal-close").addEventListener("click",close);
  modal.querySelector("[data-cancel]").addEventListener("click",close);
  modal.addEventListener("click",event=>{if(event.target===modal)close();});
  modal.querySelector("[data-confirm-delete]").addEventListener("click",async()=>{
   const button=modal.querySelector("[data-confirm-delete]"),msg=modal.querySelector(".sales-message");
   button.disabled=true;msg.textContent="Excluindo e verificando no Supabase…";msg.className="sales-message";
   try{
    const {data:{user},error:userError}=await backend.client.auth.getUser();if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
    const {data,error}=await backend.client.from("deliveries").delete().eq("id",item.id).eq("created_by",user.id).is("journey_id",null).select("id");
    if(error)throw error;
    if(!data?.length)throw new Error("O Supabase não confirmou a exclusão. Verifique se a migração de permissões foi aplicada e se a entrega continua sem jornada vinculada.");
    close();deliveryMessage("Entrega excluída e confirmada no Supabase.","success");await loadRecent();
   }catch(error){msg.textContent="Não foi possível excluir: "+error.message;msg.className="sales-message error";button.disabled=false;}
  });
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
