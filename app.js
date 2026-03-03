const state = {
  mode: "url",
  audits: [],
  currentId: null,
  imageDataUrl: "",
  saveTimer: null,
};

const heuristics = [
  "Visibilidad del estado del sistema",
  "Relación entre el sistema y el mundo real",
  "Control y libertad del usuario",
  "Consistencia y estándares",
  "Prevención de errores",
  "Reconocimiento antes que recuerdo",
  "Flexibilidad y eficiencia de uso",
  "Diseño estético y minimalista",
  "Ayuda para reconocer, diagnosticar y recuperarse de errores",
  "Ayuda y documentación",
];

const els = {
  loginGate: document.getElementById("loginGate"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  passwordInput: document.getElementById("passwordInput"),
  togglePasswordBtn: document.getElementById("togglePasswordBtn"),
  togglePasswordIcon: document.getElementById("togglePasswordIcon"),
  loginFeedback: document.getElementById("loginFeedback"),
  auditName: document.getElementById("auditName"),
  auditAuthor: document.getElementById("auditAuthor"),
  urlModeBtn: document.getElementById("urlModeBtn"),
  imageModeBtn: document.getElementById("imageModeBtn"),
  urlInputGroup: document.getElementById("urlInputGroup"),
  imageInputGroup: document.getElementById("imageInputGroup"),
  urlInput: document.getElementById("urlInput"),
  imageInput: document.getElementById("imageInput"),
  imagePreviewWrap: document.getElementById("imagePreviewWrap"),
  imagePreview: document.getElementById("imagePreview"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  saveAuditBtn: document.getElementById("saveAuditBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  deleteAuditBtn: document.getElementById("deleteAuditBtn"),
  newAuditBtn: document.getElementById("newAuditBtn"),
  statusMessage: document.getElementById("statusMessage"),
  savedCount: document.getElementById("savedCount"),
  auditStatePill: document.getElementById("auditStatePill"),
  overallScore: document.getElementById("overallScore"),
  summaryHeadline: document.getElementById("summaryHeadline"),
  summaryBody: document.getElementById("summaryBody"),
  riskStrip: document.getElementById("riskStrip"),
  heuristicsGrid: document.getElementById("heuristicsGrid"),
  searchInput: document.getElementById("searchInput"),
  historyList: document.getElementById("historyList"),
};

async function init() {
  bindEvents();
  renderHeuristics();
  renderHistory();

  try {
    const session = await api("/api/session");
    if (session.authenticated) {
      unlockApp();
      await refreshAudits();
    } else {
      renderLockedState();
    }
  } catch {
    renderLockedState();
    announce("No se pudo conectar con el backend. Arranca el servidor Node para usar el dashboard.", true);
  }
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.togglePasswordBtn.addEventListener("click", togglePasswordVisibility);
  els.urlModeBtn.addEventListener("click", () => switchMode("url"));
  els.imageModeBtn.addEventListener("click", () => switchMode("image"));
  els.imageInput.addEventListener("change", handleImageUpload);
  els.analyzeBtn.addEventListener("click", handleAnalyze);
  els.saveAuditBtn.addEventListener("click", saveCurrentAudit);
  els.exportPdfBtn.addEventListener("click", exportCurrentAudit);
  els.deleteAuditBtn.addEventListener("click", deleteCurrentAudit);
  els.newAuditBtn.addEventListener("click", resetComposer);
  els.searchInput.addEventListener("input", renderHistory);
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    await api("/api/login", {
      method: "POST",
      body: { password: els.passwordInput.value },
    });
    els.passwordInput.value = "";
    els.loginFeedback.textContent = "";
    unlockApp();
    await refreshAudits();
  } catch (error) {
    els.loginFeedback.textContent = error.message || "No se pudo iniciar sesión.";
  }
}

function togglePasswordVisibility() {
  const reveal = els.passwordInput.type === "password";
  els.passwordInput.type = reveal ? "text" : "password";
  els.togglePasswordBtn.setAttribute("aria-pressed", String(reveal));
  els.togglePasswordBtn.setAttribute(
    "aria-label",
    reveal ? "Ocultar contraseña" : "Mostrar contraseña"
  );
  els.togglePasswordIcon.textContent = reveal ? "Ocultar" : "Mostrar";
}

function unlockApp() {
  els.loginGate.classList.add("hidden");
  els.appShell.classList.remove("hidden");
}

function renderLockedState() {
  els.loginGate.classList.remove("hidden");
  els.appShell.classList.add("hidden");
}

function switchMode(mode) {
  state.mode = mode;
  const isUrl = mode === "url";
  els.urlModeBtn.classList.toggle("active", isUrl);
  els.imageModeBtn.classList.toggle("active", !isUrl);
  els.urlInputGroup.classList.toggle("hidden", !isUrl);
  els.imageInputGroup.classList.toggle("hidden", isUrl);
  announce(isUrl ? "Modo URL activo." : "Modo imagen activo.");
}

function handleImageUpload(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.imageDataUrl = String(reader.result || "");
    els.imagePreview.src = state.imageDataUrl;
    els.imagePreviewWrap.classList.remove("hidden");
    announce(`Imagen cargada: ${file.name}.`);
  };
  reader.readAsDataURL(file);
}

async function refreshAudits() {
  const response = await api("/api/audits");
  state.audits = response.audits || [];
  if (state.currentId) {
    const current = state.audits.find((item) => item.id === state.currentId);
    if (current) {
      applyAuditToComposer(current);
    } else {
      state.currentId = state.audits[0]?.id || null;
      if (state.currentId) {
        applyAuditToComposer(state.audits[0]);
      }
    }
  } else if (state.audits[0]) {
    state.currentId = state.audits[0].id;
    applyAuditToComposer(state.audits[0]);
  }
  renderSummary();
  renderHeuristics();
  renderHistory();
}

async function handleAnalyze() {
  const source = getCurrentSource();
  if (!source.valid) {
    announce(source.message, true);
    return;
  }

  try {
    setBusy(true);
    announce("Analizando input con el backend...");
    const audit = await api("/api/analyze", {
      method: "POST",
      body: {
        id: state.currentId,
        auditName: els.auditName.value.trim() || defaultAuditName(),
        author: els.auditAuthor.value.trim() || "Equipo UX",
        sourceType: state.mode,
        sourceValue: source.value,
        imageDataUrl: state.imageDataUrl,
      },
    });

    upsertLocalAudit(audit.audit);
    state.currentId = audit.audit.id;
    applyAuditToComposer(audit.audit);
    renderSummary();
    renderHeuristics();
    renderHistory();
    announce(audit.provider === "external"
      ? "Análisis completado usando el proveedor de IA configurado."
      : "Análisis completado con el motor de respaldo del servidor.");
  } catch (error) {
    announce(error.message || "No se pudo completar el análisis.", true);
  } finally {
    setBusy(false);
  }
}

function getCurrentSource() {
  if (state.mode === "url") {
    const raw = els.urlInput.value.trim();
    try {
      const parsed = new URL(raw);
      return { valid: true, value: parsed.href };
    } catch {
      return { valid: false, message: "Introduce una URL pública válida antes de analizar." };
    }
  }

  if (!state.imageDataUrl) {
    return { valid: false, message: "Sube una imagen antes de ejecutar el análisis." };
  }

  return {
    valid: true,
    value: els.imageInput.files?.[0]?.name || "Captura UX",
  };
}

function defaultAuditName() {
  return state.mode === "url" ? "Auditoría web" : "Auditoría visual";
}

async function saveCurrentAudit() {
  try {
    const payload = buildAuditPayload();
    if (!payload) {
      announce("No hay datos suficientes para guardar una auditoría.", true);
      return;
    }

    setBusy(true);
    const path = state.currentId ? `/api/audits/${state.currentId}` : "/api/audits";
    const method = state.currentId ? "PUT" : "POST";
    const response = await api(path, {
      method,
      body: payload,
    });

    upsertLocalAudit(response.audit);
    state.currentId = response.audit.id;
    renderSummary();
    renderHeuristics();
    renderHistory();
    announce("Cambios guardados en el backend.");
  } catch (error) {
    announce(error.message || "No se pudo guardar la auditoría.", true);
  } finally {
    setBusy(false);
  }
}

function buildAuditPayload() {
  const current = getCurrentAudit();
  const draftName = els.auditName.value.trim();
  const draftAuthor = els.auditAuthor.value.trim();
  const draftSourceType = state.mode;
  const draftSourceValue =
    draftSourceType === "url"
      ? els.urlInput.value.trim()
      : els.imageInput.files?.[0]?.name || current?.sourceValue || "";

  if (!current && !draftName && !draftSourceValue && !state.imageDataUrl) {
    return null;
  }

  return {
    auditName: draftName || current?.auditName || defaultAuditName(),
    author: draftAuthor || current?.author || "Equipo UX",
    sourceType: draftSourceType,
    sourceValue: draftSourceValue,
    imageDataUrl: state.imageDataUrl || current?.imageDataUrl || "",
    status: current?.status || "Borrador",
    heuristics: getCurrentHeuristics(),
  };
}

function getCurrentHeuristics() {
  const current = getCurrentAudit();
  if (current?.heuristics?.length) {
    return current.heuristics;
  }

  return heuristics.map((name, index) => ({
    id: `draft-${index}`,
    index,
    name,
    score: 0,
    severity: "warn",
    suggestion: "Pendiente de análisis.",
    note: "",
  }));
}

async function deleteCurrentAudit() {
  const audit = getCurrentAudit();
  if (!audit) {
    announce("No hay una auditoría seleccionada.", true);
    return;
  }

  const confirmed = window.confirm(`Eliminar "${audit.auditName}" del historial del servidor?`);
  if (!confirmed) {
    return;
  }

  try {
    setBusy(true);
    await api(`/api/audits/${audit.id}`, { method: "DELETE" });
    state.audits = state.audits.filter((item) => item.id !== audit.id);
    state.currentId = null;
    if (state.audits[0]) {
      state.currentId = state.audits[0].id;
      applyAuditToComposer(state.audits[0]);
    } else {
      resetComposer(false);
    }
    renderSummary();
    renderHeuristics();
    renderHistory();
    announce("Auditoría eliminada.");
  } catch (error) {
    announce(error.message || "No se pudo eliminar la auditoría.", true);
  } finally {
    setBusy(false);
  }
}

function resetComposer(announceReset = true) {
  state.currentId = null;
  state.imageDataUrl = "";
  els.auditName.value = "";
  els.auditAuthor.value = "";
  els.urlInput.value = "";
  els.imageInput.value = "";
  els.imagePreview.src = "";
  els.imagePreviewWrap.classList.add("hidden");
  switchMode("url");
  renderSummary();
  renderHeuristics();
  renderHistory();
  if (announceReset) {
    announce("Compositor limpio. Puedes crear una nueva auditoría.");
  }
}

function renderHeuristics() {
  const audit = getCurrentAudit();
  const results = audit?.heuristics || getCurrentHeuristics();

  els.heuristicsGrid.innerHTML = results
    .map((item, index) => {
      const tone = toneFor(item.severity);
      return `
        <article class="heuristic-card" style="--tone:${tone}">
          <div class="heuristic-top">
            <div>
              <span class="heuristic-index">Heurística ${index + 1}</span>
              <h3 class="heuristic-title">${item.name}</h3>
            </div>
            <span class="score-chip">${item.score}</span>
          </div>
          <p class="heuristic-copy">${escapeHtml(item.suggestion)}</p>
          <label class="field">
            <span class="notes-label">Nota del evaluador</span>
            <textarea data-note-index="${index}" placeholder="Añade contexto, excepciones o evidencia.">${escapeHtml(
              item.note || ""
            )}</textarea>
          </label>
        </article>
      `;
    })
    .join("");

  els.heuristicsGrid.querySelectorAll("textarea").forEach((textarea) => {
    textarea.addEventListener("input", handleNoteInput);
  });
}

function handleNoteInput(event) {
  const audit = getCurrentAudit();
  const index = Number(event.target.dataset.noteIndex);

  if (!audit || Number.isNaN(index)) {
    return;
  }

  audit.heuristics[index].note = event.target.value;
  audit.updatedAt = new Date().toISOString();
  renderHistory();
  queueAutosave();
}

function queueAutosave() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    void saveCurrentAudit();
  }, 450);
}

