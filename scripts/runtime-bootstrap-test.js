"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const firebaseConfig = read("firebase-config.js");
for (const [requiredText, label] of [
  ['["v1-access.js", "role-ui-patch.js", "production-reset.js"]', "ordered RC1 runtime list"],
  ['document.querySelector(`script[src^="${runtimeScript}"]`)', "duplicate-script protection"],
  ["script.async = false", "ordered dynamic script execution"],
  ["document.head.appendChild(script)", "runtime script injection"],
]) {
  if (!firebaseConfig.includes(requiredText)) {
    failures.push(`firebase-config.js is missing ${label}`);
  }
}

const accessRuntime = read("v1-access.js");
for (const [requiredText, label] of [
  ['throw new Error("profile-required")', "fail-closed missing-profile handling"],
  ['throw new Error("invalid-role-profile")', "invalid-role rejection"],
  ['window.CHILL_PROS_SESSION = null', "session clearing after authorization failure"],
  ['This account has not been activated.', "clear inactive-account message"],
]) {
  if (!accessRuntime.includes(requiredText)) {
    failures.push(`v1-access.js is missing ${label}`);
  }
}

if (accessRuntime.includes('fallbackRole = OWNER_EMAILS.has') || accessRuntime.includes('fallbackRole,\n      technicianName')) {
  failures.push("v1-access.js must not grant technician access through a fallback role");
}

const roleUiPatch = read("role-ui-patch.js");
for (const [requiredText, label] of [
  ['title: "Technician Workspace"', "technician mobile title"],
  ['status: "Assigned work only"', "technician access description"],
  ['document.body?.dataset?.role', "authenticated role source"],
]) {
  if (!roleUiPatch.includes(requiredText)) {
    failures.push(`role-ui-patch.js is missing ${label}`);
  }
}

const index = read("index.html");
for (const requiredScript of ["firebase-config.js", "app.js"]) {
  if (!index.includes(`src="${requiredScript}"`)) {
    failures.push(`index.html does not load ${requiredScript}`);
  }
}

const launcher = read("launch.html");
if (!launcher.includes("index.html")) {
  failures.push("launch.html must load the shared index.html application");
}

const iphone = read("iphone.html");
if (!iphone.includes('src="index.html"')) {
  failures.push("iphone.html must load the shared index.html application");
}

if (failures.length) {
  console.error("Runtime bootstrap checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("All supported entry points bootstrap fail-closed access controls and role-specific mobile labels.");
