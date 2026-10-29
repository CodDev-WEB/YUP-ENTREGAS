/* Classic script: load after authenticated app.js, not as a module. */
(() => {
  "use strict";
  if (typeof admin === "undefined" || admin || typeof backend === "undefined" ||
      !backend?.profile?.id || typeof driverScreenMarkup !== "function" ||
      typeof renderDriverExperience !== "function" || renderDriverExperience.yupMobile) return;

  const originalMarkup = driverScreenMarkup;
  const originalRender = renderDriverExperience;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const heading = (kicker, title, subtitle = "") => `<p class="driver-kicker">${escape(kicker)}</p><h1>${escape(title)}</h1>${subtitle ? `<p class="driver-subtitle">${escape(subtitle)}</p>` : ""}`;
  const submit = label => `<button type="submit" hidden class="driver-mobile-submit">${escape(label)}</button>`;
  const order = delivery => delivery.order_no ? `#${delivery.order_no}` : "Número a atribuir";
  const status = delivery => statusLabel[delivery.status] || delivery.status;
  const terminal = delivery => ["completed", "failed"].includes(delivery.status);
  const action = (label, name, id = "", className = "driver-outline") => `<button type="button" class="${className}" data-driver-action="${name}"${id ? ` data-id="${escape(id)}"` : ""}>${escape(label)}</button>`;
  const screenLink = (label, screen) => `<button type="button" class="driver-quiet" data-driver-screen="${screen}">${escape(label)}</button>`;
  let pending = null;
  let guardedRoot = null;
  let dockObserver = null;
  let finishDraft = null;

  driverScreenMarkup = function () {
    const stops = driverStops();
    const next = driverNext();
    const driver = currentDriver();
    const vehicle = vehicles.find(item => item.id === currentJourney?.vehicle_id);
    const done = stops.filter(item => item.status === "completed").length;
    const failed = stops.filter(item => item.status === "failed").length;
    const journeyLabel = `JORNADA ${currentJourney?.order_number ? `#J-${currentJourney.order_number}` : "EM ANDAMENTO"}`;
    const vehicleLine = `<p class="driver-vehicle-line">${escape([driver?.full_name, vehicle?.make_model || vehicle?.code, vehicle?.plate].filter(Boolean).join(" · "))}</p>`;
    const stats = summary => `<div class="driver-stats${summary ? " driver-summary-stats" : ""}"><div><strong>${stops.length}</strong><span>Paradas</span></div><div><strong>${done}</strong><span>Concluídas</span></div><div><strong>${summary ? failed : `${done + failed} / ${stops.length}`}</strong><span>${summary ? "Ocorrências" : "Finalizadas"}</span></div>${summary ? "" : `<div class="driver-progress" role="progressbar" aria-label="Paradas finalizadas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${stops.length ? Math.round((done + failed) / stops.length * 100) : 0}"><i style="width:${stops.length ? (done + failed) / stops.length * 100 : 0}%"></i></div>`}<small>Início ${escape(driverTime(currentJourney?.started_at_server))} · Odômetro inicial ${escape(Number(currentJourney?.odometer_start || 0).toLocaleString("pt-BR"))} km</small></div>`;

    if (driverScreen === "start" || !currentJourney) {
      driverScreen = "start";
      const name = driver?.full_name || backend.profile.display_name || "Entregador";
      const initials = name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toLocaleUpperCase("pt-BR");
      const activeVehicles = vehicles.filter(item => item.active);
      return heading("YUP STORE · SANTARÉM", "Tudo pronto para sair?", "Confira seus dados para iniciar a jornada.") +
        `<section class="driver-profile" aria-label="Perfil do entregador"><div class="driver-initials" aria-hidden="true">${escape(initials)}</div><div><strong>${escape(name)}</strong><p>Entregador</p></div><div class="driver-profile-meta">${escape(driverDate())}</div></section>
        <h2 class="driver-section-title">Sua jornada começa aqui</h2>
        <form id="driverStartForm" class="driver-form">
          <label>Tipo de jornada<select name="journeyType" required><option value="delivery">Entrega para cliente</option><option value="store_use">Outros — benefício da loja</option></select></label>
          <label class="hidden" id="driverPurposeNoteWrap">Observação / finalidade<input name="purposeNote" maxlength="160" placeholder="Ex.: compras, AMAVIE, jogar lixo"></label>
          <label>Veículo<select name="vehicle" required${activeVehicles.length ? "" : " disabled"}><option value="">Selecione seu veículo</option>${activeVehicles.map(item => `<option value="${escape(item.id)}">${escape([item.make_model || item.code, item.plate].filter(Boolean).join(" · "))}</option>`).join("")}</select></label>
          ${activeVehicles.length ? "" : '<p class="driver-warning" role="status">Nenhum veículo ativo disponível. Peça à equipe para verificar o cadastro antes de iniciar.</p>'}
          <label>Odômetro inicial (km)<input name="odometer" type="number" min="0" step="0.1" inputmode="decimal" required placeholder="Informe a quilometragem"></label>
          <div class="driver-info">A localização exige sua permissão e depende do dispositivo e da conexão. Mantenha o aplicativo aberto durante a jornada.</div>
          ${submit("Iniciar jornada")}
        </form>`;
    }
    if (driverScreen === "route") {
      return `<div class="driver-status-row"><div class="driver-status-copy">${heading(journeyLabel, "Sua rota em dia")}</div><span class="driver-state">Em andamento</span></div>${vehicleLine}${stats(false)}
        <div class="driver-section-heading"><h2>Sequência de paradas</h2><span>${done} de ${stops.length} concluída(s)</span></div>
        ${stops.length ? `<ol class="driver-stop-list">${stops.map((delivery, index) => `<li><button type="button" class="driver-stop${next?.id === delivery.id ? " is-next" : ""}" data-driver-action="detail" data-id="${escape(delivery.id)}"><span class="driver-stop-number">${delivery.status === "completed" ? "✓" : String(index + 1).padStart(2, "0")}</span><span class="driver-stop-copy"><strong>${escape(delivery.neighborhoods?.name || "Endereço da entrega")}</strong><small>${escape(delivery.address)}</small><em class="driver-chip${delivery.status === "failed" ? " warning" : delivery.status === "completed" ? " success" : ""}">${escape(status(delivery))} · ${escape(order(delivery))}</em><small class="driver-stop-priority">Prioridade: ${escape(({ normal: "Normal", high: "Alta", scheduled: "Agendada" })[delivery.priority] || delivery.priority || "Normal")}</small></span><span class="driver-stop-arrow" aria-hidden="true">›</span></button></li>`).join("")}</ol>` : '<div class="driver-empty">Nenhuma entrega cadastrada. Adicione a primeira parada para começar.</div>'}
        <div class="driver-inline-actions">${action("Abrir rota no Maps", "maps")}${screenLink("Encerrar jornada", "summary")}</div>`;
    }
    if (driverScreen === "new") {
      const catalog=deliveries.filter(item=>!item.journey_id&&item.status==="pending");
      return heading(journeyLabel, "Adicionar entrega", "Selecione os pedidos pendentes cadastrados pela equipe ou use o cadastro manual.") +
        `<section class="driver-pending-catalog"><h2>Pedidos pendentes</h2>${catalog.length ? catalog.map(item=>`<article class="driver-pending-order"><div><strong>${escape(order(item))}</strong><p>${escape(item.neighborhoods?.name||"BAIRRO NÃO INFORMADO")} · ${escape(item.address)}</p><small>${escape(item.reference||"Sem referência")} · ${escape(({normal:"Normal",high:"Alta",scheduled:"Agendada"})[item.priority]||item.priority)}</small></div><button type="button" class="driver-dock-primary" data-driver-action="assignPending" data-id="${escape(item.id)}">Adicionar à sequência</button></article>`).join("") : '<p class="driver-empty">Nenhum pedido pendente cadastrado pela equipe.</p>'}</section>
        <details class="driver-manual-entry"><summary>＋ Cadastrar entrega manualmente</summary>
          <form id="driverNewForm" class="driver-form">
            ${action("Usar minha localização atual", "location")}
            <label class="sales-cep-priority">CEP <small>Preencha para localizar o endereço</small><input name="postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000"></label>
            <label>Bairro<select name="neighborhood" required><option value="">Selecione o bairro</option>${neighborhoods.map(item => `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("")}</select></label>
            <label>Endereço completo<textarea name="address" rows="2" required placeholder="Rua, número e complemento"></textarea></label>
            <label>Ponto de referência <small>Opcional</small><input name="reference" placeholder="Referência para encontrar o endereço"></label>
            <fieldset class="driver-priority"><legend>Prioridade</legend>${["Normal", "Alta", "Agendada"].map(value => `<label class="${driverDraftPriority === value ? "selected" : ""}"><input type="radio" name="priority" value="${value}"${driverDraftPriority === value ? " checked" : ""}>${value}</label>`).join("")}</fieldset>
            <label>Link de localização compartilhada <small>Opcional</small><input name="mapLink" type="url" placeholder="Cole o link do Maps ou WhatsApp"></label>
            <div class="driver-info">Confira o endereço antes de adicionar. A localização atual exige permissão e não substitui a conferência.</div>${submit("Adicionar à sequência")}
          </form>
        </details>`;
    }
    const selected = stops.find(item => item.id === window.driverSelectedDeliveryId) || next;
    if (["detail", "occurrence"].includes(driverScreen) && !selected) {
      driverScreen = "route";
      return driverScreenMarkup();
    }
    if (driverScreen === "detail") {
      const index = stops.indexOf(selected);
      const events = selected.delivery_events || [];
      let destination = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([selected.address, selected.neighborhoods?.name, "Santarém, PA"].filter(Boolean).join(", "))}`;
      try {
        const url = new URL(selected.map_link);
        if (["http:", "https:"].includes(url.protocol)) destination = url.href;
      } catch { /* Missing or invalid shared links use address-based navigation. */ }
      return heading(`${journeyLabel} · PARADA ${index + 1} DE ${stops.length}`, `Entrega ${order(selected)}`) +
        `<span class="driver-state">${escape(status(selected))}</span><article class="driver-address-card"><p class="driver-kicker">${escape(selected.neighborhoods?.name || "Endereço")}</p><h2>${escape(selected.address)}</h2>${selected.reference ? `<p>${escape(selected.reference)}</p>` : ""}<a class="driver-outline" target="_blank" rel="noopener noreferrer" href="${escape(destination)}">Abrir destino no Maps</a></article>
        <div class="driver-section-heading"><h2>Etapas da entrega</h2><span>${events.length} registro(s)</span></div><div class="driver-timeline">${[["departure", "Saída registrada", "A caminho desta parada."], ["arrival", "Chegada registrada", "No endereço da entrega."], ["completed", "Entrega concluída", "Entrega confirmada."]].map(([type, title, text]) => {
          const event = events.find(item => item.event_type === type);
          return `<div class="driver-timeline-row"><span class="driver-timeline-icon" aria-hidden="true">${event ? "✓" : "○"}</span><div><strong>${title}</strong><small>${text}</small></div><time>${event ? escape(driverTime(event.received_at_server || event.occurred_at_device)) : "Pendente"}</time></div>`;
        }).join("")}</div>${selected.status === "failed" ? `<div class="driver-warning">Ocorrência registrada: ${escape(selected.result_note || "Entrega não realizada")}</div>` : ""}
        ${!terminal(selected) ? action("Registrar ocorrência", "occurrence", selected.id, "driver-warning-action") : ""}
        ${screenLink("Voltar à rota", "route")}`;
    }
    if (driverScreen === "occurrence") {
      return heading(`${journeyLabel} · ENTREGA ${order(selected)}`, "O que aconteceu?", "Registre o motivo para manter a equipe informada.") +
        `<article class="driver-address-card"><strong>${escape(selected.neighborhoods?.name || "Endereço")}</strong><p>${escape(selected.address)}</p><small>Etapa atual: ${escape(status(selected))}</small></article>
        <form id="driverOccurrenceForm" class="driver-form"><fieldset class="driver-reasons"><legend>Motivo</legend>${["Destinatário ausente", "Endereço não localizado", "Outro motivo"].map(value => `<label class="${driverOccurrenceReason === value ? "selected" : ""}"><input type="radio" name="reason" value="${value}"${driverOccurrenceReason === value ? " checked" : ""} required><span>${value}</span></label>`).join("")}</fieldset>
          <label>O que você tentou? <small>Opcional</small><textarea name="note" rows="4" placeholder="Descreva brevemente o que aconteceu.">${escape(driverOccurrenceNote)}</textarea></label>
          <p class="driver-helper">Inclua apenas informações necessárias sobre a entrega. Evite dados pessoais de terceiros.</p><div class="driver-warning">Esta parada ficará com ocorrência, não como concluída. O registro aparecerá no resumo da jornada.</div>${submit("Registrar ocorrência")}
        </form>`;
    }
    if (driverScreen === "summary") {
      const remaining = stops.filter(item => !terminal(item)).length;
      const initial = Number(currentJourney.odometer_start || 0);
      const distance = currentJourney.odometer_end == null ? null : Number(currentJourney.odometer_end) - initial;
      return heading(journeyLabel, "Resumo da jornada", "Confira os registros antes de encerrar.") + vehicleLine + stats(true) +
        `<form id="driverFinishForm" class="driver-form"><label>Odômetro final (km)<input name="odometer" type="number" min="${escape(initial)}" step="0.1" inputmode="decimal" required placeholder="Odômetro atual"></label>
          <p class="driver-helper">Inicial: ${escape(initial.toLocaleString("pt-BR"))} km${Number.isFinite(distance) ? ` · Percurso registrado: ${escape(distance.toLocaleString("pt-BR"))} km` : ""}</p><p class="driver-helper" data-driver-distance aria-live="polite"></p>
          <h2 class="driver-section-title">Resultado das entregas</h2><div class="driver-results">${stops.map(delivery => `<div class="driver-result"><span class="${delivery.status === "failed" ? "failed" : ""}" aria-hidden="true">${delivery.status === "completed" ? "✓" : delivery.status === "failed" ? "!" : "○"}</span><div><strong>${escape(order(delivery))} · ${escape(delivery.neighborhoods?.name || "Endereço")}</strong><small>${escape(delivery.address)}</small>${delivery.status === "failed" ? `<em>${escape(delivery.result_note || "Ocorrência registrada")}</em>` : ""}</div><aside>${escape(status(delivery))}<small>${escape(driverTime(delivery.updated_at || delivery.created_at))}</small></aside></div>`).join("") || '<p class="driver-empty">Nenhuma entrega nesta jornada.</p>'}</div>
          ${remaining ? `<div class="driver-warning" role="status">Ainda há ${remaining} entrega(s) sem resultado. Registre conclusão ou ocorrência antes de encerrar.</div>` : ""}${submit("Confirmar encerramento")}
        </form>`;
    }
    return originalMarkup();
  };

  function release() {
    if (!pending) return;
    pending.observer.disconnect();
    for (const [button, disabled] of pending.controls) button.disabled = disabled;
    pending.root.removeAttribute("aria-busy");
    pending = null;
  }

  function lock(root) {
    root.setAttribute("aria-busy", "true");
    root.querySelectorAll("button").forEach(button => {
      if (button === pending.button || button.matches("[data-driver-logout]")) return;
      if (!pending.controls.has(button)) pending.controls.set(button, button.disabled);
      button.disabled = true;
    });
  }

  function installGuard(root) {
    if (guardedRoot === root) return;
    guardedRoot = root;
    root.addEventListener("submit", event => {
      const form = event.target;
      if (!form.matches("#driverStartForm, #driverNewForm, #driverOccurrenceForm, #driverFinishForm")) return;
      const button = form.querySelector('button[type="submit"]');
      if (pending || button?.disabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (form.id === "driverStartForm" && !vehicles.some(item => item.active && item.id === form.elements.vehicle.value)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notify("Selecione um veículo ativo antes de iniciar.");
        return;
      }
      if (!button) return;
      const observer = new MutationObserver(() => { if (pending?.button === button && !button.disabled) release(); });
      pending = { form, button, observer, root, screen: driverScreen, journey: currentJourney?.id, controls: new Map() };
      observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });
      lock(root);
      // Original handlers disable the internal button only after their own validation.
      queueMicrotask(() => { if (pending?.button === button && !button.disabled) release(); });
    }, true);
    root.addEventListener("input", event => {
      if (event.target.matches('#driverFinishForm input[name="odometer"]')) {
        const input = event.target;
        const distance = Number(input.value) - Number(currentJourney?.odometer_start || 0);
        root.querySelector("[data-driver-distance]").textContent = input.value && Number.isFinite(distance) && distance >= 0 ? `Percurso informado: ${distance.toLocaleString("pt-BR")} km` : "";
      }
    });
    dockObserver?.disconnect();
    if (typeof ResizeObserver === "function") {
      dockObserver = new ResizeObserver(entries => {
        const height = entries[0]?.target.getBoundingClientRect().height;
        if (height) root.style.setProperty("--driver-dock-height", `${Math.ceil(height)}px`);
      });
      dockObserver.observe(root.querySelector("#driverBottom"));
    }
  }

  renderDriverExperience = function () {
    if (admin) return originalRender();
    const oldForm = document.querySelector("#driverExperience form");
    if (!currentJourney) finishDraft = null;
    else if (oldForm?.id === "driverFinishForm" && !pending) finishDraft = { journey: currentJourney.id, value: oldForm.elements.odometer.value };
    if (oldForm?.id === "driverNewForm" && !pending) {
      driverNewDelivery = {
        neighborhood: oldForm.elements.neighborhood.value,
        address: oldForm.elements.address.value,
        reference: oldForm.elements.reference.value,
        priority: driverDraftPriority,
        mapLink: oldForm.elements.mapLink.value
      };
    }
    if (oldForm?.id === "driverOccurrenceForm" && !pending) driverOccurrenceNote = oldForm.elements.note.value;
    if (currentJourney && window.driverSelectedDeliveryId && !driverStops().some(item => item.id === window.driverSelectedDeliveryId)) delete window.driverSelectedDeliveryId;
    const rootBefore = document.getElementById("driverExperience");
    const sameScreen = rootBefore?.dataset.mobileScreen === driverScreen && rootBefore?.dataset.mobileJourney === String(currentJourney?.id || "");
    const values = sameScreen && oldForm ? Array.from(oldForm.elements).filter(field => field.name && !["radio", "submit"].includes(field.type)).map(field => [field.name, field.value]) : [];
    originalRender();
    const root = document.getElementById("driverExperience");
    if (!root) return;
    root.dataset.mobileScreen = driverScreen;
    root.dataset.mobileJourney = currentJourney?.id || "";
    const form = root.querySelector("form");
    if (form && form.id === oldForm?.id) {
      for (const [name, value] of values) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    }
    if (form?.id === "driverStartForm") {
      const vehicleField = form.elements.vehicle;
      const odometerField = form.elements.odometer;
      let lookupToken = 0;
      const prefillOdometer = async () => {
        if (!vehicleField || !odometerField) return;
        const vehicleId = vehicleField.value;
        const token = ++lookupToken;
        if (!vehicleId) { odometerField.value = ""; odometerField.readOnly = false; odometerField.placeholder = "Selecione o veículo para preencher automaticamente"; odometerField.title = ""; return; }
        odometerField.value = ""; odometerField.readOnly = true; odometerField.placeholder = "Consultando último odômetro no Supabase…";
        try {
          const latest = await window.YupBackend?.getLatestVehicleOdometer?.(vehicleId);
          if (token !== lookupToken || vehicleField.value !== vehicleId) return;
          if (latest && latest.value !== null && latest.value !== undefined && latest.value !== "") {
            odometerField.value = String(latest.value); odometerField.readOnly = true;
            odometerField.placeholder = latest.source === "end" ? "Último odômetro final deste veículo" : "Sem odômetro final; usando o último inicial";
            odometerField.title = latest.source === "end" ? "Valor consultado diretamente no histórico do Supabase." : "Nenhum odômetro final encontrado; usando o último inicial disponível.";
          } else { odometerField.value = ""; odometerField.readOnly = false; odometerField.placeholder = "Sem histórico visível para este veículo — informe o valor"; odometerField.title = "O Supabase não retornou jornadas com odômetro para o veículo selecionado."; }
        } catch (error) {
          if (token !== lookupToken) return;
          console.error("YUP Entregas: erro ao consultar odômetro do veículo", error);
          odometerField.value = ""; odometerField.readOnly = false; odometerField.placeholder = "Não foi possível consultar o histórico — informe o valor"; odometerField.title = error?.message || "Falha ao consultar histórico no Supabase.";
        }
      };
      vehicleField?.addEventListener("change", prefillOdometer);
      vehicleField?.addEventListener("input", prefillOdometer);
      prefillOdometer();
    }
        if (form?.id === "driverFinishForm" && finishDraft?.journey === currentJourney?.id) form.elements.odometer.value = finishDraft.value;
    const bottom = root.querySelector("#driverBottom");
    // Secondary actions live in content; keep the fixed dock small enough for narrow screens.
    bottom.querySelectorAll("button").forEach(button => {
      if (driverScreen === "route" && button.dataset.driverScreen !== "new") button.remove();
      if (driverScreen === "detail" && !["startDelivery", "arriveDelivery", "completeDelivery"].includes(button.dataset.driverAction)) button.remove();
    });
    if (!bottom.children.length) bottom.innerHTML = '<button type="button" class="driver-dock-primary" data-mobile-back>Voltar à rota</button>';
    bottom.querySelector("[data-mobile-back]")?.addEventListener("click", () => { driverScreen = "route"; renderDriverExperience(); });
    if (driverScreen === "summary") {
      const blocked = driverStops().some(delivery => !terminal(delivery));
      const button = bottom.querySelector('[data-driver-submit="driverFinishForm"]');
      if (button) { button.disabled = blocked; button.title = blocked ? "Registre o resultado das entregas pendentes." : ""; }
    }
    if (driverScreen === "start") {
      const button = bottom.querySelector('[form="driverStartForm"]');
      if (button) button.disabled = !currentDriver() || !vehicles.some(item => item.active);
    }
    installGuard(root);
    if (form?.id === "driverFinishForm" && form.elements.odometer.value) form.elements.odometer.dispatchEvent(new Event("input", { bubbles: true }));
    if (pending && (pending.screen !== driverScreen || pending.journey !== currentJourney?.id)) release();
    if (pending) lock(root);
    root.style.setProperty("--driver-dock-height", `${Math.ceil(bottom.getBoundingClientRect().height)}px`);
  };
  renderDriverExperience.yupMobile = true;
  renderDriverExperience();
})();
