# BB Command Center visual review

Use this checklist before PR #45 is moved out of draft. The approved desktop and iPhone artwork remains the visual source of truth; automated structural checks do not replace this review.

## Required test surfaces

- Desktop viewport: 1440 × 900 CSS pixels.
- Laptop viewport: 1280 × 800 CSS pixels.
- iPhone 12 Pro Max viewport: 428 × 926 CSS pixels.
- iPhone narrow regression viewport: 390 × 844 CSS pixels.
- Standalone PWA launch from the iPhone Home Screen.

## Identity and composition

- The diamond-filled `BB` mark is used for browser, PWA, and navigation identity.
- The jeweled emerald/diamond frame is visible and balanced without covering content.
- Crown, portrait area, title, project modules, mission board, quick access, and footer read as one visual system.
- The personal owner shell does not display `Chill Pros Command Center` or `Chill Pros Owner` branding.
- `Operations Center` appears only where it identifies the project or destination.
- The footer displays `LICENSE TO CHILL` exactly once.
- No substitute portrait is used; the approved owner portrait must be the final asset.

## Desktop review

- Top navigation remains on one line and every destination is reachable by keyboard.
- Main project cards align without clipped borders, overlapping text, or uneven heights.
- Left and right jeweled rails remain outside primary text and controls.
- Mission, approvals, and quick-access panels remain readable at 1280 and 1440 widths.
- Focus indicators are visible on every link and button.
- No horizontal page scrolling occurs.

## iPhone review

- Safe-area padding prevents the header and bottom navigation from colliding with the notch or Home indicator.
- The mobile navigation remains fixed, readable, and does not obscure the final footer or controls.
- The portrait area, project cards, and lower panels use the same visual language as desktop rather than a simplified substitute design.
- All tap targets are at least 44 × 44 CSS pixels or have equivalent spacing.
- Text remains readable without pinch zoom.
- No horizontal scrolling, clipped jeweled rails, or overlapping modules occur.
- Rotation to landscape does not trap content or hide navigation.

## Functional smoke checks

- Operations Center opens `index.html`.
- Development Board opens the repository issues page.
- Trade Bot and Operations draft-PR links open the intended GitHub pages.
- In-page Home, Projects, Mission, and Quick navigation lands on an existing target.
- Status-note buttons announce their message through the live status region.
- Reloading the standalone PWA returns to `owner-command-center.html`.
- Missing network access produces an understandable unavailable state and does not expose secrets.

## Evidence to record on PR #45

- Desktop screenshot at 1440 × 900.
- iPhone 12 Pro Max screenshot at 428 × 926.
- Short note confirming Home Screen standalone launch.
- Any visual deviations from the approved artwork, with an explicit accept/fix decision.
- Reviewer name or GitHub account and review date.

## Release gate

Keep PR #45 in draft until the approved portrait is present, both screenshots are attached, all automated checks are green, and the owner explicitly approves the final desktop and iPhone presentation. Never merge into `main` without that approval.
