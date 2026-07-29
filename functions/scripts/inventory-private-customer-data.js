"use strict";

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const SENSITIVE_FIELDS = Object.freeze([
  "internalCost",
  "cost",
  "unitCost",
  "supplierCost",
  "supplierPrice",
  "supplierPricing",
  "markup",
  "margin",
  "grossMargin",
  "profit",
  "profitAmount",
  "supplier",
  "supplierNotes",
  "procurementNotes",
  "priceOverrideJustification",
  "priceOverrideApproval",
  "priceOverrideApprovedBy",
  "priceOverrideApprovedAt",
]);

function findSensitiveFields(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return [];
  return SENSITIVE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(record, field));
}

function parseArgs(argv) {
  const options = { projectId: "", output: "json" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--project") options.projectId = argv[index + 1] || "";
    if (argument === "--output") options.output = argv[index + 1] || "json";
  }
  if (!options.projectId) {
    throw new Error("Missing required --project <firebase-project-id> argument.");
  }
  if (!new Set(["json", "summary"]).has(options.output)) {
    throw new Error("--output must be either json or summary.");
  }
  return options;
}

async function inventoryCustomerRecords(db) {
  const snapshot = await db.collection("Customers").get();
  const affected = [];

  snapshot.forEach((document) => {
    const fields = findSensitiveFields(document.data());
    if (fields.length > 0) {
      affected.push({ path: document.ref.path, fields });
    }
  });

  return {
    scannedRecords: snapshot.size,
    affectedRecords: affected.length,
    affected,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  initializeApp({ credential: applicationDefault(), projectId: options.projectId });
  const result = await inventoryCustomerRecords(getFirestore());

  if (options.output === "summary") {
    console.log(`Scanned ${result.scannedRecords} customer records.`);
    console.log(`Found ${result.affectedRecords} records containing sensitive parent fields.`);
    result.affected.forEach(({ path, fields }) => console.log(`- ${path}: ${fields.join(", ")}`));
    return;
  }

  console.log(JSON.stringify({ projectId: options.projectId, dryRun: true, ...result }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Inventory failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  SENSITIVE_FIELDS,
  findSensitiveFields,
  inventoryCustomerRecords,
  parseArgs,
};
