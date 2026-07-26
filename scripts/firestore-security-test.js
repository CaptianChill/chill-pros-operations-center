"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rulesPath = path.resolve(__dirname, "..", "firestore.rules");
const rules = fs.readFileSync(rulesPath, "utf8");
const failures = [];

const requiredPatterns = [
  [/function\s+hasUserProfile\(\)/, "profile existence guard"],
  [/function\s+technicianName\(\)/, "technician identity helper"],
  [/function\s+assignedToCurrentTechnician\(data\)/, "server-side technician assignment helper"],
  [/data\.assignedTechnician\s*==\s*technicianName\(\)/, "technician assignment comparison"],
  [/function\s+technicianUpdateFieldsAreSafe\(\)/, "technician field allowlist helper"],
  [/function\s+technicianStatusIsAllowed\(\)/, "technician status transition guard"],
  [/allow\s+read:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)\s*\|\|\s*assignedToCurrentTechnician\(resource\.data\)/, "assigned-record read restriction"],
  [/allow\s+create:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)/, "owner/office-only customer creation"],
  [/assignedToCurrentTechnician\(resource\.data\)[\s\S]*request\.resource\.data\.assignedTechnician\s*==\s*resource\.data\.assignedTechnician[\s\S]*technicianUpdateFieldsAreSafe\(\)[\s\S]*technicianStatusIsAllowed\(\)/, "restricted technician update chain"],
  [/match\s+\/\{document=\*\*\}[\s\S]*allow\s+read,\s*write:\s*if\s+false/, "deny-by-default fallback"],
];

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(rules)) failures.push(`Missing ${label}`);
}

const fieldAllowlistMatch = rules.match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
if (!fieldAllowlistMatch) {
  failures.push("Missing technician update field allowlist");
} else {
  const allowlistBody = fieldAllowlistMatch[1];
  const requiredFields = ["officeStatus", "statusUpdatedAt", "findings", "recommendation", "photoNotes"];
  const forbiddenFields = ["assignedTechnician", "customerName", "estimatedAmount", "email", "phone"];

  for (const field of requiredFields) {
    if (!allowlistBody.includes(`'${field}'`)) failures.push(`Missing technician-safe field: ${field}`);
  }
  for (const field of forbiddenFields) {
    if (allowlistBody.includes(`'${field}'`)) failures.push(`Forbidden technician-editable field: ${field}`);
  }
}

const statusAllowlistMatch = rules.match(/request\.resource\.data\.officeStatus\s+in\s+\[([\s\S]*?)\]/);
if (!statusAllowlistMatch) {
  failures.push("Missing technician status allowlist");
} else {
  const allowedStatuses = statusAllowlistMatch[1];
  for (const status of ["Dispatched", "In Progress", "Paused", "Waiting on Parts", "Ready to Invoice", "Completed"]) {
    if (!allowedStatuses.includes(`'${status}'`)) failures.push(`Missing technician-safe status: ${status}`);
  }
  for (const status of ["Needs Review", "Needs Quote", "Scheduled"]) {
    if (allowedStatuses.includes(`'${status}'`)) failures.push(`Forbidden technician-controlled status: ${status}`);
  }
}

const forbiddenPatterns = [
  [/match\s+\/Customers\/\{customerId\}[\s\S]*allow\s+read:\s*if\s+signedIn\(\)/, "all-authenticated customer reads"],
  [/allow\s+create,\s*update:\s*if[\s\S]*isTechnician\(\)/, "unrestricted technician customer writes"],
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(rules)) failures.push(`Forbidden rule detected: ${label}`);
}

if (failures.length) {
  console.error("Firestore security checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Firestore technician assignment, field allowlist, status allowlist, and deny-by-default checks passed.");
