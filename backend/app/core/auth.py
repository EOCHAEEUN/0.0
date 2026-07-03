from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.database import get_db
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


def get_current_user(authorization: Optional[str] = Header(default=None)) -> CurrentUser:
    token = extract_bearer_token(authorization)

    try:
        response = get_db().auth.get_user(token)
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
