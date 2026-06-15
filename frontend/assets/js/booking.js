/* CutHub booking.js - hotfix 422 robusto mantendo calendário existente */

window.CutHub = window.CutHub || {};

CutHub.bookingSelectedDate = CutHub.bookingSelectedDate || CutHub.todayISO?.() || new Date().toISOString().slice(0, 10);
CutHub.bookingSelectedTime = CutHub.bookingSelectedTime || "";
CutHub.bookingAvailableSlots = CutHub.bookingAvailableSlots || [
  "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30",
];

CutHub.bookingErrorText = function bookingErrorText(error) {
  if (!error) return "Erro desconhecido.";
  if (typeof error === "string") return error;
  if (error.message && typeof error.message === "string" && error.message !== "[object Object]") return error.message;
  if (error.detail && typeof error.detail === "string") return error.detail;

  if (Array.isArray(error.detail)) {
    return error.detail.map((item) => {
      if (typeof item === "string") return item;
      const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
      return `${loc ? `${loc}: ` : ""}${item.msg || JSON.stringify(item)}`;
    }).join(" | ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

CutHub.bookingLocalISO = function bookingLocalISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

CutHub.bookingParseDate = function bookingParseDate(dateISO) {
  return new Date(`${dateISO}T00:00:00`);
};

CutHub.bookingAddDays = function bookingAddDays(dateISO, amount) {
  const date = CutHub.bookingParseDate(dateISO);
  date.setDate(date.getDate() + amount);
  return CutHub.bookingLocalISO(date);
};

CutHub.bookingGetAppointmentDate = function bookingGetAppointmentDate(appointment) {
  return String(appointment.appointment_date || appointment.date || appointment.scheduled_date || "").slice(0, 10);
};

CutHub.bookingGetAppointmentTime = function bookingGetAppointmentTime(appointment) {
  const direct = String(appointment.appointment_time || appointment.time || appointment.start_time || "").slice(0, 5);
  if (direct) return direct;

  const raw = String(appointment.appointment_date || appointment.date || appointment.scheduled_at || appointment.starts_at || "");
  if (raw.includes("T")) return raw.split("T")[1].slice(0, 5);

  return "";
};

CutHub.findClientForLoggedUser = async function findClientForLoggedUser() {
  const user = CutHub.getCurrentUser?.();
  if (!user) return null;

  if (!CutHub.state.clients.length && CutHub.get) {
    CutHub.state.clients = await CutHub.get("/clients").catch(() => []);
  }

  const email = CutHub.normalize?.(user.email) || String(user.email || "").toLowerCase().trim();
  const name = CutHub.normalize?.(user.name) || String(user.name || "").toLowerCase().trim();

  return CutHub.state.clients.find((client) => {
    const clientEmail = CutHub.normalize?.(client.email) || String(client.email || "").toLowerCase().trim();
    const clientName = CutHub.normalize?.(client.name) || String(client.name || "").toLowerCase().trim();

    return (
      (email && clientEmail === email) ||
      (name && clientName === name) ||
      Number(client.user_id || 0) === Number(user.id || 0)
    );
  }) || null;
};

CutHub.fillBookingSelect = function fillBookingSelect(id, items, getLabel) {
  const select = document.getElementById(id);
  if (!select) return;

  const current = select.value;
  select.innerHTML = `<option value="">Selecione</option>` + items.map((item) => `
    <option value="${item.id}">${getLabel(item)}</option>
  `).join("");

  if (current && [...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
};

CutHub.prepareBookingForm = function prepareBookingForm() {
  const form = document.getElementById("bookingForm");
  const dateInput = document.getElementById("bookingDateInput");
  const timeInput = document.getElementById("bookingTimeInput");
  const button = document.getElementById("publicBookingSubmitButton");

  if (form) form.setAttribute("novalidate", "novalidate");

  [dateInput, timeInput].forEach((input) => {
    if (!input) return;
    input.required = false;
    input.removeAttribute("required");
    input.closest(".form-group")?.classList.add("booking-native-date-hidden");
    input.closest(".form-group")?.classList.add("booking-native-time-hidden");
  });

  if (button) {
    button.type = "button";

    if (button.dataset.bookingDirectBound !== "true") {
      button.dataset.bookingDirectBound = "true";
      button.addEventListener("click", CutHub.confirmBookingDirectly);
    }
  }
};

CutHub.ensureBookingVisualPanel = function ensureBookingVisualPanel() {
  const form = document.getElementById("bookingForm");
  if (!form || document.getElementById("bookingVisualPanel")) return;

  const panel = document.createElement("section");
  panel.id = "bookingVisualPanel";
  panel.className = "booking-visual-panel";
  panel.innerHTML = `
    <div class="booking-calendar-card">
      <div class="booking-calendar-head">
        <div>
          <span class="panel-eyebrow">Escolha o dia</span>
          <h3 id="bookingVisualMonthTitle">Agenda</h3>
        </div>
        <div class="booking-calendar-nav">
          <button id="bookingCalendarPrev" class="secondary-button" type="button">‹ Semana</button>
          <button id="bookingCalendarToday" class="secondary-button" type="button">Hoje</button>
          <button id="bookingCalendarNext" class="secondary-button" type="button">Semana ›</button>
        </div>
      </div>
      <div class="booking-week-strip" id="bookingWeekStrip"></div>
    </div>

    <div class="booking-slots-card">
      <div class="booking-calendar-head">
        <div>
          <span class="panel-eyebrow">Horários disponíveis</span>
          <h3 id="bookingSelectedDateLabel">Selecione uma data</h3>
        </div>
        <strong id="bookingSlotsCounter">0 livres</strong>
      </div>
      <div id="bookingSlotsGrid" class="booking-slots-grid"></div>
    </div>
  `;

  const grid = form.querySelector(".form-grid");
  if (grid) form.insertBefore(panel, grid.nextSibling);
  else form.prepend(panel);

  document.getElementById("bookingCalendarPrev")?.addEventListener("click", () => {
    CutHub.bookingSelectedDate = CutHub.bookingAddDays(CutHub.bookingSelectedDate, -7);
    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();
    CutHub.renderBookingCalendar();
  });

  document.getElementById("bookingCalendarNext")?.addEventListener("click", () => {
    CutHub.bookingSelectedDate = CutHub.bookingAddDays(CutHub.bookingSelectedDate, 7);
    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();
    CutHub.renderBookingCalendar();
  });

  document.getElementById("bookingCalendarToday")?.addEventListener("click", () => {
    CutHub.bookingSelectedDate = CutHub.todayISO?.() || CutHub.bookingLocalISO();
    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();
    CutHub.renderBookingCalendar();
  });
};

CutHub.syncBookingHiddenFields = function syncBookingHiddenFields() {
  const dateInput = document.getElementById("bookingDateInput");
  const timeInput = document.getElementById("bookingTimeInput");

  if (dateInput) dateInput.value = CutHub.bookingSelectedDate;
  if (timeInput) timeInput.value = CutHub.bookingSelectedTime;
};

CutHub.getBookingOccupiedSlots = function getBookingOccupiedSlots(dateISO, barberId) {
  return (CutHub.state.appointments || [])
    .filter((appointment) => CutHub.bookingGetAppointmentDate(appointment) === dateISO)
    .filter((appointment) => !barberId || String(appointment.barber_id || "") === String(barberId))
    .filter((appointment) => !["cancelled", "canceled"].includes(String(appointment.status || "").toLowerCase()))
    .map(CutHub.bookingGetAppointmentTime)
    .filter(Boolean);
};

CutHub.renderBookingDateStrip = function renderBookingDateStrip() {
  const strip = document.getElementById("bookingWeekStrip");
  const title = document.getElementById("bookingVisualMonthTitle");
  if (!strip) return;

  const selected = CutHub.bookingSelectedDate || CutHub.todayISO?.() || CutHub.bookingLocalISO();
  const selectedDate = CutHub.bookingParseDate(selected);
  const start = new Date(selectedDate);
  start.setDate(selectedDate.getDate() - selectedDate.getDay());

  if (title) {
    title.textContent = selectedDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  const today = CutHub.todayISO?.() || CutHub.bookingLocalISO();
  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const dateISO = CutHub.bookingLocalISO(date);
    const appointments = (CutHub.state.appointments || []).filter((item) => CutHub.bookingGetAppointmentDate(item) === dateISO);
    const occupiedCount = appointments.filter((item) => !["cancelled", "canceled"].includes(String(item.status || "").toLowerCase())).length;
    const freeCount = Math.max(0, CutHub.bookingAvailableSlots.length - occupiedCount);

    days.push(`
      <button
        type="button"
        class="booking-date-chip ${dateISO === selected ? "active" : ""} ${dateISO === today ? "today" : ""}"
        data-booking-date="${dateISO}"
      >
        <span>${date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
        <strong>${String(date.getDate()).padStart(2, "0")}</strong>
        <small>${occupiedCount ? `${occupiedCount} ocupado${occupiedCount === 1 ? "" : "s"}` : "Livre"}</small>
        <em>${freeCount} horários</em>
      </button>
    `);
  }

  strip.innerHTML = days.join("");

  strip.querySelectorAll("[data-booking-date]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.bookingSelectedDate = button.dataset.bookingDate;
      CutHub.bookingSelectedTime = "";
      CutHub.syncBookingHiddenFields();
      CutHub.renderBookingCalendar();
    });
  });
};

CutHub.renderBookingSlots = function renderBookingSlots() {
  const grid = document.getElementById("bookingSlotsGrid");
  const label = document.getElementById("bookingSelectedDateLabel");
  const counter = document.getElementById("bookingSlotsCounter");
  if (!grid) return;

  const barberId = document.getElementById("bookingBarberSelect")?.value || "";
  const dateISO = CutHub.bookingSelectedDate;
  const selectedDate = CutHub.bookingParseDate(dateISO);
  const occupied = CutHub.getBookingOccupiedSlots(dateISO, barberId);
  const today = CutHub.todayISO?.() || CutHub.bookingLocalISO();
  const now = new Date();

  if (label) {
    label.textContent = selectedDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });
  }

  let freeCount = 0;

  grid.innerHTML = CutHub.bookingAvailableSlots.map((slot) => {
    const [hours, minutes] = slot.split(":").map(Number);
    const slotDate = CutHub.bookingParseDate(dateISO);
    slotDate.setHours(hours, minutes, 0, 0);

    const isPast = dateISO === today && slotDate < now;
    const isOccupied = occupied.includes(slot);
    const disabled = isPast || isOccupied;

    if (!disabled) freeCount += 1;

    return `
      <button
        type="button"
        class="booking-slot-chip ${CutHub.bookingSelectedTime === slot ? "active" : ""} ${disabled ? "disabled" : ""}"
        data-booking-slot="${slot}"
        ${disabled ? "disabled" : ""}
      >
        <strong>${slot}</strong>
        <small>${isOccupied ? "ocupado" : isPast ? "passou" : "livre"}</small>
      </button>
    `;
  }).join("");

  if (counter) counter.textContent = `${freeCount} livres`;

  grid.querySelectorAll("[data-booking-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.bookingSelectedTime = button.dataset.bookingSlot;
      CutHub.syncBookingHiddenFields();
      CutHub.renderBookingSlots();
      CutHub.renderBookingSummary();
    });
  });
};

