#!/usr/bin/env python3
"""Validate the Firebase owner-homepage routing contract."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FIREBASE_CONFIG = ROOT / "firebase.json"
OWNER_HOMEPAGE = ROOT / "owner-command-center.html"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not FIREBASE_CONFIG.is_file():
        fail("firebase.json is missing")

    if not OWNER_HOMEPAGE.is_file():
        fail("owner-command-center.html is missing")

    try:
        config = json.loads(FIREBASE_CONFIG.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"firebase.json is invalid JSON: {exc}")

    hosting = config.get("hosting")
    if not isinstance(hosting, dict):
        fail("firebase.json must contain a hosting object")

    rewrites = hosting.get("rewrites", [])
    if not isinstance(rewrites, list):
        fail("hosting.rewrites must be a list")

    root_destinations = [
        rewrite.get("destination")
        for rewrite in rewrites
        if isinstance(rewrite, dict) and rewrite.get("source") == "/"
    ]

    if root_destinations != ["/owner-command-center.html"]:
        fail(
            "Firebase root routing must contain exactly one '/' rewrite to "
            "'/owner-command-center.html'"
        )

    html = OWNER_HOMEPAGE.read_text(encoding="utf-8", errors="replace").lower()
    if "<html" not in html or "<title" not in html:
        fail("owner-command-center.html does not look like a complete HTML document")

    print("Owner homepage deployment contract is valid.")


if __name__ == "__main__":
    main()
