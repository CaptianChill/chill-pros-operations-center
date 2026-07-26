# Chill Pros AI Operations Engine

## Current milestone

The foundation establishes a safe, deterministic, testable operations-intelligence layer that can rank active work, recommend qualified technicians, and produce an owner/office brief without changing production data.

The engine currently provides:

- job-priority scoring based on workflow status, urgency language, record age, assignment state, contact completeness, and estimated value;
- an operational brief with active, urgent, unassigned, and ready-to-invoice counts;
- recommended next actions for intake review, dispatch, quotes, parts follow-up, field progress, and invoice handoff;
- explainable technician recommendations using explicit skills, availability, service area, emergency capability, and active workload;
- explicit exclusion of completed work and inactive technicians from active recommendations;
- a deterministic approval policy that classifies informational, office-review, owner-approval, prohibited, and unknown actions;
- immutable advisory recommendation audit records with stable timestamps, correlation identifiers, and recursive credential redaction;
- a feature-flagged owner-facing Daily Operations Brief UI;
- an advisory-only execution guard that blocks autonomous dispatch, record changes, customer communication, purchasing, quoting, and invoicing.

## Safety boundary

The AI Operations Engine is advisory-only. It must not directly:

- assign or reassign technicians;
- update job status;
- contact customers;
- generate or send binding quotes or invoices;
- order parts;
- modify Firebase, Jobber, payment, or accounting records.

Every operational action requires approval and execution by an authenticated owner or office user. The execution guards intentionally return `allowed: false` for all recommendations in this milestone.

## Feature-flagged Daily Operations Brief

The browser UI is disabled by default. It reads the locally normalized Operations Center queue and renders an explainable brief inside the existing AI view only after this local feature flag is enabled:

```js
localStorage.setItem("chillProsFeatures:aiOperationsBrief", "true");
location.reload();
```

Disable it with:

```js
localStorage.removeItem("chillProsFeatures:aiOperationsBrief");
location.reload();
```

The brief is read-only. Its Refresh button re-reads the local queue, recalculates deterministic recommendations, and renders escaped customer-controlled text. It does not write to Firestore, Jobber, local queue records, or technician assignments.

## Integration contract

Browser usage:

```html
<script src="ai/operations-engine.js"></script>
<script src="ai/daily-operations-brief.js"></script>
```

The AI feature branch loads both modules from `firebase-config.js`. The UI module mounts only when the feature flag is explicitly set to `true`.

Node/test usage:

```js
const {
  buildOperationsBrief,
  recommendTechnicians
} = require("./ai/operations-engine");
const { createAuditRecord } = require("./ai/recommendation-audit");

const brief = buildOperationsBrief(records, { now: new Date().toISOString() });
const candidates = recommendTechnicians(job, technicians);
const auditRecord = createAuditRecord(recommendation, {
  actorRole: "owner",
  tenantId: "chill-pros",
  correlationId: job.id
});
```

The operations brief accepts normalized job/customer records containing the fields already used by the Operations Center, including `officeStatus`, `complaint`, `findings`, `equipmentType`, `createdAt`, `assignedTechnician`, `phone`, `email`, and `estimatedAmount`.

Technician recommendation input should use explicit fields rather than inferred personal data.

Job fields:

- `requiredSkills`: array or comma-separated string, such as `refrigeration`, `r290`, `ice machines`, or `commercial kitchen`;
- `serviceArea`, `city`, or `locationArea`;
- `complaint`, `findings`, and `equipmentType` for urgency detection.

Technician fields:

- `id` or `firestoreId`;
- `name`;
- `skills`: array or comma-separated string;
- `serviceAreas` or `serviceArea`;
- `available`: boolean;
- `active`: boolean;
- `emergencyCapable`: boolean;
- `activeJobCount`: non-negative number.

The output is a ranked explanation only. Every candidate includes `advisoryOnly: true` and `requiresHumanApproval: true`. The function never writes an assignment.

## Recommendation audit contract

`ai/recommendation-audit.js` creates immutable, serializable records for later human review. It does not persist data by itself. Any future persistence adapter must remain owner-controlled and must not alter operational records.

Each audit record includes:

- a normalized UTC timestamp;
- recommendation, action, tenant, source, actor-role, and correlation identifiers;
- explicit `advisoryOnly: true` and `requiresHumanApproval: true` safeguards;
- sanitized evidence and metadata;
- recursive redaction for credential-like keys such as access tokens, refresh tokens, API keys, passwords, secrets, authorization headers, and seed phrases.

The audit helper deliberately avoids storing raw credentials and provides stable key ordering to support deterministic tests and later integrity verification.

## Next milestones

1. Connect technician recommendations to a read-only normalized technician data adapter.
2. Add explainable follow-up flags for quotes, parts, incomplete service notes, and invoice handoff.
3. Add de-identified evaluation fixtures based on real Chill Pros workflows.
4. Add a human-controlled persistence adapter for audit records after the storage and retention policy is approved.
5. Add an external language-model adapter only after provider, budget, privacy, retention, and human-approval policies are approved.
6. Integrate the feature into production only after RC1 is complete and the owner explicitly approves the AI pull request.

## Definition of completion for the foundation milestone

- deterministic engine committed on an isolated AI feature branch;
- automated tests cover ranking, urgency, completed-job exclusion, invoice handoff, missing contact data, technician recommendations, invalid input, safe UI rendering, feature-flag behavior, approval classification, audit redaction, and no-autonomous-execution guards;
- architecture, data contract, feature flag, audit contract, and safety boundary documented;
- feature-flagged owner Daily Operations Brief implemented;
- draft pull request opened into `main`;
- CI green;
- no changes merged into RC1 or production without owner approval.

The deterministic foundation milestone is functionally complete. External language-model integration and audit persistence remain separate milestones requiring owner decisions on provider, budget, privacy, retention, storage, and approval policy.
