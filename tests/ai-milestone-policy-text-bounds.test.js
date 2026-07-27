const test = require("node:test");
const assert = require("node:assert/strict");
const readiness = require("../ai/milestone-readiness");

const evaluatedAt = "2026-07-27T12:00:00.000Z";
const policy = Object.freeze({
  provider: "openai",
  monthlyBudgetUsd: 100,
  privacyPolicy: "minimum-required-data",
  retentionDays: 30,
  auditStorage: "firestore",
  approvalPolicy: "human-approval-required"
});
const evidence = Object.freeze({
  ciPassed: true,
  advisoryPipelineTested: true,
  executionGuardTested: true,
  dataMinimizationTested: true,
  auditRedactionTested: true,
  integrationPolicyValidated: true
});

function decisions(overrides = {}) {
  const currentPolicy = { ...policy, ...overrides };
  return {
    ...currentPolicy,
    ownerApproved: true,
    ownerApprovalRecord: {
      approverId: "owner:captianchill",
      approvedAt: "2026-07-27T11:00:00.000Z",
      policyVersion: "ai-integration-policy-v1",
      approvedPolicy: currentPolicy
    }
  };
}

function evaluate(overrides = {}) {
  return readiness.evaluateMilestoneReadiness({
    decisions: decisions(overrides),
    evidence,
    evaluatedAt
  });
}

test("rejects oversized privacy and approval policy decisions", () => {
  const oversized = "x".repeat(readiness.MAX_POLICY_TEXT_LENGTH + 1);
  assert.deepEqual(evaluate({ privacyPolicy: oversized }).missingDecisions, ["privacyPolicy", "ownerApprovalRecord"]);
  assert.deepEqual(evaluate({ approvalPolicy: oversized }).missingDecisions, ["approvalPolicy", "ownerApprovalRecord"]);
});

test("rejects control characters in policy decisions and approved snapshots", () => {
  assert.deepEqual(evaluate({ privacyPolicy: "minimum\u0000required" }).missingDecisions, ["privacyPolicy", "ownerApprovalRecord"]);
  assert.deepEqual(evaluate({ approvalPolicy: "human\u001fapproval" }).missingDecisions, ["approvalPolicy", "ownerApprovalRecord"]);
});

test("rejects invisible Unicode formatting characters in approval evidence", () => {
  assert.deepEqual(evaluate({ privacyPolicy: "minimum\u200brequired" }).missingDecisions, ["privacyPolicy", "ownerApprovalRecord"]);
  assert.deepEqual(evaluate({ approvalPolicy: "human\u202eapproval" }).missingDecisions, ["approvalPolicy", "ownerApprovalRecord"]);

  const current = decisions();
  current.ownerApprovalRecord.approverId = "owner:\u2066captianchill";
  let result = readiness.evaluateMilestoneReadiness({ decisions: current, evidence, evaluatedAt });
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);

  current.ownerApprovalRecord.approverId = "owner:captianchill";
  current.ownerApprovalRecord.policyVersion = "ai-policy-\ufeffv1";
  result = readiness.evaluateMilestoneReadiness({ decisions: current, evidence, evaluatedAt });
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("accepts bounded multiline privacy policy text and normalizes it deterministically", () => {
  const result = evaluate({ privacyPolicy: "  Minimum Necessary Data\nNo Credentials  " });
  assert.equal(result.ready, true);
  const snapshot = readiness.normalizePolicySnapshot(decisions({ privacyPolicy: "  Minimum Necessary Data\nNo Credentials  " }));
  assert.equal(snapshot.privacyPolicy, "minimum necessary data\nno credentials");
  assert.equal(Object.isFrozen(snapshot), true);
});

test("matches approved policy text across harmless case and outer-whitespace differences", () => {
  const current = decisions({ privacyPolicy: "  Minimum Necessary Data\nNo Credentials  " });
  current.ownerApprovalRecord.approvedPolicy = {
    ...current.ownerApprovalRecord.approvedPolicy,
    privacyPolicy: "minimum necessary data\nno credentials"
  };

  const result = readiness.evaluateMilestoneReadiness({ decisions: current, evidence, evaluatedAt });
  assert.equal(result.ready, true);
  assert.deepEqual(result.missingDecisions, []);
});

test("invalidates owner approval when multiline policy line endings drift", () => {
  const current = decisions({ privacyPolicy: "Minimum Necessary Data\nNo Credentials" });
  current.ownerApprovalRecord.approvedPolicy = {
    ...current.ownerApprovalRecord.approvedPolicy,
    privacyPolicy: "Minimum Necessary Data\r\nNo Credentials"
  };

  const result = readiness.evaluateMilestoneReadiness({ decisions: current, evidence, evaluatedAt });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("readiness remains advisory-only and cannot authorize integration", () => {
  const result = evaluate();
  assert.equal(result.executable, false);
  assert.equal(result.advisoryOnly, true);
  assert.equal(readiness.authorizeIntegration().allowed, false);
});
