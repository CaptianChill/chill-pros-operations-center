#!/usr/bin/env python3
"""Fail closed when the approved BB Command Center structure regresses.

The contract checks semantic/PWA hooks rather than pixel values. Desktop and
phone artwork comparison remains a manual release gate.
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
UNSAFE_REFERENCE_SCHEMES = {"data", "javascript", "vbscript"}


class CommandCenterHTMLParser(HTMLParser):
    """Collect structural hooks and references without external dependencies."""

    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.classes: set[str] = set()
        self.references: list[tuple[str, str]] = []
        self.blank_target_links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        element_id = attributes.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)
        self.classes.update(str(attributes.get("class", "")).split())
        for attribute in ("href", "src"):
            value = attributes.get(attribute)
            if value:
                self.references.append((attribute, value))
        if tag == "a" and str(attributes.get("target", "")).lower() == "_blank":
            self.blank_target_links.append(
                (str(attributes.get("href", "")), str(attributes.get("rel", "")))
            )


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def require(text: str, token: str, label: str) -> None:
    if token not in text:
        fail(f"Missing {label}: {token}")


def require_all(text: str, requirements: tuple[tuple[str, str], ...]) -> None:
    for token, label in requirements:
        require(text, token, label)


def require_classes(parser: CommandCenterHTMLParser, requirements: tuple[tuple[str, str], ...]) -> None:
    for class_name, label in requirements:
        if class_name not in parser.classes:
            fail(f"Missing {label} class: {class_name}")


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
    if not isinstance(icons, list) or not any(
        isinstance(icon, dict)
        and icon.get("src") == "assets/bb-command-center-logo.svg"
        and icon.get("type") == "image/svg+xml"
        and "maskable" in str(icon.get("purpose", "")).split()
        for icon in icons
    ):
        fail("Manifest must reference the maskable BB SVG logo")


def parse_html(html: str) -> CommandCenterHTMLParser:
    parser = CommandCenterHTMLParser()
    parser.feed(html)
    parser.close()
    return parser


def validate_local_references(html: str) -> None:
    parser = parse_html(html)
    if parser.duplicate_ids:
        fail("Duplicate element IDs break navigation and JavaScript hooks: " + ", ".join(sorted(parser.duplicate_ids)))
    for href, rel in parser.blank_target_links:
        rel_tokens = {token.lower() for token in rel.split()}
        if "noopener" not in rel_tokens and "noreferrer" not in rel_tokens:
            fail(f"New-tab link must prevent opener access: {href or '<missing href>'}")
    for attribute, reference in parser.references:
        if any(ord(character) < 32 or ord(character) == 127 for character in reference):
            fail(f"Control characters are prohibited in {attribute} references: {reference!r}")
        if reference.startswith("//"):
            fail(f"Protocol-relative external {attribute} reference is prohibited: {reference}")
        parsed = urlsplit(reference)
        scheme = parsed.scheme.lower()
        if scheme in UNSAFE_REFERENCE_SCHEMES:
            fail(f"Unsafe active-content {attribute} reference is prohibited: {reference}")
        if scheme or parsed.netloc or reference.startswith(("mailto:", "tel:")):
            continue
        if reference.startswith("#"):
            if parsed.fragment and parsed.fragment not in parser.ids:
                fail(f"Broken in-page navigation target: {reference}")
            continue
        if not parsed.path or parsed.path == "/":
            continue
        resolved = (HTML_PATH.parent / parsed.path).resolve()
        try:
            resolved.relative_to(ROOT.resolve())
        except ValueError:
            fail(f"Local {attribute} escapes repository root: {reference}")
        if not resolved.is_file():
            fail(f"Missing local {attribute} target: {reference}")


def validate_approved_reference_mode(js: str) -> None:
    require_all(js, (
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
    ))
    if "object-fit: cover" in js or "background-size: cover" in js:
        fail("Approved artwork reference mode must not crop source assets")


def validate_html_structure(html: str) -> None:
    require_all(html, (
        ('<html lang="en">', "document language"),
        ('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"', "safe-area viewport"),
        ('name="theme-color" content="#020406"', "browser theme color"),
    ))
    parser = parse_html(html)
    if "bb-shell" in parser.classes:
        require_classes(parser, (
            ("bb-topbar", "approved top bar"), ("bb-brand", "approved owner brand link"),
            ("bb-hero", "approved hero"), ("bb-section", "approved dashboard section"),
            ("bb-card-grid", "approved dashboard card grid"), ("bb-footer", "approved footer"),
        ))
        require_all(html, (
            ('id="bb-dashboard-title"', "dashboard title hook"),
            ('>COMMAND CENTER</h1>', "approved dashboard identity"),
            ('>LIVE OPS ', "Live Ops section"), ('>GROWTH ', "Growth section"),
            ('>AI INTELLIGENCE ', "AI Intelligence section"), ('>SYSTEM ', "System section"),
        ))
        return
    require_classes(parser, (
        ("command-shell", "command shell"), ("desktop-nav", "desktop navigation"),
        ("mobile-nav", "mobile navigation"), ("hero", "hero"),
        ("hero-crown", "crown"), ("jewel-rail-left", "left jeweled rail"),
        ("jewel-rail-right", "right jeweled rail"), ("project-grid", "project grid"),
    ))
    require_all(html, (
        ('id="mission"', "mission board"), ('id="quick"', "quick-access panel"),
        ('role="status" aria-live="polite"', "live status region"),
        ('assets/bb-command-center-logo.svg', "BB logo reference"),
        ('BB COMMAND CENTER', "BB identity"),
        ('<strong>LICENSE TO CHILL</strong>', "approved footer slogan"),
    ))


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
    validate_html_structure(html)
    for phrase in ("CHILL PROS COMMAND CENTER", "CHILL PROS OWNER"):
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
