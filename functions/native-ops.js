"use strict";

const express = require("express");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

if (!getApps().length) initializeApp();

const db = getFirestore();
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const OWNER_EMAIL = "chillprostx@gmail.com";
const DEFAULT_RETURN_URL = "https://chill-pros-operations-center.vercel.app";
const ALLOWED_ORIGINS = new Set(["https://chill-pros-operations-center.vercel.app"]);

function originAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/chill-pros-operations-center(?:-[a-z0-9-]+)?-chill-pros\.vercel\.app$/i.test(origin)
    || /^https:\/\/chill-pros-operations-center-git-[a-z0-9-]+-chill-pros\.vercel\.app$/i.test(origin);
}

function returnUrlForRequest(req) {
  const origin = String(req.get("origin") || "").trim();
  return originAllowed(origin) ? origin : DEFAULT_RETURN_URL;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "512kb" }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && originAllowed(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

async function resolveStaff(decoded) {
  const email = String(decoded.email || "").toLowerCase();
  const role = String(decoded.role || decoded.userRole || "").toLowerCase();
  if (email === OWNER_EMAIL || role === "owner") return { role: "owner", email };
  if (["technician", "tech", "field-tech", "field_tech"].includes(role)) return { role: "technician", email };
  if (email) {
    const techSnap = await db.collection("technicians").where("email", "==", email).limit(1).get();
    if (!techSnap.empty) return { role: "technician", email };
  }
  return null;
}

async function requireStaff(req, res, next) {
  try {
    const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Authentication required." });
    const decoded = await getAuth().verifyIdToken(match[1], true);
    const staff = await resolveStaff(decoded);
    if (!staff) return res.status(403).json({ error: "Chill Pros staff access required." });
    req.user = decoded;
    req.staff = staff;
    return next();
  } catch (error) {
    logger.warn("Native ops authentication failed", { message: error.message });
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

function requireOwner(req, res, next) {
  if (req.staff?.role !== "owner") return res.status(403).json({ error: "Owner approval required." });
  return next();
}

function moneyToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return cents > 0 && cents <= 999999999 ? cents : null;
}

function cleanLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.slice(0, 50).map((line) => ({
    description: String(line?.description || "").trim().slice(0, 300),
    quantity: Math.max(1, Math.min(999, Number(line?.quantity) || 1)),
    unitPrice: Math.max(0, Number(line?.unitPrice) || 0),
  })).filter((line) => line.description);
}

function totalForLines(lines) {
  return Number(lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0).toFixed(2));
}

