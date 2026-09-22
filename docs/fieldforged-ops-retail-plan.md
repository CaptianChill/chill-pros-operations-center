# FieldForged Ops Retail Product Plan

## Product identity

**Product:** FieldForged Ops  
**Default edition:** Contractor Edition  
**Company:** FieldForged Technologies  
**Positioning:** Field-service operations software built from real contractor workflows.

FieldForged Ops repackages the validated Chill Pros Operations Center workflow into a configurable retail product. The original Chill Pros production interface remains unchanged while retail development proceeds in the `retail/` application shell.

## Commercial editions

### Contractor

- $500 onboarding and configuration
- $149 per month
- Up to 5 users
- Customer and equipment intake
- Job queue, scheduling and assignment
- Findings and recommendation documentation
- Equipment records
- Quote and approval tracking
- Standard FieldForged branding

### Growth

- $1,000 onboarding and configuration
- $299 per month
- Up to 15 users
- Contractor features
- Advanced reports
- Maintenance workflows
- Parts workflow
- Priority onboarding support

### White Label

- Starting at $3,500 implementation
- Starting at $599 per month
- Up to 30 users at launch
- Custom logo, colors and company terminology
- Custom domain
- Private branded login and workspace
- Optional removal of visible FieldForged branding
- Managed updates and support

Pricing is a launch hypothesis and should be validated with founding customers before becoming permanent.

## Architecture rule

One maintained core application serves all editions. Tenant configuration controls:

- company identity
- logo and colors
- terminology
- enabled modules
- domain mapping
- user allowance
- visible FieldForged attribution

White-label deployments must not become independent code forks. Customer-specific forks would increase support cost, delay updates and create security inconsistencies.

## Retail launch boundary

The current prototype is suitable for:

- product demonstrations
- founding-customer sales conversations
- usability review
- branding previews
- manual concierge onboarding design

It is not yet approved for unrestricted paid customer data.

Before production onboarding, complete:

1. Tenant-isolated Firestore paths and security rules.
2. Tenant-aware authentication and role assignment.
3. Removal of hardcoded Chill Pros owner identity and assets.
4. Server-side workspace provisioning.
5. Subscription checkout and webhook-based account status.
6. Terms, privacy policy and data-processing disclosures.
7. Backups, audit logging and account deletion workflow.
8. Production tests for cross-tenant access denial.
9. Branded transactional email and support workflow.
10. Deployment runbook for retail and custom-domain tenants.

## #BoodaFlow execution sequence

### Phase 1 — Extract

- Preserve the existing Chill Pros production application.
- Isolate retail work on a separate branch and application path.
- Inventory reusable intake, queue, technician and authentication logic.

### Phase 2 — Reframe

- Replace trade-specific Chill Pros branding with FieldForged retail identity.
- Use modern neutral terminology that supports HVAC, refrigeration, plumbing, electrical and commercial service companies.
- Define Contractor, Growth and White Label editions.

### Phase 3 — Productize

- Move branding and feature access into tenant configuration.
- Implement tenant-isolated data storage and access control.
- Connect the redesigned interface to the existing validated workflow logic.

### Phase 4 — Validate

- Run Chill Pros as the internal reference tenant.
- Create a sanitized demonstration tenant.
- Onboard three founding contractors through a managed beta.
- Measure setup time, office time saved, quote cycle time and feature usage.

### Phase 5 — Retail

- Add subscription checkout and account provisioning.
- Publish sales page, demo, onboarding form and support terms.
- List the managed-beta implementation on contractor networks, Upwork, Fiverr and Contra.

## Initial success criteria

- A new contractor can understand the product in under two minutes.
- Branding can be changed without editing application markup.
- Every operational record includes a tenant identifier.
- A user from one tenant cannot read or modify another tenant's data.
- A founding customer can be provisioned without changing core application code.
- The first paid implementation produces a documented #BoodaFlow case study.
