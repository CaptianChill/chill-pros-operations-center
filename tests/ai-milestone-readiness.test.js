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

const completeDecisions = Object.freeze({
  ...approvedPolicy,
  ownerApproved: true,
  ownerApprovalRecord: Object.freeze({
    approverId: "owner:captianchill",
    approvedAt: "2026-07-27T04:00:00.000Z",
    policyVersion: "ai-integration-policy-v1",
    approvedPolicy
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
  assert.deepEqual(result.missingDecisions, ["provider", "monthlyBudgetUsd", "ownerApprovalRecord"]);
});

test("rejects providers and audit stores unsupported by the integration policy", () => {
  const decisions = {
    ...completeDecisions,
    provider: "unvalidated-provider",
    auditStorage: "public-browser-storage"
  };
  const result = evaluate(decisions);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["provider", "auditStorage", "ownerApprovalRecord"]);
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
  assert.deepEqual(invalidBudget.missingDecisions, ["monthlyBudgetUsd", "ownerApprovalRecord"]);

  const fractionalRetention = evaluate({ ...completeDecisions, retentionDays: 30.5 });
  assert.deepEqual(fractionalRetention.missingDecisions, ["retentionDays", "ownerApprovalRecord"]);

  const excessiveRetention = evaluate({
    ...completeDecisions,
    retentionDays: readiness.MAX_RETENTION_DAYS + 1
  });
  assert.deepEqual(excessiveRetention.missingDecisions, ["retentionDays", "ownerApprovalRecord"]);
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

test("requires approval evidence to include the exact approved policy snapshot", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      ...completeDecisions.ownerApprovalRecord,
      approvedPolicy: null
    }
  };
  assert.deepEqual(evaluate(decisions).missingDecisions, ["ownerApprovalRecord"]);
});

test("invalidates approval when a policy decision changes after approval", () => {
  for (const [key, value] of [
    ["provider", "anthropic"],
    ["monthlyBudgetUsd", 250],
    ["privacyPolicy", "expanded-data"],
    ["retentionDays", 60],
    ["auditStorage", "cloud-logging"],
    ["approvalPolicy", "office-review-only"]
  ]) {
    const decisions = { ...completeDecisions, [key]: value };
    const result = evaluate(decisions);
    assert.equal(result.ready, false, key);
    assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"], key);
  }
});

test("normalizes approved policy text before comparison", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      ...completeDecisions.ownerApprovalRecord,
      approvedPolicy: {
        ...approvedPolicy,
        provider: " OpenAI ",
        privacyPolicy: " MINIMUM-REQUIRED-DATA ",
        auditStorage: " FIRESTORE ",
        approvalPolicy: " HUMAN-APPROVAL-REQUIRED "
      }
    }
  };
  assert.equal(evaluate(decisions).ready, true);
});

test("returns an immutable normalized policy snapshot", () => {
  const snapshot = readiness.normalizePolicySnapshot(completeDecisions);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.deepEqual(snapshot, approvedPolicy);
});

test("rejects malformed or non-canonical approval timestamps", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      ...completeDecisions.ownerApprovalRecord,
      approvedAt: "July 27, 2026"
    }
  };
  const result = evaluate(decisions);
  assert.deepEqual(result.missingDecisions, ["ownerApprovalRecord"]);
});

test("requires approver identity and policy version in approval evidence", () => {
  const decisions = {
    ...completeDecisions,
    ownerApprovalRecord: {
      ...completeDecisions.ownerApprovalRecord,
      approverId: " ",
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