"use strict";

const assert = require("node:assert/strict");
const {
  INSTALL_MARKER,
  classifyUpdateAction,
  getQueueStorageKey,
  installAfterAppLoads,
  installBridge,
  readStoredRecord,
  requireGateway,
  restoreChangedFields,
  snapshotChangedFields
} = require("../app-audited-mutation-bridge.js");

async function run() {
  assert.equal(classifyUpdateAction({ officeStatus: "Scheduled" }), "customer.status.updated");
  assert.equal(classifyUpdateAction({ assignedTechnician: "Brae" }), "customer.schedule.updated");
  assert.equal(classifyUpdateAction({ scheduledDate: "2026-07-29" }), "customer.schedule.updated");
  assert.equal(classifyUpdateAction({ findings: "Failed relay" }), "customer.updated");

  assert.throws(() => requireGateway({}), /gateway is unavailable/);
  assert.equal(getQueueStorageKey({ FIELD_FORGED_CONFIG: { tenant: { id: "chill-pros" } } }), "fieldForged:chill-pros:operations-center:v3");
  assert.equal(getQueueStorageKey({}), "");

  const calls = [];
  const scope = {
    chillProsDb: {},
    FIELD_FORGED_CONFIG: { tenant: { id: "chill-pros" } },
    localStorage: {
      getItem(key) {
        assert.equal(key, "fieldForged:chill-pros:operations-center:v3");
        return JSON.stringify([{ id: "customer-1", officeStatus: "Needs Review" }]);
      }
    },
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

  const firstInstall = installBridge(scope);
  const wrappedUpdate = scope.updateCustomerInFirebase;
  const wrappedDelete = scope.deleteCustomerFromFirebase;
  const secondInstall = installBridge(scope);
  assert.equal(secondInstall, firstInstall);
  assert.equal(scope.updateCustomerInFirebase, wrappedUpdate);
  assert.equal(scope.deleteCustomerFromFirebase, wrappedDelete);
  assert.equal(scope[INSTALL_MARKER], firstInstall);
  assert.equal(Object.isFrozen(firstInstall), true);

  const record = { id: "customer-1", officeStatus: "Scheduled" };
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

  const storedRecord = readStoredRecord(scope, record);
  assert.deepEqual(storedRecord, { id: "customer-1", officeStatus: "Needs Review" });
  const snapshot = snapshotChangedFields(scope, record, changes);
  assert.deepEqual(snapshot, {
    officeStatus: { existed: true, value: "Needs Review" },
    statusUpdatedAt: { existed: false, value: undefined }
  });
  const restoreTarget = { officeStatus: "Scheduled", statusUpdatedAt: "new", untouched: true };
  restoreChangedFields(restoreTarget, snapshot);
  assert.deepEqual(restoreTarget, { officeStatus: "Needs Review", untouched: true });

  const rollbackEvents = [];
  class TestCustomEvent {
    constructor(name, options) {
      this.type = name;
      this.detail = options.detail;
    }
  }
  const failingRecord = {
    id: "customer-1",
    officeStatus: "Dispatched",
    assignedTechnician: "Brae",
    statusUpdatedAt: "new-value"
  };
  const failingScope = {
    chillProsDb: {},
    FIELD_FORGED_CONFIG: { tenant: { id: "chill-pros" } },
    localStorage: {
      getItem() {
        return JSON.stringify([{
          id: "customer-1",
          officeStatus: "Scheduled",
          assignedTechnician: "",
          scheduledDate: "2026-07-29"
        }]);
      }
    },
    CustomEvent: TestCustomEvent,
    dispatchEvent(event) {
      rollbackEvents.push(event);
    },
    chillProsCustomerMutations: {
      async updateCustomer() {
        throw new Error("batch commit rejected");
      },
      async deleteCustomer() {}
    },
    async updateCustomerInFirebase() {},
    async deleteCustomerFromFirebase() {}
  };
  installBridge(failingScope);
  await assert.rejects(
    failingScope.updateCustomerInFirebase(failingRecord, {
      officeStatus: "Dispatched",
      assignedTechnician: "Brae",
      statusUpdatedAt: "new-value"
    }),
    /batch commit rejected/
  );
  assert.deepEqual(failingRecord, {
    id: "customer-1",
    officeStatus: "Scheduled",
    assignedTechnician: ""
  });
  assert.equal(rollbackEvents.length, 1);
  assert.equal(rollbackEvents[0].type, "chillpros:customer-mutation-rollback");
  assert.deepEqual(rollbackEvents[0].detail.changedFields, ["officeStatus", "assignedTechnician", "statusUpdatedAt"]);
  assert.equal(rollbackEvents[0].detail.error, "batch commit rejected");

  const malformedScope = {
    FIELD_FORGED_CONFIG: { tenant: { id: "chill-pros" } },
    localStorage: { getItem: () => "not-json" }
  };
  assert.equal(readStoredRecord(malformedScope, { id: "customer-1" }), null);

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
    document: { readyState: "loading" },
    addEventListener(name, callback, options) {
      assert.equal(name, "DOMContentLoaded");
      assert.deepEqual(options, { once: true });
      listener = callback;
    },
    async updateCustomerInFirebase() {},
    async deleteCustomerFromFirebase() {}
  };
  assert.equal(installAfterAppLoads(eventScope), null);
  assert.equal(typeof listener, "function");
  listener();
  assert.notEqual(eventScope.updateCustomerInFirebase.name, "updateCustomerInFirebase");

  let lateListenerRegistered = false;
  const readyScope = {
    document: { readyState: "complete" },
    addEventListener() {
      lateListenerRegistered = true;
    },
    async updateCustomerInFirebase() {},
    async deleteCustomerFromFirebase() {}
  };
  const readyInstall = installAfterAppLoads(readyScope);
  assert.equal(readyInstall, readyScope[INSTALL_MARKER]);
  assert.equal(lateListenerRegistered, false);

  assert.throws(() => installBridge({}), /Legacy customer mutation functions are unavailable/);
  assert.throws(() => installAfterAppLoads(null), /Browser scope is required/);
  assert.throws(() => installAfterAppLoads({ document: { readyState: "loading" } }), /Browser event target is required/);
}

run()
  .then(() => console.log("app audited mutation bridge tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });