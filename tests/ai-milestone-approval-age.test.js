const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateMilestoneReadiness,
  MAX_APPROVAL_AGE_MS
} = require("../ai/milestone-readiness.js");

const evaluatedAt = "2026-07-27T12:00:00.000Z";

function buildInput(approvedAt) {
  const approvedPolicy = {
    provider: "openai",
    monthlyBudgetUsd: 250,
    privacyPolicy: "minimized-customer-data",
    retentionDays: 30,
    auditStorage: "firestore",
    approvalPolicy: "authenticated-human-approval"
  };

  return {
    evaluatedAt,
    decisions: {
      ...approvedPolicy,
      ownerApproved: true,
      ownerApprovalRecord: {
        approverId: "owner:captianchill",
        approvedAt,
        policyVersion: "ai-policy-v1",
        approvedPolicy
      }
    },
    evidence: {
      ciPassed: true,
      advisoryPipelineTested: true,
      executionGuardTested: true,
      dataMinimizationTested: true,
      auditRedactionTested: true,
      integrationPolicyValidated: true
    }
  };
}

test("accepts owner approval at the maximum allowed age", () => {
  const approvalTime = new Date(new Date(evaluatedAt).getTime() - MAX_APPROVAL_AGE_MS).toISOString();
  const result = evaluateMilestoneReadiness(buildInput(approvalTime));

  assert.equal(result.ready, true);
  assert.deepEqual(result.missingDecisions, []);
  assert.equal(result.executable, false);
});

test("fails closed when owner approval is older than the maximum age", () => {
  const approvalTime = new Date(new Date(evaluatedAt).getTime() - MAX_APPROVAL_AGE_MS - 1).toISOString();
  const result = evaluateMilestoneReadiness(buildInput(approvalTime));

  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
  assert.equal(result.status, "blocked");
  assert.equal(result.executable, false);
});

test("fails closed when approval is materially future-dated", () => {
  const approvalTime = new Date(new Date(evaluatedAt).getTime() + 5 * 60 * 1000 + 1).toISOString();
  const result = evaluateMilestoneReadiness(buildInput(approvalTime));

  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
  assert.equal(result.requiresExplicitOwnerApproval, true);
});
