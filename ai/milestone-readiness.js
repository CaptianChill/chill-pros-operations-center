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

  const POLICY_DECISION_KEYS = Object.freeze([
    "provider",
    "monthlyBudgetUsd",
    "privacyPolicy",
    "retentionDays",
    "auditStorage",
    "approvalPolicy"
  ]);

  const APPROVAL_RECORD_KEYS = Object.freeze([
    "approverId",
    "approvedAt",
    "policyVersion",
    "approvedPolicy"
  ]);

  const ALLOWED_PROVIDERS = Object.freeze(["openai", "anthropic", "google", "azure-openai", "other"]);
  const ALLOWED_AUDIT_STORAGE = Object.freeze(["firestore", "cloud-logging", "database", "other"]);
  const MAX_MONTHLY_BUDGET_USD = 10000;
  const MAX_RETENTION_DAYS = 3650;
  const MAX_APPROVAL_CLOCK_SKEW_MS = 5 * 60 * 1000;
  const MAX_APPROVAL_AGE_MS = 90 * 24 * 60 * 60 * 1000;
  const MAX_APPROVER_ID_LENGTH = 160;
  const MAX_POLICY_VERSION_LENGTH = 120;
  const MAX_POLICY_TEXT_LENGTH = 1000;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function hasOwn(value, key) {
    return isObject(value) && Object.prototype.hasOwnProperty.call(value, key);
  }

  function hasOwnKeys(value, keys) {
    return isObject(value) && keys.every((key) => hasOwn(value, key));
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

  function boundedText(value, maxLength, options = {}) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) return "";
    if (/[^\P{Cc}\t\n\r]/u.test(normalized) || /\p{Cf}/u.test(normalized)) return "";
    if (options.singleLine && /[\t\n\r]/.test(normalized)) return "";
    return options.lowercase ? normalized.toLowerCase() : normalized;
  }

  function boundedApprovalText(value, maxLength) {
    return boundedText(value, maxLength, { singleLine: true });
  }

  function boundedPolicyText(value) {
    return boundedText(value, MAX_POLICY_TEXT_LENGTH, { lowercase: true });
  }

  function normalizePolicySnapshot(decisions) {
    if (!hasOwnKeys(decisions, POLICY_DECISION_KEYS)) return null;
    const privacyPolicy = boundedPolicyText(decisions.privacyPolicy);
    const approvalPolicy = boundedPolicyText(decisions.approvalPolicy);
    if (!privacyPolicy || !approvalPolicy) return null;
    const snapshot = {
      provider: normalizeDecisionText(decisions.provider),
      monthlyBudgetUsd: decisions.monthlyBudgetUsd,
      privacyPolicy,
      retentionDays: decisions.retentionDays,
      auditStorage: normalizeDecisionText(decisions.auditStorage),
      approvalPolicy
    };
    return Object.freeze(snapshot);
  }

  function policySnapshotsMatch(approvedPolicy, decisions) {
    const current = normalizePolicySnapshot(decisions);
    const approved = normalizePolicySnapshot(approvedPolicy);
    if (!current || !approved) return false;
    return POLICY_DECISION_KEYS.every((key) => approved[key] === current[key]);
  }

  function resolveEvaluationTimestamp(value) {
    if (value === undefined) return new Date().toISOString();
    const normalized = normalizeUtcTimestamp(value);
    if (!normalized) throw new TypeError("evaluatedAt must be a canonical UTC timestamp");
    return normalized;
  }

  function approvalRecordPresent(value, decisions, evaluatedAt) {
    if (!hasOwnKeys(value, APPROVAL_RECORD_KEYS)) return false;
    const approverId = boundedApprovalText(value.approverId, MAX_APPROVER_ID_LENGTH);
    const approvedAt = normalizeUtcTimestamp(value.approvedAt);
    const policyVersion = boundedApprovalText(value.policyVersion, MAX_POLICY_VERSION_LENGTH);
    if (!approverId || !approvedAt || !policyVersion) return false;
    if (!policySnapshotsMatch(value.approvedPolicy, decisions)) return false;

    const approvalTime = new Date(approvedAt).getTime();
    const evaluationTime = new Date(evaluatedAt).getTime();
    const approvalAge = evaluationTime - approvalTime;
    return approvalAge >= -MAX_APPROVAL_CLOCK_SKEW_MS && approvalAge <= MAX_APPROVAL_AGE_MS;
  }

  function decisionPresent(key, value, decisions, evaluatedAt) {
    if (key === "ownerApproved") return value === true;
    if (key === "ownerApprovalRecord") return approvalRecordPresent(value, decisions, evaluatedAt);
    if (key === "provider") return ALLOWED_PROVIDERS.includes(normalizeDecisionText(value));
    if (key === "auditStorage") return ALLOWED_AUDIT_STORAGE.includes(normalizeDecisionText(value));
    if (key === "monthlyBudgetUsd") {
      return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_MONTHLY_BUDGET_USD;
    }
    if (key === "retentionDays") {
      return Number.isInteger(value) && value >= 1 && value <= MAX_RETENTION_DAYS;
    }
    if (key === "privacyPolicy" || key === "approvalPolicy") return Boolean(boundedPolicyText(value));
    if (typeof value === "string") return value.trim().length > 0;
    return false;
  }

  function evaluateMilestoneReadiness(input = {}) {
    if (!isObject(input)) throw new TypeError("readiness input must be an object");

    const evaluatedAt = resolveEvaluationTimestamp(input.evaluatedAt);
    const decisions = isObject(input.decisions) ? input.decisions : {};
    const evidence = isObject(input.evidence) ? input.evidence : {};
    const missingDecisions = REQUIRED_DECISIONS.filter(
      (key) => !hasOwn(decisions, key) || !decisionPresent(key, decisions[key], decisions, evaluatedAt)
    );
    const missingEvidence = REQUIRED_EVIDENCE.filter(
      (key) => !hasOwn(evidence, key) || evidence[key] !== true
    );
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
    POLICY_DECISION_KEYS,
    APPROVAL_RECORD_KEYS,
    ALLOWED_PROVIDERS,
    ALLOWED_AUDIT_STORAGE,
    MAX_MONTHLY_BUDGET_USD,
    MAX_RETENTION_DAYS,
    MAX_APPROVAL_CLOCK_SKEW_MS,
    MAX_APPROVAL_AGE_MS,
    MAX_APPROVER_ID_LENGTH,
    MAX_POLICY_VERSION_LENGTH,
    MAX_POLICY_TEXT_LENGTH,
    normalizePolicySnapshot,
    evaluateMilestoneReadiness,
    authorizeIntegration
  });
});
