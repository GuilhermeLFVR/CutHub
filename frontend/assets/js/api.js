/* CutHub api.js */
window.CutHub = window.CutHub || {};

CutHub.getAuthHeaders = function getAuthHeaders(extra = {}) {
  const user = CutHub.getCurrentUser?.();

  return {
    ...(user ? {
      "X-User-Id": String(user.id),
      "X-User-Role": String(user.role),
    } : {}),
    ...extra,
  };
};

CutHub.api = async function api(path, options = {}) {
  const response = await fetch(`${CutHub.API_BASE}${path}`, {
    ...options,
    headers: CutHub.getAuthHeaders({
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    }),
  });

  if (!response.ok) {
    let message = "Não foi possível completar a operação.";

    try {
      const payload = await response.json();
      message = payload.detail || payload.message || message;
    } catch (_) {}

    throw new Error(message);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

CutHub.get = function get(path) {
  return CutHub.api(path);
};

CutHub.post = function post(path, payload = {}) {
  return CutHub.api(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

CutHub.put = function put(path, payload = {}) {
  return CutHub.api(path, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

CutHub.del = function del(path) {
  return CutHub.api(path, {
    method: "DELETE",
  });
};

CutHub.loadCoreData = async function loadCoreData() {
  const [clients, services, barbers, appointments, haircuts, subscriptionPlans, subscriptions] = await Promise.all([
    CutHub.get("/clients").catch(() => []),
    CutHub.get("/services").catch(() => []),
    CutHub.get("/barbers").catch(() => []),
    CutHub.get("/appointments").catch(() => []),
    CutHub.get("/haircuts").catch(() => []),
    CutHub.get("/subscription-plans").catch(() => []),
    CutHub.get("/subscriptions").catch(() => []),
  ]);

  CutHub.state.clients = Array.isArray(clients) ? clients : [];
  CutHub.state.services = Array.isArray(services) ? services : [];
  CutHub.state.barbers = Array.isArray(barbers) ? barbers : [];
  CutHub.state.appointments = Array.isArray(appointments) ? appointments : [];
  CutHub.state.haircuts = Array.isArray(haircuts) ? haircuts : [];
  CutHub.state.subscriptionPlans = Array.isArray(subscriptionPlans) ? subscriptionPlans : [];
  CutHub.state.subscriptions = Array.isArray(subscriptions) ? subscriptions : [];

  return CutHub.state;
};

CutHub.refreshHaircuts = async function refreshHaircuts(clientId = null) {
  const query = clientId ? `?client_id=${encodeURIComponent(clientId)}` : "";
  const haircuts = await CutHub.get(`/haircuts${query}`).catch(() => []);
  CutHub.state.haircuts = Array.isArray(haircuts) ? haircuts : [];
  return CutHub.state.haircuts;
};

CutHub.refreshAppointments = async function refreshAppointments() {
  const appointments = await CutHub.get("/appointments").catch(() => []);
  CutHub.state.appointments = Array.isArray(appointments) ? appointments : [];
  return CutHub.state.appointments;
};