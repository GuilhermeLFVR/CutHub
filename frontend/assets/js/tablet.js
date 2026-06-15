/* CutHub tablet.js */

window.CutHub = window.CutHub || {};

CutHub.recognition = {
  stream: null,
  imageData: "",
  result: null,
  appointmentId: null,
  qualityTimer: null,
};

CutHub.normalizeAppointmentStatus = function normalizeAppointmentStatus(status) {
  const clean = String(status || "").toLowerCase().trim();
  if (clean === "em_andamento" || clean === "andamento") return "in_progress";
  if (clean === "concluido" || clean === "concluído") return "completed";
  if (clean === "cancelado") return "cancelled";
  return clean || "scheduled";
};

CutHub.appointmentStatusLabel = function appointmentStatusLabel(status) {
  const map = {
    scheduled: "Agendado",
    in_progress: "Em andamento",
    completed: "Finalizado",
    cancelled: "Cancelado",
  };

  return map[CutHub.normalizeAppointmentStatus(status)] || "Agendado";
};

CutHub.getAppointmentDate = function getAppointmentDate(appointment) {
  return String(appointment.appointment_date || appointment.date || "").slice(0, 10);
};

CutHub.getAppointmentTime = function getAppointmentTime(appointment) {
  const direct = String(appointment.appointment_time || "").slice(0, 5);
  if (direct) return direct;

  const raw = String(appointment.appointment_date || appointment.date || "");
  if (raw.includes("T")) return raw.split("T")[1].slice(0, 5);

  return "--:--";
};

CutHub.updateAppointmentStatus = async function updateAppointmentStatus(appointment, status) {
  if (!appointment?.id) return null;

  return CutHub.put(`/appointments/${appointment.id}`, {
    client_id: Number(appointment.client_id),
    barber_id: Number(appointment.barber_id),
    service_id: Number(appointment.service_id),
    appointment_date: CutHub.getAppointmentDate(appointment),
    appointment_time: CutHub.getAppointmentTime(appointment),
    status,
    notes: appointment.notes || "",
  });
};

CutHub.getTabletFilters = function getTabletFilters() {
  const barberSelect = document.getElementById("tabletBarberFilter");
  const dateInput = document.getElementById("tabletDateFilter");

  if (dateInput && !dateInput.value) {
    dateInput.value = CutHub.todayISO();
  }

  return {
    barberId: barberSelect?.value || "",
    date: dateInput?.value || CutHub.todayISO(),
  };
};


CutHub.tabletLocalISO = function tabletLocalISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

CutHub.tabletParseDate = function tabletParseDate(dateISO) {
  return new Date(`${dateISO || CutHub.tabletLocalISO()}T00:00:00`);
};

CutHub.tabletAddDays = function tabletAddDays(dateISO, amount) {
  const date = CutHub.tabletParseDate(dateISO);
  date.setDate(date.getDate() + amount);
  return CutHub.tabletLocalISO(date);
};

CutHub.ensureTabletCalendarPanel = function ensureTabletCalendarPanel() {
  const list = document.getElementById("tabletAppointmentsList") || document.getElementById("barberTabletAppointmentsList");
  if (!list || document.getElementById("tabletCalendarPanel")) return;

  const panel = document.createElement("section");
  panel.id = "tabletCalendarPanel";
  panel.className = "tablet-calendar-panel";
  panel.innerHTML = `
    <div class="tablet-calendar-head">
      <div>
        <span class="panel-eyebrow">Agenda semanal</span>
        <h3 id="tabletWeekTitle">Semana</h3>
        <p id="tabletSelectedDayLabel" class="module-switcher-description">Atendimentos do dia selecionado.</p>
      </div>
      <div class="tablet-calendar-actions">
        <select id="tabletBarberFilter" class="tablet-barber-select" aria-label="Filtrar barbeiro">
          <option value="">Todos os barbeiros</option>
        </select>
        <input id="tabletDateFilter" class="tablet-date-filter" type="hidden" />
        <button id="tabletCalendarPrev" class="secondary-button" type="button">‹ Semana</button>
        <button id="tabletCalendarToday" class="secondary-button" type="button">Hoje</button>
        <button id="tabletCalendarNext" class="secondary-button" type="button">Semana ›</button>
        <button id="simulateRecognitionButton" class="primary-button" type="button">Reconhecimento facial</button>
      </div>
    </div>
    <div id="tabletWeekStrip" class="tablet-week-strip"></div>
  `;

  list.parentElement?.insertBefore(panel, list);

  document.getElementById("tabletCalendarPrev")?.addEventListener("click", () => {
    const input = document.getElementById("tabletDateFilter");
    if (input) input.value = CutHub.tabletAddDays(input.value || CutHub.tabletLocalISO(), -7);
    CutHub.renderTablet();
  });

  document.getElementById("tabletCalendarNext")?.addEventListener("click", () => {
    const input = document.getElementById("tabletDateFilter");
    if (input) input.value = CutHub.tabletAddDays(input.value || CutHub.tabletLocalISO(), 7);
    CutHub.renderTablet();
  });

  document.getElementById("tabletCalendarToday")?.addEventListener("click", () => {
    const input = document.getElementById("tabletDateFilter");
    if (input) input.value = CutHub.tabletLocalISO();
    CutHub.renderTablet();
  });

  document.getElementById("tabletBarberFilter")?.addEventListener("change", CutHub.renderTablet);
};

