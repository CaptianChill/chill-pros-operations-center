(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiMilestoneReadiness = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REQUIRED_DECISIONS = Object.freeze([
    "provider",
    "monthlyBudgetUsd",
    "privacyPolicy",
    "retentionDays",
    "auditStorage",
    "approvalPolicy",
    "ownerApproved",
    "ownerApprovalRecord"
  ]);

  const REQUIRED_EVIDENCE = Object.freeze([
    "ciPassed",
    "advisoryPipelineTested",
    "executionGuardTested",
    "dataMinimizationTested",
    "auditRedactionTested",
    "integrationPolicyValidated"
  ]);

  const ALLOWED_PROVIDERS = Object.freeze(["openai", "anthropic", "google", "azure-openai", "other"]);
  const ALLOWED_AUDIT_STORAGE = Object.freeze(["firestore", "cloud-logging", "database", "other"]);
  const MAX_MONTHLY_BUDGET_USD = 10000;
  const MAX_RETENTION_DAYS = 3650;
  const MAX_APPROVAL_CLOCK_SKEW_MS = 5 * 60 * 1000;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeUtcTimestamp(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString() === value ? value : "";
  }

  function normalizeDecisionText(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function resolveEvaluationTimestamp(value) {
    if (value === undefined) return new Date().toISOString();
    const normalized = normalizeUtcTimestamp(value);
    if (!normalized) throw new TypeError("evaluatedAt must be a canonical UTC timestamp");
    return normalized;
  }

  function approvalRecordPresent(value, evaluatedAt) {
    if (!isObject(value)) return false;
    const approverId = typeof value.approverId === "string" ? value.approverId.trim() : "";
    const approvedAt = normalizeUtcTimestamp(value.approvedAt);
    const policyVersion = typeof value.policyVersion === "string" ? value.policyVersion.trim() : "";
    if (!approverId || !approvedAt || !policyVersion) return false;

    const approvalTime = new Date(approvedAt).getTime();
    const evaluationTime = new Date(evaluatedAt).getTime();
    return approvalTime <= evaluationTime + MAX_APPROVAL_CLOCK_SKEW_MS;
  }

  function decisionPresent(key, value, evaluatedAt) {
    if (key === "ownerApproved") return value === true;
    if (key === "ownerApprovalRecord") return approvalRecordPresent(value, evaluatedAt);
    if (key === "provider") return ALLOWED_PROVIDERS.includes(normalizeDecisionText(value));
    if (key === "auditStorage") return ALLOWED_AUDIT_STORAGE.includes(normalizeDecisionText(value));
    if (key === "monthlyBudgetUsd") {
      return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_MONTHLY_BUDGET_USD;
    }
    if (key === "retentionDays") {
      return Number.isInteger(value) && value >= 1 && value <= MAX_RETENTION_DAYS;
    }
    if (typeof value === "string") return value.trim().length > 0;
    return false;
  }

  function evaluateMilestoneReadiness(input = {}) {
    if (!isObject(input)) throw new TypeError("readiness input must be an object");

    const evaluatedAt = resolveEvaluationTimestamp(input.evaluatedAt);
    const decisions = isObject(input.decisions) ? input.decisions : {};
    const evidence = isObject(input.evidence) ? input.evidence : {};
    const missingDecisions = REQUIRED_DECISIONS.filter(
      (key) => !decisionPresent(key, decisions[key], evaluatedAt)
    );
    const missingEvidence = REQUIRED_EVIDENCE.filter((key) => evidence[key] !== true);
    const ready = missingDecisions.length === 0 && missingEvidence.length === 0;

    return Object.freeze({
      milestone: "external-model-integration-ready",
      evaluatedAt,
      ready,
      status: ready ? "ready-for-owner-approved-integration" : "blocked",
      missingDecisions: Object.freeze(missingDecisions),
      missingEvidence: Object.freeze(missingEvidence),
      advisoryOnly: true,
      executable: false,
      requiresExplicitOwnerApproval: true,
      nextAction: ready
        ? "Owner may authorize provider integration on a separate feature branch."
        : "Resolve every listed decision and evidence item before provider integration."
    });
  }

  function authorizeIntegration() {
    return Object.freeze({
      allowed: false,
      reason: "Readiness assessment never authorizes integration or production actions; explicit owner approval is required."
    });
  }

  return Object.freeze({
    REQUIRED_DECISIONS,
    REQUIRED_EVIDENCE,
    ALLOWED_PROVIDERS,
    ALLOWED_AUDIT_STORAGE,
    MAX_MONTHLY_BUDGET_USD,
    MAX_RETENTION_DAYS,
    MAX_APPROVAL_CLOCK_SKEW_MS,
    evaluateMilestoneReadiness,
    authorizeIntegration
  });
});