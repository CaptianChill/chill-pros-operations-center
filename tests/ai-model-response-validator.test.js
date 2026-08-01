const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateModelResponse,
  authorizeModelExecution
} = require("../ai/model-response-validator");

test("accepts a bounded advisory-only response and freezes normalized output", () => {
  const result = validateModelResponse({
    advisoryOnly: true,
    summary: "Review urgent jobs",
    recommendations: [{
      id: "job-101",
      summary: "Review the oldest unassigned emergency call",
      action: "schedule-job",
      approvalLevel: "office-review",
      score: 92,
      entityId: "job-101",
      reasons: ["Emergency priority", "Unassigned"]
    }]
  });

  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.executable, false);
  assert.equal(result.requiresHumanApproval, true);
  assert.equal(result.recommendations[0].approvalLevel, "office-review");
  assert.equal(result.recommendations[0].executable, false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.recommendations));
  assert.ok(Object.isFrozen(result.recommendations[0]));
});

test("fails closed unless advisoryOnly is explicitly true", () => {
  assert.throws(
    () => validateModelResponse({ recommendations: [] }),
    /advisoryOnly/
  );
  assert.throws(
    () => validateModelResponse({ advisoryOnly: false, recommendations: [] }),
    /advisoryOnly/
  );
});

test("unknown approval levels default to owner approval", () => {
  const result = validateModelResponse({
    advisoryOnly: true,
    recommendations: [{
      id: "rec-1",
      summary: "Review unusual output",
      approvalLevel: "automatic",
      score: 10
    }]
  });

  assert.equal(result.recommendations[0].approvalLevel, "owner-approval");
  assert.equal(result.recommendations[0].requiresHumanApproval, true);
});

test("rejects duplicate recommendation identifiers", () => {
  assert.throws(() => validateModelResponse({
    advisoryOnly: true,
    recommendations: [
      { id: "duplicate", summary: "First" },
      { id: "duplicate", summary: "Second" }
    ]
  }), /duplicate recommendation id/);
});

test("rejects malformed, non-finite, and out-of-range scores", () => {
  for (const score of ["not-a-number", Infinity, -1, 101]) {
    assert.throws(() => validateModelResponse({
      advisoryOnly: true,
      recommendations: [{ id: "rec-score", summary: "Review", score }]
    }), /score/);
  }
});

test("rejects oversized responses and reason arrays", () => {
  const recommendations = Array.from({ length: 51 }, (_, index) => ({
    id: `rec-${index}`,
    summary: "Review"
  }));
  assert.throws(
    () => validateModelResponse({ advisoryOnly: true, recommendations }),
    /exceeds 50 recommendations/
  );

  assert.throws(() => validateModelResponse({
    advisoryOnly: true,
    recommendations: [{
      id: "too-many-reasons",
      summary: "Review",
      reasons: Array.from({ length: 21 }, () => "reason")
    }]
  }), /exceeds 20 entries/);
});

test("model execution remains permanently disabled", () => {
  assert.deepEqual(authorizeModelExecution(), {
    allowed: false,
    reason: "External model output is advisory-only and cannot execute operational actions."
  });
});
