/* CutHub clients.js - cadastro facial premium com múltiplas poses */

window.CutHub = window.CutHub || {};

CutHub.faceCapture = {
  clientId: null,
  stream: null,
  currentPose: "front",
  captures: {
    front: "",
    left: "",
    right: "",
  },
  qualityTimer: null,
};

CutHub.facePoses = {
  front: {
    label: "Frente",
    hint: "Olhe direto para a câmera.",
  },
  left: {
    label: "Leve esquerda",
    hint: "Vire levemente o rosto para a esquerda.",
  },
  right: {
    label: "Leve direita",
    hint: "Vire levemente o rosto para a direita.",
  },
};

CutHub.getClientHaircuts = function getClientHaircuts(clientId) {
  return CutHub.state.haircuts
    .filter((record) => Number(record.client_id) === Number(clientId))
    .sort((a, b) => String(b.cut_date || "").localeCompare(String(a.cut_date || "")) || Number(b.id || 0) - Number(a.id || 0));
};

CutHub.calculateFrameQuality = function calculateFrameQuality(video) {
  if (!video || !video.videoWidth) {
    return { brightness: 0, sharpness: 0, score: 0, label: "Aguardando câmera" };
  }

  const canvas = document.createElement("canvas");
  const width = 180;
  const height = Math.round((video.videoHeight / video.videoWidth) * width);
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);

  let totalBrightness = 0;
  let contrastTotal = 0;
  let previous = null;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    totalBrightness += brightness;

    if (previous !== null) {
      contrastTotal += Math.abs(brightness - previous);
    }

    previous = brightness;
  }

  const samples = data.length / 16;
  const brightnessAvg = totalBrightness / samples;
  const sharpness = Math.min(100, (contrastTotal / samples) * 2.6);
  const brightnessScore = Math.max(0, Math.min(100, 100 - Math.abs(145 - brightnessAvg) * 1.2));
  const score = Math.round((brightnessScore * 0.48) + (sharpness * 0.52));

  let label = "Boa captura";
  if (score < 35) label = "Imagem ruim";
  else if (score < 60) label = "Ajuste a luz";
  else if (score < 78) label = "Boa, mas pode melhorar";

  return {
    brightness: Math.round(brightnessScore),
    sharpness: Math.round(sharpness),
    score,
    label,
  };
};

CutHub.renderFaceQuality = function renderFaceQuality() {
  const video = document.getElementById("faceCaptureVideo");
  const quality = CutHub.calculateFrameQuality(video);

  const ring = document.getElementById("faceQualityRing");
  const score = document.getElementById("faceQualityScore");
  const label = document.getElementById("faceQualityLabel");
  const brightness = document.getElementById("faceBrightnessBar");
  const sharpness = document.getElementById("faceSharpnessBar");

  if (ring) {
    ring.style.setProperty("--quality", `${quality.score}%`);
    ring.dataset.quality = quality.score >= 70 ? "good" : quality.score >= 45 ? "mid" : "bad";
  }

  if (score) score.textContent = `${quality.score}%`;
  if (label) label.textContent = quality.label;
  if (brightness) brightness.style.width = `${quality.brightness}%`;
  if (sharpness) sharpness.style.width = `${quality.sharpness}%`;
};

