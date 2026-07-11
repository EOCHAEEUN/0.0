import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from supabase_auth.errors import AuthApiError, AuthRetryableError

from app.core.auth import get_current_user
from app.core.database import create_service_client, get_db
from app.models.auth import (
    CurrentUser,
    EmailAvailabilityRequest,
    EmailCodeRequest,
    LoginRequest,
    PasswordResetRequest,
    PasswordUpdateRequest,
    RefreshSessionRequest,
    SignupRequest,
    VerifyEmailCodeRequest,
)

router = APIRouter()


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _fetch_user_profile_by_email(db, email: str) -> dict | None:
    normalized = _normalize_email(email)
    if not normalized:
        return None
    try:
        result = (
            db.table("user_profile")
            .select("user_id,email")
            .ilike("email", normalized)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


def _fetch_user_profile(db, user_id: str) -> dict | None:
    try:
        result = (
            db.table("user_profile")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


def _fetch_latest_company(db, user_id: str) -> dict | None:
    try:
        result = (
            db.table("company")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


def _password_reset_redirect_url() -> str:
    explicit = os.getenv("FRONTEND_PASSWORD_RESET_URL", "").strip()
    if explicit:
        return explicit

    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    if frontend_url:
        return f"{frontend_url.rstrip('/')}/reset-password"

    return "http://127.0.0.1:5173/reset-password"


def _session_payload(auth_response) -> dict:
    session = getattr(auth_response, "session", None)
    user = getattr(auth_response, "user", None)

    return {
        "access_token": getattr(session, "access_token", None),
        "refresh_token": getattr(session, "refresh_token", None),
        "expires_at": getattr(session, "expires_at", None),
        "user": {
            "id": getattr(user, "id", None),
            "email": getattr(user, "email", None),
        },
    }


@router.post("/auth/check-email")
async def check_email_availability(body: EmailAvailabilityRequest):
    email = _normalize_email(body.email)
    if "@" not in email:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "올바른 이메일 형식으로 입력해 주세요.",
                "error": "Invalid email format.",
            },
        )

    db = create_service_client()
    existing_profile = _fetch_user_profile_by_email(db, email)

    return {
        "success": True,
        "data": {
            "email": email,
            "available": existing_profile is None,
            "message": (
                "사용 가능한 이메일입니다."
                if existing_profile is None
                else "이미 가입된 이메일입니다. 로그인으로 진행해 주세요."
            ),
        },
    }


@router.post("/auth/send-email-code")
async def send_email_code(body: EmailCodeRequest):
    email = _normalize_email(body.email)
    if "@" not in email:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "올바른 이메일 형식으로 입력해 주세요.",
                "error": "Invalid email format.",
            },
        )

    db = create_service_client()
    if _fetch_user_profile_by_email(db, email):
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "message": "이미 가입된 이메일입니다. 로그인으로 진행해 주세요.",
                "error": "Email already registered.",
            },
        )

    try:
        db.auth.sign_in_with_otp(
            {
                "email": email,
                "options": {
                    "should_create_user": True,
                },
            }
        )

        return {
            "success": True,
            "data": {
                "email": email,
                "message": "Verification email sent.",
            },
        }

    except Exception as exc:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "인증 메일을 발송하지 못했습니다.",
                "error": str(exc),
            },
        )


@router.post("/auth/verify-email-code")
async def verify_email_code(body: VerifyEmailCodeRequest):
    db = create_service_client()

    try:
        auth_response = db.auth.verify_otp(
            {
                "email": body.email,
                "token": body.token,
                "type": "email",
            }
        )

        return {
            "success": True,
            "data": _session_payload(auth_response),
        }

    except Exception as exc:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "이메일 인증에 실패했습니다.",
                "error": str(exc),
            },
        )


@router.post("/auth/signup")
async def signup(
    body: SignupRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
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
            {
                "email": body.email,
                "password": body.password,
            }
        )

        return {
            "success": True,
            "data": {
                **_session_payload(auth_response),
                "user_profile": profile_result.data[0]
                if profile_result.data
                else profile_payload,
            },
        }

    except Exception as exc:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "회원가입을 완료하지 못했습니다.",
                "error": str(exc),
            },
        )


@router.post("/auth/login")
async def login(body: LoginRequest):
    db = create_service_client()

    try:
        auth_response = db.auth.sign_in_with_password(
            {
                "email": body.email,
                "password": body.password,
            }
        )
    except Exception as exc:
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "message": "로그인에 실패했습니다.",
                "error": str(exc),
            },
        )

    user = getattr(auth_response, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "message": "로그인에 실패했습니다.",
                "error": "Supabase user session is missing.",
            },
        )

    profile_data = _fetch_user_profile(db, user_id)
    company = _fetch_latest_company(db, user_id)

    return {
        "success": True,
        "data": {
            **_session_payload(auth_response),
            "user_profile": profile_data,
            "company": company,
            "company_id": company.get("company_id") if company else None,
        },
    }


