const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateFollowUps, evaluateFollowUpBatch } = require("../ai/follow-up-flags");

const NOW = "2026-07-26T15:00:00.000Z";

test("flags an overdue quote without authorizing execution", () => {
  const result = evaluateFollowUps({
    id: "job-1",
    officeStatus: "Needs Quote",
    updatedAt: "2026-07-25T12:00:00.000Z"
  }, { now: NOW });

  assert.equal(result.flags.length, 1);
  assert.equal(result.flags[0].type, "quote-overdue");
  assert.equal(result.flags[0].advisoryOnly, true);
  assert.equal(result.flags[0].requiresHumanApproval, true);
});

test("flags stale parts follow-up", () => {
  const result = evaluateFollowUps({
    id: "job-2",
    status: "Waiting on Parts",
    updated_at: "2026-07-23T14:00:00.000Z"
  }, { now: NOW });

  assert.deepEqual(result.flags.map((flag) => flag.type), ["parts-follow-up"]);
  assert.equal(result.flags[0].severity, "medium");
});

test("flags incomplete service notes and overdue invoice handoff", () => {
  const result = evaluateFollowUps({
    id: "job-3",
    officeStatus: "Ready to Invoice",
    updatedAt: "2026-07-24T12:00:00.000Z",
    findings: "Replaced failed contactor"
  }, { now: NOW });

  assert.deepEqual(result.flags.map((flag) => flag.type), [
    "incomplete-service-notes",
    "invoice-handoff-overdue"
  ]);
  assert.equal(result.flags[1].severity, "high");
});

test("complete recent invoice record has no follow-up flags", () => {
  const result = evaluateFollowUps({
    id: "job-4",
    officeStatus: "Ready to Invoice",
    updatedAt: "2026-07-26T14:30:00.000Z",
    findings: "System cooling normally",
    recommendations: "Monitor operation"
  }, { now: NOW });

  assert.deepEqual(result.flags, []);
});

test("custom thresholds are enforced deterministically", () => {
  const result = evaluateFollowUps({
    id: "job-5",
    officeStatus: "Needs Quote",
    updatedAt: "2026-07-26T12:00:00.000Z"
  }, { now: NOW, quoteHours: 2 });

  assert.equal(result.flags[0].type, "quote-overdue");
});

test("invalid records, dates, and thresholds fail closed", () => {
  assert.throws(() => evaluateFollowUps(null, { now: NOW }), /job record/);
  assert.throws(() => evaluateFollowUps({ id: "bad", updatedAt: "not-a-date" }, { now: NOW }), /valid date/);
  assert.throws(() => evaluateFollowUps({ id: "bad" }, { now: NOW, partsHours: -1 }), /non-negative/);
  assert.throws(() => evaluateFollowUpBatch({}, { now: NOW }), /array/);
});

test("batch output and nested flags are immutable", () => {
  const result = evaluateFollowUpBatch([{ id: "job-6", officeStatus: "Needs Review" }], { now: NOW });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.equal(Object.isFrozen(result[0].flags), true);
});
