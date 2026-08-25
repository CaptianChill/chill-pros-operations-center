# Chill Pros Standalone — BoodaFlow Execution Board

Parent: #60

## Operating rule
- Production stays stable until acceptance tests pass.
- All implementation lands on `custom-development`.
- No retail, white-label, FieldForged sales surface, or plugin dependency in the Chill Pros owner product.
- Shared record IDs flow from request -> job -> quote -> invoice -> payment so core data is never retyped.
- AI drafts/researches; human users approve customer-facing price, order, and payment actions.

## Parallel workstreams

### A. Dispatch + core records [P0]
Customer, site, asset, request, job, technician, schedule, status timeline, audit history, search.
Acceptance: dispatcher can create and assign a real service call in under 60 seconds.

### B. Quote -> invoice engine [P0]
Reusable line items, labor, parts, tax, discount, deposit, approval, convert quote to invoice, balance/payment history.
Acceptance: completed job converts to invoice without re-entering customer/equipment/job details.

### C. AI Parts Intelligence [P0]
Job-context research, OEM/cross reference, evidence/confidence, vendor cost, parts library, transfer selected part into quote/job/invoice.
Acceptance: a technician/dispatcher can research a part from an active asset and hand it to pricing without retyping model/serial.

### D. Technician workspace [P1]
Today jobs, status controls, time, notes, photos, diagnosis, recommendations, AI parts research, customer acknowledgment.
Acceptance: mobile-first field flow from dispatch to completion.

### E. Client workspace [P1]
Request service, appointment status, quote approval, equipment/service history, invoices/receipts, payment entry.
Acceptance: client can approve a quote and retrieve invoice/history without office intervention.

### F. Integration + QA [P0]
Permissions, Firebase security/data integrity, offline/error states, duplicate prevention, mobile/desktop smoke tests, full request-to-payment test.
Acceptance: full golden-path test passes and blocked/error paths fail safely.

## Release gate
Do not merge to production until the golden path succeeds:
1. Intake service request
2. Assign technician + schedule
3. Technician opens job and records diagnosis
4. Run parts research in job context
5. Add approved parts/labor to quote
6. Customer approves quote
7. Complete job
8. Convert to invoice
9. Record payment/receipt
10. Service history shows the complete chain
