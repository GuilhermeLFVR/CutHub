// Disponibilidade dos barbeiros
window.CutHub = window.CutHub || {};

CutHub.availabilitySlots = [
  "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00",
];

CutHub.dayNameMap = {
  0: "Segunda",
  1: "Terça",
  2: "Quarta",
  3: "Quinta",
  4: "Sexta",
  5: "Sábado",
  6: "Domingo",
};

CutHub.normalizeWeekday = function normalizeWeekday(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("seg") || text === "monday") return 0;
  if (text.includes("ter") || text === "tuesday") return 1;
  if (text.includes("qua") || text === "wednesday") return 2;
  if (text.includes("qui") || text === "thursday") return 3;
  if (text.includes("sex") || text === "friday") return 4;
  if (text.includes("sab") || text.includes("sáb") || text === "saturday") return 5;
  if (text.includes("dom") || text === "sunday") return 6;

  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
};

CutHub.availabilityErrorText = function availabilityErrorText(error) {
  if (!error) return "Erro desconhecido.";
  if (typeof error === "string") return error;
  if (error.message && error.message !== "[object Object]") return error.message;
  if (error.detail && typeof error.detail === "string") return error.detail;
  if (Array.isArray(error.detail)) return error.detail.map((item) => item.msg || JSON.stringify(item)).join(" | ");

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

CutHub.fillAvailabilityBarbers = function fillAvailabilityBarbers() {
  const select = document.getElementById("availabilityBarberSelect");
  if (!select) return;

  const current = select.value;
  const barbers = CutHub.state.barbers || [];

  select.innerHTML = `<option value="">Selecione</option>` + barbers.map((barber) => {
    return `<option value="${barber.id}">${CutHub.safeText(barber.name, "Barbeiro")}</option>`;
  }).join("");

  if (current && [...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
};

CutHub.ensureAvailabilityTimeSelects = function ensureAvailabilityTimeSelects() {
  const startInput = document.getElementById("availabilityStartInput");
  const endInput = document.getElementById("availabilityEndInput");

  [startInput, endInput].forEach((input) => {
    if (!input || input.dataset.availabilitySelectApplied === "true") return;

    input.dataset.availabilitySelectApplied = "true";
    input.classList.add("availability-native-time-hidden");
    input.type = "hidden";

    const select = document.createElement("select");
    select.className = "availability-time-select";
    select.innerHTML = `<option value="">Selecione</option>` + CutHub.availabilitySlots.map((slot) => {
      return `<option value="${slot}">${slot}</option>`;
    }).join("");
    select.value = input.value || "";

    select.addEventListener("change", () => {
      input.value = select.value;
    });

    input.insertAdjacentElement("afterend", select);
  });
};

CutHub.getAvailabilityPayload = function getAvailabilityPayload() {
  return {
    barber_id: Number(document.getElementById("availabilityBarberSelect")?.value || 0),
    weekday: CutHub.normalizeWeekday(document.getElementById("availabilityDayInput")?.value || 0),
    start_time: document.getElementById("availabilityStartInput")?.value || "",
    end_time: document.getElementById("availabilityEndInput")?.value || "",
    is_active: true,
  };
};

CutHub.loadAvailabilityData = async function loadAvailabilityData() {
  await CutHub.loadCoreData?.();
  CutHub.state.availability = await CutHub.get("/availability").catch(() => []);
};

CutHub.renderAvailabilityCards = function renderAvailabilityCards() {
  const list = document.getElementById("availabilityList");
  if (!list) return;

  const items = CutHub.state.availability || [];

  if (!items.length) {
    list.innerHTML = `<div class="cuthub-empty-mini">Nenhum horário cadastrado ainda.</div>`;
    return;
  }

  list.innerHTML = items.map((item) => {
    const barber = CutHub.findById(CutHub.state.barbers, item.barber_id);
    const weekday = CutHub.normalizeWeekday(item.weekday);

    return `
      <article class="cuthub-mini-card">
        <strong>${CutHub.safeText(barber?.name, "Barbeiro")}</strong>
        <span>${CutHub.dayNameMap[weekday] || "Dia"} · ${item.start_time || "--:--"} às ${item.end_time || "--:--"}</span>
        <small>${item.is_active === false ? "Inativo" : "Disponível"}</small>
      </article>
    `;
  }).join("");
};

CutHub.renderAvailability = async function renderAvailability() {
  await CutHub.loadAvailabilityData();
  CutHub.fillAvailabilityBarbers();
  CutHub.ensureAvailabilityTimeSelects();
  CutHub.renderAvailabilityCards();
};

CutHub.saveAvailability = async function saveAvailability(event) {
  event?.preventDefault?.();

  const payload = CutHub.getAvailabilityPayload();

  if (!payload.barber_id) return CutHub.showToast("Disponibilidade incompleta", "Selecione um barbeiro.", "error");
  if (!payload.start_time) return CutHub.showToast("Disponibilidade incompleta", "Selecione o horário inicial.", "error");
  if (!payload.end_time) return CutHub.showToast("Disponibilidade incompleta", "Selecione o horário final.", "error");
  if (payload.start_time >= payload.end_time) return CutHub.showToast("Disponibilidade inválida", "O início precisa ser antes do fim.", "error");

  try {
    await CutHub.post("/availability", payload);
    document.getElementById("availabilityForm")?.reset();
    document.getElementById("availabilityStartInput").value = "";
    document.getElementById("availabilityEndInput").value = "";
    document.querySelectorAll(".availability-time-select").forEach((select) => {
      select.value = "";
    });
    CutHub.showToast("Disponibilidade salva", "Horário cadastrado com sucesso.", "success");
    await CutHub.renderAvailability();
  } catch (error) {
    CutHub.showToast("Erro ao salvar", CutHub.availabilityErrorText(error), "error");
  }
};

CutHub.bindAvailabilityEvents = function bindAvailabilityEvents() {
  const form = document.getElementById("availabilityForm");

  if (form && form.dataset.availabilityBound !== "true") {
    form.dataset.availabilityBound = "true";
    form.addEventListener("submit", CutHub.saveAvailability);
  }
};