// Navegação entre telas
window.CutHub = window.CutHub || {};

CutHub.sectionMeta = {
  finance: {
    title: "Dashboard",
    description: "Visão geral da barbearia: clientes, agenda, serviços e atendimento.",
  },
  betting: {
    title: "Clientes",
    description: "Central para cadastro, histórico e preferências dos clientes.",
  },
  booking: {
    title: "Agendar Corte",
    description: "Monte a agenda ligando cliente, barbeiro, serviço, data e horário.",
  },
  availability: {
    title: "Disponibilidade",
    description: "Configure horários e folgas dos barbeiros.",
  },
  history: {
    title: "Histórico",
    description: "Histórico visual dos cortes, fotos e preferências dos clientes.",
  },
  users: {
    title: "Usuários",
    description: "Controle de acesso para administradores, barbeiros e clientes.",
  },
  "barber-tablet": {
    title: "Tablet Barbeiro",
    description: "Tela rápida para acompanhar referências e atendimentos.",
  },
};

CutHub.defaultSectionForRole = function defaultSectionForRole() {
  if (CutHub.isClient()) return "booking";
  return "finance";
};

CutHub.switchSection = async function switchSection(section) {
  const allowedSections = ["finance", "betting", "booking", "availability", "history", "users", "barber-tablet"];
  const target = allowedSections.includes(section) ? section : CutHub.defaultSectionForRole();

  CutHub.state.activeSection = target;

  CutHub.$$("[data-section-target]").forEach((element) => {
    element.classList.toggle("active", element.dataset.sectionTarget === target);
  });

  CutHub.$$(".module-section").forEach((element) => {
    const shouldShow = element.id === `section-${target}`;
    element.classList.toggle("hidden", !shouldShow);
    element.classList.toggle("module-section-active", shouldShow);
  });

  const meta = CutHub.sectionMeta[target] || CutHub.sectionMeta.finance;
  CutHub.setText("moduleHeading", meta.title);
  CutHub.setText("moduleDescription", meta.description);

  const loaders = {
    finance: CutHub.renderDashboard,
    betting: CutHub.renderClients,
    booking: CutHub.renderBooking,
    availability: CutHub.renderAvailability,
    history: CutHub.renderHistory,
    users: CutHub.renderUsers,
    "barber-tablet": CutHub.renderTablet,
  };

  if (loaders[target]) {
    await loaders[target]().catch((error) => {
      console.error(error);
      CutHub.showToast("Erro", error.message || "Não foi possível abrir a tela.", "error");
    });
  }
};

CutHub.bindRouterEvents = function bindRouterEvents() {
  if (document.body.dataset.routerBound === "true") return;
  document.body.dataset.routerBound = "true";

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-section-target]");
    if (!trigger) return;

    event.preventDefault();
    CutHub.switchSection(trigger.dataset.sectionTarget);
  });
};

window.switchSection = CutHub.switchSection;