CutHub.renderBookingSummary = function renderBookingSummary() {
  let box = document.getElementById("bookingVisualSummary");
  const form = document.getElementById("bookingForm");
  if (!form) return;

  if (!box) {
    box = document.createElement("aside");
    box.id = "bookingVisualSummary";
    box.className = "booking-visual-summary";
    form.appendChild(box);
  }

  const clientId = document.getElementById("bookingClientSelect")?.value;
  const serviceId = document.getElementById("bookingServiceSelect")?.value;
  const barberId = document.getElementById("bookingBarberSelect")?.value;

  const client = CutHub.findById?.(CutHub.state.clients, clientId) || CutHub.state.clients.find((item) => Number(item.id) === Number(clientId));
  const service = CutHub.findById?.(CutHub.state.services, serviceId) || CutHub.state.services.find((item) => Number(item.id) === Number(serviceId));
  const barber = CutHub.findById?.(CutHub.state.barbers, barberId) || CutHub.state.barbers.find((item) => Number(item.id) === Number(barberId));

  box.innerHTML = `
    <span class="panel-eyebrow">Resumo</span>
    <strong>${CutHub.safeText?.(service?.name, "Serviço não selecionado") || service?.name || "Serviço não selecionado"}</strong>
    <p>${CutHub.safeText?.(client?.name, "Cliente não selecionado") || client?.name || "Cliente não selecionado"} com ${CutHub.safeText?.(barber?.name, "barbeiro não selecionado") || barber?.name || "barbeiro não selecionado"}</p>
    <p>${CutHub.formatDate?.(CutHub.bookingSelectedDate) || CutHub.bookingSelectedDate} · ${CutHub.bookingSelectedTime || "horário não selecionado"}</p>
    ${service?.price ? `<small>${CutHub.formatCurrency?.(service.price) || service.price}</small>` : ""}
  `;
};

