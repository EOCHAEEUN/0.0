from typing import Optional

from fastapi import Header, HTTPException, Request, status

from app.core.config import settings
from app.core.database import create_service_client
from app.core.session import ACCESS_COOKIE_NAME
from app.models.auth import CurrentUser


def extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is missing.",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be Bearer token.",
        )

    return token.strip()


def _allowed_frontend_origins() -> set[str]:
    return {
        origin.strip().rstrip("/")
        for origin in settings.frontend_origins.split(",")
        if origin.strip()
    }


def _validate_cookie_request_origin(request: Request) -> None:
    if request.method.upper() in {"GET", "HEAD", "OPTIONS"}:
        return

    origin = request.headers.get("origin")
    if not origin or origin.rstrip("/") not in _allowed_frontend_origins():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Untrusted request origin.",
        )


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> CurrentUser:
    bearer_token = extract_bearer_token(authorization) if authorization else None
    cookie_token = request.cookies.get(ACCESS_COOKIE_NAME)
    token = bearer_token or cookie_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication session is missing.",
        )

    if cookie_token and not bearer_token:
        _validate_cookie_request_origin(request)

    try:
        response = create_service_client().auth.get_user(token)
        user = response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from exc

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )

    return CurrentUser(id=user.id, email=getattr(user, "email", None))
