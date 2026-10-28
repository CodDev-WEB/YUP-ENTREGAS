const $ = id => document.getElementById(id);
const backend = window.YupBackend;
const localKey = "yup-entregas-local-expenses-v1:" + (backend?.profile?.id || "unknown");
const entryLocationKey = "yup-entregas-entry-location-v1:" + (backend?.profile?.id || "unknown");
const admin = ["admin","manager"].includes(backend?.profile?.role);
let drivers=[], vehicles=[], neighborhoods=[], journeys=[], deliveries=[], routePlans=[], routePlansError="", currentJourney=null, loading=false, entryLocationRequested=false, gpsWatchId=null, gpsJourneyId=null, lastGpsSaved=null, gpsSaving=false;
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
if(!admin){document.querySelector('[data-view="importacao-historico"]')?.classList.add("hidden");}
function fillSelect(el,items,value,label,placeholder){if(!el){console.warn("YUP-ENTREGAS: seletor opcional ausente no HTML; preenchimento ignorado.");return}el.replaceChildren();const first=document.createElement("option");first.value="";first.textContent=placeholder;el.append(first);(items||[]).forEach(item=>{const o=document.createElement("option");o.value=item[value];o.textContent=label(item);el.append(o)})}
function ensureSelect(id,placeholder){const old=$(id);if(!old){console.warn("YUP-ENTREGAS: campo obrigatório ausente no HTML:",id);return null}if(old.tagName==="SELECT")return old;const select=document.createElement("select");select.id=old.id;select.required=old.required;select.className=old.className;select.setAttribute("aria-label",old.getAttribute("aria-label")||old.parentElement?.textContent.trim()||id);old.replaceWith(select);return select}
function currentDriver(){return drivers.find(d=>d.profile_id===backend?.profile?.id)}
function openJourney(){const driverId=admin?$("driverId")?.value:currentDriver()?.id;return journeys.find(j=>j.status==="open"&&driverId&&j.driver_id===driverId)||null}
function setGpsStatus(message){const el=$("gpsTrackingStatus");if(el)el.textContent=message}
function stopGpsTracking(){
 if(gpsWatchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(gpsWatchId);
 gpsWatchId=null;gpsJourneyId=null;lastGpsSaved=null;gpsSaving=false;
}
function distanceMeters(a,b){
 const rad=x=>x*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function startGpsTracking(journey){
 if(!journey||journey.status!=="open"||gpsJourneyId===journey.id||!navigator.geolocation)return;
 stopGpsTracking();gpsJourneyId=journey.id;
 setGpsStatus("Rastreamento contínuo ativo durante a jornada.");
 gpsWatchId=navigator.geolocation.watchPosition(async pos=>{
  if(gpsJourneyId!==journey.id||gpsSaving)return;
  const coords=pos.coords,nowMs=Date.now(),point={latitude:coords.latitude,longitude:coords.longitude};
  const shouldSave=!lastGpsSaved||nowMs-lastGpsSaved.time>=30000||distanceMeters(lastGpsSaved,point)>=30;
  setGpsStatus("Rastreamento ativo · última posição "+new Date(pos.timestamp).toLocaleTimeString("pt-BR"));
  if(!shouldSave)return;
  gpsSaving=true;
  try{
   await backend.recordJourneyLocation({journeyId:journey.id,latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy,speed:coords.speed,heading:coords.heading,capturedAt:new Date(pos.timestamp).toISOString()});
   lastGpsSaved={...point,time:nowMs};
  }catch(error){console.error(error);setGpsStatus("Rastreamento ativo, mas a posição não sincronizou. Verifique a conexão.");}
  finally{gpsSaving=false;}
 },err=>{
  setGpsStatus("Rastreamento GPS interrompido: "+({1:"permissão negada",2:"posição indisponível",3:"tempo esgotado"}[err.code]||err.message));
 },{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
}
function shareEntryLocationOnce(){
 if(entryLocationRequested)return;
 entryLocationRequested=true;
 if(!navigator.geolocation){setGpsStatus("Este navegador não oferece acesso à localização.");return;}
 if(localStorage.getItem(entryLocationKey)==="done"){
  setGpsStatus(currentJourney?"Preparando rastreamento contínuo da jornada…":"Localização autorizada anteriormente; aguardando uma jornada.");
  if(currentJourney)startGpsTracking(currentJourney);
  return;
 }
 setGpsStatus("Solicitando permissão de localização ao entrar no PWA…");
 navigator.geolocation.getCurrentPosition(async pos=>{
  try{
   localStorage.setItem(entryLocationKey,"done");
   if(currentJourney){
    await backend.recordJourneyLocation({journeyId:currentJourney.id,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,speed:pos.coords.speed,heading:pos.coords.heading,capturedAt:new Date(pos.timestamp).toISOString()});
    startGpsTracking(currentJourney);
    setGpsStatus("Localização inicial registrada; rastreamento contínuo ativo.");
   }else setGpsStatus("Localização autorizada. O rastreamento contínuo começará automaticamente quando uma jornada for iniciada.");
  }catch(error){console.error(error);setGpsStatus("Não foi possível registrar a localização inicial. Verifique a conexão.");}
 },err=>setGpsStatus("Localização não compartilhada: "+({1:"permissão negada",2:"posição indisponível",3:"tempo esgotado"}[err.code]||err.message)),{enableHighAccuracy:true,maximumAge:0,timeout:20000});
}
async function loadJourneyTimeline(){
 const id=$("timelineJourney")?.value,target=$("journeyTimeline");
 if(!id){target.innerHTML='<p class="hint">Selecione uma jornada.</p>';return}
 target.innerHTML='<p class="hint">Carregando histórico completo…</p>';
 try{
  const journey=journeys.find(j=>j.id===id);
  const points=await backend.listJourneyLocationPoints(id);
  const related=deliveries.filter(d=>d.journey_id===id);
  const events=[];
  if(journey?.started_at_server)events.push({time:journey.started_at_server,type:"Início da jornada",detail:"Jornada iniciada no sistema",kind:"journey"});
  related.forEach(d=>{
   (d.delivery_events||[]).forEach(ev=>events.push({time:ev.received_at_server||ev.occurred_at_device,type:statusLabel[ev.event_type]||ev.event_type,detail:"Entrega "+d.order_no+" · "+d.address+(ev.note?" · "+ev.note:""),kind:"delivery"}));
   if(d.status==="completed"&&!d.delivery_events?.some(ev=>ev.event_type==="completed"))events.push({time:d.updated_at||d.created_at,type:"Entrega concluída",detail:"Entrega "+d.order_no+" · "+d.address,kind:"delivery"});
  });
  points.forEach(p=>events.push({time:p.captured_at_device,type:"Localização GPS",detail:p.latitude.toFixed(6)+", "+p.longitude.toFixed(6),kind:"gps",point:p}));
  if(journey?.finished_at_server)events.push({time:journey.finished_at_server,type:"Fim da jornada",detail:"Jornada finalizada no sistema",kind:"journey"});
  events.sort((a,b)=>new Date(a.time)-new Date(b.time));
  if(!events.length){target.innerHTML='<p class="hint">Ainda não há eventos nem pontos GPS registrados nesta jornada.</p>';return}
  let previousPoint=null,previousTime=null,totalStraight=0;
  const rows=events.map(ev=>{
   let gap="—",dist="—",location="—",speed="—";
   if(ev.kind==="gps"){
    const p=ev.point;
    location='<a href="https://www.google.com/maps?q='+p.latitude+','+p.longitude+'" target="_blank" rel="noopener">Abrir ponto no mapa</a>';
    speed=p.speed_mps==null?"—":(p.speed_mps*3.6).toFixed(1)+" km/h";
    if(previousPoint){
     const seconds=(new Date(p.captured_at_device)-new Date(previousPoint.captured_at_device))/1000;
     const meters=distanceMeters({latitude:previousPoint.latitude,longitude:previousPoint.longitude},{latitude:p.latitude,longitude:p.longitude});
     gap=seconds<0?"—":Math.floor(seconds/60)+" min "+Math.round(seconds%60)+" s";
     dist=meters>=1000?(meters/1000).toFixed(2)+" km":Math.round(meters)+" m";
     totalStraight+=meters;
    }
    previousPoint=p;
   }
   const time=new Date(ev.time);
   const elapsed=previousTime?Math.max(0,Math.round((time-previousTime)/60000))+" min":"—";
   previousTime=time;
   return '<tr><td>'+fmtDate(ev.time)+'</td><td>'+esc(ev.type)+'</td><td>'+esc(ev.detail)+'</td><td>'+location+'</td><td>'+gap+'</td><td>'+dist+'</td><td>'+speed+'</td></tr>';
  });
  const total=totalStraight>=1000?(totalStraight/1000).toFixed(2)+" km":Math.round(totalStraight)+" m";
  target.innerHTML='<p><strong>Eventos:</strong> '+events.length+' · <strong>Pontos GPS:</strong> '+points.length+' · <strong>Distância estimada em linha reta:</strong> '+total+'</p><div class="table-wrap"><table><thead><tr><th>Horário</th><th>Evento</th><th>Detalhes</th><th>Mapa</th><th>Intervalo GPS</th><th>Distância GPS</th><th>Velocidade</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div><p class="hint">Os intervalos e distâncias GPS são calculados entre leituras disponíveis; distância em linha reta não é quilometragem rodoviária. O navegador pode suspender a localização quando o PWA fica em segundo plano ou sem conexão.</p>';
 }catch(error){console.error(error);target.innerHTML='<p class="hint">Não foi possível carregar a linha do tempo: '+esc(error.message)+'</p>'}
}
$("loadTimeline")?.addEventListener("click",loadJourneyTimeline);
async function refresh(){
 if(loading)return;
 loading=true;
 try{
  // Carrega e exibe os cadastros mestres antes das operações. Assim, uma migração
  // ausente em journeys/deliveries não apaga as opções de veículos, entregadores e bairros.
  const masterResults = await Promise.allSettled([
   backend.listDrivers(), backend.listVehicles(), backend.listNeighborhoods()
  ]);
  const masterNames = ["entregadores (drivers)", "veículos (vehicles)", "bairros (neighborhoods)"];
  const masterErrors = [];
  drivers = masterResults[0].status === "fulfilled" ? masterResults[0].value : [];
  vehicles = masterResults[1].status === "fulfilled" ? masterResults[1].value : [];
  neighborhoods = masterResults[2].status === "fulfilled" ? masterResults[2].value : [];
  masterResults.forEach((result, index) => {
   if (result.status === "rejected") {
    const detail = result.reason?.message || String(result.reason || "erro desconhecido");
    masterErrors.push(masterNames[index] + ": " + detail);
    console.error("YUP-ENTREGAS: falha ao carregar " + masterNames[index], result.reason);
   }
  });
  const driverSelect=ensureSelect("driverId","Selecione o entregador");
  const vehicleSelect=ensureSelect("vehicle","Selecione o veículo");
  fillSelect(driverSelect,drivers,"id",d=>d.registration_no+" — "+d.full_name,drivers.length?"Selecione o entregador":"Nenhum entregador ativo vinculado");
  if(vehicleSelect){
   vehicleSelect.replaceChildren();
   const vehiclePlaceholder=document.createElement("option");
   vehiclePlaceholder.value="";
   vehiclePlaceholder.textContent=vehicles.length?"Selecione o veículo":"Nenhum veículo ativo encontrado no banco de dados";
   vehicleSelect.append(vehiclePlaceholder);
   vehicles.forEach(v=>{
    const option=document.createElement("option");
    option.value=v.id;
    option.textContent=v.code+(v.plate?" — "+v.plate:"")+(v.make_model?" · "+v.make_model:"")+(!v.active?" (INATIVO)":"");
    option.disabled=!v.active;
    vehicleSelect.append(option);
   });
   vehicleSelect.disabled=vehicles.length===0;
  }
  if(!admin){
   const d=currentDriver();
   if(d){driverSelect.value=d.id;driverSelect.disabled=true;driverSelect.title="Preenchido automaticamente pelo usuário conectado";}
   else{driverSelect.disabled=true;driverSelect.title="Nenhum cadastro ativo vinculado a esta conta";}
  }else{
   driverSelect.disabled=false;
   if(!driverSelect.value&&drivers.length)driverSelect.value=drivers[0].id;
   driverSelect.onchange=()=>{currentJourney=openJourney();render();};
  }
  fillSelect($("neighborhood"),neighborhoods,"id",n=>n.name,neighborhoods.length?"Selecione o bairro":"Nenhum bairro ativo encontrado no banco de dados");
  const catalogNeighborhood=$("deliveryCatalogForm")?.elements.neighborhood;
  if(catalogNeighborhood){const selected=catalogNeighborhood.value;fillSelect(catalogNeighborhood,neighborhoods,"id",n=>n.name,neighborhoods.length?"Selecione o bairro":"Nenhum bairro ativo encontrado");catalogNeighborhood.value=selected;}

  fillSelect($("routePlanDriver"),drivers,"id",d=>d.registration_no+" — "+d.full_name,drivers.length?"Selecione o entregador":"Nenhum entregador ativo vinculado");
  $("routePlanStopsEditor")?.querySelectorAll('.route-stop-editor select[name="neighborhood"]').forEach(select=>{
   const selected=select.value;select.innerHTML='<option value="">Selecione o bairro</option>'+neighborhoods.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join("");select.value=selected;
  });
  if($("prototypeWarning")) $("prototypeWarning").textContent = masterErrors.length
   ? "Alguns cadastros não foram carregados: " + masterErrors.join(" | ") + ". Verifique se as tabelas/colunas existem e se as políticas RLS permitem SELECT para este usuário."
   : "Cadastros carregados do Supabase. Jornadas e entregas são sincronizadas; combustível e manutenção ainda são locais neste navegador.";
  $("prototypeWarning").classList.remove("hidden");

  try{
   const result=await backend.listOperations();
   journeys=result.journeys;
   deliveries=result.deliveries;
   currentJourney=openJourney();
   try{routePlans=await backend.listRoutePlans();routePlansError="";}catch(routeError){routePlans=[];routePlansError=routeError?.message||"erro desconhecido";console.error("YUP-ENTREGAS: falha ao carregar rotas prontas",routeError);}
   shareEntryLocationOnce();
   if(localStorage.getItem(entryLocationKey)==="done"&&currentJourney)startGpsTracking(currentJourney);
   else if(!currentJourney&&gpsWatchId!==null)stopGpsTracking();
  }catch(operationsError){
   console.error("YUP-ENTREGAS: falha ao carregar jornadas/entregas",operationsError);
   $("prototypeWarning").textContent="Cadastros de veículos, entregadores e bairros carregados. Falha ao carregar jornadas/entregas: "+(operationsError?.message||"erro desconhecido")+". Verifique as migrações SQL e as permissões RLS.";
   $("prototypeWarning")?.classList.remove("hidden");
  }
  render();
 }catch(error){
  console.error("YUP-ENTREGAS: falha ao carregar cadastros do Supabase",error);
  const vehicleSelect=$("vehicle");
  if(vehicleSelect){vehicleSelect.replaceChildren();const option=document.createElement("option");option.value="";option.textContent="Falha ao carregar veículos — verifique conexão/permissões";vehicleSelect.append(option);vehicleSelect.disabled=true;}
  if($("prototypeWarning")){ $("prototypeWarning").textContent="Falha ao carregar os cadastros do Supabase: "+(error?.message||"erro desconhecido")+". Verifique a URL/chave pública, autenticação, tabelas e políticas RLS."; $("prototypeWarning").classList.remove("hidden"); }
 }finally{loading=false}
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
 if(!currentJourney)return;
 const journeyDeliveries=deliveries.filter(d=>d.journey_id===currentJourney.id);
 if(!journeyDeliveries.length)return notify("Não é possível encerrar a jornada sem pelo menos uma entrega cadastrada. Adicione uma entrega e tente novamente.");
 const raw=prompt("Informe o odômetro final (km):");if(raw===null)return;
 const end=Number(raw);if(!Number.isFinite(end)||end<Number(currentJourney.odometer_start))return notify("Odômetro inválido: deve ser igual ou superior ao inicial.");
 const pending=deliveries.filter(d=>d.journey_id===currentJourney.id&&!["completed","failed"].includes(d.status));
 if(pending.length)return notify("Finalize ou marque como não realizada cada entrega antes de encerrar a jornada.");
 try{const finishedId=currentJourney.id;await backend.finishJourney({journeyId:finishedId,odometerEnd:end});stopGpsTracking();await refresh();notify("Jornada finalizada e salva no banco de dados.");}
 catch(error){console.error(error);notify("Não foi possível finalizar a jornada: "+error.message)}
});
$("deliveryCatalogForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,message=$("deliveryCatalogMessage"),button=form.querySelector('button[type="submit"]');
 const values=new FormData(form),address=String(values.get("address")||"").trim();
 if(!address){message.textContent="Informe o endereço completo.";return;}
 button.disabled=true;message.textContent="Cadastrando pedido…";
 try{
  const created=await backend.createDelivery({journeyId:null,neighborhoodId:values.get("neighborhood")||null,address,reference:values.get("reference"),mapLink:values.get("mapLink"),priority:values.get("priority")||"normal"});
  await refresh();form.reset();message.textContent="Entrega "+(created.order_no||"") +" cadastrada e disponível para o entregador.";
 }catch(error){console.error(error);message.textContent="Não foi possível cadastrar a entrega. "+(error?.message||"Verifique a migração do Supabase.");}
 finally{button.disabled=false;}
});
$("refreshDeliveryCatalog")?.addEventListener("click",refresh);
$("deliveryForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentJourney)return notify("Inicie uma jornada antes de adicionar entregas.");
 const address=$("address").value.trim();
 if(!address)return notify("Informe o endereço da entrega.");
 const related=deliveries.filter(d=>d.journey_id===currentJourney.id);
 setBusy(e.target,true);
 try{
  const created=await backend.createDelivery({journeyId:currentJourney.id,neighborhoodId:$("neighborhood").value||null,address,reference:$("reference").value.trim(),priority:priorityMap[$("priority").value]||"normal",mapLink:$("mapLink").value.trim(),sequenceNo:related.length+1});
  e.target.reset();await refresh();notify("Entrega "+(created.order_no||"") +" cadastrada com número automático.");
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
 // Sem origem fixa, o Google Maps pode usar a posição atual como ponto de partida.
 const maxWaypoints=3;
 const batchSize=maxWaypoints+1;
 const batch=stops.slice(0,batchSize);
 const destinations=batch.map(deliveryDestination);
 const destination=destinations[destinations.length-1];
 const waypoints=destinations.slice(0,-1);
 const params=new URLSearchParams({api:"1",destination,travelmode:"driving"});
 if(waypoints.length)params.set("waypoints",waypoints.join("|"));
 window.open("https://www.google.com/maps/dir/?"+params.toString(),"_blank","noopener,noreferrer");
 if(stops.length>batch.length){
  notify("Este trecho inclui as entregas "+(startIndex+1)+" a "+(startIndex+batch.length)+". Para continuar, abra novamente a rota e selecione a próxima entrega.");
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
  return notify("A reordenação segura da rota será ativada na próxima etapa.");
 }
 const statuses={start:"in_transit",arrive:"at_destination",complete:"completed",failed:"failed"};const status=statuses[action];if(!status)return;
 if(action==="complete"&&!confirm("Confirmar conclusão desta entrega?"))return;
 if(action==="failed"&&!confirm("Marcar esta entrega como não realizada?"))return;
 const previousStatus=d.status;
 const buttons=[...document.querySelectorAll('[data-act][data-id]')].filter(b=>b.dataset.id===id&&b.dataset.act===action);
 buttons.forEach(b=>{b.disabled=true;b.dataset.originalLabel=b.textContent;b.textContent="Atualizando…";b.setAttribute("aria-busy","true")});
 // Atualização otimista: a interface responde imediatamente enquanto o banco confirma a alteração.
 d.status=status;
 renderDeliveries();
 notify("Atualizando entrega…");
 try{
  await backend.updateDeliveryStatus({deliveryId:id,status});
  await refresh();
  notify("Entrega atualizada.");
 }catch(error){
  console.error(error);
  d.status=previousStatus;
  renderDeliveries();
  notify("Não foi possível atualizar a entrega. Confira a conexão e tente novamente.");
 }finally{
  buttons.forEach(b=>{b.disabled=false;b.removeAttribute("aria-busy");delete b.dataset.originalLabel});
 }
}
function renderDeliveries(){
 const list=$("deliveryList");
 const ds=currentJourney?deliveries.filter(d=>d.journey_id===currentJourney.id).sort((a,b)=>a.sequence_no-b.sequence_no):[];
 const pending=ds.filter(d=>!["completed","failed"].includes(d.status));
 const completed=ds.filter(d=>["completed","failed"].includes(d.status));
 const next=pending[0]||null;
 $("metricStops").textContent=ds.length;
 $("metricDone").textContent=ds.filter(d=>d.status==="completed").length;
 $("metricKm").textContent=currentJourney?"Em andamento":"—";
 $("journeyBadge").textContent=currentJourney?"Jornada em andamento":"Jornada não iniciada";
 $("startJourney").classList.toggle("hidden",!!currentJourney);
 $("finishJourney").classList.toggle("hidden",!currentJourney);
 ["driverId","vehicle","odoStart"].forEach(id=>$(id).disabled=!!currentJourney||(!admin&&id==="driverId"));
 if(!ds.length){
  list.className="delivery-list empty";
  list.innerHTML='<p>Nenhuma entrega cadastrada nesta jornada.</p>';
  return;
 }
 list.className="delivery-list";
 const nextCard=next?'<section class="next-stop-card" aria-label="Próxima entrega"><div class="next-stop-kicker">PRÓXIMA PARADA</div><div class="next-stop-heading"><span class="next-stop-number">'+esc(next.order_no||("Parada "+(ds.indexOf(next)+1)))+'</span><span class="tag '+(next.status==="completed"?"done":"")+'">'+esc(statusLabel[next.status]||next.status)+'</span></div><h3>'+esc(next.neighborhoods?.name||"Bairro não informado")+'</h3><p class="next-stop-address">'+esc(next.address)+(next.reference?" · "+esc(next.reference):"")+'</p><div class="next-stop-actions"><button class="button primary next-navigate" type="button" data-act="navigate" data-id="'+next.id+'">↗ Navegar até aqui</button>'+(next.status==="pending"?'<button class="button secondary" type="button" data-act="start" data-id="'+next.id+'">Iniciar entrega</button>':"")+(next.status==="in_transit"?'<button class="button secondary" type="button" data-act="arrive" data-id="'+next.id+'">Cheguei ao endereço</button>':"")+(["in_transit","at_destination"].includes(next.status)?'<button class="button primary" type="button" data-act="complete" data-id="'+next.id+'">✓ Concluir entrega</button>':"")+'<p class="next-stop-progress">'+ds.filter(d=>d.status==="completed").length+' de '+ds.length+' entregas concluídas</p></div></section>':'<section class="next-stop-card route-finished"><div class="next-stop-kicker">ROTA CONCLUÍDA</div><h3>Você chegou ao fim da rota!</h3><p>Todas as entregas foram concluídas ou marcadas como não realizadas.</p></section>';
 list.innerHTML=nextCard+pending.map((d,i)=>'<div class="delivery-card '+(next&&d.id===next.id?'is-next-stop':'')+'"><div class="stop-number">'+(i+1)+'</div><div class="delivery-card-main"><h3>Ordem '+esc(d.order_no)+' · '+esc(d.neighborhoods?.name||"Bairro não informado")+'</h3><p>'+esc(d.address)+(d.reference?" · "+esc(d.reference):"")+'</p><p>Prioridade: '+esc(d.priority)+' · Criada: '+fmtDate(d.created_at)+'</p><p>Status: '+esc(statusLabel[d.status]||d.status)+'</p>'+(d.delivery_events?.length?'<details><summary>Linha do tempo ('+d.delivery_events.length+')</summary>'+d.delivery_events.map(ev=>'<p>'+esc(statusLabel[ev.event_type]||ev.event_type)+': '+fmtDate(ev.received_at_server)+(ev.note?" · "+esc(ev.note):"")+'</p>').join("")+'</details>':"")+'<div class="actions"><button class="mini" data-act="up" data-id="'+d.id+'" aria-label="Subir entrega">↑ Subir</button><button class="mini" data-act="down" data-id="'+d.id+'" aria-label="Descer entrega">↓ Descer</button><button class="mini" data-act="navigate" data-id="'+d.id+'">Navegar</button>'+(d.status==="pending"?'<button class="mini" data-act="start" data-id="'+d.id+'">Registrar saída</button>':"")+(d.status==="in_transit"?'<button class="mini" data-act="arrive" data-id="'+d.id+'">Registrar chegada</button><button class="mini" data-act="complete" data-id="'+d.id+'">Concluir</button>':"")+(d.status==="at_destination"?'<button class="mini" data-act="complete" data-id="'+d.id+'">Concluir</button>':"")+(["pending","in_transit","at_destination"].includes(d.status)?'<button class="mini" data-act="failed" data-id="'+d.id+'">Não realizada</button>':"")+'</div></div><span class="tag '+(d.status==="completed"?"done":"")+'">'+esc(statusLabel[d.status]||d.status)+'</span></div>').join("");
 if(completed.length){
  const history=document.createElement("details");
  history.className="route-history";
  const summary=document.createElement("summary");
  summary.textContent="Histórico da rota · "+completed.length+" entregas finalizadas";
  history.append(summary);
  const historyList=document.createElement("div");
  historyList.className="delivery-list";
  completed.forEach((d,i)=>{
   const item=document.createElement("article");
   item.className="delivery-card";
   const number=document.createElement("div");
   number.className="stop-number";
   number.textContent=String(ds.findIndex(x=>x.id===d.id)+1);
   const body=document.createElement("div");
   body.className="delivery-card-main";
   const title=document.createElement("h3");
   title.textContent="Ordem "+(d.order_no||"—")+" · "+(d.neighborhoods?.name||"Bairro não informado");
   const address=document.createElement("p");
   address.textContent=d.address+(d.reference?" · "+d.reference:"");
   const state=document.createElement("p");
   state.textContent="Status: "+(statusLabel[d.status]||d.status)+" · "+fmtDate(d.updated_at||d.created_at);
   body.append(title,address,state);
   const tag=document.createElement("span");
   tag.className="tag "+(d.status==="completed"?"done":"");
   tag.textContent=statusLabel[d.status]||d.status;
   item.append(number,body,tag);
   historyList.append(item);
  });
  history.append(historyList);
  list.append(history);
 }
 list.querySelectorAll("button[data-act]").forEach(b=>b.addEventListener("click",()=>deliveryAction(b.dataset.id,b.dataset.act)));
}
$("openRoute").addEventListener("click",()=>{
 const ds=deliveries.filter(d=>currentJourney?d.journey_id===currentJourney.id:d.journey_id&&journeys.some(j=>j.id===d.journey_id&&j.status!=="cancelled"))
  .filter(d=>!["completed","failed"].includes(d.status))
  .sort((a,b)=>a.sequence_no-b.sequence_no);
 if(!ds.length)return notify("Não há entregas pendentes cadastradas para montar a rota.");
 let startIndex=0;
 const maxStopsPerSegment=4;
 if(ds.length>maxStopsPerSegment){
  const answer=prompt("Há "+ds.length+" entregas pendentes. O Google Maps no celular aceita um número limitado de paradas. Informe a primeira entrega do trecho: 1, 5, 9...", "1");
  if(answer===null)return;
  const first=Number(answer);
  if(!Number.isInteger(first)||first<1||first>ds.length||((first-1)%maxStopsPerSegment)!==0)
   return notify("Escolha a primeira entrega de um trecho: 1, 5, 9, 13...");
  startIndex=first-1;
 }
 openGoogleRoute(ds,startIndex);
});
const timelineSelect=$("timelineJourney");if(timelineSelect){const selected=timelineSelect.value;timelineSelect.replaceChildren();const first=document.createElement("option");first.value="";first.textContent="Selecione uma jornada";timelineSelect.append(first);journeys.forEach(j=>{const o=document.createElement("option");o.value=j.id;o.textContent=(j.drivers?.full_name||j.drivers?.registration_no||"Entregador")+" · "+fmtDate(j.started_at_server)+" · "+(statusLabel[j.status]||j.status);timelineSelect.append(o)});if(journeys.some(j=>j.id===selected))timelineSelect.value=selected;}
function confirmDeletePendingDelivery(delivery){
 return new Promise(resolve=>{
  const overlay=document.createElement("div");
  overlay.className="delivery-delete-backdrop";
  overlay.innerHTML='<section class="delivery-delete-modal" role="dialog" aria-modal="true" aria-labelledby="deliveryDeleteTitle" aria-describedby="deliveryDeleteDescription"><div class="delivery-delete-eyebrow">CONFIRMAR EXCLUSÃO</div><h2 id="deliveryDeleteTitle">Excluir entrega?</h2><p id="deliveryDeleteDescription">Você está prestes a excluir a entrega <strong></strong>. Esta ação não pode ser desfeita.</p><div class="delivery-delete-actions"><button type="button" class="button secondary" data-delete-cancel>Cancelar</button><button type="button" class="button danger" data-delete-confirm>Excluir entrega</button></div></section>';
  overlay.querySelector("strong").textContent=delivery.order_no||"selecionada";
  document.body.append(overlay);
  const cancel=overlay.querySelector("[data-delete-cancel]"), confirm=overlay.querySelector("[data-delete-confirm]");
  let finished=false;
  const close=value=>{if(finished)return;finished=true;document.removeEventListener("keydown",onKeyDown);overlay.remove();resolve(value);};
  const onKeyDown=event=>{if(event.key==="Escape"){event.preventDefault();close(false);}if(event.key==="Tab"){if(event.shiftKey&&document.activeElement===cancel){event.preventDefault();confirm.focus();}else if(!event.shiftKey&&document.activeElement===confirm){event.preventDefault();cancel.focus();}}};
  cancel.addEventListener("click",()=>close(false));
  confirm.addEventListener("click",()=>close(true));
  overlay.addEventListener("click",event=>{if(event.target===overlay)close(false);});
  document.addEventListener("keydown",onKeyDown);
  cancel.focus();
 });
}
function renderDeliveryCatalog(){
 const target=$("deliveryCatalogList");if(!target)return;
 const pending=deliveries.filter(d=>!d.journey_id&&d.status==="pending").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 if(!pending.length){target.innerHTML='<p class="hint">Nenhuma entrega pendente no momento.</p>';return;}
 target.innerHTML='<div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Endereço</th><th>Prioridade</th><th>Cadastrada por</th><th>Ação</th></tr></thead><tbody>'+pending.map(d=>'<tr><td><strong>'+esc(d.order_no||"PEDIDO")+'</strong></td><td>'+esc(d.address)+'<small style="display:block">'+esc(d.neighborhoods?.name||"BAIRRO NÃO INFORMADO")+(d.reference?' · '+esc(d.reference):"")+'</small></td><td>'+esc(({normal:"Normal",high:"Alta",scheduled:"Agendada"})[d.priority]||d.priority)+'</td><td>'+esc(d.created_source==="management"?"Administração/Vendas":"Entregador")+'</td><td><button type="button" class="button danger" data-delete-pending-delivery="'+esc(d.id)+'">Excluir</button></td></tr>').join("")+'</tbody></table></div>';
 target.onclick=async event=>{const button=event.target.closest("[data-delete-pending-delivery]");if(!button)return;const id=button.dataset.deletePendingDelivery;const delivery=pending.find(item=>item.id===id);if(!delivery)return;if(!await confirmDeletePendingDelivery(delivery))return;button.disabled=true;button.textContent="Excluindo…";try{await backend.deletePendingDelivery({deliveryId:id});deliveries=deliveries.filter(item=>item.id!==id);renderDeliveryCatalog();const msg=$("deliveryCatalogMessage");if(msg)msg.textContent="Entrega excluída com sucesso.";notify("Entrega excluída.");}catch(error){console.error(error);button.disabled=false;button.textContent="Excluir";const msg=$("deliveryCatalogMessage");if(msg)msg.textContent="Não foi possível excluir: "+(error?.message||"verifique as permissões no Supabase.");notify("Não foi possível excluir a entrega.");}};
}
function renderRoutePlans(){
 const target=$("routePlansList");if(!target)return;
 if(routePlansError){target.innerHTML='<p class="warning">Não foi possível carregar rotas prontas: '+esc(routePlansError)+'. Confira se a migração supabase/route-plans-migration.sql foi aplicada no Supabase.</p>';return;}
 if(!routePlans.length){target.innerHTML='<p class="hint">Nenhuma rota pronta cadastrada. Monte uma rota acima para atribuí-la a um entregador.</p>';return;}
 target.innerHTML=routePlans.map(plan=>{
  const journey=journeys.find(j=>j.route_plan_id===plan.id);
  const status=journey?(journey.status==="open"?"Em andamento":journey.status==="finished"?"Concluída":"Jornada cancelada"):"Aguardando início";
  const driverName=plan.drivers?.full_name||drivers.find(d=>d.id===plan.assigned_driver_id)?.full_name||"Entregador";
  const stops=(plan.route_plan_stops||[]).slice().sort((a,b)=>a.sequence_no-b.sequence_no);
  return '<article class="route-plan-card"><div class="route-plan-card-head"><div><span class="route-plan-eyebrow">'+stops.length+' parada(s)</span><h3>'+esc(plan.title)+'</h3><p>'+esc(driverName)+'</p></div><span class="route-plan-status '+(journey?.status==="open"?"is-active":journey?.status==="finished"?"is-done":"")+'">'+status+'</span></div><ol>'+stops.map(stop=>'<li><span>'+stop.sequence_no+'</span><div><strong>'+esc(stop.address)+'</strong><small>'+esc(stop.neighborhoods?.name||"Bairro não informado")+(stop.reference?" · "+esc(stop.reference):"")+'</small></div></li>').join("")+'</ol><p class="route-plan-date">Criada em '+fmtDate(plan.created_at)+'</p></article>';
 }).join("");
}
function uppercaseRouteTextInputs(root=$("routePlanForm")){
 if(!root)return;
 root.querySelectorAll('input:not([type="url"]):not([type="number"]):not([type="email"]):not([type="password"])').forEach(input=>{
  input.addEventListener("input",()=>{const start=input.selectionStart,end=input.selectionEnd;const upper=input.value.toLocaleUpperCase("pt-BR");if(input.value!==upper){input.value=upper;try{input.setSelectionRange(start,end)}catch(_){}}});
  if(input.value)input.value=input.value.toLocaleUpperCase("pt-BR");
 });
}
function refreshRoutePlanStopControls(){
 const target=$("routePlanStopsEditor");if(!target)return;
 const cards=[...target.querySelectorAll(".route-stop-editor")];
 cards.forEach((card,index)=>{
  card.querySelector(".route-stop-editor-head strong").textContent="Parada "+(index+1);
  const up=card.querySelector('[data-stop-move="up"]'),down=card.querySelector('[data-stop-move="down"]');
  if(up)up.disabled=index===0;
  if(down)down.disabled=index===cards.length-1;
 });
 const count=$("routePlanStopCount");
 if(count)count.textContent=cards.length+" "+(cards.length===1?"parada":"paradas");
 const preview=$("previewRoutePlan");
 if(preview)preview.disabled=!cards.some(card=>card.querySelector('[name="address"]').value.trim());
}
function appendRoutePlanStop(){
 const target=$("routePlanStopsEditor");if(!target)return;
 const n=target.querySelectorAll(".route-stop-editor").length+1;
 const card=document.createElement("section");card.className="route-stop-editor";
 card.innerHTML='<div class="route-stop-editor-head"><div class="route-stop-editor-title"><span class="route-stop-number">'+n+'</span><strong>Parada '+n+'</strong></div><div class="route-stop-editor-tools"><button type="button" class="route-stop-move" data-stop-move="up" aria-label="Mover parada para cima" title="Mover para cima">↑</button><button type="button" class="route-stop-move" data-stop-move="down" aria-label="Mover parada para baixo" title="Mover para baixo">↓</button><button type="button" class="route-stop-remove" aria-label="Remover parada">Remover</button></div></div><div class="form-grid"><label>Bairro<select name="neighborhood"><option value="">Selecione o bairro</option>'+neighborhoods.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join("")+'</select></label><label>Prioridade<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="scheduled">Agendada</option></select></label></div><label>Endereço completo<input name="address" required maxlength="400" placeholder="Rua, número, complemento"></label><div class="form-grid"><label>Ponto de referência<input name="reference" maxlength="250" placeholder="Opcional"></label><label>Link de localização<input name="mapLink" type="url" placeholder="Link do Google Maps (opcional)"></label></div>';
 card.querySelector(".route-stop-remove").addEventListener("click",()=>{card.remove();refreshRoutePlanStopControls();});
 card.querySelector('[data-stop-move="up"]').addEventListener("click",()=>{const previous=card.previousElementSibling;if(previous)target.insertBefore(card,previous);refreshRoutePlanStopControls();});
 card.querySelector('[data-stop-move="down"]').addEventListener("click",()=>{const next=card.nextElementSibling;if(next)target.insertBefore(next,card);refreshRoutePlanStopControls();});
 card.querySelectorAll('input:not([type="url"])').forEach(input=>input.addEventListener("input",()=>{
  const start=input.selectionStart,end=input.selectionEnd,upper=input.value.toLocaleUpperCase("pt-BR");
  if(input.value!==upper){input.value=upper;try{input.setSelectionRange(start,end)}catch(_){}}
 }));
 card.addEventListener("input",refreshRoutePlanStopControls);
 card.addEventListener("change",refreshRoutePlanStopControls);
 target.append(card);
 refreshRoutePlanStopControls();
}
function previewRoutePlan(){
 const cards=[...$("routePlanStopsEditor").querySelectorAll(".route-stop-editor")];
 const addressFor=card=>{
  const address=card.querySelector('[name="address"]').value.trim();
  const neighborhood=card.querySelector('[name="neighborhood"]');
  const neighborhoodName=neighborhood.selectedOptions[0]?.textContent||"";
  return [address,neighborhood.value?neighborhoodName:"", "Santarém, Pará, Brasil"].filter(Boolean).join(", ");
 };
 const stops=cards.map(addressFor).filter((address,index)=>cards[index].querySelector('[name="address"]').value.trim());
 if(!stops.length){$("routePlanMessage").textContent="Adicione pelo menos um endereço antes de visualizar a rota.";return;}
 const origin=stops[0],destination=stops[stops.length-1],waypoints=stops.slice(1,-1);
 const params=new URLSearchParams({api:"1",origin,destination,travelmode:"driving"});
 if(waypoints.length)params.set("waypoints",waypoints.join("|"));
 window.open("https://www.google.com/maps/dir/?"+params.toString(),"_blank","noopener,noreferrer");
}
function render(){
 renderRoutePlans();renderDeliveryCatalog();
 renderDeliveries();
 renderDriverExperience();
 $("fleetJourneys").textContent=journeys.length;$("fleetDeliveries").textContent=deliveries.length;
 $("fleetKm").textContent=journeys.filter(j=>j.odometer_end!=null).reduce((sum,j)=>sum+Number(j.odometer_end)-Number(j.odometer_start),0).toLocaleString("pt-BR",{maximumFractionDigits:1});
 renderFleetHistory();
 $("fuelTotalLiters").textContent=local.fuel.reduce((s,x)=>s+x.liters,0).toLocaleString("pt-BR",{maximumFractionDigits:2})+" L";const costs=local.fuel.reduce((s,x)=>s+x.cost,0),liters=local.fuel.reduce((s,x)=>s+x.liters,0);$("fuelTotalCost").textContent=money(costs);$("fuelAverage").textContent=liters?money(costs/liters)+"/L":"—";
 $("fuelHistory").innerHTML=table(local.fuel,[["date","Data"],["vehicle","Veículo"],["odo","Odômetro"],["liters","Litros"],["cost","Valor"]],x=>({...x,date:fmtDate(x.date),cost:money(x.cost)}));
 $("maintenanceHistory").innerHTML=table(local.maintenance,[["date","Data"],["vehicle","Veículo"],["type","Serviço"],["odo","Odômetro"],["cost","Valor"],["description","Descrição"]],x=>({...x,cost:money(x.cost)}));
}
function journeyNeighborhoods(j){
 const names=deliveries.filter(d=>d.journey_id===j.id).map(d=>d.neighborhoods?.name).filter(Boolean);
 return [...new Set(names)].join(", ")||"—";
}
function journeyIncidents(j){
 const ds=deliveries.filter(d=>d.journey_id===j.id);
 const notes=[];
 if(j.notes)notes.push(String(j.notes));
 ds.forEach(d=>(d.delivery_events||[]).filter(e=>e.event_type==="incident"||e.event_type==="failed"||e.note).forEach(e=>{
  const label=d.order_no||"Entrega";
  const detail=e.note||statusLabel[e.event_type]||e.event_type;
  notes.push(label+": "+detail);
 }));
 return [...new Set(notes)].join(" | ")||"—";
}
function getFleetFilter(){
 const period=$("fleetPeriod")?.value||"all", anchor=$("fleetAnchorDate")?.value||new Date().toISOString().slice(0,10);
 const base=new Date(anchor+"T12:00:00");let from=null,to=null;
 if(period==="day"){from=new Date(base);to=new Date(base);to.setDate(to.getDate()+1)}
 if(period==="week"){from=new Date(base);const day=(from.getDay()+6)%7;from.setDate(from.getDate()-day);to=new Date(from);to.setDate(to.getDate()+7)}
 if(period==="month"){from=new Date(base.getFullYear(),base.getMonth(),1);to=new Date(base.getFullYear(),base.getMonth()+1,1)}
 if(period==="year"){from=new Date(base.getFullYear(),0,1);to=new Date(base.getFullYear()+1,0,1)}
 const driver=$("fleetDriver")?.value||"all",vehicle=$("fleetVehicle")?.value||"all",status=$("fleetStatus")?.value||"all";
 const filtered=journeys.filter(j=>{
  const d=j.started_at_server?new Date(j.started_at_server):null;
  return (!from||d&&d>=from&&d<to)&&(driver==="all"||j.driver_id===driver)&&(vehicle==="all"||j.vehicle_id===vehicle)&&(status==="all"||j.status===status);
 });
 return {filtered,period,anchor,from,to};
}
let fleetGeoHeatmapMap=null,fleetGeoHeatLayer=null,fleetGeoHeatRequest=0;
async function refreshFleetGeoHeatmap(filteredJourneys){
 const target=$("fleetGeoHeatmap"),status=$("fleetGeoHeatmapStatus");
 if(!target)return;
 const request=++fleetGeoHeatRequest;
 if(!window.L||typeof L.heatLayer!=="function"){
  target.innerHTML='<p class="hint">O mapa geográfico não carregou. Verifique a conexão e recarregue a página.</p>';
  if(status)status.textContent="Biblioteca de mapas indisponível.";
  return;
 }
 if(!fleetGeoHeatmapMap){
  fleetGeoHeatmapMap=L.map(target,{scrollWheelZoom:false}).setView([-2.443,-54.708],12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(fleetGeoHeatmapMap);
  fleetGeoHeatLayer=L.heatLayer([],{radius:25,blur:19,maxZoom:17,minOpacity:.28,gradient:{0.25:"#55bbd1",0.5:"#fcde52",0.75:"#f59b38",1:"#d83a3a"}}).addTo(fleetGeoHeatmapMap);
 }
 const ids=(filteredJourneys||[]).map(j=>j.id).filter(Boolean);
 if(!ids.length){
  fleetGeoHeatLayer.setLatLngs([]);
  if(status)status.textContent="Nenhuma jornada corresponde aos filtros atuais.";
  return;
 }
 if(status)status.textContent="Carregando posições GPS das jornadas filtradas…";
 try{
  const points=await backend.listJourneyLocationPointsForJourneys(ids);
  if(request!==fleetGeoHeatRequest)return;
  const valid=points.filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))&&Math.abs(Number(p.latitude))<=90&&Math.abs(Number(p.longitude))<=180&&(!Number.isFinite(Number(p.accuracy_m))||Number(p.accuracy_m)<=100));
  const heat=valid.map(p=>[Number(p.latitude),Number(p.longitude),1]);
  fleetGeoHeatLayer.setLatLngs(heat);
  if(heat.length){
   const bounds=L.latLngBounds(heat.map(p=>[p[0],p[1]]));
   if(bounds.isValid())fleetGeoHeatmapMap.fitBounds(bounds.pad(.15),{maxZoom:15});
   if(status)status.textContent=heat.length+" posições GPS válidas em "+ids.length+" jornada(s). A intensidade mostra concentração dos trajetos registrados.";
  }else{
   fleetGeoHeatmapMap.setView([-2.443,-54.708],12);
   if(status)status.textContent="Ainda não há posições GPS válidas para as jornadas selecionadas. O mapa será preenchido quando os entregadores registrarem suas rotas.";
  }
  setTimeout(()=>fleetGeoHeatmapMap?.invalidateSize(),80);
 }catch(error){
  if(request!==fleetGeoHeatRequest)return;
  if(status)status.textContent="Não foi possível carregar o mapa de calor: "+(error?.message||"erro desconhecido");
 }
}
function renderFleetHistory(){
 const driverSelect=$("fleetDriver"),vehicleSelect=$("fleetVehicle");
 if(driverSelect){const old=driverSelect.value;driverSelect.innerHTML='<option value="all">Todos os entregadores</option>'+drivers.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.registration_no+" — "+d.full_name)+'</option>').join("");driverSelect.value=[...driverSelect.options].some(o=>o.value===old)?old:"all"}
 if(vehicleSelect){const old=vehicleSelect.value;vehicleSelect.innerHTML='<option value="all">Todos os veículos</option>'+vehicles.map(v=>'<option value="'+esc(v.id)+'">'+esc([v.code,v.plate,v.make_model].filter(Boolean).join(" — "))+'</option>').join("");vehicleSelect.value=[...vehicleSelect.options].some(o=>o.value===old)?old:"all"}
 const {filtered,period,anchor}=getFleetFilter();
 refreshFleetGeoHeatmap(filtered);
 const rows=filtered.map(j=>{
  const ds=deliveries.filter(d=>d.journey_id===j.id),done=ds.filter(d=>d.status==="completed").length;
  const km=j.odometer_end==null?null:Number(j.odometer_end)-Number(j.odometer_start);
  return '<tr><td>'+esc(j.order_number==null?"—":"JOR-"+String(j.order_number).padStart(6,"0"))+'</td><td>'+esc(j.drivers?.registration_no||"—")+' · '+esc(j.drivers?.full_name||"—")+'</td><td>'+esc(journeyNeighborhoods(j))+'</td><td>'+esc([j.vehicles?.code,j.vehicles?.plate,j.vehicles?.make_model].filter(Boolean).join(" · ")||"—")+'</td><td>'+fmtDate(j.started_at_server)+'</td><td>'+fmtDate(j.finished_at_server)+'</td><td>'+(km==null?"—":km.toLocaleString("pt-BR",{maximumFractionDigits:1}))+'</td><td>'+esc(statusLabel[j.status]||j.status)+'</td><td>'+esc(journeyIncidents(j))+'</td><td>'+done+'/'+ds.length+'</td></tr>';
 });
 $("journeyHistory").innerHTML=filtered.length?'<table><thead><tr><th>Código</th><th>Entregador</th><th>Bairro(s)</th><th>Veículo</th><th>Início</th><th>Fim</th><th>KM rodados</th><th>Status</th><th>Ocorrências / observações</th><th>Entregas</th></tr></thead><tbody>'+rows.join("")+'</tbody></table>':'<p class="hint">Nenhuma jornada encontrada com os filtros selecionados.</p>';
 const filterCaption=period==="all"?"Todo o período":({day:"Dia",week:"Semana",month:"Mês",year:"Ano"}[period]||"Período")+" de referência: "+anchor;
 if($("fleetFilterSummary"))$("fleetFilterSummary").textContent=filtered.length+" jornada(s) · "+filterCaption;
 const filteredJourneyIds=new Set(filtered.map(j=>j.id));
 const regionalDeliveries=deliveries.filter(d=>filteredJourneyIds.has(d.journey_id));
 const regions=new Map();
 regionalDeliveries.forEach(d=>{
  const region=String(d.neighborhoods?.name||"Bairro não informado").trim()||"Bairro não informado";
  if(!regions.has(region))regions.set(region,{name:region,total:0,completed:0,failed:0,pending:0,journeys:new Set(),addresses:new Set()});
  const item=regions.get(region);item.total++;item.journeys.add(d.journey_id);
  if(d.status==="completed")item.completed++;
  else if(d.status==="failed")item.failed++;
  else item.pending++;
  if(d.address)item.addresses.add(String(d.address).trim());
 });
 const rankedRegions=[...regions.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"pt-BR"));
 const maxRegion=Math.max(1,...rankedRegions.map(r=>r.total));
 const completedCount=regionalDeliveries.filter(d=>d.status==="completed").length;
 const failedCount=regionalDeliveries.filter(d=>d.status==="failed").length;
 const heatSummary=$("fleetHeatSummary"),heatmap=$("fleetHeatmap");
 if(heatSummary)heatSummary.innerHTML='<div class="fleet-heat-kpi"><strong>'+regionalDeliveries.length+'</strong><span>Entregas no filtro</span></div><div class="fleet-heat-kpi"><strong>'+rankedRegions.length+'</strong><span>Regiões atendidas</span></div><div class="fleet-heat-kpi"><strong>'+(regionalDeliveries.length?Math.round(completedCount/regionalDeliveries.length*100):0)+'%</strong><span>Taxa concluída</span></div><div class="fleet-heat-kpi"><strong>'+failedCount+'</strong><span>Não realizadas</span></div>';
 if(heatmap){
  if(!rankedRegions.length)heatmap.innerHTML='<p class="hint">Não há entregas para analisar no período e nos filtros selecionados.</p>';
  else heatmap.innerHTML=rankedRegions.map(region=>{
   const level=Math.max(1,Math.ceil(region.total/maxRegion*5));
   const rate=region.total?Math.round(region.completed/region.total*100):0;
   const addressPreview=[...region.addresses].slice(0,2).join(" • ");
   return '<article class="fleet-heat-region heat-level-'+level+'"><div class="fleet-heat-region-head"><div><span class="fleet-heat-label">BAIRRO / REGIÃO</span><h3>'+esc(region.name)+'</h3></div><strong class="fleet-heat-count">'+region.total+' <small>'+(region.total===1?'solicitada':'solicitadas')+'</small></strong></div><div class="fleet-heat-comparison"><div class="fleet-heat-bar-row"><span>Solicitadas</span><div class="fleet-heat-bar fleet-heat-bar-requested" role="img" aria-label="'+region.total+' entregas solicitadas"><i style="width:'+Math.max(0,Math.min(100,region.total/maxRegion*100))+'%"></i></div><strong>'+region.total+'</strong></div><div class="fleet-heat-bar-row"><span>Realizadas</span><div class="fleet-heat-bar fleet-heat-bar-completed" role="img" aria-label="'+region.completed+' entregas realizadas"><i style="width:'+Math.max(0,Math.min(100,region.completed/maxRegion*100))+'%"></i></div><strong>'+region.completed+'</strong></div></div><div class="fleet-heat-metrics"><span>'+region.failed+' não realizadas</span><span>'+region.pending+' pendentes</span><span>'+region.journeys.size+' jornada(s)</span></div><div class="fleet-heat-footer"><span>'+rate+'% de conclusão</span><span>'+region.addresses.size+' endereço(s)</span></div>'+(addressPreview?'<p class="fleet-heat-addresses">'+esc(addressPreview)+(region.addresses.size>2?' · +'+(region.addresses.size-2)+' endereço(s)':'')+'</p>':'')+'</article>';
  }).join("");
 }
 const fuel=local.fuel.filter(x=>{const d=new Date(x.date);const f=getFleetFilter();return (!f.from||d>=f.from&&d<f.to)&&(($("fleetVehicle")?.value||"all")==="all"||String(x.vehicleId||x.vehicle)===(vehicles.find(v=>v.id===$("fleetVehicle").value)?.code||$("fleetVehicle").value));});
 const byVehicle={};fuel.forEach(x=>{const key=String(x.vehicleId||x.vehicle||"");(byVehicle[key]||(byVehicle[key]=[])).push(x)});
 let kmTotal=0,literTotal=0;
 Object.values(byVehicle).forEach(items=>{items.sort((a,b)=>new Date(a.date)-new Date(b.date));for(let i=1;i<items.length;i++){const delta=Number(items[i].odo)-Number(items[i-1].odo);if(delta>0&&Number(items[i].liters)>0){kmTotal+=delta;literTotal+=Number(items[i].liters)}}});
 if($("fleetConsumption"))$("fleetConsumption").textContent=literTotal>0?(kmTotal/literTotal).toLocaleString("pt-BR",{maximumFractionDigits:2})+" km/L":"—";
 if($("fleetConsumptionNote"))$("fleetConsumptionNote").textContent=literTotal>0?"Estimativa por abastecimentos locais consecutivos ("+kmTotal.toLocaleString("pt-BR",{maximumFractionDigits:1})+" km / "+literTotal.toLocaleString("pt-BR",{maximumFractionDigits:2})+" L).":"Sem dados suficientes de abastecimentos consecutivos neste período. Os abastecimentos atuais são locais neste dispositivo.";
}
function formatExportDateTime(value){
 if(!value)return "";
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return String(value);
 return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(date).replace(",", "");
}
function formatFleetExportRows(rows){
 return rows.map(row=>row.map((value,index)=>(index===8||index===9)?formatExportDateTime(value):value));
}
function fleetExportRows(){
 const {filtered}=getFleetFilter();
 const headers=["Código da jornada","Status","Código entregador","Nome entregador","Bairros","Código veículo","Placa","Modelo","Início","Fim","Odômetro inicial (km)","Odômetro final (km)","KM rodados","Ocorrências/observações","Entregas","Concluídas","Não realizadas","Pendentes"];
 const rows=filtered.map(j=>{
  const ds=deliveries.filter(d=>d.journey_id===j.id),done=ds.filter(d=>d.status==="completed").length,failed=ds.filter(d=>d.status==="failed").length;
  const km=j.odometer_end==null?"":Number(j.odometer_end)-Number(j.odometer_start);
  return ["JOR-"+String(j.order_number??"").padStart(6,"0"),statusLabel[j.status]||j.status,j.drivers?.registration_no||"",j.drivers?.full_name||"",journeyNeighborhoods(j),j.vehicles?.code||"",j.vehicles?.plate||"",j.vehicles?.make_model||"",j.started_at_server||"",j.finished_at_server||"",j.odometer_start??"",j.odometer_end??"",km,journeyIncidents(j),ds.length,done,failed,ds.length-done-failed];
 });
 return {headers,rows};
}
function downloadFleetCsv(){
 const {headers,rows}=fleetExportRows(),csv=[headers,...formatFleetExportRows(rows)].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
 downloadFleetFile("\uFEFF"+csv,"csv","text/csv;charset=utf-8;");
}
function downloadFleetXls(){
 const {headers,rows}=fleetExportRows(),exportRows=formatFleetExportRows(rows),html='<html><head><meta charset="utf-8"></head><body><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+exportRows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table></body></html>';
 downloadFleetFile(html,"xls","application/vnd.ms-excel;charset=utf-8;");
}
function downloadFleetFile(content,ext,type){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download="historico-frota-yup-"+new Date().toISOString().slice(0,10)+"."+ext;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printFleetPdf(){
 const {headers,rows}=fleetExportRows(),title="Histórico de jornadas — YUP Entregas";
 const pdfHeaders=headers.slice(),durationIndex=10;
 pdfHeaders.splice(durationIndex,0,"Duração da jornada");
 const formatDuration=(start,end)=>{
  if(!start)return "—";
  const from=new Date(start).getTime(),to=end?new Date(end).getTime():NaN;
  if(!Number.isFinite(from))return "—";
  if(!Number.isFinite(to))return "Em andamento";
  const minutes=Math.max(0,Math.floor((to-from)/60000)),hours=Math.floor(minutes/60),mins=minutes%60;
  return hours+"h "+String(mins).padStart(2,"0")+"min";
 };
 const pdfRows=formatFleetExportRows(rows.map(row=>{const copy=row.slice();copy.splice(durationIndex,0,formatDuration(row[8],row[9]));return copy}));
 const signatureDrivers=[...new Set(rows.map(row=>String(row[3]||"").trim()).filter(name=>name&&name!=="—"))];
 const signatureMarkup=signatureDrivers.map(name=>'<div class="report-signature-box"><p class="report-signature-caption">Entregador</p><div class="report-signature-name">' + esc(name) + '</div><div class="report-signature-line">Assinatura</div></div>').join("");
 const page=window.open("","_blank");
 if(!page){notify("Permita a abertura da janela para gerar o PDF.");return}
 const logo=location.origin+"/yup-brand.svg",generated=new Date().toLocaleString("pt-BR");
 page.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+title+'</title><style>*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#24352d;padding:18px;margin:0}.report-head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #fcde52;padding:0 0 14px;margin-bottom:16px}.report-logo{width:66px;height:66px;object-fit:contain;border-radius:10px}.brand-name{font-size:10px;font-weight:800;letter-spacing:2px;color:#61746a;margin:0 0 5px}.report-head h1{font-size:21px;line-height:1.15;margin:0;color:#225640}.report-meta{display:flex;justify-content:space-between;gap:12px;margin:0 0 14px;color:#58665f;font-size:10px}.report-meta strong{color:#225640}table{width:100%;border-collapse:collapse;table-layout:auto}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #d6dfd9;padding:5px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#225640;color:#fff;font-size:9px}tbody tr:nth-child(even){background:#f4f7f5}.report-foot{border-top:1px solid #d6dfd9;margin-top:14px;padding-top:8px;color:#748078;font-size:9px}.report-signatures{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:stretch;gap:12px;margin:24px 0 0;break-inside:avoid;page-break-inside:avoid;width:100%;max-width:100%}.report-signature-box{flex:0 1 220px;min-width:180px;min-height:86px;border:1px solid #9aa9a0;border-radius:3px;padding:10px;display:flex;flex-direction:column;justify-content:flex-end;break-inside:avoid;page-break-inside:avoid}.report-signature-name{font-size:10px;font-weight:700;text-align:center;color:#24352d;overflow-wrap:anywhere;margin:4px 0}.report-signature-line{border-top:1px solid #53645a;padding-top:6px;margin-top:18px;text-align:center;font-size:9px;color:#34483d;line-height:1.25}.report-signature-caption{font-size:9px;color:#748078;text-align:center;margin:0 0 2px}@media print{@page{size:landscape;margin:9mm}body{padding:0}.report-head{break-inside:avoid}.report-signatures{break-inside:avoid;page-break-inside:avoid}}</style></head><body><header class="report-head"><img class="report-logo" src="'+logo+'" alt="Logo YUP Pet Store"><div><p class="brand-name">YUP PET STORE · ENTREGAS</p><h1>'+title+'</h1></div></header><p class="report-meta"><span>Gerado em '+esc(generated)+'</span><strong>'+pdfRows.length+' jornada(s) no relatório</strong></p><table><thead><tr>'+pdfHeaders.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+pdfRows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table><footer class="report-foot">Relatório operacional YUP Entregas · Duração calculada entre o início e o encerramento de cada jornada.</footer><section class="report-signatures" aria-label="Assinaturas dos entregadores">' + signatureMarkup + '</section><script>window.onload=()=>{const logo=document.querySelector(".report-logo");if(logo)logo.onload=()=>window.print();setTimeout(()=>window.print(),500)}<\/script></body></html>');
 page.document.close();
}
["fleetPeriod","fleetAnchorDate","fleetDriver","fleetVehicle","fleetStatus"].forEach(id=>$(id)?.addEventListener("change",renderFleetHistory));
$("exportJourneyReport")?.addEventListener("click",downloadFleetCsv);
$("exportJourneyXls")?.addEventListener("click",downloadFleetXls);
$("exportJourneyPdf")?.addEventListener("click",printFleetPdf);
function table(items,cols,transform=x=>x){if(!items.length)return '<p class="hint">Nenhum registro ainda.</p>';return '<table><thead><tr>'+cols.map(c=>'<th>'+c[1]+'</th>').join("")+'</tr></thead><tbody>'+items.slice().reverse().map(raw=>{const x=transform(raw);return '<tr>'+cols.map(c=>'<td>'+esc(x[c[0]]??"—")+'</td>').join("")+'</tr>'}).join("")+'</tbody></table>'}
$("fuelDate").value=new Date().toISOString().slice(0,16);$("maintDate").value=new Date().toISOString().slice(0,10);
$("fuelForm").addEventListener("submit",e=>{e.preventDefault();local.fuel.push({id:crypto.randomUUID(),vehicle:$("fuelVehicle").value.trim(),date:$("fuelDate").value,odo:Number($("fuelOdo").value),liters:Number($("fuelLiters").value),cost:Number($("fuelCost").value),note:$("fuelNote").value.trim()});localStorage.setItem(localKey,JSON.stringify(local));e.target.reset();$("fuelDate").value=new Date().toISOString().slice(0,16);render()});
$("maintenanceForm").addEventListener("submit",e=>{e.preventDefault();local.maintenance.push({id:crypto.randomUUID(),vehicle:$("maintVehicle").value.trim(),date:$("maintDate").value,type:$("maintType").value,odo:$("maintOdo").value?Number($("maintOdo").value):null,cost:Number($("maintCost").value),description:$("maintDescription").value.trim()});localStorage.setItem(localKey,JSON.stringify(local));e.target.reset();$("maintDate").value=new Date().toISOString().slice(0,10);render()});


/* YUP Driver Flow — seis telas operacionais conectadas ao Supabase */
let driverScreen = "start";
let driverDraftPriority = "Normal";
let driverDraftNeighborhood = "";
let driverOccurrenceReason = "Destinatário ausente";
let driverOccurrenceNote = "";
let driverNewDelivery = {neighborhood:"",address:"",reference:"",priority:"Normal",mapLink:""};
function initDriverExperience(){
 if(admin)return;
 const oldView=$("view-entregador");
 if(!oldView||$("driverExperience"))return;
 oldView.classList.add("hidden");
 const root=document.createElement("section");
 root.id="driverExperience";
 root.className="driver-app";
 root.innerHTML='<div class="driver-top"><div class="brand"><img class="driver-brand-logo" src="/yup-brand.svg" alt="YUP Pet Store"><div class="brand-divider"></div><div class="brand-context"><strong>ENTREGAS</strong></div></div><button type="button" class="driver-logout" data-driver-logout aria-label="Sair da conta">Sair <span aria-hidden="true">↗</span></button></div><div id="driverScreenContent" class="driver-screen-content"></div><div id="driverBottom" class="driver-bottom"></div>';
 $("appLayout").querySelector(".content").prepend(root);
 root.addEventListener("input",event=>{const field=event.target;if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement))return;if(field instanceof HTMLInputElement&&!(["text","search","tel"].includes(field.type)))return;const start=field.selectionStart,end=field.selectionEnd;const upper=field.value.toLocaleUpperCase("pt-BR");if(field.value!==upper){field.value=upper;if(typeof start==="number"&&typeof end==="number")field.setSelectionRange(start,end)}});
 root.querySelector("[data-driver-logout]").addEventListener("click",async()=>{const button=root.querySelector("[data-driver-logout]");button.disabled=true;button.textContent="Saindo…";try{await backend?.signOut()}finally{location.reload()}});
}
function driverTime(v){return v?new Date(v).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—"}
function driverDate(){return new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}
function driverStops(){return currentJourney?deliveries.filter(d=>d.journey_id===currentJourney.id).sort((a,b)=>a.sequence_no-b.sequence_no):[]}
function driverNext(){return driverStops().find(d=>!["completed","failed"].includes(d.status))||null}
function driverScreenMarkup(){
 const ds=driverStops(),next=driverNext(),done=ds.filter(d=>d.status==="completed").length,failed=ds.filter(d=>d.status==="failed").length;
 const driver=currentDriver(),vehicle=vehicles.find(v=>v.id===currentJourney?.vehicle_id);
 const readyRoutes=routePlans.filter(plan=>plan.status==="assigned"&&!journeys.some(j=>j.route_plan_id===plan.id));
 const odoStart=currentJourney?.odometer_start;
 const heading=(kicker,title,subtitle="")=>'<p class="driver-kicker">'+kicker+'</p><h1>'+title+'</h1>'+(subtitle?'<p class="driver-subtitle">'+subtitle+'</p>':"");
 if(driverScreen==="start"||(!currentJourney&&driverScreen!=="new")){
  driverScreen="start";
  const initials=(driver?.full_name||backend?.profile?.display_name||"YUP").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  return '<section class="driver-home"><div class="driver-map-scene" aria-label="Mapa da região, a localização será exibida quando a jornada estiver ativa"><div class="driver-map-label"><span class="driver-map-pulse"></span> Pronto para iniciar</div><svg class="driver-map-art" viewBox="0 0 414 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path class="map-water" d="M-20 40 C55 10 65 90 115 75 S190 35 230 90 S310 130 434 50 L434 -10 L-20 -10Z"/><g class="map-parks"><path d="M-10 155 L65 125 112 164 91 220 20 230Z"/><path d="M275 24 L360 40 395 102 335 132 290 92Z"/><path d="M220 270 L295 236 352 274 330 345 245 354Z"/></g><g class="map-roads"><path d="M-30 320 L100 250 170 190 245 160 450 175"/><path d="M35 -20 L85 90 125 165 160 260 180 460"/><path d="M-20 115 L90 145 190 135 290 190 430 250"/><path d="M-20 390 L90 340 180 350 270 390 430 365"/><path d="M210 -20 L225 75 205 145 245 220 220 305 260 460"/><path d="M340 -20 L310 75 335 150 315 220 365 310 350 460"/><path d="M-20 205 L90 205 165 235 260 250 430 210"/></g><g class="map-road-detail"><path d="M-30 320 L100 250 170 190 245 160 450 175"/><path d="M35 -20 L85 90 125 165 160 260 180 460"/><path d="M-20 115 L90 145 190 135 290 190 430 250"/><path d="M-20 390 L90 340 180 350 270 390 430 365"/></g><g class="map-place-labels"><text x="25" y="105">CENTRO</text><text x="245" y="120">SANTARÉM</text><text x="42" y="290">ZONA DE ENTREGA</text><text x="270" y="320">YUP EXPRESS</text></g><g transform="translate(207 214)"><circle class="map-user-halo" r="30"/><circle class="map-user-dot" r="12"/><circle class="map-user-core" r="4"/></g></svg><div class="driver-map-bottom-note"><span class="driver-map-location-icon">⌖</span><span><strong>Seu mapa de trabalho</strong><small>O rastreamento começa com a jornada</small></span></div></div><section class="driver-start-sheet"><div class="driver-sheet-handle"></div><div class="driver-home-greeting"><div><span class="driver-eyebrow">YUP ENTREGAS</span><h1>Olá, '+esc((driver?.full_name||backend?.profile?.display_name||"entregador").split(/\s+/)[0])+'!</h1><p>Vamos começar sua jornada?</p></div><div class="driver-home-avatar">'+esc(initials)+'</div></div><div class="driver-home-date"><span class="driver-online-dot"></span>'+driverDate()+'</div><form id="driverStartForm" class="driver-form driver-start-form"><label>Veículo<select name="vehicle" required '+(vehicles.filter(v=>v.active).length?'':'disabled')+'><option value="">Selecione seu veículo</option>'+vehicles.filter(v=>v.active).map(v=>'<option value="'+v.id+'">'+esc([v.make_model||v.code,v.plate].filter(Boolean).join(" · "))+'</option>').join("")+'</select></label><label>Odômetro inicial <span class="driver-field-unit">(km)</span><input name="odometer" type="number" min="0" step="0.1" inputmode="decimal" required placeholder="Informe a quilometragem"/></label><div class="driver-gps-hint"><span>⌖</span><p><strong>Localização do entregador</strong><small>O GPS será usado para registrar sua rota durante a jornada.</small></p></div></form><p class="driver-home-footnote">Ao iniciar, sua jornada será registrada no sistema.</p></section></section>';
 }
 if(driverScreen==="route"){
  return '<div class="driver-status-row"><div class="driver-status-copy">'+heading("JORNADA #J-"+String(currentJourney?.order_number||"—")+" · "+new Date(currentJourney?.started_at_server||Date.now()).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}),"Sua rota, seu dia.")+'</div><span class="driver-state">Em andamento</span></div><p class="driver-vehicle-line">♧　'+esc([driver?.full_name,vehicle?.make_model||vehicle?.code,vehicle?.plate].filter(Boolean).join(" · "))+'</p><div class="driver-stats"><div><strong>'+String(ds.length).padStart(2,"0")+'</strong><span>Paradas</span></div><div><strong>'+String(done).padStart(2,"0")+'</strong><span>Concluídas</span></div><div><strong>'+Math.max(0,done+failed)+' / '+ds.length+'</strong><span>Finalizadas</span></div><div class="driver-progress"><i style="width:'+(ds.length?Math.round((done+failed)/ds.length*100):0)+'%"></i></div><small>Início às '+driverTime(currentJourney?.started_at_server)+' · Odômetro inicial '+Number(odoStart||0).toLocaleString("pt-BR")+' km</small></div>'+
   '<div class="driver-section-heading"><h2>Sequência de paradas</h2><span>'+done+' de '+ds.length+' concluída(s)</span></div>'+
   (ds.length?'<div class="driver-stop-list">'+ds.map((d,i)=>'<button type="button" class="driver-stop '+(next?.id===d.id?'is-next':'')+'" data-driver-action="detail" data-id="'+d.id+'"><span class="driver-stop-number">'+(d.status==="completed"?"✓":String(i+1).padStart(2,"0"))+'</span><span class="driver-stop-copy"><strong>'+esc(d.neighborhoods?.name||"Endereço da entrega")+'</strong><small>'+esc(d.address)+'</small><em class="driver-chip '+(d.status==="completed"?"success":d.status==="failed"?"warning":"")+'">'+esc(statusLabel[d.status]||d.status)+' · #'+esc(d.order_no||i+1)+'</em></span><span class="driver-stop-arrow">›</span></button>').join("")+'</div>':'<div class="driver-empty">Nenhuma entrega cadastrada. Adicione a primeira parada para começar.</div>');
 }
 if(driverScreen==="new"){
  return heading("JORNADA #J-"+String(currentJourney?.order_number||"—"),"Nova entrega")+
   '<div class="driver-sequence-note"><strong>'+String(ds.length+1).padStart(2,"0")+'</strong><span><b>Próxima parada da sequência</b><small>Número atribuído automaticamente.</small></span></div>'+
   '<form id="driverNewForm" class="driver-form"><button class="driver-outline" type="button" data-driver-action="location">◎　Usar minha localização atual</button><label>Bairro<select name="neighborhood" required><option value="">Selecione o bairro</option>'+neighborhoods.map(n=>'<option value="'+n.id+'">'+esc(n.name)+'</option>').join("")+'</select></label><label>Endereço completo<textarea name="address" rows="2" required placeholder="Rua, número e complemento"></textarea></label><label>Ponto de referência <small>Opcional</small><input name="reference" placeholder="Casa com portão azul"></label><fieldset class="driver-priority"><legend>Prioridade</legend>'+["Normal","Alta","Agendada"].map(p=>'<label class="'+(driverDraftPriority===p?'selected':'')+'"><input type="radio" name="priority" value="'+p+'" '+(driverDraftPriority===p?'checked':'')+'>'+p+'</label>').join("")+'</fieldset><label>Link de localização compartilhada <small>Opcional</small><input name="mapLink" type="url" placeholder="Cole o link do Maps ou WhatsApp"></label><div class="driver-info">ⓘ A localização atual exige permissão. Confira o endereço antes de adicionar a entrega.</div></form>';
 }
 if(driverScreen==="detail"){
  const d=deliveries.find(x=>x.id===window.driverSelectedDeliveryId)||next;
  if(!d){driverScreen="route";return driverScreenMarkup()}
  const idx=ds.findIndex(x=>x.id===d.id),stateEvents=d.delivery_events||[];
  return '<p class="driver-kicker">JORNADA #J-'+String(currentJourney?.order_number||"—")+' · PARADA '+String(idx+1).padStart(2,"0")+' DE '+String(ds.length).padStart(2,"0")+'</p><div class="driver-detail-heading"><h1>Entrega #'+esc(d.order_no||idx+1)+'</h1><span class="driver-state">'+(d.status==="at_destination"?"No destino":esc(statusLabel[d.status]||d.status))+'</span></div><article class="driver-address-card"><p class="driver-kicker">◎　'+esc(d.neighborhoods?.name||"Endereço")+'</p><h2>'+esc(d.address)+'</h2><p>'+esc([d.neighborhoods?.name,"Santarém – PA"].filter(Boolean).join(" · "))+'</p>'+(d.reference?'<small>⚑　'+esc(d.reference)+'</small>':"")+'</article><div class="driver-section-heading"><h2>Etapas da entrega</h2><span>'+stateEvents.length+' registro(s)</span></div><div class="driver-timeline">'+[['departure','Saída registrada','A caminho desta parada.'],['arrival','Chegada registrada','Você está no endereço da entrega.'],['completed','Entrega concluída','Entrega confirmada.']].map(([type,title,sub])=>{const ev=stateEvents.find(e=>e.event_type===type);return '<div class="driver-timeline-row"><span class="driver-timeline-icon">'+(ev?'✓':'○')+'</span><div><strong>'+title+'</strong><small>'+sub+'</small></div><time>'+(ev?driverTime(ev.received_at_server||ev.occurred_at_device):'Pendente')+'</time></div>'}).join("")+'</div>'+(d.status==="failed"?'<div class="driver-warning">⚠ Ocorrência registrada: '+esc(d.result_note||"Entrega não realizada")+'</div>':'');
 }
 if(driverScreen==="occurrence"){
  const d=deliveries.find(x=>x.id===window.driverSelectedDeliveryId)||next;
  if(!d){driverScreen="route";return driverScreenMarkup()}
  return heading("JORNADA #J-"+String(currentJourney?.order_number||"—")+" · ENTREGA #"+esc(d.order_no||""),"O que aconteceu?","Registre o motivo para manter a equipe informada sobre esta parada.")+'<article class="driver-address-card"><strong>#'+esc(d.order_no||"—")+' · '+esc(d.neighborhoods?.name||"Endereço")+'</strong><p>'+esc(d.address)+'</p><small>Chegada/etapa atual: '+esc(statusLabel[d.status]||d.status)+'</small></article><form id="driverOccurrenceForm" class="driver-form"><fieldset class="driver-reasons"><legend>Motivo</legend>'+["Destinatário ausente","Endereço não localizado","Outro motivo"].map(v=>'<label class="'+(driverOccurrenceReason===v?'selected':'')+'"><input type="radio" name="reason" value="'+v+'" '+(driverOccurrenceReason===v?'checked':'')+'><span>'+v+'</span></label>').join("")+'</fieldset><label>O que você tentou? <small>Opcional</small><textarea name="note" rows="4" placeholder="Descreva brevemente o que aconteceu.">'+esc(driverOccurrenceNote)+'</textarea></label><p class="driver-helper">Inclua apenas informações necessárias sobre a entrega. Evite dados pessoais de terceiros.</p><div class="driver-warning">⚠ Esta parada ficará como “Com ocorrência”, não como concluída. O registro ficará no resumo da jornada.</div></form>';
 }
 if(driverScreen==="summary"){
  const allDone=ds.every(d=>["completed","failed"].includes(d.status));
  const distance=currentJourney&&currentJourney.odometer_end!=null?Number(currentJourney.odometer_end)-Number(odoStart):null;
  return heading("JORNADA #J-"+String(currentJourney?.order_number||"—")+" · "+new Date(currentJourney?.started_at_server||Date.now()).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}),"Resumo da jornada","Confira os registros antes de encerrar.")+'<p class="driver-vehicle-line">♧　'+esc([driver?.full_name,vehicle?.make_model||vehicle?.code,vehicle?.plate].filter(Boolean).join(" · "))+'</p><div class="driver-stats driver-summary-stats"><div><strong>'+String(ds.length).padStart(2,"0")+'</strong><span>Paradas</span></div><div><strong>'+String(done).padStart(2,"0")+'</strong><span>Concluídas</span></div><div><strong>'+String(failed).padStart(2,"0")+'</strong><span>Ocorrências</span></div><small>Início '+driverTime(currentJourney?.started_at_server)+' · '+(currentJourney?.started_at_server?Math.max(0,Math.round((Date.now()-new Date(currentJourney.started_at_server))/60000))+" min de jornada":"")+'</small></div><form id="driverFinishForm" class="driver-form"><label>Odômetro final (km)<input name="odometer" type="number" min="'+Number(odoStart||0)+'" step="0.1" required placeholder="Odômetro atual"></label><p class="driver-helper">Inicial: '+Number(odoStart||0).toLocaleString("pt-BR")+' km'+(distance!==null?' · Percurso registrado: '+distance.toLocaleString("pt-BR")+' km':'')+'</p><h2 class="driver-section-title">Resultado das entregas</h2><div class="driver-results">'+ds.map((d,i)=>'<div class="driver-result"><span class="'+(d.status==="failed"?"failed":"")+'">'+(d.status==="completed"?"✓":d.status==="failed"?"⚠":"○")+'</span><div><strong>#'+esc(d.order_no||i+1)+' · '+esc(d.neighborhoods?.name||"Endereço")+'</strong><small>'+esc(d.address)+'</small>'+(d.status==="failed"?'<em>'+esc(d.result_note||"Ocorrência registrada")+'</em>':"")+'</div><aside>'+esc(statusLabel[d.status]||d.status)+'<small>'+driverTime(d.updated_at||d.created_at)+'</small></aside></div>').join("")+'</div>'+(!allDone?'<div class="driver-warning">⚠ Ainda há '+ds.filter(d=>!["completed","failed"].includes(d.status)).length+' entrega(s) sem resultado. Registre conclusão ou ocorrência antes de encerrar.</div>':'')+'</form>';
 }
 return "";
}
function renderDriverExperience(){
 if(admin)return;
 if(currentJourney&&driverScreen==="start")driverScreen="route";
 initDriverExperience();
 const root=$("driverExperience");if(!root)return;
 const content=$("driverScreenContent"),bottom=$("driverBottom");
 content.innerHTML=driverScreenMarkup();
 root.classList.toggle("driver-home-mode",driverScreen==="start");
 root.classList.toggle("has-fixed-driver-dock",true);
 ["start","route","new","detail","occurrence","summary"].forEach(screen=>root.classList.toggle("driver-screen-"+screen,driverScreen===screen));
 const stops=driverStops(),nextStop=driverNext(),selected=deliveries.find(x=>x.id===window.driverSelectedDeliveryId)||nextStop;
 const actionButton=(label,icon,attrs,extra="")=>'<button type="button" class="driver-dock-action '+extra+'" '+attrs+'><span class="driver-dock-icon">'+icon+'</span><span>'+label+'</span></button>';
 if(driverScreen==="start"||!currentJourney){
  bottom.innerHTML='<button class="driver-dock-primary" type="submit" form="driverStartForm"><span>▶</span><span>Iniciar jornada</span></button>';
 }else if(driverScreen==="new"){
  bottom.innerHTML=actionButton("Voltar","‹",'data-driver-screen="route"')+actionButton("Adicionar à sequência","＋",'data-driver-submit="driverNewForm"',"is-primary");
 }else if(driverScreen==="occurrence"){
  bottom.innerHTML=actionButton("Voltar","‹",'data-driver-screen="detail"')+actionButton("Registrar ocorrência","⚑",'data-driver-submit="driverOccurrenceForm"',"is-danger");
 }else if(driverScreen==="summary"){
  bottom.innerHTML=actionButton("Voltar à rota","‹",'data-driver-screen="route"')+actionButton("Confirmar encerramento","✓",'data-driver-submit="driverFinishForm"',"is-primary");
 }else if(driverScreen==="detail"){
  const finishAction=selected&&selected.status==="pending"?"startDelivery":selected&&selected.status==="in_transit"?"arriveDelivery":selected&&selected.status==="at_destination"?"completeDelivery":"";
  const finishLabel=finishAction==="startDelivery"?"Registrar saída":finishAction==="arriveDelivery"?"Registrar chegada":"Concluir entrega";
  bottom.innerHTML=actionButton("Adicionar entrega","＋",'data-driver-screen="new"')+actionButton("Ver mapa","↗",'data-driver-action="maps"')+(finishAction?actionButton(finishLabel,"✓",'data-driver-action="'+finishAction+'" data-id="'+selected.id+'"',"is-primary"):"")+((selected&&!["completed","failed"].includes(selected.status))?actionButton("Ocorrência","⚑",'data-driver-action="occurrence" data-id="'+selected.id+'"',"is-danger"):"")+actionButton("Encerrar jornada","■",'data-driver-screen="summary"');
 }else{
  bottom.innerHTML=actionButton("Adicionar entrega","＋",'data-driver-screen="new"')+actionButton("Ver mapa","↗",'data-driver-action="maps"',"is-primary")+(nextStop?actionButton("Concluir entrega","✓",'data-driver-action="detail" data-id="'+nextStop.id+'"'):"")+(nextStop?actionButton("Registrar ocorrência","⚑",'data-driver-action="occurrence" data-id="'+nextStop.id+'"',"is-danger"):"")+actionButton("Confirmar encerramento","■",'data-driver-screen="summary"');
 }
 bottom.querySelectorAll("[data-driver-submit]").forEach(b=>b.addEventListener("click",()=>{const form=$(b.dataset.driverSubmit);if(form){if(typeof form.requestSubmit==="function")form.requestSubmit();else form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))}}));
 root.querySelectorAll("[data-driver-screen]").forEach(b=>b.addEventListener("click",()=>{driverScreen=b.dataset.driverScreen;renderDriverExperience()}));
 root.querySelectorAll("[data-driver-action]").forEach(b=>b.addEventListener("click",async()=>{
  const action=b.dataset.driverAction,id=b.dataset.id;
  if(action==="assignPending"){
   try{await backend.assignDeliveriesToJourney({journeyId:currentJourney.id,deliveryIds:[id]});await refresh();driverScreen="route";renderDriverExperience();}
   catch(error){notify("Não foi possível adicionar o pedido: "+error.message)}
  }
  if(action==="detail"){window.driverSelectedDeliveryId=id;driverScreen="detail";renderDriverExperience()}
  if(["startDelivery","arriveDelivery","completeDelivery"].includes(action)){const status={startDelivery:"in_transit",arriveDelivery:"at_destination",completeDelivery:"completed"}[action];if(status==="completed"&&!confirm("Confirmar conclusão desta entrega?"))return;try{await backend.updateDeliveryStatus({deliveryId:id,status});await refresh();window.driverSelectedDeliveryId=id;driverScreen="detail";renderDriverExperience()}catch(error){notify("Não foi possível atualizar a entrega: "+error.message)}}
  if(action==="occurrence"){window.driverSelectedDeliveryId=id;driverOccurrenceReason="Destinatário ausente";driverOccurrenceNote="";driverScreen="occurrence";renderDriverExperience()}
  if(action==="maps"){const selectedStop=deliveries.find(d=>d.id===window.driverSelectedDeliveryId);if(driverScreen==="detail"&&selectedStop)openGoogleRoute([selectedStop]);else{const stops=driverStops().filter(d=>!["completed","failed"].includes(d.status));openGoogleRoute(stops)}}
  if(action==="location"){if(!navigator.geolocation)return notify("Geolocalização indisponível.");navigator.geolocation.getCurrentPosition(pos=>{const f=$("driverNewForm");f.elements.mapLink.value="https://www.google.com/maps/search/?api=1&query="+pos.coords.latitude+","+pos.coords.longitude;},err=>notify("Não foi possível obter localização: "+err.message),{enableHighAccuracy:true,timeout:10000})}
 }));
 const startForm=$("driverStartForm");
 if(startForm)startForm.addEventListener("submit",async e=>{
  e.preventDefault();const vehicleId=e.target.elements.vehicle.value,odometerStart=Number(e.target.elements.odometer.value),d=currentDriver();
  if(!d)return notify("Seu usuário ainda não está vinculado a um cadastro ativo de entregador.");
  const button=bottom.querySelector('[form="driverStartForm"]')||e.target.querySelector("button[type=submit]");if(button)button.disabled=true;
  try{await backend.startJourney({driverId:d.id,vehicleId,odometerStart});await refresh();driverScreen="route";renderDriverExperience()}
  catch(error){notify("Não foi possível iniciar a jornada: "+error.message);if(button)button.disabled=false}
 });
 const newForm=$("driverNewForm");
 if(newForm){
  newForm.elements.neighborhood.value=driverNewDelivery.neighborhood;
  newForm.elements.address.value=driverNewDelivery.address;
  newForm.elements.reference.value=driverNewDelivery.reference;
  newForm.elements.priority.value=driverDraftPriority;
  newForm.elements.mapLink.value=driverNewDelivery.mapLink;
  newForm.querySelectorAll('input[name="priority"]').forEach(r=>r.addEventListener("change",()=>{driverDraftPriority=r.value;renderDriverExperience()}));
  newForm.addEventListener("input",()=>{driverNewDelivery={neighborhood:newForm.elements.neighborhood.value,address:newForm.elements.address.value,reference:newForm.elements.reference.value,priority:driverDraftPriority,mapLink:newForm.elements.mapLink.value}});
  newForm.addEventListener("submit",async e=>{
   e.preventDefault();const f=e.target,button=bottom.querySelector('[data-driver-submit="driverNewForm"]')||f.querySelector('button[type="submit"]');
   const address=f.elements.address.value.trim();if(!address)return;
   if(button)button.disabled=true;
   try{const ds=driverStops();const created=await backend.createDelivery({journeyId:currentJourney.id,neighborhoodId:f.elements.neighborhood.value,address,reference:f.elements.reference.value.trim(),priority:priorityMap[driverDraftPriority]||"normal",mapLink:f.elements.mapLink.value.trim(),sequenceNo:ds.length+1});driverNewDelivery={neighborhood:"",address:"",reference:"",priority:"Normal",mapLink:""};driverDraftPriority="Normal";await refresh();window.driverSelectedDeliveryId=created.id;driverScreen="route";renderDriverExperience()}
   catch(error){notify("Não foi possível cadastrar a entrega: "+error.message);if(button)button.disabled=false}
  });
 }
 const occurrenceForm=$("driverOccurrenceForm");
 if(occurrenceForm){
  occurrenceForm.querySelectorAll('input[name="reason"]').forEach(r=>r.addEventListener("change",()=>{driverOccurrenceReason=r.value;renderDriverExperience()}));
  occurrenceForm.addEventListener("input",()=>{driverOccurrenceNote=occurrenceForm.elements.note.value});
  occurrenceForm.addEventListener("submit",async e=>{
   e.preventDefault();const note=[driverOccurrenceReason,occurrenceForm.elements.note.value.trim()].filter(Boolean).join(" — ");
   const button=bottom.querySelector('[data-driver-submit="driverOccurrenceForm"]')||e.target.querySelector('button[type="submit"]');if(button)button.disabled=true;
   try{await backend.updateDeliveryStatus({deliveryId:window.driverSelectedDeliveryId,status:"failed",note});await refresh();driverScreen="summary";renderDriverExperience()}
   catch(error){notify("Não foi possível registrar a ocorrência: "+error.message);if(button)button.disabled=false}
  });
 }
 const finishForm=$("driverFinishForm");
 if(finishForm)finishForm.addEventListener("submit",async e=>{
  e.preventDefault();const odometerEnd=Number(e.target.elements.odometer.value);
  if(!driverStops().every(d=>["completed","failed"].includes(d.status)))return notify("Registre o resultado de todas as entregas antes de encerrar.");
  if(!Number.isFinite(odometerEnd)||odometerEnd<Number(currentJourney.odometer_start))return notify("O hodômetro final deve ser igual ou superior ao inicial.");
  const journeyDeliveries=deliveries.filter(d=>d.journey_id===currentJourney.id);
  if(!journeyDeliveries.length)return notify("Não é possível encerrar a jornada sem pelo menos uma entrega cadastrada. Volte, adicione uma entrega e tente novamente.");
  const button=bottom.querySelector('[data-driver-submit="driverFinishForm"]')||e.target.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{stopGpsTracking();await backend.finishJourney({journeyId:currentJourney.id,odometerEnd});await refresh();driverScreen="start";renderDriverExperience()}
  catch(error){notify("Não foi possível encerrar a jornada: "+error.message);if(button)button.disabled=false}
 });
}

