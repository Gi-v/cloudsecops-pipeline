"""HTTP-level tests for JWT login + the hybrid JWT/API-key auth design (see
app/core/security.py's module docstring) against a real Postgres database.
"""
import uuid

from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User, UserRole


def test_password_hash_roundtrip():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong password", hashed)


async def _seed_user(db_session, role: UserRole, password: str = "test-password-123") -> User:
    username = f"{role.value}-{uuid.uuid4().hex[:8]}"
    user = User(
        username=username,
        email=f"{username}@test.local",
        hashed_password=hash_password(password),
        role=role,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def test_login_succeeds_with_correct_credentials(db_session, db_client):
    user = await _seed_user(db_session, UserRole.VIEWER, password="s3cret-pw")

    resp = db_client.post(
        "/api/v1/auth/login", json={"username": user.username, "password": "s3cret-pw"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == "viewer"
    assert body["access_token"]


async def test_login_rejects_wrong_password(db_session, db_client):
    user = await _seed_user(db_session, UserRole.VIEWER, password="s3cret-pw")

    resp = db_client.post(
        "/api/v1/auth/login", json={"username": user.username, "password": "wrong"}
    )
    assert resp.status_code == 401


async def test_login_rejects_unknown_username(db_client):
    resp = db_client.post(
        "/api/v1/auth/login", json={"username": "nobody", "password": "whatever"}
    )
    assert resp.status_code == 401


async def test_me_returns_profile_for_valid_token(db_session, db_client):
    user = await _seed_user(db_session, UserRole.ADMIN)
    token = create_access_token(user.username, user.role.value)

    resp = db_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == user.username
    assert body["role"] == "admin"


async def test_me_rejects_missing_token(db_client):
    resp = db_client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_me_rejects_garbage_token(db_client):
    resp = db_client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert resp.status_code == 401


async def test_me_rejects_api_key_principal(db_client, api_key_headers):
    resp = db_client.get("/api/v1/auth/me", headers=api_key_headers)
    assert resp.status_code == 400


async def test_role_gated_endpoint_403_for_viewer_200_for_admin(db_session, db_client):
    resp = db_client.post("/api/v1/scan", json={"provider": "AWS"}, headers=await _headers(db_session, UserRole.VIEWER))
    assert resp.status_code == 403

    resp = db_client.post("/api/v1/scan", json={"provider": "AWS"}, headers=await _headers(db_session, UserRole.ADMIN))
    assert resp.status_code == 200


async def _headers(db_session, role: UserRole) -> dict:
    user = await _seed_user(db_session, role)
    token = create_access_token(user.username, role.value)
    return {"Authorization": f"Bearer {token}"}


async def test_api_key_still_works_standalone(db_client, api_key_headers):
    """The hybrid design's whole point: automation with no logged-in human
    can still trigger a scan via X-API-Key alone."""
    resp = db_client.post("/api/v1/scan", json={"provider": "AWS"}, headers=api_key_headers)
    assert resp.status_code == 200


async def test_unauthenticated_request_rejected(db_client):
    resp = db_client.post("/api/v1/scan", json={"provider": "AWS"})
    assert resp.status_code == 401


async def test_deactivated_user_token_rejected(db_session, db_client):
    user = await _seed_user(db_session, UserRole.ADMIN)
    token = create_access_token(user.username, user.role.value)
    user.is_active = False
    await db_session.commit()

    resp = db_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


async def test_admin_can_create_and_list_and_promote_users(db_session, db_client, admin_headers):
    resp = db_client.post(
        "/api/v1/auth/users",
        json={"username": "newbie", "email": "newbie@test.local", "password": "abc12345", "role": "viewer"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    new_user = resp.json()
    assert new_user["role"] == "viewer"

    listed = db_client.get("/api/v1/auth/users", headers=admin_headers)
    assert listed.status_code == 200
    assert any(u["username"] == "newbie" for u in listed.json())

    promoted = db_client.patch(
        f"/api/v1/auth/users/{new_user['id']}/role",
        json={"role": "admin"},
        headers=admin_headers,
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"


async def test_create_user_rejects_duplicate_username(db_session, db_client, admin_headers):
    existing = await _seed_user(db_session, UserRole.VIEWER)

    resp = db_client.post(
        "/api/v1/auth/users",
        json={
            "username": existing.username,
            "email": "dupe@test.local",
            "password": "abc12345",
            "role": "viewer",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 409


async def test_viewer_cannot_manage_users(db_session, db_client, viewer_headers):
    resp = db_client.get("/api/v1/auth/users", headers=viewer_headers)
    assert resp.status_code == 403
