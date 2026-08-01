# BB Command Center visual review

This checklist is the manual release gate for Issue #43 and draft PR #48. It supplements the automated Owner Homepage and BB Command Center Visual contracts; it does not replace device-level review.

## Reference requirement

Review the deployed preview against the approved desktop and iPhone artwork attached to Issue #43. Do not approve a simplified substitute layout.

## iPhone 12 Pro Max review

Use Safari at the normal portrait orientation.

- Confirm the full owner portrait, crown, jeweled frame, header typography, operations modules, and `LICENSE TO CHILL` footer render without horizontal scrolling.
- Confirm the desktop image is not shown at mobile width.
- Confirm hotspot controls align with the visible labeled areas and do not overlap unrelated artwork.
- Open each available hotspot panel and confirm the bottom sheet is readable, scrollable, and dismissible by its close button, backdrop tap, and Escape when a keyboard is attached.
- Confirm focus returns to the hotspot that opened the panel.
- Confirm the page remains usable after adding it to the Home Screen and launching in standalone mode.
- Confirm external GitHub links open safely and internal Operations Center links resolve to the intended page.
- Enable Reduce Motion and confirm panel transitions no longer animate.
- Test at 430 px and 390 px CSS viewport widths when browser developer tools are available.

## Desktop review

Review at 1440 x 900 and 1920 x 1080.

- Confirm the approved desktop artwork fills the command-center canvas without distortion or clipping.
- Confirm portrait, jeweled rails, top navigation, left status stack, right operations and quick-action modules, and footer match the approved composition.
- Confirm all hotspot controls align with their visible targets at both widths.
- Navigate all hotspots with Tab and Shift+Tab; the focused target must be visibly outlined.
- Open and close every panel using keyboard controls and confirm focus restoration.
- Confirm no unexpected vertical or horizontal scrollbar is introduced by overlays.

## Failure evidence

For any mismatch, record:

1. device and browser;
2. viewport or screen size;
3. preview URL and commit SHA;
4. screenshot or screen recording;
5. affected module or hotspot;
6. whether the failure reproduces after a hard refresh.

Attach the evidence to Issue #43 and keep PR #48 in draft.

## Approval gate

PR #48 may leave draft only when:

- both automated contracts pass on the current head;
- iPhone and desktop checks above pass against the approved artwork;
- no functional link or panel regression is found;
- the owner explicitly approves the visual result.

Do not merge into `main` without explicit owner approval.
