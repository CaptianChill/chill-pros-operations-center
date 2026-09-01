# Chill Pros Mobile UI Polish Plan

## Objective
Create a professional, clean, and consistent field-service interface without changing application behavior, authentication, authorization, Firestore access, or operational workflows.

## Workstream isolation

- Branch: `feature/mobile-ui-polish`
- Tracks: Issue #16
- Must not absorb functional changes from RC1 Issue #15 or the AI Operations Engine branch.
- Conflicting functional changes must be deferred until the relevant branch is reconciled.

## Design direction

The target is modern field-service software with restrained Chill Pros branding. Operational information must take priority over promotional artwork.

### Visual principles

1. One consistent typography scale.
2. One spacing system based on reusable tokens.
3. Consistent cards, buttons, inputs, badges, and navigation.
4. Reduced glow effects, borders, and decorative noise.
5. Smaller, more deliberate brand placement.
6. Clear distinction between owner and technician interfaces.
7. Accessible contrast, focus indicators, and touch targets.
8. Professional empty, loading, success, warning, and error states.

## Phase 1: iPhone shell

- Simplify top navigation.
- Reduce banner height and visual dominance.
- Standardize page headers and section titles.
- Normalize card padding, radius, border, and shadow.
- Improve mobile touch targets and horizontal overflow behavior.
- Make account/role state clear without covering content.

## Phase 2: workflow components

- Customer intake forms.
- Office Queue cards and status controls.
- Today's Jobs cards and filters.
- Technician Management and Technician Dashboard.
- Buttons, selects, text inputs, labels, validation, and empty states.

## Phase 3: responsive desktop/tablet alignment

- Reuse the mobile design tokens.
- Preserve data density on larger screens.
- Keep navigation and hierarchy consistent across device classes.

## Safety and regression requirements

- No backend or Firestore-rule changes.
- No role-routing changes.
- No new write capabilities.
- Existing IDs and JavaScript hooks must remain stable unless tests are updated in the same change.
- Add structural or visual regression checks where feasible.
- Validate representative iPhone widths and desktop widths.

## Definition of done

- The iPhone interface looks like a production field-service application.
- Owner and technician pages use a consistent shell while retaining correct role-specific access.
- Core workflows remain unchanged and pass CI.
- The branch is reviewed separately from RC1 security and role-routing fixes.
