(() => {
  const currentHost = window.location.hostname;
  const portal = new URLSearchParams(window.location.search).get("portal");
  const technicianPortal = portal === "technician";
  const emailStorageKey = technicianPortal ? "chillProsLastTechnicianEmail" : "chillProsLastEmail";
  const FRIENDLY_ERRORS = {
    "auth/invalid-credential": "Firebase rejected the email/password combination. Re-enter the password or use Forgot password.",
    "auth/wrong-password": "The password does not match this Firebase user.",
    "auth/user-not-found": "No Firebase user exists for this email.",
    "auth/user-disabled": "This Firebase user has been disabled.",
    "auth/invalid-email": "The email address format is invalid.",
    "auth/too-many-requests": "Firebase temporarily blocked attempts after repeated failures. Wait a few minutes or reset the password.",
    "auth/network-request-failed": "The sign-in request could not reach Firebase. Check the connection and retry.",
    "auth/unauthorized-domain": `This website domain is not authorized in Firebase. Add ${currentHost} under Authentication > Settings > Authorized domains.`,
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase Authentication."
  };

  const waitFor = (test, timeout = 12000) => new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const value = test();
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for authentication interface."));
      }
    }, 100);
  });

  function safeStorageGet(key) {
    try {
      return window.localStorage?.getItem(key) || "";
    } catch (error) {
      console.warn("Saved sign-in email is unavailable; continuing without it:", error);
      return "";
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage?.setItem(key, value);
    } catch (error) {
      console.warn("Unable to save the sign-in email; authentication will continue:", error);
    }
  }

  function formatError(error) {
    const code = error?.code || "auth/unknown";
    return `${FRIENDLY_ERRORS[code] || error?.message || "Sign-in failed."} (${code})`;
  }

  async function install() {
    const form = await waitFor(() => document.getElementById("authForm"));
    const auth = await waitFor(() => window.chillProsAuth || (window.firebase?.auth ? window.firebase.auth() : null));
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const errorBox = document.getElementById("authError");
    const submitButton = form.querySelector('button[type="submit"]');

    if (technicianPortal) {
      const heading = form.querySelector("h2");
      const description = form.querySelector("p");
      if (heading) heading.textContent = "Technician Sign-In";
      if (description) description.textContent = "Use your assigned Chill Pros technician account.";
      document.title = "Chill Pros Technician Sign-In";

      if (auth.currentUser) {
        errorBox.textContent = "Preparing a separate technician sign-in…";
        try {
          await auth.signOut();
        } catch (error) {
          console.error("Unable to clear the existing session for technician sign-in:", error);
          errorBox.textContent = "Could not clear the existing account session. Use Sign out, then reopen the technician link.";
          return;
        }
      }
    }

    emailInput.value = safeStorageGet(emailStorageKey);

    const controls = document.createElement("div");
    controls.className = "auth-recovery-controls";
    controls.innerHTML = `
      <button type="button" id="toggleAuthPassword" class="auth-link-button">Show password</button>
      <button type="button" id="forgotAuthPassword" class="auth-link-button">Forgot password</button>
    `;
    passwordInput.closest("label")?.insertAdjacentElement("afterend", controls);

    document.getElementById("toggleAuthPassword").addEventListener("click", (event) => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      event.currentTarget.textContent = showing ? "Show password" : "Hide password";
    });

    document.getElementById("forgotAuthPassword").addEventListener("click", async () => {
      const email = emailInput.value.trim().toLowerCase();
      if (!email) {
        errorBox.textContent = "Enter your account email first.";
        return;
      }
      errorBox.textContent = "Sending password reset email…";
      try {
        await auth.sendPasswordResetEmail(email);
        errorBox.textContent = `Password reset email sent to ${email}.`;
      } catch (error) {
        console.error("Password reset failed:", error);
        errorBox.textContent = formatError(error);
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      errorBox.textContent = "Signing in…";
      submitButton.disabled = true;
      submitButton.textContent = "SIGNING IN…";
      try {
        safeStorageSet(emailStorageKey, email);
        await auth.signInWithEmailAndPassword(email, password);
        errorBox.textContent = technicianPortal
          ? "Sign-in successful. Loading technician workspace…"
          : "Sign-in successful. Loading your workspace…";
      } catch (error) {
        console.error("Firebase sign-in failed:", error);
        errorBox.textContent = formatError(error);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "SIGN IN";
      }
    }, true);

    const style = document.createElement("style");
    style.textContent = `
      .auth-recovery-controls{display:flex;justify-content:space-between;gap:12px;margin-top:8px}
      .auth-link-button{width:auto!important;margin:0!important;padding:4px 0!important;background:transparent!important;color:#7edbff!important;font-weight:700!important;text-decoration:underline;box-shadow:none!important}
      .auth-card button:disabled{opacity:.65;cursor:wait}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener("DOMContentLoaded", () => {
    install().catch((error) => console.error("Authentication diagnostics failed to install:", error));
  }, { once: true });
})();
