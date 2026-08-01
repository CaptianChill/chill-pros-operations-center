const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_MAX_ACTIVE_JOBS,
  normalizeTechnician,
  normalizeTechnicians,
  eligibleTechnicians
} = require("../ai/technician-data-adapter");

test("normalizes supported technician aliases without mutating source data", () => {
  const source = {
    uid: "tech-1",
    displayName: " Alex Tech ",
    certifications: "HVAC, Refrigeration, hvac",
    serviceArea: "San Antonio, Converse",
    isActive: true,
    onDuty: true,
    emergencyReady: true,
    currentJobCount: "2",
    capacity: "5"
  };
  const snapshot = structuredClone(source);

  const technician = normalizeTechnician(source);

  assert.deepEqual(source, snapshot);
  assert.deepEqual(technician.skills, ["hvac", "refrigeration"]);
  assert.deepEqual(technician.serviceAreas, ["san antonio", "converse"]);
  assert.equal(technician.id, "tech-1");
  assert.equal(technician.name, "Alex Tech");
  assert.equal(technician.available, true);
  assert.equal(technician.activeJobCount, 2);
  assert.equal(technician.maxActiveJobs, 5);
  assert.equal(technician.advisoryOnly, true);
  assert.equal(Object.isFrozen(technician), true);
});

test("uses safe defaults for optional operational fields", () => {
  const technician = normalizeTechnician({ id: "tech-2", name: "Jordan" });

  assert.equal(technician.active, true);
  assert.equal(technician.available, false);
  assert.equal(technician.emergencyCapable, false);
  assert.equal(technician.activeJobCount, 0);
  assert.equal(technician.maxActiveJobs, DEFAULT_MAX_ACTIVE_JOBS);
});

test("filters unavailable and inactive technicians by default", () => {
  const eligible = eligibleTechnicians([
    { id: "a", name: "Available", available: true, active: true },
    { id: "b", name: "Off duty", available: false, active: true },
    { id: "c", name: "Inactive", available: true, active: false }
  ]);

  assert.deepEqual(eligible.map((item) => item.id), ["a"]);
});

test("planning mode can include unavailable or inactive technicians explicitly", () => {
  const eligible = eligibleTechnicians([
    { id: "a", name: "Available", available: true, active: true },
    { id: "b", name: "Off duty", available: false, active: true },
    { id: "c", name: "Inactive", available: true, active: false }
  ], { includeUnavailable: true, includeInactive: true });

  assert.deepEqual(eligible.map((item) => item.id), ["a", "b", "c"]);
});

test("rejects malformed records and missing identity fields", () => {
  assert.throws(() => normalizeTechnician(null), /must be an object/);
  assert.throws(() => normalizeTechnician({ name: "No id" }), /requires an id/);
  assert.throws(() => normalizeTechnician({ id: "no-name" }), /requires a name/);
});

test("rejects duplicate normalized technician identifiers", () => {
  assert.throws(() => normalizeTechnicians([
    { id: "duplicate", name: "One" },
    { firestoreId: "duplicate", name: "Two" }
  ]), /duplicate technician id/);
});

test("invalid counts fail closed to safe defaults", () => {
  const technician = normalizeTechnician({
    id: "tech-3",
    name: "Taylor",
    activeJobCount: -4,
    maxActiveJobs: "not-a-number"
  }, { defaultMaxActiveJobs: 4 });

  assert.equal(technician.activeJobCount, 0);
  assert.equal(technician.maxActiveJobs, 4);
});
