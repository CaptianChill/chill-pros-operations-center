"use strict";

const assert = require("node:assert/strict");
const {
  createBrowserQueueMutationIntegration,
  createQueueMutationIntegration,
  requireRecordDocumentId,
  summarizeChangedFields
} = require("../customer-mutation-integration.js");

async function run() {
  assert.equal(requireRecordDocumentId({ firestoreId: " firestore-1 ", id: "local-1" }), "firestore-1");
  assert.equal(requireRecordDocumentId({ id: " local-1 " }), "local-1");
  assert.throws(() => requireRecordDocumentId({}), /document ID is required/);

  assert.deepEqual(summarizeChangedFields({ z: 1, officeStatus: "Scheduled" }), ["officeStatus", "z"]);
  assert.throws(() => summarizeChangedFields([]), /plain object/);

  const calls = [];
  const adapter = {
    async updateCustomer(documentId, changes, options) {
      calls.push({ type: "update", documentId, changes, options });
      return "audit-update-1";
    },
    async deleteCustomer(documentId, options) {
      calls.push({ type: "delete", documentId, options });
      return "audit-delete-1";
    }
  };

  const integration = createQueueMutationIntegration({ adapter });
  const record = { id: "customer-1" };
  const updateAuditId = await integration.updateCustomer(
    record,
    { officeStatus: "Scheduled", statusUpdatedAt: "2026-07-29T12:00:00.000Z" },
    { action: "customer.status.changed", source: "office-queue", metadata: { previousStatus: "Needs Review" } }
  );

  assert.equal(updateAuditId, "audit-update-1");
  assert.equal(record.firestoreId, "customer-1");
  assert.deepEqual(calls[0], {
    type: "update",
    documentId: "customer-1",
    changes: { officeStatus: "Scheduled", statusUpdatedAt: "2026-07-29T12:00:00.000Z" },
    options: {
      action: "customer.status.changed",
      metadata: {
        source: "office-queue",
        changedFields: ["officeStatus", "statusUpdatedAt"],
        previousStatus: "Needs Review"
      }
    }
  });

  const deleteAuditId = await integration.deleteCustomer(
    { firestoreId: "customer-2" },
    { source: "office-queue", metadata: { customerName: "Example" } }
  );
  assert.equal(deleteAuditId, "audit-delete-1");
  assert.deepEqual(calls[1], {
    type: "delete",
    documentId: "customer-2",
    options: { metadata: { source: "office-queue", customerName: "Example" } }
  });

  await assert.rejects(() => integration.updateCustomer(record, {}), /changes are required/);
  assert.throws(
    () => createQueueMutationIntegration({ adapter: {} }),
    /adapter is required/
  );

  let receivedScope;
  const browserScope = {
    ChillProsCustomerMutationAdapter: {
      createBrowserCustomerMutationAdapter(scope) {
        receivedScope = scope;
        return adapter;
      }
    }
  };
  const browserIntegration = createBrowserQueueMutationIntegration(browserScope);
  assert.equal(receivedScope, browserScope);
  await browserIntegration.deleteCustomer({ id: "customer-3" });
  assert.equal(calls[2].documentId, "customer-3");

  assert.throws(
    () => createBrowserQueueMutationIntegration({}),
    /factory is unavailable/
  );

  console.log("customer mutation integration tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
