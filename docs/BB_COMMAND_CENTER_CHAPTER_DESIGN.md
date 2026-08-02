# BB Command Center chapter-page design contract

This document records the approved direction for the owner-facing module pages that open from the BB Command Center cover.

## Non-negotiable cover-page rule

The current approved desktop and iPhone Command Center cover artwork remains unchanged. Module work must not replace, recolor, crop, redraw, or recompose the approved cover assets.

## Navigation model

Selecting Jobs, Dispatch, Technicians, Customers, Projects, Alerts, or Settings should open a dedicated full-screen chapter rather than a generic utility sheet. Each chapter must provide a clear Back action that returns to the unchanged cover and restores focus to the control that opened it.

## Shared visual system

Every chapter uses the same world and identity as the approved cover:

- the exact approved illustrated owner character and drawing style;
- matching jeweled title typography used by the desktop Command Center title;
- black crystal/glass surfaces, chrome and diamond framing, emerald highlights, and restrained ice-blue support accents;
- consistent safe areas, navigation behavior, focus treatment, reduced-motion behavior, and mobile/desktop responsiveness;
- functional content placed below or alongside the chapter illustration without covering the character's face or key artwork.

Do not substitute a photorealistic, semi-realistic, or differently proportioned character. Do not generate a new interpretation and treat it as approved.

## Story sequence

The pages should read as chapters in one continuous story:

1. **Home — Command Center cover:** approved artwork; unchanged.
2. **Jobs — Mission Control:** the owner operates the live work-order command room.
3. **Dispatch — Fleet Operations:** the owner commands routes and service vehicles across the city.
4. **Technicians — Field Command:** the owner leads the technician team and field readiness.
5. **Customers — Client Intelligence:** the owner manages customer relationships and commercial accounts.
6. **Projects — Executive Vision:** the owner directs Operations Center, FieldForged, Trade Bot, and future initiatives.
7. **Alerts — Critical Response:** the owner reviews operational exceptions and urgent decisions.
8. **Settings — Owner Control:** the owner manages security, integrations, permissions, and system preferences.

## Jobs chapter — first implementation target

### Artwork brief

Use the exact approved owner character from the cover in a new scene:

- seated in a premium executive command chair;
- operating a holographic work-order table or tablet;
- surrounded by dispatch boards, HVAC/refrigeration schematics, technician status, and a San Antonio service map;
- emerald, diamond-white, chrome, and restrained cyan lighting;
- title treatment uses the same jeweled text identity as the desktop Command Center title;
- no change to facial structure, afro, glasses, jewelry, grill, skin tone, or illustration language.

### Functional content hierarchy

The first production increment should support safe unavailable states before authenticated feeds are connected:

- Active Jobs
- Today's Schedule
- Emergency Calls
- Office Queue
- Technician Status
- Dispatch Queue
- Parts Awaiting Approval
- Revenue Today
- Invoices / collections summary
- Follow-ups

No preview number may be presented as a live operational count. Cards must visibly distinguish `Live`, `Stale`, `Unavailable`, and `Preview` states.

## Asset gate

The Jobs chapter hero cannot be considered visually complete until the owner supplies or approves a Jobs illustration using the exact existing cartoon character. Until then, development may implement only the chapter shell, responsive layout, accessibility, navigation, state contracts, and artwork slot.

## Acceptance criteria

- The Command Center cover is byte-for-byte or visually unchanged except for safe navigation hooks.
- Jobs opens as a full-screen branded chapter on iPhone and desktop, not as the current generic sheet.
- Back navigation returns to the cover and restores keyboard focus.
- The chapter title matches the approved desktop title branding.
- The approved character asset is used without redrawing or reinterpretation.
- Missing live feeds remain explicit and fail closed.
- Reduced motion, keyboard navigation, screen-reader labels, and iPhone safe areas remain supported.
- PR remains draft and is not merged without explicit owner approval and device-level visual review.