$("addRouteStop")?.addEventListener("click",appendRoutePlanStop);
$("previewRoutePlan")?.addEventListener("click",previewRoutePlan);
appendRoutePlanStop();
uppercaseRouteTextInputs();
$("routePlanForm")?.addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=$("saveRoutePlan"),message=$("routePlanMessage");
 const stops=[...$("routePlanStopsEditor").querySelectorAll(".route-stop-editor")].map(card=>({
  neighborhoodId:card.querySelector('[name="neighborhood"]').value,
  address:card.querySelector('[name="address"]').value.trim(),
  reference:card.querySelector('[name="reference"]').value.trim(),
  mapLink:card.querySelector('[name="mapLink"]').value.trim(),
  priority:card.querySelector('[name="priority"]').value
 }));
 if(!stops.length||stops.some(stop=>!stop.address)){message.textContent="Informe pelo menos uma parada e o endereço de cada uma.";return;}
 button.disabled=true;message.textContent="Salvando a rota e atribuindo ao entregador…";
 try{
  await backend.createRoutePlan({title:form.elements.title.value.trim().toLocaleUpperCase("pt-BR"),driverId:form.elements.driver.value,stops:stops.map(stop=>({...stop,address:stop.address.toLocaleUpperCase("pt-BR"),reference:stop.reference.toLocaleUpperCase("pt-BR")}))});
  await refresh();form.reset();$("routePlanStopsEditor").replaceChildren();appendRoutePlanStop();
  message.textContent="Rota salva e atribuída. Ela já estará disponível no aplicativo do entregador selecionado.";
 }catch(error){message.textContent="Não foi possível salvar a rota: "+(error?.message||"erro desconhecido");}
 finally{button.disabled=false;}
});
backend.subscribeToOperations(()=>{refresh();if($("timelineJourney")?.value)loadJourneyTimeline();});
refresh();
/* Relatórios da planilha de odômetro — fonte centralizada no Supabase. */
let odometerEntries = [];
let historicalImportRows = [];
const odoMoney = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const odoNum = v => Number(v||0).toLocaleString("pt-BR",{maximumFractionDigits:1});
function odoWeekStart(value){const d=new Date(value+"T12:00:00");d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toISOString().slice(0,10)}
function odoWeekLabel(value){const start=new Date(odoWeekStart(value)+"T12:00:00"),end=new Date(start);end.setDate(end.getDate()+5);return start.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+" a "+end.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}
function odoWeek(value){return odoWeekLabel(value)}
function odoTotals(rows){return rows.reduce((a,r)=>{a.km+=Number(r.odometer_end)-Number(r.odometer_start);a.deliveries+=Number(r.deliveries_count||0);a.revenue+=Number(r.revenue||0);a.fuel+=Number(r.fuel_cost||0);a.profit+=r.historical_profit!=null?Number(r.historical_profit):Number(r.revenue||0)-Number(r.fuel_cost||0);return a},{km:0,deliveries:0,revenue:0,fuel:0,profit:0})}
function odoGroup(rows,keyFn){const m=new Map();rows.forEach(r=>{const k=keyFn(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)});return [...m.entries()].map(([key,list])=>({key,...odoTotals(list)}))}
function renderOdoReports(){
 const rows=odometerEntries.slice().sort((a,b)=>b.entry_date.localeCompare(a.entry_date));
 $("odometerHistory").innerHTML=rows.length?'<table><thead><tr><th>Data</th><th>Semana</th><th>Veículo</th><th>KM inicial</th><th>KM final</th><th>KM rodado</th><th>Entregas</th><th>Ganhos</th><th>Combustível</th><th>Lucro</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+new Date(r.entry_date+"T12:00:00").toLocaleDateString("pt-BR")+'</td><td>'+odoWeek(r.entry_date)+'</td><td>'+esc(r.vehicle_code)+'</td><td>'+odoNum(r.odometer_start)+'</td><td>'+odoNum(r.odometer_end)+'</td><td>'+odoNum(Number(r.odometer_end)-Number(r.odometer_start))+'</td><td>'+Number(r.deliveries_count||0)+'</td><td>'+odoMoney(r.revenue)+'</td><td>'+odoMoney(r.fuel_cost)+'</td><td>'+odoMoney(Number(r.revenue)-Number(r.fuel_cost))+'</td></tr>').join("")+'</tbody></table>':'<p class="hint">Nenhum lançamento registrado ainda.</p>';
 const weeklyAll=odoGroup(rows.filter(r=>new Date(r.entry_date+"T12:00:00").getDay()!==0),r=>odoWeekStart(r.entry_date));
 const todayKey=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 const currentWeekStart=odoWeekStart(todayKey);
 const range=$("weeklyRange")?.value||"current";
 const firstDataWeek=weeklyAll.map(x=>x.key).sort()[0]||currentWeekStart;
 const firstAllowed=range==="all"?new Date(firstDataWeek+"T12:00:00"):new Date(currentWeekStart+"T12:00:00");
 if(range!=="all"&&range!=="current")firstAllowed.setDate(firstAllowed.getDate()-7*(Math.max(1,Number(range)||5)-1));
 const weekStarts=[],cursor=new Date(firstAllowed),current=new Date(currentWeekStart+"T12:00:00");
 while(cursor<=current){weekStarts.push(cursor.toISOString().slice(0,10));cursor.setDate(cursor.getDate()+7);if(range==="current")break}
 const weekly=weekStarts.map(key=>{const found=weeklyAll.find(x=>x.key===key);return found?{...found,key:odoWeekLabel(key)}:{key:odoWeekLabel(key),km:0,deliveries:0,revenue:0,fuel:0,profit:0}});
 renderWeeklyChart(weekly);
 function renderWeeklyChart(data){
  const el=$("odometerWeeklyChart");if(!el)return;
  if(!data.length){el.innerHTML='<p class="hint">Ainda não há semanas para exibir.</p>';return}
  const fmt=v=>Number(v||0).toLocaleString("pt-BR",{maximumFractionDigits:1});
  const series=[{key:"km",label:"KM rodados",fmt:v=>fmt(v)+" km"},{key:"deliveries",label:"Entregas",fmt:v=>fmt(v)},{key:"revenue",label:"Ganhos",fmt:odoMoney},{key:"fuel",label:"Combustível",fmt:odoMoney},{key:"profit",label:"Lucro",fmt:odoMoney}];
  const max=Math.max(1,...data.flatMap(g=>series.map(s=>Math.max(0,Number(g[s.key])||0))));
  const colors={km:"#2563eb",deliveries:"#8b5cf6",revenue:"#16a34a",fuel:"#f59e0b",profit:"#0ea5e9"};
  el.innerHTML='<div class="weekly-data-cards">'+data.map(g=>'<section class="weekly-data-card"><h4>'+esc(g.key)+'</h4><div class="weekly-bars">'+series.map(s=>{const v=Math.max(0,Number(g[s.key])||0),pct=Math.max(v>0?3:0,v/max*100);return '<div class="weekly-bar-row"><div class="weekly-bar-heading"><span>'+s.label+'</span><strong>'+s.fmt(v)+'</strong></div><div class="weekly-bar-track"><span style="width:'+pct+'%;background:'+colors[s.key]+'"></span></div></div>'}).join("")+'</div></section>').join("")+'</div>';
 }
 $("odometerWeeklyReport").innerHTML='<table><thead><tr><th>Semana</th><th>KM</th><th>Entregas</th><th>Ganhos</th><th>Custos</th><th>Lucro</th><th>KM médio/entrega</th><th>Custo médio/entrega</th></tr></thead><tbody>'+weekly.map(x=>'<tr><td>'+x.key+'</td><td>'+odoNum(x.km)+'</td><td>'+x.deliveries+'</td><td>'+odoMoney(x.revenue)+'</td><td>'+odoMoney(x.fuel)+'</td><td>'+odoMoney(x.profit)+'</td><td>'+odoNum(x.deliveries?x.km/x.deliveries:0)+'</td><td>'+odoMoney(x.deliveries?x.fuel/x.deliveries:0)+'</td></tr>').join("")+'</tbody></table>';
 const monthlyAll=odoGroup(rows,r=>r.entry_date.slice(0,7));
 const todayMonth=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}).slice(0,7);
 const monthRange=$("monthlyRange")?.value||"current";
 const firstMonth=monthlyAll.map(x=>x.key).sort()[0]||todayMonth;
 const startMonth=new Date((monthRange==="all"?firstMonth:todayMonth)+"-01T12:00:00");
 if(monthRange!=="all"&&monthRange!=="current")startMonth.setMonth(startMonth.getMonth()-(Math.max(1,Number(monthRange)||5)-1));
 const monthKeys=[],monthCursor=new Date(startMonth),currentMonthDate=new Date(todayMonth+"-01T12:00:00");
 while(monthCursor<=currentMonthDate){monthKeys.push(monthCursor.getFullYear()+"-"+String(monthCursor.getMonth()+1).padStart(2,"0"));monthCursor.setMonth(monthCursor.getMonth()+1);if(monthRange==="current")break}
 const monthly=monthKeys.map(key=>{const found=monthlyAll.find(x=>x.key===key);return found?{...found,key}: {key,km:0,deliveries:0,revenue:0,fuel:0,profit:0}});
 renderMonthlyChart(monthly);
 $("odometerMonthlyReport").innerHTML='<table><thead><tr><th>Mês</th><th>KM</th><th>Entregas</th><th>Ganhos</th><th>Custos</th><th>Lucro</th><th>KM médio/entrega</th><th>Custo médio/entrega</th></tr></thead><tbody>'+monthly.map(x=>'<tr><td>'+x.key+'</td><td>'+odoNum(x.km)+'</td><td>'+x.deliveries+'</td><td>'+odoMoney(x.revenue)+'</td><td>'+odoMoney(x.fuel)+'</td><td>'+odoMoney(x.profit)+'</td><td>'+odoNum(x.deliveries?x.km/x.deliveries:0)+'</td><td>'+odoMoney(x.deliveries?x.fuel/x.deliveries:0)+'</td></tr>').join("")+'</tbody></table>';
 function renderMonthlyChart(data){
  const el=$("odometerMonthlyChart");if(!el)return;
  if(!data.length){el.innerHTML='<p class="hint">Ainda não há meses para exibir.</p>';return}
  const fmt=v=>Number(v||0).toLocaleString("pt-BR",{maximumFractionDigits:1});
  const series=[{key:"km",label:"KM rodados",fmt:v=>fmt(v)+" km"},{key:"deliveries",label:"Entregas",fmt:v=>fmt(v)},{key:"revenue",label:"Ganhos",fmt:odoMoney},{key:"fuel",label:"Combustível",fmt:odoMoney},{key:"profit",label:"Lucro",fmt:odoMoney}];
  const max=Math.max(1,...data.flatMap(g=>series.map(s=>Math.max(0,Number(g[s.key])||0))));
  const colors={km:"#2563eb",deliveries:"#8b5cf6",revenue:"#16a34a",fuel:"#f59e0b",profit:"#0ea5e9"};
  el.innerHTML='<div class="weekly-data-cards">'+data.map(g=>'<section class="weekly-data-card"><h4>'+esc(g.key)+'</h4><div class="weekly-bars">'+series.map(s=>{const v=Math.max(0,Number(g[s.key])||0),pct=Math.max(v>0?3:0,v/max*100);return '<div class="weekly-bar-row"><div class="weekly-bar-heading"><span>'+s.label+'</span><strong>'+s.fmt(v)+'</strong></div><div class="weekly-bar-track"><span style="width:'+pct+'%;background:'+colors[s.key]+'"></span></div></div>'}).join("")+'</div></section>').join("")+'</div>';
 }
 const vehicles=odoGroup(rows,r=>r.vehicle_code);
 $("odometerVehicleReport").innerHTML='<table><thead><tr><th>Veículo</th><th>KM</th><th>Entregas</th><th>Ganhos</th><th>Combustível</th><th>Lucro</th><th>KM/entrega</th><th>Custo/KM</th></tr></thead><tbody>'+vehicles.map(x=>'<tr><td>'+esc(x.key)+'</td><td>'+odoNum(x.km)+'</td><td>'+x.deliveries+'</td><td>'+odoMoney(x.revenue)+'</td><td>'+odoMoney(x.fuel)+'</td><td>'+odoMoney(x.profit)+'</td><td>'+odoNum(x.deliveries?x.km/x.deliveries:0)+'</td><td>'+odoMoney(x.km?x.fuel/x.km:0)+'</td></tr>').join("")+'</tbody></table>';
 const t=odoTotals(rows);$("odoKpiKm").textContent=odoNum(t.km)+" km";$("odoKpiDeliveries").textContent=t.deliveries.toLocaleString("pt-BR");$("odoKpiRevenue").textContent=odoMoney(t.revenue);$("odoKpiFuel").textContent=odoMoney(t.fuel);$("odoKpiProfit").textContent=odoMoney(t.profit);
 $("odometerEfficiency").innerHTML='<p><strong>Custo médio/KM</strong><br>'+odoMoney(t.km?t.fuel/t.km:0)+'</p><p><strong>Custo por entrega</strong><br>'+odoMoney(t.deliveries?t.fuel/t.deliveries:0)+'</p><p><strong>Ganho por entrega</strong><br>'+odoMoney(t.deliveries?t.revenue/t.deliveries:0)+'</p><p><strong>Ganho por KM</strong><br>'+odoMoney(t.km?t.revenue/t.km:0)+'</p>';
}
$("weeklyRange")?.addEventListener("change",renderOdoReports);
$("monthlyRange")?.addEventListener("change",renderOdoReports);
async function loadOdoEntries(){
 const client=backend?.client;
 if(!client){$("odometerHistory").innerHTML='<p class="hint">Entre novamente para conectar ao banco.</p>';return}
 $("odometerHistory").innerHTML='<p class="hint">Carregando todos os lançamentos do Supabase…</p>';
 try{
  const pageSize=1000,maxRows=100000;
  const allRows=[];
  for(let offset=0;offset<maxRows;offset+=pageSize){
   const {data,error}=await client.from("odometer_entries")
    .select("*")
    .order("entry_date",{ascending:false})
    .order("created_at",{ascending:false})
    .range(offset,offset+pageSize-1);
   if(error)throw error;
   const batch=data||[];
   allRows.push(...batch);
   if(batch.length<pageSize)break;
  }
  odometerEntries=allRows;
  renderOdoReports();
  const countNote=document.createElement("p");
  countNote.className="hint";
  countNote.textContent=odometerEntries.length.toLocaleString("pt-BR")+" lançamento(s) carregado(s) do Supabase.";
  $("odometerHistory").prepend(countNote);
 }catch(error){
  console.error("Falha ao carregar histórico completo de odômetros:",error);
  $("odometerHistory").innerHTML='<p class="hint">Não foi possível carregar todo o histórico de odômetros. Verifique sua conexão, as permissões de leitura no Supabase e tente atualizar. Detalhe: '+esc(error.message||String(error))+'</p>';
 }
}
document.querySelectorAll("[data-fuel-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-fuel-tab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll("[data-fuel-panel]").forEach(p=>p.classList.toggle("hidden",p.dataset.fuelPanel!==b.dataset.fuelTab))}));
$("odometerForm")?.addEventListener("input",()=>{const start=Number($("odoStart").value),end=Number($("odoEnd").value);$("odoLiveSummary").textContent=end>=start?"KM rodado: "+odoNum(end-start)+" km · Lucro líquido: "+odoMoney(Number($("odoRevenue").value)-Number($("odoFuel").value)):"O odômetro final não pode ser menor que o inicial."});
$("odometerForm")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{const start=Number($("odoStart").value),end=Number($("odoEnd").value);if(end<start)throw new Error("O odômetro final não pode ser menor que o inicial.");const client=backend?.client;if(!client)throw new Error("Sessão do Supabase não está pronta. Entre novamente.");const {error}=await client.from("odometer_entries").insert({entry_date:$("odoDate").value,vehicle_code:$("odoVehicle").value,odometer_start:start,odometer_end:end,deliveries_count:Number($("odoDeliveries").value),revenue:Number($("odoRevenue").value),fuel_cost:Number($("odoFuel").value),created_by:backend.profile?.id});if(error)throw error;form.reset();$("odoDate").value=new Date().toISOString().slice(0,10);$("odoDeliveries").value="0";notify("Lançamento salvo.");await loadOdoEntries()}catch(err){notify("Não foi possível salvar: "+(err.message||err))}finally{setBusy(form,false)}});
$("refreshOdometer")?.addEventListener("click",loadOdoEntries);
$("odoDate")?.setAttribute("value",new Date().toISOString().slice(0,10));
document.querySelector('[data-view="planilha-combustivel"]')?.addEventListener("click",loadOdoEntries);

