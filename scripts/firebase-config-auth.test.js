const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "firebase-config.js"), "utf8");

function evaluateWithFirebase(firebase) {
  const window = {};
  vm.runInNewContext(source, { firebase, window }, { filename: "firebase-config.js" });
  return window;
}

{
  const firestore = { name: "firestore" };
  const auth = { name: "auth" };
  let initializedWith;
  const window = evaluateWithFirebase({
    initializeApp(config) {
      initializedWith = config;
    },
    firestore() {
      return firestore;
    },
    auth() {
      return auth;
    }
  });

  assert.equal(initializedWith.projectId, "chill-pros-ice-stream");
  assert.equal(window.chillProsDb, firestore);
  assert.equal(window.chillProsAuth, auth);
}

{
  const firestore = { name: "firestore" };
  const window = evaluateWithFirebase({
    initializeApp() {},
    firestore() {
      return firestore;
    }
  });

  assert.equal(window.chillProsDb, firestore);
  assert.equal(window.chillProsAuth, null);
}

console.log("firebase-config auth exposure tests passed");
