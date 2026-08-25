# Parallel Workstream Status

Parent: #60

| Lane | Priority | Status | Current deliverable |
|---|---:|---|---|
| Dispatch + core records | P0 | ACTIVE | Existing intake/queue/jobs/tech assignment retained; normalize status/data linkage next |
| Quote -> Invoice | P0 | ACTIVE | Draft quote, approval states, conversion, payment tracking implemented in custom development |
| AI Parts Intelligence | P0 | ACTIVE | Job-context research/evidence/approval/parts-to-quote handoff implemented; automated retrieval backend next |
| Technician workspace | P1 | ACTIVE | Existing assigned-job dashboard retained; field status/notes/photos/time workflow next |
| Client workspace | P1 | QUEUED | Request/status/quote approval/invoices/history |
| Integration + QA | P0 | ACTIVE | Golden-path and failure-path acceptance checklist committed; preview deployment validation ongoing |

## Immediate next integration targets
1. Replace legacy `Customers`-as-everything storage with linked Customers/Assets/Requests/Jobs records while preserving current data.
2. Add controlled dispatch transitions: scheduled -> dispatched -> en route -> on site -> paused/waiting parts -> complete.
3. Add multi-line quote editor and reusable parts/labor line items.
4. Add invoice PDF/receipt output and payment method/reference fields.
5. Add server-side AI parts research endpoint with OEM/vendor evidence and human review gate.
6. Add technician mobile worklog and client approval portal.
7. Run full service-call golden path and permissions/error-path tests before production promotion.
