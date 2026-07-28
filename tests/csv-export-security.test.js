"use strict";

const assert = require("node:assert/strict");
const { neutralizeSpreadsheetFormula, asCsvCell } = require("../csv-export.js");

const dangerousValues = [
  "=SUM(A1:A2)",
  "+cmd|' /C calc'!A0",
  "-2+3+cmd|' /C calc'!A0",
  "@SUM(1+1)"
];

for (const value of dangerousValues) {
  assert.equal(neutralizeSpreadsheetFormula(value), `'${value}`);
  assert.ok(asCsvCell(value).startsWith("\"'"), `Expected formula prefix to be neutralized: ${value}`);
}

assert.equal(neutralizeSpreadsheetFormula(" normal text"), " normal text");
assert.equal(neutralizeSpreadsheetFormula("123.45"), "123.45");
assert.equal(asCsvCell('quoted "value"'), '"quoted ""value"""');
assert.equal(asCsvCell("line1\nline2"), '"line1\nline2"');

console.log("CSV export security contract passed");
