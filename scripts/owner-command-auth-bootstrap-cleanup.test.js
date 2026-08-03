"use strict";

const assert = require("assert");
const { waitForAuthState } = require("../owner-command-auth-bootstrap.js");

async function captureConsoleError(run) {
  const original = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    await run(calls);
  } finally {
    console.error = original;
  }
}

async function testResolvedSessionSurvivesCleanupFailures() {
  const user = { uid: "owner-cleanup" };

  await captureConsoleError(async (calls) => {
    const auth = {
      onAuthStateChanged(resolve) {
        queueMicrotask(() => resolve(user));
        return () => { throw new Error("unsubscribe failed"); };
      }
    };

    const result = await waitForAuthState(auth, {
      setTimeout() { return "timer-1"; },
      clearTimeout() { throw new Error("clear timeout failed"); }
    });

    assert.strictEqual(result, user);
    assert.strictEqual(calls.length, 2);
    assert.match(calls[0][0], /auth-state cleanup failed/);
    assert.match(calls[1][0], /auth-state cleanup failed/);
  });
}

async function testRejectedSessionSurvivesCleanupFailures() {
  const expectedCause = new Error("firebase listener failed");

  await captureConsoleError(async (calls) => {
    const auth = {
      onAuthStateChanged(resolve, reject) {
        queueMicrotask(() => reject(expectedCause));
        return () => { throw new Error("unsubscribe failed"); };
      }
    };

    await assert.rejects(
      waitForAuthState(auth, {
        setTimeout() { return "timer-2"; },
        clearTimeout() { throw new Error("clear timeout failed"); }
      }),
      (error) => error && error.code === "auth/session-unavailable" && error.cause === expectedCause
    );

    assert.strictEqual(calls.length, 2);
  });
}

async function testTimeoutSurvivesCleanupFailures() {
  let timeoutCallback;

  await captureConsoleError(async (calls) => {
    const auth = {
      onAuthStateChanged() {
        return () => { throw new Error("unsubscribe failed"); };
      }
    };

    const pending = waitForAuthState(auth, {
      setTimeout(callback) {
        timeoutCallback = callback;
        return "timer-3";
      },
      clearTimeout() { throw new Error("clear timeout failed"); }
    });

    timeoutCallback();
    await assert.rejects(pending, (error) => error && error.code === "auth/session-timeout");
    assert.strictEqual(calls.length, 2);
  });
}

async function testSynchronousAuthCallbackReleasesLateSubscriptionOnce() {
  const user = { uid: "owner-sync" };
  let unsubscribeCalls = 0;
  let timeoutSchedules = 0;
  let timeoutCancellations = 0;

  const auth = {
    onAuthStateChanged(resolve) {
      resolve(user);
      return () => { unsubscribeCalls += 1; };
    }
  };

  const result = await waitForAuthState(auth, {
    setTimeout() {
      timeoutSchedules += 1;
      return "timer-sync";
    },
    clearTimeout() {
      timeoutCancellations += 1;
    }
  });

  assert.strictEqual(result, user);
  assert.strictEqual(unsubscribeCalls, 1, "late subscription handle must be released exactly once");
  assert.strictEqual(timeoutSchedules, 0, "resolved synchronous listeners must not schedule a timeout");
  assert.strictEqual(timeoutCancellations, 0, "no unscheduled timeout should be cancelled");
}

(async function run() {
  await testResolvedSessionSurvivesCleanupFailures();
  await testRejectedSessionSurvivesCleanupFailures();
  await testTimeoutSurvivesCleanupFailures();
  await testSynchronousAuthCallbackReleasesLateSubscriptionOnce();
  console.log("Owner auth bootstrap cleanup failure contract passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