CutHub.renderBookingCalendar = function renderBookingCalendar() {
  CutHub.syncBookingHiddenFields();
  CutHub.renderBookingDateStrip();
  CutHub.renderBookingSlots();
  CutHub.renderBookingSummary();
};

CutHub.renderBooking = async function renderBooking() {
  await CutHub.loadCoreData?.();

  CutHub.prepareBookingForm();

  const activeClients = (CutHub.state.clients || []).filter((client) => {
    const status = String(client.status || "active").toLowerCase();
    return !["blocked", "inactive"].includes(status);
  });

  CutHub.fillBookingSelect("bookingClientSelect", activeClients, (client) => client.name);
  CutHub.fillBookingSelect("bookingServiceSelect", CutHub.state.services || [], (service) => `${service.name} · ${CutHub.formatCurrency?.(service.price) || service.price}`);
  CutHub.fillBookingSelect("bookingBarberSelect", CutHub.state.barbers || [], (barber) => barber.name);

  if (CutHub.isClient?.()) {
    const client = await CutHub.findClientForLoggedUser();
    const select = document.getElementById("bookingClientSelect");

    if (select) {
      select.disabled = true;

      if (client) {
        if (![...select.options].some((option) => option.value === String(client.id))) {
          select.innerHTML = `<option value="${client.id}">${client.name}</option>`;
        }
        select.value = String(client.id);
      }
    }
  }

  if (!CutHub.bookingSelectedDate) {
    CutHub.bookingSelectedDate = CutHub.todayISO?.() || CutHub.bookingLocalISO();
  }

  CutHub.ensureBookingVisualPanel();
  CutHub.renderBookingCalendar();

  ["bookingClientSelect", "bookingServiceSelect", "bookingBarberSelect"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element || element.dataset.bookingCalendarBound === "true") return;

    element.dataset.bookingCalendarBound = "true";
    element.addEventListener("change", () => {
      CutHub.bookingSelectedTime = "";
      CutHub.renderBookingCalendar();
    });
  });
};

