"use strict";

const assert = require("node:assert/strict");
const {
  SENSITIVE_FIELDS,
  findSensitiveFields,
  parseArgs,
} = require("./inventory-private-customer-data");

assert(SENSITIVE_FIELDS.includes("internalCost"));
assert(SENSITIVE_FIELDS.includes("supplierPricing"));
assert.deepEqual(findSensitiveFields(null), []);
assert.deepEqual(findSensitiveFields([]), []);
assert.deepEqual(findSensitiveFields({ customerName: "Test", salePrice: 125 }), []);
assert.deepEqual(
  findSensitiveFields({ internalCost: 40, markup: 2.5, customerTotal: 100 }),
  ["internalCost", "markup"],
);
assert.deepEqual(
  findSensitiveFields({ supplierNotes: "Call vendor", priceOverrideApprovedBy: "owner-uid" }),
  ["supplierNotes", "priceOverrideApprovedBy"],
);
assert.deepEqual(
  findSensitiveFields({
    quote: { internalCost: 70, customerPrice: 150 },
    parts: [
      { description: "Compressor", supplierCost: 45 },
      { description: "Gasket", pricing: { margin: 0.35 } },
    ],
  }),
  ["quote.internalCost", "parts[0].supplierCost", "parts[1].pricing.margin"],
);
const circular = { customerName: "Circular" };
circular.self = circular;
circular.pricing = { profit: 25 };
assert.deepEqual(findSensitiveFields(circular), ["pricing.profit"]);
assert.deepEqual(parseArgs(["--project", "demo-project"]), {
  projectId: "demo-project",
  output: "json",
});
assert.deepEqual(parseArgs(["--output", "summary", "--project", "demo-project"]), {
  projectId: "demo-project",
  output: "summary",
});
assert.throws(() => parseArgs([]), /Missing required --project/);
assert.throws(
  () => parseArgs(["--project", "demo-project", "--output", "csv"]),
  /--output must be either json or summary/,
);

console.log("Private customer data inventory helper tests passed.");
