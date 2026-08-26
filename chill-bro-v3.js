(() => {
  "use strict";

  const FIREBASE_API_BASE = "https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi";
  const RESEARCH_API = "/api/chill-bro-research";
  const MASCOT = "chill-bro-approved.webp";
  const WEB_SIGNAL = /manual|service bulletin|fault code|error code|part number|parts?\b|supersed|cross[- ]?reference|wiring diagram|specification|refrigerant charge|recall|availability|in stock|current|latest|oem|model-specific/i;
  const MODES = [
    ["field-help", "Field Help"],
    ["diagnostic", "Diagnostics"],
    ["parts", "Parts"],
    ["pm", "PM Coach"],
    ["training", "Training"],
    ["web-research", "Research"],
  ];

  let mounted = false;
  let sessionId = "";
  let activeMode = "field-help";
  let pendingImageDataUrl = "";
  let recognition = null;
  let speakReplies = false;
  let launcher = null;
  let panel = null;
  let thread = null;
  let status = null;

  const getUser = () => {
    try { return window.firebase?.auth?.().currentUser || null; } catch { return null; }
  };

  async function token() {
    const user = getUser();
    if (!user) throw new Error("Chill Pros staff sign-in required.");
    return user.getIdToken();
  }

  function shouldUseResearch(path, body, method) {
    if (path !== "/chat" || method === "GET" || body?.imageDataUrl) return false;
    const mode = String(body?.mode || "field-help");
    return mode === "web-research" || mode === "parts" || WEB_SIGNAL.test(String(body?.message || ""));
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const contentType = String(response.headers.get("content-type") || "");
    let data = {};
    if (contentType.includes("application/json")) data = await response.json().catch(() => ({}));
    else {
      const text = await response.text().catch(() => "");
      try { data = JSON.parse(text); } catch { data = {}; }
    }
    return { response, data };
  }

  async function api(path, body, method = "POST") {
    const idToken = await token();
    const options = {
      method,
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    };
    if (method !== "GET") options.body = JSON.stringify(body || {});

    const useResearch = shouldUseResearch(path, body, method);
    let result = await fetchJson(useResearch ? RESEARCH_API : `${FIREBASE_API_BASE}${path}`, options);

    const researchRouteUnavailable = useResearch && (
      result.response.status === 404
      || result.response.status >= 500
      || (result.response.ok && !result.data?.answer)
    );

    if (researchRouteUnavailable) {
      result = await fetchJson(`${FIREBASE_API_BASE}${path}`, options);
      if (result.response.ok) result.data.researchWarning = "Live web research route was unavailable; showing the authenticated internal answer.";
    }

    if (!result.response.ok) throw new Error(result.data.error || "Chill Bro request failed.");
    return result.data;
  }

  function collectContext() {
    const context = {
      pageTitle: document.title,
      activeView: document.querySelector("[data-view].active")?.dataset?.view || null,
      urlPath: location.pathname,
    };
    const form = document.getElementById("intakeForm");
    if (form) {
      const currentIntake = {};
      for (const [key, value] of new FormData(form).entries()) {
        if (String(value).trim()) currentIntake[key] = String(value).trim();
      }
      if (Object.keys(currentIntake).length) context.currentIntake = currentIntake;
    }
    const selected = document.querySelector("[data-job-id].active,[data-record-id].active,[aria-current='true'][data-job-id]");
    if (selected) {
      context.selectedRecord = {
        jobId: selected.dataset.jobId || null,
        recordId: selected.dataset.recordId || null,
        equipmentId: selected.dataset.equipmentId || null,
        customer: selected.dataset.customer || null,
      };
    }
    return context;
  }

  function setState(state, text) {
    if (launcher) launcher.dataset.state = state;
    if (status && text) status.textContent = text;
  }

  function addMessage(kind, text, meta = null) {
    if (!thread) return;
    const node = document.createElement("div");
    node.className = `cb3-msg ${kind}`;
    node.textContent = text;
    if (meta?.sources?.length) {
      const source = document.createElement("div");
      source.className = "cb3-source";
      source.textContent = `Sources: ${meta.sources.slice(0, 4).map((item) => item.title || item.domain || item.url).filter(Boolean).join(" • ")}`;
      node.appendChild(source);
    }
    thread.appendChild(node);
    thread.scrollTop = thread.scrollHeight;
  }

  function speak(text) {
    if (!speakReplies || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => /en-US/i.test(voice.lang) && /male|guy|davis|reed|aaron|evan/i.test(voice.name))
      || voices.find((voice) => /en-US/i.test(voice.lang));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.03;
    utterance.pitch = 0.95;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Choose a photo or image file.");
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function attachImage(file) {
    try {
      setState("thinking", "Prepping that field photo, bro…");
      pendingImageDataUrl = await compressImage(file);
      const preview = panel.querySelector("#cb3Preview");
      preview.querySelector("img").src = pendingImageDataUrl;
      preview.classList.add("active");
      setState("ready", "Photo ready • ask what you need checked");
    } catch (error) {
      pendingImageDataUrl = "";
      addMessage("system", error.message || "Could not prepare that photo.");
      setState("ready", "Ready");
    }
  }

  async function send() {
    const input = panel?.querySelector("#cb3Input");
    const message = input?.value.trim() || "";
    if (!message && !pendingImageDataUrl) return;
    addMessage("user", message || "Check this field photo.");
    input.value = "";
    const sendButton = panel.querySelector("#cb3Send");
    sendButton.disabled = true;
    const researchExpected = !pendingImageDataUrl && (activeMode === "web-research" || activeMode === "parts" || WEB_SIGNAL.test(message));
    setState("thinking", researchExpected ? "Checking internal context + trusted web sources…" : "BoodaFlow routing the fastest safe answer…");

    try {
      const data = await api("/chat", {
        message,
        mode: activeMode,
        sessionId: sessionId || undefined,
        context: collectContext(),
        imageDataUrl: pendingImageDataUrl || undefined,
      });
      sessionId = data.sessionId || sessionId;
      addMessage("bot", data.answer, { sources: data.sources || [] });
      if (data.researchWarning) addMessage("system", data.researchWarning);
      speak(data.answer);
      pendingImageDataUrl = "";
      const preview = panel.querySelector("#cb3Preview");
      preview.classList.remove("active");
      preview.querySelector("img").removeAttribute("src");
      const route = data.boodaFlow?.route || activeMode;
      const sourceLabel = data.sources?.length ? ` • ${data.sources.length} source${data.sources.length === 1 ? "" : "s"}` : "";
      const webLabel = data.boodaFlow?.usedWeb ? " • WEB VERIFIED" : "";
      setState("ready", `${data.role === "owner" ? "Owner" : "Tech"} • ${route}${webLabel}${sourceLabel}`);
    } catch (error) {
      addMessage("system", error.message || "Chill Bro hit a snag.");
      setState("ready", "Request failed safely");
    } finally {
      sendButton.disabled = false;
    }
  }

  function setupRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return null;
    const r = new Recognition();
    r.lang = "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onstart = () => setState("listening", "Listening… hit me with it, bro.");
    r.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      if (transcript) panel.querySelector("#cb3Input").value = transcript;
    };
    r.onerror = () => addMessage("system", "Voice input got interrupted. Typing still works.");
    r.onend = () => setState("ready", "Voice captured • review or send");
    return r;
  }

  function startVoice() {
    if (!recognition) recognition = setupRecognition();
    if (!recognition) {
      addMessage("system", "Voice recognition is not available in this browser yet.");
      return;
    }
    speakReplies = true;
    try { recognition.start(); } catch { /* already active */ }
  }

  function mount(staff) {
    if (mounted) return;
    mounted = true;
    launcher = document.createElement("button");
    launcher.id = "chillBroV3Launcher";
    launcher.className = "chill-bro-v3-launch";
    launcher.type = "button";
    launcher.dataset.state = "ready";
    launcher.setAttribute("aria-label", "Open Chill Bro field copilot");
    launcher.innerHTML = `<img src="${MASCOT}" alt="Chill Bro">`;

    panel = document.createElement("section");
    panel.id = "chillBroV3Panel";
    panel.className = "chill-bro-v3-panel";
    panel.setAttribute("aria-label", "Chill Bro employee field copilot");
    panel.innerHTML = `
      <div class="cb3-head">
        <div class="cb3-avatar"><img src="${MASCOT}" alt=""></div>
        <div class="cb3-title"><strong>CHILL BRO</strong><small>Private Chill Pros field copilot • BoodaFlow</small></div>
        <button class="cb3-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="cb3-modes">${MODES.map(([value, label]) => `<button class="cb3-mode${value === activeMode ? " active" : ""}" type="button" data-mode="${value}">${label}</button>`).join("")}</div>
      <div class="cb3-status" id="cb3Status">${staff.role === "owner" ? "Owner" : "Technician"} access verified • Ready</div>
      <div class="cb3-thread" id="cb3Thread"></div>
      <div class="cb3-preview" id="cb3Preview"><img alt="Attached field photo"><span>Field photo attached</span><button type="button" id="cb3RemovePhoto">Remove</button></div>
      <div class="cb3-composer">
        <textarea class="cb3-input" id="cb3Input" placeholder="Ask Chill Bro about diagnostics, parts, PM, training, a unit, or a field photo…"></textarea>
        <input id="cb3CameraInput" type="file" accept="image/*" capture="environment" hidden>
        <div class="cb3-actions">
          <button class="cb3-action" type="button" id="cb3Talk">🎙 Talk</button>
          <button class="cb3-action" type="button" id="cb3Camera">📷 Photo</button>
          <button class="cb3-action" type="button" id="cb3Voice">🔊 Off</button>
          <button class="cb3-action cb3-send" type="button" id="cb3Send">Ask Chill Bro</button>
        </div>
      </div>`;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    thread = panel.querySelector("#cb3Thread");
    status = panel.querySelector("#cb3Status");
    addMessage("bot", "Yo bro — what are we working on? Give me the complaint, readings, model/serial, or snap the data plate. I’ll keep it useful and skip the corporate nonsense.");

    launcher.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) panel.querySelector("#cb3Input").focus();
    });
    panel.querySelector(".cb3-close").addEventListener("click", () => panel.classList.remove("open"));
    panel.querySelector("#cb3Send").addEventListener("click", send);
    panel.querySelector("#cb3Talk").addEventListener("click", startVoice);
    panel.querySelector("#cb3Camera").addEventListener("click", () => panel.querySelector("#cb3CameraInput").click());
    panel.querySelector("#cb3CameraInput").addEventListener("change", (event) => attachImage(event.target.files?.[0]));
    panel.querySelector("#cb3RemovePhoto").addEventListener("click", () => {
      pendingImageDataUrl = "";
      panel.querySelector("#cb3Preview").classList.remove("active");
    });
    panel.querySelector("#cb3Voice").addEventListener("click", (event) => {
      speakReplies = !speakReplies;
      event.currentTarget.textContent = speakReplies ? "🔊 On" : "🔊 Off";
      if (!speakReplies) window.speechSynthesis?.cancel();
    });
    panel.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      activeMode = button.dataset.mode;
      panel.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
      setState("ready", `${staff.role === "owner" ? "Owner" : "Tech"} • ${button.textContent}`);
    }));
    panel.querySelector("#cb3Input").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
  }

  function unmount() {
    launcher?.remove();
    panel?.remove();
    launcher = panel = thread = status = null;
    mounted = false;
    sessionId = "";
  }

  async function verifyAndMount(user) {
    if (!user) return unmount();
    try {
      const staff = await api("/health", null, "GET");
      mount(staff);
    } catch (error) {
      console.info("Chill Bro hidden: staff verification failed.", error.message);
      unmount();
    }
  }

  function boot() {
    if (!window.firebase?.auth) {
      window.setTimeout(boot, 250);
      return;
    }
    window.firebase.auth().onAuthStateChanged(verifyAndMount);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