CutHub.validateBookingPayload = function validateBookingPayload(payload) {
  if (!payload.client_id) return "Cliente não selecionado.";
  if (!payload.service_id) return "Selecione um serviço.";
  if (!payload.barber_id) return "Selecione um barbeiro.";
  if (!payload.appointment_date) return "Selecione uma data.";
  if (!payload.appointment_time) return "Selecione um horário.";

  const occupied = CutHub.getBookingOccupiedSlots(payload.appointment_date, payload.barber_id);
  if (occupied.includes(payload.appointment_time)) return "Esse horário já está ocupado.";

  return "";
};

CutHub.directAppointmentPost = async function directAppointmentPost(body) {
  const tokenKeys = ["cuthub_token", "token", "access_token", "authToken"];
  const token = tokenKeys.map((key) => localStorage.getItem(key)).find(Boolean);

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  const response = await fetch("/api/appointments", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(CutHub.bookingErrorText(data) || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    error.body = body;
    throw error;
  }

  return data;
};

CutHub.buildAppointmentAttempts = function buildAppointmentAttempts(payload) {
  const dt = `${payload.appointment_date}T${payload.appointment_time}`;
  const dtSeconds = `${dt}:00`;
  const dtSpace = `${payload.appointment_date} ${payload.appointment_time}:00`;

  const base = {
    client_id: payload.client_id,
    barber_id: payload.barber_id,
    service_id: payload.service_id,
    notes: payload.notes || "",
    observations: payload.notes || "",
    status: "scheduled",
  };

  return [
    { name: "appointment_date_time", body: { ...base, appointment_date: payload.appointment_date, appointment_time: payload.appointment_time } },
    { name: "appointment_date_start_time", body: { ...base, appointment_date: payload.appointment_date, start_time: payload.appointment_time } },
    { name: "date_time", body: { ...base, date: payload.appointment_date, time: payload.appointment_time } },
    { name: "date_start_time", body: { ...base, date: payload.appointment_date, start_time: payload.appointment_time } },
    { name: "scheduled_date_time", body: { ...base, scheduled_date: payload.appointment_date, scheduled_time: payload.appointment_time } },
    { name: "datetime_seconds", body: { ...base, appointment_date: dtSeconds } },
    { name: "datetime_no_seconds", body: { ...base, appointment_date: dt } },
    { name: "datetime_space", body: { ...base, appointment_date: dtSpace } },
    { name: "scheduled_at", body: { ...base, scheduled_at: dtSeconds } },
    { name: "starts_at", body: { ...base, starts_at: dtSeconds } },
    { name: "appointment_datetime", body: { ...base, appointment_datetime: dtSeconds } },
    { name: "start_datetime", body: { ...base, start_datetime: dtSeconds } },
  ];
};

CutHub.sendAppointmentPayload = async function sendAppointmentPayload(payload) {
  const attempts = CutHub.buildAppointmentAttempts(payload);
  let lastError = null;

  for (const attempt of attempts) {
    try {
      console.log("[CutHub Booking] tentando", attempt.name, attempt.body);
      const result = await CutHub.directAppointmentPost(attempt.body);
      console.log("[CutHub Booking] sucesso", attempt.name, result);
      return result;
    } catch (error) {
      console.error("[CutHub Booking] falhou", attempt.name, {
        message: error.message,
        status: error.status,
        data: error.data,
        body: attempt.body,
      });
      lastError = error;
    }
  }

  throw lastError;
};

CutHub.confirmBookingDirectly = async function confirmBookingDirectly(event) {
  event?.preventDefault?.();

  const payload = {
    client_id: Number(document.getElementById("bookingClientSelect")?.value || 0),
    service_id: Number(document.getElementById("bookingServiceSelect")?.value || 0),
    barber_id: Number(document.getElementById("bookingBarberSelect")?.value || 0),
    appointment_date: CutHub.bookingSelectedDate,
    appointment_time: CutHub.bookingSelectedTime,
    notes: document.getElementById("bookingNotesInput")?.value || "",
  };

  const error = CutHub.validateBookingPayload(payload);
  if (error) {
    CutHub.showToast?.("Agendamento incompleto", error, "error");
    return;
  }

  const button = document.getElementById("publicBookingSubmitButton");
  const oldText = button?.textContent || "Confirmar agendamento";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Confirmando...";
    }

    await CutHub.sendAppointmentPayload(payload);

    CutHub.showToast?.("Agendamento confirmado", "Corte agendado com sucesso.", "success");

    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();

    await CutHub.refreshAppointments?.();
    await CutHub.loadCoreData?.();

    CutHub.renderBookingCalendar();
    await CutHub.renderDashboard?.();
    await CutHub.renderTablet?.();
  } catch (apiError) {
    const text = CutHub.bookingErrorText(apiError.data || apiError);
    console.error("[CutHub Booking] erro final detalhado", apiError);
    CutHub.showToast?.("Erro ao confirmar", text, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
};

CutHub.bindBookingEvents = function bindBookingEvents() {
  const form = document.getElementById("bookingForm");

  if (form && form.dataset.bookingSubmitBound !== "true") {
    form.dataset.bookingSubmitBound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      CutHub.confirmBookingDirectly(event);
    });
  }

  CutHub.prepareBookingForm();
};

