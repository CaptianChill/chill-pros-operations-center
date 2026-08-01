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

  const MIN_RETENTION_DAYS = 1;
  const MAX_RETENTION_DAYS = 3650;

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

  function parseDate(value, fieldName) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new TypeError(`${fieldName} must be a valid datetime`);
    return parsed;
  }

  function normalizeRetentionDays(value) {
    const days = Number(value);
    if (!Number.isInteger(days) || days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS) {
      throw new RangeError(`retentionDays must be an integer between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`);
    }
    return days;
  }

  function createAuditRecord(recommendation, context = {}, options = {}) {
    if (!recommendation || typeof recommendation !== "object") {
      throw new TypeError("recommendation must be an object");
    }

    const parsed = parseDate(options.now || new Date().toISOString(), "now");

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

  function applyRetentionPolicy(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError("records must be an array");

    const retentionDays = normalizeRetentionDays(options.retentionDays);
    const now = parseDate(options.now || new Date().toISOString(), "now");
    const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

    const retained = records.filter((record) => {
      if (!record || typeof record !== "object") throw new TypeError("each audit record must be an object");
      if (record.schemaVersion !== 1) throw new TypeError("each audit record must use schemaVersion 1");
      return parseDate(record.recordedAt, "recordedAt").getTime() >= cutoff;
    });

    return Object.freeze(retained.slice());
  }

  return Object.freeze({
    MAX_RETENTION_DAYS,
    MIN_RETENTION_DAYS,
    REDACTED_KEYS,
    applyRetentionPolicy,
    createAuditBatch,
    createAuditRecord,
    sanitize
  });
});