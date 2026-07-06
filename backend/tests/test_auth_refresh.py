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


def test_refresh_session_rejects_invalid_token(monkeypatch):
    def fail(_token):
        raise ValueError("invalid refresh token")

    auth_client = SimpleNamespace(
        auth=SimpleNamespace(refresh_session=fail)
    )
    monkeypatch.setattr(auth, "create_service_client", lambda: auth_client)

    response = asyncio.run(
        auth.refresh_session(RefreshSessionRequest(refresh_token="expired"))
    )

    assert response.status_code == 401
