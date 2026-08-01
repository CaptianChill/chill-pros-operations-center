const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildReviewQueue,
  summarizeReviewQueue,
  authorizeQueueExecution
} = require("../ai/advisory-review-queue.js");

test("orders prohibited and approval-required items before informational items", () => {
  const queue = buildReviewQueue([
    { id: "info-1", level: "informational", score: 100, summary: "Daily summary" },
    { id: "office-1", level: "office-review", score: 20, summary: "Schedule job" },
    { id: "owner-1", level: "owner-approval", score: 10, summary: "Send estimate" },
    { id: "blocked-1", level: "prohibited", score: 0, summary: "Delete customer" }
  ]);

  assert.deepEqual(queue.map((item) => item.id), ["blocked-1", "owner-1", "office-1", "info-1"]);
});

test("sorts equal approval levels by descending score and stable id", () => {
  const queue = buildReviewQueue([
    { id: "b", level: "office-review", score: 5 },
    { id: "c", level: "office-review", score: 10 },
    { id: "a", level: "office-review", score: 10 }
  ]);

  assert.deepEqual(queue.map((item) => item.id), ["a", "c", "b"]);
});

test("unknown levels fail closed to owner approval", () => {
  const [item] = buildReviewQueue([{ id: "unknown-1", level: "automatic", score: 2 }]);

  assert.equal(item.level, "owner-approval");
  assert.equal(item.requiresHumanApproval, true);
  assert.equal(item.executable, false);
  assert.equal(item.advisoryOnly, true);
});

test("rejects missing and duplicate stable ids", () => {
  assert.throws(() => buildReviewQueue([{ summary: "Missing id" }]), /stable id/);
  assert.throws(() => buildReviewQueue([{ id: "same" }, { id: "same" }]), /duplicate recommendation id/);
});

test("normalizes and freezes review records without mutating the source", () => {
  const source = { id: "job-1", score: "9", reasons: [" urgent ", "", "unassigned"] };
  const queue = buildReviewQueue([source]);

  assert.equal(queue[0].score, 9);
  assert.deepEqual(queue[0].reasons, ["urgent", "unassigned"]);
  assert.equal(Object.isFrozen(queue), true);
  assert.equal(Object.isFrozen(queue[0]), true);
  assert.equal(Object.isFrozen(queue[0].reasons), true);
  assert.deepEqual(source.reasons, [" urgent ", "", "unassigned"]);
});

test("summarizes approval levels", () => {
  const queue = buildReviewQueue([
    { id: "p", level: "prohibited" },
    { id: "o", level: "owner-approval" },
    { id: "r", level: "office-review" },
    { id: "i", level: "informational" }
  ]);

  assert.deepEqual(summarizeReviewQueue(queue), {
    total: 4,
    prohibited: 1,
    ownerApproval: 1,
    officeReview: 1,
    informational: 1
  });
});

test("never authorizes queue execution", () => {
  assert.deepEqual(authorizeQueueExecution(), {
    allowed: false,
    reason: "The AI review queue is advisory-only. Authenticated humans must approve and execute all operational actions."
  });
});
