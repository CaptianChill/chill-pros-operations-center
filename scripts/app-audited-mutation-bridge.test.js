"use strict";

const assert = require("node:assert/strict");
const {
  classifyUpdateAction,
  installAfterAppLoads,
  installBridge,
  requireGateway
} = require("../app-audited-mutation-bridge.js");

async function run() {
  assert.equal(classifyUpdateAction({ officeStatus: "Scheduled" }), "customer.status.updated");
  assert.equal(classifyUpdateAction({ assignedTechnician: "Brae" }), "customer.schedule.updated");
  assert.equal(classifyUpdateAction({ scheduledDate: "2026-07-29" }), "customer.schedule.updated");
  assert.equal(classifyUpdateAction({ findings: "Failed relay" }), "customer.updated");

  assert.throws(() => requireGateway({}), /gateway is unavailable/);

  const calls = [];
  const scope = {
    chillProsDb: {},
    chillProsCustomerMutations: {
      async updateCustomer(record, changes, options) {
        calls.push(["update", record, changes, options]);
        return "audit-update";
      },
      async deleteCustomer(record, options) {
        calls.push(["delete", record, options]);
        return "audit-delete";
      }
    },
    async updateCustomerInFirebase() {
      calls.push(["legacy-update"]);
    },
    async deleteCustomerFromFirebase() {
      calls.push(["legacy-delete"]);
    }
  };

  installBridge(scope);
  const record = { id: "customer-1" };
  const changes = { officeStatus: "Scheduled", statusUpdatedAt: "2026-07-29T15:00:00.000Z" };
  assert.equal(await scope.updateCustomerInFirebase(record, changes), "audit-update");
  assert.equal(await scope.deleteCustomerFromFirebase(record), "audit-delete");
  assert.deepEqual(calls[0], [
    "update",
    record,
    changes,
    {
      action: "customer.status.updated",
      source: "operations-center-app",
      metadata: { workflow: "office-queue" }
    }
  ]);
  assert.deepEqual(calls[1], [
    "delete",
    record,
    {
      source: "operations-center-app",
      metadata: { workflow: "office-queue" }
    }
  ]);

  const localCalls = [];
  const localScope = {
    chillProsDb: null,
    async updateCustomerInFirebase(recordValue, changesValue) {
      localCalls.push(["update", recordValue, changesValue]);
      return "local-update";
    },
    async deleteCustomerFromFirebase(recordValue) {
      localCalls.push(["delete", recordValue]);
      return "local-delete";
    }
  };
  installBridge(localScope);
  assert.equal(await localScope.updateCustomerInFirebase(record, changes), "local-update");
  assert.equal(await localScope.deleteCustomerFromFirebase(record), "local-delete");
  assert.equal(localCalls.length, 2);

  let listener;
  const eventScope = {
    addEventListener(name, callback, options) {
      assert.equal(name, "DOMContentLoaded");
      assert.deepEqual(options, { once: true });
      listener = callback;
    },
    async updateCustomerInFirebase() {},
    async deleteCustomerFromFirebase() {}
  };
  installAfterAppLoads(eventScope);
  assert.equal(typeof listener, "function");
  listener();
  assert.notEqual(eventScope.updateCustomerInFirebase.name, "updateCustomerInFirebase");

  assert.throws(() => installBridge({}), /Legacy customer mutation functions are unavailable/);
  assert.throws(() => installAfterAppLoads({}), /Browser event target is required/);
}

run()
  .then(() => console.log("app audited mutation bridge tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
