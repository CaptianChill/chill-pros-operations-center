const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_TEXT_LENGTH,
  prepareModelContext,
  prepareModelContextBatch
} = require("../ai/data-minimization-policy");

test("includes only purpose-specific dispatch fields", () => {
  const context = prepareModelContext(
    {
      id: "job-42",
      priority: "urgent",
      serviceType: "refrigeration",
      requiredSkills: ["R290"],
      serviceArea: "San Antonio",
      customerEmail: "private@example.com",
      customerPhone: "210-555-0100",
      apiKey: "must-not-leak"
    },
    { purpose: "dispatch-recommendation" }
  );

  assert.equal(context.purpose, "dispatch-recommendation");
  assert.equal(context.advisoryOnly, true);
  assert.equal(context.containsCredentials, false);
  assert.deepEqual(context.fields, {
    id: "job-42",
    priority: "urgent",
    requiredSkills: ["R290"],
    serviceArea: "San Antonio",
    serviceType: "refrigeration"
  });
  assert.equal(Object.hasOwn(context.fields, "customerEmail"), false);
  assert.equal(Object.hasOwn(context.fields, "apiKey"), false);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.fields), true);
});

test("uses a narrower field set for technician assistance", () => {
  const context = prepareModelContext(
    {
      id: "job-7",
      equipmentType: "ice machine",
      manufacturer: "Hoshizaki",
      model: "KM-520",
      symptoms: "Not making ice",
      estimatedAmount: 900,
      assignedTechnician: "Alex"
    },
    { purpose: "technician-assistance" }
  );

  assert.deepEqual(context.fields, {
    equipmentType: "ice machine",
    id: "job-7",
    manufacturer: "Hoshizaki",
    model: "KM-520",
    symptoms: "Not making ice"
  });
});

test("truncates text and bounds arrays before external-model use", () => {
  const context = prepareModelContext(
    {
      id: "job-9",
      symptoms: "x".repeat(MAX_TEXT_LENGTH + 100),
      serviceHistory: Array.from({ length: 40 }, (_, index) => `entry-${index}`)
    },
    { purpose: "technician-assistance" }
  );

  assert.equal(context.fields.symptoms.length, MAX_TEXT_LENGTH);
  assert.equal(context.fields.serviceHistory.length, 25);
  assert.equal(Object.isFrozen(context.fields.serviceHistory), true);
});

test("removes prohibited keys recursively from allowed structured fields", () => {
  const context = prepareModelContext(
    {
      id: "job-10",
      serviceHistory: [{ finding: "normal", authorization: "Bearer secret", nested: { password: "hidden" } }]
    },
    { purpose: "technician-assistance" }
  );

  assert.deepEqual(context.fields.serviceHistory, [{ finding: "normal", nested: {} }]);
});

test("preserves batch order and returns immutable output", () => {
  const batch = prepareModelContextBatch(
    [{ id: "first" }, { id: "second" }],
    { purpose: "daily-operations-brief" }
  );

  assert.deepEqual(batch.map((item) => item.fields.id), ["first", "second"]);
  assert.equal(Object.isFrozen(batch), true);
});

test("fails closed for unsupported purposes and invalid records", () => {
  assert.throws(() => prepareModelContext(null, { purpose: "daily-operations-brief" }), /record must be an object/);
  assert.throws(() => prepareModelContext([], { purpose: "daily-operations-brief" }), /record must be an object/);
  assert.throws(() => prepareModelContext({}, { purpose: "unknown" }), /explicitly supported AI purpose/);
  assert.throws(() => prepareModelContext({}, {}), /explicitly supported AI purpose/);
  assert.throws(() => prepareModelContextBatch({}, { purpose: "daily-operations-brief" }), /records must be an array/);
});