# Owner Command Center authorization validation

Use this checklist before PR #50 leaves draft. The authorization contract is intentionally fail-closed: a signed-in Firebase user is not enough by itself; the matching authoritative `Users/{uid}` document must exist and contain the exact role `owner`.

## Preconditions

- Deploy the PR #50 preview without merging it into `main`.
- In Firebase Authentication, confirm the preview hostname is listed under **Authentication → Settings → Authorized domains**.
- Confirm the intended owner account exists in Firebase Authentication.
- Confirm Firestore contains `Users/{uid}` for that account with:

```json
{
  "role": "owner"
}
```

- Do not add an email-based bypass or duplicate role value in browser storage.

## iPhone owner-path validation

1. Open the PR preview in Safari on the iPhone.
2. Sign in with the intended owner account.
3. Confirm the private Command Center does not render before authentication and role verification finish.
4. Confirm the owner shell renders only after `Users/{uid}` resolves with `role: "owner"`.
5. Refresh the page and confirm the authorized session recovers without exposing a signed-out frame containing private data.
6. Close Safari, reopen the preview, and confirm session restoration remains fail-closed while Firebase initializes.
7. Capture the preview URL, device model, iOS version, account UID, local timestamp, and one screenshot of the authorized state.

## Negative-path validation

Run each case separately and restore the correct owner profile afterward.

### Signed out

- Sign out and reload.
- Expected: private content remains hidden and the signed-out state is shown.
- Expected code: `auth/signed-out`.

### Wrong role

- Use a test account whose authoritative profile has `role: "office"` or `role: "technician"`.
- Expected: access is denied, the account is signed out, and private content never renders.
- Expected code: `auth/not-owner-account`.

### Missing profile

- Use a test account with no `Users/{uid}` document.
- Expected: access is denied and the account is signed out.
- Expected code: `auth/owner-profile-missing`.

### Malformed profile

- Use a test profile with a missing, differently cased, array-valued, or otherwise invalid `role` field.
- Expected: access is denied and the account is signed out.
- Expected code: `auth/owner-profile-invalid` or `auth/not-owner-account`, depending on the malformed shape.

### Unauthorized domain

- Test only on a disposable hostname that is intentionally absent from Firebase authorized domains.
- Expected: Firebase rejects sign-in and no private content appears.
- Record the exact Firebase error code and hostname.

### Firestore/profile read failure

- Use a controlled test rule or offline condition that prevents the profile read.
- Expected: access is denied, the account is signed out, and the failure is not represented as an authorized empty state.
- Expected code: `auth/owner-profile-unavailable` or `auth/owner-profile-timeout`.

## Regression checks

- Technician and office entry points retain their existing routing.
- No owner email is embedded as an authorization rule.
- No private customer, job, quote, invoice, receipt, supplier, or Field Proof data is requested before owner authorization succeeds.
- Browser back/forward navigation does not reveal previously rendered private content after sign-out or rejection.
- Console output contains no credentials, tokens, customer data, or full profile payloads.

## Evidence record

Record the following in the PR conversation:

- Preview URL and commit SHA.
- Date and local time.
- Device/browser used.
- Owner UID tested; do not post passwords, tokens, or private keys.
- Pass/fail for each positive and negative path.
- Exact error code for every failure.
- Screenshot links with customer information removed or obscured.
- Rollback action verified.

## Release gate

Keep PR #50 in draft until:

- the GitHub Actions authorization contract is green;
- Vercel preview deployment succeeds;
- owner, signed-out, wrong-role, missing-profile, and profile-read-failure paths are validated;
- PR #48 integration is reconciled without weakening this boundary; and
- the owner gives explicit merge approval.
