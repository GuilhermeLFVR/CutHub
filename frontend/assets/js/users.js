// Usuários do sistema
window.CutHub = window.CutHub || {};

CutHub.renderUsers = async function renderUsers() {
  if (!CutHub.isAdmin()) return;

  CutHub.state.users = await CutHub.get("/users").catch(() => []);

  const list = document.getElementById("usersList");
  if (!list) return;

  list.innerHTML = CutHub.state.users.length ? CutHub.state.users.map((user) => `
    <article class="cuthub-mini-card">
      <strong>${CutHub.safeText(user.name, "Usuário")}</strong>
      <span>${CutHub.safeText(user.email, "Sem email")}</span>
      <small>${CutHub.roleLabel(user.role)} · ${user.is_active ? "Ativo" : "Inativo"}</small>
    </article>
  `).join("") : `<div class="cuthub-empty-mini">Nenhum usuário cadastrado.</div>`;
};

CutHub.userErrorText = function userErrorText(error) {
  const message = String(error?.message || error || "Não foi possível criar o usuário.");

  if (message.toLowerCase().includes("email")) {
    return "Já existe um usuário com esse email. Use outro email ou confira a lista abaixo.";
  }

  return message;
};

CutHub.handleUserSubmit = async function handleUserSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button?.textContent || "Criar usuário";

  const payload = {
    name: document.getElementById("userNameInput")?.value.trim(),
    phone: document.getElementById("userPhoneInput")?.value.trim() || "",
    email: document.getElementById("userEmailInput")?.value.trim(),
    password: document.getElementById("userPasswordInput")?.value || "1234",
    role: document.getElementById("userRoleInput")?.value || "barber",
    is_active: true,
  };

  if (!payload.name || !payload.email) {
    CutHub.showToast("Dados incompletos", "Informe nome e email.", "error");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    await CutHub.post("/users", payload);

    if (payload.role === "barber") {
      const existingBarber = (CutHub.state.barbers || []).find((barber) => {
        return CutHub.normalize(barber.name) === CutHub.normalize(payload.name);
      });

      if (!existingBarber) {
        await CutHub.post("/barbers", {
          name: payload.name,
          phone: payload.phone,
          specialty: "Atendimento geral",
          status: "active",
        }).catch(() => null);
      }
    }

    form.reset();
    CutHub.showToast("Usuário criado", "Acesso criado com sucesso.", "success");
    await CutHub.loadCoreData();
    await CutHub.renderUsers();
  } catch (error) {
    CutHub.showToast("Erro ao criar usuário", CutHub.userErrorText(error), "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
};

CutHub.bindUserEvents = function bindUserEvents() {
  const form = document.getElementById("userForm");

  if (form && form.dataset.userFormBound !== "true") {
    form.dataset.userFormBound = "true";
    form.addEventListener("submit", CutHub.handleUserSubmit);
  }
};