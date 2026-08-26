(() => {
  "use strict";

  let loading = false;
  let lastAttempt = 0;

  function ensureChillBro() {
    if (document.getElementById("chillBroLauncher") && document.getElementById("chillBroPanel")) return;
    if (loading) return;
    const now = Date.now();
    if (now - lastAttempt < 250) return;
    lastAttempt = now;
    loading = true;

    const script = document.createElement("script");
    script.src = `chill-bro.js?v=20260826-v10&restore=${now}`;
    script.async = true;
    script.dataset.chillBroRestore = "1";
    script.onload = () => {
      loading = false;
      document.documentElement.classList.toggle("chill-bro-mounted", Boolean(document.getElementById("chillBroLauncher")));
    };
    script.onerror = () => { loading = false; };
    document.head.appendChild(script);
  }

  function start() {
    ensureChillBro();
    const observer = new MutationObserver(() => {
      if (!document.getElementById("chillBroLauncher") || !document.getElementById("chillBroPanel")) {
        queueMicrotask(ensureChillBro);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    [150, 500, 1200, 2500].forEach((delay) => setTimeout(ensureChillBro, delay));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
