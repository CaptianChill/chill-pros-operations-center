(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiModelResponseValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ALLOWED_LEVELS = new Set([
    "informational",
    "office-review",
    "owner-approval",
    "prohibited"
  ]);

  const MAX_RECOMMENDATIONS = 50;
  const MAX_REASONS = 20;
  const MAX_TEXT_LENGTH = 1000;

  function text(value, field, required) {
    if (value === undefined || value === null) {
      if (required) throw new TypeError(`${field} is required`);
      return "";
    }
    if (typeof value !== "string") throw new TypeError(`${field} must be a string`);
    const normalized = value.trim();
    if (required && !normalized) throw new TypeError(`${field} is required`);
    if (normalized.length > MAX_TEXT_LENGTH) {
      throw new RangeError(`${field} exceeds ${MAX_TEXT_LENGTH} characters`);
    }
    return normalized;
  }

  function finiteScore(value, field) {
    if (value === undefined || value === null) return 0;
    const score = Number(value);
    if (!Number.isFinite(score)) throw new TypeError(`${field} must be finite`);
    if (score < 0 || score > 100) throw new RangeError(`${field} must be between 0 and 100`);
    return score;
  }

  function reasons(value, field) {
    if (value === undefined || value === null) return Object.freeze([]);
    if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
    if (value.length > MAX_REASONS) throw new RangeError(`${field} exceeds ${MAX_REASONS} entries`);
    return Object.freeze(value.map((item, index) => text(item, `${field}[${index}]`, true)));
  }

  function validateRecommendation(item, index) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError(`recommendations[${index}] must be an object`);
    }

    const id = text(item.id, `recommendations[${index}].id`, true);
    const summary = text(item.summary, `recommendations[${index}].summary`, true);
    const action = text(item.action, `recommendations[${index}].action`, false).toLowerCase();
    const suppliedLevel = text(item.approvalLevel, `recommendations[${index}].approvalLevel`, false).toLowerCase();
    const approvalLevel = ALLOWED_LEVELS.has(suppliedLevel) ? suppliedLevel : "owner-approval";

    return Object.freeze({
      id,
      summary,
      action,
      approvalLevel,
      score: finiteScore(item.score, `recommendations[${index}].score`),
      entityId: text(item.entityId, `recommendations[${index}].entityId`, false),
      reasons: reasons(item.reasons, `recommendations[${index}].reasons`),
      advisoryOnly: true,
      executable: false,
      requiresHumanApproval: true
    });
  }

  function validateModelResponse(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new TypeError("model response must be an object");
    }
    if (payload.advisoryOnly !== true) {
      throw new TypeError("model response must explicitly set advisoryOnly to true");
    }
    if (!Array.isArray(payload.recommendations)) {
      throw new TypeError("model response recommendations must be an array");
    }
    if (payload.recommendations.length > MAX_RECOMMENDATIONS) {
      throw new RangeError(`model response exceeds ${MAX_RECOMMENDATIONS} recommendations`);
    }

    const seen = new Set();
    const recommendations = payload.recommendations.map((item, index) => {
      const recommendation = validateRecommendation(item, index);
      if (seen.has(recommendation.id)) {
        throw new TypeError(`duplicate recommendation id: ${recommendation.id}`);
      }
      seen.add(recommendation.id);
      return recommendation;
    });

    return Object.freeze({
      schemaVersion: "1.0",
      advisoryOnly: true,
      executable: false,
      requiresHumanApproval: true,
      summary: text(payload.summary, "summary", false),
      recommendations: Object.freeze(recommendations)
    });
  }

  function authorizeModelExecution() {
    return Object.freeze({
      allowed: false,
      reason: "External model output is advisory-only and cannot execute operational actions."
    });
  }

  return Object.freeze({
    validateModelResponse,
    authorizeModelExecution
  });
});
