const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyRetentionPolicy,
  createAuditBatch,
  createAuditRecord,
  sanitize
} = require("../ai/recommendation-audit");

test("creates deterministic advisory-only audit records", () => {
  const record = createAuditRecord(
    {
      id: "rec-17",
      action: "assign-technician",
      summary: "Assign the qualified technician",
      reasons: ["required skills matched"]
    },
    {
      actorRole: "owner",
      tenantId: "chill-pros",
      correlationId: "job-42"
    },
    { now: "2026-07-26T10:00:00-05:00" }
  );

  assert.equal(record.recordedAt, "2026-07-26T15:00:00.000Z");
  assert.equal(record.recommendationId, "rec-17");
  assert.equal(record.action, "assign-technician");
  assert.equal(record.advisoryOnly, true);
  assert.equal(record.requiresHumanApproval, true);
  assert.equal(record.correlationId, "job-42");
  assert.deepEqual(record.evidence, ["required skills matched"]);
  assert.equal(Object.isFrozen(record), true);
});

test("redacts credential-like metadata recursively", () => {
  const record = createAuditRecord(
    { summary: "Review job" },
    {
      metadata: {
        apiKey: "should-not-leak",
        nested: {
          refreshToken: "should-not-leak",
          safeValue: "retained"
        }
      }
    },
    { now: "2026-07-26T15:00:00Z" }
  );

  assert.equal(record.metadata.apiKey, "[REDACTED]");
  assert.equal(record.metadata.nested.refreshToken, "[REDACTED]");
  assert.equal(record.metadata.nested.safeValue, "retained");
});

test("sorts sanitized object keys for stable serialization", () => {
  assert.deepEqual(sanitize({ z: 1, a: 2 }), { a: 2, z: 1 });
});

test("creates immutable batches while preserving recommendation order", () => {
  const records = createAuditBatch(
    [{ id: "first" }, { id: "second" }],
    {},
    { now: "2026-07-26T15:00:00Z" }
  );

  assert.deepEqual(records.map((record) => record.recommendationId), ["first", "second"]);
  assert.equal(Object.isFrozen(records), true);
});

test("retains only records inside the configured retention window", () => {
  const records = [
    createAuditRecord({ id: "expired" }, {}, { now: "2026-06-25T12:00:00Z" }),
    createAuditRecord({ id: "cutoff" }, {}, { now: "2026-06-26T12:00:00Z" }),
    createAuditRecord({ id: "recent" }, {}, { now: "2026-07-20T12:00:00Z" })
  ];

  const retained = applyRetentionPolicy(records, {
    now: "2026-07-26T12:00:00Z",
    retentionDays: 30
  });

  assert.deepEqual(retained.map((record) => record.recommendationId), ["cutoff", "recent"]);
  assert.equal(Object.isFrozen(retained), true);
});

test("preserves retained audit record order", () => {
  const records = [
    createAuditRecord({ id: "second" }, {}, { now: "2026-07-25T12:00:00Z" }),
    createAuditRecord({ id: "first" }, {}, { now: "2026-07-24T12:00:00Z" })
  ];

  const retained = applyRetentionPolicy(records, {
    now: "2026-07-26T12:00:00Z",
    retentionDays: 7
  });

  assert.deepEqual(retained.map((record) => record.recommendationId), ["second", "first"]);
});

test("retention policy fails closed for malformed records and configuration", () => {
  const validRecord = createAuditRecord({ id: "valid" }, {}, { now: "2026-07-26T12:00:00Z" });

  assert.throws(() => applyRetentionPolicy({}, { retentionDays: 30 }), /records must be an array/);
  assert.throws(() => applyRetentionPolicy([validRecord], { retentionDays: 0 }), /retentionDays/);
  assert.throws(() => applyRetentionPolicy([validRecord], { retentionDays: 3651 }), /retentionDays/);
  assert.throws(() => applyRetentionPolicy([validRecord], { retentionDays: 30, now: "bad-date" }), /now must be a valid datetime/);
  assert.throws(() => applyRetentionPolicy([null], { retentionDays: 30 }), /each audit record must be an object/);
  assert.throws(
    () => applyRetentionPolicy([{ ...validRecord, schemaVersion: 2 }], { retentionDays: 30 }),
    /schemaVersion 1/
  );
  assert.throws(
    () => applyRetentionPolicy([{ ...validRecord, recordedAt: "bad-date" }], { retentionDays: 30 }),
    /recordedAt must be a valid datetime/
  );
});

test("rejects invalid inputs and timestamps", () => {
  assert.throws(() => createAuditRecord(null), /recommendation must be an object/);
  assert.throws(
    () => createAuditRecord({}, {}, { now: "not-a-date" }),
    /now must be a valid datetime/
  );
  assert.throws(() => createAuditBatch({}), /recommendations must be an array/);
});