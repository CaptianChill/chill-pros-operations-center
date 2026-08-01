"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildOperationsBrief,
  detectUrgency,
  recommendTechnicians,
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

test("technician recommendations favor skills, service area, availability, and lower workload", () => {
  const recommendations = recommendTechnicians({
    complaint: "Walk-in cooler not cooling",
    requiredSkills: ["refrigeration", "r290"],
    serviceArea: "San Antonio"
  }, [
    {
      id: "qualified",
      name: "Alex",
      skills: ["refrigeration", "r290"],
      serviceAreas: ["San Antonio"],
      available: true,
      emergencyCapable: true,
      activeJobCount: 1
    },
    {
      id: "busy",
      name: "Blake",
      skills: ["refrigeration"],
      serviceAreas: ["San Antonio"],
      available: true,
      emergencyCapable: false,
      activeJobCount: 5
    }
  ]);

  assert.equal(recommendations[0].technicianId, "qualified");
  assert.deepEqual(recommendations[0].matchedSkills, ["refrigeration", "r290"]);
  assert.equal(recommendations[0].qualified, true);
  assert.equal(recommendations[0].serviceAreaConfirmed, true);
  assert.equal(recommendations[0].confidence, "high");
  assert.equal(recommendations[0].requiresQualificationOverride, false);
  assert.equal(recommendations[0].requiresHumanApproval, true);
  assert.equal(recommendations[0].advisoryOnly, true);
});

test("fully qualified technicians rank above higher-scoring partial matches", () => {
  const recommendations = recommendTechnicians({
    requiredSkills: ["hvac", "controls"],
    serviceArea: "San Antonio"
  }, [
    {
      id: "qualified",
      name: "Qualified Tech",
      skills: ["hvac", "controls"],
      serviceAreas: [],
      available: true,
      activeJobCount: 5
    },
    {
      id: "partial",
      name: "Partial Tech",
      skills: ["hvac"],
      serviceAreas: ["San Antonio"],
      available: true,
      activeJobCount: 0
    }
  ]);

  assert.equal(recommendations[0].technicianId, "qualified");
  assert.equal(recommendations[0].qualified, true);
  assert.equal(recommendations[1].qualified, false);
  assert.equal(recommendations[1].confidence, "low");
  assert.equal(recommendations[1].requiresQualificationOverride, true);
});

test("unavailable and inactive technicians are excluded by default", () => {
  const recommendations = recommendTechnicians({ requiredSkills: ["hvac"] }, [
    { id: "available", name: "A", skills: ["hvac"], available: true },
    { id: "unavailable", name: "B", skills: ["hvac"], available: false },
    { id: "inactive", name: "C", skills: ["hvac"], active: false }
  ]);

  assert.deepEqual(recommendations.map((item) => item.technicianId), ["available"]);
});

test("unavailable technicians can be included for planning but are penalized", () => {
  const recommendations = recommendTechnicians({ requiredSkills: ["hvac"] }, [
    { id: "available", name: "A", skills: ["hvac"], available: true, activeJobCount: 2 },
    { id: "unavailable", name: "B", skills: ["hvac"], available: false, activeJobCount: 0 }
  ], { includeUnavailable: true });

  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].technicianId, "available");
  assert.ok(recommendations[1].reasons.includes("Marked unavailable"));
});

test("technician recommendations reject invalid inputs", () => {
  assert.throws(() => recommendTechnicians(null, []), /job must be an object/);
  assert.throws(() => recommendTechnicians({}, null), /technicians must be an array/);
});

test("execution validation always blocks autonomous operational changes", () => {
  const result = validateRecommendationForExecution({ recommendedAction: "Assign technician" });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /advisory-only/i);
});

test("invalid input is rejected", () => {
  assert.throws(() => buildOperationsBrief(null), /records must be an array/);
});