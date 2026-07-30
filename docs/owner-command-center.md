# Owner Command Center

The Owner Command Center is a private monitoring page for Chill Pros Operations Center, FieldForge Technologies, and Crypto AI Signal Lab.

## Open locally or after deployment

Navigate to `owner-command-center.html` from the same hosting root as the Operations Center.

## Phase 1

- Desktop-first and responsive mobile layout.
- Three visually separated project cards.
- Direct links to each detailed workspace or GitHub workstream.
- Local Operations Center metrics when compatible local-storage records are present.
- Explicit paper-only Crypto AI status.
- No secrets, wallet controls, seed phrases, live order controls, leverage, or funded-account permissions.

## Planned integrations

1. Server-side GitHub status aggregation for issues, pull requests, commits, CI, and approvals.
2. Firebase summary endpoints for jobs, technicians, office queue, Field Proof drafts, and verified cases.
3. Owner authentication and access control.
4. Personal themes, configurable widgets, backgrounds, and shortcuts.

GitHub and Firebase credentials must never be embedded in browser JavaScript. Live integrations must use authenticated server-side endpoints and visibly report stale or unavailable data.
