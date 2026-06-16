from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.auth import get_current_user
from app.core.database import create_service_client, get_db
from app.models.auth import (
    CurrentUser,
    EmailCodeRequest,
    LoginRequest,
    SignupRequest,
    VerifyEmailCodeRequest,
)

router = APIRouter()


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


@router.post("/auth/send-email-code")
async def send_email_code(body: EmailCodeRequest):
    db = create_service_client()

    try:
        db.auth.sign_in_with_otp({
            "email": body.email,
            "options": {
                "should_create_user": True,
            },
        })

        return {
            "success": True,
            "data": {
                "email": body.email,
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
        auth_response = db.auth.verify_otp({
            "email": body.email,
            "token": body.token,
            "type": "email",
        })

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
            {"email": body.email, "password": body.password}
        )

        return {
            "success": True,
            "data": {
                **_session_payload(auth_response),
                "user": current_user.model_dump(),
                "profile": profile_result.data[0] if profile_result.data else profile_payload,
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
            {"email": body.email, "password": body.password}
        )
        user_id = auth_response.user.id

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

        return {
            "success": True,
            "data": {
                **_session_payload(auth_response),
                "profile": profile.data,
                "companies": companies.data,
                "company_id": companies.data[0].get("company_id") if companies.data else None,
            },
        }

    except Exception as exc:
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "message": "로그인에 실패했습니다.",
                "error": str(exc),
            },
        )


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

    return {
        "success": True,
        "data": {
            "user": current_user.model_dump(),
            "profile": profile.data,
            "companies": companies.data,
            "company_id": companies.data[0].get("company_id") if companies.data else None,
        },
    }
