import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import create_service_client, get_db
from app.core.rate_limit import enforce_rate_limit
from app.core.session import REFRESH_COOKIE_NAME, clear_auth_cookies, set_auth_cookies
from app.models.auth import (
    CurrentUser,
    EmailCodeRequest,
    LoginRequest,
    SignupRequest,
    VerifyEmailCodeRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _session_payload(auth_response) -> dict:
    session = getattr(auth_response, "session", None)
    user = getattr(auth_response, "user", None)

    return {
        "expires_at": getattr(session, "expires_at", None),
        "user": {
            "id": getattr(user, "id", None),
            "email": getattr(user, "email", None),
        },
    }


def _set_session_from_auth_response(response: Response, auth_response) -> None:
    session = getattr(auth_response, "session", None)
    if not session:
        return

    set_auth_cookies(
        response,
        access_token=getattr(session, "access_token", None),
        refresh_token=getattr(session, "refresh_token", None),
        access_max_age=getattr(session, "expires_in", None),
    )


def _validate_frontend_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed_origins = {
        item.strip().rstrip("/")
        for item in settings.frontend_origins.split(",")
        if item.strip()
    }
    if not origin or origin.rstrip("/") not in allowed_origins:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Untrusted request origin.",
        )


def _load_user_context(user_id: str) -> dict:
    db = get_db()
    profile = (
        db.table("user_profile")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    companies = (
        db.table("company")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    company = companies.data[0] if companies.data else None

    return {
        "user_profile": profile.data,
        "company": company,
        "company_id": company.get("company_id") if company else None,
    }


@router.post("/auth/send-email-code")
async def send_email_code(body: EmailCodeRequest, request: Request):
    _validate_frontend_origin(request)
    enforce_rate_limit(
        request,
        scope="auth-send-email-code",
        limit=settings.auth_email_code_requests_per_minute,
        identifier=body.email,
    )
    enforce_rate_limit(
        request,
        scope="auth-send-email-code-account",
        limit=settings.auth_email_code_requests_per_minute,
        identifier=body.email,
        include_client=False,
    )
    db = create_service_client()

    try:
        db.auth.sign_in_with_otp(
            {
                "email": body.email,
                "options": {"should_create_user": True},
            }
        )
        return {
            "success": True,
            "data": {
                "email": body.email,
                "message": "Verification email sent.",
            },
        }
    except Exception as exc:
        logger.warning("Email verification request failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "인증 이메일을 발송하지 못했습니다.",
            },
        )


@router.post("/auth/verify-email-code")
async def verify_email_code(
    body: VerifyEmailCodeRequest,
    request: Request,
    response: Response,
):
    _validate_frontend_origin(request)
    enforce_rate_limit(
        request,
        scope="auth-verify-email-code",
        limit=settings.auth_email_code_verifications_per_minute,
        identifier=body.email,
    )
    db = create_service_client()

    try:
        auth_response = db.auth.verify_otp(
            {
                "email": body.email,
                "token": body.token,
                "type": "email",
            }
        )
        _set_session_from_auth_response(response, auth_response)
        return {
            "success": True,
            "data": _session_payload(auth_response),
        }
    except Exception as exc:
        logger.warning("Email verification failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "이메일 인증에 실패했습니다.",
            },
        )


@router.post("/auth/signup")
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
    current_user: CurrentUser = Depends(get_current_user),
):
    enforce_rate_limit(
        request,
        scope="auth-signup",
        limit=settings.auth_login_attempts_per_minute,
        identifier=body.email,
    )
    if not body.agreements.service_terms or not body.agreements.privacy_policy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required agreements are missing.",
        )

    db = create_service_client()

    try:
        db.auth.admin.update_user_by_id(
            current_user.id,
            {
                "password": body.password,
                "email_confirm": True,
                "user_metadata": {
                    "name": body.name,
                    "phone": body.phone,
                    "business_registration_no": body.business_registration_no,
                    "service_terms_agreed": body.agreements.service_terms,
                    "privacy_policy_agreed": body.agreements.privacy_policy,
                },
            },
        )

        profile_payload = {
            "user_id": current_user.id,
            "email": current_user.email or body.email,
            "name": body.name,
            "phone": body.phone,
            "business_registration_no": body.business_registration_no,
            "service_terms_agreed": body.agreements.service_terms,
            "privacy_policy_agreed": body.agreements.privacy_policy,
        }
        profile_result = (
            db.table("user_profile")
            .upsert(profile_payload, on_conflict="user_id")
            .execute()
        )
        auth_response = db.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
        _set_session_from_auth_response(response, auth_response)

        return {
            "success": True,
            "data": {
                **_session_payload(auth_response),
                "user_profile": (
                    profile_result.data[0] if profile_result.data else profile_payload
                ),
            },
        }
    except Exception as exc:
        logger.exception("Signup completion failed")
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "회원가입을 완료하지 못했습니다.",
            },
        )


@router.post("/auth/login")
async def login(body: LoginRequest, request: Request, response: Response):
    _validate_frontend_origin(request)
    enforce_rate_limit(
        request,
        scope="auth-login",
        limit=settings.auth_login_attempts_per_minute,
        identifier=body.email,
    )
    enforce_rate_limit(
        request,
        scope="auth-login-account",
        limit=settings.auth_login_attempts_per_minute * 2,
        identifier=body.email,
        include_client=False,
    )
    db = create_service_client()

    try:
        auth_response = db.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
        _set_session_from_auth_response(response, auth_response)
        user_context = _load_user_context(auth_response.user.id)

        return {
            "success": True,
            "data": {
                **_session_payload(auth_response),
                **user_context,
            },
        }
    except Exception as exc:
        logger.warning("Login failed for supplied identifier: %s", type(exc).__name__)
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "message": "로그인에 실패했습니다.",
            },
        )


@router.post("/auth/refresh")
async def refresh_session(request: Request, response: Response):
    _validate_frontend_origin(request)
    enforce_rate_limit(
        request,
        scope="auth-refresh",
        limit=settings.auth_refresh_requests_per_minute,
    )
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session is missing.",
        )

    try:
        auth_response = create_service_client().auth.refresh_session(refresh_token)
        _set_session_from_auth_response(response, auth_response)
        return {
            "success": True,
            "data": _session_payload(auth_response),
        }
    except Exception as exc:
        logger.info("Session refresh failed: %s", type(exc).__name__)
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session refresh failed.",
        ) from exc


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    _validate_frontend_origin(request)
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if refresh_token:
        try:
            db = create_service_client()
            db.auth.refresh_session(refresh_token)
            db.auth.sign_out()
        except Exception:
            pass

    clear_auth_cookies(response)
    return {"success": True, "data": {"logged_out": True}}


@router.get("/auth/session")
async def auth_session(current_user: CurrentUser = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "user": current_user.model_dump(),
            **_load_user_context(current_user.id),
        },
    }


@router.get("/me")
async def me(current_user: CurrentUser = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "user": current_user.model_dump(),
            **_load_user_context(current_user.id),
        },
    }
