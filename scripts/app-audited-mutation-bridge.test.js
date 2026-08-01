"use strict";

const assert = require("node:assert/strict");
const {
  INSTALL_MARKER,
  classifyUpdateAction,
  getQueueStorageKey,
  installAfterAppLoads,
  installBridge,
  readStoredRecord,
  reconcileRollback,
  requireGateway,
  restoreChangedFields,
  snapshotChangedFields
} = require("../app-audited-mutation-bridge.js");

function makeGateway(calls, overrides = {}) {
  return {
    async createCustomer(record, options) {
      calls.push(["create", record, options]);
      return "customer-created";
    },
    async updateCustomer(record, changes, options) {
      calls.push(["update", record, changes, options]);
      return "audit-update";
    },
    async deleteCustomer(record, options) {
      calls.push(["delete", record, options]);
      return "audit-delete";
    },
    ...overrides
  };
}

async function run() {
  assert.equal(classifyUpdateAction({ officeStatus: "Scheduled" }), "customer.status.updated");
  assert.equal(classifyUpdateAction({ assignedTechnician: "Brae" }), "customer.schedule.updated");
  assert.equal(classifyUpdateAction({ scheduledDate: "2026-07-29" }), "customer.schedule.updated");
  assert.equal(classifyUpdateAction({ findings: "Failed relay" }), "customer.updated");

  assert.throws(() => requireGateway({}), /gateway is unavailable/);
  assert.throws(
    () => requireGateway({ chillProsCustomerMutations: { updateCustomer() {}, deleteCustomer() {} } }),
    /gateway is unavailable/
  );
  assert.equal(getQueueStorageKey({ FIELD_FORGED_CONFIG: { tenant: { id: "chill-pros" } } }), "fieldForged:chill-pros:operations-center:v3");
  assert.equal(getQueueStorageKey({}), "");
  assert.equal(reconcileRollback({}), false);

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
    chillProsCustomerMutations: makeGateway(calls),
    async saveCustomerToFirebase() {
      calls.push(["legacy-create"]);
    },
    async updateCustomerInFirebase() {
      calls.push(["legacy-update"]);
    },
    async deleteCustomerFromFirebase() {
      calls.push(["legacy-delete"]);
    }
  };

  const firstInstall = installBridge(scope);
  const wrappedCreate = scope.saveCustomerToFirebase;
  const wrappedUpdate = scope.updateCustomerInFirebase;
  const wrappedDelete = scope.deleteCustomerFromFirebase;
  const secondInstall = installBridge(scope);
  assert.equal(secondInstall, firstInstall);
  assert.equal(scope.saveCustomerToFirebase, wrappedCreate);
  assert.equal(scope.updateCustomerInFirebase, wrappedUpdate);
  assert.equal(scope.deleteCustomerFromFirebase, wrappedDelete);
  assert.equal(scope[INSTALL_MARKER], firstInstall);
  assert.equal(Object.isFrozen(firstInstall), true);

  const intakeRecord = { id: "local-customer-1", customerName: "Tony's Pizza" };
  assert.equal(await scope.saveCustomerToFirebase(intakeRecord), "customer-created");
  assert.deepEqual(calls[0], [
    "create",
    intakeRecord,
    {
      action: "customer.created",
      source: "operations-center-app",
      metadata: { workflow: "customer-intake" }
    }
  ]);

  const record = { id: "customer-1", officeStatus: "Scheduled" };
  const changes = { officeStatus: "Scheduled", statusUpdatedAt: "2026-07-29T15:00:00.000Z" };
  assert.equal(await scope.updateCustomerInFirebase(record, changes), "audit-update");
  assert.equal(await scope.deleteCustomerFromFirebase(record), "audit-delete");
  assert.deepEqual(calls[1], [
    "update",
    record,
    changes,
    {
      action: "customer.status.updated",
      source: "operations-center-app",
      metadata: { workflow: "office-queue" }
    }
  ]);
  assert.deepEqual(calls[2], [
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
  const reconciliationSnapshots = [];
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
    persistQueue() {
      reconciliationSnapshots.push({ ...failingRecord });
    },
    CustomEvent: TestCustomEvent,
    dispatchEvent(event) {
      rollbackEvents.push(event);
    },
    chillProsCustomerMutations: makeGateway([], {
      async updateCustomer() {
        throw new Error("batch commit rejected");
      }
    }),
    async saveCustomerToFirebase() {},
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
  assert.deepEqual(reconciliationSnapshots, [{
    id: "customer-1",
    officeStatus: "Scheduled",
    assignedTechnician: ""
  }]);
  assert.equal(rollbackEvents.length, 1);
  assert.equal(rollbackEvents[0].type, "chillpros:customer-mutation-rollback");
  assert.deepEqual(rollbackEvents[0].detail.changedFields, ["officeStatus", "assignedTechnician", "statusUpdatedAt"]);
  assert.equal(rollbackEvents[0].detail.error, "batch commit rejected");

  const createFailureScope = {
    chillProsDb: {},
    chillProsCustomerMutations: makeGateway([], {
      async createCustomer() {
        throw new Error("create batch rejected");
      }
    }),
    async saveCustomerToFirebase() {},
    async updateCustomerInFirebase() {},
    async deleteCustomerFromFirebase() {}
  };
  installBridge(createFailureScope);
  await assert.rejects(
    createFailureScope.saveCustomerToFirebase({ id: "local-intake" }),
    /create batch rejected/
  );

  const reconciliationError = console.error;
  const reconciliationLogs = [];
  console.error = (...args) => reconciliationLogs.push(args);
  try {
    assert.equal(reconcileRollback({ persistQueue() { throw new Error("storage unavailable"); } }), false);
  } finally {
    console.error = reconciliationError;
  }
  assert.equal(reconciliationLogs.length, 1);
  assert.match(reconciliationLogs[0][0], /Unable to reconcile/);

  const malformedScope = {
    FIELD_FORGED_CONFIG: { tenant: { id: "chill-pros" } },
    localStorage: { getItem: () => "not-json" }
  };
  assert.equal(readStoredRecord(malformedScope, { id: "customer-1" }), null);

  const localCalls = [];
  const localScope = {
    chillProsDb: null,
    async saveCustomerToFirebase(recordValue) {
      localCalls.push(["create", recordValue]);
      return "local-create";
    },
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
  assert.equal(await localScope.saveCustomerToFirebase(intakeRecord), "local-create");
  assert.equal(await localScope.updateCustomerInFirebase(record, changes), "local-update");
  assert.equal(await localScope.deleteCustomerFromFirebase(record), "local-delete");
  assert.equal(localCalls.length, 3);

  let listener;
  const eventScope = {
    document: { readyState: "loading" },
    addEventListener(name, callback, options) {
      assert.equal(name, "DOMContentLoaded");
      assert.deepEqual(options, { once: true });
      listener = callback;
    },
    async saveCustomerToFirebase() {},
    async updateCustomerInFirebase() {},
    async deleteCustomerFromFirebase() {}
  };
  assert.equal(installAfterAppLoads(eventScope), null);
  assert.equal(typeof listener, "function");
  listener();
  assert.notEqual(eventScope.saveCustomerToFirebase.name, "saveCustomerToFirebase");
  assert.notEqual(eventScope.updateCustomerInFirebase.name, "updateCustomerInFirebase");

  let lateListenerRegistered = false;
  const readyScope = {
    document: { readyState: "complete" },
    addEventListener() {
      lateListenerRegistered = true;
    },
    async saveCustomerToFirebase() {},
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
