# Chill Pros Standalone Data Contract

Every core object carries `id`, `createdAt`, `updatedAt`, `createdBy`, and `status` where applicable.

## Customer
name, contactName, phone, email, billingAddress, notes

## ServiceLocation
customerId, name, address, accessNotes

## Asset
customerId, locationId, assetTag, equipmentType, manufacturer, modelNumber, serialNumber, siteLocation, warranty, photos, serviceHistoryIds

## ServiceRequest
customerId, locationId, assetId, complaint, priority, requestedWindow, source, status

## Job
requestId, customerId, locationId, assetId, technicianId, scheduledStart, scheduledEnd, dispatchStatus, diagnosis, recommendation, notes, photos, laborEntries, partSelections, quoteId, invoiceId

Dispatch status enum: `unassigned`, `scheduled`, `dispatched`, `en_route`, `on_site`, `paused`, `waiting_parts`, `complete`, `cancelled`.

## PartResearch
jobId, assetId, query, manufacturer, modelNumber, serialNumber, symptom, candidates[], evidence[], confidence, selectedPartId, reviewedBy, reviewedAt

## Part
partNumber, manufacturer, description, alternates[], vendorOptions[], unitCost, markupRule, sellPrice, availability, notes

## Quote
jobId, customerId, assetId, lineItems[], subtotal, discount, tax, depositRequired, total, approvalStatus, approvedAt, approvedBy

Quote status enum: `draft`, `office_review`, `sent`, `approved`, `declined`, `expired`, `converted`.

## Invoice
jobId, quoteId, customerId, lineItems[], subtotal, discount, tax, total, amountPaid, balanceDue, paymentStatus, dueDate

Payment status enum: `draft`, `sent`, `partial`, `paid`, `void`, `past_due`.

## Payment
invoiceId, amount, method, reference, receivedAt, receivedBy, receiptId

## ActivityEvent
entityType, entityId, action, actorId, actorRole, summary, metadata

## Non-negotiable linkage rule
Request -> Job -> Quote -> Invoice -> Payment uses references. Customer, location, asset, diagnosis, and selected-part context must propagate rather than be manually copied into a disconnected record.
