from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.models.company import CompanyOnboarding, CompanyUpdate
from app.models.equipment import EquipmentInput
from app.models.user_profile import UserProfileCreate, UserProfileUpdate
from app.tools.equipment_normalizer import normalize_equipment_category

router = APIRouter()

@router.post("/onboarding")
async def register_company(
    body: CompanyOnboarding,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    company_payload = {
        "user_id": current_user.id,
        **body.model_dump(exclude_none=True)
    }

    try:
        result = db.table("company").upsert(
            company_payload,
            on_conflict="user_id"
        ).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "company save returned no data.",
                },
            )

        company = result.data[0]

        return {
            "success": True,
            "data": {
                "company_id": company.get("company_id"),
                "company": company,
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save onboarding company data.",
                "error": str(e),
            },
        )


@router.get("/onboarding/me")
async def get_my_company(
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    try:
        # user_profile 조회 추가
        profile_result = (
            db.table("user_profile")
            .select("*")
            .eq("user_id", current_user.id)
            .maybe_single()
            .execute()
        )

        company_result = (
            db.table("company")
            .select("*")
            .eq("user_id", current_user.id)
            .execute()
        )

        company_id = company_result.data[0].get("company_id") if company_result.data else None

        equipment_result = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .execute()
        )

        return {
            "success": True,
            "data": {
                "user_profile": profile_result.data,  # 추가
                "company": company_result.data[0] if company_result.data else None,
                "equipments": equipment_result.data,
            },
        }

    except Exception as exc:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Company not found.",
                "error": str(exc),
            },
        )

@router.patch("/user-profile/me")
async def update_user_profile(
    body: UserProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    # 1. Auth 업데이트 (이메일, 비밀번호)
    auth_update = {}
    if body.email: auth_update["email"] = body.email
    if body.new_password: auth_update["password"] = body.new_password

    if auth_update:
        db.auth.admin.update_user_by_id(current_user.id, auth_update)

    # 2. user_profile 업데이트 (이름, 연락처)
    profile_update = {}
    if body.name: profile_update["name"] = body.name
    if body.phone: profile_update["phone"] = body.phone

    if profile_update:
        result = (
            db.table("user_profile")
            .update(profile_update)
            .eq("user_id", current_user.id)
            .execute()
        )

    return {
        "success": True,
        "data": {
            "user_profile": result.data[0] if profile_update else None,
        },
    }
    
@router.patch("/onboarding/company/{company_id}")
async def update_company(
    company_id: str,
    body: CompanyUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()
    update_payload = {
        k: v for k, v in body.model_dump().items()
        if v is not None and v != ""
    }
    update_payload.pop("user_id", None)

    if not update_payload:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "No company fields to update.",
            },
        )

    try:
        result = (
            db.table("company")
            .update(update_payload)
            .eq("company_id", company_id)
            .eq("user_id", current_user.id)
            .execute()
        )

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "company update returned no data.",
                },
            )

        return {
            "success": True,
            "data": {
                "company_id": company_id,
                "company": result.data[0],
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to update company.",
                "error": str(e),
            },
        )


@router.post("/onboarding/{company_id}/equipment")
async def register_equipment(
    company_id: str,
    body: EquipmentInput,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    # 소유권 검증
    company_result = (
        db.table("company")
        .select("company_id")
        .eq("company_id", company_id)
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )
    if not company_result.data:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Company not found or not owned by user.",
            },
        )
    
    equipment_payload = {
        "company_id": company_id,
        **body.model_dump(exclude_none=True)
    }
    equipment_payload["category"] = normalize_equipment_category(
        body.category,
        body.name,
        body.process,
    )

    try:
        result = db.table("equipment").insert(equipment_payload).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "equipment save returned no data.",
                },
            )

        equipment = result.data[0]

        return {
            "success": True,
            "data": {
                "equipment_id": equipment.get("equipment_id"),
                "equipment": equipment,
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save equipment.",
                "error": str(e),
            },
        )
@router.patch("/equipment/{equipment_id}")
async def update_equipment(
    equipment_id: str,
    body: EquipmentInput,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    update_payload = {
        k: v for k, v in body.model_dump().items()
        if v is not None and v != ""
    }
    update_payload["category"] = normalize_equipment_category(
        body.category,
        body.name,
        body.process,
    )
    try:
        # 소유권 검증
        equipment_result = (
            db.table("equipment")
            .select("company_id")
            .eq("equipment_id", equipment_id)
            .single()
            .execute()
        )

        company_id = equipment_result.data.get("company_id")
        company_result = (
            db.table("company")
            .select("company_id")
            .eq("company_id", company_id)
            .eq("user_id", current_user.id)
            .single()
            .execute()
        )

        if not company_result.data:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Equipment not found or not owned by user.",
                },
            )

        result = (
            db.table("equipment")
            .update(update_payload)
            .eq("equipment_id", equipment_id)
            .execute()
        )

        return {
            "success": True,
            "data": {
                "equipment_id": equipment_id,
                "equipment": result.data[0],
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to update equipment.",
                "error": str(e),
            },
        )


@router.delete("/equipment/{equipment_id}")
async def delete_equipment(
    equipment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    try:
        # 소유권 검증
        equipment_result = (
            db.table("equipment")
            .select("company_id")
            .eq("equipment_id", equipment_id)
            .single()
            .execute()
        )

        company_id = equipment_result.data.get("company_id")
        company_result = (
            db.table("company")
            .select("company_id")
            .eq("company_id", company_id)
            .eq("user_id", current_user.id)
            .single()
            .execute()
        )

        if not company_result.data:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Equipment not found or not owned by user.",
                },
            )

        db.table("equipment").delete().eq("equipment_id", equipment_id).execute()

        return {
            "success": True,
            "message": "equipment deleted",
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to delete equipment.",
                "error": str(e),
            },
        )
