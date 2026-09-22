"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession, waitForProfileSnapshot } = require("../owner-command-auth.js");

function makeOwnerSnapshot() {
  return { exists: true, data: () => ({ role: "owner" }) };
}

async function testProfileWaitRejectsSchedulerFailure() {
  const schedulerFailure = new Error("setTimeout unavailable");
  let profileReads = 0;

  await assert.rejects(
    waitForProfileSnapshot(
      {
        get: async () => {
          profileReads += 1;
          return makeOwnerSnapshot();
        }
      },
      {
        setTimeout() {
          throw schedulerFailure;
        }
      }
    ),
    error => error === schedulerFailure
  );

  assert.equal(profileReads, 0, "profile reads must not start when timeout scheduling fails");
}

async function testAuthorizationFailsClosedWhenSchedulerFails() {
  const schedulerFailure = new Error("setTimeout unavailable");
  const user = { uid: "owner-uid" };
  let signOutCalls = 0;
  let profileReads = 0;

  const auth = {
    currentUser: user,
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
          assert.equal(uid, user.uid);
          return {
            async get() {
              profileReads += 1;
              return makeOwnerSnapshot();
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
      waitForAuthState: async () => user,
      setTimeout() {
        throw schedulerFailure;
      }
    }),
    error => {
      assert.equal(error.code, "auth/owner-profile-unavailable");
      assert.equal(error.cause, schedulerFailure);
      return true;
    }
  );

  assert.equal(profileReads, 0, "authorization must not read the profile without a timeout guard");
  assert.equal(signOutCalls, 1, "the unresolved session must be signed out exactly once");
  assert.equal(auth.currentUser, null);
}

(async function run() {
  await testProfileWaitRejectsSchedulerFailure();
  await testAuthorizationFailsClosedWhenSchedulerFails();
  console.log("Owner Command Center timer scheduler failure tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
