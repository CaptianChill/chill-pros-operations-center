(() => {
  "use strict";

  const API_BASE = "https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi";
  let sessionId = "";
  let panel;
  let thread;
  let launcher;
  let status;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
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
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Chill Bro request failed.");
    return data;
  }

  async function send() {
    const input = panel.querySelector("#chillBroInput");
    const mode = panel.querySelector("#chillBroMode").value;
    const jobId = panel.querySelector("#chillBroJobId").value.trim();
    const equipmentId = panel.querySelector("#chillBroEquipmentId").value.trim();
    const message = input.value.trim();
    if (!message) return;

    addMessage("user", message);
    input.value = "";
    launcher.dataset.state = "thinking";
    status.textContent = "Chill Bro is thinking…";

    try {
      const data = await request("/chat", {
        message,
        mode,
        jobId: jobId || undefined,
        equipmentId: equipmentId || undefined,
        sessionId: sessionId || undefined,
        context: collectContext(),
      });
      sessionId = data.sessionId || sessionId;
      addMessage("bot", data.answer);
      status.textContent = `${data.role === "owner" ? "Owner" : "Technician"} access • ${mode}${data.draftOnly ? " • DRAFT ONLY" : ""}`;
    } catch (error) {
      addMessage("system", error.message);
      status.textContent = "Chill Bro unavailable";
      showLoginIfNeeded();
    } finally {
      launcher.dataset.state = "ready";
    }
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
      message.textContent = "Signing in…";
      await window.firebase.auth().signInWithEmailAndPassword(email, password);
      message.textContent = "Signed in.";
      showLoginIfNeeded();
      addMessage("system", "Secure Chill Pros session connected.");
    } catch (error) {
      message.textContent = error.message || "Sign-in failed.";
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
    launcher.dataset.state = "ready";

    panel = document.createElement("section");
    panel.id = "chillBroPanel";
    panel.className = "chill-bro-panel";
    panel.setAttribute("aria-label", "Chill Bro AI field copilot");
    panel.innerHTML = `
      <div class="chill-bro-head">
        <div class="chill-bro-mark">❄</div>
        <div class="chill-bro-title"><strong>CHILL BRO 2.0</strong><small>Field intelligence • Diagnostics • Parts • Drafts</small></div>
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
        <div class="chill-bro-actions">
          <button id="chillBroClear" class="chill-bro-secondary" type="button">Clear</button>
          <button id="chillBroSend" class="chill-bro-send" type="button">ASK CHILL BRO</button>
        </div>
      </div>`;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    thread = panel.querySelector("#chillBroThread");
    status = panel.querySelector("#chillBroStatus");
    addMessage("bot", "What are we working on? Give me the unit, complaint, measurements, or the quote you need built.");

    launcher.addEventListener("click", () => {
      panel.classList.toggle("open");
      showLoginIfNeeded();
      if (panel.classList.contains("open")) panel.querySelector("#chillBroInput").focus();
    });
    panel.querySelector(".chill-bro-close").addEventListener("click", () => panel.classList.remove("open"));
    panel.querySelector("#chillBroSend").addEventListener("click", send);
    panel.querySelector("#chillBroSignIn").addEventListener("click", signIn);
    panel.querySelector("#chillBroClear").addEventListener("click", () => {
      thread.innerHTML = "";
      sessionId = "";
      addMessage("system", "Conversation cleared. Job records were not changed.");
    });
    panel.querySelector("#chillBroInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });

    if (window.firebase?.auth) {
      window.firebase.auth().onAuthStateChanged(() => showLoginIfNeeded());
    }
    showLoginIfNeeded();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
