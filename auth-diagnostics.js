(() => {
  const FRIENDLY_ERRORS = {
    "auth/invalid-credential": "Firebase rejected the email/password combination. Re-enter the password or use Forgot password.",
    "auth/wrong-password": "The password does not match this Firebase user.",
    "auth/user-not-found": "No Firebase user exists for this email.",
    "auth/user-disabled": "This Firebase user has been disabled.",
    "auth/invalid-email": "The email address format is invalid.",
    "auth/too-many-requests": "Firebase temporarily blocked attempts after repeated failures. Wait a few minutes or reset the password.",
    "auth/network-request-failed": "The sign-in request could not reach Firebase. Check the connection and retry.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase. Add captianchill.github.io under Authentication > Settings > Authorized domains.",
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

    emailInput.value = localStorage.getItem("chillProsLastEmail") || emailInput.value || "chillprostx@gmail.com";

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
        errorBox.textContent = "Enter the owner email first.";
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
        localStorage.setItem("chillProsLastEmail", email);
        await auth.signInWithEmailAndPassword(email, password);
        errorBox.textContent = "Sign-in successful. Loading owner dashboard…";
      } catch (error) {
        console.error("Firebase owner sign-in failed:", error);
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
