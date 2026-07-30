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
          if (name === "Users") {
            assert.equal(id, uid);
            return {
              async get() {
                return { exists: profileExists, data: () => ({ role }) };
              }
            };
          }
          if (name === "Customers" && id === undefined) {
            customerSequence += 1;
            return { path: `Customers/customer-${customerSequence}`, id: `customer-${customerSequence}` };
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
    const customerId = await mutations.createCustomer(
      { customerName: "Example Customer", officeStatus: "Needs Review" },
      { metadata: { workflow: "customer-intake", omitted: undefined } }
    );

    assert.equal(customerId, "customer-1");
    assert.deepEqual(operations, [
      {
        type: "set",
        path: "Customers/customer-1",
        payload: { customerName: "Example Customer", officeStatus: "Needs Review" },
        options: undefined
      },
      {
        type: "set",
        path: "AuditEvents/audit-1",
        payload: {
          actorUid: "owner-1",
          actorRole: "owner",
          action: "customer.created",
          targetPath: "Customers/customer-1",
          createdAt: "SERVER_TIMESTAMP",
          metadata: { workflow: "customer-intake" }
        },
        options: undefined
      }
    ]);
  }

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
      mutations.createCustomer({ customerName: "Blocked" }),
      /Only owner or office/
    );
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
      mutations.createCustomer({ customerName: "Atomic failure" }),
      /batch failed/
    );
    await assert.rejects(
      mutations.updateCustomer("customer-5", { assignedTechnician: "Tech One" }),
      /batch failed/
    );
    assert.deepEqual(operations, []);
  }

  {
    const { operations, mutations } = createHarness();
    await assert.rejects(mutations.createCustomer(null), /plain object/);
    await assert.rejects(mutations.createCustomer({}), /Customer record is required/);
    await assert.rejects(
      mutations.updateCustomer("customer-6", { officeStatus: "Paused" }, { action: "   " }),
      /action is required/
    );
    await assert.rejects(
      mutations.updateCustomer("customer-6", { officeStatus: "Paused" }, { action: "x".repeat(101) }),
      /action exceeds 100 characters/
    );
    assert.deepEqual(operations, []);
  }

  {
    const { operations, mutations } = createHarness();
    await assert.rejects(
      mutations.updateCustomer("x".repeat(491), { officeStatus: "Paused" }),
      /targetPath exceeds 500 characters/
    );
    assert.deepEqual(operations, []);
  }

  {
    const { operations, mutations } = createHarness();
    await assert.rejects(
      mutations.updateCustomer(
        "customer-7",
        { officeStatus: "Completed" },
        { metadata: { actorUid: "forged-owner" } }
      ),
      /metadata\.actorUid/
    );
    await assert.rejects(
      mutations.deleteCustomer(
        "customer-7",
        { metadata: { request: { headers: { authorization: "Bearer secret" } } } }
      ),
      /metadata\.request\.headers\.authorization/
    );
    await assert.rejects(
      mutations.createCustomer(
        { customerName: "Blocked metadata" },
        { metadata: { attempts: [{ refreshToken: "secret" }] } }
      ),
      /metadata\.attempts\[0\]\.refreshToken/
    );
    assert.deepEqual(operations, []);
  }

  assert.equal(requireBoundedString(" customer.updated ", "action", 100), "customer.updated");
  assert.throws(() => requireBoundedString("", "action", 100), /required/);
  assert.throws(() => requireDocumentId(""), /required/);
  assert.throws(() => requireDocumentId("Customers/customer-1"), /slash/);
  assert.deepEqual(requirePlainObject({ ok: true }, "payload"), { ok: true });
  assert.throws(() => requirePlainObject([], "payload"), /plain object/);
  assert.throws(() => requirePlainObject(new Date(), "payload"), /plain object/);
  assert.throws(() => requirePlainObject({}, "payload"), /payload is required/);
  assert.deepEqual(normalizeMetadata({ workflow: "customer-intake", omitted: undefined }), {
    workflow: "customer-intake"
  });
  assert.throws(() => normalizeMetadata(new Date()), /plain object/);
  assert.throws(
    () => normalizeMetadata({ context: { happenedAt: new Date() } }),
    /must contain only plain objects and arrays/
  );
  const circular = { workflow: "customer-intake" };
  circular.self = circular;
  assert.throws(() => normalizeMetadata(circular), /circular references/);
  assert.throws(
    () => normalizeMetadata(Object.fromEntries(Array.from({ length: 26 }, (_, index) => [`key${index}`, index]))),
    /25 keys/
  );
  assert.throws(
    () => normalizeMetadata({
      request: Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`requestKey${index}`, index])),
      response: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`responseKey${index}`, index]))
    }),
    /25 keys total/
  );
  assert.deepEqual(
    normalizeMetadata({
      request: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`requestKey${index}`, index])),
      response: Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`responseKey${index}`, index]))
    }),
    {
      request: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`requestKey${index}`, index])),
      response: Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`responseKey${index}`, index]))
    }
  );

  console.log("Audited customer mutation tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
