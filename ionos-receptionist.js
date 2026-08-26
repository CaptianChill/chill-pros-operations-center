(() => {
  "use strict";

  const SCRIPT_SELECTOR = 'script[name="web-chat"][src*="ionos.ai-voice-receptionist.com"]';

  function install(config = {}) {
    if (document.querySelector(SCRIPT_SELECTOR)) return true;

    const src = String(config.src || "").trim();
    const clientSecret = String(config.clientSecret || "").trim();
    if (!src || !clientSecret) {
      console.info("IONOS AI Receptionist is not configured yet. Add the unique IONOS widget src and client secret to window.CHILL_PROS_IONOS_RECEPTIONIST.");
      return false;
    }

    let parsed;
    try { parsed = new URL(src, window.location.href); } catch { return false; }
    if (parsed.hostname !== "ionos.ai-voice-receptionist.com") {
      console.error("Blocked unexpected AI Receptionist widget host.");
      return false;
    }

    const script = document.createElement("script");
    script.src = parsed.href;
    script.name = "web-chat";
    script.dataset.clientSecret = clientSecret;
    script.defer = true;
    script.setAttribute("data-ionos-receptionist", "1");
    script.addEventListener("load", () => document.documentElement.classList.add("ionos-receptionist-ready"));
    script.addEventListener("error", () => console.error("IONOS AI Receptionist widget failed to load."));
    document.body.appendChild(script);
    return true;
  }

  window.installIonosReceptionist = install;

  const boot = () => install(window.CHILL_PROS_IONOS_RECEPTIONIST || {});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
