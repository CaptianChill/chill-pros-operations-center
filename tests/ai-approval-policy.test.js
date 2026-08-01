const test = require("node:test");
const assert = require("node:assert/strict");

const policy = require("../ai/approval-policy.js");

test("classifies prohibited actions as non-executable", () => {
  const result = policy.classifyRecommendation({ action: "delete-customer" });
  assert.equal(result.level, policy.ACTION_LEVELS.PROHIBITED);
  assert.equal(result.executable, false);
  assert.equal(result.requiresHumanApproval, true);
});

test("requires owner approval for sensitive business actions", () => {
  const result = policy.classifyRecommendation({ action: "send-invoice" });
  assert.equal(result.level, policy.ACTION_LEVELS.OWNER_APPROVAL);
  assert.match(result.reason, /owner approval/i);
});

test("routes routine operational actions to office review", () => {
  const result = policy.classifyRecommendation({ action: "schedule-job" });
  assert.equal(result.level, policy.ACTION_LEVELS.OFFICE_REVIEW);
  assert.equal(result.executable, false);
});

test("defaults unknown actions to owner approval", () => {
  const result = policy.classifyRecommendation({ action: "new-experimental-action" });
  assert.equal(result.level, policy.ACTION_LEVELS.OWNER_APPROVAL);
  assert.match(result.reason, /unknown/i);
});

test("treats missing actions as informational only", () => {
  const result = policy.classifyRecommendation({ summary: "Review backlog" });
  assert.equal(result.level, policy.ACTION_LEVELS.INFORMATIONAL);
  assert.equal(result.executable, false);
});

test("builds a stable approval queue", () => {
  const queue = policy.buildApprovalQueue([
    { id: "one", action: "assign-technician", summary: "Assign job" },
    { action: "order-parts", recommendedAction: "Order compressor" }
  ]);

  assert.equal(queue.length, 2);
  assert.equal(queue[0].id, "one");
  assert.equal(queue[0].level, policy.ACTION_LEVELS.OFFICE_REVIEW);
  assert.equal(queue[1].id, "recommendation-2");
  assert.equal(queue[1].level, policy.ACTION_LEVELS.OWNER_APPROVAL);
});

test("rejects invalid queue input", () => {
  assert.throws(() => policy.buildApprovalQueue({}), /array/i);
});

test("never authorizes execution", () => {
  const result = policy.authorizeExecution({ action: "schedule-job" });
  assert.deepEqual(result, {
    allowed: false,
    reason: "AI recommendations are advisory-only. Execution must occur through an authenticated human-controlled workflow."
  });
});
