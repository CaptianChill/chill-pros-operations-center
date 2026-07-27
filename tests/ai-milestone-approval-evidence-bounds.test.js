const test = require("node:test");
const assert = require("node:assert/strict");
const readiness = require("../ai/milestone-readiness");

const evaluatedAt = "2026-07-27T06:00:00.000Z";
const approvedPolicy = Object.freeze({
  provider: "openai",
  monthlyBudgetUsd: 100,
  privacyPolicy: "minimum-required-data",
  retentionDays: 30,
  auditStorage: "firestore",
  approvalPolicy: "human-approval-required"
});
const completeEvidence = Object.freeze({
  ciPassed: true,
  advisoryPipelineTested: true,
  executionGuardTested: true,
  dataMinimizationTested: true,
  auditRedactionTested: true,
  integrationPolicyValidated: true
});

function decisionsWithApproval(overrides = {}) {
  return {
    ...approvedPolicy,
    ownerApproved: true,
    ownerApprovalRecord: {
      approverId: "owner:captianchill",
      approvedAt: "2026-07-27T04:00:00.000Z",
      policyVersion: "ai-integration-policy-v1",
      approvedPolicy,
      ...overrides
    }
  };
}

function evaluate(overrides) {
  return readiness.evaluateMilestoneReadiness({
    decisions: decisionsWithApproval(overrides),
    evidence: completeEvidence,
    evaluatedAt
  });
}

test("accepts bounded auditable approval evidence", () => {
  const result = evaluate();
  assert.equal(result.ready, true);
  assert.deepEqual(result.missingDecisions, []);
});

test("rejects oversized approver identities", () => {
  const result = evaluate({ approverId: "o".repeat(readiness.MAX_APPROVER_ID_LENGTH + 1) });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("rejects oversized policy versions", () => {
  const result = evaluate({ policyVersion: "v".repeat(readiness.MAX_POLICY_VERSION_LENGTH + 1) });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("rejects control characters in approval identity fields", () => {
  for (const overrides of [
    { approverId: "owner:captianchill\nadmin" },
    { policyVersion: "ai-policy-v1\tforged" }
  ]) {
    const result = evaluate(overrides);
    assert.equal(result.ready, false);
    assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
  }
});

test("trims otherwise valid approval identity fields", () => {
  const result = evaluate({
    approverId: "  owner:captianchill  ",
    policyVersion: "  ai-integration-policy-v1  "
  });
  assert.equal(result.ready, true);
});