function renderSummary() {
  const audit = getCurrentAudit();
  if (!audit) {
    els.auditStatePill.textContent = "Sin analizar";
    els.overallScore.textContent = "0";
    els.summaryHeadline.textContent = "No hay resultados todavía.";
    els.summaryBody.textContent =
      "El backend generará un score promedio, riesgos clave y una lectura rápida para priorizar acciones.";
    els.riskStrip.innerHTML = "";
    els.savedCount.textContent = String(state.audits.length);
    return;
  }

  const scores = audit.heuristics.map((item) => item.score);
  const overall = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : 0;
  const weakAreas = audit.heuristics
    .filter((item) => item.score < 60)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  els.auditStatePill.textContent = audit.status;
  els.overallScore.textContent = String(overall);
  els.summaryHeadline.textContent =
    overall >= 80
      ? "La experiencia se percibe sólida."
      : overall >= 60
        ? "Hay fricción moderada en puntos concretos."
        : "La auditoría detecta riesgos relevantes.";
  els.summaryBody.textContent =
    weakAreas.length > 0
      ? `Prioriza ${weakAreas.map((item) => item.name).join(", ")} para mejorar claridad, control y recuperación.`
      : "No se detectan riesgos críticos; enfoca el siguiente ciclo en detalle fino y consistencia.";
  els.riskStrip.innerHTML = weakAreas
    .map((item) => `<span class="risk-badge">${escapeHtml(item.name)}: ${item.score}</span>`)
    .join("");
  els.savedCount.textContent = String(state.audits.length);
}

