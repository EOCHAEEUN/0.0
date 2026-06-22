import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.responses import JSONResponse

from app.core.database import create_service_client, get_db
from app.core.auth import get_current_user
from app.core.ownership import require_owned_company, require_owned_equipment_by_id
from app.models.auth import CurrentUser
from app.models.company import CompanyOnboarding, CompanyUpdate
from app.models.equipment import EquipmentInput
from app.models.user_profile import UserProfileCreate, UserProfileUpdate
from app.tools.equipment_normalizer import normalize_equipment_category

router = APIRouter()
logger = logging.getLogger(__name__)

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
        logger.exception("Company onboarding save failed")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save onboarding company data.",
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
        logger.exception("Onboarding data lookup failed")
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Company not found.",
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
    if body.email and body.email != current_user.email:
        auth_update["email"] = body.email
    if body.new_password:
        auth_update["password"] = body.new_password

    if auth_update:
        if not body.current_password or not current_user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required for account changes.",
            )

        try:
            create_service_client().auth.sign_in_with_password(
                {
                    "email": current_user.email,
                    "password": body.current_password,
                }
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect.",
            ) from exc

        db.auth.admin.update_user_by_id(current_user.id, auth_update)

    # 2. user_profile 업데이트 (이름, 연락처)
    profile_update = {}
    if body.name: profile_update["name"] = body.name
    if body.phone: profile_update["phone"] = body.phone
    if body.manager_name is not None:
        profile_update["manager_name"] = body.manager_name
    if body.manager_phone is not None:
        profile_update["manager_phone"] = body.manager_phone

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
    company_id: Annotated[
        str,
        Path(
            min_length=36,
            max_length=36,
            pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
        ),
    ],
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
        company = require_owned_company(company_id, current_user)
        result = (
            db.table("company")
            .update(update_payload)
            .eq("company_id", company["company_id"])
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

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Company update failed")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to update company.",
            },
        )


@router.post("/onboarding/{company_id}/equipment")
async def register_equipment(
    company_id: Annotated[
        str,
        Path(
            min_length=36,
            max_length=36,
            pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
        ),
    ],
    body: EquipmentInput,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()
    company = require_owned_company(company_id, current_user)
    
    equipment_payload = {
        "company_id": company["company_id"],
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
        logger.exception("Equipment creation failed")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save equipment.",
            },
        )
@router.patch("/equipment/{equipment_id}")
async def update_equipment(
    equipment_id: Annotated[
        str,
        Path(
            min_length=36,
            max_length=36,
            pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
        ),
    ],
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
        company, _ = require_owned_equipment_by_id(equipment_id, current_user)

        result = (
            db.table("equipment")
            .update(update_payload)
            .eq("equipment_id", equipment_id)
            .eq("company_id", company["company_id"])
            .execute()
        )

        return {
            "success": True,
            "data": {
                "equipment_id": equipment_id,
                "equipment": result.data[0],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Equipment update failed")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to update equipment.",
            },
        )


@router.delete("/equipment/{equipment_id}")
async def delete_equipment(
    equipment_id: Annotated[
        str,
        Path(
            min_length=36,
            max_length=36,
            pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
        ),
    ],
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    try:
        company, _ = require_owned_equipment_by_id(equipment_id, current_user)

        db.table("equipment").delete().eq("equipment_id", equipment_id).eq(
            "company_id", company["company_id"]
        ).execute()

        return {
            "success": True,
            "message": "equipment deleted",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Equipment deletion failed")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to delete equipment.",
            },
        )
