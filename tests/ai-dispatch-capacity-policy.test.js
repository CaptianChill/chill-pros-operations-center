"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../ai/operations-engine");
const {
  DEFAULT_MAX_ACTIVE_JOBS,
  assessCapacity,
  rankDispatchCandidates,
  validateDispatchForExecution
} = require("../ai/dispatch-capacity-policy");

test("capacity assessment uses the safe default maximum", () => {
  const capacity = assessCapacity({ activeJobCount: 2 });

  assert.equal(capacity.maxActiveJobs, DEFAULT_MAX_ACTIVE_JOBS);
  assert.equal(capacity.capacityRemaining, 2);
  assert.equal(capacity.atCapacity, false);
  assert.equal(capacity.requiresHumanApproval, true);
});

test("capacity assessment respects technician-specific limits", () => {
  const capacity = assessCapacity({ activeJobCount: 3, maxActiveJobs: 3 });

  assert.equal(capacity.capacityRemaining, 0);
  assert.equal(capacity.atCapacity, true);
  assert.equal(capacity.requiresCapacityOverride, true);
});

test("qualified technicians with capacity rank above equally qualified technicians at capacity", () => {
  const recommendations = rankDispatchCandidates({
    requiredSkills: ["hvac"],
    serviceArea: "San Antonio"
  }, [
    {
      id: "at-capacity",
      name: "At Capacity",
      skills: ["hvac"],
      serviceAreas: ["San Antonio"],
      activeJobCount: 4,
      maxActiveJobs: 4,
      available: true
    },
    {
      id: "available",
      name: "Available",
      skills: ["hvac"],
      serviceAreas: ["San Antonio"],
      activeJobCount: 2,
      maxActiveJobs: 4,
      available: true
    }
  ], { engine });

  assert.equal(recommendations[0].technicianId, "available");
  assert.equal(recommendations[0].atCapacity, false);
  assert.equal(recommendations[1].technicianId, "at-capacity");
  assert.equal(recommendations[1].atCapacity, true);
  assert.match(recommendations[1].reasons.at(-1), /At capacity/);
});

test("qualification remains more important than capacity", () => {
  const recommendations = rankDispatchCandidates({
    requiredSkills: ["hvac", "controls"]
  }, [
    {
      id: "qualified-full",
      name: "Qualified Full",
      skills: ["hvac", "controls"],
      activeJobCount: 4,
      maxActiveJobs: 4,
      available: true
    },
    {
      id: "partial-open",
      name: "Partial Open",
      skills: ["hvac"],
      activeJobCount: 0,
      maxActiveJobs: 4,
      available: true
    }
  ], { engine });

  assert.equal(recommendations[0].technicianId, "qualified-full");
  assert.equal(recommendations[0].qualified, true);
  assert.equal(recommendations[0].atCapacity, true);
  assert.equal(recommendations[1].qualified, false);
});

test("invalid capacity values fall back safely", () => {
  const capacity = assessCapacity({ activeJobCount: -3, maxActiveJobs: "bad" }, { defaultMaxActiveJobs: 5 });

  assert.equal(capacity.activeJobCount, 0);
  assert.equal(capacity.maxActiveJobs, 5);
  assert.equal(capacity.capacityRemaining, 5);
});

test("dispatch execution remains blocked without human approval", () => {
  const result = validateDispatchForExecution({ technicianId: "tech-1" });

  assert.equal(result.allowed, false);
  assert.match(result.reason, /advisory-only/i);
});
