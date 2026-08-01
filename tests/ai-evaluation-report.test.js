const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./fixtures/ai-operations-evaluation.json");
const pipeline = require("../ai/advisory-pipeline");
const { buildEvaluationReport } = require("../ai/evaluation-report");

function result() {
  return pipeline.buildAdvisoryPipeline(fixture.jobs, { now: fixture.now });
}

const expectations = Object.freeze({
  expectedRecommendationIds: Object.freeze([
    "job-priority:fixture-emergency-refrigeration",
    "follow-up:fixture-incomplete-field-notes:incomplete-service-notes"
  ]),
  excludedEntityIds: Object.freeze(["fixture-completed-excluded"])
});

test("evaluation report proves fixture coverage and advisory-only safety", () => {
  const report = buildEvaluationReport(result(), expectations);

  assert.equal(report.passed, true);
  assert.equal(report.safetyPassed, true);
  assert.equal(report.coveragePassed, true);
  assert.equal(report.exclusionPassed, true);
  assert.deepEqual(report.missingRecommendationIds, []);
  assert.deepEqual(report.prohibitedEntityHits, []);
  assert.deepEqual(report.unsafeRecommendationIds, []);
  assert.equal(report.advisoryOnly, true);
  assert.equal(report.executable, false);
  assert.equal(report.requiresHumanApproval, true);
});

test("evaluation report fails when expected coverage is absent", () => {
  const report = buildEvaluationReport(result(), {
    expectedRecommendationIds: ["missing:recommendation"]
  });

  assert.equal(report.passed, false);
  assert.equal(report.coveragePassed, false);
  assert.deepEqual(report.missingRecommendationIds, ["missing:recommendation"]);
});

test("evaluation report detects excluded entities and unsafe output", () => {
  const report = buildEvaluationReport({
    mode: "advisory-only",
    executable: false,
    requiresHumanApproval: true,
    reviewQueue: [{
      id: "unsafe:item",
      entityId: "excluded-job",
      advisoryOnly: false,
      executable: true
    }]
  }, { excludedEntityIds: ["excluded-job"] });

  assert.equal(report.passed, false);
  assert.equal(report.safetyPassed, false);
  assert.equal(report.exclusionPassed, false);
  assert.deepEqual(report.prohibitedEntityHits, ["excluded-job"]);
  assert.deepEqual(report.unsafeRecommendationIds, ["unsafe:item"]);
});

test("evaluation report rejects malformed or ambiguous inputs", () => {
  assert.throws(() => buildEvaluationReport(null), /pipeline result/);
  assert.throws(() => buildEvaluationReport({ reviewQueue: {} }), /reviewQueue/);
  assert.throws(() => buildEvaluationReport({ reviewQueue: [{ id: "" }] }), /stable id/);
  assert.throws(() => buildEvaluationReport({ reviewQueue: [{ id: "x" }, { id: "x" }] }), /duplicate/);
  assert.throws(() => buildEvaluationReport({ reviewQueue: [] }, {
    expectedRecommendationIds: ["x", "x"]
  }), /duplicates/);
});

test("evaluation report is deterministic and immutable", () => {
  const first = buildEvaluationReport(result(), expectations);
  const second = buildEvaluationReport(result(), expectations);

  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.missingRecommendationIds), true);
  assert.equal(Object.isFrozen(first.prohibitedEntityHits), true);
  assert.equal(Object.isFrozen(first.unsafeRecommendationIds), true);
});
