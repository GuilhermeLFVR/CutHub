/* CutHub camera-fix.js - botão de correção de espelhamento
   Carregar como ÚLTIMO script do projeto.
*/

(function cuthubCameraMirrorToggle() {
  window.CutHub = window.CutHub || {};

  const STORAGE_KEY = "cuthub_camera_mirror_fix_enabled";

  function isMirrorFixEnabled() {
    return localStorage.getItem(STORAGE_KEY) === "true";
  }

  function setMirrorFixEnabled(value) {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  }

  function getVideos() {
    return document.querySelectorAll(
      "#recognitionVideo, #faceCaptureVideo, #photoCaptureVideo, #webcamVideo, #cameraVideo"
    );
  }

  function getPreviewImages() {
    return document.querySelectorAll(
      ".face-preview-card img, .cuthub-face-preview, .recognized-avatar img, #facePreviewImage, [id^='facePreview_']"
    );
  }

  function applyCameraOrientation() {
    const shouldFlip = isMirrorFixEnabled();

    getVideos().forEach((video) => {
      video.style.transform = shouldFlip ? "scaleX(-1)" : "none";
      video.style.webkitTransform = shouldFlip ? "scaleX(-1)" : "none";
    });

    getPreviewImages().forEach((img) => {
      img.style.transform = "none";
      img.style.webkitTransform = "none";
    });

    document.querySelectorAll("[data-camera-mirror-toggle]").forEach((button) => {
      button.textContent = shouldFlip ? "Remover correção" : "Corrigir espelhamento";
      button.classList.toggle("active", shouldFlip);
    });
  }

  function drawFrame(video, canvas) {
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return "";

    const shouldFlip = isMirrorFixEnabled();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shouldFlip) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL("image/jpeg", 0.92);
  }

  function ensureToggleButton() {
    const modal = document.getElementById("recognitionModal") || document.getElementById("faceCaptureModal");
    if (!modal) return;

    const actions =
      modal.querySelector(".cuthub-recognition-actions") ||
      modal.querySelector(".cuthub-face-actions") ||
      modal.querySelector(".modal-header");

    if (!actions) return;

    if (actions.querySelector("[data-camera-mirror-toggle]")) {
      applyCameraOrientation();
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.cameraMirrorToggle = "true";
    button.className = "secondary-button camera-mirror-toggle";
    button.textContent = isMirrorFixEnabled() ? "Remover correção" : "Corrigir espelhamento";

    button.addEventListener("click", () => {
      setMirrorFixEnabled(!isMirrorFixEnabled());
      applyCameraOrientation();
      CutHub.showToast?.(
        "Câmera ajustada",
        isMirrorFixEnabled()
          ? "Correção de espelhamento ativada."
          : "Correção de espelhamento desativada.",
        "success"
      );
    });

    actions.insertBefore(button, actions.firstChild);
    applyCameraOrientation();
  }

  function patchCameraStarter(functionName) {
    const original = CutHub[functionName];

    if (typeof original !== "function" || original.__mirrorTogglePatched) return;

    const patched = async function (...args) {
      const result = await original.apply(this, args);
      setTimeout(() => {
        ensureToggleButton();
        applyCameraOrientation();
      }, 100);
      setTimeout(applyCameraOrientation, 400);
      return result;
    };

    patched.__mirrorTogglePatched = true;
    CutHub[functionName] = patched;
  }

  patchCameraStarter("startRecognitionCamera");
  patchCameraStarter("startFaceCamera");
  patchCameraStarter("startPhotoCamera");
  patchCameraStarter("openCamera");

  const originalOpenRecognitionModal = CutHub.openRecognitionModal;
  if (typeof originalOpenRecognitionModal === "function" && !originalOpenRecognitionModal.__mirrorTogglePatched) {
    const patched = async function (...args) {
      const result = await originalOpenRecognitionModal.apply(this, args);
      setTimeout(() => {
        ensureToggleButton();
        applyCameraOrientation();
      }, 120);
      return result;
    };
    patched.__mirrorTogglePatched = true;
    CutHub.openRecognitionModal = patched;
  }

  const originalOpenFaceCaptureModal = CutHub.openFaceCaptureModal;
  if (typeof originalOpenFaceCaptureModal === "function" && !originalOpenFaceCaptureModal.__mirrorTogglePatched) {
    const patched = async function (...args) {
      const result = await originalOpenFaceCaptureModal.apply(this, args);
      setTimeout(() => {
        ensureToggleButton();
        applyCameraOrientation();
      }, 120);
      return result;
    };
    patched.__mirrorTogglePatched = true;
    CutHub.openFaceCaptureModal = patched;
  }

  CutHub.captureRecognitionFrame = function () {
    const video = document.getElementById("recognitionVideo");
    const canvas = document.getElementById("recognitionCanvas");

    const imageData = drawFrame(video, canvas);

    if (!imageData) {
      CutHub.showToast?.("Câmera sem imagem", "Espere a câmera carregar antes de capturar.", "error");
      return;
    }

    const quality =
      typeof CutHub.calculateRecognitionQuality === "function"
        ? CutHub.calculateRecognitionQuality(video)
        : { score: 0 };

    CutHub.recognition = CutHub.recognition || {};
    CutHub.recognition.imageData = imageData;

    CutHub.setText?.(
      "recognitionMeta",
      `Frame capturado. Qualidade local: ${quality.score || 0}%. Agora analise com OpenCV.`
    );

    CutHub.showToast?.("Frame capturado", "Imagem capturada na orientação exibida.", "success");
  };

  CutHub.captureFaceFrame = function () {
    const video = document.getElementById("faceCaptureVideo");
    const canvas = document.getElementById("faceCaptureCanvas");

    const imageData = drawFrame(video, canvas);

    if (!imageData) {
      CutHub.showToast?.("Câmera sem imagem", "Espere a câmera carregar antes de capturar.", "error");
      return;
    }

    const quality =
      typeof CutHub.calculateFrameQuality === "function"
        ? CutHub.calculateFrameQuality(video)
        : { score: 100 };

    CutHub.faceCapture = CutHub.faceCapture || { currentPose: "front", captures: {} };
    CutHub.faceCapture.captures = CutHub.faceCapture.captures || {};

    const pose = CutHub.faceCapture.currentPose || "front";
    CutHub.faceCapture.captures[pose] = imageData;

    const preview = document.getElementById(`facePreview_${pose}`);
    const card = document.querySelector(`[data-preview-card="${pose}"]`);

    if (preview) {
      preview.src = imageData;
      preview.classList.remove("hidden");
      preview.style.transform = "none";
      preview.style.webkitTransform = "none";
    }

    if (card) {
      card.classList.add("done");
      const small = card.querySelector("small");
      if (small) small.textContent = `OK · ${quality.score || 100}%`;
    }

    const filled = Object.values(CutHub.faceCapture.captures).filter(Boolean).length;
    const saveButton = document.getElementById("saveFaceCaptureButton");
    if (saveButton) saveButton.disabled = filled < 1;

    CutHub.setText?.("faceCaptureStatus", `${filled}/3 poses capturadas.`);
    CutHub.showToast?.("Pose capturada", "Imagem capturada na orientação exibida.", "success");

    const nextPose = ["front", "left", "right"].find((key) => !CutHub.faceCapture.captures[key]);
    if (nextPose) {
      CutHub.faceCapture.currentPose = nextPose;
      document.querySelectorAll("[data-face-pose]").forEach((button) => {
        button.classList.toggle("active", button.dataset.facePose === nextPose);
      });
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      ensureToggleButton();
      applyCameraOrientation();
    }, 400);
  });

  document.addEventListener("click", () => {
    setTimeout(() => {
      ensureToggleButton();
      applyCameraOrientation();
    }, 80);
  }, true);

  window.CutHubToggleCameraMirror = function () {
    setMirrorFixEnabled(!isMirrorFixEnabled());
    applyCameraOrientation();
  };

  window.CutHubApplyCameraOrientation = applyCameraOrientation;
})();