/* CutHub booking.js - versão final alinhada ao schema AppointmentCreate */

window.CutHub = window.CutHub || {};

CutHub.bookingSelectedDate = CutHub.bookingSelectedDate || CutHub.todayISO?.() || new Date().toISOString().slice(0, 10);
CutHub.bookingSelectedTime = CutHub.bookingSelectedTime || "";
CutHub.bookingAvailableSlots = CutHub.bookingAvailableSlots || [
  "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30",
];

CutHub.bookingErrorText = function bookingErrorText(error) {
  if (!error) return "Erro desconhecido.";
  if (typeof error === "string") return error;
  if (error.message && error.message !== "[object Object]") return error.message;
  if (error.detail && typeof error.detail === "string") return error.detail;

  if (Array.isArray(error.detail)) {
    return error.detail.map((item) => {
      const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
      return `${loc ? `${loc}: ` : ""}${item.msg || JSON.stringify(item)}`;
    }).join(" | ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

CutHub.bookingLocalISO = function bookingLocalISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

CutHub.bookingParseDate = function bookingParseDate(dateISO) {
  return new Date(`${dateISO}T00:00:00`);
};

CutHub.bookingAddDays = function bookingAddDays(dateISO, amount) {
  const date = CutHub.bookingParseDate(dateISO);
  date.setDate(date.getDate() + amount);
  return CutHub.bookingLocalISO(date);
};

CutHub.bookingGetAppointmentDate = function bookingGetAppointmentDate(appointment) {
  return String(appointment.appointment_date || appointment.date || "").slice(0, 10);
};

CutHub.bookingGetAppointmentTime = function bookingGetAppointmentTime(appointment) {
  const direct = String(appointment.appointment_time || "").slice(0, 5);
  if (direct) return direct;

  const raw = String(appointment.appointment_date || appointment.date || "");
  if (raw.includes("T")) return raw.split("T")[1].slice(0, 5);

  return "";
};

CutHub.findClientForLoggedUser = async function findClientForLoggedUser() {
  const user = CutHub.getCurrentUser?.();
  if (!user) return null;

  if (!CutHub.state.clients.length && CutHub.get) {
    CutHub.state.clients = await CutHub.get("/clients").catch(() => []);
  }

  const email = CutHub.normalize?.(user.email) || String(user.email || "").toLowerCase().trim();
  const name = CutHub.normalize?.(user.name) || String(user.name || "").toLowerCase().trim();

  return CutHub.state.clients.find((client) => {
    const clientEmail = CutHub.normalize?.(client.email) || String(client.email || "").toLowerCase().trim();
    const clientName = CutHub.normalize?.(client.name) || String(client.name || "").toLowerCase().trim();

    return (
      (email && clientEmail === email) ||
      (name && clientName === name) ||
      Number(client.user_id || 0) === Number(user.id || 0)
    );
  }) || null;
};

CutHub.fillBookingSelect = function fillBookingSelect(id, items, getLabel) {
  const select = document.getElementById(id);
  if (!select) return;

  const current = select.value;
  select.innerHTML = `<option value="">Selecione</option>` + items.map((item) => `
    <option value="${item.id}">${getLabel(item)}</option>
  `).join("");

  if (current && [...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
};

CutHub.prepareBookingForm = function prepareBookingForm() {
  const form = document.getElementById("bookingForm");
  const dateInput = document.getElementById("bookingDateInput");
  const timeInput = document.getElementById("bookingTimeInput");
  const button = document.getElementById("publicBookingSubmitButton");

  if (form) form.setAttribute("novalidate", "novalidate");

  [dateInput, timeInput].forEach((input) => {
    if (!input) return;
    input.required = false;
    input.removeAttribute("required");
    input.closest(".form-group")?.classList.add("booking-native-date-hidden");
    input.closest(".form-group")?.classList.add("booking-native-time-hidden");
  });

  if (button) {
    button.type = "button";

    if (button.dataset.bookingDirectBound !== "true") {
      button.dataset.bookingDirectBound = "true";
      button.addEventListener("click", CutHub.confirmBookingDirectly);
    }
  }
};

CutHub.ensureBookingVisualPanel = function ensureBookingVisualPanel() {
  const form = document.getElementById("bookingForm");
  if (!form || document.getElementById("bookingVisualPanel")) return;

  const panel = document.createElement("section");
  panel.id = "bookingVisualPanel";
  panel.className = "booking-visual-panel";
  panel.innerHTML = `
    <div class="booking-calendar-card">
      <div class="booking-calendar-head">
        <div>
          <span class="panel-eyebrow">Escolha o dia</span>
          <h3 id="bookingVisualMonthTitle">Agenda</h3>
        </div>
        <div class="booking-calendar-nav">
          <button id="bookingCalendarPrev" class="secondary-button" type="button">‹ Semana</button>
          <button id="bookingCalendarToday" class="secondary-button" type="button">Hoje</button>
          <button id="bookingCalendarNext" class="secondary-button" type="button">Semana ›</button>
        </div>
      </div>
      <div class="booking-week-strip" id="bookingWeekStrip"></div>
    </div>

    <div class="booking-slots-card">
      <div class="booking-calendar-head">
        <div>
          <span class="panel-eyebrow">Horários disponíveis</span>
          <h3 id="bookingSelectedDateLabel">Selecione uma data</h3>
        </div>
        <strong id="bookingSlotsCounter">0 livres</strong>
      </div>
      <div id="bookingSlotsGrid" class="booking-slots-grid"></div>
    </div>
  `;

  const grid = form.querySelector(".form-grid");
  if (grid) form.insertBefore(panel, grid.nextSibling);
  else form.prepend(panel);

  document.getElementById("bookingCalendarPrev")?.addEventListener("click", () => {
    CutHub.bookingSelectedDate = CutHub.bookingAddDays(CutHub.bookingSelectedDate, -7);
    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();
    CutHub.renderBookingCalendar();
  });

  document.getElementById("bookingCalendarNext")?.addEventListener("click", () => {
    CutHub.bookingSelectedDate = CutHub.bookingAddDays(CutHub.bookingSelectedDate, 7);
    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();
    CutHub.renderBookingCalendar();
  });

  document.getElementById("bookingCalendarToday")?.addEventListener("click", () => {
    CutHub.bookingSelectedDate = CutHub.todayISO?.() || CutHub.bookingLocalISO();
    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();
    CutHub.renderBookingCalendar();
  });
};

CutHub.syncBookingHiddenFields = function syncBookingHiddenFields() {
  const dateInput = document.getElementById("bookingDateInput");
  const timeInput = document.getElementById("bookingTimeInput");

  if (dateInput) dateInput.value = CutHub.bookingSelectedDate || "";
  if (timeInput) timeInput.value = CutHub.bookingSelectedTime || "";
};

CutHub.getBookingOccupiedSlots = function getBookingOccupiedSlots(dateISO, barberId) {
  return (CutHub.state.appointments || [])
    .filter((appointment) => CutHub.bookingGetAppointmentDate(appointment) === dateISO)
    .filter((appointment) => !barberId || String(appointment.barber_id || "") === String(barberId))
    .filter((appointment) => !["cancelled", "canceled"].includes(String(appointment.status || "").toLowerCase()))
    .map(CutHub.bookingGetAppointmentTime)
    .filter(Boolean);
};

CutHub.renderBookingDateStrip = function renderBookingDateStrip() {
  const strip = document.getElementById("bookingWeekStrip");
  const title = document.getElementById("bookingVisualMonthTitle");
  if (!strip) return;

  const selected = CutHub.bookingSelectedDate || CutHub.todayISO?.() || CutHub.bookingLocalISO();
  const selectedDate = CutHub.bookingParseDate(selected);
  const start = new Date(selectedDate);
  start.setDate(selectedDate.getDate() - selectedDate.getDay());

  if (title) {
    title.textContent = selectedDate.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  }

  const today = CutHub.todayISO?.() || CutHub.bookingLocalISO();
  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const dateISO = CutHub.bookingLocalISO(date);
    const appointments = (CutHub.state.appointments || []).filter((item) => CutHub.bookingGetAppointmentDate(item) === dateISO);
    const occupiedCount = appointments.filter((item) => !["cancelled", "canceled"].includes(String(item.status || "").toLowerCase())).length;
    const freeCount = Math.max(0, CutHub.bookingAvailableSlots.length - occupiedCount);

    days.push(`
      <button
        type="button"
        class="booking-date-chip ${dateISO === selected ? "active" : ""} ${dateISO === today ? "today" : ""}"
        data-booking-date="${dateISO}"
      >
        <span>${date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
        <strong>${String(date.getDate()).padStart(2, "0")}</strong>
        <small>${occupiedCount ? `${occupiedCount} ocupado${occupiedCount === 1 ? "" : "s"}` : "Livre"}</small>
        <em>${freeCount} horários</em>
      </button>
    `);
  }

  strip.innerHTML = days.join("");

  strip.querySelectorAll("[data-booking-date]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.bookingSelectedDate = button.dataset.bookingDate;
      CutHub.bookingSelectedTime = "";
      CutHub.syncBookingHiddenFields();
      CutHub.renderBookingCalendar();
    });
  });
};

CutHub.renderBookingSlots = function renderBookingSlots() {
  const grid = document.getElementById("bookingSlotsGrid");
  const label = document.getElementById("bookingSelectedDateLabel");
  const counter = document.getElementById("bookingSlotsCounter");
  if (!grid) return;

  const barberId = document.getElementById("bookingBarberSelect")?.value || "";
  const dateISO = CutHub.bookingSelectedDate;
  const selectedDate = CutHub.bookingParseDate(dateISO);
  const occupied = CutHub.getBookingOccupiedSlots(dateISO, barberId);
  const today = CutHub.todayISO?.() || CutHub.bookingLocalISO();
  const now = new Date();

  if (label) {
    label.textContent = selectedDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });
  }

  let freeCount = 0;

  grid.innerHTML = CutHub.bookingAvailableSlots.map((slot) => {
    const [hours, minutes] = slot.split(":").map(Number);
    const slotDate = CutHub.bookingParseDate(dateISO);
    slotDate.setHours(hours, minutes, 0, 0);

    const isPast = dateISO === today && slotDate < now;
    const isOccupied = occupied.includes(slot);
    const disabled = isPast || isOccupied;

    if (!disabled) freeCount += 1;

    return `
      <button
        type="button"
        class="booking-slot-chip ${CutHub.bookingSelectedTime === slot ? "active" : ""} ${disabled ? "disabled" : ""}"
        data-booking-slot="${slot}"
        ${disabled ? "disabled" : ""}
      >
        <strong>${slot}</strong>
        <small>${isOccupied ? "ocupado" : isPast ? "passou" : "livre"}</small>
      </button>
    `;
  }).join("");

  if (counter) counter.textContent = `${freeCount} livres`;

  grid.querySelectorAll("[data-booking-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.bookingSelectedTime = button.dataset.bookingSlot;
      CutHub.syncBookingHiddenFields();
      CutHub.renderBookingSlots();
      CutHub.renderBookingSummary();
    });
  });
};

