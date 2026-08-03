"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession } = require("../owner-command-auth.js");

(async function run() {
  const owner = { uid: "owner-uid" };
  let profileLookups = 0;
  let signOutCalls = 0;
  const accessorFailure = new Error("currentUser accessor failed");
  const auth = {
    get currentUser() {
      throw accessorFailure;
    },
    async signOut() {
      signOutCalls += 1;
    }
  };

  await assert.rejects(
    authorizeOwnerSession({
      auth,
      firestore: {
        collection() {
          profileLookups += 1;
          throw new Error("profile lookup must not run");
        }
      },
      waitForAuthState: async () => owner
    }),
    error => error && error.code === "auth/session-changed"
  );

  assert.equal(profileLookups, 0, "a malformed current session must fail before Firestore access");
  assert.equal(signOutCalls, 1, "a malformed current session must trigger fail-closed sign-out");

  console.log("Owner Command Center session-accessor tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
