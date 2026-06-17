/* CutHub calendar.js - integração segura com calendários externos
*/
(function setupCutHubCalendarIntegration() {
  window.CutHub = window.CutHub || {};

  function safe(value, fallback = "") {
    return String(value ?? "").trim() || fallback;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseAppointmentDateTime(appointment) {
    const dateRaw = safe(
      appointment.appointment_date ||
      appointment.date ||
      appointment.scheduled_date ||
      appointment.scheduled_at ||
      ""
    );

    const timeRaw = safe(
      appointment.appointment_time ||
      appointment.time ||
      appointment.start_time ||
      "09:00"
    ).slice(0, 5);

    let datePart = dateRaw.slice(0, 10);
    let timePart = timeRaw;

    if (dateRaw.includes("T")) {
      const pieces = dateRaw.split("T");
      datePart = pieces[0];
      timePart = pieces[1].slice(0, 5) || timePart;
    }

    const start = new Date(`${datePart}T${timePart || "09:00"}:00`);
    if (Number.isNaN(start.getTime())) return null;

    const service = CutHub.findById?.(CutHub.state?.services || [], appointment.service_id) || null;
    const duration = Number(
      appointment.duration_minutes ||
      service?.duration_minutes ||
      service?.duration ||
      45
    );

    const end = new Date(start.getTime() + Math.max(15, duration) * 60 * 1000);
    return { start, end };
  }

  function formatICSDate(date) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      "T",
      pad(date.getHours()),
      pad(date.getMinutes()),
      "00",
    ].join("");
  }

  function formatGoogleDate(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function escapeICS(value) {
    return safe(value)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  CutHub.getCalendarAppointmentInfo = function getCalendarAppointmentInfo(appointment) {
    const client = CutHub.findById?.(CutHub.state?.clients || [], appointment.client_id) || null;
    const service = CutHub.findById?.(CutHub.state?.services || [], appointment.service_id) || null;
    const barber = CutHub.findById?.(CutHub.state?.barbers || [], appointment.barber_id) || null;
    const when = parseAppointmentDateTime(appointment);

    return {
      client,
      service,
      barber,
      when,
      title: `CutHub - ${safe(service?.name, "Atendimento")}`,
      description: [
        `Cliente: ${safe(client?.name, "Cliente")}`,
        `Barbeiro: ${safe(barber?.name, "Barbeiro")}`,
        `Serviço: ${safe(service?.name, "Serviço")}`,
        appointment.notes ? `Observações: ${appointment.notes}` : "",
        client?.preferred_cut ? `Preferência: ${client.preferred_cut}` : "",
      ].filter(Boolean).join("\\n"),
    };
  };

  CutHub.buildAppointmentICS = function buildAppointmentICS(appointment) {
    const info = CutHub.getCalendarAppointmentInfo(appointment);
    if (!info.when) throw new Error("Agendamento sem data/hora válida para calendário.");

    const uid = `cuthub-${appointment.id || Date.now()}@local`;
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CutHub//Agenda de Barbearia//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatICSDate(info.when.start)}`,
      `DTEND:${formatICSDate(info.when.end)}`,
      `SUMMARY:${escapeICS(info.title)}`,
      `DESCRIPTION:${escapeICS(info.description)}`,
      "LOCATION:Barbearia",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
  };

  CutHub.downloadAppointmentICS = function downloadAppointmentICS(appointment) {
    const ics = CutHub.buildAppointmentICS(appointment);
    const info = CutHub.getCalendarAppointmentInfo(appointment);
    const dateLabel = info.when ? info.when.start.toISOString().slice(0, 10) : "agenda";
    const fileName = `cuthub-agendamento-${appointment.id || dateLabel}.ics`;

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  CutHub.openAppointmentGoogleCalendar = function openAppointmentGoogleCalendar(appointment) {
    const info = CutHub.getCalendarAppointmentInfo(appointment);
    if (!info.when) throw new Error("Agendamento sem data/hora válida para Google Agenda.");

    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", info.title);
    url.searchParams.set("dates", `${formatGoogleDate(info.when.start)}/${formatGoogleDate(info.when.end)}`);
    url.searchParams.set("details", info.description.replace(/\\n/g, "\n"));
    url.searchParams.set("location", "Barbearia");

    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  function getAppointmentFromButton(button) {
    const id = Number(button.dataset.appointmentId || 0);
    return (CutHub.state?.appointments || []).find((appointment) => Number(appointment.id) === id) || null;
  }

  function buildButtons(appointment) {
    return `
      <div class="cuthub-calendar-actions" data-calendar-actions-for="${appointment.id}">
        <button class="secondary-button cuthub-calendar-button" type="button" data-calendar-action="ics" data-appointment-id="${appointment.id}">Agenda</button>
        <button class="secondary-button cuthub-calendar-button" type="button" data-calendar-action="google" data-appointment-id="${appointment.id}">Google</button>
      </div>
    `;
  }

  CutHub.attachCalendarButtonsToDashboard = function attachCalendarButtonsToDashboard() {
    const list = document.getElementById("dashboardDayAppointmentsList");
    if (!list) return;

    const appointments = typeof CutHub.getAppointmentsByDate === "function"
      ? CutHub.getAppointmentsByDate(CutHub.dashboardSelectedDate)
      : [];

    list.querySelectorAll(".dashboard-day-appointment-card").forEach((card, index) => {
      const appointment = appointments[index];
      if (!appointment?.id || card.querySelector(".cuthub-calendar-actions")) return;
      card.insertAdjacentHTML("beforeend", buildButtons(appointment));
    });
  };

  CutHub.attachCalendarButtonsToTablet = function attachCalendarButtonsToTablet(appointments = []) {
    const list = document.getElementById("tabletAppointmentsList") || document.getElementById("barberTabletAppointmentsList");
    if (!list) return;

    list.querySelectorAll(".cuthub-tablet-card").forEach((card, index) => {
      const appointment = appointments[index];
      if (!appointment?.id || card.querySelector(".cuthub-calendar-actions")) return;
      const actions = card.querySelector(".cuthub-list-actions") || card;
      actions.insertAdjacentHTML("beforeend", buildButtons(appointment));
    });
  };

  function patchRenderer(name, after) {
    const original = CutHub[name];
    if (typeof original !== "function" || original.__calendarPatched) return;

    const patched = async function patchedRenderer(...args) {
      const result = await original.apply(this, args);
      try { after(...args); } catch (error) { console.warn("[CutHub Calendar]", error); }
      return result;
    };

    patched.__calendarPatched = true;
    CutHub[name] = patched;
  }

  function patchBookingSend() {
    const original = CutHub.sendAppointmentPayload;
    if (typeof original !== "function" || original.__calendarPatched) return;

    const patched = async function patchedSendAppointmentPayload(payload) {
      const result = await original.apply(this, arguments);
      const appointment = result && typeof result === "object" ? result : { ...payload, id: Date.now() };

      setTimeout(() => {
        try {
          CutHub.downloadAppointmentICS(appointment);
          CutHub.showToast?.("Agenda gerada", "Arquivo .ics baixado para adicionar ao calendário.", "success");
        } catch (error) {
          console.warn("[CutHub Calendar] não foi possível gerar ICS", error);
        }
      }, 350);

      return result;
    };

    patched.__calendarPatched = true;
    CutHub.sendAppointmentPayload = patched;
  }



  CutHub.showAppointmentCalendarPrompt = function showAppointmentCalendarPrompt(appointment) {
    if (!appointment) return;

    let modal = document.getElementById("postBookingCalendarModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "postBookingCalendarModal";
      modal.className = "modal hidden";
      modal.innerHTML = `
  <div class="calendar-modal-card">
    <button class="calendar-modal-close" type="button" data-calendar-close>×</button>

    <span class="panel-eyebrow">Agendamento confirmado</span>

    <h2>Adicionar a agenda</h2>

    <p class="calendar-modal-main" id="postBookingCalendarSummary">
  Agendamento confirmado. Escolha como deseja enviar para a agenda.
   </p>

    <div class="calendar-modal-actions">
      <button class="secondary-button" type="button" data-calendar-download>
        Apple/Outlook
      </button>
      <button class="primary-button" type="button" data-calendar-google>
        Google Agenda
      </button>
      <button class="secondary-button ghost-button" type="button" data-calendar-close>
        Fechar
      </button>
    </div>
     </div>
       `;
      document.body.appendChild(modal);

      const close = () => modal.classList.add("hidden");
      document.getElementById("closePostBookingCalendarModal")?.addEventListener("click", close);
      document.getElementById("skipPostBookingCalendar")?.addEventListener("click", close);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) close();
      });

      document.getElementById("downloadPostBookingICS")?.addEventListener("click", () => {
        try {
          CutHub.downloadAppointmentICS(CutHub.lastCreatedCalendarAppointment);
          CutHub.showToast?.("Agenda gerada", "Arquivo .ics baixado com sucesso.", "success");
        } catch (error) {
          CutHub.showToast?.("Erro na agenda", error.message || "Não foi possível gerar o arquivo.", "error");
        }
      });

      document.getElementById("openPostBookingGoogle")?.addEventListener("click", () => {
        try {
          CutHub.openAppointmentGoogleCalendar(CutHub.lastCreatedCalendarAppointment);
        } catch (error) {
          CutHub.showToast?.("Erro na agenda", error.message || "Não foi possível abrir o Google Agenda.", "error");
        }
      });
    }

    CutHub.lastCreatedCalendarAppointment = appointment;

    const info = CutHub.getCalendarAppointmentInfo(appointment);
    const summary = document.getElementById("postBookingCalendarSummary");
    if (summary) {
      const date = info.when?.start
        ? info.when.start.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "data não definida";

      summary.textContent = `${safe(info.service?.name, "Atendimento")} de ${safe(info.client?.name, "Cliente")} com ${safe(info.barber?.name, "barbeiro")} em ${date}.`;
    }

    modal.classList.remove("hidden");
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-calendar-action]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const appointment = getAppointmentFromButton(button);
    if (!appointment) {
      CutHub.showToast?.("Agenda indisponível", "Não encontrei esse agendamento na tela.", "error");
      return;
    }

    try {
      if (button.dataset.calendarAction === "google") {
        CutHub.openAppointmentGoogleCalendar(appointment);
      } else {
        CutHub.downloadAppointmentICS(appointment);
      }
    } catch (error) {
      CutHub.showToast?.("Erro na agenda", error.message || "Não foi possível gerar o evento.", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    patchRenderer("renderDashboardDayDetails", CutHub.attachCalendarButtonsToDashboard);
    patchRenderer("renderTabletList", CutHub.attachCalendarButtonsToTablet);
    patchBookingSend();

    const style = document.createElement("style");
    style.textContent = `
      .cuthub-calendar-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
      .cuthub-calendar-button { padding: 8px 12px; font-size: 0.82rem; }
      .dashboard-day-appointment-card .cuthub-calendar-actions { justify-content: flex-end; }
      .cuthub-calendar-prompt-modal { max-width: 560px; }
      .cuthub-calendar-prompt-body { color: var(--text-muted, #9fb0c7); line-height: 1.55; margin: 12px 0 18px; }
      .cuthub-calendar-prompt-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    `;
    document.head.appendChild(style);
  });
})();