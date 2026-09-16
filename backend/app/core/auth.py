"""Lightweight API-key gate for mutating endpoints (trigger scan, change
finding status). Disabled by default (`API_AUTH_ENABLED=false`) so the demo
stays frictionless out of the box; flip it on and set `API_KEY` for anything
resembling a real deployment. Read endpoints stay open either way — this is
a compliance dashboard, not a system holding secrets, and gating every GET
behind a key would just make the Policy Simulator and dashboard annoying to
demo without buying much real protection.

A production deployment with real stakes should replace this with OAuth2 /
OIDC — this is intentionally the minimum viable gate, not the final word on
auth. Pick a JWT/OAuth library at that time rather than pre-installing one
now: `python-jose` was tried here and dropped again (see requirements.txt)
because it pulls in `ecdsa`, whose Minerva-attack timing vulnerability
(CVE-2024-23342) the `ecdsa` maintainers have no plans to fix — not worth
carrying that exposure for a dependency nothing in this codebase calls yet.
"""
import hmac

from fastapi import Header, HTTPException, status

from app.core.config import get_settings

settings = get_settings()


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not settings.api_auth_enabled:
        return
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API_AUTH_ENABLED is true but API_KEY is not configured.",
        )
    # compare_digest instead of != — a plain string comparison short-circuits
    # on the first mismatched byte, letting an attacker infer the key length
    # and content one byte at a time from response timing.
    if x_api_key is None or not hmac.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-API-Key header.",
        )
