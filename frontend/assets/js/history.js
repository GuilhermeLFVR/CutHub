// Histórico de cortes
window.CutHub = window.CutHub || {};

CutHub.getHistoryRecordsForRole = async function getHistoryRecordsForRole() {
  await CutHub.loadCoreData();

  if (CutHub.state.selectedClientId) {
    return CutHub.state.haircuts.filter((record) => Number(record.client_id) === Number(CutHub.state.selectedClientId));
  }

  if (!CutHub.isClient()) return CutHub.state.haircuts;

  const client = await CutHub.findClientForLoggedUser();
  if (!client) return [];

  return CutHub.state.haircuts.filter((record) => Number(record.client_id) === Number(client.id));
};

CutHub.fillHaircutModalSelects = function fillHaircutModalSelects() {
  const fill = (id, items, label) => {
    const select = document.getElementById(id);
    if (!select) return;

    const current = select.value;
    select.innerHTML = `<option value="">Selecione</option>` + (items || []).map((item) => {
      return `<option value="${item.id}">${label(item)}</option>`;
    }).join("");

    if (current && [...select.options].some((option) => option.value === current)) {
      select.value = current;
    }
  };

  fill("haircutClientInput", CutHub.state.clients, (client) => CutHub.safeText(client.name, "Cliente"));
  fill("haircutServiceInput", CutHub.state.services, (service) => CutHub.safeText(service.name, "Serviço"));
  fill("haircutBarberInput", CutHub.state.barbers, (barber) => CutHub.safeText(barber.name, "Barbeiro"));
};

CutHub.openHaircutModal = async function openHaircutModal() {
  await CutHub.loadCoreData();
  CutHub.fillHaircutModalSelects();

  const form = document.getElementById("haircutForm");
  form?.reset();

  const selectedClientId = CutHub.state.selectedClientId;
  if (selectedClientId) {
    const clientInput = document.getElementById("haircutClientInput");
    if (clientInput) clientInput.value = String(selectedClientId);
  }

  const dateInput = document.getElementById("haircutDateInput");
  if (dateInput) dateInput.value = CutHub.todayISO();

  CutHub.show("#haircutModal");
};

CutHub.closeHaircutModal = function closeHaircutModal() {
  CutHub.hide("#haircutModal");
};

CutHub.saveHaircutRecord = async function saveHaircutRecord(event) {
  event.preventDefault();

  const payload = {
    client_id: Number(document.getElementById("haircutClientInput")?.value || 0),
    service_id: Number(document.getElementById("haircutServiceInput")?.value || 0) || null,
    barber_id: Number(document.getElementById("haircutBarberInput")?.value || 0) || null,
    cut_date: document.getElementById("haircutDateInput")?.value || CutHub.todayISO(),
    title: document.getElementById("haircutTitleInput")?.value.trim() || "Corte registrado",
    tools_used: document.getElementById("haircutToolsInput")?.value.trim() || "",
    photo_url: document.getElementById("haircutPhotoInput")?.value.trim() || "",
    notes: document.getElementById("haircutNotesInput")?.value.trim() || "",
  };

  if (!payload.client_id) return CutHub.showToast("Histórico incompleto", "Selecione um cliente.", "error");
  if (!payload.cut_date) return CutHub.showToast("Histórico incompleto", "Informe a data.", "error");

  try {
    await CutHub.post("/haircuts", payload);
    CutHub.closeHaircutModal();
    CutHub.showToast("Histórico salvo", "Registro criado com sucesso.", "success");
    await CutHub.loadCoreData();
    await CutHub.renderHistory();
  } catch (error) {
    CutHub.showToast("Erro ao salvar histórico", error.message || "Não foi possível salvar.", "error");
  }
};

