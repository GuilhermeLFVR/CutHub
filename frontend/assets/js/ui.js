/* CutHub ui.js */
window.CutHub = window.CutHub || {};

CutHub.$ = function $(selector, parent = document) {
  return parent.querySelector(selector);
};

CutHub.$$ = function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
};

CutHub.show = function show(elementOrSelector) {
  const element = typeof elementOrSelector === "string" ? CutHub.$(elementOrSelector) : elementOrSelector;
  element?.classList.remove("hidden");
};

CutHub.hide = function hide(elementOrSelector) {
  const element = typeof elementOrSelector === "string" ? CutHub.$(elementOrSelector) : elementOrSelector;
  element?.classList.add("hidden");
};

CutHub.setText = function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
};

CutHub.safeText = function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
};

CutHub.cleanHistoryText = function cleanHistoryText(value, fallback = "Sem observações") {
  return CutHub.safeText(value, fallback)
    .replace(/\[?FOTO_TIPO:ANTES\]?/gi, "")
    .replace(/\[?FOTO_TIPO:DEPOIS\]?/gi, "")
    .replace(/Antes do atendimento/gi, "Foto antes")
    .replace(/Depois do atendimento/gi, "Foto depois")
    .replace(/Registro visual/gi, "Referência visual")
    .trim() || fallback;
};

CutHub.formatDate = function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
  } catch (_) {
    return String(value).slice(0, 10);
  }
};

CutHub.formatDateTime = function formatDateTime(value) {
  if (!value) return "-";

  const normalized = String(value).includes("T") ? value : `${value}T00:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

CutHub.formatCurrency = function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
};

CutHub.showToast = function showToast(title, message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) {
    console.log(`[${type}] ${title}: ${message}`);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    setTimeout(() => toast.remove(), 220);
  }, 2600);
};

CutHub.hideLoader = function hideLoader() {
  document.getElementById("appLoader")?.classList.add("hidden");
};

CutHub.openModal = function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
};

CutHub.closeModal = function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
};

CutHub.openPhotoViewer = function openPhotoViewer(url, label = "Foto", title = "Visualizador") {
  if (!url) return;

  const existing = document.getElementById("cuthubPhotoViewerModal");
  existing?.remove();

  let zoom = 1;
  const minZoom = 1;
  const maxZoom = 3.5;
  const step = 0.25;

  const modal = document.createElement("div");
  modal.id = "cuthubPhotoViewerModal";
  modal.className = "modal-backdrop cuthub-photo-viewer-backdrop";
  modal.innerHTML = `
    <div class="modal-card cuthub-photo-viewer-card" role="dialog" aria-modal="true" aria-label="${label}">
      <div class="modal-header cuthub-photo-viewer-header">
        <div>
          <span class="panel-eyebrow">${title}</span>
          <h2>${label}</h2>
        </div>
        <div class="cuthub-photo-viewer-actions">
          <button class="secondary-button" type="button" data-photo-zoom-out>−</button>
          <span data-photo-zoom-label>100%</span>
          <button class="secondary-button" type="button" data-photo-zoom-in>+</button>
          <button class="secondary-button" type="button" data-photo-zoom-reset>Resetar</button>
          <button class="icon-button" type="button" data-close-photo-viewer>✕</button>
        </div>
      </div>
      <div class="cuthub-photo-viewer-stage">
        <img src="${url}" alt="${label}" class="cuthub-photo-viewer-img" draggable="false" />
      </div>
    </div>
  `;

  const image = modal.querySelector(".cuthub-photo-viewer-img");
  const zoomLabel = modal.querySelector("[data-photo-zoom-label]");

  function applyZoom() {
    zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    if (image) image.style.transform = `scale(${zoom})`;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function closeViewer() {
    modal.remove();
    document.removeEventListener("keydown", handleKeydown);
  }

  function handleKeydown(event) {
    if (event.key === "Escape") closeViewer();
    if (event.key === "+" || event.key === "=") {
      zoom += step;
      applyZoom();
    }
    if (event.key === "-") {
      zoom -= step;
      applyZoom();
    }
    if (event.key === "0") {
      zoom = 1;
      applyZoom();
    }
  }

  document.body.appendChild(modal);
  applyZoom();

  modal.querySelector("[data-close-photo-viewer]")?.addEventListener("click", closeViewer);
  modal.querySelector("[data-photo-zoom-in]")?.addEventListener("click", () => {
    zoom += step;
    applyZoom();
  });
  modal.querySelector("[data-photo-zoom-out]")?.addEventListener("click", () => {
    zoom -= step;
    applyZoom();
  });
  modal.querySelector("[data-photo-zoom-reset]")?.addEventListener("click", () => {
    zoom = 1;
    applyZoom();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeViewer();
  });

  modal.querySelector(".cuthub-photo-viewer-stage")?.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom += event.deltaY < 0 ? step : -step;
    applyZoom();
  }, { passive: false });

  image?.addEventListener("dblclick", () => {
    zoom = zoom > 1 ? 1 : 2;
    applyZoom();
  });

  document.addEventListener("keydown", handleKeydown);
};

window.showToast = CutHub.showToast;
window.formatCurrency = CutHub.formatCurrency;
window.formatDate = CutHub.formatDate;
window.cuthubOpenPhotoViewer = CutHub.openPhotoViewer;