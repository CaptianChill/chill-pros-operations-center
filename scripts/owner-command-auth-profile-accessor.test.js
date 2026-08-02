"use strict";

const assert = require("node:assert/strict");
const {
  authorizeOwnerSession,
  normalizeProfile
} = require("../owner-command-auth.js");

const accessorFailure = new Error("profile decoding failed");
const brokenSnapshot = {
  exists: true,
  data() {
    throw accessorFailure;
  }
};

assert.throws(
  () => normalizeProfile(brokenSnapshot),
  error => {
    assert.equal(error.code, "auth/owner-profile-invalid");
    assert.equal(error.cause, accessorFailure);
    return true;
  }
);

(async function run() {
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
              return brokenSnapshot;
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
      assert.equal(error.cause, accessorFailure);
      return true;
    }
  );

  assert.equal(signOutCalls, 1, "malformed profile snapshots must fail closed and sign out");
  console.log("Owner profile accessor failure contract passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
