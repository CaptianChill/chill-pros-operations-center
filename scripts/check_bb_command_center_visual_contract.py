#!/usr/bin/env python3
"""Fail closed when the approved BB Command Center structure regresses.

This contract intentionally checks stable semantic and PWA hooks rather than pixel
values. Pixel-level desktop and iPhone comparison remains a manual release gate.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "owner-command-center.html"
CSS_PATH = ROOT / "owner-command-center.css"
MANIFEST_PATH = ROOT / "bb-command-center.webmanifest"
LOGO_PATH = ROOT / "assets" / "bb-command-center-logo.svg"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def require(text: str, token: str, label: str) -> None:
    if token not in text:
        fail(f"Missing {label}: {token}")


def read_manifest() -> dict[str, object]:
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Invalid BB Command Center manifest: {exc}")
    if not isinstance(manifest, dict):
        fail("BB Command Center manifest must contain a JSON object")
    return manifest


def validate_manifest(manifest: dict[str, object]) -> None:
    expected = {
        "name": "BB Command Center",
        "short_name": "BB Command",
        "start_url": "./owner-command-center.html",
        "scope": "./",
        "display": "standalone",
        "background_color": "#020406",
        "theme_color": "#020406",
    }
    for key, value in expected.items():
        if manifest.get(key) != value:
            fail(f"Manifest {key!r} must be {value!r}")

    icons = manifest.get("icons")
    if not isinstance(icons, list) or not icons:
        fail("Manifest must define at least one BB Command Center icon")
    if not any(
        isinstance(icon, dict)
        and icon.get("src") == "assets/bb-command-center-logo.svg"
        and icon.get("type") == "image/svg+xml"
        and "maskable" in str(icon.get("purpose", "")).split()
        for icon in icons
    ):
        fail("Manifest must reference the maskable BB SVG logo")


def main() -> None:
    for path in (HTML_PATH, CSS_PATH, MANIFEST_PATH, LOGO_PATH):
        if not path.is_file():
            fail(f"Required BB Command Center asset is missing: {path.relative_to(ROOT)}")

    html = HTML_PATH.read_text(encoding="utf-8", errors="replace")
    css = CSS_PATH.read_text(encoding="utf-8", errors="replace")
    validate_manifest(read_manifest())

    # Approved identity, accessibility, and responsive-shell anchors.
    for token, label in (
        ('<html lang="en">', "document language"),
        ('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"', "safe-area viewport"),
        ('name="theme-color" content="#020406"', "browser theme color"),
        ('<main class="command-shell">', "command shell"),
        ('class="desktop-nav"', "desktop navigation"),
        ('class="mobile-nav"', "mobile navigation"),
        ('class="hero"', "hero"),
        ('class="hero-crown"', "crown"),
        ('class="jewel-rail jewel-rail-left"', "left jeweled rail"),
        ('class="jewel-rail jewel-rail-right"', "right jeweled rail"),
        ('class="project-grid"', "project grid"),
        ('id="mission"', "mission board"),
        ('id="quick"', "quick-access panel"),
        ('role="status" aria-live="polite"', "live status region"),
        ('assets/bb-command-center-logo.svg', "BB logo reference"),
        ('BB COMMAND CENTER', "BB identity"),
    ):
        require(html, token, label)

    # The approved shell must remain personal; operational project names are allowed.
    forbidden_shell_phrases = (
        "CHILL PROS COMMAND CENTER",
        "CHILL PROS OWNER",
        "LICENSE TO CHILL",
    )
    for phrase in forbidden_shell_phrases:
        if phrase in html.upper():
            fail(f"Personal owner shell contains forbidden Chill Pros branding: {phrase}")

    # Require both desktop and phone-specific responsive behavior.
    if len(re.findall(r"@media\s*\(", css)) < 2:
        fail("Expected at least two responsive media-query blocks")
    for selector in (".command-shell", ".jewel-rail", ".project-grid", ".mobile-nav"):
        require(css, selector, f"CSS selector {selector}")

    print("BB Command Center structural and PWA contract is valid.")
    print("Manual gate still required: compare approved desktop and iPhone references side by side.")


if __name__ == "__main__":
    main()
