#!/usr/bin/env python3
"""Fail closed when BB Command Center forms can submit to unsafe targets."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "owner-command-center.html"
ALLOWED_EXTERNAL_SCHEMES = {"http", "https"}


class FormTargetParser(HTMLParser):
    """Collect form submission targets in source order."""

    def __init__(self) -> None:
        super().__init__()
        self.targets: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "form" and attributes.get("action"):
            self.targets.append(("action", str(attributes["action"])))
        if tag in {"button", "input"} and attributes.get("formaction"):
            self.targets.append(("formaction", str(attributes["formaction"])))


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def validate_form_targets(html: str) -> None:
    parser = FormTargetParser()
    parser.feed(html)
    parser.close()

    for attribute, target in parser.targets:
        if any(ord(character) < 32 or ord(character) == 127 for character in target):
            fail(f"Control characters are prohibited in {attribute}: {target!r}")
        if target.startswith("//"):
            fail(f"Protocol-relative form target is prohibited: {target}")

        parsed = urlsplit(target)
        scheme = parsed.scheme.lower()
        if scheme:
            if scheme not in ALLOWED_EXTERNAL_SCHEMES:
                fail(f"Unsafe form target scheme is prohibited: {target}")
            continue
        if parsed.netloc:
            fail(f"Network-path form target is prohibited: {target}")

        local_path = parsed.path
        if not local_path or local_path == "/":
            continue
        resolved = (HTML_PATH.parent / local_path).resolve()
        try:
            resolved.relative_to(ROOT.resolve())
        except ValueError:
            fail(f"Local form target escapes repository root: {target}")
        if not resolved.is_file():
            fail(f"Missing local form target: {target}")


def main() -> None:
    if not HTML_PATH.is_file():
        fail("owner-command-center.html is missing")
    validate_form_targets(HTML_PATH.read_text(encoding="utf-8", errors="replace"))
    print("BB Command Center form targets are safe and resolvable.")


if __name__ == "__main__":
    main()
