#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
route = (ROOT / "technician.html").read_text(encoding="utf-8")
diagnostics = (ROOT / "auth-diagnostics.js").read_text(encoding="utf-8")
access = (ROOT / "v1-access.js").read_text(encoding="utf-8")

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
assert 'portal === "technician"' in diagnostics, "diagnostics must detect technician portal intent"
assert '"chillProsLastTechnicianEmail"' in diagnostics, "technician email history must be isolated from owner sign-in"
assert 'heading.textContent = "Technician Sign-In"' in diagnostics, "technician route must identify itself clearly"
assert '"Use your assigned Chill Pros technician account."' in diagnostics, "technician route must explain which credentials to use"
assert '"Sign-in successful. Loading technician workspace…"' in diagnostics, "technician route must confirm technician routing"
assert "function safeStorageGet(key)" in diagnostics, "sign-in must tolerate unavailable browser storage"
assert "function safeStorageSet(key, value)" in diagnostics, "saving the email must not block authentication"
assert "emailInput.value = safeStorageGet(emailStorageKey)" in diagnostics, "email restore must use the guarded storage reader"
assert "safeStorageSet(emailStorageKey, email)" in diagnostics, "email persistence must use the guarded storage writer"
assert "localStorage.getItem(emailStorageKey)" not in diagnostics, "unguarded storage reads can break iPhone/private browsing sign-in"
assert "localStorage.setItem(emailStorageKey, email)" not in diagnostics, "unguarded storage writes can break authentication"
assert "if (auth.currentUser)" in diagnostics, "technician portal must detect an existing owner or office session"
assert "await auth.signOut()" in diagnostics, "technician portal must clear an existing session before accepting credentials"
assert '"Preparing a separate technician sign-in…"' in diagnostics, "session isolation must be visible to the user"
assert '"Could not clear the existing account session.' in diagnostics, "session-isolation failure must fail closed with recovery guidance"
assert "async function rejectTechnicianSession(auth, code, message, cause)" in diagnostics, "rejected technician sessions need one fail-closed cleanup path"
assert '"auth/technician-profile-unavailable"' in diagnostics, "profile lookup failures need a dedicated actionable diagnostic"
assert '"Technician access could not be verified.' in diagnostics, "profile lookup failures must provide retry and owner guidance"
assert 'console.error("Unable to clear rejected technician session:"' in diagnostics, "sign-out failures must be observable without suppressing rejection"
assert "async function verifyTechnicianAccount(user, auth)" in diagnostics, "technician portal must verify the authenticated role profile"
assert 'db.collection("Users").doc(user.uid).get()' in diagnostics, "technician verification must use the signed-in user profile"
assert 'profile.role !== "technician"' in diagnostics, "owner and office accounts must be rejected from the technician portal"
assert "!technicianName" in diagnostics, "technician accounts must have an assigned technician identity"
assert '"auth/not-technician-account"' in diagnostics, "invalid technician profiles must produce a clear diagnostic"
assert 'error?.code === "auth/not-technician-account"' in diagnostics, "known wrong-role failures must retain their specific diagnostic"
assert 'console.error("Technician profile verification failed:"' in diagnostics, "unexpected profile lookup failures must be recorded"
assert '"Verifying technician access…"' in diagnostics, "technician role verification must be visible during sign-in"
assert "await verifyTechnicianAccount(credential.user, auth)" in diagnostics, "successful credentials must be role-verified before loading"
assert '"This account is not configured as a Chill Pros technician.' in diagnostics, "wrong-role accounts must receive actionable guidance"

assert 'new URLSearchParams(window.location.search).get("portal") === "technician"' in access, "shared access control must detect technician portal intent"
assert "if (!snapshot.exists) return technicianPortal ? null : fallback" in access, "missing technician profiles must fail closed before data listeners start"
assert 'profile.role !== "technician"' in access, "shared access control must reject non-technician roles on the technician portal"
assert '!String(profile.technicianName || "").trim()' in access, "shared access control must require technician identity"
assert "return technicianPortal ? null : fallback" in access, "profile read failures must fail closed on the technician portal"
assert "if (!currentProfile)" in access, "auth listener must stop when technician authorization fails"
assert "startRealtimeListeners();" in access, "authorized sessions must retain realtime behavior"
assert access.index("if (!currentProfile)") < access.index("startRealtimeListeners();"), "authorization rejection must occur before realtime listeners start"
assert "await auth.signOut();" in access, "rejected technician sessions must be cleared"
assert 'Ask the owner to activate the technician profile.' in access, "rejected technician sessions need actionable guidance"

print("Technician sign-in contract passed.")
