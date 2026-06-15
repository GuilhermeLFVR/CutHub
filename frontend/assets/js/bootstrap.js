/* CutHub bootstrap.js */
window.CutHub = window.CutHub || {};

CutHub.bindGlobalEvents = function bindGlobalEvents() {
  CutHub.bindAuthEvents?.();
  CutHub.bindRouterEvents?.();
  CutHub.bindClientEvents?.();
  CutHub.bindBookingEvents?.();
  CutHub.bindAvailabilityEvents?.();
  CutHub.bindHistoryEvents?.();
  CutHub.bindTabletEvents?.();
  CutHub.bindUserEvents?.();
};

CutHub.bootstrapApp = async function bootstrapApp() {
  const user = CutHub.getCurrentUser();

  if (!user) {
    CutHub.showLoginScreen();
    return;
  }

  CutHub.showAuthenticatedApp(user);
  CutHub.applyRoleVisibility(user.role);

  await CutHub.loadCoreData().catch((error) => {
    console.error(error);
    CutHub.showToast("Aviso", "Alguns dados não foram carregados.", "error");
  });

  await CutHub.switchSection(CutHub.defaultSectionForRole());

  setTimeout(() => CutHub.hideLoader(), 450);
};

document.addEventListener("DOMContentLoaded", async () => {
  CutHub.bindGlobalEvents();
  await CutHub.bootstrapApp();
});

window.initializeDashboardApp = CutHub.bootstrapApp;