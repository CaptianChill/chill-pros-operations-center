"use strict";

const assert = require("node:assert/strict");
const { initializeSecurityRuntime } = require("../security-runtime-bootstrap.js");

function createScope(overrides = {}) {
  const auth = { currentUser: { uid: "owner-1" } };
  const integration = {
    updateCustomer: async () => "audit-update",
    deleteCustomer: async () => "audit-delete"
  };
  let authCalls = 0;
  let integrationCalls = 0;

  const scope = {
    firebase: {
      auth() {
        authCalls += 1;
        return auth;
      }
    },
    ChillProsCustomerMutationIntegration: {
      createBrowserQueueMutationIntegration(receivedScope) {
        integrationCalls += 1;
        assert.equal(receivedScope, scope);
        return integration;
      }
    },
    ...overrides
  };

  return {
    scope,
    auth,
    integration,
    getAuthCalls: () => authCalls,
    getIntegrationCalls: () => integrationCalls
  };
}

{
  const fixture = createScope();
  const result = initializeSecurityRuntime(fixture.scope);
  assert.equal(result, fixture.integration);
  assert.equal(fixture.scope.chillProsAuth, fixture.auth);
  assert.equal(fixture.scope.chillProsCustomerMutations, fixture.integration);
  assert.equal(fixture.getAuthCalls(), 1);
  assert.equal(fixture.getIntegrationCalls(), 1);
}

{
  const existingAuth = { currentUser: { uid: "office-1" } };
  const fixture = createScope({ chillProsAuth: existingAuth });
  initializeSecurityRuntime(fixture.scope);
  assert.equal(fixture.scope.chillProsAuth, existingAuth);
  assert.equal(fixture.getAuthCalls(), 0);
}

assert.throws(
  () => initializeSecurityRuntime(null),
  /Browser scope is required/
);
assert.throws(
  () => initializeSecurityRuntime({ firebase: {} }),
  /Firebase Auth compat SDK is required/
);
assert.throws(
  () => initializeSecurityRuntime({ firebase: { auth: () => null } }),
  /Firebase Auth initialization failed/
);
assert.throws(
  () => initializeSecurityRuntime({ firebase: { auth: () => ({}) } }),
  /Audited customer mutation integration is unavailable/
);
assert.throws(
  () => initializeSecurityRuntime({
    firebase: { auth: () => ({}) },
    ChillProsCustomerMutationIntegration: {
      createBrowserQueueMutationIntegration: () => ({ updateCustomer() {} })
    }
  }),
  /Audited customer mutation integration is invalid/
);

console.log("Security runtime bootstrap tests passed.");