CutHub.renderHistory = async function renderHistory() {
  const section = document.getElementById("section-history");
  if (!section) return;

  let panel = document.getElementById("cuthubUnifiedHistoryPanel");

  if (!panel) {
    const mount = document.getElementById("unifiedHistoryMount") || section;
    panel = document.createElement("section");
    panel.id = "cuthubUnifiedHistoryPanel";
    panel.className = "panel moving-border reveal-up";
    panel.innerHTML = `
      <div class="panel-header panel-header-split">
        <div>
          <span class="panel-eyebrow">Histórico</span>
          <h2 id="unifiedHistoryTitle">Histórico de cortes</h2>
          <p id="unifiedHistoryDescription" class="module-switcher-description">Registros de cortes, fotos e observações.</p>
        </div>
        <button id="unifiedHistoryRefreshButton" class="secondary-button" type="button">Atualizar</button>
      </div>
      <div id="unifiedHistoryStatus" class="cuthub-empty-mini">Carregando histórico...</div>
      <div id="unifiedHistoryList" class="cuthub-history-grid"></div>
    `;

    mount.appendChild(panel);
    document.getElementById("unifiedHistoryRefreshButton")?.addEventListener("click", CutHub.renderHistory);
  }

  const list = document.getElementById("unifiedHistoryList");
  const status = document.getElementById("unifiedHistoryStatus");

  if (list) list.innerHTML = "";
  if (status) status.textContent = "Carregando histórico...";

  const records = await CutHub.getHistoryRecordsForRole();
  records.sort((a, b) => String(b.cut_date || "").localeCompare(String(a.cut_date || "")) || Number(b.id || 0) - Number(a.id || 0));

  const selectedClient = CutHub.state.selectedClientId ? CutHub.findById(CutHub.state.clients, CutHub.state.selectedClientId) : null;

  CutHub.setText("unifiedHistoryTitle", selectedClient ? `Histórico de ${CutHub.safeText(selectedClient.name, "cliente")}` : CutHub.isClient() ? "Meus atendimentos" : "Histórico de cortes");
  CutHub.setText("unifiedHistoryDescription", selectedClient ? "Fotos antes/depois, observações e registros vinculados a este cliente." : CutHub.isClient() ? "Cortes, fotos e observações vinculados ao seu cadastro." : "Registros de cortes, fotos e observações dos clientes.");

  if (status) {
    status.textContent = records.length ? `${records.length} registro${records.length === 1 ? "" : "s"} encontrado${records.length === 1 ? "" : "s"}.` : CutHub.isClient() ? "Você ainda não possui cortes registrados." : "Nenhum corte registrado ainda.";
  }

  if (!list || !records.length) return;

  list.innerHTML = records.map((record) => {
    const client = CutHub.findById(CutHub.state.clients, record.client_id);
    const service = CutHub.findById(CutHub.state.services, record.service_id);
    const barber = CutHub.findById(CutHub.state.barbers, record.barber_id);
    const photo = String(record.photo_url || "").trim();
    const title = CutHub.cleanHistoryText(record.title, service?.name || "Corte");
    const notes = CutHub.cleanHistoryText(record.notes, "Sem observações");
    const date = CutHub.formatDate(record.cut_date);

    return `
      <article class="cuthub-history-card">
        <button class="cuthub-history-photo ${photo ? "" : "placeholder"}" type="button" ${photo ? `style="background-image:url('${photo}')" data-photo="${photo}" data-label="${title} - ${date}"` : "disabled"}>
          ${photo ? "" : "Sem foto"}
        </button>
        <div class="cuthub-history-body">
          <span class="panel-eyebrow">${date}</span>
          <h3>${title}</h3>
          <p>${CutHub.safeText(client?.name, "Cliente removido")} · ${CutHub.safeText(service?.name, "Serviço não definido")} · ${CutHub.safeText(barber?.name, "Barbeiro não definido")}</p>
          <p>${notes}</p>
          ${!CutHub.isClient() ? `
            <div class="cuthub-list-actions cuthub-history-actions">
              <button class="danger-button cuthub-delete-haircut" data-id="${record.id}" type="button">Excluir</button>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }).join("");

  CutHub.$$(".cuthub-history-photo[data-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.openPhotoViewer(button.dataset.photo, button.dataset.label, "Histórico");
    });
  });

  CutHub.$$(".cuthub-delete-haircut").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Excluir este registro de corte?")) return;

      await CutHub.del(`/haircuts/${button.dataset.id}`);
      CutHub.showToast("Histórico removido", "Registro excluído com sucesso.", "success");
      await CutHub.loadCoreData();
      await CutHub.renderHistory();
    });
  });
};

CutHub.bindHistoryEvents = function bindHistoryEvents() {
  document.getElementById("openHaircutModalButton")?.addEventListener("click", CutHub.openHaircutModal);
  document.getElementById("closeHaircutModalButton")?.addEventListener("click", CutHub.closeHaircutModal);
  document.getElementById("cancelHaircutButton")?.addEventListener("click", CutHub.closeHaircutModal);

  const form = document.getElementById("haircutForm");
  if (form && form.dataset.haircutBound !== "true") {
    form.dataset.haircutBound = "true";
    form.addEventListener("submit", CutHub.saveHaircutRecord);
  }
};