CutHub.renderBookingSummary = function renderBookingSummary() {
  let box = document.getElementById("bookingVisualSummary");
  const form = document.getElementById("bookingForm");
  if (!form) return;

  if (!box) {
    box = document.createElement("aside");
    box.id = "bookingVisualSummary";
    box.className = "booking-visual-summary";
    form.appendChild(box);
  }

  const clientId = document.getElementById("bookingClientSelect")?.value;
  const serviceId = document.getElementById("bookingServiceSelect")?.value;
  const barberId = document.getElementById("bookingBarberSelect")?.value;

  const client = CutHub.findById?.(CutHub.state.clients, clientId) || CutHub.state.clients.find((item) => Number(item.id) === Number(clientId));
  const service = CutHub.findById?.(CutHub.state.services, serviceId) || CutHub.state.services.find((item) => Number(item.id) === Number(serviceId));
  const barber = CutHub.findById?.(CutHub.state.barbers, barberId) || CutHub.state.barbers.find((item) => Number(item.id) === Number(barberId));

  box.innerHTML = `
    <span class="panel-eyebrow">Resumo</span>
    <strong>${CutHub.safeText?.(service?.name, "Serviço não selecionado") || service?.name || "Serviço não selecionado"}</strong>
    <p>${CutHub.safeText?.(client?.name, "Cliente não selecionado") || client?.name || "Cliente não selecionado"} com ${CutHub.safeText?.(barber?.name, "barbeiro não selecionado") || barber?.name || "barbeiro não selecionado"}</p>
    <p>${CutHub.formatDate?.(CutHub.bookingSelectedDate) || CutHub.bookingSelectedDate} · ${CutHub.bookingSelectedTime || "horário não selecionado"}</p>
    ${service?.price ? `<small>${CutHub.formatCurrency?.(service.price) || service.price}</small>` : ""}
  `;
};

