"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession } = require("../owner-command-auth.js");

async function expectCode(promise, code) {
  await assert.rejects(promise, error => error && error.code === code);
}

(async function run() {
  const owner = { uid: "owner-uid" };
  let signOutCalls = 0;
  const auth = {
    currentUser: owner,
    async signOut() {
      signOutCalls += 1;
    }
  };
  const waitForAuthState = async () => owner;

  const collectionFailure = new Error("collection resolver failed");
  await expectCode(authorizeOwnerSession({
    auth,
    waitForAuthState,
    firestore: {
      collection() {
        throw collectionFailure;
      }
    }
  }), "auth/owner-profile-unavailable");
  assert.equal(signOutCalls, 1, "collection resolver failures must sign out the unresolved session");

  const docFailure = new Error("document resolver failed");
  await expectCode(authorizeOwnerSession({
    auth,
    waitForAuthState,
    firestore: {
      collection(name) {
        assert.equal(name, "Users");
        return {
          doc(uid) {
            assert.equal(uid, owner.uid);
            throw docFailure;
          }
        };
      }
    }
  }), "auth/owner-profile-unavailable");
  assert.equal(signOutCalls, 2, "document resolver failures must sign out the unresolved session");

  const getFailure = new Error("profile read failed synchronously");
  await expectCode(authorizeOwnerSession({
    auth,
    waitForAuthState,
    firestore: {
      collection(name) {
        assert.equal(name, "Users");
        return {
          doc(uid) {
            assert.equal(uid, owner.uid);
            return {
              get() {
                throw getFailure;
              }
            };
          }
        };
      }
    }
  }), "auth/owner-profile-unavailable");
  assert.equal(signOutCalls, 3, "synchronous profile-read failures must sign out the unresolved session");

  const dependencyFailure = Object.assign(new Error("profile dependency missing"), {
    code: "auth/dependency-unavailable"
  });
  await expectCode(authorizeOwnerSession({
    auth,
    waitForAuthState,
    firestore: {
      collection() {
        throw dependencyFailure;
      }
    }
  }), "auth/dependency-unavailable");
  assert.equal(signOutCalls, 4, "explicit auth dependency failures must remain fail-closed");

  console.log("Owner Command Center Firestore failure contracts passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
