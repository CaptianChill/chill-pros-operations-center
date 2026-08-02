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

## Canonical owner-character lock

The owner approved one illustrated character reference as the permanent likeness standard for every chapter. Future artwork must preserve that reference's:

- facial structure, face shape, eyebrows, nose, smile, beard/goatee, ears, and skin tone;
- large rounded afro silhouette, density, hairline, and warm rim-light treatment;
- black rectangular sunglasses and diamond stud earrings;
- wide, highly detailed diamond grill with individually readable stones;
- layered diamond chains, rings, bracelets, watch, and Chill Pros pendant with strong controlled sparkle;
- energetic cartoon/anime proportions and confident expression.

The approved chapter scene may change clothing, pose, room, tools, and supporting characters, but it must not reinterpret the owner's face or hair. A close-enough replacement is not acceptable. Production chapter art remains gated until the final asset visibly matches the canonical reference.

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

## Technicians chapter — approved composition

The landscape Technicians / Field Command draft is approved as the composition and information architecture baseline, subject to one required art correction: replace the central owner's face and hair with the canonical owner-character likeness without changing the surrounding scene or dashboard.

### Approved scene

- full-width command hangar with Chill Pros vans, technicians, tools, cylinders, and a live San Antonio technician map;
- owner centered as team leader, standing behind or beside a technician and directing field operations;
- jeweled `COMMAND CENTER` title with `TECHNICIANS` subtitle;
- `LICENSED TO CHILL` environmental sign inside the hangar;
- black glass, chrome, diamond, emerald, and cyan visual system matching the Jobs chapter;
- desktop landscape composition first, followed by a dedicated upright mobile composition using the same scene and data hierarchy.

### Approved functional hierarchy

- Technicians Online and availability states
- Live Technician Map and route optimization
- Technician Performance
- Time Clock
- Certifications
- Live Locations
- Equipment Status
- Today's Scheduled Maintenance
- persistent chapter navigation and alert state

### Required correction before production use

- Copy the canonical owner's facial structure, afro, sunglasses, smile, grill, beard, skin tone, and jewelry treatment into the approved Technicians composition.
- Do not alter the vans, supporting technicians, module arrangement, copy hierarchy, title treatment, diamond border, or overall hangar composition while correcting the owner likeness.
- The current draft is an approved layout reference, not yet the final production asset.

## Asset gates

- The Jobs chapter hero cannot be considered visually complete until the owner supplies or approves a Jobs illustration using the canonical character.
- The Technicians chapter cannot be considered visually complete until the approved draft receives the canonical face-and-hair correction.
- Until each asset gate clears, development may implement the chapter shell, responsive layout, accessibility, navigation, state contracts, and artwork slot, but must not ship substitute character art.

## Acceptance criteria

- The Command Center cover is byte-for-byte or visually unchanged except for safe navigation hooks.
- Jobs and Technicians open as full-screen branded chapters on iPhone and desktop, not as generic sheets.
- Back navigation returns to the cover and restores keyboard focus.
- Chapter titles match the approved desktop title branding.
- The canonical owner character is used without redrawing or reinterpretation.
- Missing live feeds remain explicit and fail closed.
- Reduced motion, keyboard navigation, screen-reader labels, and iPhone safe areas remain supported.
- PR remains draft and is not merged without explicit owner approval and device-level visual review.
