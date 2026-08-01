#!/usr/bin/env python3
"""Reject HTML base elements that can redirect relative BB Command Center URLs."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "owner-command-center.html"


class BaseElementParser(HTMLParser):
    """Record every base element, including malformed or attribute-free variants."""

    def __init__(self) -> None:
        super().__init__()
        self.base_elements: list[dict[str, str | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "base":
            self.base_elements.append(dict(attrs))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)


def main() -> None:
    if not HTML_PATH.is_file():
        print(f"ERROR: Missing BB Command Center HTML: {HTML_PATH.relative_to(ROOT)}", file=sys.stderr)
        raise SystemExit(1)

    parser = BaseElementParser()
    parser.feed(HTML_PATH.read_text(encoding="utf-8", errors="replace"))
    parser.close()

    if parser.base_elements:
        print(
            "ERROR: owner-command-center.html must not contain a <base> element; "
            "it can redirect every relative navigation and asset URL.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    print("BB Command Center document-base contract is valid.")


if __name__ == "__main__":
    main()
