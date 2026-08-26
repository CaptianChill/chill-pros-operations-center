(() => {
  "use strict";

  const API_BASE = "https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi";
  let sessionId = "";
  let panel;
  let thread;
  let launcher;
  let status;
  let pendingImageDataUrl = "";
  let recognition = null;
  let speakReplies = false;

  function setState(state, statusText) {
    if (launcher) launcher.dataset.state = state;
    if (panel) panel.dataset.state = state;
    if (statusText && status) status.textContent = statusText;
  }

  function addMessage(kind, text) {
    const node = document.createElement("div");
    node.className = `chill-bro-msg ${kind}`;
    node.textContent = text;
    thread.appendChild(node);
    thread.scrollTop = thread.scrollHeight;
  }

  function getUser() {
    try { return window.firebase?.auth?.().currentUser || null; } catch { return null; }
  }

  function collectContext() {
    const context = {};
    const form = document.getElementById("intakeForm");
    if (form) {
      const data = new FormData(form);
      const intake = {};
      for (const [key, value] of data.entries()) {
        if (String(value).trim()) intake[key] = String(value).trim();
      }
      if (Object.keys(intake).length) context.currentIntake = intake;
    }
    const activeJob = document.querySelector(".queue-item[data-job-id].active,[data-job-id][aria-current='true']");
    if (activeJob) {
      context.currentJob = {
        jobId: activeJob.dataset.jobId || null,
        customer: activeJob.dataset.customer || null,
        equipment: activeJob.dataset.equipment || null,
      };
    }
    return context;
  }

  async function request(path, body) {
    const user = getUser();
    if (!user) throw new Error("Sign in to Chill Pros before using Chill Bro.");
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Chill Bro request failed.");
    return data;
  }

  function speak(text) {
    if (!speakReplies || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
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
      setState("thinking", "Preparing field image…");
      pendingImageDataUrl = await compressImage(file);
      panel.querySelector("#chillBroImageState").textContent = "PHOTO READY";
      addMessage("system", "Field photo attached. Ask what you want Chill Bro to inspect.");
      setState("ready", "Photo ready for Chill Bro vision");
    } catch (error) {
      pendingImageDataUrl = "";
      panel.querySelector("#chillBroImageState").textContent = "CAMERA";
      addMessage("system", error.message || "Unable to prepare image.");
      setState("warning", "Unable to prepare field image");
    }
  }

  async function send() {
    const input = panel.querySelector("#chillBroInput");
    const mode = panel.querySelector("#chillBroMode").value;
    const jobId = panel.querySelector("#chillBroJobId").value.trim();
    const equipmentId = panel.querySelector("#chillBroEquipmentId").value.trim();
    const message = input.value.trim();
    if (!message && !pendingImageDataUrl) return;

    addMessage("user", message || "Inspect this field image.");
    input.value = "";
    setState("thinking", pendingImageDataUrl ? "Chill Bro is inspecting the field image…" : "Chill Bro is thinking…");

    try {
      const data = await request("/chat", {
        message,
        mode,
        jobId: jobId || undefined,
        equipmentId: equipmentId || undefined,
        sessionId: sessionId || undefined,
        context: collectContext(),
        imageDataUrl: pendingImageDataUrl || undefined,
      });
      sessionId = data.sessionId || sessionId;
      addMessage("bot", data.answer);
      speak(data.answer);
      pendingImageDataUrl = "";
      panel.querySelector("#chillBroImageState").textContent = "CAMERA";
      setState("ready", `${data.role === "owner" ? "Owner" : "Technician"} access • ${mode}${data.visionUsed ? " • VISION" : ""}${data.draftOnly ? " • DRAFT ONLY" : ""}`);
    } catch (error) {
      addMessage("system", error.message);
      setState("warning", "Chill Bro unavailable");
      showLoginIfNeeded();
    }
  }

  function setupRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return null;
    const r = new Recognition();
    r.lang = "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onstart = () => {
      setState("listening", "Listening… tell Chill Bro what you need.");
      panel.querySelector("#chillBroMic").textContent = "LISTENING";
    };
    r.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      if (transcript) panel.querySelector("#chillBroInput").value = transcript;
    };
    r.onerror = () => {
      addMessage("system", "Voice input was interrupted. You can keep typing normally.");
      setState("warning", "Voice input interrupted • typing still available");
    };
    r.onend = () => {
      panel.querySelector("#chillBroMic").textContent = "TALK";
      if (launcher.dataset.state !== "warning") setState("ready", "Voice captured • review or send");
    };
    return r;
  }

  function startVoice() {
    if (!recognition) recognition = setupRecognition();
    if (!recognition) {
      addMessage("system", "Voice recognition is not available in this browser. Chrome on Android/Desktop usually supports it.");
      setState("warning", "Voice recognition unavailable in this browser");
      return;
    }
    speakReplies = true;
    try { recognition.start(); } catch { /* already listening */ }
  }

  function showLoginIfNeeded() {
    const login = panel.querySelector("#chillBroLogin");
    if (!login) return;
    login.classList.toggle("active", !getUser());
  }

  async function signIn() {
    const email = panel.querySelector("#chillBroEmail").value.trim();
    const password = panel.querySelector("#chillBroPassword").value;
    const message = panel.querySelector("#chillBroLoginMessage");
    if (!email || !password) return;
    try {
      setState("thinking", "Signing in securely…");
      message.textContent = "Signing in…";
      await window.firebase.auth().signInWithEmailAndPassword(email, password);
      message.textContent = "Signed in.";
      showLoginIfNeeded();
      addMessage("system", "Secure Chill Pros session connected.");
      setState("ready", "Secure Chill Pros session connected");
    } catch (error) {
      message.textContent = error.message || "Sign-in failed.";
      setState("warning", "Secure sign-in failed");
    }
  }

  function install() {
    if (document.getElementById("chillBroLauncher")) return;

    launcher = document.createElement("button");
    launcher.id = "chillBroLauncher";
    launcher.className = "chill-bro-launch";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open Chill Bro AI field copilot");
    launcher.title = "Chill Bro — Field Copilot";
    launcher.textContent = "❄";
    launcher.dataset.state = "idle";

    panel = document.createElement("section");
    panel.id = "chillBroPanel";
    panel.className = "chill-bro-panel";
    panel.setAttribute("aria-label", "Chill Bro AI field copilot");
    panel.dataset.state = "idle";
    panel.innerHTML = `
      <div class="chill-bro-head">
        <div class="chill-bro-mark">❄</div>
        <div class="chill-bro-title"><strong>CHILL BRO 2.0</strong><small>Voice • Vision • Diagnostics • Parts • Quotes</small></div>
        <button class="chill-bro-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="chill-bro-status" id="chillBroStatus">Secure field copilot ready</div>
      <div class="chill-bro-controls">
        <select id="chillBroMode" aria-label="Chill Bro mode">
          <option value="field-help">Field Help</option>
          <option value="diagnostic">Diagnostics</option>
          <option value="parts">Parts Intelligence</option>
          <option value="training">Training</option>
          <option value="job-help">Job Context</option>
          <option value="quote-draft">Draft Quote</option>
          <option value="invoice-draft">Draft Invoice Notes</option>
        </select>
        <input id="chillBroJobId" placeholder="Job ID (optional)">
        <input id="chillBroEquipmentId" placeholder="Equipment ID (optional)">
      </div>
      <div id="chillBroLogin" class="chill-bro-login">
        <strong>Secure staff sign-in required</strong>
        <input id="chillBroEmail" type="email" autocomplete="username" placeholder="Chill Pros email">
        <input id="chillBroPassword" type="password" autocomplete="current-password" placeholder="Password">
        <button id="chillBroSignIn" type="button" class="chill-bro-send">SIGN IN</button>
        <small id="chillBroLoginMessage"></small>
      </div>
      <div class="chill-bro-thread" id="chillBroThread"></div>
      <div class="chill-bro-composer">
        <textarea id="chillBroInput" placeholder="Tell Chill Bro what you see, hear, measured, need quoted, or need help learning…"></textarea>
        <input id="chillBroCameraInput" type="file" accept="image/*" capture="environment" hidden>
        <div class="chill-bro-actions chill-bro-field-actions">
          <button id="chillBroMic" class="chill-bro-secondary" type="button">TALK</button>
          <button id="chillBroCamera" class="chill-bro-secondary" type="button"><span id="chillBroImageState">CAMERA</span></button>
          <button id="chillBroVoiceToggle" class="chill-bro-secondary" type="button">VOICE OFF</button>
        </div>
        <div class="chill-bro-actions">
          <button id="chillBroClear" class="chill-bro-secondary" type="button">Clear</button>
          <button id="chillBroSend" class="chill-bro-send" type="button">ASK CHILL BRO</button>
        </div>
      </div>`;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    thread = panel.querySelector("#chillBroThread");
    status = panel.querySelector("#chillBroStatus");
    addMessage("bot", "What are we working on? Talk, type, or show me the unit/data plate and give me the complaint or measurements.");

    launcher.addEventListener("click", () => {
      panel.classList.toggle("open");
      showLoginIfNeeded();
      if (panel.classList.contains("open")) {
        setState("ready", "Secure field copilot ready");
        panel.querySelector("#chillBroInput").focus();
      } else {
        setState("idle");
      }
    });
    panel.querySelector(".chill-bro-close").addEventListener("click", () => {
      panel.classList.remove("open");
      setState("idle");
    });
    panel.querySelector("#chillBroSend").addEventListener("click", send);
    panel.querySelector("#chillBroSignIn").addEventListener("click", signIn);
    panel.querySelector("#chillBroMic").addEventListener("click", startVoice);
    panel.querySelector("#chillBroCamera").addEventListener("click", () => panel.querySelector("#chillBroCameraInput").click());
    panel.querySelector("#chillBroCameraInput").addEventListener("change", (event) => attachImage(event.target.files?.[0]));
    panel.querySelector("#chillBroVoiceToggle").addEventListener("click", (event) => {
      speakReplies = !speakReplies;
      event.currentTarget.textContent = speakReplies ? "VOICE ON" : "VOICE OFF";
      if (!speakReplies) window.speechSynthesis?.cancel();
    });
    panel.querySelector("#chillBroClear").addEventListener("click", () => {
      thread.innerHTML = "";
      sessionId = "";
      pendingImageDataUrl = "";
      panel.querySelector("#chillBroImageState").textContent = "CAMERA";
      addMessage("system", "Conversation cleared. Job records were not changed.");
      setState("ready", "Secure field copilot ready");
    });
    panel.querySelector("#chillBroInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });

    if (window.firebase?.auth) window.firebase.auth().onAuthStateChanged(() => showLoginIfNeeded());
    showLoginIfNeeded();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
