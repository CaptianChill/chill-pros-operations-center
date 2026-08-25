"use strict";

const assert = require("node:assert/strict");
const standaloneAudit = require("../audit-events.js");
const batchedAudit = require("../audited-customer-mutations.js");

const normalizers = [
  ["standalone audit writer", standaloneAudit.normalizeMetadata],
  ["batched customer mutations", batchedAudit.normalizeMetadata]
];

for (const [name, normalizeMetadata] of normalizers) {
  assert.deepEqual(
    normalizeMetadata({
      source: " operations-center ",
      workflow: " customer-intake ",
      context: " owner-created record ",
      changedFields: [" customerName ", " officeStatus "]
    }),
    {
      source: "operations-center",
      workflow: "customer-intake",
      context: "owner-created record",
      changedFields: ["customerName", "officeStatus"]
    },
    `${name} should persist the canonical Firestore audit metadata schema`
  );

  const strictStringCases = [
    [{ source: 123 }, /metadata\.source must be a string/],
    [{ workflow: true }, /metadata\.workflow must be a string/],
    [{ context: { text: "not allowed" } }, /metadata\.context must be a string/],
    [{ changedFields: ["officeStatus", 42] }, /metadata\.changedFields\[1\] must be a string/],
    [{ changedFields: ["officeStatus", null] }, /metadata\.changedFields\[1\] must be a string/],
    [{ changedFields: ["officeStatus", { field: "assignedTechnician" }] }, /metadata\.changedFields\[1\] must be a string/]
  ];

  for (const [metadata, expected] of strictStringCases) {
    assert.throws(
      () => normalizeMetadata(metadata),
      expected,
      `${name} should reject non-string schema values before writing`
    );
  }

  assert.throws(
    () => normalizeMetadata({ source: "operations-center", attempt: 1 }),
    /metadata contains unsupported fields: attempt/,
    `${name} should reject fields outside the Firestore metadata allowlist`
  );

  assert.throws(
    () => normalizeMetadata({ changedFields: Array.from({ length: 26 }, (_, index) => `field${index}`) }),
    /metadata\.changedFields exceeds 25 entries/,
    `${name} should enforce the Firestore changed-field entry limit`
  );
}

console.log("Audit metadata Firestore schema parity tests passed");
