from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
import traceback

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
        existing = (
            db.table("company")
            .select("company_id")
            .eq("user_id", current_user.id)
            .limit(1)
            .execute()
        )

        existing_company = existing.data[0] if existing.data else None

        if existing_company:
            company_id = existing_company.get("company_id")
            result = (
                db.table("company")
                .update(company_payload)
                .eq("company_id", company_id)
                .eq("user_id", current_user.id)
                .execute()
            )
        else:
            result = db.table("company").insert(company_payload).execute()

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
        print("[onboarding] Failed to save company payload:", company_payload)
        print("[onboarding] Exception:", repr(e))
        traceback.print_exc()
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

        company = company_result.data[0] if company_result.data else None
        company_id = company.get("company_id") if company else None

        # 기업 정보가 없는 신규 사용자는 설비 조회 없이 빈 배열 반환 (company_id=None 쿼리 방지)
        if company_id:
            equipment_result = (
                db.table("equipment")
                .select("*")
                .eq("company_id", company_id)
                .execute()
            )
            equipments = equipment_result.data
        else:
            equipments = []

        # 가장 최근 ROI 분석 결과 조회 (재로그인 후 화면 복원용)
        latest_roi_output = None
        roi_outputs = []
        matched_policies = []
        if equipments:
            equipment_ids = [e.get("equipment_id") for e in equipments if e.get("equipment_id")]
            if equipment_ids:
                try:
                    roi_query = (
                        db.table("roi_output")
                        .select("*")
                        .in_("equipment_id", equipment_ids)
                        .order("created_at", desc=True)
                        .limit(50)
                        .execute()
                    )
                    roi_outputs = roi_query.data or []
                    latest_roi_output = roi_outputs[0] if roi_outputs else None
                    policy_query = (
                        db.table("matched_policy")
                        .select("*")
                        .in_("equipment_id", equipment_ids)
                        .order("created_at", desc=True)
                        .execute()
                    )
                    matched_policies = policy_query.data or []
                except Exception as roi_exc:
                    print(f"[onboarding/me] roi_output 조회 실패: {roi_exc}")

        return {
            "success": True,
            "data": {
                "user_profile": profile_result.data,
                "company": company,
                "equipments": equipments,
                "latest_roi_output": latest_roi_output,
                "roi_outputs": roi_outputs,
                "matched_policies": matched_policies,
            },
        }

    except Exception as exc:
        print("[onboarding/me] Unexpected error:", repr(exc))
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "서버 오류가 발생했습니다.",
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
    try:
        company_result = (
            db.table("company")
            .select("company_id")
            .eq("company_id", company_id)
            .eq("user_id", current_user.id)
            .limit(1)
            .execute()
        )
        company_found = bool(company_result.data)
    except Exception as e:
        print(f"[equipment] company check failed: {e}")
        company_found = False

    if not company_found:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Company not found or not owned by user.",
            },
        )
    
    body_dict = body.model_dump(exclude_none=True)
    # DB NOT NULL 컬럼은 null 대신 기본값 0 삽입
    if "energy_cost_annual" not in body_dict:
        body_dict["energy_cost_annual"] = 0

    equipment_payload = {"company_id": company_id, **body_dict}
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
        import traceback
        print("[equipment] insert failed. payload:", equipment_payload)
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Failed to save equipment: {str(e)}",
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
