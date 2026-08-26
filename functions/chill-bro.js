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
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const VECTOR_STORE_ID = String(process.env.CHILL_BRO_VECTOR_STORE_ID || "").trim();
const OWNER_EMAIL = "chillprostx@gmail.com";
const INTERNAL_ROLES = new Set(["owner", "admin", "manager", "dispatcher", "csr", "office", "technician", "tech", "field-tech", "field_tech"]);
const ALLOWED_ORIGINS = new Set([
  "https://captianchill.github.io",
  "https://chill-pros-ice-stream.web.app",
  "https://chill-pros-ice-stream.firebaseapp.com",
  "https://chill-pros-operations-center.vercel.app",
]);

const TRUSTED_WEB_FAMILIES = [
  "OEM/manufacturer documentation: Carrier, Trane, Lennox, Daikin/Goodman, Rheem/Ruud, York/Johnson Controls, Mitsubishi Electric, Fujitsu, Bosch, Copeland, Danfoss, Sporlan/Parker, Resideo/Honeywell Home.",
  "Refrigeration/ice OEM documentation: Manitowoc Ice, Hoshizaki America, Scotsman Ice, Heatcraft and equipment manufacturer service literature.",
  "Commercial kitchen OEM documentation: manufacturer installation/service manuals and official technical bulletins.",
  "Parts research: OEM catalogs first; then established distributors such as Parts Town, Grainger, SupplyHouse and Johnstone when useful for cross-reference or availability context.",
  "Training/reference: HVAC School and established HVAC/R trade publications only as secondary sources, never above an OEM manual or Chill Pros policy.",
];

function originAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/chill-pros-operations-center(?:-[a-z0-9-]+)?-chill-pros\.vercel\.app$/i.test(origin)
    || /^https:\/\/chill-pros-operations-center-git-[a-z0-9-]+-chill-pros\.vercel\.app$/i.test(origin);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));
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

async function findEmployeeByEmail(email) {
  for (const collection of ["technicians", "employees", "teamMembers"]) {
    try {
      const snap = await db.collection(collection).where("email", "==", email).limit(1).get();
      if (!snap.empty) {
        const record = snap.docs[0].data() || {};
        const role = String(record.role || record.userRole || (collection === "technicians" ? "technician" : "staff")).toLowerCase();
        return { role: INTERNAL_ROLES.has(role) ? role : "staff", email, employeeId: snap.docs[0].id };
      }
    } catch (error) {
      logger.info("Employee directory lookup skipped", { collection, message: error.message });
    }
  }
  return null;
}

async function resolveStaff(decoded) {
  const email = String(decoded.email || "").toLowerCase();
  const claimRole = String(decoded.role || decoded.userRole || "").toLowerCase();
  if (email === OWNER_EMAIL || claimRole === "owner") return { role: "owner", email };
  if (INTERNAL_ROLES.has(claimRole)) return { role: claimRole, email };
  if (email) return findEmployeeByEmail(email);
  return null;
}

async function requireStaff(req, res, next) {
  try {
    const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Authentication required." });
    const decoded = await getAuth().verifyIdToken(match[1], true);
    const staff = await resolveStaff(decoded);
    if (!staff) return res.status(403).json({ error: "Chill Pros team access required." });
    req.user = decoded;
    req.staff = staff;
    return next();
  } catch (error) {
    logger.warn("Chill Bro authentication failed", { message: error.message });
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

function safeRecord(data) {
  if (!data || typeof data !== "object") return null;
  const blocked = new Set(["accessToken", "refreshToken", "apiKey", "secret", "password", "ssn"]);
  return Object.fromEntries(Object.entries(data).filter(([key]) => !blocked.has(key)));
}

async function loadDocument(collection, id) {
  if (!id || typeof id !== "string" || id.length > 180) return null;
  try {
    const snap = await db.collection(collection).doc(id).get();
    return snap.exists ? { id: snap.id, ...safeRecord(snap.data()) } : null;
  } catch {
    return null;
  }
}

async function queryRecords(collection, field, value, limit = 6) {
  const cleaned = typeof value === "string" ? value.trim() : value;
  if (!cleaned || String(cleaned).length > 220) return [];
  try {
    const snap = await db.collection(collection).where(field, "==", cleaned).limit(limit).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...safeRecord(doc.data()) }));
  } catch (error) {
    logger.info("Native context query skipped", { collection, field, message: error.message });
    return [];
  }
}

function uniqueRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = record?.id || JSON.stringify(record);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildContext(body) {
  const supplied = body.context && typeof body.context === "object" ? body.context : null;
  const context = { job: null, equipment: null, customerRecord: null, officeRecord: null, serviceHistory: [], supplied };

  if (body.jobId) {
    context.job = await loadDocument("jobs", body.jobId) || await loadDocument("serviceJobs", body.jobId);
    context.customerRecord = await loadDocument("Customers", body.jobId);
  }
  if (body.customerId && !context.customerRecord) context.customerRecord = await loadDocument("Customers", body.customerId);
  if (body.equipmentId) context.equipment = await loadDocument("equipment", body.equipmentId) || await loadDocument("equipmentAssets", body.equipmentId);
  if (body.recordId) {
    context.officeRecord = await loadDocument("submissions", body.recordId) || await loadDocument("officeQueue", body.recordId);
    if (!context.customerRecord) context.customerRecord = await loadDocument("Customers", body.recordId);
  }

  const history = [];
  const assetCandidates = [body.equipmentId, context.equipment?.assetId, context.customerRecord?.assetId, supplied?.currentIntake?.assetId].filter(Boolean);
  for (const assetId of assetCandidates.slice(0, 2)) {
    history.push(...await queryRecords("Customers", "assetId", assetId, 8));
    if (history.length) break;
  }
  if (!history.length) {
    const serialCandidates = [context.equipment?.serialNumber, context.customerRecord?.serialNumber, supplied?.currentIntake?.serialNumber].filter(Boolean);
    for (const serial of serialCandidates.slice(0, 2)) {
      history.push(...await queryRecords("Customers", "serialNumber", serial, 8));
      if (history.length) break;
    }
  }
  if (!history.length) {
    const customerCandidates = [context.customerRecord?.customerName, supplied?.currentIntake?.customerName].filter(Boolean);
    for (const customerName of customerCandidates.slice(0, 2)) {
      history.push(...await queryRecords("Customers", "customerName", customerName, 8));
      if (history.length) break;
    }
  }
  context.serviceHistory = uniqueRecords(history).slice(0, 8);
  return context;
}

async function loadSession(sessionId, uid) {
  if (!sessionId || sessionId.length > 120) return null;
  try {
    const snap = await db.collection("chillBroSessions").doc(sessionId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.uid !== uid) return null;
    return { lastMessage: String(data.lastMessage || "").slice(0, 2500), lastAnswer: String(data.lastAnswer || "").slice(0, 5000) };
  } catch {
    return null;
  }
}

