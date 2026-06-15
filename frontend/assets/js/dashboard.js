// Dashboard

window.CutHub = window.CutHub || {};

CutHub.dashboardSelectedDate = CutHub.dashboardSelectedDate || CutHub.todayISO();
CutHub.dashboardVisibleMonth = CutHub.dashboardVisibleMonth || CutHub.dashboardSelectedDate.slice(0, 7);

CutHub.getAppointmentDateISO = CutHub.getAppointmentDateISO || function getAppointmentDateISO(appointment) {
  return String(appointment.appointment_date || appointment.date || "").slice(0, 10);
};

CutHub.getAppointmentTime = CutHub.getAppointmentTime || function getAppointmentTime(appointment) {
  const direct = String(appointment.appointment_time || "").slice(0, 5);
  if (direct) return direct;

  const raw = String(appointment.appointment_date || appointment.date || "");
  if (raw.includes("T")) return raw.split("T")[1].slice(0, 5);

  return "--:--";
};

CutHub.getAppointmentsByDate = function getAppointmentsByDate(dateISO) {
  return CutHub.state.appointments
    .filter((item) => CutHub.getAppointmentDateISO(item) === dateISO)
    .sort((a, b) => CutHub.getAppointmentTime(a).localeCompare(CutHub.getAppointmentTime(b)));
};

CutHub.getMonthDate = function getMonthDate(monthISO) {
  const safe = monthISO || CutHub.todayISO().slice(0, 7);
  return new Date(`${safe}-01T00:00:00`);
};

CutHub.shiftDashboardMonth = function shiftDashboardMonth(amount) {
  const date = CutHub.getMonthDate(CutHub.dashboardVisibleMonth);
  date.setMonth(date.getMonth() + amount);
  CutHub.dashboardVisibleMonth = date.toISOString().slice(0, 7);
  CutHub.renderDashboardCalendar();
  CutHub.renderDashboardDayDetails();
};

CutHub.removeDashboardTodayAgendaPanel = function removeDashboardTodayAgendaPanel() {
  const nextList = document.getElementById("dashboardNextAppointmentsList") || document.getElementById("nextAppointmentsList");
  const panel = nextList?.closest(".panel");
  if (panel) panel.remove();
};

CutHub.renderDashboardCalendar = function renderDashboardCalendar() {
  const mount = document.getElementById("dashboardCalendarMount");
  if (!mount) return;

  const visibleDate = CutHub.getMonthDate(CutHub.dashboardVisibleMonth);
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();

  const monthName = visibleDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const today = CutHub.todayISO();
  const days = [];

  for (let i = 0; i < startOffset; i += 1) {
    days.push(`<button class="dashboard-calendar-day dashboard-calendar-day-empty" type="button" disabled></button>`);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const dateISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const appointments = CutHub.getAppointmentsByDate(dateISO);
    const completed = appointments.filter((item) => String(item.status || "").toLowerCase() === "completed").length;
    const pending = appointments.filter((item) => !["completed", "cancelled"].includes(String(item.status || "").toLowerCase())).length;

    days.push(`
      <button 
        class="dashboard-calendar-day ${dateISO === today ? "today" : ""} ${dateISO === CutHub.dashboardSelectedDate ? "active" : ""}"
        type="button"
        data-dashboard-date="${dateISO}"
      >
        <strong>${day}</strong>
        ${appointments.length ? `<span>${appointments.length} agendamento${appointments.length === 1 ? "" : "s"}</span>` : `<small>Livre</small>`}
        ${pending ? `<i>${pending} pendente${pending === 1 ? "" : "s"}</i>` : ""}
        ${completed ? `<em>${completed} final.</em>` : ""}
      </button>
    `);
  }

  mount.innerHTML = `
    <div class="dashboard-calendar-head">
      <button id="dashboardCalendarPrev" class="secondary-button calendar-nav-button" type="button">‹</button>
      <div>
        <span class="panel-eyebrow">Calendário mensal</span>
        <h3>${monthName}</h3>
      </div>
      <div class="dashboard-calendar-actions">
        <button id="dashboardCalendarToday" class="secondary-button" type="button">Hoje</button>
        <button id="dashboardCalendarNext" class="secondary-button calendar-nav-button" type="button">›</button>
      </div>
    </div>

    <div class="dashboard-calendar-weekdays">
      <span>Dom</span>
      <span>Seg</span>
      <span>Ter</span>
      <span>Qua</span>
      <span>Qui</span>
      <span>Sex</span>
      <span>Sáb</span>
    </div>

    <div class="dashboard-appointment-calendar">
      ${days.join("")}
    </div>
  `;

  document.getElementById("dashboardCalendarPrev")?.addEventListener("click", () => {
    CutHub.shiftDashboardMonth(-1);
  });

  document.getElementById("dashboardCalendarNext")?.addEventListener("click", () => {
    CutHub.shiftDashboardMonth(1);
  });

  document.getElementById("dashboardCalendarToday")?.addEventListener("click", () => {
    CutHub.dashboardSelectedDate = CutHub.todayISO();
    CutHub.dashboardVisibleMonth = CutHub.todayISO().slice(0, 7);
    CutHub.renderDashboardCalendar();
    CutHub.renderDashboardDayDetails();
  });

  document.querySelectorAll("[data-dashboard-date]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.dashboardSelectedDate = button.dataset.dashboardDate;
      CutHub.dashboardVisibleMonth = CutHub.dashboardSelectedDate.slice(0, 7);
      CutHub.renderDashboardCalendar();
      CutHub.renderDashboardDayDetails();
    });
  });
};

