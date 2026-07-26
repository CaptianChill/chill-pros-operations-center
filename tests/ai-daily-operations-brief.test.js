"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FEATURE_FLAG,
  buildBrief,
  isFeatureEnabled,
  readQueue,
  renderBriefMarkup,
  storageKeyFromConfig
} = require("../ai/daily-operations-brief");
const engine = require("../ai/operations-engine");

function storage(values = {}) {
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    }
  };
}

test("daily brief remains disabled unless explicitly feature flagged", () => {
  assert.equal(isFeatureEnabled(storage()), false);
  assert.equal(isFeatureEnabled(storage({ [FEATURE_FLAG]: "false" })), false);
  assert.equal(isFeatureEnabled(storage({ [FEATURE_FLAG]: "true" })), true);
});

test("queue reader safely handles valid, invalid, and non-array JSON", () => {
  assert.deepEqual(readQueue(storage({ queue: '[{"id":"1"}]' }), "queue"), [{ id: "1" }]);
  assert.deepEqual(readQueue(storage({ queue: "not-json" }), "queue"), []);
  assert.deepEqual(readQueue(storage({ queue: '{"id":"1"}' }), "queue"), []);
});

test("storage key is tenant-aware", () => {
  assert.equal(storageKeyFromConfig({ tenant: { id: "chill-pros" } }), "fieldForged:chill-pros:operations-center:v3");
  assert.equal(storageKeyFromConfig({}), "fieldForged:chill-pros:operations-center:v3");
});

test("brief adapter routes records through the deterministic engine", () => {
  const brief = buildBrief([
    {
      id: "urgent",
      customerName: "Cold Storage",
      officeStatus: "Needs Review",
      complaint: "Walk-in not cooling",
      assignedTechnician: ""
    }
  ], engine, "2026-07-26T06:00:00.000Z");

  assert.equal(brief.mode, "advisory-only");
  assert.equal(brief.totals.urgentJobs, 1);
  assert.equal(brief.totals.unassignedJobs, 1);
  assert.equal(brief.recommendations[0].id, "urgent");
});

test("brief adapter returns a safe error when the engine is unavailable", () => {
  assert.match(buildBrief([], null).error, /unavailable/i);
});

test("rendered brief escapes customer-controlled content and states advisory boundary", () => {
  const markup = renderBriefMarkup({
    totals: { activeJobs: 1, urgentJobs: 1, unassignedJobs: 1, readyToInvoice: 0 },
    recommendations: [{
      customerName: '<img src=x onerror="alert(1)">',
      score: 77,
      status: "Needs Review",
      recommendedAction: "Assign technician",
      reasons: ["No technician assigned"],
      urgent: true
    }]
  });

  assert.ok(markup.includes("Advisory only"));
  assert.ok(markup.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.equal(markup.includes('<img src=x onerror="alert(1)">'), false);
  assert.ok(markup.includes("URGENT"));
});

test("empty brief renders a non-destructive empty state", () => {
  const markup = renderBriefMarkup({ totals: {}, recommendations: [] });
  assert.ok(markup.includes("No active recommendations"));
});
