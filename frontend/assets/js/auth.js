/* CutHub auth.js */
window.CutHub = window.CutHub || {};

CutHub.applyRoleVisibility = function applyRoleVisibility(role = CutHub.getRole()) {
  document.body.dataset.userRole = role || "guest";

  CutHub.$$("[data-role-admin-only]").forEach((element) => {
    element.classList.toggle("hidden", role !== "admin");
  });

  const visibleByRole = {
    admin: ["finance", "betting", "booking", "availability", "history", "users", "barber-tablet"],
    barber: ["finance", "betting", "booking", "availability", "history", "barber-tablet"],
    client: ["booking", "history"],
  };

  const allowed = visibleByRole[role] || [];

  CutHub.$$("[data-section-target]").forEach((element) => {
    const section = element.dataset.sectionTarget;
    if (!section) return;
    element.classList.toggle("hidden", allowed.length > 0 && !allowed.includes(section));
  });
};

CutHub.showLoginScreen = function showLoginScreen() {
  CutHub.show("#authScreen");
  document.getElementById("appShell")?.classList.add("auth-locked");
  CutHub.hideLoader();
};

CutHub.showAuthenticatedApp = function showAuthenticatedApp(user) {
  CutHub.hide("#authScreen");
  document.getElementById("appShell")?.classList.remove("auth-locked");

  CutHub.show("#currentUserBox");
  CutHub.setText("currentUserName", user?.name || "Usuário");
  CutHub.setText("currentUserRole", CutHub.roleLabel(user?.role));

  CutHub.applyRoleVisibility(user?.role);
};

CutHub.ensureDefaultAdmin = async function ensureDefaultAdmin() {
  await fetch(`${CutHub.API_BASE}/auth/seed-admin`, { method: "POST" }).catch(() => null);
};

CutHub.handleLoginSubmit = async function handleLoginSubmit(event) {
  event.preventDefault();

  const button = document.getElementById("loginButton");
  const error = document.getElementById("loginError");
  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;

  if (error) {
    error.classList.add("hidden");
    error.textContent = "";
  }

  const originalText = button?.textContent || "Entrar";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Entrando...";
    }

    await CutHub.ensureDefaultAdmin();

    const response = await fetch(`${CutHub.API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      let message = "Email ou senha inválidos.";
      try {
        const payload = await response.json();
        message = payload.detail || message;
      } catch (_) {}
      throw new Error(message);
    }

    const data = await response.json();
    CutHub.storeUser(data.user);
    CutHub.showAuthenticatedApp(data.user);
    await CutHub.bootstrapApp();
    CutHub.showToast("Login realizado", `Bem-vindo, ${data.user.name}.`, "success");
  } catch (err) {
    if (error) {
      error.textContent = err.message || "Não foi possível entrar.";
      error.classList.remove("hidden");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
};

CutHub.handleClientRegisterSubmit = async function handleClientRegisterSubmit(event) {
  event.preventDefault();

  const error = document.getElementById("registerError");
  const button = document.getElementById("clientRegisterButton");

  const payload = {
    name: document.getElementById("registerNameInput")?.value.trim(),
    phone: document.getElementById("registerPhoneInput")?.value.trim(),
    email: document.getElementById("registerEmailInput")?.value.trim(),
    password: document.getElementById("registerPasswordInput")?.value,
  };

  if (error) {
    error.classList.add("hidden");
    error.textContent = "";
  }

  const originalText = button?.textContent || "Criar conta de cliente";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Criando...";
    }

    const data = await CutHub.post("/auth/register-client", payload);
    CutHub.storeUser(data.user);
    CutHub.showAuthenticatedApp(data.user);
    await CutHub.bootstrapApp();
    CutHub.showToast("Conta criada", "Cadastro realizado com sucesso.", "success");
  } catch (err) {
    if (error) {
      error.textContent = err.message || "Não foi possível criar conta.";
      error.classList.remove("hidden");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
};

CutHub.bindAuthEvents = function bindAuthEvents() {
  document.getElementById("loginForm")?.addEventListener("submit", CutHub.handleLoginSubmit);
  document.getElementById("clientRegisterForm")?.addEventListener("submit", CutHub.handleClientRegisterSubmit);

  document.getElementById("logoutButton")?.addEventListener("click", () => {
    CutHub.clearStoredUser();
    window.location.reload();
  });

  document.getElementById("showLoginButton")?.addEventListener("click", () => {
    CutHub.show("#loginForm");
    CutHub.hide("#clientRegisterForm");
    document.getElementById("showLoginButton")?.classList.add("active");
    document.getElementById("showRegisterButton")?.classList.remove("active");
    CutHub.setText("authTitle", "Entrar no CutHub");
  });

  document.getElementById("showRegisterButton")?.addEventListener("click", () => {
    CutHub.hide("#loginForm");
    CutHub.show("#clientRegisterForm");
    document.getElementById("showLoginButton")?.classList.remove("active");
    document.getElementById("showRegisterButton")?.classList.add("active");
    CutHub.setText("authTitle", "Criar conta");
  });
};

window.getStoredUser = CutHub.getStoredUser;
window.getAuthHeaders = CutHub.getAuthHeaders;