function renderHistory() {
  const query = els.searchInput.value.trim().toLowerCase();
  const filtered = state.audits.filter((audit) => {
    const haystack = [
      audit.auditName,
      audit.author,
      audit.sourceValue,
      formatDate(audit.updatedAt),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  els.historyList.innerHTML = filtered.length
    ? filtered
        .map(
          (audit) => `
            <article class="history-item ${audit.id === state.currentId ? "active" : ""}">
              <div class="history-row">
                <div>
                  <strong>${escapeHtml(audit.auditName)}</strong>
                  <div class="history-meta">
                    <span>${audit.sourceType === "url" ? "URL" : "Imagen"}</span>
                    <span>${escapeHtml(audit.author)}</span>
                    <span>${formatDate(audit.updatedAt)}</span>
                    <span>${escapeHtml(audit.status)}</span>
                  </div>
                </div>
                <div class="history-actions">
                  <button class="ghost" type="button" data-open-id="${audit.id}">Abrir</button>
                  <button class="secondary" type="button" data-pdf-id="${audit.id}">PDF</button>
                </div>
              </div>
              <div>${escapeHtml(audit.sourceValue || "Sin fuente asociada")}</div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">No hay auditorías que coincidan con el filtro actual.</div>`;

  els.historyList.querySelectorAll("[data-open-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const audit = state.audits.find((item) => item.id === button.dataset.openId);
      if (!audit) {
        return;
      }
      state.currentId = audit.id;
      applyAuditToComposer(audit);
      renderSummary();
      renderHeuristics();
      renderHistory();
      announce(`Auditoría "${audit.auditName}" cargada.`);
    });
  });

  els.historyList.querySelectorAll("[data-pdf-id]").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(`/api/audits/${button.dataset.pdfId}/report`, "_blank", "noopener");
    });
  });
}

