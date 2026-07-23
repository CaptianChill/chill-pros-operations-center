(() => {
  "use strict";

  const API_BASE = "https://us-central1-chill-pros-ice-stream.cloudfunctions.net/jobberApi";

  function getCurrentUser() {
    return window.firebase?.auth?.().currentUser || null;
  }

  async function api(path, options = {}) {
    const user = getCurrentUser();
    if (!user) throw new Error("Sign in as the owner first.");
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Jobber request failed.");
    return data;
  }

  function installPanel() {
    const settings = document.getElementById("settings");
    if (!settings || document.getElementById("jobberIntegrationPanel")) return;

    settings.innerHTML = `
      <div class="page-header">
        <div><p class="eyebrow">SECURE INTEGRATIONS</p><h2>Settings</h2></div>
      </div>
      <div id="jobberIntegrationPanel" class="form-panel">
        <div class="form-section">
          <h3>Jobber Connection</h3>
          <p id="jobberConnectionStatus">Checking secure connection…</p>
          <div class="form-actions">
            <button id="connectJobberButton" type="button" class="primary-action">CONNECT JOBBER</button>
            <button id="syncJobberClientsButton" type="button" class="secondary-action" disabled>SYNC CLIENTS</button>
          </div>
          <p id="jobberIntegrationMessage" class="queue-meta"></p>
        </div>
      </div>
    `;

    document.getElementById("connectJobberButton").addEventListener("click", connectJobber);
    document.getElementById("syncJobberClientsButton").addEventListener("click", syncClients);
    refreshStatus();
  }

  async function refreshStatus() {
    const status = document.getElementById("jobberConnectionStatus");
    const connect = document.getElementById("connectJobberButton");
    const sync = document.getElementById("syncJobberClientsButton");
    if (!status || !connect || !sync) return;

    try {
      const data = await api("/status");
      if (data.connected) {
        status.textContent = `Connected securely to ${data.accountName || "Jobber"}.`;
        connect.textContent = "RECONNECT JOBBER";
        sync.disabled = false;
      } else {
        status.textContent = "Jobber is not connected.";
        connect.textContent = "CONNECT JOBBER";
        sync.disabled = true;
      }
    } catch (error) {
      status.textContent = "Backend not deployed yet.";
      document.getElementById("jobberIntegrationMessage").textContent = error.message;
    }
  }

  async function connectJobber() {
    const message = document.getElementById("jobberIntegrationMessage");
    try {
      message.textContent = "Opening secure Jobber authorization…";
      const data = await api("/connect", { method: "POST", body: "{}" });
      window.location.assign(data.authorizeUrl);
    } catch (error) {
      message.textContent = error.message;
    }
  }

  async function syncClients() {
    const button = document.getElementById("syncJobberClientsButton");
    const message = document.getElementById("jobberIntegrationMessage");
    try {
      button.disabled = true;
      message.textContent = "Synchronizing Jobber clients…";
      const data = await api("/sync/clients", { method: "POST", body: "{}" });
      message.textContent = `${data.imported} Jobber client record(s) synchronized.`;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", installPanel);
  window.addEventListener("load", installPanel);
})();
