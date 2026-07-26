"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildOperationsBrief,
  detectUrgency,
  scoreRecord,
  validateRecommendationForExecution
} = require("../ai/operations-engine");

const NOW = "2026-07-26T06:00:00.000Z";

test("detectUrgency finds field-service emergency language", () => {
  const result = detectUrgency({ complaint: "Walk-in is warm and not cooling" });
  assert.equal(result.urgent, true);
  assert.ok(result.matches.includes("not cooling"));
  assert.ok(result.matches.includes("walk-in"));
});

test("buildOperationsBrief ranks urgent unassigned work above routine work", () => {
  const brief = buildOperationsBrief([
    {
      id: "routine",
      customerName: "Routine Customer",
      officeStatus: "Scheduled",
      assignedTechnician: "Alex",
      createdAt: "2026-07-26T05:00:00.000Z",
      complaint: "Preventive maintenance"
    },
    {
      id: "urgent",
      customerName: "Urgent Customer",
      officeStatus: "Needs Review",
      assignedTechnician: "",
      createdAt: "2026-07-24T05:00:00.000Z",
      complaint: "Walk-in cooler not cooling"
    }
  ], { now: NOW });

  assert.equal(brief.mode, "advisory-only");
  assert.equal(brief.requiresHumanApproval, true);
  assert.equal(brief.recommendations[0].id, "urgent");
  assert.equal(brief.totals.urgentJobs, 1);
  assert.equal(brief.totals.unassignedJobs, 1);
});

test("completed records are excluded from active recommendations", () => {
  const brief = buildOperationsBrief([
    { id: "done", officeStatus: "Completed", complaint: "not cooling" },
    { id: "open", officeStatus: "Needs Review", complaint: "PM" }
  ], { now: NOW });

  assert.equal(brief.totals.activeJobs, 1);
  assert.deepEqual(brief.recommendations.map((item) => item.id), ["open"]);
});

test("ready-to-invoice work receives an invoice handoff recommendation", () => {
  const result = scoreRecord({
    id: "invoice",
    officeStatus: "Ready to Invoice",
    assignedTechnician: "Alex"
  }, { now: NOW });

  assert.equal(result.recommendedAction, "Review service record and prepare invoice");
  assert.ok(result.reasons.includes("Invoice handoff pending"));
});

test("missing contact information is surfaced as a scoring reason", () => {
  const result = scoreRecord({
    id: "missing-contact",
    officeStatus: "Needs Review",
    assignedTechnician: "Alex"
  }, { now: NOW });

  assert.ok(result.reasons.includes("Missing customer contact information"));
});

test("execution validation always blocks autonomous operational changes", () => {
  const result = validateRecommendationForExecution({ recommendedAction: "Assign technician" });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /advisory-only/i);
});

test("invalid input is rejected", () => {
  assert.throws(() => buildOperationsBrief(null), /records must be an array/);
});
