"use strict";

const assert = require("node:assert/strict");
const {
  authorizeOwnerSession,
  normalizeProfile,
  waitForProfileSnapshot
} = require("../owner-command-auth.js");

function makeSnapshot(data, exists = true) {
  return { exists, data: () => data };
}

function makeFirestore(snapshot, failure) {
  return {
    collection(name) {
      assert.equal(name, "Users");
      return {
        doc(uid) {
          assert.equal(uid, "owner-uid");
          return {
            async get() {
              if (failure) throw failure;
              return snapshot;
            }
          };
        }
      };
    }
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, error => error && error.code === code);
}

async function testProfileTimeoutCleanup() {
  let timeoutCallback;
  let scheduledDelay;
  let clearTimeoutCalls = 0;
  let resolveProfile;
  const profileRef = {
    get() {
      return new Promise(resolve => { resolveProfile = resolve; });
    }
  };

  const pending = waitForProfileSnapshot(profileRef, {
    timeoutMs: 2400,
    setTimeout(callback, delay) {
      timeoutCallback = callback;
      scheduledDelay = delay;
      return "profile-timer";
    },
    clearTimeout(timerId) {
      assert.equal(timerId, "profile-timer");
      clearTimeoutCalls += 1;
    }
  });

  await Promise.resolve();
  assert.equal(scheduledDelay, 2400);
  timeoutCallback();
  await expectCode(pending, "auth/owner-profile-timeout");
  assert.equal(clearTimeoutCalls, 1);
  resolveProfile(makeSnapshot({ role: "owner" }));
  await Promise.resolve();
  assert.equal(clearTimeoutCalls, 1, "late profile resolution must be ignored");
}

(async function run() {
  assert.deepEqual(normalizeProfile(makeSnapshot({ role: "owner" })), { role: "owner" });
  assert.throws(() => normalizeProfile(makeSnapshot(null, false)), error => error.code === "auth/owner-profile-missing");
  assert.throws(() => normalizeProfile(makeSnapshot({ role: "office" })), error => error.code === "auth/not-owner-account");

  await testProfileTimeoutCleanup();

  let signOutCalls = 0;
  const auth = { async signOut() { signOutCalls += 1; } };
  const owner = { uid: "owner-uid", email: "owner@example.invalid" };
  const waitForOwner = async () => owner;

  const accepted = await authorizeOwnerSession({
    auth,
    firestore: makeFirestore(makeSnapshot({ role: "owner", displayName: "Owner" })),
    waitForAuthState: waitForOwner
  });
  assert.equal(accepted.authorized, true);
  assert.equal(accepted.uid, "owner-uid");
  assert.equal(accepted.role, "owner");
  assert.equal(signOutCalls, 0);
  assert.ok(Object.isFrozen(accepted));

  await expectCode(authorizeOwnerSession({
    auth,
    firestore: makeFirestore(makeSnapshot({ role: "technician", technicianName: "Tech" })),
    waitForAuthState: waitForOwner
  }), "auth/not-owner-account");
  assert.equal(signOutCalls, 1, "wrong-role accounts must be signed out");

  await expectCode(authorizeOwnerSession({
    auth,
    firestore: makeFirestore(makeSnapshot(null, false)),
    waitForAuthState: waitForOwner
  }), "auth/owner-profile-missing");
  assert.equal(signOutCalls, 2, "missing profiles must be signed out");

  const permissionDenied = Object.assign(new Error("denied"), { code: "permission-denied" });
  await expectCode(authorizeOwnerSession({
    auth,
    firestore: makeFirestore(null, permissionDenied),
    waitForAuthState: waitForOwner
  }), "auth/owner-profile-unavailable");
  assert.equal(signOutCalls, 3, "profile lookup failures must be signed out");

  let timeoutCallback;
  const hangingFirestore = {
    collection() {
      return {
        doc() {
          return { get: () => new Promise(() => {}) };
        }
      };
    }
  };
  await expectCode(authorizeOwnerSession({
    auth,
    firestore: hangingFirestore,
    waitForAuthState: waitForOwner,
    profileTimeoutMs: 1500,
    setTimeout(callback, delay) {
      assert.equal(delay, 1500);
      timeoutCallback = callback;
      queueMicrotask(callback);
      return "authorization-profile-timer";
    },
    clearTimeout(timerId) {
      assert.equal(timerId, "authorization-profile-timer");
    }
  }), "auth/owner-profile-timeout");
  assert.equal(typeof timeoutCallback, "function");
  assert.equal(signOutCalls, 4, "profile timeout must sign out the unresolved session");

  await expectCode(authorizeOwnerSession({
    auth,
    firestore: makeFirestore(makeSnapshot({ role: "owner" })),
    waitForAuthState: async () => null
  }), "auth/signed-out");
  assert.equal(signOutCalls, 4, "signed-out state must not call signOut again");

  const timeout = Object.assign(new Error("timed out"), { code: "auth/session-timeout" });
  await expectCode(authorizeOwnerSession({
    auth,
    firestore: makeFirestore(makeSnapshot({ role: "owner" })),
    waitForAuthState: async () => { throw timeout; }
  }), "auth/session-timeout");
  assert.equal(signOutCalls, 4, "session resolution failures must not call signOut");

  await expectCode(authorizeOwnerSession({
    auth,
    firestore: makeFirestore(makeSnapshot({ role: "owner" })),
    waitForAuthState: async () => { throw new Error("listener failed"); }
  }), "auth/session-unavailable");
  assert.equal(signOutCalls, 4, "generic session failures must not call signOut");

  await expectCode(authorizeOwnerSession({ auth: {}, firestore: {}, waitForAuthState: async () => owner }), "auth/dependency-unavailable");
  await expectCode(authorizeOwnerSession({ auth, firestore: makeFirestore(makeSnapshot({ role: "owner" })) }), "auth/dependency-unavailable");

  console.log("Owner Command Center authorization boundary tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
