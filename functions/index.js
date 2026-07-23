"use strict";

const crypto = require("node:crypto");
const express = require("express");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

initializeApp();

const db = getFirestore();
const JOBBER_CLIENT_ID = defineSecret("JOBBER_CLIENT_ID");
const JOBBER_CLIENT_SECRET = defineSecret("JOBBER_CLIENT_SECRET");
const JOBBER_CALLBACK_URL = defineSecret("JOBBER_CALLBACK_URL");

const JOBBER_AUTHORIZE_URL = "https://api.getjobber.com/api/oauth/authorize";
const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const JOBBER_GRAPHQL_VERSION = "2025-04-16";
const FRONTEND_URL = "https://captianchill.github.io/chill-pros-operations-center/launch.html";
const ALLOWED_ORIGINS = new Set([
  "https://captianchill.github.io",
  "https://chill-pros-ice-stream.web.app",
  "https://chill-pros-ice-stream.firebaseapp.com",
]);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "250kb" }));

app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

async function requireOwner(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Authentication required." });

    const decoded = await getAuth().verifyIdToken(match[1], true);
    const role = String(decoded.role || "").toLowerCase();
    const email = String(decoded.email || "").toLowerCase();
    if (role !== "owner" && email !== "chillprostx@gmail.com") {
      return res.status(403).json({ error: "Owner access required." });
    }
    req.user = decoded;
    return next();
  } catch (error) {
    logger.warn("Owner authentication failed", { message: error.message });
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

function tokenExpiry(accessToken) {
  try {
    const payload = accessToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(decoded.exp || 0) * 1000;
  } catch {
    return Date.now() + 55 * 60 * 1000;
  }
}

async function exchangeToken(params) {
  const body = new URLSearchParams(params);
  const response = await fetch(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    logger.error("Jobber token exchange failed", {
      status: response.status,
      error: payload.error || payload.message || "unknown",
    });
    throw new Error("Jobber authorization failed.");
  }
  return payload;
}

async function jobberGraphQL(accessToken, query, variables = {}) {
  const response = await fetch(JOBBER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": JOBBER_GRAPHQL_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    const error = new Error("JOBBER_TOKEN_EXPIRED");
    error.code = "JOBBER_TOKEN_EXPIRED";
    throw error;
  }
  if (!response.ok || payload.errors) {
    logger.error("Jobber GraphQL request failed", {
      status: response.status,
      errors: payload.errors || null,
    });
    throw new Error("Jobber API request failed.");
  }
  return payload.data;
}

const integrationRef = db.collection("privateIntegrations").doc("jobber");

async function refreshTokensIfNeeded() {
  const snap = await integrationRef.get();
  if (!snap.exists) throw new Error("Jobber is not connected.");
  const current = snap.data();
  const expiresAt = current.expiresAt?.toMillis?.() || 0;
  if (expiresAt > Date.now() + 5 * 60 * 1000) return current;

  return db.runTransaction(async (tx) => {
    const latestSnap = await tx.get(integrationRef);
    const latest = latestSnap.data();
    const latestExpiry = latest.expiresAt?.toMillis?.() || 0;
    if (latestExpiry > Date.now() + 5 * 60 * 1000) return latest;

    const tokens = await exchangeToken({
      client_id: JOBBER_CLIENT_ID.value(),
      client_secret: JOBBER_CLIENT_SECRET.value(),
      grant_type: "refresh_token",
      refresh_token: latest.refreshToken,
    });

    const updated = {
      ...latest,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Timestamp.fromMillis(tokenExpiry(tokens.access_token)),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(integrationRef, updated, { merge: true });
    return updated;
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "jobberApi", version: 1 });
});

app.post("/connect", requireOwner, async (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  await db.collection("oauthStates").doc(state).set({
    provider: "jobber",
    uid: req.user.uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
  });

  const authorizeUrl = new URL(JOBBER_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", JOBBER_CLIENT_ID.value());
  authorizeUrl.searchParams.set("redirect_uri", JOBBER_CALLBACK_URL.value());
  authorizeUrl.searchParams.set("state", state);
  res.json({ authorizeUrl: authorizeUrl.toString() });
});

app.get("/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code || !state) return res.status(400).send("Missing authorization response.");

  const stateRef = db.collection("oauthStates").doc(state);
  const stateSnap = await stateRef.get();
  if (!stateSnap.exists) return res.status(400).send("Invalid authorization state.");
  const stateData = stateSnap.data();
  if (stateData.provider !== "jobber" || stateData.expiresAt.toMillis() < Date.now()) {
    await stateRef.delete();
    return res.status(400).send("Authorization state expired.");
  }

  try {
    const tokens = await exchangeToken({
      client_id: JOBBER_CLIENT_ID.value(),
      client_secret: JOBBER_CLIENT_SECRET.value(),
      grant_type: "authorization_code",
      code,
      redirect_uri: JOBBER_CALLBACK_URL.value(),
    });

    const accountData = await jobberGraphQL(
      tokens.access_token,
      "query GetAccount { account { id name } }"
    );

    await integrationRef.set({
      provider: "jobber",
      connected: true,
      accountId: accountData.account.id,
      accountName: accountData.account.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Timestamp.fromMillis(tokenExpiry(tokens.access_token)),
      connectedByUid: stateData.uid,
      connectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      apiVersion: JOBBER_GRAPHQL_VERSION,
    });
    await stateRef.delete();
    return res.redirect(`${FRONTEND_URL}?jobber=connected`);
  } catch (error) {
    logger.error("Jobber OAuth callback failed", { message: error.message });
    await stateRef.delete().catch(() => undefined);
    return res.redirect(`${FRONTEND_URL}?jobber=error`);
  }
});

app.get("/status", requireOwner, async (_req, res) => {
  const snap = await integrationRef.get();
  if (!snap.exists) return res.json({ connected: false });
  const data = snap.data();
  return res.json({
    connected: Boolean(data.connected),
    accountId: data.accountId || null,
    accountName: data.accountName || null,
    connectedAt: data.connectedAt || null,
    lastClientSyncAt: data.lastClientSyncAt || null,
  });
});

app.post("/sync/clients", requireOwner, async (_req, res) => {
  try {
    const integration = await refreshTokensIfNeeded();
    const query = `
      query Clients($first: Int!, $after: String) {
        clients(first: $first, after: $after) {
          nodes {
            id
            firstName
            lastName
            companyName
            billingAddress { street1 street2 city province postalCode country }
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    `;

    let after = null;
    let imported = 0;
    do {
      const data = await jobberGraphQL(integration.accessToken, query, { first: 100, after });
      const clients = data.clients.nodes || [];
      const batch = db.batch();
      for (const client of clients) {
        batch.set(db.collection("jobberClients").doc(client.id), {
          ...client,
          source: "jobber",
          syncedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (clients.length) await batch.commit();
      imported += clients.length;
      after = data.clients.pageInfo.hasNextPage ? data.clients.pageInfo.endCursor : null;
    } while (after);

    await integrationRef.set({ lastClientSyncAt: FieldValue.serverTimestamp() }, { merge: true });
    return res.json({ ok: true, imported });
  } catch (error) {
    logger.error("Jobber client sync failed", { message: error.message });
    return res.status(500).json({ error: "Client synchronization failed." });
  }
});

app.use((error, _req, res, _next) => {
  logger.error("Unhandled Jobber backend error", { message: error.message });
  res.status(500).json({ error: "Unexpected backend error." });
});

exports.jobberApi = onRequest({
  region: "us-central1",
  cors: false,
  secrets: [JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET, JOBBER_CALLBACK_URL],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 3,
}, app);