CutHub.ensureFaceCaptureModal = function ensureFaceCaptureModal() {
  if (document.getElementById("faceCaptureModal")) return;

  const modal = document.createElement("div");
  modal.id = "faceCaptureModal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-content moving-border cuthub-face-modal premium-face-modal">
      <div class="modal-header">
        <div>
          <span class="panel-eyebrow">Cadastro facial OpenCV</span>
          <h2>Treinar rosto do cliente</h2>
          <p id="faceCaptureClientName" class="module-switcher-description">Cliente</p>
        </div>
        <button id="closeFaceCaptureModalButton" class="icon-button" type="button">×</button>
      </div>

      <div class="face-training-layout">
        <section class="face-camera-stage">
          <div class="face-camera-frame">
            <video id="faceCaptureVideo" autoplay playsinline muted></video>
            <canvas id="faceCaptureCanvas" class="hidden"></canvas>
            <div class="face-scan-overlay">
              <div class="face-target-frame"></div>
              <span class="face-scan-line"></span>
            </div>
          </div>

          <div class="face-pose-tabs">
            ${Object.entries(CutHub.facePoses).map(([key, pose]) => `
              <button class="face-pose-button ${key === "front" ? "active" : ""}" type="button" data-face-pose="${key}">
                <strong>${pose.label}</strong>
                <small>${pose.hint}</small>
              </button>
            `).join("")}
          </div>
        </section>

        <aside class="face-training-panel">
          <div id="faceQualityRing" class="face-quality-ring" data-quality="mid">
            <div>
              <strong id="faceQualityScore">0%</strong>
              <span id="faceQualityLabel">Aguardando câmera</span>
            </div>
          </div>

          <div class="face-quality-bars">
            <div>
              <span>Iluminação</span>
              <div class="face-bar"><i id="faceBrightnessBar"></i></div>
            </div>
            <div>
              <span>Nitidez</span>
              <div class="face-bar"><i id="faceSharpnessBar"></i></div>
            </div>
          </div>

          <div class="face-capture-previews">
            ${Object.entries(CutHub.facePoses).map(([key, pose]) => `
              <article class="face-preview-card" data-preview-card="${key}">
                <span>${pose.label}</span>
                <img id="facePreview_${key}" class="hidden" alt="${pose.label}" />
                <small>Pendente</small>
              </article>
            `).join("")}
          </div>

          <p id="faceCaptureStatus" class="cuthub-face-status">
            Capture as três poses para melhorar a chance de reconhecimento.
          </p>

          <div class="cuthub-face-actions">
            <button id="captureFaceButton" class="secondary-button" type="button">Capturar pose atual</button>
            <button id="saveFaceCaptureButton" class="primary-button" type="button" disabled>Salvar treinamento</button>
            <button id="cancelFaceCaptureButton" class="danger-button" type="button">Cancelar</button>
          </div>
        </aside>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("closeFaceCaptureModalButton")?.addEventListener("click", CutHub.closeFaceCaptureModal);
  document.getElementById("cancelFaceCaptureButton")?.addEventListener("click", CutHub.closeFaceCaptureModal);
  document.getElementById("captureFaceButton")?.addEventListener("click", CutHub.captureFaceFrame);
  document.getElementById("saveFaceCaptureButton")?.addEventListener("click", CutHub.saveClientFaceCapture);

  document.querySelectorAll("[data-face-pose]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.faceCapture.currentPose = button.dataset.facePose;
      document.querySelectorAll("[data-face-pose]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const pose = CutHub.facePoses[CutHub.faceCapture.currentPose];
      CutHub.setText("faceCaptureStatus", pose.hint);
    });
  });
};

CutHub.startFaceCamera = async function startFaceCamera() {
  const video = document.getElementById("faceCaptureVideo");

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Navegador não liberou acesso à câmera.");
  }

  CutHub.stopFaceCamera();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  CutHub.faceCapture.stream = stream;

  if (video) {
    video.srcObject = stream;
    await video.play();
  }

  clearInterval(CutHub.faceCapture.qualityTimer);
  CutHub.faceCapture.qualityTimer = setInterval(CutHub.renderFaceQuality, 650);

  CutHub.setText("faceCaptureStatus", "Câmera ativa. Capture frente, esquerda e direita.");
};

CutHub.stopFaceCamera = function stopFaceCamera() {
  clearInterval(CutHub.faceCapture.qualityTimer);
  CutHub.faceCapture.qualityTimer = null;

  if (CutHub.faceCapture.stream) {
    CutHub.faceCapture.stream.getTracks().forEach((track) => track.stop());
    CutHub.faceCapture.stream = null;
  }
};

CutHub.openFaceCaptureModal = async function openFaceCaptureModal(client) {
  CutHub.ensureFaceCaptureModal();

  CutHub.faceCapture.clientId = client.id;
  CutHub.faceCapture.currentPose = "front";
  CutHub.faceCapture.captures = { front: "", left: "", right: "" };

  CutHub.setText("faceCaptureClientName", client.name || "Cliente");
  CutHub.setText("faceCaptureStatus", "Abrindo câmera...");

  document.querySelectorAll("[data-face-pose]").forEach((button) => {
    button.classList.toggle("active", button.dataset.facePose === "front");
  });

  document.querySelectorAll(".face-preview-card").forEach((card) => {
    card.classList.remove("done");
    card.querySelector("small").textContent = "Pendente";
    card.querySelector("img")?.classList.add("hidden");
  });

  document.getElementById("saveFaceCaptureButton").disabled = true;
  document.getElementById("faceCaptureModal")?.classList.remove("hidden");

  try {
    await CutHub.startFaceCamera();
  } catch (error) {
    CutHub.setText("faceCaptureStatus", error.message);
    CutHub.showToast("Câmera indisponível", error.message, "error");
  }
};

