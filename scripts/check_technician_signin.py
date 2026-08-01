#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
route = (ROOT / "technician.html").read_text(encoding="utf-8")
diagnostics = (ROOT / "auth-diagnostics.js").read_text(encoding="utf-8")

required_route_fragments = [
    '<meta name="robots" content="noindex">',
    'window.location.replace("index.html?portal=technician")',
    'href="index.html?portal=technician"',
    'Chill Pros Technician Sign-In',
]
for fragment in required_route_fragments:
    assert fragment in route, f"technician.html missing required fragment: {fragment}"

assert "chillprostx@gmail.com" not in diagnostics, "shared sign-in must not default to the owner email"
assert "Enter the owner email first." not in diagnostics, "password recovery wording must be role-neutral"
assert "Loading owner dashboard" not in diagnostics, "success wording must be role-neutral"
assert "window.location.hostname" in diagnostics, "unauthorized-domain guidance must report the active host"
assert "Add ${currentHost}" in diagnostics, "unauthorized-domain guidance must identify the host to authorize"

print("Technician sign-in contract passed.")
