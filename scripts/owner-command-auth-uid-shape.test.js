"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession } = require("../owner-command-auth.js");

async function expectCode(promise, code) {
  await assert.rejects(promise, error => error && error.code === code);
}

(async function run() {
  const invalidUsers = [
    null,
    {},
    { uid: "" },
    { uid: "   " },
    { uid: " owner-uid" },
    { uid: "owner-uid " },
    { uid: 42 }
  ];

  for (const user of invalidUsers) {
    let profileLookups = 0;
    let signOutCalls = 0;
    const auth = {
      currentUser: user,
      async signOut() { signOutCalls += 1; }
    };
    const firestore = {
      collection() {
        profileLookups += 1;
        return { doc() { return { get: async () => ({ exists: true, data: () => ({ role: "owner" }) }) }; } };
      }
    };

    await expectCode(authorizeOwnerSession({
      auth,
      firestore,
      waitForAuthState: async () => user
    }), "auth/signed-out");

    assert.equal(profileLookups, 0, "invalid UIDs must be rejected before Firestore access");
    assert.equal(signOutCalls, 0, "invalid signed-out session shapes must not trigger redundant sign-out");
  }

  console.log("Owner Command Center UID-shape contract passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
