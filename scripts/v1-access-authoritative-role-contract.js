"use strict";

const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "v1-access.js"), "utf8");
const failures = [];

const forbiddenPatterns = [
  [/OWNER_EMAILS/, "hard-coded owner email allowlist"],
  [/chillprostx@gmail\.com/i, "hard-coded owner email address"],
  [/fallbackRole/, "fallback role assignment"],
  [/using fallback role/i, "fail-open profile recovery"],
  [/ROLE_VIEWS\.technician\)/, "default technician role fallback"]
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(source)) failures.push(`Forbidden legacy access behavior: ${label}`);
}

const requiredPatterns = [
  [/collection\("Users"\)\.doc\(user\.uid\)\.get\(\)/, "authoritative Users/{uid} lookup"],
  [/if \(!snapshot\.exists\)[\s\S]*Authoritative user profile is required/, "missing-profile denial"],
  [/\["owner", "office", "technician"\]\.includes\(data\.role\)/, "role allowlist validation"],
  [/data\.role === "technician"[\s\S]*technicianName/, "technician identity validation"],
  [/catch \(error\)[\s\S]*Authorization failed:[\s\S]*auth\.signOut\(\)/, "fail-closed authorization handling"]
];

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(source)) failures.push(`Missing legacy access safeguard: ${label}`);
}

if (failures.length) {
  console.error("Legacy access authoritative-role contract failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Legacy access uses authoritative role profiles and fails closed without an approved profile.");
