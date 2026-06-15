/* CutHub state.js */
window.CutHub = window.CutHub || {};

CutHub.AUTH_STORAGE_KEY = "cuthub_auth_user";
CutHub.API_BASE = "/api";

CutHub.state = {
  activeSection: "finance",
  currentUser: null,

  clients: [],
  services: [],
  barbers: [],
  appointments: [],
  haircuts: [],
  users: [],

  selectedAppointmentId: null,
  selectedClientId: null,
  recognitionStream: null,
  capturedBeforePhoto: "",
  capturedAfterPhoto: "",
};

CutHub.getStoredUser = function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(CutHub.AUTH_STORAGE_KEY) || "null");
  } catch (_) {
    return null;
  }
};

CutHub.storeUser = function storeUser(user) {
  CutHub.state.currentUser = user || null;
  localStorage.setItem(CutHub.AUTH_STORAGE_KEY, JSON.stringify(user || null));
};

CutHub.clearStoredUser = function clearStoredUser() {
  CutHub.state.currentUser = null;
  localStorage.removeItem(CutHub.AUTH_STORAGE_KEY);
};

CutHub.getCurrentUser = function getCurrentUser() {
  if (!CutHub.state.currentUser) {
    CutHub.state.currentUser = CutHub.getStoredUser();
  }

  return CutHub.state.currentUser;
};

CutHub.getRole = function getRole() {
  return CutHub.getCurrentUser()?.role || "guest";
};

CutHub.isAdmin = function isAdmin() {
  return CutHub.getRole() === "admin";
};

CutHub.isBarber = function isBarber() {
  return CutHub.getRole() === "barber";
};

CutHub.isClient = function isClient() {
  return CutHub.getRole() === "client";
};

CutHub.roleLabel = function roleLabel(role) {
  const labels = {
    admin: "Administrador",
    barber: "Barbeiro",
    client: "Cliente",
  };

  return labels[role] || role || "Usuário";
};

CutHub.normalize = function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

CutHub.findById = function findById(list, id) {
  return (Array.isArray(list) ? list : []).find((item) => Number(item.id) === Number(id)) || null;
};

CutHub.todayISO = function todayISO() {
  return new Date().toISOString().slice(0, 10);
};