CutHub.closeFaceCaptureModal = function closeFaceCaptureModal() {
  CutHub.stopFaceCamera();
  document.getElementById("faceCaptureModal")?.classList.add("hidden");
  CutHub.faceCapture.clientId = null;
};

CutHub.captureFaceFrame = function captureFaceFrame() {
  const video = document.getElementById("faceCaptureVideo");
  const canvas = document.getElementById("faceCaptureCanvas");

  if (!video || !canvas || !video.videoWidth) {
    CutHub.showToast("Câmera sem imagem", "Espere a câmera carregar antes de capturar.", "error");
    return;
  }

  const quality = CutHub.calculateFrameQuality(video);
  if (quality.score < 35) {
    CutHub.showToast("Imagem fraca", "Melhore a iluminação antes de salvar essa pose.", "error");
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = canvas.toDataURL("image/jpeg", 0.92);
  const pose = CutHub.faceCapture.currentPose;

  CutHub.faceCapture.captures[pose] = imageData;

  const preview = document.getElementById(`facePreview_${pose}`);
  const card = document.querySelector(`[data-preview-card="${pose}"]`);

  if (preview) {
    preview.src = imageData;
    preview.classList.remove("hidden");
  }

  if (card) {
    card.classList.add("done");
    card.querySelector("small").textContent = `OK · ${quality.score}%`;
  }

  const filled = Object.values(CutHub.faceCapture.captures).filter(Boolean).length;
  document.getElementById("saveFaceCaptureButton").disabled = filled < 1;

  CutHub.setText("faceCaptureStatus", `${filled}/3 poses capturadas. Quanto mais poses, melhor o reconhecimento.`);
  CutHub.showToast("Pose capturada", `${CutHub.facePoses[pose].label} salva no treinamento.`, "success");

  const nextPose = ["front", "left", "right"].find((key) => !CutHub.faceCapture.captures[key]);
  if (nextPose) {
    CutHub.faceCapture.currentPose = nextPose;
    document.querySelectorAll("[data-face-pose]").forEach((button) => {
      button.classList.toggle("active", button.dataset.facePose === nextPose);
    });
  }
};

CutHub.saveClientFaceCapture = async function saveClientFaceCapture() {
  const clientId = CutHub.faceCapture.clientId;
  const captures = CutHub.faceCapture.captures;
  const imageData = captures.front || captures.left || captures.right;

  if (!clientId || !imageData) {
    CutHub.showToast("Nada capturado", "Capture ao menos uma pose antes de salvar.", "error");
    return;
  }

  const button = document.getElementById("saveFaceCaptureButton");
  const originalText = button?.textContent || "Salvar treinamento";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Treinando...";
    }

    await CutHub.post(`/clients/${clientId}/face`, {
      image_data: imageData,
      training_images: captures,
    });

    CutHub.showToast("Treinamento salvo", "Rosto vinculado ao cliente com sucesso.", "success");
    CutHub.closeFaceCaptureModal();
    await CutHub.loadCoreData();
    await CutHub.renderClients();
  } catch (error) {
    CutHub.showToast("Erro no cadastro facial", error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
};

CutHub.renderClients = async function renderClients() {
  await CutHub.loadCoreData();

  const list = document.getElementById("registeredClientsList")
    || document.getElementById("clientsList")
    || document.getElementById("bettingOperationsList");

  if (!list) return;

  const search = CutHub.normalize(document.getElementById("clientSearchInput")?.value || document.getElementById("bettingSearchInput")?.value || "");

  const clients = CutHub.state.clients.filter((client) => {
    if (!search) return true;
    return CutHub.normalize(`${client.name} ${client.email} ${client.phone} ${client.preferred_cut} ${client.notes}`).includes(search);
  });

  list.innerHTML = clients.length ? clients.map((client) => {
    const haircuts = CutHub.getClientHaircuts(client.id);
    const last = haircuts[0];
    const photoRecords = haircuts.filter((record) => String(record.photo_url || "").trim()).slice(0, 4);
    const status = String(client.status || "active").toLowerCase();
    const isInactive = status === "inactive" || status === "blocked";
    const faceOk = String(client.face_image_url || "").trim();

    return `
      <article class="cuthub-registered-client-card ${isInactive ? "client-inactive" : ""}">
        <div class="cuthub-registered-client-main">
          <div>
            <div class="cuthub-client-title-row">
              <strong>${CutHub.safeText(client.name, "Cliente")}</strong>
              <span class="face-status ${faceOk ? "face-status-ok" : "face-status-empty"}">${faceOk ? "Rosto treinado" : "Sem rosto"}</span>
              <span class="cuthub-status-pill ${isInactive ? "inactive" : "active"}">${isInactive ? "Inativo" : "Ativo"}</span>
            </div>
            <span>${CutHub.safeText(client.phone, "Sem telefone")} · ${CutHub.safeText(client.email, "Sem email")}</span>
            <small>${haircuts.length} corte${haircuts.length === 1 ? "" : "s"} · ${last ? `último em ${CutHub.formatDate(last.cut_date)}` : "sem histórico"}</small>
            <small>Preferência: ${CutHub.safeText(client.preferred_cut, "Não informada")}</small>
          </div>
          <div class="cuthub-list-actions">
            <button class="secondary-button cuthub-open-client-history" data-id="${client.id}" type="button">Histórico</button>
            <button class="secondary-button cuthub-face-client" data-id="${client.id}" type="button">Treinar rosto</button>
            ${!CutHub.isClient() ? `<button class="edit-button cuthub-edit-client" data-id="${client.id}" type="button">Editar</button>` : ""}
            ${!CutHub.isClient() ? `<button class="danger-button cuthub-toggle-client-status" data-id="${client.id}" type="button">${isInactive ? "Reativar" : "Bloquear"}</button>` : ""}
          </div>
        </div>
        <div class="cuthub-client-thumbs">
          ${photoRecords.length ? photoRecords.map((record) => {
            const photo = String(record.photo_url || "").trim();
            const label = CutHub.cleanHistoryText?.(record.title, "Foto do histórico") || "Foto do histórico";
            return `<button class="cuthub-client-thumb" type="button" style="background-image:url('${photo}')" data-photo="${photo}" data-label="${label}">${label}</button>`;
          }).join("") : `<span class="cuthub-client-thumb cuthub-client-thumb-empty">Sem fotos</span>`}
        </div>
      </article>
    `;
  }).join("") : `<div class="cuthub-empty-mini">Nenhum cliente encontrado.</div>`;

  CutHub.$$(".cuthub-open-client-history").forEach((button) => {
    button.addEventListener("click", async () => {
      CutHub.state.selectedClientId = Number(button.dataset.id);
      await CutHub.switchSection("history");
    });
  });

  CutHub.$$(".cuthub-client-thumb[data-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      CutHub.openPhotoViewer?.(button.dataset.photo, button.dataset.label, "Histórico do cliente");
    });
  });

  CutHub.$$(".cuthub-face-client").forEach((button) => {
    button.addEventListener("click", async () => {
      const client = CutHub.findById(CutHub.state.clients, button.dataset.id);
      if (client) await CutHub.openFaceCaptureModal(client);
    });
  });

  CutHub.$$(".cuthub-toggle-client-status").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.id);
      const client = CutHub.findById(CutHub.state.clients, id);
      if (!client) return;

      const isInactive = ["inactive", "blocked"].includes(String(client.status || "").toLowerCase());
      const nextStatus = isInactive ? "active" : "inactive";

      await CutHub.api(`/clients/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      CutHub.showToast("Cliente atualizado", nextStatus === "inactive" ? "Cliente bloqueado." : "Cliente reativado.", "success");
      await CutHub.renderClients();
    });
  });
};

CutHub.bindClientEvents = function bindClientEvents() {
  document.getElementById("clientSearchInput")?.addEventListener("input", CutHub.renderClients);
  document.getElementById("bettingSearchInput")?.addEventListener("input", CutHub.renderClients);
};