"use strict";

const assert = require("node:assert/strict");
const {
  authorizeOwnerSession,
  normalizeProfile
} = require("../owner-command-auth.js");

const dataAccessorFailure = new Error("profile decoding failed");
const brokenDataSnapshot = {
  exists: true,
  data() {
    throw dataAccessorFailure;
  }
};

assert.throws(
  () => normalizeProfile(brokenDataSnapshot),
  error => {
    assert.equal(error.code, "auth/owner-profile-invalid");
    assert.equal(error.cause, dataAccessorFailure);
    return true;
  }
);

const existsAccessorFailure = new Error("profile existence check failed");
const brokenExistsSnapshot = {};
Object.defineProperty(brokenExistsSnapshot, "exists", {
  get() {
    throw existsAccessorFailure;
  }
});

assert.throws(
  () => normalizeProfile(brokenExistsSnapshot),
  error => {
    assert.equal(error.code, "auth/owner-profile-invalid");
    assert.equal(error.cause, existsAccessorFailure);
    return true;
  }
);

async function assertFailsClosed(snapshot, expectedCause) {
  const owner = { uid: "owner-uid" };
  let signOutCalls = 0;
  const auth = {
    currentUser: owner,
    async signOut() {
      signOutCalls += 1;
    }
  };
  const firestore = {
    collection(name) {
      assert.equal(name, "Users");
      return {
        doc(uid) {
          assert.equal(uid, owner.uid);
          return {
            async get() {
              return snapshot;
            }
          };
        }
      };
    }
  };

  await assert.rejects(
    authorizeOwnerSession({
      auth,
      firestore,
      waitForAuthState: async () => owner
    }),
    error => {
      assert.equal(error.code, "auth/owner-profile-invalid");
      assert.equal(error.cause, expectedCause);
      return true;
    }
  );

  assert.equal(signOutCalls, 1, "malformed profile snapshots must fail closed and sign out");
}

(async function run() {
  await assertFailsClosed(brokenDataSnapshot, dataAccessorFailure);
  await assertFailsClosed(brokenExistsSnapshot, existsAccessorFailure);
  console.log("Owner profile accessor failure contract passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
