(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiApprovalPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ACTION_LEVELS = Object.freeze({
    INFORMATIONAL: "informational",
    OFFICE_REVIEW: "office-review",
    OWNER_APPROVAL: "owner-approval",
    PROHIBITED: "prohibited"
  });

  const PROHIBITED_ACTIONS = new Set([
    "place-live-order",
    "send-payment",
    "change-bank-account",
    "delete-customer",
    "delete-job",
    "grant-admin-access",
    "export-all-customer-data"
  ]);

  const OWNER_APPROVAL_ACTIONS = new Set([
    "assign-technician-override",
    "override-capacity",
    "override-qualification",
    "send-estimate",
    "send-invoice",
    "order-parts",
    "issue-refund",
    "change-price",
    "contact-customer"
  ]);

  const OFFICE_REVIEW_ACTIONS = new Set([
    "assign-technician",
    "schedule-job",
    "update-job-status",
    "create-follow-up",
    "prepare-estimate",
    "prepare-invoice",
    "prepare-customer-message"
  ]);

  function normalizeAction(action) {
    return String(action || "").trim().toLowerCase();
  }

  function classifyRecommendation(recommendation) {
    if (!recommendation || typeof recommendation !== "object") {
      throw new TypeError("recommendation must be an object");
    }

    const action = normalizeAction(recommendation.action || recommendation.recommendedActionType);
    if (!action) {
      return Object.freeze({
        action: "",
        level: ACTION_LEVELS.INFORMATIONAL,
        executable: false,
        requiresHumanApproval: true,
        reason: "No operational action was supplied; treat the recommendation as informational only."
      });
    }

    if (PROHIBITED_ACTIONS.has(action)) {
      return Object.freeze({
        action,
        level: ACTION_LEVELS.PROHIBITED,
        executable: false,
        requiresHumanApproval: true,
        reason: "This action is outside the AI Operations Engine safety boundary and must not be executed by AI."
      });
    }

    if (OWNER_APPROVAL_ACTIONS.has(action)) {
      return Object.freeze({
        action,
        level: ACTION_LEVELS.OWNER_APPROVAL,
        executable: false,
        requiresHumanApproval: true,
        reason: "This action requires explicit authenticated owner approval."
      });
    }

    if (OFFICE_REVIEW_ACTIONS.has(action)) {
      return Object.freeze({
        action,
        level: ACTION_LEVELS.OFFICE_REVIEW,
        executable: false,
        requiresHumanApproval: true,
        reason: "This action requires authenticated office or owner review."
      });
    }

    return Object.freeze({
      action,
      level: ACTION_LEVELS.OWNER_APPROVAL,
      executable: false,
      requiresHumanApproval: true,
      reason: "Unknown operational actions default to explicit owner approval."
    });
  }

  function buildApprovalQueue(recommendations) {
    if (!Array.isArray(recommendations)) {
      throw new TypeError("recommendations must be an array");
    }

    return recommendations.map((recommendation, index) => Object.freeze({
      id: String(recommendation?.id || `recommendation-${index + 1}`),
      summary: String(recommendation?.summary || recommendation?.recommendedAction || "AI recommendation"),
      ...classifyRecommendation(recommendation)
    }));
  }

  function authorizeExecution() {
    return Object.freeze({
      allowed: false,
      reason: "AI recommendations are advisory-only. Execution must occur through an authenticated human-controlled workflow."
    });
  }

  return Object.freeze({
    ACTION_LEVELS,
    classifyRecommendation,
    buildApprovalQueue,
    authorizeExecution
  });
});
