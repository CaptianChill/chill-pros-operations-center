# Chill Pros Golden Path Acceptance

## Real service-call test
Use one test customer and one real-shaped asset record. No manually editing storage between steps.

- [ ] Owner/dispatcher creates or finds customer.
- [ ] Owner/dispatcher creates/finds location and asset.
- [ ] Service request is created with complaint and priority.
- [ ] Request becomes a job with same customer/location/asset references.
- [ ] Dispatcher schedules and assigns technician.
- [ ] Technician sees job on mobile and can mark en route/on site.
- [ ] Technician records diagnosis, notes, labor, and photos/references.
- [ ] Parts research launches with job + manufacturer/model/serial prefilled.
- [ ] Research output contains candidate part, evidence/source, confidence, vendor/cost fields.
- [ ] Human selects/approves a part candidate.
- [ ] Selected part transfers to job/quote without retyping identifying information.
- [ ] Labor and part line items create a draft quote.
- [ ] Office can edit markup/tax/discount/deposit before sending.
- [ ] Client can approve or decline quote.
- [ ] Approved quote links back to job.
- [ ] Job can be completed only with completion notes/status.
- [ ] Completed job converts to invoice with approved line items and customer/job/asset context preserved.
- [ ] Payment can be recorded and balance recalculates.
- [ ] Receipt/payment event is visible in invoice history.
- [ ] Asset service history shows request, job, diagnosis, parts, quote, invoice, and completion.

## Failure-path gates
- [ ] Duplicate submit does not create duplicate jobs/invoices.
- [ ] Invalid status transition is rejected.
- [ ] Technician cannot alter owner-only pricing controls.
- [ ] Client cannot see other clients' records.
- [ ] AI cannot send quote/order/invoice by itself.
- [ ] Missing network/data source produces recoverable state instead of deleting work.
- [ ] Refresh/reopen does not lose persisted service-call data.

## Release
Production promotion requires all P0 golden-path and failure-path checks to pass on the `custom-development` preview.