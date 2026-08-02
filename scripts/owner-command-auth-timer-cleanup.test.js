"use strict";

const assert = require("node:assert/strict");
const { waitForProfileSnapshot } = require("../owner-command-auth.js");

function makeSnapshot() {
  return { exists: true, data: () => ({ role: "owner" }) };
}

async function testResolvedProfileSurvivesCleanupFailure() {
  const cleanupFailure = new Error("clearTimeout failed");
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args);

  try {
    const snapshot = await waitForProfileSnapshot(
      { get: async () => makeSnapshot() },
      {
        setTimeout() { return "profile-timer"; },
        clearTimeout(timerId) {
          assert.equal(timerId, "profile-timer");
          throw cleanupFailure;
        }
      }
    );

    assert.equal(snapshot.exists, true);
    assert.equal(logged.length, 1);
    assert.equal(logged[0][0], "Owner Command Center profile timer cleanup failed.");
    assert.equal(logged[0][1], cleanupFailure);
  } finally {
    console.error = originalConsoleError;
  }
}

async function testRejectedProfileSurvivesCleanupFailure() {
  const profileFailure = new Error("profile unavailable");
  const cleanupFailure = new Error("clearTimeout failed");
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args);

  try {
    await assert.rejects(
      waitForProfileSnapshot(
        { get: async () => { throw profileFailure; } },
        {
          setTimeout() { return "profile-timer"; },
          clearTimeout() { throw cleanupFailure; }
        }
      ),
      error => error === profileFailure
    );

    assert.equal(logged.length, 1);
    assert.equal(logged[0][1], cleanupFailure);
  } finally {
    console.error = originalConsoleError;
  }
}

(async function run() {
  await testResolvedProfileSurvivesCleanupFailure();
  await testRejectedProfileSurvivesCleanupFailure();
  console.log("Owner Command Center timer cleanup failure tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