CutHub.renderDashboardDayDetails = function renderDashboardDayDetails() {
  const mount = document.getElementById("dashboardDayAppointmentsList");
  const title = document.getElementById("dashboardSelectedDateTitle");
  const total = document.getElementById("dashboardSelectedDateTotal");
  if (!mount) return;

  const appointments = CutHub.getAppointmentsByDate(CutHub.dashboardSelectedDate);

  if (title) {
    title.textContent = new Date(`${CutHub.dashboardSelectedDate}T00:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  if (total) {
    total.textContent = `${appointments.length} agendamento${appointments.length === 1 ? "" : "s"}`;
  }

  mount.innerHTML = appointments.length ? appointments.map((appointment) => {
    const client = CutHub.findById(CutHub.state.clients, appointment.client_id);
    const service = CutHub.findById(CutHub.state.services, appointment.service_id);
    const barber = CutHub.findById(CutHub.state.barbers, appointment.barber_id);
    const status = String(appointment.status || "scheduled").toLowerCase();

    return `
      <article class="dashboard-day-appointment-card status-${status}">
        <div>
          <strong>${CutHub.getAppointmentTime(appointment)} · ${CutHub.safeText(client?.name, "Cliente")}</strong>
          <span>${CutHub.safeText(service?.name, "Serviço")} · ${CutHub.safeText(barber?.name, "Barbeiro")}</span>
        </div>
        <small>${status === "completed" ? "Finalizado" : status === "in_progress" ? "Em andamento" : status === "cancelled" ? "Cancelado" : "Agendado"}</small>
      </article>
    `;
  }).join("") : `<div class="cuthub-empty-mini">Nenhum agendamento nesse dia.</div>`;
};

CutHub.ensureDashboardCalendarPanel = function ensureDashboardCalendarPanel() {
  const section = document.getElementById("section-finance");
  if (!section || document.getElementById("dashboardCalendarPanel")) return;

  const panel = document.createElement("section");
  panel.id = "dashboardCalendarPanel";
  panel.className = "panel moving-border reveal-up cuthub-dashboard-calendar-panel";
  panel.innerHTML = `
    <div class="panel-header panel-header-split">
      <div>
        <span class="panel-eyebrow">Agenda inteligente</span>
        <h2>Calendário da barbearia</h2>
        <p class="module-switcher-description">Veja a ocupação do mês e abra os atendimentos de cada dia.</p>
      </div>
      <button class="secondary-button" type="button" data-section-target="booking">Novo agendamento</button>
    </div>

    <div class="dashboard-calendar-layout">
      <div id="dashboardCalendarMount"></div>

      <aside class="dashboard-day-details">
        <span class="panel-eyebrow">Dia selecionado</span>
        <h3 id="dashboardSelectedDateTitle">Hoje</h3>
        <strong id="dashboardSelectedDateTotal" class="dashboard-day-total">0 agendamentos</strong>
        <div id="dashboardDayAppointmentsList" class="dashboard-day-appointments-list"></div>
      </aside>
    </div>
  `;

  const cards = document.querySelector("#section-finance .cards-grid");
  if (cards?.nextSibling) {
    section.insertBefore(panel, cards.nextSibling);
  } else {
    section.appendChild(panel);
  }

  panel.querySelector('[data-section-target="booking"]')?.addEventListener("click", async (event) => {
    event.preventDefault();
    CutHub.bookingSelectedDate = CutHub.dashboardSelectedDate || CutHub.todayISO();
    CutHub.bookingSelectedTime = "";
    await CutHub.switchSection("booking");
  });
};

CutHub.renderDashboard = async function renderDashboard() {
  await CutHub.loadCoreData();

  const today = CutHub.todayISO();
  const appointmentsToday = CutHub.state.appointments.filter((item) => CutHub.getAppointmentDateISO(item) === today);

  const completedToday = appointmentsToday.filter((item) => String(item.status || "").toLowerCase() === "completed");
  const inProgressToday = appointmentsToday.filter((item) => String(item.status || "").toLowerCase() === "in_progress");
  const cancelledToday = appointmentsToday.filter((item) => String(item.status || "").toLowerCase() === "cancelled");

  CutHub.setText("dashboardTodayAppointments", String(appointmentsToday.length));
  CutHub.setText("dashboardInProgress", String(inProgressToday.length));
  CutHub.setText("dashboardCompleted", String(completedToday.length));
  CutHub.setText("dashboardCancelled", String(cancelledToday.length));
  CutHub.setText("dashboardClientsCount", String(CutHub.state.clients.length));

  const revenue = completedToday.reduce((sum, appointment) => {
    const service = CutHub.findById(CutHub.state.services, appointment.service_id);
    return sum + Number(appointment.price || service?.price || 0);
  }, 0);

  CutHub.setText("dashboardTodayRevenue", CutHub.formatCurrency(revenue));

  CutHub.removeDashboardTodayAgendaPanel();
  CutHub.ensureDashboardCalendarPanel();
  CutHub.renderDashboardCalendar();
  CutHub.renderDashboardDayDetails();
};