const test = require("node:test");
const assert = require("node:assert/strict");
const readiness = require("../ai/milestone-readiness");

const completeDecisions = Object.freeze({
  provider: "approved-provider",
  monthlyBudgetUsd: 100,
  privacyPolicy: "minimum-required-data",
  retentionDays: 30,
  auditStorage: "restricted-admin-store",
  approvalPolicy: "human-approval-required",
  ownerApproved: true
});

const completeEvidence = Object.freeze({
  ciPassed: true,
  advisoryPipelineTested: true,
  executionGuardTested: true,
  dataMinimizationTested: true,
  auditRedactionTested: true,
  integrationPolicyValidated: true
});

test("reports every missing owner decision and validation item", () => {
  const result = readiness.evaluateMilestoneReadiness({ decisions: {}, evidence: {} });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, [...readiness.REQUIRED_DECISIONS]);
  assert.deepEqual(result.missingEvidence, [...readiness.REQUIRED_EVIDENCE]);
  assert.equal(result.executable, false);
  assert.equal(result.requiresExplicitOwnerApproval, true);
});

test("requires explicit true evidence rather than truthy values", () => {
  const evidence = { ...completeEvidence, ciPassed: "yes" };
  const result = readiness.evaluateMilestoneReadiness({ decisions: completeDecisions, evidence });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingEvidence, ["ciPassed"]);
});

test("rejects blank decisions and non-positive budgets", () => {
  const decisions = { ...completeDecisions, provider: "  ", monthlyBudgetUsd: 0 };
  const result = readiness.evaluateMilestoneReadiness({ decisions, evidence: completeEvidence });
  assert.deepEqual(result.missingDecisions, ["provider", "monthlyBudgetUsd"]);
});

test("requires explicit owner approval even when all policy fields are populated", () => {
  const decisions = { ...completeDecisions, ownerApproved: "yes" };
  const result = readiness.evaluateMilestoneReadiness({ decisions, evidence: completeEvidence });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingDecisions, ["ownerApproved"]);
});

test("requires successful integration-policy validation evidence", () => {
  const evidence = { ...completeEvidence, integrationPolicyValidated: false };
  const result = readiness.evaluateMilestoneReadiness({ decisions: completeDecisions, evidence });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingEvidence, ["integrationPolicyValidated"]);
});

test("returns ready only when all decisions, approval, and evidence are explicit", () => {
  const result = readiness.evaluateMilestoneReadiness({
    decisions: completeDecisions,
    evidence: completeEvidence
  });
  assert.equal(result.ready, true);
  assert.equal(result.status, "ready-for-owner-approved-integration");
  assert.deepEqual(result.missingDecisions, []);
  assert.deepEqual(result.missingEvidence, []);
});

test("returns immutable readiness output", () => {
  const result = readiness.evaluateMilestoneReadiness({
    decisions: completeDecisions,
    evidence: completeEvidence
  });
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