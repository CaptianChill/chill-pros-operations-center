(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiAdvisoryReviewPanel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const FEATURE_FLAG = "chillProsFeatures:aiOperationsBrief";
  const DEFAULT_STORAGE_KEY = "fieldForged:chill-pros:operations-center:v3";
  const REFRESH_HANDLER_KEY = "__chillProsAiAdvisoryRefreshHandler";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readJobs(storage, key = DEFAULT_STORAGE_KEY) {
    try {
      const parsed = JSON.parse(storage?.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function buildPanelModel(records, pipeline, now) {
    if (!pipeline?.buildAdvisoryPipeline) {
      return { error: "AI advisory pipeline is unavailable." };
    }
    try {
      const result = pipeline.buildAdvisoryPipeline(records, { now: now || new Date().toISOString() });
      return {
        generatedAt: result.generatedAt,
        mode: result.mode,
        executable: false,
        requiresHumanApproval: true,
        totals: result.reviewTotals,
        queue: result.reviewQueue
      };
    } catch (error) {
      return { error: error?.message || "Unable to build the AI advisory review queue." };
    }
  }

  function renderPanelMarkup(model) {
    if (model?.error) {
      return `<article class="queue-item"><div><h3>Review queue unavailable</h3><p class="queue-meta">${escapeHtml(model.error)}</p></div></article>`;
    }

    const totals = model?.totals || {};
    const queue = Array.isArray(model?.queue) ? model.queue : [];
    const items = queue.length
      ? queue.slice(0, 12).map((item) => `
        <article class="queue-item ai-review-item" data-recommendation-id="${escapeHtml(item.id)}">
          <div>
            <h3>${escapeHtml(item.summary)}</h3>
            <p class="queue-meta">${escapeHtml(item.level)} • score ${escapeHtml(item.score)}</p>
            <small>${escapeHtml((item.reasons || []).join(" • ") || "No additional reason supplied")}</small>
          </div>
          <strong>${item.prohibited ? "BLOCKED" : "REVIEW"}</strong>
        </article>`).join("")
      : `<article class="queue-item"><div><h3>No advisory items</h3><p class="queue-meta">The review queue is currently empty.</p></div></article>`;

    return `
      <div class="metrics-grid ai-review-metrics">
        <article class="metric-card"><div><span>Total</span><strong>${Number(totals.total || 0)}</strong></div></article>
        <article class="metric-card"><div><span>Owner Approval</span><strong>${Number(totals.ownerApproval || 0)}</strong></div></article>
        <article class="metric-card"><div><span>Office Review</span><strong>${Number(totals.officeReview || 0)}</strong></div></article>
        <article class="metric-card"><div><span>Prohibited</span><strong>${Number(totals.prohibited || 0)}</strong></div></article>
      </div>
      <p class="queue-meta">Read-only advisory queue. This panel cannot approve, execute, or persist operational changes.</p>
      <div class="queue-list">${items}</div>`;
  }

  function storageKeyFromConfig(config) {
    return `fieldForged:${config?.tenant?.id || "chill-pros"}:operations-center:v3`;
  }

  function bindRefreshHandler(button, refresh) {
    if (!button?.addEventListener || typeof refresh !== "function") return false;
    const previous = button[REFRESH_HANDLER_KEY];
    if (previous && button.removeEventListener) {
      button.removeEventListener("click", previous);
    }
    button.addEventListener("click", refresh);
    button[REFRESH_HANDLER_KEY] = refresh;
    return true;
  }

  function mount(options = {}) {
    const documentRef = options.document || root?.document;
    const storage = options.storage || root?.localStorage;
    const pipeline = options.pipeline || root?.ChillProsAiAdvisoryPipeline;
    if (!documentRef || storage?.getItem(FEATURE_FLAG) !== "true") {
      return { mounted: false, reason: "feature-disabled" };
    }

    const aiView = documentRef.getElementById("ai");
    if (!aiView) return { mounted: false, reason: "ai-view-missing" };

    let container = documentRef.getElementById("aiAdvisoryReviewPanel");
    if (!container) {
      container = documentRef.createElement("section");
      container.id = "aiAdvisoryReviewPanel";
      container.className = "form-panel ai-advisory-review-panel";
      container.innerHTML = `<div class="page-header"><div><p class="eyebrow">HUMAN REVIEW REQUIRED</p><h2>AI Advisory Review Queue</h2></div><button type="button" class="secondary-action" id="refreshAiAdvisoryReviewPanel">Refresh Queue</button></div><div id="aiAdvisoryReviewPanelContent"></div>`;
      aiView.appendChild(container);
    }

    const refresh = () => {
      const records = readJobs(storage, storageKeyFromConfig(root?.FIELD_FORGED_CONFIG));
      const model = buildPanelModel(records, pipeline);
      const content = documentRef.getElementById("aiAdvisoryReviewPanelContent");
      if (content) content.innerHTML = renderPanelMarkup(model);
      return model;
    };

    bindRefreshHandler(documentRef.getElementById("refreshAiAdvisoryReviewPanel"), refresh);
    return { mounted: true, model: refresh() };
  }

  function autoMount() {
    if (!root?.document) return;
    const run = () => mount();
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", run, { once: true });
    else setTimeout(run, 0);
  }

  autoMount();

  return Object.freeze({
    FEATURE_FLAG,
    DEFAULT_STORAGE_KEY,
    bindRefreshHandler,
    buildPanelModel,
    escapeHtml,
    mount,
    readJobs,
    renderPanelMarkup,
    storageKeyFromConfig
  });
});