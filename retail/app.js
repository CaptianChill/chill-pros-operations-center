(() => {
  const config = window.FIELD_FORGED_RETAIL_CONFIG || {};
  const product = config.product || {};
  const tenant = config.tenant || {};
  const branding = config.branding || {};
  const features = config.features || {};

  const titles = {
    dashboard: "Operations overview",
    intake: "New service intake",
    jobs: "Jobs and dispatch",
    equipment: "Equipment records",
    quotes: "Quotes and approvals",
    parts: "Parts workflow",
    team: "Team and roles",
    reports: "Reports",
    settings: "Workspace settings"
  };

  const root = document.documentElement;
  const toast = document.getElementById("toast");
  let toastTimer;

  function setText(selector, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  function applyTheme(theme = branding) {
    const values = {
      "--brand": theme.primary,
      "--brand-soft": theme.primarySoft,
      "--brand-dark": theme.primaryDark,
      "--bg": theme.background,
      "--surface": theme.surface,
      "--text": theme.text,
      "--muted": theme.muted
    };

    Object.entries(values).forEach(([property, value]) => {
      if (value) root.style.setProperty(property, value);
    });
  }

  function applyConfiguration() {
    applyTheme();
    setText("[data-product-name]", product.name);
    setText("[data-product-edition]", product.edition);
    setText("[data-product-descriptor]", product.descriptor);
    setText("[data-company-name]", tenant.companyName);
    setText("[data-short-name]", tenant.shortName);
    setText("[data-powered-by]", product.poweredBy ? `Powered by ${product.poweredBy}` : "");

    document.title = `${product.name || "FieldForged Ops"} — ${tenant.companyName || "Workspace"}`;

    if (features.removeFieldForgedBranding) {
      document.querySelectorAll("[data-powered-by]").forEach((element) => element.remove());
    }
  }

  function showToast(message) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
  }

  function showView(id) {
    const target = document.getElementById(id);
    if (!target) return;

    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("active", view.id === id);
    });
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === id);
    });

    const title = document.getElementById("pageTitle");
    if (title) title.textContent = titles[id] || "FieldForged Ops";
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewTarget));
  });

  document.getElementById("retailIntakeForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const record = Object.fromEntries(new FormData(event.currentTarget).entries());
    const existing = JSON.parse(localStorage.getItem("fieldforgedRetailDemoIntakes") || "[]");
    existing.unshift({ ...record, id: crypto.randomUUID?.() || String(Date.now()), createdAt: new Date().toISOString() });
    localStorage.setItem("fieldforgedRetailDemoIntakes", JSON.stringify(existing.slice(0, 25)));
    event.currentTarget.reset();
    showToast("Service intake added to the retail demo workflow.");
  });

  document.getElementById("brandingForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const companyName = document.getElementById("companyNameInput")?.value.trim();
    const shortName = document.getElementById("shortNameInput")?.value.trim().toUpperCase();
    const primary = document.getElementById("primaryColorInput")?.value;
    const removeBranding = document.getElementById("removeBrandingInput")?.checked;

    if (companyName) setText("[data-company-name]", companyName);
    if (shortName) setText("[data-short-name]", shortName);
    if (primary) {
      root.style.setProperty("--brand", primary);
      root.style.setProperty("--brand-soft", primary);
    }
    document.querySelectorAll("[data-powered-by]").forEach((element) => {
      element.style.display = removeBranding ? "none" : "";
    });

    showToast("White-label branding preview applied.");
  });

  applyConfiguration();
  const initialView = window.location.hash.replace("#", "");
  showView(document.getElementById(initialView) ? initialView : "dashboard");
})();