CutHub.renderTabletCalendar = function renderTabletCalendar(selectedDate, barberId = "") {
  const strip = document.getElementById("tabletWeekStrip");
  const title = document.getElementById("tabletWeekTitle");
  const label = document.getElementById("tabletSelectedDayLabel");
  if (!strip) return;

  const selectedISO = selectedDate || CutHub.tabletLocalISO();
  const selected = CutHub.tabletParseDate(selectedISO);
  const start = new Date(selected);
  start.setDate(selected.getDate() - selected.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  if (title) {
    title.textContent = `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }

  if (label) {
    label.textContent = selected.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  const today = CutHub.tabletLocalISO();
  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + index);
    const dateISO = CutHub.tabletLocalISO(dayDate);
    const dayAppointments = (CutHub.state.appointments || [])
      .filter((item) => CutHub.getAppointmentDate(item) === dateISO)
      .filter((item) => !barberId || String(item.barber_id) === String(barberId));
    const activeCount = dayAppointments.filter((item) => !["completed", "cancelled"].includes(CutHub.normalizeAppointmentStatus(item.status))).length;
    const doneCount = dayAppointments.filter((item) => CutHub.normalizeAppointmentStatus(item.status) === "completed").length;

    days.push(`
      <button
        class="tablet-day-chip ${dateISO === selectedISO ? "active" : ""} ${dateISO === today ? "today" : ""}"
        data-tablet-date="${dateISO}"
        type="button"
      >
        <span>${dayDate.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
        <strong>${String(dayDate.getDate()).padStart(2, "0")}</strong>
        <small>${activeCount ? `${activeCount} pendente${activeCount === 1 ? "" : "s"}` : "Sem pendências"}</small>
        ${doneCount ? `<em>${doneCount} finalizado${doneCount === 1 ? "" : "s"}</em>` : ""}
      </button>
    `);
  }

  strip.innerHTML = days.join("");

  strip.querySelectorAll("[data-tablet-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("tabletDateFilter");
      if (input) input.value = button.dataset.tabletDate;
      CutHub.renderTablet();
    });
  });
};

CutHub.calculateRecognitionQuality = function calculateRecognitionQuality(video) {
  if (!video || !video.videoWidth) {
    return { brightness: 0, sharpness: 0, score: 0, label: "Aguardando câmera" };
  }

  const canvas = document.createElement("canvas");
  const width = 180;
  const height = Math.round((video.videoHeight / video.videoWidth) * width);
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);

  let totalBrightness = 0;
  let contrastTotal = 0;
  let previous = null;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;

    totalBrightness += brightness;

    if (previous !== null) {
      contrastTotal += Math.abs(brightness - previous);
    }

    previous = brightness;
  }

  const samples = data.length / 16;
  const brightnessAvg = totalBrightness / samples;
  const sharpness = Math.min(100, (contrastTotal / samples) * 2.6);
  const brightnessScore = Math.max(0, Math.min(100, 100 - Math.abs(145 - brightnessAvg) * 1.2));
  const score = Math.round((brightnessScore * 0.48) + (sharpness * 0.52));

  let label = "Rosto pronto para análise";
  if (score < 35) label = "Imagem ruim";
  else if (score < 60) label = "Melhore luz/posição";
  else if (score < 78) label = "Captura aceitável";

  return {
    brightness: Math.round(brightnessScore),
    sharpness: Math.round(sharpness),
    score,
    label,
  };
};

CutHub.renderTablet = async function renderTablet() {
  await CutHub.loadCoreData();
  CutHub.ensureTabletCalendarPanel();

  const barberSelect = document.getElementById("tabletBarberFilter");
  if (barberSelect) {
    const current = barberSelect.value;
    barberSelect.innerHTML = `<option value="">Todos os barbeiros</option>` + CutHub.state.barbers.map((barber) => `
      <option value="${barber.id}">${barber.name}</option>
    `).join("");
    if (current) barberSelect.value = current;
  }

  const dateInput = document.getElementById("tabletDateFilter");
  if (dateInput && !dateInput.value) dateInput.value = CutHub.todayISO();

  const { barberId, date } = CutHub.getTabletFilters();

  CutHub.renderTabletCalendar(date, barberId);

  const appointments = CutHub.state.appointments
    .filter((item) => CutHub.getAppointmentDate(item) === date)
    .filter((item) => !barberId || String(item.barber_id) === String(barberId))
    .filter((item) => CutHub.normalizeAppointmentStatus(item.status) !== "cancelled")
    .sort((a, b) => CutHub.getAppointmentTime(a).localeCompare(CutHub.getAppointmentTime(b)));

  const nextAppointment = appointments.find((item) => !["completed", "cancelled"].includes(CutHub.normalizeAppointmentStatus(item.status))) || null;

  CutHub.renderTabletHero(nextAppointment);
  CutHub.renderTabletList(appointments);
  CutHub.bindTabletDynamicActions();

  const recognitionButton = document.getElementById("simulateRecognitionButton");
if (recognitionButton) {
  recognitionButton.classList.remove("hidden");
  recognitionButton.textContent = "Reconhecimento facial";

  if (recognitionButton.dataset.realRecognitionBound !== "true") {
    recognitionButton.dataset.realRecognitionBound = "true";
    recognitionButton.addEventListener("click", () => CutHub.openRecognitionModal());
  }
}
};

CutHub.renderTabletHero = function renderTabletHero(appointment) {
  const client = appointment ? CutHub.findById(CutHub.state.clients, appointment.client_id) : null;
  const service = appointment ? CutHub.findById(CutHub.state.services, appointment.service_id) : null;
  const barber = appointment ? CutHub.findById(CutHub.state.barbers, appointment.barber_id) : null;
  const tools = String(service?.tools || "").trim();

  CutHub.setText("tabletNextClientName", client?.name || "Sem cliente na fila");
  CutHub.setText(
    "tabletNextClientMeta",
    appointment
      ? `${CutHub.safeText(service?.name, "Serviço")} · ${CutHub.safeText(barber?.name, "Barbeiro")} · ${CutHub.appointmentStatusLabel(appointment.status)}`
      : "Selecione um barbeiro e data para visualizar a agenda."
  );
  CutHub.setText("tabletNextTime", appointment ? CutHub.getAppointmentTime(appointment) : "--:--");
  CutHub.setText("tabletServiceName", service?.name || "-");
  CutHub.setText("tabletToolsList", tools || "Ferramentas padrão da barbearia");
  CutHub.setText("tabletClientNotes", client?.notes || client?.preferred_cut || "Sem observações cadastradas.");
};

CutHub.renderTabletList = function renderTabletList(appointments) {
  const list = document.getElementById("tabletAppointmentsList") || document.getElementById("barberTabletAppointmentsList");
  if (!list) return;

  list.innerHTML = appointments.length ? appointments.map((appointment, index) => {
    const client = CutHub.findById(CutHub.state.clients, appointment.client_id);
    const service = CutHub.findById(CutHub.state.services, appointment.service_id);
    const barber = CutHub.findById(CutHub.state.barbers, appointment.barber_id);
    const status = CutHub.normalizeAppointmentStatus(appointment.status);
    const isNext = index === appointments.findIndex((item) => !["completed", "cancelled"].includes(CutHub.normalizeAppointmentStatus(item.status)));
    const tools = String(service?.tools || "")
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);

    return `
      <article class="cuthub-tablet-card status-${status} ${isNext ? "next" : ""}">
        <div>
          <span class="panel-eyebrow">${isNext ? "Próximo atendimento" : CutHub.appointmentStatusLabel(status)}</span>
          <h3>${CutHub.getAppointmentTime(appointment)} · ${CutHub.safeText(client?.name, "Cliente")}</h3>
          <p>${CutHub.safeText(service?.name, "Serviço")} · ${CutHub.safeText(barber?.name, "Barbeiro")}</p>
          <div class="cuthub-tool-tags">
            ${tools.length ? tools.map((tool) => `<span>${tool}</span>`).join("") : "<span>Ferramentas padrão</span>"}
          </div>
        </div>
        <div class="cuthub-list-actions">
          ${status === "scheduled" ? `<button class="secondary-button cuthub-recognize-appointment" data-id="${appointment.id}" type="button">Reconhecer</button>` : ""}
          ${status === "scheduled" ? `<button class="secondary-button cuthub-start-appointment" data-id="${appointment.id}" type="button">Iniciar</button>` : ""}
          ${status !== "completed" ? `<button class="primary-button cuthub-finish-appointment" data-id="${appointment.id}" type="button">Finalizar</button>` : `<span class="tablet-completed-label">Finalizado</span>`}
        </div>
      </article>
    `;
  }).join("") : `<div class="cuthub-empty-mini">Nenhum atendimento para esse filtro.</div>`;
};

CutHub.bindTabletDynamicActions = function bindTabletDynamicActions() {
  document.querySelectorAll(".cuthub-recognize-appointment").forEach((button) => {
    button.addEventListener("click", async () => {
      await CutHub.openRecognitionModal(Number(button.dataset.id));
    });
  });

  document.querySelectorAll(".cuthub-start-appointment").forEach((button) => {
    button.addEventListener("click", async () => {
      const appointment = CutHub.findById(CutHub.state.appointments, button.dataset.id);
      if (!appointment) return;
      await CutHub.updateAppointmentStatus(appointment, "in_progress");
      CutHub.showToast("Atendimento iniciado", "Status atualizado para em andamento.", "success");
      await CutHub.refreshAppointments();
      await CutHub.renderTablet();
    });
  });

  document.querySelectorAll(".cuthub-finish-appointment").forEach((button) => {
    button.addEventListener("click", async () => {
      const appointment = CutHub.findById(CutHub.state.appointments, button.dataset.id);
      if (!appointment) return;
      await CutHub.openAfterPhotoModal(appointment);
    });
  });
};


CutHub.createHaircutPhotoRecord = async function createHaircutPhotoRecord(appointment, photoUrl, photoType = "ANTES") {
  if (!appointment?.client_id || !photoUrl) return null;

  const service = CutHub.findById(CutHub.state.services, appointment.service_id);
  const typeLabel = photoType === "DEPOIS" ? "Depois" : "Antes";
  const notes = photoType === "DEPOIS"
    ? "Foto depois do atendimento."
    : "Foto antes do atendimento capturada automaticamente após reconhecimento facial.";

  const record = await CutHub.post("/haircuts", {
    client_id: Number(appointment.client_id),
    service_id: appointment.service_id ? Number(appointment.service_id) : null,
    barber_id: appointment.barber_id ? Number(appointment.barber_id) : null,
    cut_date: CutHub.getAppointmentDate(appointment) || CutHub.todayISO(),
    title: `${typeLabel} · ${CutHub.safeText(service?.name, "Corte")}`,
    notes,
    photo_url: photoUrl,
    tools_used: String(service?.tools || ""),
  });

  if (record?.id) {
    CutHub.state.haircuts = [
      record,
      ...(CutHub.state.haircuts || []).filter((item) => Number(item.id) !== Number(record.id)),
    ];
  }

  await CutHub.refreshHaircuts?.();
  await CutHub.renderClients?.();
  if (CutHub.state.activeSection === "history") {
    await CutHub.renderHistory?.();
  }

  return record;
};

CutHub.captureBeforeFromRecognition = async function captureBeforeFromRecognition(appointment) {
  if (!appointment || !CutHub.recognition.imageData) return null;

  try {
    const record = await CutHub.createHaircutPhotoRecord(appointment, CutHub.recognition.imageData, "ANTES");
    CutHub.state.capturedBeforePhoto = CutHub.recognition.imageData;
    CutHub.showToast("Foto antes registrada", "Captura antes salva automaticamente no histórico.", "success");
    return record;
  } catch (error) {
    CutHub.showToast("Foto antes não salva", error.message || "Não foi possível salvar a foto antes.", "error");
    return null;
  }
};

CutHub.ensureAfterPhotoModal = function ensureAfterPhotoModal() {
  if (document.getElementById("afterPhotoModal")) return;

  const modal = document.createElement("div");
  modal.id = "afterPhotoModal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-content moving-border cuthub-after-photo-modal">
      <div class="modal-header">
        <div>
          <span class="panel-eyebrow">Finalização</span>
          <h2>Registrar foto depois</h2>
          <p id="afterPhotoClientName" class="module-switcher-description">Capture o resultado final antes de concluir.</p>
        </div>
        <button id="closeAfterPhotoModalButton" class="icon-button" type="button">×</button>
      </div>

      <div class="after-photo-grid">
        <section class="recognition-camera-stage">
          <div class="recognition-camera-frame after-photo-frame">
            <video id="afterPhotoVideo" autoplay playsinline muted></video>
            <canvas id="afterPhotoCanvas" class="hidden"></canvas>
            <div class="face-scan-overlay recognition-overlay">
              <div class="face-target-frame"></div>
              <span class="recognition-corner corner-a"></span>
              <span class="recognition-corner corner-b"></span>
              <span class="recognition-corner corner-c"></span>
              <span class="recognition-corner corner-d"></span>
            </div>
          </div>
        </section>

        <aside class="after-photo-preview-panel">
          <span class="panel-eyebrow">Prévia</span>
          <div id="afterPhotoPreview" class="after-photo-preview">Sem foto capturada</div>
          <p class="module-switcher-description">Ao concluir, o atendimento fica verde/finalizado e a foto depois entra no histórico.</p>
        </aside>
      </div>

      <div class="cuthub-recognition-actions">
        <button id="startAfterPhotoCameraButton" class="secondary-button" type="button">Abrir câmera</button>
        <button id="captureAfterPhotoButton" class="secondary-button" type="button">Capturar depois</button>
        <button id="confirmAfterPhotoFinishButton" class="primary-button" type="button">Concluir atendimento</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("closeAfterPhotoModalButton")?.addEventListener("click", CutHub.closeAfterPhotoModal);
  document.getElementById("startAfterPhotoCameraButton")?.addEventListener("click", CutHub.startAfterPhotoCamera);
  document.getElementById("captureAfterPhotoButton")?.addEventListener("click", CutHub.captureAfterPhotoFrame);
  document.getElementById("confirmAfterPhotoFinishButton")?.addEventListener("click", CutHub.confirmAfterPhotoFinish);
};

CutHub.openAfterPhotoModal = async function openAfterPhotoModal(appointment) {
  CutHub.ensureAfterPhotoModal();
  CutHub.afterPhoto = CutHub.afterPhoto || { appointment: null, stream: null, imageData: "" };
  CutHub.afterPhoto.appointment = appointment;
  CutHub.afterPhoto.imageData = "";

  const client = CutHub.findById(CutHub.state.clients, appointment.client_id);
  CutHub.setText("afterPhotoClientName", `${CutHub.safeText(client?.name, "Cliente")} · ${CutHub.getAppointmentTime(appointment)}`);

  const preview = document.getElementById("afterPhotoPreview");
  if (preview) {
    preview.classList.remove("has-image");
    preview.style.backgroundImage = "";
    preview.textContent = "Sem foto capturada";
  }

  document.getElementById("afterPhotoModal")?.classList.remove("hidden");

  try {
    await CutHub.startAfterPhotoCamera();
  } catch (error) {
    CutHub.showToast("Câmera indisponível", error.message || "Não foi possível abrir a câmera.", "error");
  }
};

CutHub.startAfterPhotoCamera = async function startAfterPhotoCamera() {
  const video = document.getElementById("afterPhotoVideo");

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador não liberou acesso à câmera.");
  }

  CutHub.stopAfterPhotoCamera();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  CutHub.afterPhoto = CutHub.afterPhoto || { appointment: null, stream: null, imageData: "" };
  CutHub.afterPhoto.stream = stream;

  if (video) {
    video.srcObject = stream;
    await video.play();
  }
};

CutHub.stopAfterPhotoCamera = function stopAfterPhotoCamera() {
  if (CutHub.afterPhoto?.stream) {
    CutHub.afterPhoto.stream.getTracks().forEach((track) => track.stop());
    CutHub.afterPhoto.stream = null;
  }
};

CutHub.closeAfterPhotoModal = function closeAfterPhotoModal() {
  CutHub.stopAfterPhotoCamera();
  document.getElementById("afterPhotoModal")?.classList.add("hidden");
};

CutHub.captureAfterPhotoFrame = function captureAfterPhotoFrame() {
  const video = document.getElementById("afterPhotoVideo");
  const canvas = document.getElementById("afterPhotoCanvas");
  const preview = document.getElementById("afterPhotoPreview");

  if (!video || !canvas || !video.videoWidth) {
    CutHub.showToast("Câmera sem imagem", "Espere a câmera carregar antes de capturar.", "error");
    return "";
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = canvas.toDataURL("image/jpeg", 0.92);
  CutHub.afterPhoto = CutHub.afterPhoto || { appointment: null, stream: null, imageData: "" };
  CutHub.afterPhoto.imageData = imageData;
  CutHub.state.capturedAfterPhoto = imageData;

  if (preview) {
    preview.classList.add("has-image");
    preview.style.backgroundImage = `url("${imageData}")`;
    preview.textContent = "";
  }

  CutHub.showToast("Foto depois capturada", "Prévia pronta para finalizar.", "success");
  return imageData;
};

CutHub.confirmAfterPhotoFinish = async function confirmAfterPhotoFinish() {
  const appointment = CutHub.afterPhoto?.appointment;
  if (!appointment) return;

  const button = document.getElementById("confirmAfterPhotoFinishButton");
  const originalText = button?.textContent || "Concluir atendimento";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Concluindo...";
    }

    const imageData = CutHub.afterPhoto?.imageData || CutHub.captureAfterPhotoFrame();
    if (imageData) {
      await CutHub.createHaircutPhotoRecord(appointment, imageData, "DEPOIS");
    }

    await CutHub.updateAppointmentStatus(appointment, "completed");
    CutHub.showToast("Atendimento finalizado", "Foto depois salva e status atualizado.", "success");
    CutHub.closeAfterPhotoModal();
    await CutHub.refreshAppointments();
    await CutHub.refreshHaircuts?.();
    await CutHub.renderTablet();
    await CutHub.renderHistory?.();
  } catch (error) {
    CutHub.showToast("Erro ao finalizar", error.message || "Não foi possível finalizar o atendimento.", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
};

CutHub.ensureRecognitionModal = function ensureRecognitionModal() {
  if (document.getElementById("recognitionModal")) return;

  const modal = document.createElement("div");
  modal.id = "recognitionModal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-content moving-border cuthub-recognition-modal recognition-premium-modal">
      <div class="modal-header">
        <div>
          <span class="panel-eyebrow">OpenCV facial engine</span>
          <h2>Reconhecimento facial</h2>
          <p class="module-switcher-description">Capture o rosto pela webcam, analise qualidade e compare com clientes cadastrados.</p>
        </div>
        <button id="closeRecognitionModalButton" class="icon-button" type="button">×</button>
      </div>

      <div class="recognition-premium-grid">
        <section class="recognition-camera-stage">
          <div class="recognition-camera-frame">
            <video id="recognitionVideo" autoplay playsinline muted></video>
            <canvas id="recognitionCanvas" class="hidden"></canvas>
            <div class="face-scan-overlay recognition-overlay">
              <div class="face-target-frame"></div>
              <span class="face-scan-line"></span>
              <span class="recognition-corner corner-a"></span>
              <span class="recognition-corner corner-b"></span>
              <span class="recognition-corner corner-c"></span>
              <span class="recognition-corner corner-d"></span>
            </div>
          </div>

          <div class="recognition-quality-panel">
            <div id="recognitionQualityRing" class="face-quality-ring" data-quality="mid">
              <div>
                <strong id="recognitionQualityScore">0%</strong>
                <span id="recognitionQualityLabel">Aguardando câmera</span>
              </div>
            </div>

            <div class="face-quality-bars">
              <div>
                <span>Iluminação</span>
                <div class="face-bar"><i id="recognitionBrightnessBar"></i></div>
              </div>
              <div>
                <span>Nitidez</span>
                <div class="face-bar"><i id="recognitionSharpnessBar"></i></div>
              </div>
            </div>
          </div>
        </section>

        <aside class="recognition-result-panel">
          <div class="recognition-result-empty" id="recognitionEmptyState">
            <span class="recognition-orb"></span>
            <h3 id="recognitionClientName">Aguardando análise</h3>
            <p id="recognitionMeta">Capture um frame e envie para o OpenCV.</p>
          </div>

          <div id="recognizedClientCard" class="recognized-client-card hidden"></div>

          <div id="recognitionScoreBox" class="recognition-score-box hidden"></div>
          <div id="recognitionCandidates" class="recognition-candidates hidden"></div>
        </aside>
      </div>

      <div class="cuthub-recognition-actions">
        <button id="startRecognitionCameraButton" class="secondary-button" type="button">Abrir câmera</button>
        <button id="captureRecognitionButton" class="secondary-button" type="button">Capturar frame</button>
        <button id="identifyRecognitionClientButton" class="primary-button" type="button">Analisar com OpenCV</button>
        <button id="startRecognizedAppointmentButton" class="primary-button" type="button" disabled>Iniciar atendimento</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("closeRecognitionModalButton")?.addEventListener("click", CutHub.closeRecognitionModal);
  document.getElementById("startRecognitionCameraButton")?.addEventListener("click", CutHub.startRecognitionCamera);
  document.getElementById("captureRecognitionButton")?.addEventListener("click", CutHub.captureRecognitionFrame);
  document.getElementById("identifyRecognitionClientButton")?.addEventListener("click", CutHub.identifyRecognitionClient);
  document.getElementById("startRecognizedAppointmentButton")?.addEventListener("click", CutHub.startRecognizedAppointment);
};

CutHub.openRecognitionModal = async function openRecognitionModal(appointmentId = null) {
  CutHub.ensureRecognitionModal();

  CutHub.recognition.imageData = "";
  CutHub.recognition.result = null;
  CutHub.recognition.appointmentId = appointmentId;

  CutHub.setText("recognitionClientName", "Aguardando análise");
  CutHub.setText("recognitionMeta", "Capture um frame e envie para o OpenCV.");
  document.getElementById("recognizedClientCard")?.classList.add("hidden");
  document.getElementById("recognitionScoreBox")?.classList.add("hidden");
  document.getElementById("recognitionCandidates")?.classList.add("hidden");
  document.getElementById("recognitionEmptyState")?.classList.remove("hidden");

  const startButton = document.getElementById("startRecognizedAppointmentButton");
  if (startButton) startButton.disabled = true;

  document.getElementById("recognitionModal")?.classList.remove("hidden");

  try {
    await CutHub.startRecognitionCamera();
  } catch (error) {
    CutHub.showToast("Câmera indisponível", error.message, "error");
  }
};

CutHub.renderRecognitionQuality = function renderRecognitionQuality() {
  const video = document.getElementById("recognitionVideo");
  const quality = CutHub.calculateRecognitionQuality(video);

  const ring = document.getElementById("recognitionQualityRing");
  const score = document.getElementById("recognitionQualityScore");
  const label = document.getElementById("recognitionQualityLabel");
  const brightness = document.getElementById("recognitionBrightnessBar");
  const sharpness = document.getElementById("recognitionSharpnessBar");

  if (ring) {
    ring.style.setProperty("--quality", `${quality.score}%`);
    ring.dataset.quality = quality.score >= 70 ? "good" : quality.score >= 45 ? "mid" : "bad";
  }

  if (score) score.textContent = `${quality.score}%`;
  if (label) label.textContent = quality.label;
  if (brightness) brightness.style.width = `${quality.brightness}%`;
  if (sharpness) sharpness.style.width = `${quality.sharpness}%`;
};

CutHub.startRecognitionCamera = async function startRecognitionCamera() {
  const video = document.getElementById("recognitionVideo");

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador não liberou acesso à câmera.");
  }

  CutHub.stopRecognitionCamera();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  CutHub.recognition.stream = stream;

  if (video) {
    video.srcObject = stream;
    await video.play();
  }

  clearInterval(CutHub.recognition.qualityTimer);
  CutHub.recognition.qualityTimer = setInterval(CutHub.renderRecognitionQuality, 650);

  CutHub.setText("recognitionMeta", "Câmera ativa. Centralize o rosto dentro do marcador.");
};

CutHub.stopRecognitionCamera = function stopRecognitionCamera() {
  clearInterval(CutHub.recognition.qualityTimer);
  CutHub.recognition.qualityTimer = null;

  if (CutHub.recognition.stream) {
    CutHub.recognition.stream.getTracks().forEach((track) => track.stop());
    CutHub.recognition.stream = null;
  }
};

CutHub.closeRecognitionModal = function closeRecognitionModal() {
  CutHub.stopRecognitionCamera();
  document.getElementById("recognitionModal")?.classList.add("hidden");
};

CutHub.captureRecognitionFrame = function captureRecognitionFrame() {
  const video = document.getElementById("recognitionVideo");
  const canvas = document.getElementById("recognitionCanvas");

  if (!video || !canvas || !video.videoWidth) {
    CutHub.showToast("Câmera sem imagem", "Espere a câmera carregar antes de capturar.", "error");
    return;
  }

  const quality = CutHub.calculateRecognitionQuality(video);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  CutHub.recognition.imageData = canvas.toDataURL("image/jpeg", 0.92);
  CutHub.setText("recognitionMeta", `Frame capturado. Qualidade local: ${quality.score}%. Agora analise com OpenCV.`);
  CutHub.showToast("Frame capturado", "Imagem pronta para análise facial.", "success");
};

CutHub.identifyRecognitionClient = async function identifyRecognitionClient() {
  if (!CutHub.recognition.imageData) {
    CutHub.captureRecognitionFrame();
  }

  if (!CutHub.recognition.imageData) return;

  const { date } = CutHub.getTabletFilters();
  const button = document.getElementById("identifyRecognitionClientButton");
  const originalText = button?.textContent || "Analisar com OpenCV";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Analisando...";
    }

    CutHub.setText("recognitionMeta", "OpenCV processando frame, extraindo rosto e comparando com clientes...");

    const result = await CutHub.post("/recognition/identify", {
      image_data: CutHub.recognition.imageData,
      appointment_date: date,
    });

    CutHub.recognition.result = result;
    await CutHub.renderRecognitionResult(result);
  } catch (error) {
    CutHub.showToast("Reconhecimento falhou", error.message, "error");
    CutHub.setText("recognitionClientName", "Não reconhecido");
    CutHub.setText("recognitionMeta", error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
};

CutHub.renderRecognizedClientCard = function renderRecognizedClientCard(result) {
  const card = document.getElementById("recognizedClientCard");
  const client = result.client;
  const appointment = result.appointment;
  if (!card || !client) return;

  const haircuts = CutHub.getClientHaircuts ? CutHub.getClientHaircuts(client.id) : CutHub.state.haircuts.filter((item) => Number(item.client_id) === Number(client.id));
  const last = haircuts?.[0];
  const service = appointment ? CutHub.findById(CutHub.state.services, appointment.service_id) : null;
  const barber = appointment ? CutHub.findById(CutHub.state.barbers, appointment.barber_id) : null;
  const tools = String(service?.tools || "").split(",").map((item) => item.trim()).filter(Boolean);

  card.classList.remove("hidden");
  document.getElementById("recognitionEmptyState")?.classList.add("hidden");

  card.innerHTML = `
    <div class="recognized-client-header">
      <div class="recognized-avatar">
        ${client.face_image_url ? `<img src="${client.face_image_url}" alt="${client.name}" />` : `<span>${String(client.name || "C").slice(0, 1).toUpperCase()}</span>`}
      </div>
      <div>
        <span class="panel-eyebrow">Cliente reconhecido</span>
        <h3>${CutHub.safeText(client.name, "Cliente")}</h3>
        <p>${CutHub.safeText(client.phone, "Sem telefone")} · ${CutHub.safeText(client.email, "Sem email")}</p>
      </div>
    </div>

    <div class="recognized-client-stats">
      <article>
        <span>Último corte</span>
        <strong>${last ? CutHub.cleanHistoryText(last.title, "Corte registrado") : "Sem histórico"}</strong>
      </article>
      <article>
        <span>Preferência</span>
        <strong>${CutHub.safeText(client.preferred_cut || client.notes, "Não informada")}</strong>
      </article>
      <article>
        <span>Agendamento</span>
        <strong>${appointment ? `${CutHub.getAppointmentTime(appointment)} · ${CutHub.safeText(service?.name, "Serviço")}` : "Sem agenda hoje"}</strong>
      </article>
      <article>
        <span>Barbeiro</span>
        <strong>${CutHub.safeText(barber?.name, "Não definido")}</strong>
      </article>
    </div>

    <div class="recognized-tools">
      <span class="panel-eyebrow">Ferramentas sugeridas</span>
      <div class="cuthub-tool-tags">
        ${tools.length ? tools.map((tool) => `<span>${tool}</span>`).join("") : "<span>Ferramentas padrão</span>"}
      </div>
    </div>
  `;
};

CutHub.renderRecognitionResult = async function renderRecognitionResult(result) {
  const client = result.client;
  const appointment = result.appointment;
  const score = Number(result.score || 0);
  const engine = result.engine || "agenda";
  const confidence = score ? `${Math.round(score * 100)}%` : "baixa";

  CutHub.setText("recognitionClientName", client?.name || "Cliente encontrado");
  CutHub.setText(
    "recognitionMeta",
    `${result.message || "Resultado encontrado."} Motor: ${engine}. Confiança: ${confidence}.`
  );

  CutHub.renderRecognizedClientCard(result);

  const scoreBox = document.getElementById("recognitionScoreBox");
  if (scoreBox) {
    scoreBox.classList.remove("hidden");
    scoreBox.dataset.confidence = result.low_confidence ? "low" : "high";
    scoreBox.innerHTML = `
      <strong>${confidence}</strong>
      <span>${result.low_confidence ? "Confiança baixa, confirme manualmente." : "Confiança boa para iniciar atendimento."}</span>
      <small>Engine: ${engine}</small>
    `;
  }

  const candidatesBox = document.getElementById("recognitionCandidates");
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];

  if (candidatesBox && candidates.length > 1) {
    candidatesBox.classList.remove("hidden");
    candidatesBox.innerHTML = `
      <span class="panel-eyebrow">Candidatos próximos</span>
      ${candidates.map((candidate) => `
        <button class="recognition-candidate-button" type="button" data-client-id="${candidate.client?.id}">
          ${CutHub.safeText(candidate.client?.name, "Cliente")}
          <small>${candidate.score ? `${Math.round(Number(candidate.score) * 100)}%` : "agenda"}</small>
        </button>
      `).join("")}
    `;

    candidatesBox.querySelectorAll("[data-client-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const candidate = candidates.find((item) => Number(item.client?.id) === Number(button.dataset.clientId));
        if (!candidate) return;
        CutHub.recognition.result = {
          ...result,
          client: candidate.client,
          appointment: candidate.appointment || null,
          score: candidate.score || 0,
          low_confidence: false,
          message: "Cliente confirmado manualmente pelo barbeiro.",
        };
        CutHub.renderRecognitionResult(CutHub.recognition.result);
      });
    });
  }

  const startButton = document.getElementById("startRecognizedAppointmentButton");
  if (startButton) {
    startButton.disabled = !appointment || ["completed", "cancelled", "in_progress"].includes(CutHub.normalizeAppointmentStatus(appointment.status));
  }
};

CutHub.startRecognizedAppointment = async function startRecognizedAppointment() {
  const appointment = CutHub.recognition.result?.appointment;

  if (!appointment) {
    CutHub.showToast("Sem agendamento", "Cliente reconhecido, mas sem agendamento ativo para iniciar.", "error");
    return;
  }

  await CutHub.captureBeforeFromRecognition(appointment);
  await CutHub.updateAppointmentStatus(appointment, "in_progress");
  CutHub.showToast("Cliente identificado", "Atendimento iniciado automaticamente.", "success");
  CutHub.closeRecognitionModal();
  await CutHub.refreshAppointments();
  await CutHub.refreshHaircuts?.();
  await CutHub.renderTablet();
};

CutHub.bindTabletEvents = function bindTabletEvents() {
  document.getElementById("refreshTabletButton")?.addEventListener("click", CutHub.renderTablet);
  document.getElementById("tabletBarberFilter")?.addEventListener("change", CutHub.renderTablet);
  document.getElementById("tabletDateFilter")?.addEventListener("change", CutHub.renderTablet);

  const simulate = document.getElementById("simulateRecognitionButton");
  if (simulate && simulate.dataset.realRecognitionBound !== "true") {
    simulate.dataset.realRecognitionBound = "true";
    simulate.addEventListener("click", () => CutHub.openRecognitionModal());
  }
};