/* Fechamento manual das taxas diárias, com consumo automático por tipo de veículo. */
const localDateKey = value => {const d=new Date(value);if(Number.isNaN(d.getTime()))return "";const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return v.year+"-"+v.month+"-"+v.day};
function completedJourneysForDay(day){return (journeys||[]).filter(j=>j.status==="finished"&&j.finished_at_server&&localDateKey(j.finished_at_server)===day)}
function journeyEfficiency(j){const type=String(j.vehicles?.vehicle_type||"").toLowerCase();return /car|carro|autom[oó]vel/.test(type)?Number($("dailyRatesCarEfficiency")?.value||10):Number($("dailyRatesMotoEfficiency")?.value||30)}
function journeyVehicleType(j){const type=String(j.vehicles?.vehicle_type||"").toLowerCase();return /car|carro|autom[oó]vel/.test(type)?"Carro":"Moto"}
function renderDailyRatesPreview(){
 const day=$("dailyRatesDate")?.value,fees=Number($("dailyRatesFees")?.value||0),price=Number($("dailyRatesFuelPrice")?.value||0),motoEff=Number($("dailyRatesMotoEfficiency")?.value||30),carEff=Number($("dailyRatesCarEfficiency")?.value||10);
 const list=completedJourneysForDay(day||"");
 const rate=list.length?fees/list.length:0;
 const motoCount=list.filter(j=>journeyVehicleType(j)==="Moto").length,carCount=list.filter(j=>journeyVehicleType(j)==="Carro").length;
 $("dailyRatesPreview").textContent=list.length?list.length+" jornada(s) concluída(s) em "+new Date(day+"T12:00:00").toLocaleDateString("pt-BR")+". Ganho por jornada: "+money(rate)+". Consumo automático: "+motoCount+" moto(s) a "+motoEff+" km/L e "+carCount+" carro(s) a "+carEff+" km/L.":"Nenhuma jornada concluída encontrada para esse dia.";
 $("dailyRatesJourneys").innerHTML=list.length?'<table><thead><tr><th>Jornada</th><th>Entregador</th><th>Veículo</th><th>Tipo</th><th>KM rodados</th><th>Consumo (km/L)</th><th>Ganhos estimados</th><th>Combustível estimado</th><th>Lucro estimado</th></tr></thead><tbody>'+list.map(j=>{const km=Math.max(0,Number(j.odometer_end)-Number(j.odometer_start)),eff=journeyEfficiency(j),fuel=price/eff*km;return '<tr><td>#'+esc(j.order_number||j.id.slice(0,8))+'</td><td>'+esc(j.drivers?.full_name||"—")+'</td><td>'+esc(j.vehicles?.code||j.vehicles?.plate||"—")+'</td><td>'+journeyVehicleType(j)+'</td><td>'+km.toLocaleString("pt-BR",{maximumFractionDigits:1})+'</td><td>'+eff+'</td><td>'+money(rate)+'</td><td>'+money(fuel)+'</td><td>'+money(rate-fuel)+'</td></tr>'}).join("")+'</tbody></table>':'<p class="hint">As jornadas concluídas aparecerão aqui após selecionar a data e consultar os dados.</p>';
}
$("dailyRatesDate")?.addEventListener("change",renderDailyRatesPreview);
["dailyRatesFees","dailyRatesFuelPrice","dailyRatesMotoEfficiency","dailyRatesCarEfficiency"].forEach(id=>$(id)?.addEventListener("input",renderDailyRatesPreview));
$("previewDailyRates")?.addEventListener("click",async()=>{try{await refresh();renderDailyRatesPreview()}catch(e){notify("Não foi possível atualizar as jornadas: "+(e.message||e))}});
$("dailyJourneyRatesForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget;setBusy(form,true);
 try{
  const client=backend?.client;if(!client)throw new Error("Sessão do Supabase não está pronta. Entre novamente.");
  const day=$("dailyRatesDate").value,fees=Number($("dailyRatesFees").value),price=Number($("dailyRatesFuelPrice").value),motoEff=Number($("dailyRatesMotoEfficiency").value),carEff=Number($("dailyRatesCarEfficiency").value);
  if(!day||fees<0||price<0||motoEff<=0||carEff<=0)throw new Error("Confira a data, o total das taxas, o preço do litro e os consumos médios da moto e do carro.");
  await refresh();
  const {data:existingClosure,error:closureLookupError}=await client.from("daily_journey_rates").select("*").eq("entry_date",day).maybeSingle();
  if(closureLookupError)throw closureLookupError;
  const list=completedJourneysForDay(day);if(!list.length)throw new Error("Não há jornadas concluídas nessa data. Confira a data e atualize a lista.");
  const {data:alreadyRows,error:alreadyError}=await client.from("odometer_entries").select("journey_id,average_km_per_liter,fuel_price_per_liter,revenue").eq("entry_date",day);
  if(alreadyError)throw alreadyError;
  const alreadyIds=new Set((alreadyRows||[]).map(r=>r.journey_id).filter(Boolean));
  const pending=list.filter(j=>!alreadyIds.has(j.id));
  const skipped=list.length-pending.length;
  if(!pending.length)throw new Error("Nenhuma jornada nova foi registrada: todas as "+list.length+" jornada(s) deste dia já constam no sistema. Nenhum dado foi alterado.");
  let closure=existingClosure;
  if(!closure){
   const {data:createdClosure,error:dailyError}=await client.from("daily_journey_rates").insert({entry_date:day,total_delivery_fees:fees,fuel_price_per_liter:price,average_km_per_liter:Number((list.reduce((sum,j)=>sum+journeyEfficiency(j),0)/list.length).toFixed(2)),journey_count:list.length,created_by:backend.profile?.id,updated_at:new Date().toISOString()}).select("*").single();
   if(dailyError)throw dailyError;
   closure=createdClosure;
  }
  const closureFeeTotal=Number(closure.total_delivery_fees??fees);
  const originalJourneyCount=Math.max(1,Number(closure.journey_count||list.length));
  const rate=closureFeeTotal/originalJourneyCount;
  const storedPrice=Number(closure.fuel_price_per_liter??price);
  const storedEffByType={};
  (alreadyRows||[]).forEach(row=>{const j=list.find(item=>item.id===row.journey_id);if(j&&Number(row.average_km_per_liter)>0)storedEffByType[journeyVehicleType(j)]=Number(row.average_km_per_liter)});
  let usedCurrentEfficiencyForUnseenType=false;
  for(const j of pending){
   const km=Math.max(0,Number(j.odometer_end)-Number(j.odometer_start)),type=journeyVehicleType(j);
   const eff=storedEffByType[type]||journeyEfficiency(j);
   if(!storedEffByType[type])usedCurrentEfficiencyForUnseenType=true;
   const payload={journey_id:j.id,entry_date:day,vehicle_code:j.vehicles?.code||j.vehicles?.plate||"N/D",odometer_start:Number(j.odometer_start),odometer_end:Number(j.odometer_end),deliveries_count:(deliveries||[]).filter(d=>d.journey_id===j.id&&d.status==="completed").length,revenue:Number(rate.toFixed(2)),fuel_cost:Number(((storedPrice/eff)*km).toFixed(2)),daily_fees_total:closureFeeTotal,fuel_price_per_liter:storedPrice,average_km_per_liter:eff,created_by:backend.profile?.id};
   const {error}=await client.from("odometer_entries").insert(payload);if(error)throw error;
  }
  notify("Fechamento processado: "+pending.length+" jornada(s) nova(s) registrada(s)"+(skipped?", "+skipped+" já existente(s) ignorada(s)":"")+". Valor preservado do fechamento: "+money(closureFeeTotal)+" em taxas e "+money(rate)+" por jornada."+(usedCurrentEfficiencyForUnseenType?" Para um tipo de veículo sem histórico neste fechamento, foi usado o consumo informado agora.":""));
  await loadOdoEntries();renderDailyRatesPreview();
 }catch(err){notify("Não foi possível fechar o dia: "+(err.message||err))}finally{setBusy(form,false)}
});
if($("dailyRatesDate"))$("dailyRatesDate").value=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
renderDailyRatesPreview();