function applyAuditToComposer(audit) {
  state.currentId = audit.id;
  state.mode = audit.sourceType;
  els.auditName.value = audit.auditName || "";
  els.auditAuthor.value = audit.author || "";
  els.urlInput.value = audit.sourceType === "url" ? audit.sourceValue || "" : "";
  state.imageDataUrl = audit.imageDataUrl || "";

  if (state.imageDataUrl) {
    els.imagePreview.src = state.imageDataUrl;
    els.imagePreviewWrap.classList.remove("hidden");
  } else {
    els.imagePreview.src = "";
    els.imagePreviewWrap.classList.add("hidden");
  }

  switchMode(audit.sourceType || "url");
}

function exportCurrentAudit() {
  const audit = getCurrentAudit();
  if (!audit) {
    announce("Selecciona o crea una auditoría antes de exportar.", true);
    return;
  }
  window.open(`/api/audits/${audit.id}/report`, "_blank", "noopener");
}

function getCurrentAudit() {
  return state.audits.find((item) => item.id === state.currentId) || null;
}

function upsertLocalAudit(nextAudit) {
  const index = state.audits.findIndex((item) => item.id === nextAudit.id);
  if (index >= 0) {
    state.audits[index] = nextAudit;
    return;
  }
  state.audits.unshift(nextAudit);
}

function setBusy(isBusy) {
  [els.analyzeBtn, els.saveAuditBtn, els.deleteAuditBtn].forEach((button) => {
    button.disabled = isBusy;
    button.style.opacity = isBusy ? "0.6" : "1";
  });
}

async function api(path, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "same-origin",
  };

  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, config);
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Error ${response.status}`);
  }

  return payload;
}

function formatDate(iso) {
  if (!iso) {
    return "Sin fecha";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function toneFor(severity) {
  if (severity === "good") return "#2e8b57";
  if (severity === "bad") return "#ba3b2d";
  return "#c18318";
}

function announce(message, isError = false) {
  els.statusMessage.textContent = message;
  els.statusMessage.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

void init();
