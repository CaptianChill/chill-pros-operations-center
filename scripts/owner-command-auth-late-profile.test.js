"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession } = require("../owner-command-auth.js");

function makeSnapshot(data) {
  return { exists: true, data: () => data };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, error => error && error.code === code);
}

(async function run() {
  const owner = { uid: "owner-uid" };
  let signOutCalls = 0;
  let resolveProfile;
  let timeoutCallback;
  let clearTimeoutCalls = 0;

  const auth = {
    currentUser: owner,
    async signOut() {
      signOutCalls += 1;
      this.currentUser = null;
    }
  };

  const firestore = {
    collection(name) {
      assert.equal(name, "Users");
      return {
        doc(uid) {
          assert.equal(uid, owner.uid);
          return {
            get() {
              return new Promise(resolve => {
                resolveProfile = resolve;
              });
            }
          };
        }
      };
    }
  };

  const pending = authorizeOwnerSession({
    auth,
    firestore,
    waitForAuthState: async () => owner,
    profileTimeoutMs: 2500,
    setTimeout(callback, delay) {
      assert.equal(delay, 2500);
      timeoutCallback = callback;
      return "late-profile-timer";
    },
    clearTimeout(timerId) {
      assert.equal(timerId, "late-profile-timer");
      clearTimeoutCalls += 1;
    }
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(typeof resolveProfile, "function", "profile lookup should be pending");
  assert.equal(typeof timeoutCallback, "function", "profile timeout should be scheduled");

  timeoutCallback();
  await expectCode(pending, "auth/owner-profile-timeout");
  assert.equal(signOutCalls, 1, "timed-out sessions must be signed out exactly once");
  assert.equal(clearTimeoutCalls, 1, "profile timer must be cleared exactly once");
  assert.equal(auth.currentUser, null, "timed-out owner session must remain signed out");

  resolveProfile(makeSnapshot({ role: "owner" }));
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(signOutCalls, 1, "late profile resolution must not trigger another sign-out");
  assert.equal(clearTimeoutCalls, 1, "late profile resolution must not repeat timer cleanup");
  assert.equal(auth.currentUser, null, "late profile resolution must never restore authorization");

  console.log("Owner Command Center late profile resolution contract passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