CutHub.renderBookingCalendar = function renderBookingCalendar() {
  CutHub.syncBookingHiddenFields();
  CutHub.renderBookingDateStrip();
  CutHub.renderBookingSlots();
  CutHub.renderBookingSummary();
};

CutHub.renderBooking = async function renderBooking() {
  await CutHub.loadCoreData?.();

  CutHub.prepareBookingForm();

  const activeClients = (CutHub.state.clients || []).filter((client) => {
    const status = String(client.status || "active").toLowerCase();
    return !["blocked", "inactive"].includes(status);
  });

  CutHub.fillBookingSelect("bookingClientSelect", activeClients, (client) => client.name);
  CutHub.fillBookingSelect("bookingServiceSelect", CutHub.state.services || [], (service) => `${service.name} · ${CutHub.formatCurrency?.(service.price) || service.price}`);
  CutHub.fillBookingSelect("bookingBarberSelect", CutHub.state.barbers || [], (barber) => barber.name);

  if (CutHub.isClient?.()) {
    const client = await CutHub.findClientForLoggedUser();
    const select = document.getElementById("bookingClientSelect");

    if (select) {
      select.disabled = true;

      if (client) {
        if (![...select.options].some((option) => option.value === String(client.id))) {
          select.innerHTML = `<option value="${client.id}">${client.name}</option>`;
        }
        select.value = String(client.id);
      }
    }
  }

  if (!CutHub.bookingSelectedDate) {
    CutHub.bookingSelectedDate = CutHub.todayISO?.() || CutHub.bookingLocalISO();
  }

  CutHub.ensureBookingVisualPanel();
  CutHub.renderBookingCalendar();

  ["bookingClientSelect", "bookingServiceSelect", "bookingBarberSelect"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element || element.dataset.bookingCalendarBound === "true") return;

    element.dataset.bookingCalendarBound = "true";
    element.addEventListener("change", () => {
      CutHub.bookingSelectedTime = "";
      CutHub.renderBookingCalendar();
    });
  });
};

