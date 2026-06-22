from fastapi import Response

from app.core.config import settings


ACCESS_COOKIE_NAME = "factofit_access"
REFRESH_COOKIE_NAME = "factofit_refresh"


def set_auth_cookies(
    response: Response,
    *,
    access_token: str | None,
    refresh_token: str | None,
    access_max_age: int | None = None,
) -> None:
    cookie_options = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.auth_cookie_samesite,
    }

    if access_token:
        response.set_cookie(
            ACCESS_COOKIE_NAME,
            access_token,
            max_age=access_max_age or settings.auth_access_cookie_max_age,
            path="/api",
            **cookie_options,
        )

    if refresh_token:
        response.set_cookie(
            REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=settings.auth_refresh_cookie_max_age,
            path="/api/auth",
            **cookie_options,
        )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        ACCESS_COOKIE_NAME,
        path="/api",
        secure=settings.cookie_secure,
        samesite=settings.auth_cookie_samesite,
    )
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/api/auth",
        secure=settings.cookie_secure,
        samesite=settings.auth_cookie_samesite,
    )
