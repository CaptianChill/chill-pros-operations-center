"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession } = require("../owner-command-auth.js");

function makeFirestore(role) {
  return {
    collection(name) {
      assert.equal(name, "Users");
      return {
        doc(uid) {
          assert.equal(uid, "owner-uid");
          return {
            async get() {
              return {
                exists: true,
                data() {
                  return { role };
                }
              };
            }
          };
        }
      };
    }
  };
}

(async function run() {
  const owner = { uid: "owner-uid" };
  const signOutFailure = new Error("network unavailable during sign-out");
  const logged = [];
  const originalConsoleError = console.error;

  console.error = (...args) => logged.push(args);

  try {
    await assert.rejects(
      authorizeOwnerSession({
        auth: {
          currentUser: owner,
          async signOut() {
            throw signOutFailure;
          }
        },
        firestore: makeFirestore("technician"),
        waitForAuthState: async () => owner
      }),
      error => error && error.code === "auth/not-owner-account"
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(logged.length, 1, "sign-out failure should be recorded once");
  assert.equal(logged[0][0], "Owner Command Center sign-out failed after authorization rejection.");
  assert.equal(logged[0][1], signOutFailure);

  console.log("Owner Command Center sign-out failure contract passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
