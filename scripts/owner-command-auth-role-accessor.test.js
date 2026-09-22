"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession, normalizeProfile } = require("../owner-command-auth.js");

const roleAccessorFailure = new Error("role accessor failed");

function makeThrowingRoleProfile() {
  const profile = {};
  Object.defineProperty(profile, "role", {
    enumerable: true,
    get() {
      throw roleAccessorFailure;
    }
  });
  return profile;
}

(async function run() {
  assert.throws(
    () => normalizeProfile({
      exists: true,
      data: makeThrowingRoleProfile
    }),
    error => (
      error &&
      error.code === "auth/owner-profile-invalid" &&
      error.cause === roleAccessorFailure
    )
  );

  const owner = { uid: "owner-uid" };
  let signOutCalls = 0;

  await assert.rejects(
    authorizeOwnerSession({
      auth: {
        currentUser: owner,
        async signOut() {
          signOutCalls += 1;
        }
      },
      firestore: {
        collection(name) {
          assert.equal(name, "Users");
          return {
            doc(uid) {
              assert.equal(uid, owner.uid);
              return {
                async get() {
                  return {
                    exists: true,
                    data: makeThrowingRoleProfile
                  };
                }
              };
            }
          };
        }
      },
      waitForAuthState: async () => owner
    }),
    error => (
      error &&
      error.code === "auth/owner-profile-invalid" &&
      error.cause === roleAccessorFailure
    )
  );

  assert.equal(signOutCalls, 1, "malformed role access should reject and sign out exactly once");

  console.log("Owner Command Center role accessor failure contract passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
