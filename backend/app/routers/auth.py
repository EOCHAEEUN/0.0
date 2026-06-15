from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from app.core.database import get_db
from app.models.auth import LoginRequest, SignupRequest

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

@router.post("/auth/signup")
async def signup(body: SignupRequest):
    if not body.agreements.service_terms or not body.agreements.privacy_policy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required agreements are missing.",
        )

    db = get_db()

    try:
        created = db.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
                "user_metadata": {
                    "name": body.name,
                    "phone": body.phone,
                }
            }
        )
        user = created.user
        user_id = user.id

        profile_payload = {
            "user_id": user_id,
            "name": body.name,
            "phone": body.phone,
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
    db = get_db()

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