async function stripeRequest(path, params, method = "POST", requestOptions = {}) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) body.append(key, String(item));
    } else {
      body.append(key, String(value));
    }
  }
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY.value()}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(method === "POST" && requestOptions.idempotencyKey
        ? { "Idempotency-Key": String(requestOptions.idempotencyKey).slice(0, 255) }
        : {}),
    },
    ...(method === "POST" ? { body } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error("Stripe request failed", { path, status: response.status, type: payload.error?.type || null, code: payload.error?.code || null });
    const error = new Error("Stripe request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

app.get("/health", requireStaff, (req, res) => {
  res.json({ ok: true, service: "nativeOpsApi", version: 2, role: req.staff.role, vercelCors: true });
});

app.post("/quotes", requireStaff, async (req, res) => {
  const lines = cleanLines(req.body?.lines);
  if (!lines.length) return res.status(400).json({ error: "At least one quote line is required." });
  const quoteRef = db.collection("quotes").doc();
  const total = totalForLines(lines);
  const record = {
    customerId: String(req.body?.customerId || "").slice(0, 160) || null,
    customerName: String(req.body?.customerName || "").trim().slice(0, 240) || null,
    customerEmail: String(req.body?.customerEmail || "").trim().slice(0, 320) || null,
    jobId: String(req.body?.jobId || "").slice(0, 160) || null,
    equipmentId: String(req.body?.equipmentId || "").slice(0, 160) || null,
    scope: String(req.body?.scope || "").trim().slice(0, 5000) || null,
    notes: String(req.body?.notes || "").trim().slice(0, 5000) || null,
    lines,
    total,
    status: "draft",
    createdByUid: req.user.uid,
    createdByRole: req.staff.role,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await quoteRef.set(record);
  return res.status(201).json({ ok: true, id: quoteRef.id, ...record, createdAt: null, updatedAt: null });
});

app.post("/quotes/:id/approve", requireStaff, requireOwner, async (req, res) => {
  const ref = db.collection("quotes").doc(String(req.params.id || "").slice(0, 180));
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Quote not found." });
  await ref.set({ status: "approved", approvedByUid: req.user.uid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return res.json({ ok: true, id: ref.id, status: "approved" });
});

app.post("/invoices", requireStaff, async (req, res) => {
  const requestedLines = cleanLines(req.body?.lines);
  const quoteId = String(req.body?.quoteId || "").slice(0, 180) || null;

  const buildRecord = (invoiceLines, quote = null) => {
    const total = totalForLines(invoiceLines);
    const source = quote || req.body || {};
    return {
      quoteId,
      customerId: String(source.customerId || "").slice(0, 160) || null,
      customerName: String(source.customerName || "").trim().slice(0, 240) || null,
      customerEmail: String(source.customerEmail || "").trim().slice(0, 320) || null,
      jobId: String(source.jobId || "").slice(0, 160) || null,
      equipmentId: String(source.equipmentId || "").slice(0, 160) || null,
      scope: String(source.scope || "").trim().slice(0, 5000) || null,
      notes: String(source.notes || "").trim().slice(0, 5000) || null,
      lines: invoiceLines,
      total,
      amountPaid: 0,
      balanceDue: total,
      status: "draft",
      paymentStatus: "unpaid",
      createdByUid: req.user.uid,
      createdByRole: req.staff.role,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  };

  if (!quoteId) {
    if (!requestedLines.length) return res.status(400).json({ error: "At least one invoice line is required." });
    const invoiceRef = db.collection("invoices").doc();
    const record = buildRecord(requestedLines);
    await invoiceRef.set(record);
    return res.status(201).json({ ok: true, id: invoiceRef.id, ...record, createdAt: null, updatedAt: null });
  }

  const quoteRef = db.collection("quotes").doc(quoteId);

  try {
    // Backfill lineage from invoices created before quote.invoiceId existed.
    const legacyInvoices = await db.collection("invoices").where("quoteId", "==", quoteId).limit(1).get();
    const legacyInvoiceId = legacyInvoices.empty ? "" : legacyInvoices.docs[0].id;
    const candidateInvoiceRef = db.collection("invoices").doc();

    const outcome = await db.runTransaction(async (transaction) => {
      const quoteSnap = await transaction.get(quoteRef);
      if (!quoteSnap.exists) return { errorStatus: 404, error: "Quote not found." };

      const quote = quoteSnap.data();
      if (quote.status !== "approved") {
        return { errorStatus: 409, error: "Quote must be owner-approved before creating its invoice." };
      }

      const existingInvoiceId = String(quote.invoiceId || legacyInvoiceId || "").slice(0, 180);
      if (existingInvoiceId) {
        if (!quote.invoiceId) {
          transaction.set(quoteRef, {
            invoiceId: existingInvoiceId,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        return { existingInvoiceId };
      }

      const invoiceLines = cleanLines(quote.lines);
      if (!invoiceLines.length) {
        return { errorStatus: 400, error: "Approved quote has no invoiceable lines." };
      }
      const approvedTotal = Number(quote.total);
      const recomputedTotal = totalForLines(invoiceLines);
      if (!Number.isFinite(approvedTotal) || Math.abs(recomputedTotal - approvedTotal) > 0.009) {
        return { errorStatus: 409, error: "Approved quote amount is inconsistent. Invoice was not created." };
      }

      const record = buildRecord(invoiceLines, quote);
      transaction.set(candidateInvoiceRef, record);
      transaction.set(quoteRef, {
        invoiceId: candidateInvoiceRef.id,
        invoicedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { created: true, id: candidateInvoiceRef.id, record };
    });

    if (outcome.errorStatus) return res.status(outcome.errorStatus).json({ error: outcome.error });

    if (outcome.existingInvoiceId) {
      const existingInvoiceRef = db.collection("invoices").doc(outcome.existingInvoiceId);
      const existingInvoiceSnap = await existingInvoiceRef.get();
      if (!existingInvoiceSnap.exists) {
        logger.error("Quote references missing invoice; refusing duplicate creation", {
          quoteId,
          invoiceId: outcome.existingInvoiceId,
        });
        return res.status(409).json({
          error: "Quote already references an invoice that could not be loaded. No duplicate invoice was created.",
        });
      }
      const existing = existingInvoiceSnap.data();
      return res.json({
        ok: true,
        id: existingInvoiceSnap.id,
        quoteId,
        total: Number(existing.total || 0),
        status: existing.status || null,
        paymentStatus: existing.paymentStatus || null,
        reused: true,
      });
    }

    return res.status(201).json({
      ok: true,
      id: outcome.id,
      ...outcome.record,
      createdAt: null,
      updatedAt: null,
    });
  } catch (error) {
    logger.error("Invoice creation failed", { quoteId, message: error.message });
    return res.status(500).json({ error: "Unable to create invoice right now. No duplicate invoice was created." });
  }
});

app.post("/invoices/:id/approve", requireStaff, requireOwner, async (req, res) => {
  const ref = db.collection("invoices").doc(String(req.params.id || "").slice(0, 180));
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Invoice not found." });
  await ref.set({ status: "approved", approvedByUid: req.user.uid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return res.json({ ok: true, id: ref.id, status: "approved" });
});

app.post("/payments/checkout", requireStaff, requireOwner, async (req, res) => {
  const invoiceId = String(req.body?.invoiceId || "").slice(0, 180);
  if (!invoiceId) return res.status(400).json({ error: "Invoice ID is required." });
  const invoiceRef = db.collection("invoices").doc(invoiceId);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) return res.status(404).json({ error: "Invoice not found." });
  const invoice = invoiceSnap.data();
  if (invoice.status !== "approved") return res.status(409).json({ error: "Invoice must be owner-approved before collecting payment." });
  const balance = Number(invoice.balanceDue ?? invoice.total ?? 0);
  const cents = moneyToCents(balance);
  if (!cents) return res.status(400).json({ error: "Invoice balance must be greater than zero." });

  try {
    const existingSessionId = String(invoice.stripeCheckoutSessionId || "").slice(0, 220);
    let retryAnchor = "initial";

    if (existingSessionId.startsWith("cs_")) {
      let existingSession;
      try {
        existingSession = await stripeRequest(`/checkout/sessions/${encodeURIComponent(existingSessionId)}`, {}, "GET");
      } catch (error) {
        logger.error("Unable to verify existing Stripe checkout before replacement", {
          invoiceId,
          checkoutSessionId: existingSessionId,
          status: error.status || null,
        });
        return res.status(502).json({ error: "Unable to verify the existing payment attempt. No new checkout was created." });
      }

      const existingInvoiceId = String(existingSession.metadata?.invoiceId || "").slice(0, 180);
      if (existingInvoiceId !== invoiceId) {
        logger.error("Existing Stripe checkout does not belong to invoice", {
          invoiceId,
          checkoutSessionId: existingSession.id,
          checkoutInvoiceId: existingInvoiceId || null,
        });
        return res.status(409).json({ error: "Existing payment attempt does not match this invoice. No new checkout was created." });
      }

      const existingPaymentStatus = existingSession.payment_status || "unpaid";
      const existingStatus = existingSession.status || null;
      const existingAmount = Number(existingSession.amount_total || 0) / 100;
      if (!Number.isFinite(existingAmount) || Math.abs(existingAmount - balance) > 0.009) {
        logger.error("Existing Stripe checkout amount does not match invoice balance", {
          invoiceId,
          checkoutSessionId: existingSession.id,
          checkoutAmount: existingAmount,
          invoiceBalance: balance,
        });
        return res.status(409).json({ error: "Existing payment amount does not match this invoice balance. No new checkout was created." });
      }

      if (existingPaymentStatus === "paid") {
        const total = Number(invoice.total || balance);
        await invoiceRef.set({
          paymentStatus: "paid",
          amountPaid: total,
          balanceDue: 0,
          status: "paid",
          paidAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await db.collection("payments").doc(existingSession.id).set({
          provider: "stripe",
          invoiceId,
          checkoutSessionId: existingSession.id,
          amount: existingAmount,
          currency: existingSession.currency || "usd",
          status: "paid",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return res.status(409).json({
          error: "Invoice is already paid.",
          invoiceId,
          checkoutSessionId: existingSession.id,
          paymentStatus: "paid",
          status: existingStatus,
        });
      }

      if (existingStatus === "complete") {
        await invoiceRef.set({
          paymentStatus: existingPaymentStatus,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await db.collection("payments").doc(existingSession.id).set({
          provider: "stripe",
          invoiceId,
          checkoutSessionId: existingSession.id,
          amount: existingAmount,
          currency: existingSession.currency || "usd",
          status: existingPaymentStatus,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return res.status(409).json({
          error: "A payment is already processing for this invoice.",
          invoiceId,
          checkoutSessionId: existingSession.id,
          paymentStatus: existingPaymentStatus,
          status: existingStatus,
        });
      }

      if (existingStatus === "open" && existingSession.url) {
        return res.json({
          ok: true,
          invoiceId,
          checkoutSessionId: existingSession.id,
          url: existingSession.url,
          paymentStatus: existingPaymentStatus,
          status: existingStatus,
          reused: true,
        });
      }

      if (existingStatus !== "expired") {
        return res.status(409).json({
          error: "An existing payment attempt must be resolved before creating another checkout.",
          invoiceId,
          checkoutSessionId: existingSession.id,
          paymentStatus: existingPaymentStatus,
          status: existingStatus,
        });
      }

      retryAnchor = existingSession.id;
    }

    const returnUrl = returnUrlForRequest(req);
    const session = await stripeRequest("/checkout/sessions", {
      mode: "payment",
      "payment_method_types[]": ["card", "us_bank_account"],
      customer_email: invoice.customerEmail || undefined,
      success_url: `${returnUrl}?payment=success&invoice=${encodeURIComponent(invoiceId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?payment=cancelled&invoice=${encodeURIComponent(invoiceId)}`,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": cents,
      "line_items[0][price_data][product_data][name]": `Chill Pros Invoice ${invoiceId}`,
      "line_items[0][quantity]": 1,
      "metadata[invoiceId]": invoiceId,
      "metadata[source]": "chill-pros-operations-center",
    }, "POST", {
      idempotencyKey: `chill-pros-checkout-${invoiceId}-${cents}-${retryAnchor}`,
    });

    await invoiceRef.set({
      stripeCheckoutSessionId: session.id,
      paymentStatus: session.payment_status || "unpaid",
      paymentUrlCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection("payments").doc(session.id).set({
      provider: "stripe",
      invoiceId,
      checkoutSessionId: session.id,
      amount: balance,
      currency: "usd",
      status: session.payment_status || "unpaid",
      createdByUid: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.json({ ok: true, invoiceId, checkoutSessionId: session.id, url: session.url, paymentStatus: session.payment_status || "unpaid" });
  } catch (error) {
    return res.status(502).json({ error: "Unable to create secure payment checkout right now." });
  }
});

app.post("/payments/status", requireStaff, requireOwner, async (req, res) => {
  const sessionId = String(req.body?.checkoutSessionId || "").slice(0, 220);
  if (!sessionId || !sessionId.startsWith("cs_")) return res.status(400).json({ error: "Valid checkout session ID is required." });
  try {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, {}, "GET");
    const invoiceId = String(session.metadata?.invoiceId || "").slice(0, 180) || null;
    const source = String(session.metadata?.source || "");
    const paid = session.payment_status === "paid";
    const amountTotal = Number(session.amount_total || 0) / 100;
    if (!invoiceId || source !== "chill-pros-operations-center") {
      return res.status(409).json({ error: "Checkout session is not an issued Chill Pros invoice payment." });
    }

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) return res.status(404).json({ error: "Invoice not found for checkout session." });
    const invoice = invoiceSnap.data();
    const activeSessionId = String(invoice.stripeCheckoutSessionId || "").slice(0, 220);
    if (activeSessionId !== sessionId) {
      logger.error("Payment status session does not match invoice active checkout", {
        invoiceId,
        checkoutSessionId: sessionId,
        activeCheckoutSessionId: activeSessionId || null,
      });
      return res.status(409).json({ error: "Checkout session does not match this invoice active payment attempt." });
    }

    const paymentRef = db.collection("payments").doc(sessionId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
      return res.status(409).json({ error: "Checkout session was not issued by native billing." });
    }
    const payment = paymentSnap.data();
    const paymentInvoiceId = String(payment.invoiceId || "").slice(0, 180);
    const expectedAmount = Number(payment.amount);
    if (paymentInvoiceId !== invoiceId || !Number.isFinite(expectedAmount) || Math.abs(expectedAmount - amountTotal) > 0.009) {
      logger.error("Payment status identity or amount mismatch", {
        invoiceId,
        checkoutSessionId: sessionId,
        paymentInvoiceId: paymentInvoiceId || null,
        expectedAmount,
        stripeAmount: amountTotal,
      });
      return res.status(409).json({ error: "Checkout session amount or invoice identity does not match native billing." });
    }

    const total = Number(invoice.total || 0);
    await invoiceRef.set({
      paymentStatus: session.payment_status || "unpaid",
      amountPaid: paid ? total : Number(invoice.amountPaid || 0),
      balanceDue: paid ? 0 : Number(invoice.balanceDue ?? total),
      status: paid ? "paid" : invoice.status,
      paidAt: paid ? FieldValue.serverTimestamp() : (invoice.paidAt || null),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await paymentRef.set({
      provider: "stripe",
      invoiceId,
      checkoutSessionId: sessionId,
      amount: amountTotal,
      currency: session.currency || "usd",
      status: session.payment_status || "unpaid",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return res.json({ ok: true, invoiceId, checkoutSessionId: sessionId, paymentStatus: session.payment_status || "unpaid", status: session.status || null, amountTotal });
  } catch (error) {
    return res.status(502).json({ error: "Unable to refresh payment status right now." });
  }
});

exports.nativeOpsApi = onRequest({
  region: "us-central1",
  cors: false,
  secrets: [STRIPE_SECRET_KEY],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 6,
}, app);
