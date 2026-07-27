const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "firebase-config.js"), "utf8");
const expectedScripts = [
  "ai/operations-engine.js",
  "ai/job-data-adapter.js",
  "ai/follow-up-flags.js",
  "ai/advisory-review-queue.js",
  "ai/advisory-pipeline.js",
  "ai/daily-operations-brief.js",
  "ai/advisory-review-panel.js"
];

function executeConfig({ featureValue = null, storageError = null, existingScripts = [] } = {}) {
  const appendedScripts = [];
  const initializedConfigs = [];
  const firestoreDb = Object.freeze({ kind: "firestore" });
  const existing = new Set(existingScripts);

  const window = {
    localStorage: {
      getItem(key) {
        assert.equal(key, "chillProsFeatures:aiOperationsBrief");
        if (storageError) throw storageError;
        return featureValue;
      }
    }
  };

  const document = {
    querySelector(selector) {
      const match = selector.match(/^script\[src="(.+)"\]$/);
      return match && existing.has(match[1]) ? { src: match[1] } : null;
    },
    createElement(tagName) {
      assert.equal(tagName, "script");
      return { src: "", async: true };
    },
    head: {
      appendChild(script) {
        appendedScripts.push({ src: script.src, async: script.async });
        existing.add(script.src);
      }
    }
  };

  const firebase = {
    initializeApp(config) {
      initializedConfigs.push(config);
    },
    firestore() {
      return firestoreDb;
    }
  };

  vm.runInNewContext(source, { window, document, firebase });
  return { appendedScripts, initializedConfigs, window, firestoreDb };
}

test("does not load AI modules when the feature flag is absent", () => {
  const result = executeConfig();
  assert.deepEqual(result.appendedScripts, []);
  assert.equal(result.initializedConfigs.length, 1);
  assert.equal(result.window.chillProsDb, result.firestoreDb);
});

test("does not load AI modules for non-canonical truthy values", () => {
  for (const featureValue of ["TRUE", "1", "yes", true]) {
    const result = executeConfig({ featureValue });
    assert.deepEqual(result.appendedScripts, []);
  }
});

test("loads advisory modules in deterministic dependency order when enabled", () => {
  const result = executeConfig({ featureValue: "true" });
  assert.deepEqual(
    result.appendedScripts,
    expectedScripts.map((src) => ({ src, async: false }))
  );
});

test("fails closed when local storage is unavailable", () => {
  const result = executeConfig({ storageError: new Error("storage denied") });
  assert.deepEqual(result.appendedScripts, []);
});

test("does not append modules that are already present", () => {
  const result = executeConfig({
    featureValue: "true",
    existingScripts: [expectedScripts[0], expectedScripts[3]]
  });
  assert.deepEqual(
    result.appendedScripts.map(({ src }) => src),
    expectedScripts.filter((src) => ![expectedScripts[0], expectedScripts[3]].includes(src))
  );
});
