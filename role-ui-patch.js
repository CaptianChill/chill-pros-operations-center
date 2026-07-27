(() => {
  "use strict";

  const ROLE_LABELS = Object.freeze({
    owner: Object.freeze({ title: "Owner Mobile", status: "Full administrative access" }),
    office: Object.freeze({ title: "Office Workspace", status: "Operations and dispatch access" }),
    technician: Object.freeze({ title: "Technician Workspace", status: "Assigned work only" })
  });

  function syncRoleUi() {
    const role = document.body?.dataset?.role;
    const labels = ROLE_LABELS[role];
    if (!labels) return false;

    document.querySelectorAll(".owner-mobile-strip").forEach((strip) => {
      const title = strip.querySelector("strong");
      const status = strip.querySelector("span");
      if (title) title.textContent = labels.title;
      if (status) status.textContent = labels.status;
      strip.dataset.role = role;
      strip.setAttribute("aria-label", `${labels.title}: ${labels.status}`);
    });

    return true;
  }

  function startRoleUiSync() {
    syncRoleUi();
    if (!document.body || typeof MutationObserver !== "function") return;

    const observer = new MutationObserver(() => syncRoleUi());
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-role"],
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startRoleUiSync, { once: true });
  } else {
    startRoleUiSync();
  }
})();
