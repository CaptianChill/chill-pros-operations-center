"use strict";

const assert = require("node:assert/strict");
const {
  createCustomerMutationAdapter,
  getCustomerMutationAdapter,
  resolveFirebaseDependencies
} = require("../customer-mutation-adapter.js");

function createScope(overrides = {}) {
  const calls = [];
  let factoryCalls = 0;
  const db = { name: "db" };
  const auth = { currentUser: { uid: "owner-1" } };
  const timestamp = { server: true };
  const serverTimestamp = () => timestamp;
  const mutations = {
    async updateCustomer(documentId, changes, options) {
      calls.push({ type: "update", documentId, changes, options });
      return "audit-update";
    },
    async deleteCustomer(documentId, options) {
      calls.push({ type: "delete", documentId, options });
      return "audit-delete";
    }
  };

  const scope = {
    chillProsDb: db,
    chillProsAuth: auth,
    firebase: {
      firestore: { FieldValue: { serverTimestamp } }
    },
    ChillProsAuditedCustomerMutations: {
      createAuditedCustomerMutations(dependencies) {
        factoryCalls += 1;
        assert.equal(dependencies.db, db);
        assert.equal(dependencies.auth, auth);
        assert.equal(dependencies.serverTimestamp, serverTimestamp);
        return mutations;
      }
    },
    ...overrides
  };

  return {
    scope,
    calls,
    db,
    auth,
    serverTimestamp,
    getFactoryCalls: () => factoryCalls
  };
}

async function run() {
  {
    const { scope, db, auth, serverTimestamp } = createScope();
    const dependencies = resolveFirebaseDependencies(scope);
    assert.equal(dependencies.db, db);
    assert.equal(dependencies.auth, auth);
    assert.equal(dependencies.serverTimestamp, serverTimestamp);
  }

  {
    const fallbackAuth = { currentUser: { uid: "office-1" } };
    const { scope } = createScope({
      chillProsAuth: undefined,
      firebase: {
        auth: () => fallbackAuth,
        firestore: { FieldValue: { serverTimestamp: () => ({ server: true }) } }
      }
    });
    assert.equal(resolveFirebaseDependencies(scope).auth, fallbackAuth);
  }

  {
    const { scope, calls } = createScope();
    const adapter = createCustomerMutationAdapter(scope);
    const record = { id: "local-id", firestoreId: "customer-123" };
    const auditId = await adapter.updateCustomer(
      record,
      { officeStatus: "Scheduled" },
      { action: "customer.status.changed", metadata: { previousStatus: "Needs Review" } }
    );

    assert.equal(auditId, "audit-update");
    assert.equal(record.firestoreId, "customer-123");
    assert.deepEqual(calls[0], {
      type: "update",
      documentId: "customer-123",
      changes: { officeStatus: "Scheduled" },
      options: {
        action: "customer.status.changed",
        metadata: { previousStatus: "Needs Review" }
      }
    });
  }

  {
    const { scope, calls } = createScope();
    const adapter = createCustomerMutationAdapter(scope);
    const record = { id: "customer-local" };
    const auditId = await adapter.deleteCustomer(record, { metadata: { source: "officeQueue" } });

    assert.equal(auditId, "audit-delete");
    assert.deepEqual(calls[0], {
      type: "delete",
      documentId: "customer-local",
      options: { metadata: { source: "officeQueue" } }
    });
  }

  {
    const { scope, getFactoryCalls } = createScope();
    const firstAdapter = getCustomerMutationAdapter(scope);
    const secondAdapter = getCustomerMutationAdapter(scope);
    assert.equal(firstAdapter, secondAdapter);
    assert.equal(getFactoryCalls(), 1);
  }

  {
    const first = createScope();
    const second = createScope();
    assert.notEqual(getCustomerMutationAdapter(first.scope), getCustomerMutationAdapter(second.scope));
    assert.equal(first.getFactoryCalls(), 1);
    assert.equal(second.getFactoryCalls(), 1);
  }

  assert.throws(() => getCustomerMutationAdapter(null), /Browser scope is required/);

  for (const [name, scope] of [
    ["Firestore", createScope({ chillProsDb: null }).scope],
    ["Firebase Auth", createScope({ chillProsAuth: null, firebase: {} }).scope],
    ["Firestore server timestamp", createScope({ firebase: { firestore: { FieldValue: {} } } }).scope],
    ["Audited customer mutation helper", createScope({ ChillProsAuditedCustomerMutations: null }).scope]
  ]) {
    assert.throws(() => resolveFirebaseDependencies(scope), new RegExp(`${name}.*unavailable`, "i"));
  }

  console.log("Customer mutation adapter tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
