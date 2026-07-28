"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rules = fs.readFileSync(path.resolve(__dirname, "..", "firestore.rules"), "utf8");
const failures = [];

const requiredPatterns = [
  [/function\s+hasUserProfile\(\)/, "profile existence guard"],
  [/function\s+technicianName\(\)/, "technician identity helper"],
  [/function\s+assignedToCurrentTechnician\(data\)/, "assignment helper"],
  [/data\.assignedTechnician\s*==\s*technicianName\(\)/, "server-side assignment match"],
  [/function\s+technicianUpdateFieldsAreSafe\(\)/, "technician field allowlist"],
  [/function\s+technicianStatusTransitionIsSafe\(\)/, "status transition guard"],
  [/function\s+technicianStatusTimestampIsSafe\(\)/, "status timestamp guard"],
  [/function\s+technicianCompletionStateIsSafe\(\)/, "completion timestamp guard"],
  [/allow\s+read:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)\s*\|\|\s*assignedToCurrentTechnician\(resource\.data\)/, "assigned-record read restriction"],
  [/allow\s+create:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)/, "owner/office-only customer creation"],
  [/match\s+\/\{document=\*\*\}[\s\S]*allow\s+read,\s*write:\s*if\s+false/, "deny-by-default fallback"]
];

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(rules)) failures.push(`Missing ${label}`);
}

const allowlistMatch = rules.match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
if (!allowlistMatch) {
  failures.push("Missing technician update field allowlist");
} else {
  const body = allowlistMatch[1];
  const requiredFields = [
    "officeStatus", "statusUpdatedAt", "completedAt", "findings", "recommendation",
    "workNotes", "partsUsed", "laborTimeNotes", "photoNotes", "photoReferences"
  ];
  const forbiddenFields = [
    "assignedTechnician", "customerName", "email", "phone", "address",
    "estimatedAmount", "internalCost", "markup", "margin", "supplierPrice"
  ];

  for (const field of requiredFields) {
    if (!body.includes(`'${field}'`)) failures.push(`Missing technician-safe field: ${field}`);
  }
  for (const field of forbiddenFields) {
    if (body.includes(`'${field}'`)) failures.push(`Forbidden technician-editable field: ${field}`);
  }
}

const forbiddenPatterns = [
  [/request\.auth\.token\.email\s*==/, "email-address owner bypass"],
  [/match\s+\/Customers\/\{customerId\}[\s\S]*allow\s+read:\s*if\s+signedIn\(\)/, "all-authenticated customer reads"],
  [/allow\s+create,\s*update:\s*if[\s\S]*isTechnician\(\)/, "unrestricted technician customer writes"],
  [/allow\s+create:\s*if[\s\S]*isTechnician\(\)/, "technician customer creation"]
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(rules)) failures.push(`Forbidden rule detected: ${label}`);
}

if (!/request\.resource\.data\.officeStatus\s*==\s*resource\.data\.officeStatus/.test(rules)) {
  failures.push("Technicians cannot safely save notes without changing an existing status");
}
if (!/request\.resource\.data\.statusUpdatedAt\s*==\s*resource\.data\.statusUpdatedAt/.test(rules)) {
  failures.push("Note-only technician updates must preserve statusUpdatedAt");
}
if (!/request\.resource\.data\.statusUpdatedAt\s*==\s*request\.time/.test(rules)) {
  failures.push("Technician status changes must use the trusted request timestamp");
}
if (!/request\.resource\.data\.completedAt\s*==\s*request\.time/.test(rules)) {
  failures.push("Newly completed work orders must use the trusted request timestamp");
}
if (!/request\.resource\.data\.completedAt\s*==\s*resource\.data\.completedAt/.test(rules)) {
  failures.push("Completed work-order notes must preserve the original completedAt timestamp");
}
if (!/!\('completedAt'\s+in\s+request\.resource\.data\)/.test(rules)) {
  failures.push("Reopened work orders must remove completedAt");
}
if (!/technicianStatusTimestampIsSafe\(\)[\s\S]*technicianCompletionStateIsSafe\(\)/.test(rules)) {
  failures.push("Technician updates must enforce both status and completion timestamp guards");
}

if (failures.length) {
  console.error("Firestore role-permissions contract failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Firestore owner, office, technician assignment, field, status, trusted timestamp, completion, and deny-by-default checks passed.");
