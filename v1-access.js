(() => {
  const OWNER_EMAILS = new Set(["chillprostx@gmail.com"]);
  const ROLE_VIEWS = {
    owner: ["dashboard", "new-customer", "office-queue", "today-jobs", "technicians", "maintenance", "equipment", "parts", "ai", "reports", "settings"],
    office: ["dashboard", "new-customer", "office-queue", "today-jobs", "technicians", "maintenance", "equipment", "parts"],
    technician: ["today-jobs", "technicians", "equipment", "ai"]
  };

  let auth = null;
  let currentProfile = null;
  let unsubscribeCustomers = null;
  let unsubscribeTechnicians = null;
  let originalRenderTodayJobs = null;

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .auth-gate{position:fixed;inset:0;z-index:10000;background:linear-gradient(145deg,#020609,#07131d);display:grid;place-items:center;padding:24px;color:#fff;font-family:inherit}
      .auth-card{width:min(430px,100%);background:rgba(7,18,27,.96);border:1px solid rgba(126,219,255,.35);box-shadow:0 24px 80px rgba(0,0,0,.55);border-radius:22px;padding:28px}
      .auth-card img{display:block;max-width:180px;max-height:95px;object-fit:contain;margin:0 auto 16px}
      .auth-card h2{text-align:center;margin:0 0 6px;color:#7edbff}.auth-card p{text-align:center;color:#a9bdca;margin:0 0 22px}
      .auth-card label{display:block;margin:12px 0;color:#dbeef8;font-weight:700}.auth-card input{width:100%;box-sizing:border-box;margin-top:7px;padding:13px;border-radius:10px;border:1px solid #27485b;background:#071019;color:#fff}
      .auth-card button{width:100%;margin-top:18px;padding:13px;border:0;border-radius:10px;background:#008cff;color:white;font-weight:800;cursor:pointer}.auth-error{min-height:20px;color:#ff9a9a;text-align:center;margin-top:12px}
      .session-bar{position:fixed;right:18px;bottom:18px;z-index:9000;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:999px;background:rgba(3,12,18,.94);border:1px solid rgba(126,219,255,.35);color:#dff6ff;box-shadow:0 12px 32px rgba(0,0,0,.35)}
      .session-bar small{display:block;color:#8fb2c5}.session-bar button{border:0;border-radius:999px;padding:7px 11px;background:#17384a;color:#fff;cursor:pointer}.role-hidden{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function createLoginGate() {
    const gate = document.createElement("div");
    gate.id = "authGate";
    gate.className = "auth-gate";
    gate.innerHTML = `
      <form id="authForm" class="auth-card">
        <img src="chill-pros-logo.jpeg" alt="Chill Pros">
        <h2>Operations Center</h2>
        <p>Owner, office and technician secure sign-in</p>
        <label>Email<input id="authEmail" type="email" autocomplete="username" required></label>
        <label>Password<input id="authPassword" type="password" autocomplete="current-password" required></label>
        <button type="submit">SIGN IN</button>
        <div id="authError" class="auth-error" role="alert"></div>
      </form>`;
    document.body.appendChild(gate);

    gate.querySelector("#authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = gate.querySelector("#authEmail").value.trim();
      const password = gate.querySelector("#authPassword").value;
      const errorBox = gate.querySelector("#authError");
      errorBox.textContent = "";
      try {
        await auth.signInWithEmailAndPassword(email, password);
      } catch (error) {
        console.error("Sign-in failed:", error);
        errorBox.textContent = "Sign-in failed. Check the email and password.";
      }
    });
  }

  function setGateVisible(visible) {
    const gate = document.getElementById("authGate");
    if (gate) gate.style.display = visible ? "grid" : "none";
    const shell = document.querySelector(".app-shell");
    if (shell) shell.style.visibility = visible ? "hidden" : "visible";
  }

  function showSessionBar(user, profile) {
    document.getElementById("sessionBar")?.remove();
    const bar = document.createElement("div");
    bar.id = "sessionBar";
    bar.className = "session-bar";
    bar.innerHTML = `<div><strong>${escapeText(profile.displayName || user.email)}</strong><small>${escapeText(profile.role)}</small></div><button type="button">Sign out</button>`;
    bar.querySelector("button").addEventListener("click", () => auth.signOut());
    document.body.appendChild(bar);
  }

  function escapeText(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]));
  }

  async function getUserProfile(user) {
    const fallbackRole = OWNER_EMAILS.has(String(user.email || "").toLowerCase()) ? "owner" : "technician";
    const fallback = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email || "User",
      role: fallbackRole,
      technicianName: user.displayName || ""
    };

    try {
      const snapshot = await window.chillProsDb.collection("Users").doc(user.uid).get();
      if (!snapshot.exists) return fallback;
      const data = snapshot.data() || {};
      const role = ["owner", "office", "technician"].includes(data.role) ? data.role : fallbackRole;
      return { ...fallback, ...data, role };
    } catch (error) {
      console.warn("Unable to read user profile; using fallback role:", error);
      return fallback;
    }
  }

  function applyRole(profile) {
    window.CHILL_PROS_SESSION = profile;
    const allowed = new Set(ROLE_VIEWS[profile.role] || ROLE_VIEWS.technician);

    document.querySelectorAll(".side-link").forEach((button) => {
      button.classList.toggle("role-hidden", !allowed.has(button.dataset.view));
    });
    document.querySelectorAll("[data-view-target]").forEach((button) => {
      button.classList.toggle("role-hidden", !allowed.has(button.dataset.viewTarget));
    });

    document.querySelectorAll(".view").forEach((view) => {
      if (!allowed.has(view.id)) {
        view.classList.remove("active");
        view.classList.add("role-hidden");
      } else {
        view.classList.remove("role-hidden");
      }
    });

    if (profile.role === "technician") {
      document.getElementById("addTechnicianButton")?.classList.add("role-hidden");
      document.getElementById("exportQueue")?.classList.add("role-hidden");
      installTechnicianJobFilter(profile);
      showView("today-jobs");
    } else {
      showView("dashboard");
    }
  }

  function installTechnicianJobFilter(profile) {
    if (originalRenderTodayJobs || typeof renderTodayJobs !== "function") return;
    originalRenderTodayJobs = renderTodayJobs;
    renderTodayJobs = function roleFilteredTodayJobs() {
      if (window.CHILL_PROS_SESSION?.role !== "technician") return originalRenderTodayJobs();
      const technicianName = profile.technicianName || profile.displayName || "";
      const originalQueue = queue;
      queue = originalQueue.filter((record) => record.assignedTechnician === technicianName);
      try {
        return originalRenderTodayJobs();
      } finally {
        queue = originalQueue;
      }
    };
  }

  function startRealtimeListeners() {
    unsubscribeCustomers?.();
    unsubscribeTechnicians?.();

    unsubscribeCustomers = window.chillProsDb.collection("Customers").onSnapshot((snapshot) => {
      queue = snapshot.docs.map((documentSnapshot) => normalizeRecord(documentSnapshot.data(), documentSnapshot.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      updateCounts();
      renderQueue();
      renderTodayJobs();
      renderTechnicianDashboard();
    }, (error) => console.error("Customer realtime listener failed:", error));

    unsubscribeTechnicians = window.chillProsDb.collection("Technicians").onSnapshot((snapshot) => {
      technicians = snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
      localStorage.setItem(TECHNICIAN_STORAGE_KEY, JSON.stringify(technicians));
      renderTechnicians();
      renderTodayJobs();
      renderTechnicianDashboard();
    }, (error) => console.error("Technician realtime listener failed:", error));
  }

  function patchTechnicianPersistence() {
    if (typeof saveTechnicians !== "function") return;
    saveTechnicians = async function saveTechniciansToFirestore() {
      localStorage.setItem(TECHNICIAN_STORAGE_KEY, JSON.stringify(technicians));
      if (window.CHILL_PROS_SESSION?.role === "owner" || window.CHILL_PROS_SESSION?.role === "office") {
        const batch = window.chillProsDb.batch();
        technicians.forEach((technician) => {
          const id = technician.id || crypto.randomUUID?.() || String(Date.now());
          technician.id = id;
          batch.set(window.chillProsDb.collection("Technicians").doc(id), technician, { merge: true });
        });
        try { await batch.commit(); } catch (error) { console.error("Technician sync failed:", error); }
      }
      renderTechnicians();
      renderTechnicianDashboard();
      renderTodayJobs();
    };
  }

  function loadAuthSdk() {
    return new Promise((resolve, reject) => {
      if (firebase.auth) return resolve();
      const script = document.createElement("script");
      script.src = "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initialize() {
    injectStyles();
    createLoginGate();
    setGateVisible(true);

    try {
      await loadAuthSdk();
      auth = firebase.auth();
      window.chillProsAuth = auth;

      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          currentProfile = null;
          unsubscribeCustomers?.();
          unsubscribeTechnicians?.();
          document.getElementById("sessionBar")?.remove();
          setGateVisible(true);
          return;
        }

        currentProfile = await getUserProfile(user);
        patchTechnicianPersistence();
        applyRole(currentProfile);
        startRealtimeListeners();
        showSessionBar(user, currentProfile);
        setGateVisible(false);
      });
    } catch (error) {
      console.error("Authentication SDK failed to load:", error);
      document.getElementById("authError").textContent = "Authentication could not load. Check the internet connection.";
    }
  }

  window.addEventListener("DOMContentLoaded", initialize, { once: true });
})();