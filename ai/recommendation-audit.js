(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiRecommendationAudit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REDACTED_KEYS = new Set([
    "accessToken",
    "refreshToken",
    "apiKey",
    "authorization",
    "password",
    "secret",
    "seedPhrase"
  ]);

  function sanitize(value, depth = 0) {
    if (depth > 5) return "[MAX_DEPTH]";
    if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
    if (!value || typeof value !== "object") return value;

    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = REDACTED_KEYS.has(key)
        ? "[REDACTED]"
        : sanitize(value[key], depth + 1);
      return result;
    }, {});
  }

  function normalizeText(value, fallback) {
    const normalized = String(value || "").trim();
    return normalized || fallback;
  }

  function createAuditRecord(recommendation, context = {}, options = {}) {
    if (!recommendation || typeof recommendation !== "object") {
      throw new TypeError("recommendation must be an object");
    }

    const now = options.now || new Date().toISOString();
    const parsed = new Date(now);
    if (Number.isNaN(parsed.getTime())) throw new TypeError("now must be a valid datetime");

    return Object.freeze({
      schemaVersion: 1,
      recordedAt: parsed.toISOString(),
      recommendationId: normalizeText(recommendation.id, "unassigned"),
      action: normalizeText(recommendation.action || recommendation.recommendedActionType, "informational"),
      summary: normalizeText(recommendation.summary || recommendation.recommendedAction, "AI recommendation"),
      advisoryOnly: true,
      requiresHumanApproval: true,
      source: normalizeText(context.source, "ai-operations-engine"),
      actorRole: normalizeText(context.actorRole, "system"),
      tenantId: normalizeText(context.tenantId, "chill-pros"),
      correlationId: normalizeText(context.correlationId, "not-provided"),
      evidence: sanitize(recommendation.evidence || recommendation.reasons || []),
      metadata: sanitize(context.metadata || {})
    });
  }

  function createAuditBatch(recommendations, context = {}, options = {}) {
    if (!Array.isArray(recommendations)) {
      throw new TypeError("recommendations must be an array");
    }
    return Object.freeze(recommendations.map((item) => createAuditRecord(item, context, options)));
  }

  return Object.freeze({
    REDACTED_KEYS,
    createAuditBatch,
    createAuditRecord,
    sanitize
  });
});
