"use strict";

const assert = require("node:assert/strict");
const { createAuditedCustomerMutations, requireDocumentId } = require("../audited-customer-mutations.js");

function createHarness({ role = "owner", profileExists = true, uid = "owner-1", commitError = null } = {}) {
  const operations = [];
  let auditSequence = 0;
  const db = {
    collection(name) {
      return {
        doc(id) {
          if (name === "Users") {
            assert.equal(id, uid);
            return {
              async get() {
                return { exists: profileExists, data: () => ({ role }) };
              }
            };
          }
          if (name === "AuditEvents" && id === undefined) {
            auditSequence += 1;
            return { path: `AuditEvents/audit-${auditSequence}`, id: `audit-${auditSequence}` };
          }
          return { path: `${name}/${id}`, id };
        }
      };
    },
    batch() {
      const staged = [];
      return {
        set(reference, payload, options) {
          staged.push({ type: "set", path: reference.path, payload, options });
        },
        delete(reference) {
          staged.push({ type: "delete", path: reference.path });
        },
        async commit() {
          if (commitError) throw commitError;
          operations.push(...staged);
        }
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
    const auditId = await mutations.updateCustomer(
      "customer-1",
      { officeStatus: "Completed" },
      {
        action: "customer.status_changed",
        metadata: { previousStatus: "In Progress", nextStatus: "Completed", omitted: undefined }
      }
    );

    assert.equal(auditId, "audit-1");
    assert.deepEqual(operations, [
      {
        type: "set",
        path: "Customers/customer-1",
        payload: { officeStatus: "Completed" },
        options: { merge: true }
      },
      {
        type: "set",
        path: "AuditEvents/audit-1",
        payload: {
          actorUid: "owner-1",
          actorRole: "owner",
          action: "customer.status_changed",
          targetPath: "Customers/customer-1",
          createdAt: "SERVER_TIMESTAMP",
          metadata: { previousStatus: "In Progress", nextStatus: "Completed" }
        },
        options: undefined
      }
    ]);
  }

  {
    const { operations, mutations } = createHarness({ role: "office", uid: "office-1" });
    await mutations.deleteCustomer("customer-2", { metadata: { customerName: "Example" } });
    assert.deepEqual(operations.map(({ type, path }) => ({ type, path })), [
      { type: "delete", path: "Customers/customer-2" },
      { type: "set", path: "AuditEvents/audit-1" }
    ]);
    assert.equal(operations[1].payload.action, "customer.deleted");
    assert.equal(operations[1].payload.actorRole, "office");
  }

  {
    const { mutations } = createHarness({ role: "technician" });
    await assert.rejects(
      mutations.updateCustomer("customer-3", { officeStatus: "Paused" }),
      /Only owner or office/
    );
  }

  {
    const { mutations } = createHarness({ profileExists: false });
    await assert.rejects(
      mutations.deleteCustomer("customer-4"),
      /Authoritative user profile/
    );
  }

  {
    const { operations, mutations } = createHarness({ commitError: new Error("batch failed") });
    await assert.rejects(
      mutations.updateCustomer("customer-5", { assignedTechnician: "Tech One" }),
      /batch failed/
    );
    assert.deepEqual(operations, []);
  }

  assert.throws(() => requireDocumentId(""), /required/);
  assert.throws(() => requireDocumentId("Customers/customer-1"), /slash/);

  console.log("Audited customer mutation tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