function parseHistoricalCsv(text){
 const lines=String(text).replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
 if(lines.length<2)throw new Error("O arquivo não contém linhas de dados. Exporte a planilha como CSV e tente novamente.");
 const delimiter=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?";":",";
 const parseLine=line=>{const out=[];let cur="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'&&quoted){cur+='"';i++}else if(ch==='"')quoted=!quoted;else if(ch===delimiter&&!quoted){out.push(cur.trim());cur=""}else cur+=ch}out.push(cur.trim());return out};
 const head=parseLine(lines[0]).map(x=>x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,""));
 const aliases=[["data"],["semana"],["mes"],["kminicial"],["kmfinal"],["kmrodado"],["quantidadedeentregas","qtddeentregas","qtdentregas"],["ganhosr","ganhos"],["combustivelr","combustivel"],["veiculo"],["lucroliquidor","lucroliquido","lucro"]];
 const indexes=aliases.map(group=>head.findIndex(h=>group.includes(h)));
 if(indexes.some(x=>x<0))throw new Error("Cabeçalho incompatível. São necessárias 11 colunas: Data, Semana, Mês, Km Inicial, Km Final, Km Rodado, Qtd de Entregas, Ganhos (R$), Combustível (R$), Veículo e Lucro Líquido (R$).");
 const out=[],seen=new Set(),issues=[];
 const number=v=>{let s=String(v??"").trim().replace(/R\$/gi,"").replace(/\s/g,"");if(s==="-"||s==="")return NaN;if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");else if(s.includes(","))s=s.replace(",",".");const n=Number(s);return Number.isFinite(n)?n:NaN};
 lines.slice(1).forEach((line,ix)=>{
  const cells=parseLine(line);if(!cells.some(Boolean))return;
  const rawDate=(cells[indexes[0]]||"").replace(/^['"]|['"]$/g,"").trim();let date="";
  if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate))date=rawDate;
  else {const m=rawDate.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m)date=m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0")}
  const vals=indexes.map((j,k)=>k===0?date:cells[j]);
  const start=number(vals[3]),end=number(vals[4]),km=number(vals[5]),deliveriesRaw=String(vals[6]??"").trim(),deliveries=deliveriesRaw==="-"||deliveriesRaw===""?0:number(deliveriesRaw),revenue=number(vals[7]),fuel=number(vals[8]),vehicle=String(vals[9]||"").trim(),profit=number(vals[10]);
  if(!date||![start,end,km,deliveries,revenue,fuel,profit].every(Number.isFinite)||!vehicle){issues.push("Linha "+(ix+2)+": data, números ou veículo inválido.");return}
  if(date<"2026-06-01"||date>"2026-10-15"){issues.push("Linha "+(ix+2)+": data fora do período 01/06/2026 a 15/10/2026.");return}
  if(end<start||Math.abs(end-start-km)>0.11){issues.push("Linha "+(ix+2)+": KM rodado não corresponde à diferença do odômetro.");return}
  const key=[date,vehicle,start,end,deliveries,Number(revenue).toFixed(2),Number(fuel).toFixed(2)].join("|");
  if(seen.has(key))return;seen.add(key);
  out.push({entry_date:date,vehicle_code:vehicle,odometer_start:start,odometer_end:end,deliveries_count:deliveries,revenue:Number(revenue.toFixed(2)),fuel_cost:Number(fuel.toFixed(2)),created_by:backend.profile.id,historical_import_key:key,source_type:"historical",historical_driver:"Genérico (Histórico)",historical_week:Number(vals[1])||null,historical_month:Number(vals[2])||Number(date.slice(5,7)),historical_profit:Number(profit.toFixed(2))});
 });
 if(issues.length)throw new Error(issues.slice(0,8).join(" ")+(issues.length>8?" E mais "+(issues.length-8)+" problema(s).":""));
 if(!out.length)throw new Error("Nenhum registro válido foi encontrado. Verifique o cabeçalho e o separador do CSV.");
 return out;
}
function parseHistoricalXlsxRows(sheet){
 const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:"",blankrows:false});
 if(matrix.length<2)throw new Error("A planilha não contém linhas de dados.");
 const normalize=value=>String(value??"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]/g,"");
 const headers=matrix[0].map(normalize);
 const aliases=[["data"],["semana"],["mes"],["kminicial"],["kmfinal"],["kmrodado"],["quantidadedeentregas","qtddeentregas","qtdentregas"],["ganhosr","ganhosrs","ganhos"],["combustivelr","combustivelrs","combustivel"],["veiculo"],["lucroliquidor","lucroliquidors","lucroliquido","lucro"]];
 const indexes=aliases.map(group=>headers.findIndex(h=>group.includes(h)));
 if(indexes.some(i=>i<0))throw new Error("Cabeçalho incompatível. Confira as 11 colunas obrigatórias da planilha histórica.");
 const number=value=>{
  if(typeof value==="number")return Number.isFinite(value)?value:NaN;
  let s=String(value??"").trim().replace(/R\\$/gi,"").replace(/\\s/g,"");
  if(!s||s==="-")return NaN;
  if(s.includes(",")&&s.includes("."))s=s.replace(/\\./g,"").replace(",",".");
  else if(s.includes(","))s=s.replace(",",".");
  const n=Number(s);return Number.isFinite(n)?n:NaN;
 };
 const dateValue=value=>{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.getFullYear()+"-"+String(value.getMonth()+1).padStart(2,"0")+"-"+String(value.getDate()).padStart(2,"0");
  if(typeof value==="number"&&Number.isFinite(value)){
   const d=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
   return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
  }
  const s=String(value??"").trim();
  if(/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return s;
  const m=s.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{2}|\\d{4})$/);
  if(m){let y=Number(m[3]);if(y<100)y+=y>=70?1900:2000;return y+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0")}
  return "";
 };
 const out=[],seen=new Set(),issues=[];
 matrix.slice(1).forEach((row,ix)=>{
  if(!row.some(v=>v!==""&&v!==null&&v!==undefined))return;
  const vals=indexes.map(i=>row[i]);
  const date=dateValue(vals[0]),start=number(vals[3]),end=number(vals[4]),km=number(vals[5]);
  const dr=String(vals[6]??"").trim(),deliveries=dr===""||dr==="-"?0:number(vals[6]);
  const revenue=number(vals[7]),fuel=number(vals[8]),vehicle=String(vals[9]??"").trim(),profit=number(vals[10]);
  if(!date||![start,end,km,deliveries,revenue,fuel,profit].every(Number.isFinite)||!vehicle){issues.push("Linha "+(ix+2)+": data, números ou veículo inválido.");return}
  if(date<"2026-06-01"||date>"2026-10-15"){issues.push("Linha "+(ix+2)+": data fora do período 01/06/2026 a 15/10/2026.");return}
  if(end<start||Math.abs(end-start-km)>0.11){issues.push("Linha "+(ix+2)+": KM rodado não corresponde à diferença do odômetro.");return}
  const key=[date,vehicle,start,end,deliveries,Number(revenue).toFixed(2),Number(fuel).toFixed(2)].join("|");
  if(seen.has(key))return;seen.add(key);
  out.push({entry_date:date,vehicle_code:vehicle,odometer_start:start,odometer_end:end,deliveries_count:deliveries,revenue:Number(revenue.toFixed(2)),fuel_cost:Number(fuel.toFixed(2)),created_by:backend.profile.id,historical_import_key:key,source_type:"historical",historical_driver:"Genérico (Histórico)",historical_week:Number(vals[1])||null,historical_month:Number(vals[2])||Number(date.slice(5,7)),historical_profit:Number(profit.toFixed(2))});
 });
 if(issues.length)throw new Error(issues.slice(0,8).join(" ")+(issues.length>8?" E mais "+issues.length+" problema(s).":""));
 if(!out.length)throw new Error("Nenhum registro válido encontrado no período de 01/06/2026 a 15/10/2026.");
 return out;
}
$("historicalImportFile")?.addEventListener("change",async e=>{
 const file=e.target.files?.[0];historicalImportRows=[];$("historicalImportButton").disabled=true;$("historicalImportPreview").innerHTML="";
 if(!file)return;
 try{let text;if(/\.xlsx?$/i.test(file.name)){if(!window.XLSX)throw new Error("Biblioteca Excel não carregou. Atualize a página e tente novamente.");const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});const firstSheet=workbook.Sheets[workbook.SheetNames[0]];if(!firstSheet)throw new Error("O arquivo Excel não contém nenhuma aba.");historicalImportRows=parseHistoricalXlsxRows(firstSheet);}else{text=await file.text();}if(!/\.xlsx?$/i.test(file.name))historicalImportRows=parseHistoricalCsv(text);const totalKm=historicalImportRows.reduce((sum,r)=>sum+Number(r.odometer_end-r.odometer_start),0),totalDeliveries=historicalImportRows.reduce((sum,r)=>sum+Number(r.deliveries_count),0),totalRevenue=historicalImportRows.reduce((sum,r)=>sum+Number(r.revenue),0),totalFuel=historicalImportRows.reduce((sum,r)=>sum+Number(r.fuel_cost),0),totalProfit=historicalImportRows.reduce((sum,r)=>sum+Number(r.historical_profit),0),vehicles=[...new Set(historicalImportRows.map(r=>r.vehicle_code))];$("historicalImportStatus").textContent=historicalImportRows.length+" registro(s) válido(s). Revise o resumo e confirme para gravar no banco.";const rows=historicalImportRows.slice(0,8);$("historicalImportPreview").innerHTML='<div class="historical-import-summary"><div><span>Registros</span><strong>'+historicalImportRows.length+'</strong></div><div><span>KM rodados</span><strong>'+odoNum(totalKm)+' km</strong></div><div><span>Entregas</span><strong>'+totalDeliveries+'</strong></div><div><span>Ganhos</span><strong>'+odoMoney(totalRevenue)+'</strong></div><div><span>Combustível</span><strong>'+odoMoney(totalFuel)+'</strong></div><div><span>Lucro líquido da planilha</span><strong>'+odoMoney(totalProfit)+'</strong></div><div><span>Veículos</span><strong>'+vehicles.map(esc).join(", ")+'</strong></div></div>'+'<table><thead><tr><th>Data</th><th>Veículo</th><th>KM</th><th>Entregas</th><th>Ganhos</th><th>Combustível</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.entry_date+'</td><td>'+esc(r.vehicle_code)+'</td><td>'+odoNum(r.odometer_end-r.odometer_start)+'</td><td>'+r.deliveries_count+'</td><td>'+odoMoney(r.revenue)+'</td><td>'+odoMoney(r.fuel_cost)+'</td></tr>').join("")+'</tbody></table>'+(historicalImportRows.length>8?'<p class="hint">Prévia das primeiras 8 linhas de '+historicalImportRows.length+'.</p>':"");$("historicalImportButton").disabled=!admin||!historicalImportRows.length}catch(err){$("historicalImportStatus").textContent="Falha na validação: "+err.message;historicalImportRows=[]}
});
$("historicalImportButton")?.addEventListener("click",async()=>{
 if(!admin||!historicalImportRows.length)return;
 const totalRevenue=historicalImportRows.reduce((sum,r)=>sum+Number(r.revenue),0),totalFuel=historicalImportRows.reduce((sum,r)=>sum+Number(r.fuel_cost),0),totalProfit=historicalImportRows.reduce((sum,r)=>sum+Number(r.historical_profit),0);
 if(!confirm("Confirmar importação de "+historicalImportRows.length+" registros históricos?\\nGanhos: "+odoMoney(totalRevenue)+"\\nCombustível: "+odoMoney(totalFuel)+"\\nLucro líquido informado: "+odoMoney(totalProfit)+"\\nRegistros já importados serão ignorados.") )return;
 const button=$("historicalImportButton");button.disabled=true;
 try{const client=backend?.client;if(!client)throw new Error("Supabase não conectado.");
  let inserted=0;
  for(let offset=0;offset<historicalImportRows.length;offset+=250){
   const batch=historicalImportRows.slice(offset,offset+250);
   const {data,error}=await client.from("odometer_entries").upsert(batch,{onConflict:"historical_import_key",ignoreDuplicates:true}).select("id");
   if(error)throw error;
   inserted+=(data||[]).length;
   $("historicalImportStatus").textContent="Enviando ao Supabase… "+Math.min(offset+batch.length,historicalImportRows.length)+" de "+historicalImportRows.length+" registros verificados.";
  }
  const verifiedKeys=new Set();
  for(let offset=0;offset<historicalImportRows.length;offset+=250){
   const keys=historicalImportRows.slice(offset,offset+250).map(r=>r.historical_import_key);
   const {data,error}=await client.from("odometer_entries").select("historical_import_key").in("historical_import_key",keys);
   if(error)throw error;
   (data||[]).forEach(r=>{if(r.historical_import_key)verifiedKeys.add(r.historical_import_key)});
   $("historicalImportStatus").textContent="Conferindo gravação no Supabase… "+Math.min(offset+keys.length,historicalImportRows.length)+" de "+historicalImportRows.length+" chaves verificadas.";
  }
  const verified=historicalImportRows.filter(r=>verifiedKeys.has(r.historical_import_key)).length;
  if(verified<historicalImportRows.length)throw new Error("O Supabase confirmou apenas "+verified+" de "+historicalImportRows.length+" registros. A importação não será marcada como concluída; confira as permissões RLS e a migração.");
  await loadOdoEntries();
  $("historicalImportStatus").textContent="GRAVAÇÃO CONFIRMADA NO SUPABASE: "+verified+" de "+historicalImportRows.length+" registros históricos localizados. "+inserted+" inserido(s) nesta operação; "+(verified-inserted)+" já existiam.";
  notify("Gravação confirmada no Supabase: "+verified+" registros localizados. "+inserted+" novo(s); "+(verified-inserted)+" já existente(s). Relatórios atualizados.");
 }catch(err){$("historicalImportStatus").textContent="Não foi possível importar: "+(err.message||err);button.disabled=false}
});
