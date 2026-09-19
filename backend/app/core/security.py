"""JWT (HS256, via `pyjwt`) + hybrid API-key auth, and role-based access
control.

Deliberately `pyjwt`, not `python-jose` again: app/core/auth.py's own
docstring already explains `python-jose` was tried and dropped for pulling
in `ecdsa`, whose Minerva-attack timing vulnerability (CVE-2024-23342) the
`ecdsa` maintainers have no plans to fix. HS256 needs no asymmetric-crypto
dependency at all — `pyjwt` alone is enough, avoiding that exposure a
second time.

Two independent auth paths resolve to the same `Principal`, via
`get_current_principal`:
- `Authorization: Bearer <JWT>` — a real, interactively-logged-in human.
  The role is re-read from the database on every request (not just trusted
  from the token claim), so a role change or account deactivation takes
  effect on the very next request rather than only after the token expires.
- `X-API-Key` — the existing service-account gate (app/core/auth.py), kept
  alongside JWT rather than replaced by it: automation (e.g. a cron job
  triggering scans) has no human logged in to hold a JWT. Resolves to an
  admin-equivalent principal, matching today's behavior.
"""
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.database import AsyncSessionLocal, get_db
from app.db.models import User, UserRole

settings = get_settings()
logger = get_logger(__name__)

_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        # Malformed/foreign hash (e.g. empty string) — treat as no match
        # rather than raising, so a corrupted row 401s instead of 500ing.
        return False


def create_access_token(username: str, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": username,
        "role": role,
        "type": _TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.app_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != _TOKEN_TYPE:
        return None
    return payload


@dataclass
class Principal:
    username: str
    role: str
    auth_method: str  # "jwt" | "api_key"


async def _principal_from_jwt(token: str, db: AsyncSession) -> Principal | None:
    payload = decode_access_token(token)
    if payload is None:
        return None
    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return Principal(username=user.username, role=user.role.value, auth_method="jwt")


def _principal_from_api_key(x_api_key: str) -> Principal | None:
    if not settings.api_auth_enabled or not settings.api_key:
        return None
    # compare_digest instead of != — a plain string comparison short-circuits
    # on the first mismatched byte, letting an attacker infer the key length
    # and content one byte at a time from response timing.
    if not hmac.compare_digest(x_api_key, settings.api_key):
        return None
    return Principal(username="service-account", role=UserRole.ADMIN.value, auth_method="api_key")


async def get_current_principal(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    if authorization and authorization.lower().startswith("bearer "):
        principal = await _principal_from_jwt(authorization.split(" ", 1)[1], db)
        if principal:
            return principal
    if x_api_key:
        principal = _principal_from_api_key(x_api_key)
        if principal:
            return principal
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid credentials — supply a Bearer token or X-API-Key header.",
    )


def require_role(*roles: str):
    """Dependency factory: 403s unless the resolved principal's role is one
    of `roles`. Built on top of get_current_principal, so it accepts either
    auth path above."""

    async def _dependency(principal: Principal = Depends(get_current_principal)) -> Principal:
        if principal.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {', '.join(roles)}.",
            )
        return principal

    return _dependency


async def seed_admin_if_missing() -> None:
    """Creates a default admin account on first boot so there's always a way
    to log in — mirrors the AUTO_SEED_ON_STARTUP pattern already used for
    demo scan data. Must be disabled the same safe way in tests: a plain
    statement at conftest.py's *import time*, not a fixture (see
    backend/tests/conftest.py) — the ordering fix already proven this
    session for the exact same class of startup-side-effect leak.
    """
    if not settings.auto_seed_admin_on_startup:
        return
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none() is not None:
            return
        admin = User(
            username=settings.seed_admin_username,
            email=f"{settings.seed_admin_username}@cloudsecops.local",
            hashed_password=hash_password(settings.seed_admin_password),
            role=UserRole.ADMIN,
        )
        db.add(admin)
        await db.commit()
        logger.warning(
            "seed_admin_created",
            username=settings.seed_admin_username,
            note="Default password set from SEED_ADMIN_PASSWORD — change it immediately "
            "in any real deployment.",
        )