# GoTrue가 refresh token 자체를 거부했음을 뜻하는 오류 코드들.
# 이 목록(또는 4xx + refresh token 언급 메시지)에 해당할 때만 세션 무효로 판정하고,
# 그 외(네트워크, 429, 5xx, 예상 밖 예외)는 일시 장애로 취급해 프론트가 세션을
# 지우지 않도록 401 대신 503을 반환한다.
_INVALID_REFRESH_TOKEN_CODES = {
    "refresh_token_not_found",
    "refresh_token_already_used",
    "session_not_found",
    "session_expired",
    "invalid_grant",
    "user_not_found",
    "user_banned",
}


def _is_invalid_refresh_token_error(exc: Exception) -> bool:
    if not isinstance(exc, AuthApiError):
        return False
    if getattr(exc, "status", None) not in (400, 401, 403, 404):
        return False
    code = str(getattr(exc, "code", "") or "").lower()
    message = str(getattr(exc, "message", "") or "").lower()
    return code in _INVALID_REFRESH_TOKEN_CODES or "refresh token" in message


_REFRESH_TOKEN_INVALID_RESPONSE = {
    "success": False,
    "code": "REFRESH_TOKEN_INVALID",
    "message": "로그인이 만료되었습니다. 다시 로그인해 주세요.",
}

_AUTH_REFRESH_UNAVAILABLE_RESPONSE = {
    "success": False,
    "code": "AUTH_REFRESH_UNAVAILABLE",
    "message": "인증 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
}


@router.post("/auth/refresh")
async def refresh_session(body: RefreshSessionRequest):
    try:
        db = create_service_client()
        auth_response = db.auth.refresh_session(body.refresh_token)
    except AuthRetryableError:
        return JSONResponse(status_code=503, content=_AUTH_REFRESH_UNAVAILABLE_RESPONSE)
    except Exception as exc:
        if _is_invalid_refresh_token_error(exc):
            return JSONResponse(status_code=401, content=_REFRESH_TOKEN_INVALID_RESPONSE)
        print(f"auth refresh 일시 장애: {type(exc).__name__}")
        return JSONResponse(status_code=503, content=_AUTH_REFRESH_UNAVAILABLE_RESPONSE)

    payload = _session_payload(auth_response)
    if not payload.get("access_token") or not payload.get("refresh_token"):
        # 성공 응답인데 토큰이 비어 있는 비정상 상태 — 무효로 단정하지 않는다.
        return JSONResponse(status_code=503, content=_AUTH_REFRESH_UNAVAILABLE_RESPONSE)
    return {"success": True, "data": payload}


@router.get("/me")
async def me(current_user: CurrentUser = Depends(get_current_user)):
    db = get_db()

    profile = (
        db.table("user_profile")
        .select("*")
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )

    companies = (
        db.table("company")
        .select("*")
        .eq("user_id", current_user.id)
        .order("created_at", desc=True)
        .execute()
    )

    company = companies.data[0] if companies.data else None

    return {
        "success": True,
        "data": {
            "user": current_user.model_dump(),
            "user_profile": profile.data,
            "company": company,
            "company_id": company.get("company_id") if company else None,
        },
    }


_PASSWORD_RESET_SENT_MESSAGE = "비밀번호 재설정 메일을 발송했습니다."


@router.post("/auth/password-reset")
async def request_password_reset(body: PasswordResetRequest):
    email = _normalize_email(body.email)
    if "@" not in email:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "올바른 이메일 형식으로 입력해 주세요.",
                "error": "Invalid email format.",
            },
        )

    db = create_service_client()

    try:
        db.auth.reset_password_for_email(
            email,
            {"redirect_to": _password_reset_redirect_url()},
        )
    except Exception as exc:
        # 이메일 존재 여부는 노출하지 않되, 실제 API 오류는 서버 로그에만 남긴다.
        print(f"password-reset 메일 발송 실패: {type(exc).__name__}: {exc}")
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "비밀번호 재설정 메일을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                "error": "Password reset email failed.",
            },
        )

    return {
        "success": True,
        "data": {
            "email": email,
            "message": _PASSWORD_RESET_SENT_MESSAGE,
        },
    }


@router.post("/auth/password-update")
async def update_password(
    body: PasswordUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = create_service_client()

    try:
        db.auth.admin.update_user_by_id(
            current_user.id,
            {"password": body.password},
        )
    except Exception as exc:
        print(f"password-update 실패: {type(exc).__name__}: {exc}")
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "비밀번호를 변경하지 못했습니다.",
                "error": "Password update failed.",
            },
        )

    return {
        "success": True,
        "data": {
            "message": "비밀번호가 변경되었습니다.",
        },
    }
