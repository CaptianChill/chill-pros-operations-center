#!/usr/bin/env python3
"""Fail closed when the approved BB Command Center structure regresses.

This contract intentionally checks stable semantic and PWA hooks rather than pixel
values. Pixel-level desktop and iPhone comparison remains a manual release gate.
"""

from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "owner-command-center.html"
CSS_PATH = ROOT / "owner-command-center.css"
JS_PATH = ROOT / "owner-command-center.js"
MANIFEST_PATH = ROOT / "bb-command-center.webmanifest"
LOGO_PATH = ROOT / "assets" / "bb-command-center-logo.svg"
APPROVED_MOBILE_ARTWORK = "https://github.com/user-attachments/assets/816b9e04-e54e-4c7d-99a0-3783a4ce2269"
APPROVED_DESKTOP_ARTWORK = "https://github.com/user-attachments/assets/28a8189c-3bba-4448-800a-3d07e0b15aab"


class CommandCenterHTMLParser(HTMLParser):
    """Collect IDs and navigational/resource references without external dependencies."""

    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.references: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        element_id = attributes.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)
        for attribute in ("href", "src"):
            value = attributes.get(attribute)
            if value:
                self.references.append((attribute, value))


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


def validate_local_references(html: str) -> None:
    parser = CommandCenterHTMLParser()
    parser.feed(html)

    if parser.duplicate_ids:
        duplicates = ", ".join(sorted(parser.duplicate_ids))
        fail(f"Duplicate element IDs break navigation and JavaScript hooks: {duplicates}")

    for attribute, reference in parser.references:
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or reference.startswith(("mailto:", "tel:", "javascript:")):
            continue

        if reference.startswith("#"):
            target = parsed.fragment
            if target and target not in parser.ids:
                fail(f"Broken in-page navigation target: {reference}")
            continue

        local_path = parsed.path
        if not local_path or local_path == "/":
            continue
        resolved = (HTML_PATH.parent / local_path).resolve()
        try:
            resolved.relative_to(ROOT.resolve())
        except ValueError:
            fail(f"Local {attribute} escapes repository root: {reference}")
        if not resolved.is_file():
            fail(f"Missing local {attribute} target: {reference}")


def validate_approved_reference_mode(js: str) -> None:
    for token, label in (
        (APPROVED_MOBILE_ARTWORK, "approved mobile artwork URL"),
        (APPROVED_DESKTOP_ARTWORK, "approved desktop artwork URL"),
        ("params.get('reference') !== 'approved'", "explicit approved-reference query gate"),
        ('media="(max-width: 767px)"', "mobile artwork breakpoint"),
        ("object-fit: contain", "uncropped artwork rendering"),
        ("object-position: center top", "approved artwork positioning"),
        ("width: 100%; height: auto", "proportional artwork scaling"),
        ("body.approved-reference-mode > :not(#approvedArtworkReference)", "isolated reference rendering"),
        ("return true;", "successful reference-mode signal"),
        ("if (installApprovedArtworkReference()) return;", "reference-mode initialization short circuit"),
    ):
        require(js, token, label)

    if "object-fit: cover" in js or "background-size: cover" in js:
        fail("Approved artwork reference mode must not crop source assets")


def main() -> None:
    for path in (HTML_PATH, CSS_PATH, JS_PATH, MANIFEST_PATH, LOGO_PATH):
        if not path.is_file():
            fail(f"Required BB Command Center asset is missing: {path.relative_to(ROOT)}")

    html = HTML_PATH.read_text(encoding="utf-8", errors="replace")
    css = CSS_PATH.read_text(encoding="utf-8", errors="replace")
    js = JS_PATH.read_text(encoding="utf-8", errors="replace")
    validate_manifest(read_manifest())
    validate_local_references(html)
    validate_approved_reference_mode(js)

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
        ('<strong>LICENSE TO CHILL</strong>', "approved footer slogan"),
    ):
        require(html, token, label)

    forbidden_shell_phrases = (
        "CHILL PROS COMMAND CENTER",
        "CHILL PROS OWNER",
    )
    for phrase in forbidden_shell_phrases:
        if phrase in html.upper():
            fail(f"Personal owner shell contains forbidden Chill Pros branding: {phrase}")

    if len(re.findall(r"@media\s*\(", css)) < 2:
        fail("Expected at least two responsive media-query blocks")
    for selector in (".command-shell", ".jewel-rail", ".project-grid", ".mobile-nav"):
        require(css, selector, f"CSS selector {selector}")

    print("BB Command Center structural, navigation, approved-artwork, asset, and PWA contract is valid.")
    print("Manual gate still required: compare approved desktop and iPhone references side by side.")


if __name__ == "__main__":
    main()
