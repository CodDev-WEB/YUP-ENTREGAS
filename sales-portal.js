(() => {
 const $=id=>document.getElementById(id);
 const backend=window.YupBackend;
 let profile=null,neighborhoods=[],recent=[],filter="all";
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const onlyDigits=value=>String(value||"").replace(/\D/g,"");
 const lower=value=>String(value||"").trim().toLocaleLowerCase("pt-BR");
 const formatCep=value=>{const digits=onlyDigits(value).slice(0,8);return digits.length>5?digits.slice(0,5)+"-"+digits.slice(5):digits;};

 const icon={
  alert:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>',
  ok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
  lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  spin:'<svg class="sv-spin" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
 };

 /* Mensagens e erros por campo */
 function showMessage(target,text,type=""){
  if(!target)return;
  if(!text){target.innerHTML="";target.className="sv-message";return;}
  target.className="sv-message"+(type?" "+type:"");
  target.innerHTML=(type==="success"?icon.ok:type==="error"?icon.alert:icon.info)+"<span></span>";
  target.querySelector("span").textContent=text;
 }
 const deliveryMessage=(text,type="")=>showMessage($("salesDeliveryMessage"),text,type);
 let errorSeq=0;
 function setFieldError(field,text){
  clearFieldError(field);
  const id="svErr"+(++errorSeq);
  const err=document.createElement("span");
  err.className="sv-error";err.id=id;err.dataset.errorFor="1";
  err.innerHTML=icon.alert+"<span></span>";err.querySelector("span").textContent=text;
  field.setAttribute("aria-invalid","true");
  field.dataset.prevDescribedby=field.getAttribute("aria-describedby")||"";
  field.setAttribute("aria-describedby",[id,field.dataset.prevDescribedby].filter(Boolean).join(" "));
  (field.closest(".sv-field,.sv-points")||field).insertAdjacentElement(field.closest(".sv-field")?"beforeend":"afterend",err);
  field._svError=err;
 }
 function clearFieldError(field){
  if(!field||!field._svError)return;
  field._svError.remove();field._svError=null;field.removeAttribute("aria-invalid");
  if(field.dataset.prevDescribedby)field.setAttribute("aria-describedby",field.dataset.prevDescribedby);else field.removeAttribute("aria-describedby");
 }
 function clearAllErrors(form){form.querySelectorAll('[aria-invalid="true"]').forEach(clearFieldError);}

 /* Caixa alta durante a digitação, como antes (exceto CEP e links) */
 function upperCaseOnInput(event){
  const field=event.target;
  if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement))return;
  if(["url","email","password","number","radio","checkbox"].includes(field.type)||field.name==="postalCode")return;
  const start=field.selectionStart,end=field.selectionEnd,upper=field.value.toLocaleUpperCase("pt-BR");
  if(field.value!==upper){field.value=upper;if(typeof start==="number"&&typeof end==="number")field.setSelectionRange(start,end);}
 }

 /* Separa "RUA X, Nº 12, APTO 3" de volta em logradouro, número e complemento */
 function splitAddress(full){
  const parts=String(full||"").split(/,\s*/);
  const index=parts.findIndex(part=>/^N[ºo°]\s*\S/i.test(part));
  if(index<1)return {street:String(full||""),number:"",complement:""};
  return {street:parts.slice(0,index).join(", "),number:parts[index].replace(/^N[ºo°]\s*/i,""),complement:parts.slice(index+1).join(", ")};
 }
 const joinAddress=(street,number,complement)=>[street,number?"Nº "+number:"",complement].filter(Boolean).join(", ");

 /* Consulta de CEP reutilizada pelo cadastro e pela correção */
 function attachCepLookup(form,say){
  const cep=form.elements.postalCode;
  let token=0,last="";
  async function lookup(){
   const digits=onlyDigits(cep.value);
   if(digits.length!==8){setFieldError(cep,"O CEP precisa ter 8 números.");return;}
   const current=++token;last=digits;clearFieldError(cep);
   say("Consultando CEP…");
   try{
    const response=await fetch("https://viacep.com.br/ws/"+digits+"/json/");
    if(!response.ok)throw new Error("O serviço de CEP não respondeu. Preencha o endereço manualmente.");
    const result=await response.json();
    if(current!==token)return;
    if(result.erro)throw new Error("CEP não encontrado. Confira os números ou preencha o endereço manualmente.");
    if(result.logradouro){
     let street=result.logradouro;
     const cityState=[result.localidade,result.uf].filter(Boolean).join("/");
     if(cityState&&!lower(street).includes(lower(cityState)))street+=" - "+cityState;
     form.elements.address.value=street.toLocaleUpperCase("pt-BR");clearFieldError(form.elements.address);
    }
    let matched=true;
    if(result.bairro){
     const match=[...form.elements.neighborhood.options].find(option=>option.value&&lower(option.textContent)===lower(result.bairro));
     if(match){form.elements.neighborhood.value=match.value;clearFieldError(form.elements.neighborhood);}else matched=false;
    }
    if(matched)say("Endereço encontrado. Informe o número e confira os dados.","success");
    else say("Endereço encontrado, mas o bairro "+result.bairro+" não está cadastrado. Escolha o bairro mais próximo ou peça à administração para cadastrá-lo.","error");
    form.elements.houseNumber.focus();
   }catch(error){if(current===token)say(error.message,"error");}
  }
  cep.addEventListener("input",()=>{cep.value=formatCep(cep.value);clearFieldError(cep);const digits=onlyDigits(cep.value);if(digits.length===8&&digits!==last)lookup();else if(digits.length<8)last="";});
  cep.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();lookup();}});
 }

 /* Diálogo acessível: Esc, foco preso, fundo inerte e foco devolvido */
 function openDialog(html,origin,{canClose=()=>true}={}){
  const backdrop=document.createElement("div");
  backdrop.className="sv-backdrop";backdrop.innerHTML=html;
  const background=[document.querySelector(".topbar"),$("appLayout")].filter(Boolean);
  background.forEach(el=>el.inert=true);
  document.body.append(backdrop);document.body.classList.add("sv-dialog-open");
  const dialog=backdrop.querySelector('[role="dialog"],[role="alertdialog"]');
  const close=(force=false)=>{
   if(!force&&!canClose())return;
   backdrop.remove();background.forEach(el=>el.inert=false);document.body.classList.remove("sv-dialog-open");
   if(origin&&origin.isConnected)origin.focus();else $("salesListTitle")?.focus();
  };
  backdrop.addEventListener("keydown",event=>{
   if(event.key==="Escape"){event.preventDefault();close();return;}
   if(event.key!=="Tab")return;
   const items=[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.getClientRects().length);
   if(!items.length)return;
   const first=items[0],lastItem=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();lastItem.focus();}
   else if(!event.shiftKey&&document.activeElement===lastItem){event.preventDefault();first.focus();}
  });
  backdrop.addEventListener("mousedown",event=>{if(event.target===backdrop)close();});
  backdrop.querySelectorAll("[data-dialog-close]").forEach(button=>button.addEventListener("click",()=>close()));
  return {backdrop,dialog,close};
 }

 /* Formulário de cadastro */
 const salesForm=$("salesDeliveryForm");
 const fields=salesForm.elements;
 const manualBox=$("salesManualBox"),fixedBox=$("salesFixedBox"),fixedSummary=$("salesFixedSummary");
 const submitButton=salesForm.querySelector(".sv-submit");
 const fixedDeliveryPoints={
  rodoviaria:{name:"Rodoviária",cep:"68030-000",number:"3360",address:"RODOVIÁRIA"},
  hidroviario:{name:"Hidroviário e D.E.R.",cep:"68005-200",number:"2",address:"HIDROVIÁRIO E D.E.R."},
  frente_cidade:{name:"Em frente da cidade",cep:"68005-000",number:"834",address:"ENTREGA EM FRENTE DA CIDADE"},
  transportadora:{name:"Transportadora",cep:"68005-360",number:"387",address:"TRANSPORTADORA"}
 };
 const isFixedMode=()=>salesForm.querySelector('input[name="mode"]:checked')?.value==="fixed";
 const selectedPoint=()=>fixedDeliveryPoints[salesForm.querySelector('input[name="fixedPoint"]:checked')?.value||""];
 function syncMode(){
  const fixed=isFixedMode();
  manualBox.hidden=fixed;fixedBox.hidden=!fixed;
  const point=selectedPoint();
  fixedSummary.hidden=!point;
  if(point){fixedSummary.querySelector("strong").textContent=point.name;fixedSummary.querySelector("span").textContent="CEP "+point.cep+" · Nº "+point.number;}
  clearAllErrors(salesForm);
 }
 salesForm.addEventListener("input",upperCaseOnInput);
 salesForm.addEventListener("change",event=>{
  if(event.target.name==="mode"||event.target.name==="fixedPoint"){syncMode();deliveryMessage("");}
  if(event.target.name==="neighborhood")clearFieldError(event.target);
 });
 ["houseNumber","address"].forEach(name=>fields[name].addEventListener("input",()=>clearFieldError(fields[name])));
 salesForm.addEventListener("reset",()=>setTimeout(syncMode));
 attachCepLookup(salesForm,deliveryMessage);

 function validateNew(){
  clearAllErrors(salesForm);
  const invalid=[];
  if(isFixedMode()){
   if(!selectedPoint()){const first=salesForm.querySelector('input[name="fixedPoint"]');setFieldError(first,"Escolha um dos pontos fixos.");invalid.push(first);}
   return invalid;
  }
  const cep=onlyDigits(fields.postalCode.value);
  if(cep.length!==8){setFieldError(fields.postalCode,cep?"O CEP precisa ter 8 números.":"Informe o CEP para localizar o endereço.");invalid.push(fields.postalCode);}
  if(!fields.houseNumber.value.trim()){setFieldError(fields.houseNumber,"Informe o número do imóvel. Use S/N se não houver.");invalid.push(fields.houseNumber);}
  if(!fields.address.value.trim()){setFieldError(fields.address,"Informe a rua ou avenida.");invalid.push(fields.address);}
  if(!fields.neighborhood.value){setFieldError(fields.neighborhood,"Selecione o bairro.");invalid.push(fields.neighborhood);}
  return invalid;
 }
 function setBusy(button,busy,label,busyLabel){
  button.disabled=busy;button.setAttribute("aria-busy",String(busy));
  button.innerHTML=(busy?icon.spin:icon.plus)+"<span>"+(busy?busyLabel:label)+"</span>";
 }
 salesForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const invalid=validateNew();
  if(invalid.length){
   invalid[0].focus();
   deliveryMessage(invalid.length===1?"1 campo precisa de atenção.":invalid.length+" campos precisam de atenção.","error");
   return;
  }
  const point=isFixedMode()?selectedPoint():null;
  const address=point?joinAddress(point.address,point.number,""):joinAddress(fields.address.value.trim(),fields.houseNumber.value.trim(),fields.complement.value.trim());
  setBusy(submitButton,true,"Cadastrar entrega","Cadastrando…");deliveryMessage("");
  try{
   await backend.createDelivery({journeyId:null,customerName:fields.customerName.value,neighborhoodId:point?"":fields.neighborhood.value,address,reference:point?"":fields.reference.value,mapLink:point?"":fields.mapLink.value,priority:salesForm.querySelector('input[name="priority"]:checked')?.value||"normal"});
   salesForm.reset();syncMode();
   deliveryMessage("Entrega cadastrada. Ela já aparece para o entregador.","success");
   filter="all";syncFilterButtons();
   await loadRecent({highlightFirst:true});
   fields.postalCode.focus({preventScroll:true});
  }catch(error){deliveryMessage("Não foi possível cadastrar: "+friendlyError(error),"error");}
  finally{setBusy(submitButton,false,"Cadastrar entrega","Cadastrando…");}
 });
 function friendlyError(error){
  const text=String(error?.message||error||"");
  if(/fetch|network|failed to|load failed/i.test(text))return "sem conexão com o servidor. Verifique a internet e tente de novo.";
  if(/sess[aã]o expirada|jwt/i.test(text))return "sua sessão expirou. Saia e entre novamente.";
  return text||"erro desconhecido.";
 }

 /* Lista "Minhas entregas" */
 const statusInfo={pending:["pend","Pendente"],in_transit:["route","Em rota"],at_destination:["route","No endereço"],completed:["done","Concluída"],failed:["fail","Não realizada"]};
 const filterMatch={all:()=>true,pending:s=>s==="pending",route:s=>s==="in_transit"||s==="at_destination",completed:s=>s==="completed",failed:s=>s==="failed"};
 function relativeDate(value){
  const date=new Date(value),now=new Date();
  const time=date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  const startOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const days=Math.round((startOf(now)-startOf(date))/86400000);
  if(days===0)return "Hoje, "+time;
  if(days===1)return "Ontem, "+time;
  return date.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+", "+time;
 }
 function syncFilterButtons(){document.querySelectorAll("[data-sales-filter]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.salesFilter===filter)));}
 function renderRecent(highlightId){
  const target=$("salesRecentList");
  $("salesCount").textContent=recent.length===1?"1 cadastrada recentemente":recent.length+" cadastradas recentemente";
  const list=recent.filter(item=>(filterMatch[filter]||filterMatch.all)(item.status));
  if(!recent.length){target.innerHTML='<div class="sv-empty">Você ainda não cadastrou entregas. Use o formulário para registrar o primeiro pedido.</div>';return;}
  if(!list.length){target.innerHTML='<div class="sv-empty">Nenhuma entrega neste filtro.</div>';return;}
  target.innerHTML=list.map(item=>{
   const [statusClass,statusLabel]=statusInfo[item.status]||["pend",item.status];
   const priority=item.priority==="high"?'<span class="sv-badge sv-badge-warn">Prioridade alta</span>':item.priority==="scheduled"?'<span class="sv-badge sv-badge-warn">Agendada</span>':"";
   const locked=Boolean(item.journey_id);
   return '<article class="sv-order'+(item.id===highlightId?" is-new":"")+'">'
    +'<div class="sv-order-top"><h3>'+esc(item.customer_order_ref||("Pedido "+item.order_no))+'</h3><span class="sv-badge sv-status-'+statusClass+'">'+esc(statusLabel)+'</span></div>'
    +'<p class="sv-order-address">'+esc(item.address)+' · '+esc(item.neighborhoods?.name||"Sem bairro")+'</p>'
    +'<div class="sv-order-meta">'+priority+'<time datetime="'+esc(item.created_at)+'">'+esc(relativeDate(item.created_at))+'</time></div>'
    +'<div class="sv-order-actions"><button type="button" class="sv-btn" data-sales-edit="'+esc(item.id)+'">'+icon.edit+'Alterar</button>'
    +(locked?'<span class="sv-locked">'+icon.lock+'Já está numa jornada</span>':'<button type="button" class="sv-btn sv-btn-danger" data-sales-delete="'+esc(item.id)+'">'+icon.trash+'Excluir</button>')
    +'</div></article>';
  }).join("");
 }
 async function loadRecent({highlightFirst=false}={}){
  const target=$("salesRecentList"),refresh=$("salesRefresh");
  target.setAttribute("aria-busy","true");refresh.disabled=true;
  try{
   const {data:{user},error:userError}=await backend.client.auth.getUser();
   if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
   const {data,error}=await backend.client.from("deliveries").select("id,journey_id,order_no,customer_order_ref,address,reference,map_link,neighborhood_id,priority,status,created_at,neighborhoods(name)").eq("created_by",user.id).order("created_at",{ascending:false}).limit(30);
   if(error)throw error;
   recent=data||[];
   renderRecent(highlightFirst?recent[0]?.id:null);
  }catch(error){
   $("salesCount").textContent="Lista indisponível";
   target.innerHTML='<div class="sv-empty sv-empty-error">Não foi possível carregar suas entregas: '+esc(friendlyError(error))+' <button type="button" class="sv-link" data-sales-retry>Tentar de novo</button></div>';
  }finally{target.setAttribute("aria-busy","false");refresh.disabled=false;}
 }
 $("salesRefresh").addEventListener("click",()=>loadRecent());
 document.querySelectorAll("[data-sales-filter]").forEach(button=>button.addEventListener("click",()=>{filter=button.dataset.salesFilter;syncFilterButtons();renderRecent();}));
 $("salesRecentList").addEventListener("click",event=>{
  const edit=event.target.closest("[data-sales-edit]"),del=event.target.closest("[data-sales-delete]");
  if(event.target.closest("[data-sales-retry]"))loadRecent();
  if(edit)editDelivery(recent.find(item=>item.id===edit.dataset.salesEdit),edit);
  if(del)deleteDelivery(recent.find(item=>item.id===del.dataset.salesDelete),del);
 });

 /* Correção de entrega */
 function neighborhoodOptions(){return '<option value="">Selecione o bairro</option>'+neighborhoods.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join("");}
 function editDelivery(item,origin){
  if(!item)return;
  const needsNeighborhood=Boolean(item.neighborhood_id);
  const req='<span class="sv-req" aria-hidden="true">*</span>',opt='<span class="sv-opt">(opcional)</span>';
  const {dialog,close}=openDialog('<section class="sv-dialog" role="dialog" aria-modal="true" aria-labelledby="salesEditTitle"><header class="sv-dialog-head"><div><h2 id="salesEditTitle">Alterar entrega</h2><p>Revise os dados e salve.</p></div><button type="button" class="sv-icon-button" data-dialog-close aria-label="Fechar">'+icon.close+'</button></header>'
   +'<form class="sv-form" novalidate><div class="sv-fields">'
   +'<div class="sv-row"><label class="sv-field sv-cep"><span class="sv-label">CEP '+opt+'</span><input name="postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000"></label><label class="sv-field"><span class="sv-label">Número '+req+'</span><input name="houseNumber" maxlength="20" placeholder="Ex.: 120 ou S/N" aria-required="true"></label></div>'
   +'<label class="sv-field"><span class="sv-label">Logradouro '+req+'</span><input name="address" maxlength="300" aria-required="true"></label>'
   +'<div class="sv-row"><label class="sv-field"><span class="sv-label">Complemento '+opt+'</span><input name="complement" maxlength="120" placeholder="Casa, bloco, apartamento"></label><label class="sv-field"><span class="sv-label">Bairro '+(needsNeighborhood?req:opt)+'</span><select name="neighborhood"'+(needsNeighborhood?' aria-required="true"':"")+'>'+neighborhoodOptions()+'</select></label></div>'
   +'<label class="sv-field"><span class="sv-label">Referência '+opt+'</span><input name="reference" maxlength="250"></label>'
   +'<label class="sv-field"><span class="sv-label">Link de localização '+opt+'</span><input name="mapLink" type="url" inputmode="url"></label>'
   +'<label class="sv-field"><span class="sv-label">Nome do cliente '+opt+'</span><input name="customerName" maxlength="120"></label>'
   +'<fieldset class="sv-group sv-group-plain"><legend>Prioridade</legend><div class="sv-choice sv-choice-3" role="radiogroup" aria-label="Prioridade"><label><input type="radio" name="priority" value="normal">Normal</label><label><input type="radio" name="priority" value="high">Alta</label><label><input type="radio" name="priority" value="scheduled">Agendada</label></div></fieldset>'
   +'</div><div class="sv-message" role="status" aria-live="polite"></div>'
   +'<div class="sv-dialog-actions"><button type="button" class="sv-btn" data-dialog-close>Cancelar</button><button type="submit" class="sv-btn sv-btn-primary">Salvar alterações</button></div></form></section>',origin,{canClose:()=>{
    if(!dirty)return true;
    if(confirmDiscard)return true;
    confirmDiscard=true;show("Há alterações não salvas. Feche de novo para descartar.","error");return false;
   }});
  const form=dialog.querySelector("form"),msg=dialog.querySelector(".sv-message"),show=(text,type)=>showMessage(msg,text,type);
  let dirty=false,confirmDiscard=false;
  const parts=splitAddress(item.address);
  form.elements.address.value=parts.street;
  form.elements.houseNumber.value=parts.number;
  form.elements.complement.value=parts.complement;
  form.elements.reference.value=item.reference||"";
  form.elements.mapLink.value=item.map_link||"";
  form.elements.customerName.value=item.customer_order_ref||"";
  form.elements.neighborhood.value=item.neighborhood_id||"";
  (form.querySelector('input[name="priority"][value="'+(item.priority||"normal")+'"]')||form.querySelector('input[name="priority"]')).checked=true;
  form.addEventListener("input",event=>{dirty=true;confirmDiscard=false;upperCaseOnInput(event);if(event.target.name!=="postalCode")clearFieldError(event.target);});
  form.addEventListener("change",event=>{dirty=true;clearFieldError(event.target);});
  attachCepLookup(form,show);
  form.addEventListener("submit",async event=>{
   event.preventDefault();clearAllErrors(form);
   const street=form.elements.address.value.trim(),number=form.elements.houseNumber.value.trim(),neighborhoodId=form.elements.neighborhood.value,cep=onlyDigits(form.elements.postalCode.value);
   const invalid=[];
   if(cep&&cep.length!==8){setFieldError(form.elements.postalCode,"O CEP precisa ter 8 números ou ficar vazio.");invalid.push(form.elements.postalCode);}
   if(!number){setFieldError(form.elements.houseNumber,"Informe o número do imóvel. Use S/N se não houver.");invalid.push(form.elements.houseNumber);}
   if(!street){setFieldError(form.elements.address,"Informe a rua ou avenida.");invalid.push(form.elements.address);}
   if(needsNeighborhood&&!neighborhoodId){setFieldError(form.elements.neighborhood,"Selecione o bairro.");invalid.push(form.elements.neighborhood);}
   if(invalid.length){invalid[0].focus();show(invalid.length===1?"1 campo precisa de atenção.":invalid.length+" campos precisam de atenção.","error");return;}
   const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Salvando…";show("");
   try{
    const {data:{user},error:userError}=await backend.client.auth.getUser();if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
    const address=joinAddress(street,number,form.elements.complement.value.trim());
    const {data:updated,error}=await backend.client.from("deliveries").update({customer_order_ref:form.elements.customerName.value.trim().toLocaleUpperCase("pt-BR")||null,address:address.toLocaleUpperCase("pt-BR"),neighborhood_id:neighborhoodId||null,reference:form.elements.reference.value.trim().toLocaleUpperCase("pt-BR")||null,map_link:form.elements.mapLink.value.trim()||null,priority:form.querySelector('input[name="priority"]:checked')?.value||"normal"}).eq("id",item.id).eq("created_by",user.id).select("id,journey_id");
    if(error)throw error;
    if(!updated?.length)throw new Error("Nenhuma alteração foi gravada. A entrega pode ter mudado de responsável; atualize a lista.");
    close(true);
    deliveryMessage("Alterações salvas.","success");
    await loadRecent();
    const card=document.querySelector('[data-sales-edit="'+CSS.escape(item.id)+'"]');
    card?.closest(".sv-order")?.classList.add("is-new");card?.focus();
   }catch(error){show("Não foi possível salvar: "+friendlyError(error),"error");button.disabled=false;button.textContent="Salvar alterações";}
  });
  form.elements.address.focus();
 }

 /* Exclusão */
 function deleteDelivery(item,origin){
  if(!item)return;
  if(item.journey_id){deliveryMessage("Esta entrega já está numa jornada e não pode ser excluída.","error");return;}
  const {dialog,close}=openDialog('<section class="sv-dialog sv-dialog-small" role="alertdialog" aria-modal="true" aria-labelledby="salesDeleteTitle" aria-describedby="salesDeleteSummary"><header class="sv-dialog-head"><div><h2 id="salesDeleteTitle">Excluir esta entrega?</h2><p>Não dá para desfazer.</p></div><button type="button" class="sv-icon-button" data-dialog-close aria-label="Fechar">'+icon.close+'</button></header>'
   +'<div class="sv-delete-summary" id="salesDeleteSummary"><strong></strong><span></span></div><div class="sv-message" role="status" aria-live="polite"></div>'
   +'<div class="sv-dialog-actions"><button type="button" class="sv-btn" data-dialog-close>Manter entrega</button><button type="button" class="sv-btn sv-btn-danger-solid" data-confirm-delete>'+icon.trash+'Excluir entrega</button></div></section>',origin);
  dialog.querySelector(".sv-delete-summary strong").textContent=item.customer_order_ref||("Pedido "+item.order_no);
  dialog.querySelector(".sv-delete-summary span").textContent=item.address+" · "+(item.neighborhoods?.name||"Sem bairro");
  const msg=dialog.querySelector(".sv-message"),confirm=dialog.querySelector("[data-confirm-delete]");
  dialog.querySelector(".sv-dialog-actions [data-dialog-close]").focus();
  confirm.addEventListener("click",async()=>{
   confirm.disabled=true;confirm.innerHTML=icon.spin+"Excluindo…";showMessage(msg,"");
   try{
    const {data:{user},error:userError}=await backend.client.auth.getUser();if(userError||!user)throw new Error("Sessão expirada. Entre novamente.");
    const {data,error}=await backend.client.from("deliveries").delete().eq("id",item.id).eq("created_by",user.id).is("journey_id",null).select("id");
    if(error)throw error;
    if(!data?.length){
     console.warn("YUP-ENTREGAS: exclusão bloqueada. Verifique a migração supabase/migrations/20261028_sales_delete_pending_delivery.sql",item.id);
     throw new Error("a entrega pode já ter entrado numa jornada. Atualize a lista; se continuar, avise a administração.");
    }
    close(true);
    deliveryMessage("Entrega excluída.","success");
    await loadRecent();
    $("salesListTitle").focus();
   }catch(error){showMessage(msg,"Não foi possível excluir: "+friendlyError(error),"error");confirm.disabled=false;confirm.innerHTML=icon.trash+"Excluir entrega";}
  });
 }

 async function loadPortal(){
  if(!profile||profile.role!=="sales")return;
  try{
   neighborhoods=await backend.listNeighborhoods();
   fields.neighborhood.innerHTML=neighborhoodOptions();
   if(!neighborhoods.length)deliveryMessage("Nenhum bairro ativo foi cadastrado. Peça à administração para revisar o cadastro de bairros.","error");
  }catch(error){fields.neighborhood.innerHTML='<option value="">Bairros indisponíveis</option>';deliveryMessage("Não foi possível carregar os bairros: "+friendlyError(error),"error");}
  await loadRecent();
 }
 async function init(){
  syncMode();
  if(!backend){deliveryMessage("O sistema de acesso não foi carregado. Atualize a página.","error");return;}
  try{
   const result=await backend.getSessionProfile();
   if(result.ok&&result.authenticated&&result.profile.role==="sales"){profile=result.profile;await loadPortal();return;}
   deliveryMessage("Esta área é exclusiva para o perfil de vendas. Saia e entre com uma conta autorizada.","error");
  }catch(error){deliveryMessage("Não foi possível verificar a sessão: "+friendlyError(error),"error");}
 }
 init();
})();
