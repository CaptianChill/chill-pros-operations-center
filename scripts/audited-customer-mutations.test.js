"use strict";

const assert = require("node:assert/strict");
const {
  createAuditedCustomerMutations,
  normalizeMetadata,
  requireBoundedString,
  requireDocumentId,
  requirePlainObject
} = require("../audited-customer-mutations.js");

function createHarness({ role = "owner", profileExists = true, uid = "owner-1", commitError = null } = {}) {
  const operations = [];
  let auditSequence = 0;
  let customerSequence = 0;
  const db = {
    collection(name) {
      return {
        doc(id) {
          if (name === "Users") return { async get() { assert.equal(id, uid); return { exists: profileExists, data: () => ({ role }) }; } };
          if (name === "Customers" && id === undefined) return { path: `Customers/customer-${++customerSequence}`, id: `customer-${customerSequence}` };
          if (name === "AuditEvents" && id === undefined) return { path: `AuditEvents/audit-${++auditSequence}`, id: `audit-${auditSequence}` };
          return { path: `${name}/${id}`, id };
        }
      };
    },
    batch() {
      const staged = [];
      return {
        set(reference, payload, options) { staged.push({ type: "set", path: reference.path, payload, options }); },
        delete(reference) { staged.push({ type: "delete", path: reference.path }); },
        async commit() { if (commitError) throw commitError; operations.push(...staged); }
      };
    }
  };
  return {
    operations,
    mutations: createAuditedCustomerMutations({
      db,
      auth: { currentUser: uid ? { uid } : null },
      serverTimestamp: () => "SERVER_TIMESTAMP"
    })
  };
}

(async () => {
  {
    const { operations, mutations } = createHarness();
    const customerId = await mutations.createCustomer(
      { customerName: "Example Customer", officeStatus: "Needs Review" },
      { metadata: { source: "operations-center-app", workflow: "customer-intake", changedFields: ["customerName", "officeStatus"] } }
    );
    assert.equal(customerId, "customer-1");
    assert.equal(operations.length, 2);
    assert.deepEqual(operations[1].payload.metadata, {
      source: "operations-center-app",
      workflow: "customer-intake",
      changedFields: ["customerName", "officeStatus"]
    });
  }

  {
    const { operations, mutations } = createHarness();
    const auditId = await mutations.updateCustomer(
      "customer-1",
      { officeStatus: "Completed" },
      { action: "customer.status_changed", metadata: { workflow: "office-queue", context: "completion", changedFields: ["officeStatus"] } }
    );
    assert.equal(auditId, "audit-1");
    assert.equal(operations[0].path, "Customers/customer-1");
    assert.equal(operations[1].payload.action, "customer.status_changed");
  }

  {
    const { operations, mutations } = createHarness({ role: "office", uid: "office-1" });
    await mutations.deleteCustomer("customer-2", { metadata: { workflow: "office-queue" } });
    assert.deepEqual(operations.map(({ type, path }) => ({ type, path })), [
      { type: "delete", path: "Customers/customer-2" },
      { type: "set", path: "AuditEvents/audit-1" }
    ]);
  }

  await assert.rejects(createHarness({ role: "technician" }).mutations.createCustomer({ customerName: "Blocked" }), /Only owner or office/);
  await assert.rejects(createHarness({ profileExists: false }).mutations.deleteCustomer("customer-4"), /Authoritative user profile/);

  {
    const { operations, mutations } = createHarness({ commitError: new Error("batch failed") });
    await assert.rejects(mutations.createCustomer({ customerName: "Atomic failure" }), /batch failed/);
    assert.deepEqual(operations, []);
  }

  {
    const { operations, mutations } = createHarness();
    await assert.rejects(
      mutations.updateCustomer("customer-7", { officeStatus: "Completed" }, { metadata: { previousStatus: "In Progress" } }),
      /unsupported fields: previousStatus/
    );
    await assert.rejects(
      mutations.updateCustomer("customer-7", { officeStatus: "Completed" }, { metadata: { changedFields: Array.from({ length: 26 }, (_, index) => `field${index}`) } }),
      /exceeds 25 entries/
    );
    await assert.rejects(
      mutations.deleteCustomer("customer-7", { metadata: { context: { authorization: "Bearer secret" } } }),
      /metadata\.context/
    );
    assert.deepEqual(operations, []);
  }

  assert.equal(requireBoundedString(" customer.updated ", "action", 100), "customer.updated");
  assert.throws(() => requireDocumentId(""), /required/);
  assert.throws(() => requireDocumentId("Customers/customer-1"), /slash/);
  assert.deepEqual(requirePlainObject({ ok: true }, "payload"), { ok: true });
  assert.throws(() => requirePlainObject([], "payload"), /plain object/);
  assert.deepEqual(normalizeMetadata({ workflow: "customer-intake", omitted: undefined }), { workflow: "customer-intake" });
  assert.throws(() => normalizeMetadata({ customerName: "Example" }), /unsupported fields: customerName/);
  assert.throws(() => normalizeMetadata({ changedFields: "officeStatus" }), /must be an array/);
  assert.throws(() => normalizeMetadata({ context: "x".repeat(501) }), /metadata\.context exceeds 500/);

  console.log("Audited customer mutation tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});