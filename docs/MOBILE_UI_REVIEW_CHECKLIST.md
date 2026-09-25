# Mobile UI Rendered Review Checklist

Use this checklist before the mobile polish pull request leaves draft. The review is presentation-only and must not change authentication, Firestore rules, role routing, job assignment, or operational data behavior.

## Test surfaces

Review the deployed branch in Safari at these representative viewport widths:

- 320 px — legacy/small iPhone width
- 375 px — standard compact iPhone width
- 390 px — current standard iPhone width
- 430 px — large iPhone width
- landscape orientation at the smallest supported height

Repeat the critical checks in Private Browsing to avoid stale CSS or service-worker state.

## Shell and navigation

- The account strip remains readable below the iPhone safe area.
- The active navigation item is visually distinct and exposes `aria-current="page"` where supported.
- Every navigation and action control has a usable 44 px minimum touch target.
- Long labels truncate or wrap without pushing the page wider than the viewport.
- The More menu opens, traps no focus, closes with Escape, and returns focus to its trigger.
- Bottom navigation does not overlap page content or the home indicator.

## Typography and hierarchy

- Page title, section title, body text, labels, helper text, and badges use a consistent hierarchy.
- No operational text is hidden by decorative art, gradients, or branding.
- Text remains readable at 200% browser zoom without horizontal page scrolling.
- Placeholder text remains distinguishable from entered values.

## Forms and controls

- Inputs, selects, and textareas render at 16 px or larger to prevent iOS focus zoom.
- Labels remain associated with their controls.
- Required, invalid, disabled, loading, success, warning, and error states are visually distinct.
- Keyboard focus is visible for buttons, links, inputs, selects, textareas, and custom focusable controls.
- Textareas resize without breaking the layout.

## Cards, tables, and operational content

- Cards have consistent radius, border, padding, and vertical rhythm.
- KPI cards scroll horizontally without moving the entire page.
- Tables remain usable in their horizontal scroll container.
- Status badges do not clip long values.
- Empty, loading, and error states explain what happened without appearing like missing content.

## Accessibility and device settings

- VoiceOver announces the loading state and the embedded application title.
- Focus order follows the visual order.
- Reduced Motion removes nonessential animation and smooth scrolling.
- Increased Contrast/forced-colors mode retains visible boundaries and focus indicators.
- Color is not the only indicator of status or validation failure.

## Role-specific visual verification

Run only after the RC1 role fix is available on the preview surface:

- Owner account displays owner-specific labels and controls.
- Technician account displays technician-specific labels and assigned-work context.
- Role-specific content is not visually exposed during initial loading or refresh.

This checklist verifies presentation only. Authorization and assigned-job isolation remain governed by the RC1 security and technician-access test plan.

## Evidence to record

For each tested width, capture:

- viewport width and device/browser
- branch commit SHA
- screenshots of the dashboard, navigation, one form, one table/list, and one empty/error state
- observed defects and severity
- pass/fail decision

Do not merge the visual branch until critical layout or accessibility defects are resolved and the owner has reviewed the preview.