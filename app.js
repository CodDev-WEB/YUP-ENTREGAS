const $ = id => document.getElementById(id);
const backend = window.YupBackend;
const localKey = "yup-entregas-local-expenses-v1:" + (backend?.profile?.id || "unknown");
const admin = ["admin","manager"].includes(backend?.profile?.role);
let drivers=[], vehicles=[], neighborhoods=[], journeys=[], deliveries=[], currentJourney=null, loading=false;
let local = (()=>{try{return JSON.parse(localStorage.getItem(localKey))||{fuel:[],maintenance:[]}}catch{return {fuel:[],maintenance:[]}}})();
const now = () => new Date().toISOString();
const fmtDate = v => v ? new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : "—";
const money = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusLabel = {open:"Em andamento",finished:"Finalizada",cancelled:"Cancelada",pending:"Pendente",in_transit:"Em deslocamento",at_destination:"No endereço",completed:"Concluída",failed:"Não realizada"};
const priorityMap = {"Normal":"normal","Alta":"high","Agendada":"scheduled"};
function notify(text){alert(text)}
function setBusy(form,busy){form.querySelectorAll("button").forEach(b=>b.disabled=busy)}
function setView(view){document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));$("view-"+view)?.classList.remove("hidden");document.querySelectorAll(".nav").forEach(el=>el.classList.toggle("active",el.dataset.view===view));render()}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
function fillSelect(el,items,value,label,placeholder){el.replaceChildren();const first=document.createElement("option");first.value="";first.textContent=placeholder;el.append(first);items.forEach(item=>{const o=document.createElement("option");o.value=item[value];o.textContent=label(item);el.append(o)})}
function ensureSelect(id,placeholder){const old=$(id);if(old.tagName==="SELECT")return old;const select=document.createElement("select");select.id=old.id;select.required=old.required;select.className=old.className;select.setAttribute("aria-label",old.getAttribute("aria-label")||old.parentElement?.textContent.trim()||id);old.replaceWith(select);return select}
function currentDriver(){return drivers.find(d=>d.profile_id===backend?.profile?.id)}
function openJourney(){const driverId=admin?$("driverId")?.value:currentDriver()?.id;return journeys.find(j=>j.status==="open"&&driverId&&j.driver_id===driverId)||null}
async function refresh(){
 if(loading)return;loading=true;
 try{
  [drivers,vehicles,neighborhoods]=await Promise.all([backend.listDrivers(),backend.listVehicles(),backend.listNeighborhoods()]);
  const result=await backend.listOperations();journeys=result.journeys;deliveries=result.deliveries;currentJourney=openJourney();
  const driverSelect=ensureSelect("driverId","Selecione o entregador");
  const vehicleSelect=ensureSelect("vehicle","Selecione o veículo");
  fillSelect(driverSelect,drivers,"id",d=>d.registration_no+" — "+d.full_name,drivers.length?"Selecione o entregador":"Nenhum entregador ativo vinculado");
  fillSelect(vehicleSelect,vehicles,"id",v=>v.code+(v.plate?" — "+v.plate:"")+(v.make_model?" · "+v.make_model:""),vehicles.length?"Selecione o veículo":"Nenhum veículo ativo cadastrado");
  if(!admin){const d=currentDriver();if(d){driverSelect.value=d.id;driverSelect.disabled=true;}else{driverSelect.disabled=true;}}
  else {driverSelect.disabled=false;if(!driverSelect.value&&drivers.length)driverSelect.value=drivers[0].id;driverSelect.onchange=()=>{currentJourney=openJourney();render();};}
  fillSelect($("neighborhood"),neighborhoods,"id",n=>n.name,"Selecione o bairro");
  $("prototypeWarning").textContent="Jornadas e entregas são gravadas no Supabase e respeitam as permissões da conta. Combustível e manutenção ainda são registros locais deste navegador.";
  $("prototypeWarning").classList.remove("hidden");
  render();
 }catch(error){console.error(error);$("prototypeWarning").textContent="Falha ao carregar dados operacionais do Supabase: "+(error.message||"erro desconhecido")+". Verifique cadastros e políticas RLS."; $("prototypeWarning").classList.remove("hidden");}
 finally{loading=false}
}
$("journeyForm").addEventListener("submit",async e=>{
 e.preventDefault();if(currentJourney)return notify("Já existe uma jornada aberta para este entregador.");
 const driverId=$("driverId").value,vehicleId=$("vehicle").value,odometerStart=Number($("odoStart").value);
 if(!driverId||!vehicleId)return notify("Selecione um entregador e um veículo cadastrados.");
 setBusy(e.target,true);
 try{await backend.startJourney({driverId,vehicleId,odometerStart});e.target.reset();await refresh();notify("Jornada iniciada e salva no banco de dados.");}
 catch(error){console.error(error);notify("Não foi possível iniciar a jornada: "+error.message);}
 finally{setBusy(e.target,false)}
});
$("finishJourney").addEventListener("click",async()=>{
 if(!currentJourney)return;const raw=prompt("Informe o odômetro final (km):");if(raw===null)return;
 const end=Number(raw);if(!Number.isFinite(end)||end<Number(currentJourney.odometer_start))return notify("Odômetro inválido: deve ser igual ou superior ao inicial.");
 const pending=deliveries.filter(d=>d.journey_id===currentJourney.id&&!["completed","failed"].includes(d.status));
 if(pending.length)return notify("Finalize ou marque como não realizada cada entrega antes de encerrar a jornada.");
 try{await backend.finishJourney({journeyId:currentJourney.id,odometerEnd:end});await refresh();notify("Jornada finalizada e salva no banco de dados.");}
 catch(error){console.error(error);notify("Não foi possível finalizar a jornada: "+error.message)}
});
$("deliveryForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentJourney)return notify("Inicie uma jornada antes de adicionar entregas.");
 const orderNo=$("orderNo").value.trim(),address=$("address").value.trim();
 if(!orderNo||!address)return notify("Informe número da ordem e endereço.");
 const related=deliveries.filter(d=>d.journey_id===currentJourney.id);
 setBusy(e.target,true);
 try{
  await backend.createDelivery({journeyId:currentJourney.id,orderNo,neighborhoodId:$("neighborhood").value||null,address,reference:$("reference").value.trim(),priority:priorityMap[$("priority").value]||"normal",mapLink:$("mapLink").value.trim(),sequenceNo:related.length+1});
  e.target.reset();await refresh();notify("Entrega salva no Supabase.");
 }catch(error){console.error(error);notify("Não foi possível cadastrar a entrega: "+error.message)}
 finally{setBusy(e.target,false)}
});
$("pasteLocation").addEventListener("click",()=>{
 if(!navigator.geolocation)return notify("Geolocalização não disponível neste navegador.");
 navigator.geolocation.getCurrentPosition(pos=>{const {latitude,longitude}=pos.coords;$("mapLink").value="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(latitude+","+longitude);if(!$("address").value)$("address").value=latitude.toFixed(6)+", "+longitude.toFixed(6)},err=>notify("Não foi possível obter a localização. Verifique a permissão do navegador. ("+err.message+")"),{enableHighAccuracy:true,timeout:10000});
});
function mapLinkDestination(raw){
 const value=String(raw||"").trim();
 if(!value)return {kind:"none"};
 let url;
 try{url=new URL(value)}catch{return {kind:"text",value};}
 if(!["https:","http:"].includes(url.protocol))return {kind:"text",value};
 const host=url.hostname.toLowerCase();
 const isGoogleMaps=host==="maps.google.com"||host==="maps.app.goo.gl"||host==="goo.gl"||host==="google.com"||host.endsWith(".google.com");
 // Links curtos não expõem a coordenada no próprio URL. Abra o link original para o Maps resolver o destino.
 if(host==="maps.app.goo.gl"||(host==="goo.gl"&&url.pathname.startsWith("/maps")))return {kind:"direct",url:url.href};
 const coordinatePatterns=[
  /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/
 ];
 const candidates=[url.searchParams.get("q"),url.searchParams.get("query"),url.searchParams.get("destination"),url.pathname,url.href].filter(Boolean);
 for(const candidate of candidates){
  for(const pattern of coordinatePatterns){
   const match=candidate.match(pattern);
   if(match){
    const lat=Number(match[1]),lng=Number(match[2]);
    if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)
     return {kind:"coordinates",value:lat+","+lng};
   }
  }
 }
 if(isGoogleMaps)return {kind:"direct",url:url.href};
 return {kind:"text",value};
}
function deliveryDestination(delivery){
 const parsed=mapLinkDestination(delivery.map_link);
 if(parsed.kind==="coordinates")return parsed.value;
 // Links curtos não podem ser usados como waypoints. Nesse caso, usamos o endereço cadastrado.
 return [delivery.address,delivery.neighborhoods?.name,"Santarém, PA, Brasil"].filter(Boolean).join(", ");
}
function openGoogleRoute(items,startIndex=0){
 const stops=items.slice(startIndex);
 if(!stops.length)return notify("Cadastre pelo menos uma entrega para abrir a rota.");
 // Google Maps URLs suportam até 9 waypoints em navegadores desktop e até 3 em navegadores móveis.
 // Mantemos até 3 paradas intermediárias para maior compatibilidade com celulares.
 const maxWaypoints=3;
 const batchSize=maxWaypoints+1; // destino final + até 3 waypoints anteriores
 const batch=stops.slice(0,batchSize);
 const destinations=batch.map(deliveryDestination);
 const destination=destinations[destinations.length-1];
 const waypoints=destinations.slice(0,-1);
 const params=new URLSearchParams({api:"1",destination,travelmode:"driving"});
 if(waypoints.length)params.set("waypoints",waypoints.join("|"));
 window.open("https://www.google.com/maps/dir/?"+params.toString(),"_blank","noopener,noreferrer");
 if(stops.length>batch.length){
  notify("O Google Maps limita a quantidade de paradas por rota em celulares. Abri o primeiro trecho com "+batch.length+" entregas. Após concluí-lo, abra novamente a rota para continuar pelas próximas paradas.");
 }
}
async function deliveryAction(id,action){
 const d=deliveries.find(x=>x.id===id);if(!d)return;
 if(action==="navigate"){
  const parsed=mapLinkDestination(d.map_link);
  if(parsed.kind==="direct"){window.open(parsed.url,"_blank","noopener,noreferrer");return}
  const destination=parsed.kind==="coordinates"?parsed.value:(parsed.kind==="text"&&d.map_link&&!/^https?:\/\//i.test(parsed.value)?parsed.value:[d.address,d.neighborhoods?.name,"Santarém, PA, Brasil"].filter(Boolean).join(", "));
  window.open("https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(destination)+"&travelmode=driving","_blank","noopener,noreferrer");
  return
 }
 if(action==="up"||action==="down"){
  const siblings=deliveries.filter(x=>x.journey_id===d.journey_id).sort((a,b)=>a.sequence_no-b.sequence_no);const i=siblings.findIndex(x=>x.id===id),j=action==="up"?i-1:i+1;if(j<0||j>=siblings.length)return;
  // Reordering requires a dedicated transactional RPC to avoid duplicate sequence values.
  return notify("A reordenação segura da rota será ativada na próxima etapa.");
 }
 const statuses={start:"in_transit",arrive:"at_destination",complete:"completed",failed:"failed"};const status=statuses[action];if(!status)return;
 if(action==="complete"&&!confirm("Confirmar conclusão desta entrega?"))return;
 if(action==="failed"&&!confirm("Marcar esta entrega como não realizada?"))return;
 try{await backend.updateDeliveryStatus({deliveryId:id,status});await refresh();notify("Status atualizado no banco de dados.");}
 catch(error){console.error(error);notify("Não foi possível atualizar a entrega: "+error.message)}
}
function renderDeliveries(){
 const list=$("deliveryList");const ds=currentJourney?deliveries.filter(d=>d.journey_id===currentJourney.id).sort((a,b)=>a.sequence_no-b.sequence_no):[];
 $("metricStops").textContent=ds.length;$("metricDone").textContent=ds.filter(d=>d.status==="completed").length;
 $("metricKm").textContent=currentJourney?"Em andamento":"—";$("journeyBadge").textContent=currentJourney?"Jornada em andamento":"Jornada não iniciada";
 $("startJourney").classList.toggle("hidden",!!currentJourney);$("finishJourney").classList.toggle("hidden",!currentJourney);
 ["driverId","vehicle","odoStart"].forEach(id=>$(id).disabled=!!currentJourney||(!admin&&id==="driverId"));
 if(!ds.length){list.className="delivery-list empty";list.textContent="Nenhuma entrega cadastrada nesta jornada.";return}
 list.className="delivery-list";
 list.innerHTML=ds.map((d,i)=>'<div class="delivery-card"><div class="stop-number">'+(i+1)+'</div><div><h3>Ordem '+esc(d.order_no)+' · '+esc(d.neighborhoods?.name||"Bairro não informado")+'</h3><p>'+esc(d.address)+(d.reference?" · "+esc(d.reference):"")+'</p><p>Prioridade: '+esc(d.priority)+' · Criada: '+fmtDate(d.created_at)+'</p><p>Status: '+esc(statusLabel[d.status]||d.status)+'</p>'+(d.delivery_events?.length?'<details><summary>Linha do tempo ('+d.delivery_events.length+')</summary>'+d.delivery_events.map(ev=>'<p>'+esc(statusLabel[ev.event_type]||ev.event_type)+': '+fmtDate(ev.received_at_server)+(ev.note?" · "+esc(ev.note):"")+'</p>').join("")+'</details>':"")+'<div class="actions"><button class="mini" data-act="up" data-id="'+d.id+'">↑ Subir</button><button class="mini" data-act="down" data-id="'+d.id+'">↓ Descer</button><button class="mini" data-act="navigate" data-id="'+d.id+'">Navegar</button>'+(d.status==="pending"?'<button class="mini" data-act="start" data-id="'+d.id+'">Registrar saída</button>':"")+(d.status==="in_transit"?'<button class="mini" data-act="arrive" data-id="'+d.id+'">Registrar chegada</button><button class="mini" data-act="complete" data-id="'+d.id+'">Concluir</button>':"")+(d.status==="at_destination"?'<button class="mini" data-act="complete" data-id="'+d.id+'">Concluir</button>':"")+([ "pending","in_transit","at_destination"].includes(d.status)?'<button class="mini" data-act="failed" data-id="'+d.id+'">Não realizada</button>':"")+'</div></div><span class="tag '+(d.status==="completed"?"done":"")+'">'+esc(statusLabel[d.status]||d.status)+'</span></div>').join("");
 list.querySelectorAll("button[data-act]").forEach(b=>b.addEventListener("click",()=>deliveryAction(b.dataset.id,b.dataset.act)));
}
$("openRoute").addEventListener("click",()=>{
 const ds=currentJourney?deliveries.filter(d=>d.journey_id===currentJourney.id).sort((a,b)=>a.sequence_no-b.sequence_no):[];
 if(!ds.length)return notify("Não há entregas cadastradas na jornada atual.");
 let startIndex=0;
 const maxStopsPerSegment=4;
 if(ds.length>maxStopsPerSegment){
  const answer=prompt("Esta rota tem "+ds.length+" entregas. Para respeitar o limite do Google Maps em celulares, escolha o número da primeira entrega deste trecho (1, 5, 9...). Para abrir o primeiro trecho, digite 1.", "1");
  if(answer===null)return;
  const first=Number(answer);
  if(!Number.isInteger(first)||first<1||first>ds.length||((first-1)%maxStopsPerSegment)!==0)
   return notify("Número inválido. Escolha 1, 5, 9, 13... até a última entrega disponível.");
  startIndex=first-1;
 }
 openGoogleRoute(ds,startIndex);
});
function render(){
 renderDeliveries();
 $("fleetJourneys").textContent=journeys.length;$("fleetDeliveries").textContent=deliveries.length;
 $("fleetKm").textContent=journeys.filter(j=>j.odometer_end!=null).reduce((sum,j)=>sum+Number(j.odometer_end)-Number(j.odometer_start),0).toLocaleString("pt-BR",{maximumFractionDigits:1});
 $("journeyHistory").innerHTML=journeys.length?'<table><thead><tr><th>Entregador</th><th>Veículo</th><th>Início</th><th>Fim</th><th>KM</th><th>Status</th></tr></thead><tbody>'+journeys.map(j=>'<tr><td>'+esc(j.drivers?.registration_no||j.drivers?.full_name||"—")+'</td><td>'+esc(j.vehicles?.code||j.vehicles?.plate||"—")+'</td><td>'+fmtDate(j.started_at_server)+'</td><td>'+fmtDate(j.finished_at_server)+'</td><td>'+(j.odometer_end==null?"—":(Number(j.odometer_end)-Number(j.odometer_start)).toLocaleString("pt-BR"))+'</td><td>'+esc(statusLabel[j.status]||j.status)+'</td></tr>').join("")+'</tbody></table>':'<p class="hint">Nenhuma jornada registrada no banco.</p>';
 $("fuelTotalLiters").textContent=local.fuel.reduce((s,x)=>s+x.liters,0).toLocaleString("pt-BR",{maximumFractionDigits:2})+" L";const costs=local.fuel.reduce((s,x)=>s+x.cost,0),liters=local.fuel.reduce((s,x)=>s+x.liters,0);$("fuelTotalCost").textContent=money(costs);$("fuelAverage").textContent=liters?money(costs/liters)+"/L":"—";
 $("fuelHistory").innerHTML=table(local.fuel,[["date","Data"],["vehicle","Veículo"],["odo","Odômetro"],["liters","Litros"],["cost","Valor"]],x=>({...x,date:fmtDate(x.date),cost:money(x.cost)}));
 $("maintenanceHistory").innerHTML=table(local.maintenance,[["date","Data"],["vehicle","Veículo"],["type","Serviço"],["odo","Odômetro"],["cost","Valor"],["description","Descrição"]],x=>({...x,cost:money(x.cost)}));
}
function table(items,cols,transform=x=>x){if(!items.length)return '<p class="hint">Nenhum registro ainda.</p>';return '<table><thead><tr>'+cols.map(c=>'<th>'+c[1]+'</th>').join("")+'</tr></thead><tbody>'+items.slice().reverse().map(raw=>{const x=transform(raw);return '<tr>'+cols.map(c=>'<td>'+esc(x[c[0]]??"—")+'</td>').join("")+'</tr>'}).join("")+'</tbody></table>'}
$("fuelDate").value=new Date().toISOString().slice(0,16);$("maintDate").value=new Date().toISOString().slice(0,10);
$("fuelForm").addEventListener("submit",e=>{e.preventDefault();local.fuel.push({id:crypto.randomUUID(),vehicle:$("fuelVehicle").value.trim(),date:$("fuelDate").value,odo:Number($("fuelOdo").value),liters:Number($("fuelLiters").value),cost:Number($("fuelCost").value),note:$("fuelNote").value.trim()});localStorage.setItem(localKey,JSON.stringify(local));e.target.reset();$("fuelDate").value=new Date().toISOString().slice(0,16);render()});
$("maintenanceForm").addEventListener("submit",e=>{e.preventDefault();local.maintenance.push({id:crypto.randomUUID(),vehicle:$("maintVehicle").value.trim(),date:$("maintDate").value,type:$("maintType").value,odo:$("maintOdo").value?Number($("maintOdo").value):null,cost:Number($("maintCost").value),description:$("maintDescription").value.trim()});localStorage.setItem(localKey,JSON.stringify(local));e.target.reset();$("maintDate").value=new Date().toISOString().slice(0,10);render()});
backend.subscribeToOperations(()=>refresh());
refresh();