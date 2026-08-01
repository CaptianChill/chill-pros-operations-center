const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REQUIRED_APPROVAL_ACTIONS,
  PROHIBITED_DATA,
  validateIntegrationPolicy,
  authorizeExternalModel
} = require("../ai/integration-policy");

function validPolicy(overrides = {}) {
  return {
    provider: "openai",
    monthlyBudgetUsd: 100,
    retentionDays: 30,
    auditStorage: "firestore",
    privacyPolicy: "Use only the minimum necessary operational data and exclude customer contact data unless an approved workflow requires it.",
    approvalActions: [...REQUIRED_APPROVAL_ACTIONS],
    prohibitedData: [...PROHIBITED_DATA],
    advisoryOnly: true,
    allowAutonomousWrites: false,
    minimumNecessaryData: true,
    approved: false,
    ...overrides
  };
}

test("normalizes a valid advisory-only policy without authorizing integration", () => {
  const result = validateIntegrationPolicy(validPolicy({ provider: "OpenAI", auditStorage: "Firestore" }));
  assert.equal(result.provider, "openai");
  assert.equal(result.auditStorage, "firestore");
  assert.equal(result.approved, false);
  assert.equal(result.executable, false);
  assert.equal(result.requiresExplicitOwnerApproval, true);
  assert.deepEqual(authorizeExternalModel(), {
    allowed: false,
    reason: "Policy validation does not authorize provider integration. Explicit owner approval and a separate feature branch are required."
  });
});

test("rejects unsafe execution settings", () => {
  assert.throws(() => validateIntegrationPolicy(validPolicy({ advisoryOnly: false })), /advisoryOnly/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ allowAutonomousWrites: true })), /allowAutonomousWrites/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ minimumNecessaryData: false })), /minimumNecessaryData/);
});

test("rejects invalid budget and retention boundaries", () => {
  assert.throws(() => validateIntegrationPolicy(validPolicy({ monthlyBudgetUsd: 0 })), /monthlyBudgetUsd/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ monthlyBudgetUsd: 10001 })), /monthlyBudgetUsd/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ retentionDays: 0 })), /retentionDays/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ retentionDays: 3651 })), /retentionDays/);
});

test("rejects coercible or non-finite numeric policy values", () => {
  for (const monthlyBudgetUsd of ["100", true, null, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => validateIntegrationPolicy(validPolicy({ monthlyBudgetUsd })),
      /monthlyBudgetUsd/,
      String(monthlyBudgetUsd)
    );
  }

  for (const retentionDays of ["30", true, null, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => validateIntegrationPolicy(validPolicy({ retentionDays })),
      /retentionDays/,
      String(retentionDays)
    );
  }
});

test("requires every protected action to remain human-approved", () => {
  const approvalActions = REQUIRED_APPROVAL_ACTIONS.filter((action) => action !== "parts-purchasing");
  assert.throws(() => validateIntegrationPolicy(validPolicy({ approvalActions })), /parts-purchasing/);
});

test("requires every prohibited data category", () => {
  const prohibitedData = PROHIBITED_DATA.filter((item) => item !== "access-tokens");
  assert.throws(() => validateIntegrationPolicy(validPolicy({ prohibitedData })), /access-tokens/);
});

test("rejects unsupported control characters in policy text and arrays", () => {
  assert.throws(
    () => validateIntegrationPolicy(validPolicy({ privacyPolicy: "minimum necessary\u0000data" })),
    /privacyPolicy contains unsupported control characters/
  );
  assert.throws(
    () => validateIntegrationPolicy(validPolicy({ approvalActions: [...REQUIRED_APPROVAL_ACTIONS, "custom\u0007action"] })),
    /approvalActions contains unsupported control characters/
  );
});

test("allows readable multiline privacy policy text", () => {
  const result = validateIntegrationPolicy(validPolicy({ privacyPolicy: "Minimum necessary data.\nHuman approval is required." }));
  assert.equal(result.privacyPolicy, "Minimum necessary data.\nHuman approval is required.");
});

test("rejects duplicates, unsupported options, and malformed input", () => {
  assert.throws(() => validateIntegrationPolicy(null), /must be an object/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ provider: "unknown-provider" })), /provider is unsupported/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ auditStorage: "local-storage" })), /auditStorage is unsupported/);
  assert.throws(() => validateIntegrationPolicy(validPolicy({ approvalActions: [...REQUIRED_APPROVAL_ACTIONS, REQUIRED_APPROVAL_ACTIONS[0]] })), /duplicate/);
});

test("returns immutable policy data", () => {
  const result = validateIntegrationPolicy(validPolicy());
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.approvalActions), true);
  assert.equal(Object.isFrozen(result.prohibitedData), true);
  assert.throws(() => result.approvalActions.push("new-action"), TypeError);
});