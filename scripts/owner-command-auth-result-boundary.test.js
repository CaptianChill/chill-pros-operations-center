"use strict";

const assert = require("node:assert/strict");
const { authorizeOwnerSession } = require("../owner-command-auth.js");

(async function run() {
  const user = {
    uid: "owner-uid",
    email: "owner@example.invalid",
    accessToken: "must-not-cross-boundary",
    getIdToken() {
      throw new Error("provider object must not be returned");
    }
  };

  const auth = {
    currentUser: user,
    async signOut() {
      throw new Error("authorized owner must not be signed out");
    }
  };

  const result = await authorizeOwnerSession({
    auth,
    waitForAuthState: async () => user,
    firestore: {
      collection(name) {
        assert.equal(name, "Users");
        return {
          doc(uid) {
            assert.equal(uid, "owner-uid");
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    role: "owner",
                    displayName: "Private Owner Name",
                    supplierCostAccess: true
                  })
                };
              }
            };
          }
        };
      }
    }
  });

  assert.deepEqual(Object.keys(result).sort(), ["authorized", "role", "uid"]);
  assert.deepEqual(result, {
    authorized: true,
    uid: "owner-uid",
    role: "owner"
  });
  assert.equal("user" in result, false);
  assert.equal("email" in result, false);
  assert.equal("accessToken" in result, false);
  assert.equal("displayName" in result, false);
  assert.equal("supplierCostAccess" in result, false);
  assert.ok(Object.isFrozen(result));

  console.log("Owner authorization result boundary tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