CutHub.validateBookingPayload = function validateBookingPayload(payload) {
  if (!payload.client_id) return "Cliente não selecionado.";
  if (!payload.service_id) return "Selecione um serviço.";
  if (!payload.barber_id) return "Selecione um barbeiro.";
  if (!payload.appointment_date) return "Selecione uma data.";
  if (!payload.appointment_time) return "Selecione um horário.";

  const occupied = CutHub.getBookingOccupiedSlots(payload.appointment_date, payload.barber_id);
  if (occupied.includes(payload.appointment_time)) return "Esse horário já está ocupado.";

  return "";
};

CutHub.directAppointmentPost = async function directAppointmentPost(body) {
  const token = localStorage.getItem("token") || localStorage.getItem("cuthub_token") || localStorage.getItem("access_token");

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  console.log("[CutHub Booking] payload final", body);

  const response = await fetch("/api/appointments", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(CutHub.bookingErrorText(data) || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    error.body = body;
    throw error;
  }

  return data;
};

CutHub.confirmBookingDirectly = async function confirmBookingDirectly(event) {
  event?.preventDefault?.();

  const payload = {
    client_id: Number(document.getElementById("bookingClientSelect")?.value || 0),
    barber_id: Number(document.getElementById("bookingBarberSelect")?.value || 0),
    service_id: Number(document.getElementById("bookingServiceSelect")?.value || 0),
    appointment_date: String(CutHub.bookingSelectedDate || document.getElementById("bookingDateInput")?.value || "").slice(0, 10),
    appointment_time: String(CutHub.bookingSelectedTime || document.getElementById("bookingTimeInput")?.value || "09:00").slice(0, 5),
    status: "scheduled",
    notes: document.getElementById("bookingNotesInput")?.value || "",
  };

  const error = CutHub.validateBookingPayload(payload);
  if (error) {
    CutHub.showToast?.("Agendamento incompleto", error, "error");
    return;
  }

  const button = document.getElementById("publicBookingSubmitButton");
  const oldText = button?.textContent || "Confirmar agendamento";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Confirmando...";
    }

    await CutHub.directAppointmentPost(payload);

    CutHub.showToast?.("Agendamento confirmado", "Corte agendado com sucesso.", "success");

    CutHub.bookingSelectedTime = "";
    CutHub.syncBookingHiddenFields();

    await CutHub.refreshAppointments?.();
    await CutHub.loadCoreData?.();

    CutHub.renderBookingCalendar();
    await CutHub.renderDashboard?.();
    await CutHub.renderTablet?.();
  } catch (apiError) {
    const text = CutHub.bookingErrorText(apiError.data || apiError);
    console.error("[CutHub Booking] erro final detalhado", apiError);
    CutHub.showToast?.("Erro ao confirmar", text, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
};

CutHub.bindBookingEvents = function bindBookingEvents() {
  const form = document.getElementById("bookingForm");

  if (form && form.dataset.bookingSubmitBound !== "true") {
    form.dataset.bookingSubmitBound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      CutHub.confirmBookingDirectly(event);
    });
  }

  CutHub.prepareBookingForm();
};