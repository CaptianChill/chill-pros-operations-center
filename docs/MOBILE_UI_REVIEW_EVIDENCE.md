# Mobile UI Review Evidence

Use this document to record rendered-device evidence before PR #17 is considered ready for review. This is a presentation-only validation artifact; it does not authorize functional, authentication, Firestore, or role-routing changes.

## Build under review

- Branch: `feature/mobile-ui-polish`
- Commit SHA: _record before testing_
- Preview URL: _record deployed preview_
- Reviewer: _name_
- Review date: _YYYY-MM-DD_

## Required device matrix

| Viewport / device | Browser mode | Owner shell | Technician shell | Result | Evidence |
|---|---|---:|---:|---|---|
| 320 px width | Responsive emulator | Required | Required | Pending | Screenshot/link |
| 375 px width | iPhone Safari | Required | Required | Pending | Screenshot/link |
| 390 px width | iPhone Safari Private | Required | Required | Pending | Screenshot/link |
| 430 px width | iPhone Safari | Required | Required | Pending | Screenshot/link |
| iPad portrait | Safari | Required | Required | Pending | Screenshot/link |
| Desktop 1366 px | Browser | Required | Optional | Pending | Screenshot/link |

## Visual acceptance evidence

Record **Pass**, **Fail**, or **Not applicable**, plus a screenshot or concise note.

| Check | Status | Evidence / notes |
|---|---|---|
| Branding is recognizable but does not dominate operational content | Pending | |
| Header, navigation, cards, forms, buttons, and badges use a consistent visual system | Pending | |
| Text hierarchy remains readable without excessive glow or decorative noise | Pending | |
| No horizontal overflow at supported mobile widths | Pending | |
| Safe-area insets protect top and bottom controls on iPhone | Pending | |
| Primary actions remain visible and have adequate touch targets | Pending | |
| Form labels, inputs, validation, and focus states are clear | Pending | |
| Empty, loading, success, and error states remain legible | Pending | |
| Keyboard focus is visible and navigation order is logical | Pending | |
| Reduced-motion preference removes nonessential motion | Pending | |
| Owner and technician shells remain visually distinct | Pending | |
| No owner-only controls appear in technician screenshots | Pending | |

## Functional non-regression spot checks

These checks confirm that visual changes did not disrupt existing hooks. They do not replace RC1 or authorization testing.

| Workflow | Status | Evidence / notes |
|---|---|---|
| Navigation changes views correctly | Pending | |
| Customer intake form remains usable | Pending | |
| Office Queue controls remain reachable | Pending | |
| Today's Jobs controls remain reachable | Pending | |
| Technician dashboard controls remain reachable | Pending | |
| Sign-out control remains reachable | Pending | |

## Defects

| Severity | Viewport | Description | Reproduction | Owner decision needed? |
|---|---|---|---|---|
| | | | | |

## Review outcome

- [ ] Mobile visual milestone approved for PR review
- [ ] Changes required before review
- [ ] Functional regression found; route to matching non-visual workstream

Reviewer notes:

_Enter concise decision and any required adjustments._
