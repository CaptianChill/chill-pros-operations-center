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
  [/function\s+optionalTextFieldIsSafe\(fieldName\)/, "optional text type and size guard"],
  [/function\s+technicianWorkOrderValuesAreSafe\(\)/, "work-order value validation"],
  [/function\s+technicianStatusTransitionIsSafe\(\)/, "status transition guard"],
  [/function\s+technicianStatusTimestampIsSafe\(\)/, "status timestamp guard"],
  [/function\s+technicianCompletionStateIsSafe\(\)/, "completion timestamp guard"],
  [/function\s+auditEventCreateIsSafe\(\)/, "audit event value guard"],
  [/allow\s+read:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)\s*\|\|\s*assignedToCurrentTechnician\(resource\.data\)/, "assigned-record read restriction"],
  [/allow\s+create:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)/, "owner/office-only customer creation"],
  [/match\s+\/Customers\/\{customerId\}\/Private\/\{privateDocumentId\}\s*\{[\s\S]*?allow\s+read,\s*create,\s*update,\s*delete:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)/, "owner/office-only private customer data"],
  [/match\s+\/AuditEvents\/\{eventId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)/, "owner/office audit reads"],
  [/match\s+\/AuditEvents\/\{eventId\}\s*\{[\s\S]*?allow\s+create:\s*if\s*\(isOwner\(\)\s*\|\|\s*isOffice\(\)\)\s*&&\s*auditEventCreateIsSafe\(\)/, "validated owner/office audit creation"],
  [/match\s+\/AuditEvents\/\{eventId\}\s*\{[\s\S]*?allow\s+update,\s*delete:\s*if\s+false/, "immutable audit events"],
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
  [/allow\s+create,\s*update\s*:\s*if\s*[^;]*\bisTechnician\(\)/, "unrestricted technician customer writes"],
  [/allow\s+create\s*:\s*if\s*[^;]*\bisTechnician\(\)/, "technician customer creation"]
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(rules)) failures.push(`Forbidden rule detected: ${label}`);
}

const privateRuleMatch = rules.match(
  /match\s+\/Customers\/\{customerId\}\/Private\/\{privateDocumentId\}\s*\{([^}]*)\}/
);
if (!privateRuleMatch) {
  failures.push("Missing private customer data rule block");
} else if (/\bisTechnician\(\)/.test(privateRuleMatch[1])) {
  failures.push("Forbidden rule detected: technician private-data access");
}

const auditRuleMatch = rules.match(
  /match\s+\/AuditEvents\/\{eventId\}\s*\{([\s\S]*?)\n\s*\}/
);
if (!auditRuleMatch) {
  failures.push("Missing audit event rule block");
} else {
  const body = auditRuleMatch[1];
  if (/\bisTechnician\(\)/.test(body)) failures.push("Forbidden rule detected: technician audit access");
  if (!/allow\s+update,\s*delete:\s*if\s+false/.test(body)) failures.push("Audit events must be immutable");
}

const auditGuards = [
  [/request\.resource\.data\.actorUid\s*==\s*request\.auth\.uid/, "audit actor UID binding"],
  [/request\.resource\.data\.actorRole\s*==\s*role\(\)/, "audit actor role binding"],
  [/request\.resource\.data\.createdAt\s*==\s*request\.time/, "trusted audit timestamp"],
  [/request\.resource\.data\.action\s+is\s+string/, "audit action type guard"],
  [/request\.resource\.data\.targetPath\s+is\s+string/, "audit target path type guard"],
  [/request\.resource\.data\.metadata\.keys\(\)\.hasOnly\(\[\s*'source',\s*'workflow',\s*'context',\s*'changedFields'\s*\]\)/, "audit metadata key allowlist"],
  [/request\.resource\.data\.metadata\.source\.size\(\)\s*<=\s*100/, "audit source size guard"],
  [/request\.resource\.data\.metadata\.workflow\.size\(\)\s*<=\s*100/, "audit workflow size guard"],
  [/request\.resource\.data\.metadata\.context\.size\(\)\s*<=\s*500/, "audit context size guard"],
  [/request\.resource\.data\.metadata\.changedFields\s+is\s+list/, "audit changed-fields type guard"],
  [/request\.resource\.data\.metadata\.changedFields\.size\(\)\s*<=\s*25/, "audit changed-fields size guard"]
];
for (const [pattern, label] of auditGuards) {
  if (!pattern.test(rules)) failures.push(`Missing ${label}`);
}

const textFields = ["findings", "recommendation", "workNotes", "partsUsed", "laborTimeNotes", "photoNotes"];
for (const field of textFields) {
  if (!new RegExp(`optionalTextFieldIsSafe\\('${field}'\\)`).test(rules)) {
    failures.push(`Missing text value guard for ${field}`);
  }
}
if (!/request\.resource\.data\[fieldName\]\s+is\s+string/.test(rules)) {
  failures.push("Technician text fields must be strings");
}
if (!/request\.resource\.data\[fieldName\]\.size\(\)\s*<=\s*20000/.test(rules)) {
  failures.push("Technician text fields must have a bounded size");
}
if (!/request\.resource\.data\.photoReferences\s+is\s+list/.test(rules)) {
  failures.push("Photo references must be a list when present");
}
if (!/request\.resource\.data\.photoReferences\.size\(\)\s*<=\s*50/.test(rules)) {
  failures.push("Photo reference lists must have a bounded size");
}
if (!/request\.resource\.data\.officeStatus\s+is\s+string/.test(rules)) {
  failures.push("Technician officeStatus must be a string");
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
if (!/technicianUpdateFieldsAreSafe\(\)[\s\S]*technicianWorkOrderValuesAreSafe\(\)[\s\S]*technicianStatusTimestampIsSafe\(\)[\s\S]*technicianCompletionStateIsSafe\(\)/.test(rules)) {
  failures.push("Technician updates must enforce field, value, timestamp, and completion guards");
}

if (failures.length) {
  console.error("Firestore role-permissions contract failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Firestore owner, office, technician assignment, private pricing, immutable audit, restricted metadata, field, bounded value, status, trusted timestamp, completion, and deny-by-default checks passed.");
