"use strict";

const assert = require("node:assert/strict");
const { normalizeProfile } = require("../owner-command-auth.js");

function snapshot(data, exists = true) {
  return { exists, data: () => data };
}

function expectCode(action, code) {
  assert.throws(action, error => error && error.code === code);
}

(function run() {
  expectCode(() => normalizeProfile(snapshot({ role: "Owner" })), "auth/not-owner-account");
  expectCode(() => normalizeProfile(snapshot({ role: " owner " })), "auth/not-owner-account");
  expectCode(() => normalizeProfile(snapshot({ role: ["owner"] })), "auth/not-owner-account");
  expectCode(() => normalizeProfile(snapshot({ role: { name: "owner" } })), "auth/not-owner-account");
  expectCode(() => normalizeProfile(snapshot({})), "auth/not-owner-account");
  expectCode(() => normalizeProfile(snapshot([], true)), "auth/owner-profile-invalid");
  expectCode(() => normalizeProfile(snapshot("owner", true)), "auth/owner-profile-invalid");
  expectCode(() => normalizeProfile({ exists: true, data() { throw new Error("decode failed"); } }), "auth/owner-profile-invalid");
  expectCode(() => normalizeProfile({ exists: "true", data: () => ({ role: "owner" }) }), "auth/owner-profile-missing");

  const owner = normalizeProfile(snapshot({ role: "owner", email: "ignored@example.invalid", permissions: ["all"] }));
  assert.deepEqual(owner, { role: "owner" });
  assert.ok(Object.isFrozen(owner));
  assert.equal(Object.prototype.hasOwnProperty.call(owner, "email"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(owner, "permissions"), false);

  console.log("Owner Command Center profile-shape contract passed.");
})();
