const test = require("node:test");
const assert = require("node:assert/strict");
const readiness = require("../ai/milestone-readiness");

const evaluatedAt = "2026-07-27T06:00:00.000Z";

const completeDecisions = Object.freeze({
  provider: "openai",
  monthlyBudgetUsd: 100,
  privacyPolicy: "minimum-required-data",
  retentionDays: 30,
  auditStorage: "firestore",
  approvalPolicy: "human-approval-required",
  ownerApproved: true,
  ownerApprovalRecord: Object.freeze({
    approverId: "owner:captianchill",
    approvedAt: "2026-07-27T04:00:00.000Z",
    policyVersion: "ai-integration-policy-v1"
  })
});

const completeEvidence = Object.freeze({
  ciPassed: true,
  advisoryPipelineTested: true,
  executionGuardTested: true,
  dataMinimizationTested: true,
  auditRedactionTested: true,
  integrationPolicyValidated: true
});

function evaluate(decisions = completeDecisions, evidence = completeEvidence, timestamp = evaluatedAt) {
  return readiness.evaluateMilestoneReadiness({ decisions, evidence, evaluatedAt: timestamp });
}

test("reports every missing owner decision and validation item", () => {
  const result = evaluate({}, {});
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, [...readiness.REQUIRED_DECISIONS]);
  assert.deepEqual(result.missingEvidence, [...readiness.REQUIRED_EVIDENCE]);
  assert.equal(result.executable, false);
  assert.equal(result.requiresExplicitOwnerApproval, true);
});

test("requires explicit true evidence rather than truthy values", () => {
  const evidence = { ...completeEvidence, ciPassed: "yes" };
  const result = evaluate(completeDecisions, evidence);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingEvidence, ["ciPassed"]);
});

test("rejects blank decisions and non-positive budgets", () => {
  const decisions = { ...completeDecisions, provider: "  ", monthlyBudgetUsd: 0 };
  const result = evaluate(decisions);
  assert.deepEqual(result.missingDecisions, ["provider", "monthlyBudgetUsd"]);
});

test("rejects providers and audit stores unsupported by the integration policy", () => {
  const decisions = {
    ...completeDecisions,
    provider: "unvalidated-provider",
    auditStorage: "public-browser-storage"
  };
  const result = evaluate(decisions);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["provider", "auditStorage"]);
});

test("normalizes supported provider and audit-storage decision text", () => {
  const decisions = {
    ...completeDecisions,
    provider: " OpenAI ",
    auditStorage: " FIRESTORE "
  };
  assert.equal(evaluate(decisions).ready, true);
});

test("rejects policy numbers outside integration-policy bounds", () => {
  const invalidBudget = evaluate({
    ...completeDecisions,
    monthlyBudgetUsd: readiness.MAX_MONTHLY_BUDGET_USD + 0.01
  });
  assert.deepEqual(invalidBudget.missingDecisions, ["monthlyBudgetUsd"]);

  const fractionalRetention = evaluate({ ...completeDecisions, retentionDays: 30.5 });
  assert.deepEqual(fractionalRetention.missingDecisions, ["retentionDays"]);

  const excessiveRetention = evaluate({
    ...completeDecisions,
    retentionDays: readiness.MAX_RETENTION_DAYS + 1
  });
  assert.deepEqual(excessiveRetention.missingDecisions, ["retentionDays"]);
});

test("requires explicit owner approval even when all policy fields are populated", () => {
  const decisions = { ...completeDecisions, ownerApproved: "yes" };
  const result = evaluate(decisions);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApproved"]);
});

test("requires an auditable owner approval record", () => {
  const decisions = { ...completeDecisions, ownerApprovalRecord: null };
  const result = evaluate(decisions);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("rejects malformed or non-canonical approval timestamps", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      approverId: "owner:captianchill",
      approvedAt: "July 27, 2026",
      policyVersion: "ai-integration-policy-v1"
    }
  };
  const result = evaluate(decisions);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("requires approver identity and policy version in approval evidence", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      approverId: " ",
      approvedAt: "2026-07-27T04:00:00.000Z",
      policyVersion: ""
    }
  };
  const result = evaluate(decisions);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("rejects approval records too far in the future", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      ...completeDecisions.ownerApprovalRecord,
      approvedAt: "2026-07-27T06:05:00.001Z"
    }
  };
  const result = evaluate(decisions);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("permits only the bounded clock-skew allowance", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      ...completeDecisions.ownerApprovalRecord,
      approvedAt: "2026-07-27T06:05:00.000Z"
    }
  };
  const result = evaluate(decisions);
  assert.equal(result.ready, true);
});

test("rejects malformed evaluation timestamps", () => {
  assert.throws(
    () => evaluate(completeDecisions, completeEvidence, "2026-07-27 06:00:00"),
    /evaluatedAt must be a canonical UTC timestamp/
  );
});

test("requires successful integration-policy validation evidence", () => {
  const evidence = { ...completeEvidence, integrationPolicyValidated: false };
  const result = evaluate(completeDecisions, evidence);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingEvidence, ["integrationPolicyValidated"]);
});

test("returns ready only when all decisions, approval, and evidence are explicit", () => {
  const result = evaluate();
  assert.equal(result.ready, true);
  assert.equal(result.status, "ready-for-owner-approved-integration");
  assert.equal(result.evaluatedAt, evaluatedAt);
  assert.deepEqual(result.missingDecisions, []);
  assert.deepEqual(result.missingEvidence, []);
});

test("returns immutable readiness output", () => {
  const result = evaluate();
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.missingDecisions), true);
  assert.equal(Object.isFrozen(result.missingEvidence), true);
});

test("never authorizes integration or production execution", () => {
  assert.deepEqual(readiness.authorizeIntegration(), {
    allowed: false,
    reason: "Readiness assessment never authorizes integration or production actions; explicit owner approval is required."
  });
});

test("rejects non-object readiness input", () => {
  assert.throws(() => readiness.evaluateMilestoneReadiness([]), /must be an object/);
});