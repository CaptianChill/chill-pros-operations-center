"use strict";

const assert = require("node:assert/strict");
const { createAuditEventWriter, normalizeMetadata } = require("../audit-events.js");

function createHarness({ role = "owner", profileExists = true, uid = "owner-1" } = {}) {
  const writes = [];
  const db = {
    collection(name) {
      if (name === "Users") {
        return { doc(requestedUid) { return { async get() { assert.equal(requestedUid, uid); return { exists: profileExists, data: () => ({ role }) }; } }; } };
      }
      if (name === "AuditEvents") {
        return { async add(payload) { writes.push(payload); return { id: "audit-1" }; } };
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

(async () => {
  {
    const { writes, writeAuditEvent } = createHarness();
    const id = await writeAuditEvent({
      action: "customer.status_changed",
      targetPath: "Customers/customer-1",
      metadata: {
        source: "operations-center-app",
        workflow: "office-queue",
        context: "status change",
        changedFields: ["officeStatus"],
        omitted: undefined
      }
    });
    assert.equal(id, "audit-1");
    assert.deepEqual(writes[0].metadata, {
      source: "operations-center-app",
      workflow: "office-queue",
      context: "status change",
      changedFields: ["officeStatus"]
    });
  }

  {
    const { writes, writeAuditEvent } = createHarness();
    await writeAuditEvent({
      action: " customer.updated ",
      targetPath: " Customers/customer-1 ",
      metadata: {
        source: " operations-center-app ",
        workflow: " office-queue ",
        context: " status change ",
        changedFields: [" officeStatus "]
      }
    });
    assert.equal(writes[0].action, "customer.updated");
    assert.equal(writes[0].targetPath, "Customers/customer-1");
    assert.deepEqual(writes[0].metadata, {
      source: "operations-center-app",
      workflow: "office-queue",
      context: "status change",
      changedFields: ["officeStatus"]
    });
  }

  await assert.rejects(
    createHarness({ role: "technician" }).writeAuditEvent({ action: "customer.updated", targetPath: "Customers/customer-2" }),
    /Only owner or office/
  );
  await assert.rejects(
    createHarness({ profileExists: false }).writeAuditEvent({ action: "customer.updated", targetPath: "Customers/customer-3" }),
    /Authoritative user profile/
  );
  await assert.rejects(
    createHarness({ uid: "" }).writeAuditEvent({ action: "customer.updated", targetPath: "Customers/customer-4" }),
    /Authenticated user/
  );

  assert.deepEqual(normalizeMetadata({ workflow: "customer-intake", omitted: undefined }), { workflow: "customer-intake" });
  assert.deepEqual(
    normalizeMetadata({ source: " source ", workflow: " workflow ", context: " context ", changedFields: [" field "] }),
    { source: "source", workflow: "workflow", context: "context", changedFields: ["field"] }
  );
  assert.throws(() => normalizeMetadata({ previousStatus: "Scheduled" }), /unsupported fields: previousStatus/);
  assert.throws(() => normalizeMetadata({ workflow: "", context: "valid" }), /metadata\.workflow is required/);
  assert.throws(() => normalizeMetadata({ source: "x".repeat(101) }), /metadata\.source exceeds 100/);
  assert.throws(() => normalizeMetadata({ context: "x".repeat(501) }), /metadata\.context exceeds 500/);
  assert.throws(() => normalizeMetadata({ source: 42 }), /metadata\.source must be a string/);
  assert.throws(() => normalizeMetadata({ context: { authorization: "Bearer secret" } }), /metadata\.context must be a string/);
  assert.throws(() => normalizeMetadata({ context: new Date() }), /metadata\.context must be a string/);
  assert.throws(() => normalizeMetadata({ changedFields: "officeStatus" }), /must be an array/);
  assert.throws(() => normalizeMetadata({ changedFields: Array.from({ length: 26 }, (_, index) => `field${index}`) }), /exceeds 25 entries/);
  assert.throws(() => normalizeMetadata({ changedFields: [""] }), /changedFields\[0\] is required/);
  assert.throws(() => normalizeMetadata({ changedFields: [7] }), /changedFields\[0\] must be a string/);
  assert.throws(() => normalizeMetadata([]), /plain object/);
  assert.throws(() => normalizeMetadata(new Date()), /plain object/);
  assert.throws(() => normalizeMetadata({ actorUid: "forged-owner" }), /unsupported fields: actorUid/);

  console.log("Audit event client tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
