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
  const owner = { uid: "owner-uid", email: "owner@example.invalid" };
  let signOutCalls = 0;
  const auth = {
    currentUser: owner,
    async signOut() {
      signOutCalls += 1;
      this.currentUser = null;
    }
  };

  let profileLookups = 0;
  auth.currentUser = null;
  await expectCode(authorizeOwnerSession({
    auth,
    firestore: {
      collection() {
        profileLookups += 1;
        return { doc() { return { get: async () => makeSnapshot({ role: "owner" }) }; } };
      }
    },
    waitForAuthState: async () => owner
  }), "auth/session-changed");
  assert.equal(profileLookups, 0, "a disappeared session must be rejected before profile lookup");
  assert.equal(signOutCalls, 1, "a disappeared pre-verification session must trigger fail-closed sign-out");

  auth.currentUser = owner;
  await expectCode(authorizeOwnerSession({
    auth,
    firestore: {
      collection(name) {
        assert.equal(name, "Users");
        return {
          doc(uid) {
            assert.equal(uid, owner.uid);
            return {
              async get() {
                auth.currentUser = null;
                return makeSnapshot({ role: "owner" });
              }
            };
          }
        };
      }
    },
    waitForAuthState: async () => owner
  }), "auth/session-changed");
  assert.equal(signOutCalls, 2, "a disappeared session during profile verification must trigger sign-out");

  console.log("Owner Command Center session-race tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
