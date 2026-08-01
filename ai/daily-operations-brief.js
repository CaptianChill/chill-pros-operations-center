(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsDailyOperationsBrief = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const FEATURE_FLAG = "chillProsFeatures:aiOperationsBrief";
  const DEFAULT_STORAGE_KEY = "fieldForged:chill-pros:operations-center:v3";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isFeatureEnabled(storage) {
    try {
      return storage?.getItem(FEATURE_FLAG) === "true";
    } catch (error) {
      return false;
    }
  }

  function readQueue(storage, storageKey = DEFAULT_STORAGE_KEY) {
    try {
      const parsed = JSON.parse(storage?.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function buildBrief(records, engine, now) {
    if (!engine?.buildOperationsBrief) {
      return { error: "AI Operations Engine is unavailable." };
    }
    try {
      return engine.buildOperationsBrief(records, { now: now || new Date().toISOString() });
    } catch (error) {
      return { error: error?.message || "Unable to build the operations brief." };
    }
  }

  function renderBriefMarkup(brief) {
    if (brief?.error) {
      return `<article class="queue-item"><div><h3>Brief unavailable</h3><p class="queue-meta">${escapeHtml(brief.error)}</p></div></article>`;
    }

    const totals = brief?.totals || {};
    const recommendations = Array.isArray(brief?.recommendations) ? brief.recommendations : [];
    const recommendationMarkup = recommendations.length
      ? recommendations.slice(0, 8).map((item) => `
        <article class="queue-item ai-brief-item">
          <div>
            <h3>${escapeHtml(item.customerName)}</h3>
            <p class="queue-meta">Priority ${escapeHtml(item.score)} • ${escapeHtml(item.status)}</p>
            <p>${escapeHtml(item.recommendedAction)}</p>
            <small>${escapeHtml((item.reasons || []).join(" • ") || "No additional reason supplied")}</small>
          </div>
          <strong>${item.urgent ? "URGENT" : "REVIEW"}</strong>
        </article>`).join("")
      : `<article class="queue-item"><div><h3>No active recommendations</h3><p class="queue-meta">New and active jobs will appear here after the queue is refreshed.</p></div></article>`;

    return `
      <div class="metrics-grid ai-brief-metrics">
        <article class="metric-card"><div><span>Active Jobs</span><strong>${Number(totals.activeJobs || 0)}</strong></div></article>
        <article class="metric-card"><div><span>Urgent</span><strong>${Number(totals.urgentJobs || 0)}</strong></div></article>
        <article class="metric-card"><div><span>Unassigned</span><strong>${Number(totals.unassignedJobs || 0)}</strong></div></article>
        <article class="metric-card"><div><span>Ready to Invoice</span><strong>${Number(totals.readyToInvoice || 0)}</strong></div></article>
      </div>
      <p class="queue-meta">Advisory only. Every operational change requires owner or office approval.</p>
      <div class="queue-list">${recommendationMarkup}</div>`;
  }

  function storageKeyFromConfig(config) {
    const tenantId = config?.tenant?.id || "chill-pros";
    return `fieldForged:${tenantId}:operations-center:v3`;
  }

  function mount(options = {}) {
    const documentRef = options.document || root?.document;
    const storage = options.storage || root?.localStorage;
    const engine = options.engine || root?.ChillProsAiOperations;
    if (!documentRef || !isFeatureEnabled(storage)) return { mounted: false, reason: "feature-disabled" };

    const aiView = documentRef.getElementById("ai");
    if (!aiView) return { mounted: false, reason: "ai-view-missing" };

    let container = documentRef.getElementById("dailyOperationsBrief");
    if (!container) {
      container = documentRef.createElement("section");
      container.id = "dailyOperationsBrief";
      container.className = "form-panel ai-operations-brief";
      container.innerHTML = `
        <div class="page-header">
          <div><p class="eyebrow">ADVISORY INTELLIGENCE</p><h2>Daily Operations Brief</h2></div>
          <button type="button" class="secondary-action" id="refreshDailyOperationsBrief">Refresh Brief</button>
        </div>
        <div id="dailyOperationsBriefContent"></div>`;
      aiView.appendChild(container);
    }

    const refresh = () => {
      const records = readQueue(storage, storageKeyFromConfig(root?.FIELD_FORGED_CONFIG));
      const brief = buildBrief(records, engine);
      const content = documentRef.getElementById("dailyOperationsBriefContent");
      if (content) content.innerHTML = renderBriefMarkup(brief);
      return brief;
    };

    documentRef.getElementById("refreshDailyOperationsBrief")?.addEventListener("click", refresh);
    const brief = refresh();
    return { mounted: true, brief };
  }

  function autoMount() {
    if (!root?.document) return;
    const run = () => mount();
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      setTimeout(run, 0);
    }
  }

  autoMount();

  return Object.freeze({
    FEATURE_FLAG,
    DEFAULT_STORAGE_KEY,
    buildBrief,
    isFeatureEnabled,
    mount,
    readQueue,
    renderBriefMarkup,
    storageKeyFromConfig
  });
});
