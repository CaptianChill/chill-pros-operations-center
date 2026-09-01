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

async function testAuthStateTimeoutCleanup() {
  let authResolve;
  let timeoutCallback;
  let scheduledDelay;
  let unsubscribeCalls = 0;
  let clearTimeoutCalls = 0;
  const auth = {
    onAuthStateChanged(resolve) {
      authResolve = resolve;
      return () => { unsubscribeCalls += 1; };
    }
  };

  const pending = waitForAuthState(auth, {
    timeoutMs: 2500,
    setTimeout(callback, delay) {
      timeoutCallback = callback;
      scheduledDelay = delay;
      return "timer-1";
    },
    clearTimeout(timerId) {
      assert.strictEqual(timerId, "timer-1");
      clearTimeoutCalls += 1;
    }
  });

  assert.strictEqual(scheduledDelay, 2500);
  timeoutCallback();
  await expectReject(pending, "auth/session-timeout");
  assert.strictEqual(unsubscribeCalls, 1);
  assert.strictEqual(clearTimeoutCalls, 1);
  authResolve({ uid: "late-owner" });
  assert.strictEqual(unsubscribeCalls, 1);
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
  const expectedUser = { uid: "owner-1" };
  const expectedSession = Object.freeze({ authorized: true, uid: "owner-1", role: "owner" });
  const scheduleTimeout = () => "timer";
  const cancelTimeout = () => {};
  let authorizationOptions;
  let authStateResolverOptions;
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
        assert.strictEqual(await options.waitForAuthState(auth), expectedUser);
        return expectedSession;
      }
    },
    waitForAuthState: async (currentAuth, options) => {
      assert.strictEqual(currentAuth, auth);
      authStateResolverOptions = options;
      return expectedUser;
    },
    authStateTimeoutMs: 4321,
    setTimeout: scheduleTimeout,
    clearTimeout: cancelTimeout,
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
  assert.strictEqual(authStateResolverOptions.timeoutMs, 4321);
  assert.strictEqual(authStateResolverOptions.setTimeout, scheduleTimeout);
  assert.strictEqual(authStateResolverOptions.clearTimeout, cancelTimeout);
  assert.strictEqual(Object.isFrozen(authStateResolverOptions), true);
  assert.strictEqual(authorizedSession, expectedSession);
  assert.strictEqual(rejected, false);
  await expectReject(bootstrap.start(), "auth/bootstrap-already-started");
}

async function testRejectedBootstrapCanRetry() {
  const expectedError = Object.assign(new Error("Temporary profile failure"), { code: "auth/owner-profile-unavailable" });
  const expectedSession = Object.freeze({ authorized: true, uid: "owner-1", role: "owner" });
  let attempts = 0;
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
        attempts += 1;
        if (attempts === 1) throw expectedError;
        return expectedSession;
      }
    },
    onRejected(error) {
      rejectedError = error;
    }
  });

  await expectReject(bootstrap.start(), "auth/owner-profile-unavailable");
  assert.strictEqual(rejectedError, expectedError);
  assert.strictEqual(await bootstrap.start(), expectedSession);
  assert.strictEqual(attempts, 2);
  await expectReject(bootstrap.start(), "auth/bootstrap-already-started");
}

async function testConcurrentBootstrapIsRejected() {
  let releaseAuthorization;
  const pendingAuthorization = new Promise((resolve) => {
    releaseAuthorization = resolve;
  });
  const expectedSession = Object.freeze({ authorized: true, uid: "owner-1", role: "owner" });
  const bootstrap = createOwnerCommandAuthBootstrap({
    scope: {
      firebase: {
        auth: () => ({}),
        firestore: () => ({})
      }
    },
    authorizationApi: {
      authorizeOwnerSession() {
        return pendingAuthorization;
      }
    }
  });

  const firstStart = bootstrap.start();
  await expectReject(bootstrap.start(), "auth/bootstrap-already-started");
  releaseAuthorization(expectedSession);
  assert.strictEqual(await firstStart, expectedSession);
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
  await testAuthStateTimeoutCleanup();
  await testSynchronousAuthStateCleanup();
  await testSynchronousAuthErrorCleanup();
  await testAuthorizedBootstrap();
  await testRejectedBootstrapCanRetry();
  await testConcurrentBootstrapIsRejected();
  await testFailClosedDependencies();
  await testRejectedHandlerCannotMaskAuthorizationError();
  console.log("Owner command authorization bootstrap contract passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
