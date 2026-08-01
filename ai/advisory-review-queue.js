(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiAdvisoryReviewQueue = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LEVEL_PRIORITY = Object.freeze({
    prohibited: 0,
    "owner-approval": 1,
    "office-review": 2,
    informational: 3
  });

  function text(value) {
    return String(value ?? "").trim();
  }

  function normalizeLevel(value) {
    const level = text(value).toLowerCase();
    return Object.prototype.hasOwnProperty.call(LEVEL_PRIORITY, level)
      ? level
      : "owner-approval";
  }

  function finiteScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? score : 0;
  }

  function normalizeRecommendation(item, index) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError(`recommendations[${index}] must be an object`);
    }

    const id = text(item.id || item.recommendationId);
    if (!id) throw new TypeError(`recommendations[${index}] requires a stable id`);

    const level = normalizeLevel(item.level || item.approvalLevel);
    const prohibited = level === "prohibited";

    return Object.freeze({
      id,
      source: text(item.source) || "ai-operations-engine",
      summary: text(item.summary || item.recommendedAction || item.action) || "AI recommendation",
      level,
      score: finiteScore(item.score),
      prohibited,
      advisoryOnly: true,
      executable: false,
      requiresHumanApproval: true,
      entityId: text(item.entityId || item.jobId || item.technicianId),
      reasons: Object.freeze(
        (Array.isArray(item.reasons) ? item.reasons : [])
          .map(text)
          .filter(Boolean)
          .slice(0, 20)
      )
    });
  }

  function buildReviewQueue(recommendations) {
    if (!Array.isArray(recommendations)) {
      throw new TypeError("recommendations must be an array");
    }

    const seen = new Set();
    const queue = recommendations.map((item, index) => {
      const normalized = normalizeRecommendation(item, index);
      if (seen.has(normalized.id)) {
        throw new TypeError(`duplicate recommendation id: ${normalized.id}`);
      }
      seen.add(normalized.id);
      return normalized;
    });

    return Object.freeze(queue.sort((a, b) =>
      LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level] ||
      b.score - a.score ||
      a.id.localeCompare(b.id)
    ));
  }

  function summarizeReviewQueue(queue) {
    if (!Array.isArray(queue)) throw new TypeError("queue must be an array");

    const totals = {
      total: queue.length,
      prohibited: 0,
      ownerApproval: 0,
      officeReview: 0,
      informational: 0
    };

    queue.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        throw new TypeError(`queue[${index}] must be an object`);
      }
      const level = normalizeLevel(item.level);
      if (level === "prohibited") totals.prohibited += 1;
      else if (level === "owner-approval") totals.ownerApproval += 1;
      else if (level === "office-review") totals.officeReview += 1;
      else totals.informational += 1;
    });

    return Object.freeze(totals);
  }

  function authorizeQueueExecution() {
    return Object.freeze({
      allowed: false,
      reason: "The AI review queue is advisory-only. Authenticated humans must approve and execute all operational actions."
    });
  }

  return Object.freeze({
    buildReviewQueue,
    summarizeReviewQueue,
    authorizeQueueExecution
  });
});
