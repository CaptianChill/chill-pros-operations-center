const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeJob, normalizeJobs } = require("../ai/job-data-adapter");

test("normalizes legacy job aliases into immutable advisory records", () => {
  const job = normalizeJob({
    workOrderId: "WO-7",
    clientName: "Acme Kitchen",
    serviceRequested: "Walk-in cooler warm",
    workflowStatus: "In Progress",
    assignedTechnicianId: "tech-2",
    created_at: "2026-07-26T12:00:00-05:00",
    estimateTotal: "425.50",
    city: "San Antonio",
    assetType: "walk-in cooler"
  });

  assert.deepEqual(job, {
    id: "WO-7",
    customerName: "Acme Kitchen",
    summary: "Walk-in cooler warm",
    status: "in-progress",
    priority: "normal",
    technicianId: "tech-2",
    createdAt: "2026-07-26T17:00:00.000Z",
    scheduledAt: null,
    estimatedAmount: 425.5,
    serviceArea: "San Antonio",
    equipmentType: "walk-in cooler",
    source: "read-only-adapter",
    advisoryOnly: true
  });
  assert.equal(Object.isFrozen(job), true);
});

test("filters completed jobs by default and preserves input order", () => {
  const jobs = normalizeJobs([
    { id: "1", status: "scheduled" },
    { id: "2", status: "completed" },
    { id: "3", status: "new" }
  ]);
  assert.deepEqual(jobs.map((job) => job.id), ["1", "3"]);
  assert.equal(Object.isFrozen(jobs), true);
});

test("can include completed jobs only when explicitly requested", () => {
  const jobs = normalizeJobs([{ id: "1", status: "completed" }], { includeCompleted: true });
  assert.equal(jobs.length, 1);
});

test("rejects duplicate job ids", () => {
  assert.throws(() => normalizeJobs([{ id: "dup" }, { jobId: "dup" }]), /duplicate job id/);
});

test("rejects invalid dates and financial values", () => {
  assert.throws(() => normalizeJob({ id: "1", createdAt: "not-a-date" }), /createdAt/);
  assert.throws(() => normalizeJob({ id: "1", estimatedAmount: -1 }), /estimatedAmount/);
  assert.throws(() => normalizeJob({ id: "1", estimatedAmount: Infinity }), /estimatedAmount/);
});

test("defaults unknown workflow states without enabling execution", () => {
  const job = normalizeJob({ id: "1", status: "mystery-state" });
  assert.equal(job.status, "queued");
  assert.equal(job.advisoryOnly, true);
  assert.equal(job.source, "read-only-adapter");
});

test("requires a stable job identity", () => {
  assert.throws(() => normalizeJob({ customerName: "No ID" }), /job id is required/);
  assert.throws(() => normalizeJobs({}), /must be an array/);
});
