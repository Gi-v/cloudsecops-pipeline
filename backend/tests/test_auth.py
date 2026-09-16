"""Unit tests for the optional API-key gate (app.core.auth.require_api_key)."""
import pytest
from fastapi import HTTPException

from app.core.auth import require_api_key, settings


@pytest.fixture(autouse=True)
def restore_settings():
    """require_api_key reads the module-level `settings` singleton directly,
    so tests mutate it in place and must restore it afterward."""
    orig_enabled, orig_key = settings.api_auth_enabled, settings.api_key
    yield
    settings.api_auth_enabled, settings.api_key = orig_enabled, orig_key


async def test_disabled_by_default_allows_any_request():
    settings.api_auth_enabled = False
    await require_api_key(x_api_key=None)  # must not raise


async def test_enabled_rejects_missing_key():
    settings.api_auth_enabled = True
    settings.api_key = "secret123"
    with pytest.raises(HTTPException) as exc_info:
        await require_api_key(x_api_key=None)
    assert exc_info.value.status_code == 401


async def test_enabled_rejects_wrong_key():
    settings.api_auth_enabled = True
    settings.api_key = "secret123"
    with pytest.raises(HTTPException) as exc_info:
        await require_api_key(x_api_key="wrong")
    assert exc_info.value.status_code == 401


async def test_enabled_accepts_correct_key():
    settings.api_auth_enabled = True
    settings.api_key = "secret123"
    await require_api_key(x_api_key="secret123")  # must not raise


async def test_enabled_without_configured_key_returns_500():
    settings.api_auth_enabled = True
    settings.api_key = ""
    with pytest.raises(HTTPException) as exc_info:
        await require_api_key(x_api_key="anything")
    assert exc_info.value.status_code == 500
