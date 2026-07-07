from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.models.auth import RefreshSessionRequest  # noqa: E402
from app.routers import auth  # noqa: E402


def test_refresh_session_returns_rotated_tokens(monkeypatch):
    refreshed = SimpleNamespace(
        session=SimpleNamespace(
            access_token="new-access",
            refresh_token="new-refresh",
            expires_at=123456,
        ),
        user=SimpleNamespace(id="user-1", email="user@example.com"),
    )
    auth_client = SimpleNamespace(
        auth=SimpleNamespace(
            refresh_session=lambda token: refreshed if token == "old-refresh" else None
        )
    )
    monkeypatch.setattr(auth, "create_service_client", lambda: auth_client)

    result = asyncio.run(
        auth.refresh_session(RefreshSessionRequest(refresh_token="old-refresh"))
    )

    assert result["success"] is True
    assert result["data"]["access_token"] == "new-access"
    assert result["data"]["refresh_token"] == "new-refresh"


def _client_raising(exc):
    def fail(_token):
        raise exc

    return SimpleNamespace(auth=SimpleNamespace(refresh_session=fail))


def test_refresh_session_rejects_invalid_token(monkeypatch):
    from supabase_auth.errors import AuthApiError

    monkeypatch.setattr(
        auth,
        "create_service_client",
        lambda: _client_raising(
            AuthApiError(
                "Invalid Refresh Token: Refresh Token Not Found",
                400,
                "refresh_token_not_found",
            )
        ),
    )

    response = asyncio.run(
        auth.refresh_session(RefreshSessionRequest(refresh_token="expired"))
    )

    assert response.status_code == 401
    assert b"REFRESH_TOKEN_INVALID" in response.body


def test_refresh_session_treats_network_error_as_unavailable(monkeypatch):
    from supabase_auth.errors import AuthRetryableError

    monkeypatch.setattr(
        auth,
        "create_service_client",
        lambda: _client_raising(AuthRetryableError("connection reset", 0)),
    )

    response = asyncio.run(
        auth.refresh_session(RefreshSessionRequest(refresh_token="valid"))
    )

    # 일시 장애는 401(무효)로 반환하면 안 된다 — 프론트가 세션을 지우게 되므로
    assert response.status_code == 503
    assert b"AUTH_REFRESH_UNAVAILABLE" in response.body


def test_refresh_session_treats_unknown_error_as_unavailable(monkeypatch):
    monkeypatch.setattr(
        auth,
        "create_service_client",
        lambda: _client_raising(ValueError("unexpected")),
    )

    response = asyncio.run(
        auth.refresh_session(RefreshSessionRequest(refresh_token="valid"))
    )

    assert response.status_code == 503
    assert b"AUTH_REFRESH_UNAVAILABLE" in response.body
