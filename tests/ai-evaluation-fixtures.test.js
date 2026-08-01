const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./fixtures/ai-operations-evaluation.json");
const pipeline = require("../ai/advisory-pipeline");

function evaluationResult() {
  return pipeline.buildAdvisoryPipeline(fixture.jobs, { now: fixture.now });
}

test("evaluation fixture is explicitly de-identified", () => {
  assert.equal(fixture.containsRealCustomerData, false);
  assert.ok(fixture.jobs.length >= 4);
  assert.ok(fixture.jobs.every((job) => /^DEIDENTIFIED-SITE-/.test(job.customerName)));
  assert.ok(fixture.jobs.every((job) => !job.phone && !job.email));
});

test("de-identified workflow fixture produces stable advisory coverage", () => {
  const result = evaluationResult();
  const ids = new Set(result.reviewQueue.map((item) => item.id));

  assert.equal(result.sourceJobCount, 4);
  assert.equal(result.normalizedJobCount, 3);
  assert.equal(result.mode, "advisory-only");
  assert.equal(result.executable, false);
  assert.equal(result.requiresHumanApproval, true);
  assert.ok(ids.has("job-priority:fixture-emergency-refrigeration"));
  assert.ok(ids.has("follow-up:fixture-incomplete-field-notes:incomplete-service-notes"));
  assert.ok(result.reviewQueue.every((item) => item.entityId !== "fixture-completed-excluded"));
});

test("evaluation output is deterministic and immutable", () => {
  const first = evaluationResult();
  const second = evaluationResult();

  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.reviewQueue), true);
  assert.equal(first.reviewQueue.every((item) => item.advisoryOnly && !item.executable), true);
});

test("fixture source data is not mutated during evaluation", () => {
  const before = JSON.stringify(fixture);
  evaluationResult();
  assert.equal(JSON.stringify(fixture), before);
});
