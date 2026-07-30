"use strict";

const assert = require("node:assert/strict");
const { createAuditEventWriter, normalizeMetadata } = require("../audit-events.js");

function createHarness({ role = "owner", profileExists = true, uid = "owner-1" } = {}) {
  const writes = [];
  const db = {
    collection(name) {
      if (name === "Users") {
        return {
          doc(requestedUid) {
            assert.equal(requestedUid, uid);
            return {
              async get() {
                return {
                  exists: profileExists,
                  data: () => ({ role })
                };
              }
            };
          }
        };
      }
      if (name === "AuditEvents") {
        return {
          async add(payload) {
            writes.push(payload);
            return { id: "audit-1" };
          }
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }
  };

  return {
    writes,
    writeAuditEvent: createAuditEventWriter({
      db,
      auth: { currentUser: uid ? { uid } : null },
      serverTimestamp: () => "SERVER_TIMESTAMP"
    })
  };
}

async function assertRejectsMessage(promise, pattern) {
  await assert.rejects(promise, pattern);
}

(async () => {
  {
    const { writes, writeAuditEvent } = createHarness({ role: "owner" });
    const id = await writeAuditEvent({
      action: "customer.status_changed",
      targetPath: "Customers/customer-1",
      metadata: { previousStatus: "Scheduled", nextStatus: "Completed", omitted: undefined }
    });

    assert.equal(id, "audit-1");
    assert.deepEqual(writes, [{
      actorUid: "owner-1",
      actorRole: "owner",
      action: "customer.status_changed",
      targetPath: "Customers/customer-1",
      createdAt: "SERVER_TIMESTAMP",
      metadata: { previousStatus: "Scheduled", nextStatus: "Completed" }
    }]);
  }

  {
    const { writeAuditEvent } = createHarness({ role: "office" });
    await writeAuditEvent({ action: "customer.deleted", targetPath: "Customers/customer-2" });
  }

  {
    const { writeAuditEvent } = createHarness({ role: "technician" });
    await assertRejectsMessage(
      writeAuditEvent({ action: "customer.updated", targetPath: "Customers/customer-3" }),
      /Only owner or office/
    );
  }

  {
    const { writeAuditEvent } = createHarness({ profileExists: false });
    await assertRejectsMessage(
      writeAuditEvent({ action: "customer.updated", targetPath: "Customers/customer-4" }),
      /Authoritative user profile/
    );
  }

  {
    const { writeAuditEvent } = createHarness({ uid: "" });
    await assertRejectsMessage(
      writeAuditEvent({ action: "customer.updated", targetPath: "Customers/customer-5" }),
      /Authenticated user/
    );
  }

  assert.throws(() => normalizeMetadata([]), /plain object/);
  assert.throws(() => normalizeMetadata(new Date()), /plain object/);
  assert.throws(
    () => normalizeMetadata(new (class AuditMetadata { constructor() { this.changedField = "status"; } })()),
    /plain object/
  );
  const nullPrototypeMetadata = Object.create(null);
  nullPrototypeMetadata.changedField = "status";
  assert.deepEqual(normalizeMetadata(nullPrototypeMetadata), { changedField: "status" });
  assert.throws(
    () => normalizeMetadata({ actorUid: "forged-owner", changedFields: ["internalCost"] }),
    /metadata\.actorUid/
  );
  assert.throws(
    () => normalizeMetadata({ action: "customer.deleted", createdAt: "forged-time" }),
    /metadata\.action, metadata\.createdAt/
  );
  assert.throws(
    () => normalizeMetadata({ accessToken: "should-not-be-logged", changedFields: ["status"] }),
    /metadata\.accessToken/
  );
  assert.throws(
    () => normalizeMetadata({ AUTHORIZATION: "Bearer secret" }),
    /metadata\.AUTHORIZATION/
  );
  assert.throws(
    () => normalizeMetadata({ seed_phrase: "should-not-be-logged" }),
    /metadata\.seed_phrase/
  );
  assert.throws(
    () => normalizeMetadata({ request: { headers: { authorization: "Bearer secret" } } }),
    /metadata\.request\.headers\.authorization/
  );
  assert.throws(
    () => normalizeMetadata({ attempts: [{ context: { refreshToken: "secret" } }] }),
    /metadata\.attempts\[0\]\.context\.refreshToken/
  );
  assert.throws(
    () => normalizeMetadata({ request: { actorRole: "owner" } }),
    /metadata\.request\.actorRole/
  );
  assert.throws(
    () => normalizeMetadata({ context: { happenedAt: new Date() } }),
    /must contain only plain objects and arrays/
  );
  const circular = { source: "operations-center" };
  circular.self = circular;
  assert.throws(() => normalizeMetadata(circular), /circular references/);
  assert.throws(
    () => normalizeMetadata({ a: { b: { c: { d: { e: { f: "too deep" } } } } } }),
    /5 nested levels/
  );
  assert.deepEqual(
    normalizeMetadata({ actorUid: undefined, changedFields: ["status"] }),
    { changedFields: ["status"] }
  );
  assert.throws(
    () => normalizeMetadata(Object.fromEntries(Array.from({ length: 26 }, (_, index) => [`key${index}`, index]))),
    /25 keys/
  );

  console.log("Audit event client tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