function validImageDataUrl(value) {
  if (typeof value !== "string" || value.length > 6500000) return null;
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return null;
  return value;
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of payload.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function extractSources(payload) {
  const found = [];
  for (const item of payload.output || []) {
    if (item.type === "web_search_call") {
      for (const source of item.action?.sources || item.results || []) {
        found.push({ type: "web", title: source.title || source.url || "Web source", url: source.url || null });
      }
    }
    if (item.type === "file_search_call") {
      for (const result of item.results || []) {
        found.push({ type: "private", title: result.filename || "Chill Pros knowledge", fileId: result.file_id || null, score: result.score ?? null });
      }
    }
    if (item.type === "message") {
      for (const content of item.content || []) {
        for (const annotation of content.annotations || []) {
          const citation = annotation.url_citation || annotation;
          if (citation?.url) found.push({ type: "web", title: citation.title || citation.url, url: citation.url });
          const file = annotation.file_citation || null;
          if (file?.file_id) found.push({ type: "private", title: file.filename || "Chill Pros knowledge", fileId: file.file_id });
        }
      }
    }
  }
  const seen = new Set();
  return found.filter((source) => {
    const key = `${source.type}:${source.url || source.fileId || source.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function routeRequest(message, requestedMode, hasImage) {
  const text = String(message || "").toLowerCase();
  let route = requestedMode || "field-help";
  if (route === "field-help") {
    if (/part number|parts?|supersed|cross[- ]?reference|inducer|contactor|motor|compressor|board/.test(text)) route = "parts";
    else if (/pm\b|preventive|maintenance checklist|inspection program/.test(text)) route = "pm";
    else if (/teach|training|explain why|quiz me|how does/.test(text)) route = "training";
    else if (/no cool|no heat|not running|trip|fault|error code|diagnos|voltage|amp|pressure|superheat|subcool|static/.test(text)) route = "diagnostic";
  }

  const explicitResearch = requestedMode === "web-research";
  const webSignal = explicitResearch || /manual|service bulletin|fault code|error code|part number|supersed|cross[- ]?reference|wiring diagram|specification|refrigerant charge|current|latest|recall|availability/.test(text);
  const complex = route === "diagnostic" || route === "parts" || route === "pm" || explicitResearch || hasImage;
  const highRisk = /gas valve|combustion|carbon monoxide|live voltage|high voltage|refrigerant recovery|pressure test|lockout|bypass safety/.test(text);

  return {
    route,
    model: complex ? "gpt-5.6-terra" : "gpt-5.6-luna",
    reasoning: highRisk ? "high" : complex ? "medium" : "low",
    useWeb: Boolean(webSignal),
    usePrivate: Boolean(VECTOR_STORE_ID),
    stages: [
      "authenticate_staff",
      "collect_page_and_job_context",
      VECTOR_STORE_ID ? "search_private_knowledge" : "private_knowledge_pending_vector_store",
      webSignal ? "research_trusted_web" : "skip_web_for_latency",
      "synthesize_field_answer",
      highRisk ? "elevated_safety_check" : "standard_safety_check",
      "log_run",
    ],
  };
}

const CORE_INSTRUCTIONS = `
You are Chill Bro, the private AI field-service copilot for Chill Pros team members only.
Personality: original laid-back, quick, mischievous field-tech energy. Use occasional natural "bro", "yo", "my guy" or playful reactions, but never let the joke bury the answer. Do not impersonate or claim to be any real actor or copyrighted character.

Your job:
- Technical support for HVAC, refrigeration, ice machines, commercial kitchen equipment and kitchen exhaust.
- Walk technicians through calls one safe test at a time when that is the fastest path.
- Coach Chill Pros PM programs and teach the reason behind each check.
- Help identify and cross-reference parts without guessing.
- Use current job/equipment/service-history context when provided.
- Prefer concise field-ready answers over long essays.

SOURCE AUTHORITY — highest first:
1. Retrieved Chill Pros / FieldForge approved internal procedures, pricing, care-plan programs and company knowledge.
2. Exact OEM manufacturer service literature for the identified model/equipment.
3. OEM parts catalogs / verified distributor cross-references.
4. Established technical training/reference sources.
5. General web information only when better sources are unavailable.

Important source rules:
- Chill Pros internal policy/pricing overrides public websites for company procedures and pricing.
- OEM literature overrides third-party websites for model-specific electrical, refrigerant, sequence-of-operation and service specifications.
- If web sources disagree, say so. Do not blend conflicting values into a fake consensus.
- Never invent citations, model-specific specs, part numbers, prices, service history or measurements.
- For a model-specific answer without enough evidence, ask for model/serial or a clear data-plate photo.

BoodaFlow operating process:
- Identify the technician's actual goal.
- Use the minimum tools needed for a reliable answer; skip web search when internal/native context is enough.
- If a task is blocked by missing information, state the one best next input and continue any independent useful work.
- For diagnostics, return the safest next test, what result means, and the next branch. Avoid parts-cannoning.
- For parts, establish equipment identity -> OEM part -> supersession/cross-reference -> compatibility -> purchasing context.
- For PM, identify program/equipment -> current step -> required observation/measurement -> pass/fail interpretation -> save/next step.
- For training, explain why, then demonstrate, then check understanding if useful.

Safety:
- Respect lockout/tagout, electrical, refrigerant, combustion, pressure and rotating-equipment safety.
- Never recommend permanently bypassing a safety control.
- When risk is elevated, temporarily drop most comedy and be precise.
- Clearly distinguish visual observation, retrieved fact and diagnostic inference.

Trusted public-web families to prioritize when web research is needed:
${TRUSTED_WEB_FAMILIES.map((item) => `- ${item}`).join("\n")}
`;

app.get("/health", requireStaff, (req, res) => {
  res.json({
    ok: true,
    service: "chillBroApi",
    version: 4,
    role: req.staff.role,
    employeeOnly: true,
    boodaFlow: true,
    vision: true,
    privateKnowledge: Boolean(VECTOR_STORE_ID),
    webResearch: true,
  });
});

app.post("/chat", requireStaff, async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const imageDataUrl = validImageDataUrl(req.body?.imageDataUrl);
  if (!message && !imageDataUrl) return res.status(400).json({ error: "Message or image is required." });
  if (message.length > 12000) return res.status(400).json({ error: "Message is too long." });

  const requestedMode = String(req.body?.mode || "field-help").slice(0, 40);
  const route = routeRequest(message, requestedMode, Boolean(imageDataUrl));
  const [context, prior] = await Promise.all([
    buildContext(req.body || {}),
    loadSession(String(req.body?.sessionId || ""), req.user.uid),
  ]);

  const contextText = JSON.stringify(context, null, 2).slice(0, 22000);
  const priorText = prior ? `\nRECENT SESSION CONTEXT:\nTech: ${prior.lastMessage}\nChill Bro: ${prior.lastAnswer}\n` : "";
  const content = [{
    type: "input_text",
    text: `BOODAFLOW ROUTE: ${route.route}\nAUTHENTICATED ROLE: ${req.staff.role}\nFIELD CONTEXT (may be incomplete):\n${contextText}${priorText}\nTECH REQUEST:\n${message || "Inspect the attached field image and state what can be established safely."}`,
  }];
  if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl, detail: "high" });

  const tools = [];
  const include = [];
  if (route.usePrivate) {
    tools.push({ type: "file_search", vector_store_ids: [VECTOR_STORE_ID], max_num_results: 8 });
    include.push("file_search_call.results");
  }
  if (route.useWeb) {
    tools.push({ type: "web_search" });
    include.push("web_search_call.action.sources");
  }

  const runRef = db.collection("chillBroRuns").doc();
  await runRef.set({
    uid: req.user.uid,
    role: req.staff.role,
    requestedMode,
    route: route.route,
    model: route.model,
    reasoning: route.reasoning,
    useWeb: route.useWeb,
    usePrivate: route.usePrivate,
    stages: route.stages,
    status: "running",
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    const body = {
      model: route.model,
      reasoning: { effort: route.reasoning },
      max_output_tokens: route.route === "diagnostic" || route.route === "parts" ? 1800 : 1200,
      instructions: `${CORE_INSTRUCTIONS}\nCurrent authenticated role: ${req.staff.role}. Current BoodaFlow route: ${route.route}.`,
      input: [{ role: "user", content }],
      store: false,
    };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = "auto";
      body.parallel_tool_calls = true;
    }
    if (include.length) body.include = include;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY.value()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      logger.error("OpenAI Chill Bro request failed", { status: response.status, code: payload.error?.code || null });
      await runRef.set({ status: "failed", errorCode: payload.error?.code || null, completedAt: FieldValue.serverTimestamp() }, { merge: true });
      return res.status(502).json({ error: "Chill Bro intelligence is temporarily unavailable." });
    }

    const answer = extractOutputText(payload);
    if (!answer) {
      await runRef.set({ status: "failed", errorCode: "empty_answer", completedAt: FieldValue.serverTimestamp() }, { merge: true });
      return res.status(502).json({ error: "Chill Bro returned no usable answer." });
    }

    const sources = extractSources(payload);
    const sessionId = String(req.body?.sessionId || "").slice(0, 120) || db.collection("chillBroSessions").doc().id;
    await Promise.all([
      db.collection("chillBroSessions").doc(sessionId).set({
        uid: req.user.uid,
        role: req.staff.role,
        mode: requestedMode,
        route: route.route,
        lastMessage: message.slice(0, 4000),
        lastAnswer: answer.slice(0, 8000),
        lastSources: sources.slice(0, 8),
        hadImage: Boolean(imageDataUrl),
        jobId: req.body?.jobId || null,
        equipmentId: req.body?.equipmentId || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      runRef.set({ status: "complete", sourceCount: sources.length, completedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ]);

    return res.json({
      ok: true,
      answer,
      sources,
      sessionId,
      role: req.staff.role,
      visionUsed: Boolean(imageDataUrl),
      contextAvailable: {
        job: Boolean(context.job),
        equipment: Boolean(context.equipment),
        customerRecord: Boolean(context.customerRecord),
        officeRecord: Boolean(context.officeRecord),
        serviceHistory: context.serviceHistory.length,
        supplied: Boolean(context.supplied),
      },
      boodaFlow: {
        runId: runRef.id,
        route: route.route,
        model: route.model,
        reasoning: route.reasoning,
        usedWeb: route.useWeb,
        privateKnowledgeEnabled: route.usePrivate,
        stages: route.stages,
      },
    });
  } catch (error) {
    logger.error("Chill Bro request crashed", { message: error.message });
    await runRef.set({ status: "failed", errorCode: "request_crash", completedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    return res.status(500).json({ error: "Chill Bro request failed safely." });
  }
});

exports.chillBroApi = onRequest({
  region: "us-central1",
  cors: false,
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 120,
  memory: "512MiB",
  maxInstances: 10,
}, app);
