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
      source: "operations-center",
      attempt: 1,
      successful: true,
      detail: null,
      tags: ["security", "audit"]
    }),
    {
      source: "operations-center",
      attempt: 1,
      successful: true,
      detail: null,
      tags: ["security", "audit"]
    },
    `${name} should preserve supported primitive values`
  );

  const unsupportedCases = [
    [{ context: { omitted: undefined } }, /metadata\.context\.omitted contains an unsupported Firestore value/],
    [{ context: { callback() {} } }, /metadata\.context\.callback contains an unsupported Firestore value/],
    [{ context: { marker: Symbol("marker") } }, /metadata\.context\.marker contains an unsupported Firestore value/],
    [{ context: { sequence: 1n } }, /metadata\.context\.sequence contains an unsupported Firestore value/],
    [{ context: { attempts: Number.NaN } }, /metadata\.context\.attempts must contain a finite number/],
    [{ context: { duration: Number.POSITIVE_INFINITY } }, /metadata\.context\.duration must contain a finite number/],
    [{ attempts: [1, undefined] }, /metadata\.attempts\[1\] contains an unsupported Firestore value/]
  ];

  for (const [metadata, expected] of unsupportedCases) {
    assert.throws(
      () => normalizeMetadata(metadata),
      expected,
      `${name} should reject invalid Firestore metadata values before writing`
    );
  }
}

console.log("Audit metadata Firestore value tests passed");
