#!/usr/bin/env python3
"""Validate install and browser metadata for the BB Command Center entry point."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "owner-command-center.html"


class HeadMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_head = False
        self.meta: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.title_parts: list[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        if tag == "head":
            self.in_head = True
        elif self.in_head and tag == "meta":
            self.meta.append(attributes)
        elif self.in_head and tag == "link":
            self.links.append(attributes)
        elif self.in_head and tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "head":
            self.in_head = False
        elif tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_meta(parser: HeadMetadataParser, name: str, content: str) -> None:
    if not any(item.get("name") == name and item.get("content") == content for item in parser.meta):
        fail(f"Missing metadata {name!r} with content {content!r}")


def require_link(parser: HeadMetadataParser, rel: str, href: str, mime_type: str | None = None) -> None:
    for item in parser.links:
        rel_tokens = set(item.get("rel", "").split())
        if rel in rel_tokens and item.get("href") == href:
            if mime_type is None or item.get("type") == mime_type:
                return
    suffix = f" and type {mime_type!r}" if mime_type else ""
    fail(f"Missing link rel={rel!r} href={href!r}{suffix}")


def main() -> None:
    try:
        html = HTML_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"Unable to read {HTML_PATH.name}: {exc}")

    parser = HeadMetadataParser()
    parser.feed(html)
    parser.close()

    title = "".join(parser.title_parts).strip()
    if title != "BB Owner Command Center":
        fail("Document title must remain 'BB Owner Command Center'")

    require_meta(parser, "theme-color", "#020406")
    require_meta(parser, "apple-mobile-web-app-capable", "yes")
    require_meta(parser, "apple-mobile-web-app-status-bar-style", "black-translucent")
    require_meta(parser, "apple-mobile-web-app-title", "BB Command")
    require_meta(
        parser,
        "description",
        "Private BB Owner Command Center for project status, operations, approvals, and execution.",
    )
    require_link(parser, "manifest", "bb-command-center.webmanifest")
    require_link(parser, "icon", "assets/bb-command-center-logo.svg", "image/svg+xml")
    require_link(parser, "apple-touch-icon", "assets/bb-command-center-logo.svg")

    print("BB Command Center install and browser metadata is valid.")


if __name__ == "__main__":
    main()
