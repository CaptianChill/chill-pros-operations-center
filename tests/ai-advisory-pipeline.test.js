const test = require("node:test");
const assert = require("node:assert/strict");
const pipeline = require("../ai/advisory-pipeline");

const NOW = "2026-07-26T18:00:00.000Z";

function sampleJobs() {
  return [
    {
      id: "job-urgent",
      customerName: "Cold Storage",
      description: "Walk-in is not cooling",
      status: "queued",
      createdAt: "2026-07-24T12:00:00.000Z",
      estimatedAmount: 2500
    },
    {
      id: "job-active",
      customerName: "Cafe",
      description: "Ice machine service",
      status: "in-progress",
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
      technicianId: "tech-1",
      findings: "Restricted water flow"
    },
    {
      id: "job-complete",
      customerName: "Completed Site",
      status: "completed",
      createdAt: "2026-07-25T12:00:00.000Z"
    }
  ];
}

test("builds one immutable advisory queue from normalized active jobs", () => {
  const result = pipeline.buildAdvisoryPipeline(sampleJobs(), { now: NOW });

  assert.equal(result.mode, "advisory-only");
  assert.equal(result.executable, false);
  assert.equal(result.requiresHumanApproval, true);
  assert.equal(result.sourceJobCount, 3);
  assert.equal(result.normalizedJobCount, 2);
  assert.equal(result.brief.totals.activeJobs, 2);
  assert.ok(result.reviewQueue.some((item) => item.id === "job-priority:job-urgent"));
  assert.ok(result.reviewQueue.some((item) => item.id === "follow-up:job-active:incomplete-service-notes"));
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.reviewQueue), true);
});

test("prioritizes urgent and high-severity owner review items", () => {
  const result = pipeline.buildAdvisoryPipeline(sampleJobs(), { now: NOW });
  const first = result.reviewQueue[0];

  assert.equal(first.level, "owner-approval");
  assert.equal(first.executable, false);
  assert.equal(result.reviewTotals.ownerApproval >= 2, true);
});

test("rejects duplicate job identifiers before recommendations are created", () => {
  assert.throws(
    () => pipeline.buildAdvisoryPipeline([
      { id: "duplicate", status: "queued" },
      { id: "duplicate", status: "scheduled" }
    ], { now: NOW }),
    /duplicate job id/
  );
});

test("fails closed when a stable job id is missing", () => {
  assert.throws(
    () => pipeline.buildAdvisoryPipeline([{ status: "queued" }], { now: NOW }),
    /job id is required/
  );
});

test("can include completed jobs only when explicitly requested", () => {
  const result = pipeline.buildAdvisoryPipeline(sampleJobs(), {
    now: NOW,
    includeCompleted: true
  });

  assert.equal(result.normalizedJobCount, 3);
  assert.equal(result.brief.totals.activeJobs, 2);
  assert.ok(result.reviewQueue.every((item) => item.entityId !== "job-complete"));
});

test("never authorizes autonomous execution", () => {
  assert.deepEqual(pipeline.authorizePipelineExecution(), {
    allowed: false,
    reason: "The AI advisory pipeline cannot execute operational changes. An authenticated human must review and perform every action."
  });
});
