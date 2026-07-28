"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const tenantConfig = fs.readFileSync(path.join(root, "tenant-config.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "completed-reports-export.js"), "utf8");

const csvLoaderIndex = tenantConfig.indexOf('csv-export.js?v=20260728-1');
const runtimeLoaderIndex = tenantConfig.indexOf('completed-reports-export.js?v=20260728-1');
assert.ok(csvLoaderIndex >= 0, "tenant-config must load the spreadsheet-safe CSV utility");
assert.ok(runtimeLoaderIndex > csvLoaderIndex, "completed reports runtime must load after csv-export.js");
assert.match(runtimeSource, /Secure CSV export utility is unavailable/, "runtime must fail closed without the secure utility");
assert.match(runtimeSource, /stopImmediatePropagation\(\)/, "runtime must suppress the legacy export listener");
assert.match(runtimeSource, /capture:\s*true/, "secure export listener must run in the capture phase");
assert.match(runtimeSource, /filteredCompletedJobs/, "runtime must export the currently filtered report dataset");

const capturedListeners = [];
const downloads = [];
const exportButton = {
  addEventListener(type, handler, options) {
    capturedListeners.push({ type, handler, options });
  }
};

class TestBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
}

const context = {
  console,
  Blob: TestBlob,
  URL: {
    createObjectURL(blob) {
      context.lastBlob = blob;
      return "blob:test";
    },
    revokeObjectURL() {}
  },
  document: {
    getElementById(id) {
      return id === "exportCompletedReports" ? exportButton : null;
    },
    createElement(tag) {
      assert.equal(tag, "a");
      return {
        click() {
          downloads.push({ href: this.href, download: this.download });
        }
      };
    }
  },
  ChillProsCsvExport: require(path.join(root, "csv-export.js")),
  filteredCompletedJobs: [
    {
      customerName: "=HYPERLINK(\"https://example.invalid\")",
      completedAt: "2026-07-28T10:00:00.000Z",
      assignedTechnician: "+Brae Morrison",
      equipmentType: "HVAC",
      manufacturer: "Carrier",
      modelNumber: "ABC123",
      address: "123 Main St",
      findings: "@SUM(1,1)",
      recommendation: "Replace board",
      estimatedAmount: "-400"
    }
  ]
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(runtimeSource, context, { filename: "completed-reports-export.js" });

assert.equal(capturedListeners.length, 1, "runtime must register one export listener");
assert.equal(capturedListeners[0].type, "click");
assert.equal(capturedListeners[0].options.capture, true);

const csv = context.ChillProsCompletedReportsExport.buildCompletedJobsCsv(context.filteredCompletedJobs);
assert.match(csv, /"'=HYPERLINK/);
assert.match(csv, /"'\+Brae Morrison"/);
assert.match(csv, /"'@SUM\(1,1\)"/);
assert.match(csv, /"'-400"/);

let prevented = false;
let stopped = false;
capturedListeners[0].handler({
  preventDefault() { prevented = true; },
  stopImmediatePropagation() { stopped = true; }
});
assert.equal(prevented, true);
assert.equal(stopped, true);
assert.equal(downloads.length, 1, "secure handler must initiate one download");
assert.equal(context.lastBlob.options.type, "text/csv;charset=utf-8;");
assert.match(context.lastBlob.parts[0], /"'=HYPERLINK/);

console.log("Completed reports secure CSV runtime contract passed.");
