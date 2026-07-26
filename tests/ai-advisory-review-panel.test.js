"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  bindRefreshHandler,
  buildPanelModel,
  readJobs,
  renderPanelMarkup,
  storageKeyFromConfig
} = require("../ai/advisory-review-panel");
const pipeline = require("../ai/advisory-pipeline");

function storage(values = {}) {
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    }
  };
}

test("job reader fails safely for malformed or non-array data", () => {
  assert.deepEqual(readJobs(storage({ queue: '[{"id":"1"}]' }), "queue"), [{ id: "1" }]);
  assert.deepEqual(readJobs(storage({ queue: "not-json" }), "queue"), []);
  assert.deepEqual(readJobs(storage({ queue: '{"id":"1"}' }), "queue"), []);
});

test("storage key remains tenant-aware", () => {
  assert.equal(storageKeyFromConfig({ tenant: { id: "chill-pros" } }), "fieldForged:chill-pros:operations-center:v3");
  assert.equal(storageKeyFromConfig({}), "fieldForged:chill-pros:operations-center:v3");
});

test("panel model is generated through the advisory-only pipeline", () => {
  const model = buildPanelModel([{
    id: "job-1",
    customerName: "Cold Storage",
    complaint: "Walk-in not cooling",
    officeStatus: "Needs Review",
    createdAt: "2026-07-25T10:00:00.000Z"
  }], pipeline, "2026-07-26T18:00:00.000Z");

  assert.equal(model.mode, "advisory-only");
  assert.equal(model.executable, false);
  assert.equal(model.requiresHumanApproval, true);
  assert.ok(model.totals.total >= 1);
  assert.ok(model.queue.every((item) => item.executable === false));
});

test("panel fails safely when pipeline is unavailable", () => {
  assert.match(buildPanelModel([], null).error, /unavailable/i);
});

test("rendered queue escapes user-controlled text and exposes no execution control", () => {
  const markup = renderPanelMarkup({
    totals: { total: 1, ownerApproval: 1, officeReview: 0, prohibited: 0 },
    queue: [{
      id: "review-1",
      summary: '<img src=x onerror="alert(1)">',
      level: "owner-approval",
      score: 100,
      reasons: ["Urgent"],
      prohibited: false
    }]
  });

  assert.ok(markup.includes("Read-only advisory queue"));
  assert.ok(markup.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.equal(markup.includes('<img src=x onerror="alert(1)">'), false);
  assert.equal(/approve|execute/i.test(markup.replace("cannot approve, execute", "")), false);
});

test("empty queue renders a safe informational state", () => {
  const markup = renderPanelMarkup({ totals: {}, queue: [] });
  assert.ok(markup.includes("No advisory items"));
  assert.ok(markup.includes("cannot approve, execute, or persist"));
});

test("refresh binding replaces the prior listener instead of stacking callbacks", () => {
  const listeners = new Set();
  const button = {
    addEventListener(event, listener) {
      assert.equal(event, "click");
      listeners.add(listener);
    },
    removeEventListener(event, listener) {
      assert.equal(event, "click");
      listeners.delete(listener);
    }
  };
  let firstCalls = 0;
  let secondCalls = 0;
  const first = () => { firstCalls += 1; };
  const second = () => { secondCalls += 1; };

  assert.equal(bindRefreshHandler(button, first), true);
  assert.equal(bindRefreshHandler(button, second), true);
  assert.equal(listeners.size, 1);

  for (const listener of listeners) listener();
  assert.equal(firstCalls, 0);
  assert.equal(secondCalls, 1);
});

test("refresh binding fails safely for missing controls or invalid callbacks", () => {
  assert.equal(bindRefreshHandler(null, () => {}), false);
  assert.equal(bindRefreshHandler({}, () => {}), false);
  assert.equal(bindRefreshHandler({ addEventListener() {} }, null), false);
});