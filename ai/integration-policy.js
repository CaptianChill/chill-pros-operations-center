(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiIntegrationPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ALLOWED_PROVIDERS = Object.freeze(["openai", "anthropic", "google", "azure-openai", "other"]);
  const ALLOWED_AUDIT_STORAGE = Object.freeze(["firestore", "cloud-logging", "database", "other"]);
  const REQUIRED_APPROVAL_ACTIONS = Object.freeze([
    "technician-assignment",
    "customer-communication",
    "pricing-or-estimates",
    "invoice-or-refund",
    "parts-purchasing",
    "schedule-change",
    "customer-record-change"
  ]);
  const PROHIBITED_DATA = Object.freeze([
    "passwords",
    "payment-card-data",
    "bank-data",
    "social-security-numbers",
    "api-keys",
    "access-tokens",
    "refresh-tokens",
    "private-credentials"
  ]);

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function boundedText(value, field, maxLength = 240) {
    const normalized = String(value ?? "").trim();
    if (!normalized) throw new TypeError(`${field} is required`);
    if (normalized.length > maxLength) throw new RangeError(`${field} exceeds ${maxLength} characters`);
    return normalized;
  }

  function uniqueStrings(values, field) {
    if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
    const normalized = values.map((value) => boundedText(value, field, 120));
    if (new Set(normalized).size !== normalized.length) throw new TypeError(`${field} contains duplicate values`);
    return Object.freeze(normalized);
  }

  function strictFiniteNumber(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`${field} must be a finite number`);
    }
    return value;
  }

  function validateIntegrationPolicy(input) {
    if (!isObject(input)) throw new TypeError("integration policy must be an object");

    const provider = boundedText(input.provider, "provider", 80).toLowerCase();
    if (!ALLOWED_PROVIDERS.includes(provider)) throw new TypeError("provider is unsupported");

    const monthlyBudgetUsd = strictFiniteNumber(input.monthlyBudgetUsd, "monthlyBudgetUsd");
    if (monthlyBudgetUsd <= 0 || monthlyBudgetUsd > 10000) {
      throw new RangeError("monthlyBudgetUsd must be greater than 0 and no more than 10000");
    }

    const retentionDays = strictFiniteNumber(input.retentionDays, "retentionDays");
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      throw new RangeError("retentionDays must be an integer from 1 through 3650");
    }

    const auditStorage = boundedText(input.auditStorage, "auditStorage", 80).toLowerCase();
    if (!ALLOWED_AUDIT_STORAGE.includes(auditStorage)) throw new TypeError("auditStorage is unsupported");

    const approvalActions = uniqueStrings(input.approvalActions, "approvalActions");
    const missingApprovalActions = REQUIRED_APPROVAL_ACTIONS.filter((action) => !approvalActions.includes(action));
    if (missingApprovalActions.length) {
      throw new TypeError(`approvalActions is missing required actions: ${missingApprovalActions.join(", ")}`);
    }

    const prohibitedData = uniqueStrings(input.prohibitedData, "prohibitedData");
    const missingProhibitedData = PROHIBITED_DATA.filter((item) => !prohibitedData.includes(item));
    if (missingProhibitedData.length) {
      throw new TypeError(`prohibitedData is missing required categories: ${missingProhibitedData.join(", ")}`);
    }

    if (input.advisoryOnly !== true) throw new TypeError("advisoryOnly must be true");
    if (input.allowAutonomousWrites !== false) throw new TypeError("allowAutonomousWrites must be false");
    if (input.minimumNecessaryData !== true) throw new TypeError("minimumNecessaryData must be true");

    return Object.freeze({
      provider,
      monthlyBudgetUsd,
      retentionDays,
      auditStorage,
      privacyPolicy: boundedText(input.privacyPolicy, "privacyPolicy", 1000),
      approvalActions,
      prohibitedData,
      advisoryOnly: true,
      allowAutonomousWrites: false,
      minimumNecessaryData: true,
      approved: input.approved === true,
      executable: false,
      requiresExplicitOwnerApproval: true
    });
  }

  function authorizeExternalModel() {
    return Object.freeze({
      allowed: false,
      reason: "Policy validation does not authorize provider integration. Explicit owner approval and a separate feature branch are required."
    });
  }

  return Object.freeze({
    ALLOWED_PROVIDERS,
    ALLOWED_AUDIT_STORAGE,
    REQUIRED_APPROVAL_ACTIONS,
    PROHIBITED_DATA,
    validateIntegrationPolicy,
    authorizeExternalModel
  });
});
