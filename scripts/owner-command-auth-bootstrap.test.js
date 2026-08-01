"use strict";

const assert = require("assert");
const {
  createOwnerCommandAuthBootstrap,
  waitForAuthState
} = require("../owner-command-auth-bootstrap.js");

async function expectReject(promise, code) {
  await assert.rejects(promise, (error) => error && error.code === code);
}

async function testWaitForAuthState() {
  let unsubscribeCalls = 0;
  const user = { uid: "owner-1" };
  const auth = {
    onAuthStateChanged(resolve) {
      queueMicrotask(() => resolve(user));
      return () => { unsubscribeCalls += 1; };
    }
  };

  assert.strictEqual(await waitForAuthState(auth), user);
  assert.strictEqual(unsubscribeCalls, 1);
  await expectReject(waitForAuthState({}), "auth/dependency-unavailable");
}

async function testSynchronousAuthStateCleanup() {
  let unsubscribeCalls = 0;
  let callbackCalls = 0;
  const user = { uid: "owner-sync" };
  const auth = {
    onAuthStateChanged(resolve, reject) {
      callbackCalls += 1;
      resolve(user);
      callbackCalls += 1;
      resolve({ uid: "ignored-user" });
      callbackCalls += 1;
      reject(new Error("ignored error"));
      return () => { unsubscribeCalls += 1; };
    }
  };

  assert.strictEqual(await waitForAuthState(auth), user);
  assert.strictEqual(callbackCalls, 3);
  assert.strictEqual(unsubscribeCalls, 1);
}

async function testSynchronousAuthErrorCleanup() {
  let unsubscribeCalls = 0;
  const expectedCause = new Error("session failed");
  const auth = {
    onAuthStateChanged(resolve, reject) {
      reject(expectedCause);
      resolve({ uid: "ignored-user" });
      return () => { unsubscribeCalls += 1; };
    }
  };

  await assert.rejects(
    waitForAuthState(auth),
    (error) => error && error.code === "auth/session-unavailable" && error.cause === expectedCause
  );
  assert.strictEqual(unsubscribeCalls, 1);
}

async function testAuthorizedBootstrap() {
  const auth = { name: "auth" };
  const firestore = { name: "firestore" };
  const expectedSession = Object.freeze({ authorized: true, uid: "owner-1", role: "owner" });
  let authorizationOptions;
  let authorizedSession;
  let rejected = false;

  const bootstrap = createOwnerCommandAuthBootstrap({
    scope: {
      firebase: {
        auth: () => auth,
        firestore: () => firestore
      }
    },
    authorizationApi: {
      async authorizeOwnerSession(options) {
        authorizationOptions = options;
        return expectedSession;
      }
    },
    waitForAuthState: async () => ({ uid: "owner-1" }),
    onAuthorized(session) {
      authorizedSession = session;
    },
    onRejected() {
      rejected = true;
    }
  });

  assert.strictEqual(await bootstrap.start(), expectedSession);
  assert.strictEqual(authorizationOptions.auth, auth);
  assert.strictEqual(authorizationOptions.firestore, firestore);
  assert.strictEqual(typeof authorizationOptions.waitForAuthState, "function");
  assert.strictEqual(authorizedSession, expectedSession);
  assert.strictEqual(rejected, false);
  await expectReject(bootstrap.start(), "auth/bootstrap-already-started");
}

async function testRejectedBootstrap() {
  const expectedError = Object.assign(new Error("Denied"), { code: "auth/not-owner-account" });
  let rejectedError;
  const bootstrap = createOwnerCommandAuthBootstrap({
    scope: {
      firebase: {
        auth: () => ({}),
        firestore: () => ({})
      }
    },
    authorizationApi: {
      async authorizeOwnerSession() {
        throw expectedError;
      }
    },
    onRejected(error) {
      rejectedError = error;
    }
  });

  await expectReject(bootstrap.start(), "auth/not-owner-account");
  assert.strictEqual(rejectedError, expectedError);
}

async function testFailClosedDependencies() {
  assert.throws(
    () => createOwnerCommandAuthBootstrap({ authorizationApi: {} }),
    (error) => error.code === "auth/dependency-unavailable"
  );

  const bootstrap = createOwnerCommandAuthBootstrap({
    scope: {},
    authorizationApi: { authorizeOwnerSession: async () => ({}) }
  });
  await expectReject(bootstrap.start(), "auth/dependency-unavailable");
}

async function testRejectedHandlerCannotMaskAuthorizationError() {
  const expectedError = Object.assign(new Error("Denied"), { code: "auth/not-owner-account" });
  const logged = [];
  const bootstrap = createOwnerCommandAuthBootstrap({
    scope: {
      console: { error: (...args) => logged.push(args) },
      firebase: {
        auth: () => ({}),
        firestore: () => ({})
      }
    },
    authorizationApi: {
      async authorizeOwnerSession() {
        throw expectedError;
      }
    },
    async onRejected() {
      throw new Error("render failed");
    }
  });

  await assert.rejects(bootstrap.start(), (error) => error === expectedError);
  assert.strictEqual(logged.length, 1);
}

(async function run() {
  await testWaitForAuthState();
  await testSynchronousAuthStateCleanup();
  await testSynchronousAuthErrorCleanup();
  await testAuthorizedBootstrap();
  await testRejectedBootstrap();
  await testFailClosedDependencies();
  await testRejectedHandlerCannotMaskAuthorizationError();
  console.log("Owner command authorization bootstrap contract passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
