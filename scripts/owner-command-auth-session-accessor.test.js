"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession } = require("../owner-command-auth.js");

async function expectSessionChanged(options, expectedCause) {
  await assert.rejects(
    authorizeOwnerSession(options),
    error => Boolean(
      error &&
      error.code === "auth/session-changed" &&
      (!expectedCause || error.cause === expectedCause)
    )
  );
}

(async function run() {
  {
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

    await expectSessionChanged({
      auth,
      firestore: {
        collection() {
          profileLookups += 1;
          throw new Error("profile lookup must not run");
        }
      },
      waitForAuthState: async () => owner
    });

    assert.equal(profileLookups, 0, "a malformed current session must fail before Firestore access");
    assert.equal(signOutCalls, 1, "a malformed current session must trigger fail-closed sign-out");
  }

  {
    let profileLookups = 0;
    let signOutCalls = 0;
    const accessorFailure = new Error("resolved user UID accessor failed");
    const malformedUser = {
      get uid() {
        throw accessorFailure;
      }
    };
    const auth = {
      currentUser: malformedUser,
      async signOut() {
        signOutCalls += 1;
      }
    };

    await expectSessionChanged({
      auth,
      firestore: {
        collection() {
          profileLookups += 1;
          throw new Error("profile lookup must not run");
        }
      },
      waitForAuthState: async () => malformedUser
    }, accessorFailure);

    assert.equal(profileLookups, 0, "a throwing resolved-user UID must fail before Firestore access");
    assert.equal(signOutCalls, 1, "a throwing resolved-user UID must trigger fail-closed sign-out");
  }

  console.log("Owner Command Center session-accessor tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
