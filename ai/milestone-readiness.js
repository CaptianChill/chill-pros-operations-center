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
    "approvalPolicy"
  ]);

  const REQUIRED_EVIDENCE = Object.freeze([
    "ciPassed",
    "advisoryPipelineTested",
    "executionGuardTested",
    "dataMinimizationTested",
    "auditRedactionTested"
  ]);

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function present(value) {
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value) && value >= 0;
    return value === true;
  }

  function evaluateMilestoneReadiness(input = {}) {
    if (!isObject(input)) throw new TypeError("readiness input must be an object");

    const decisions = isObject(input.decisions) ? input.decisions : {};
    const evidence = isObject(input.evidence) ? input.evidence : {};
    const missingDecisions = REQUIRED_DECISIONS.filter((key) => !present(decisions[key]));
    const missingEvidence = REQUIRED_EVIDENCE.filter((key) => evidence[key] !== true);
    const ready = missingDecisions.length === 0 && missingEvidence.length === 0;

    return Object.freeze({
      milestone: "external-model-integration-ready",
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
    evaluateMilestoneReadiness,
    authorizeIntegration
  });
});
