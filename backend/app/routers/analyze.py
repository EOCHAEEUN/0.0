from datetime import datetime, timezone
from typing import Any, Optional
import json

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.auth import CurrentUser
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.agents.draft import application_draft_node
from app.agents.capex import capex_advisor_node
from app.state import FactofitState


router = APIRouter()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []

        # PostgreSQL text[]가 문자열처럼 넘어오는 경우 보정
        if stripped.startswith("{") and stripped.endswith("}"):
            stripped = stripped[1:-1]

        return [
            item.strip().strip('"').strip("'")
            for item in stripped.split(",")
            if item.strip().strip('"').strip("'")
        ]

    return []


def normalize_industry_code(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(code).strip().upper() for code in value if str(code).strip()]

    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []

        if stripped.startswith("{") and stripped.endswith("}"):
            stripped = stripped[1:-1]

        return [
            code.strip().strip('"').strip("'").upper()
            for code in stripped.replace("/", ",").split(",")
            if code.strip().strip('"').strip("'")
        ]

    return []


def first_row(result: Any) -> Optional[dict]:
    data = getattr(result, "data", None)

    if isinstance(data, list) and data:
        first = data[0]
        return first if isinstance(first, dict) else None

    if isinstance(data, dict):
        return data

    return None


def make_jsonable(value: Any) -> Any:
    """
    Supabase jsonb에 안전하게 저장할 수 있도록 변환한다.
    Pydantic 모델, datetime, tuple 등이 섞여도 JSON 가능한 dict/list로 바꾼다.
    """
    if hasattr(value, "model_dump"):
        value = value.model_dump()

    return jsonable_encoder(value)


def fetch_latest_or_selected_equipment(
    db,
    company_id: str,
    equipment_id: Optional[str] = None,
):
    """
    equipment_id가 있으면 해당 설비를 가져오고,
    없으면 가장 최근에 저장된 설비를 가져온다.

    created_at 컬럼이 없는 DB도 있을 수 있어서 fallback 처리한다.
    """
    def base_query():
        query = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
        )

        if equipment_id:
            query = query.eq("equipment_id", equipment_id)

        return query

    try:
        return (
            base_query()
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        return base_query().limit(1).execute()


def policy_exists(db, policy_id: Optional[str]) -> bool:
    """
    draft_result.policy_id가 policy 테이블 FK로 묶여 있을 수 있으므로,
    실제 policy 테이블에 존재하는 policy_id일 때만 저장한다.
    """
    if not policy_id:
        return False

    try:
        result = (
            db.table("policy")
            .select("policy_id")
            .eq("policy_id", policy_id)
            .limit(1)
            .execute()
        )

        return bool(getattr(result, "data", None))
    except Exception as exc:
        print(f"policy_id 존재 확인 실패: {exc}")
        return False


def get_first_valid_policy_id(db, matched_policies: Any) -> Optional[str]:
    """
    matched_policies가 비어 있으면 None을 반환한다.
    빈 문자열을 반환하면 FK 오류가 나므로 절대 ""를 반환하지 않는다.
    """
    if not isinstance(matched_policies, list) or not matched_policies:
        return None

    first_policy = matched_policies[0]

    if not isinstance(first_policy, dict):
        return None

    metadata = first_policy.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    candidate_policy_id = (
        first_policy.get("policy_id")
        or first_policy.get("id")
        or metadata.get("policy_id")
        or None
    )

    if not candidate_policy_id:
        return None

    candidate_policy_id = str(candidate_policy_id).strip()

    if not candidate_policy_id:
        return None

    if not policy_exists(db, candidate_policy_id):
        print(
            "draft_result policy_id 저장 생략: "
            f"policy 테이블에 없는 policy_id입니다. policy_id={candidate_policy_id}"
        )
        return None

    return candidate_policy_id


def patch_draft_defaults(
    result_state: dict,
    company_name: str,
    equipment_name: str,
) -> dict:
    """
    draft_result나 final_response 안에서 company_name/equipment_name이 null이면
    DB에서 가져온 실제 값으로 보정한다.
    """
    draft_result = result_state.get("draft_result")

    if hasattr(draft_result, "model_dump"):
        draft_result = draft_result.model_dump()
        result_state["draft_result"] = draft_result

    if isinstance(draft_result, dict):
        if not draft_result.get("company_name"):
            draft_result["company_name"] = company_name

        if not draft_result.get("equipment_name"):
            draft_result["equipment_name"] = equipment_name

    final_response = result_state.get("final_response")

    if isinstance(final_response, str) and final_response.strip():
        try:
            parsed_response = json.loads(final_response)

            if isinstance(parsed_response, dict):
                if not parsed_response.get("company_name"):
                    parsed_response["company_name"] = company_name

                if not parsed_response.get("equipment_name"):
                    parsed_response["equipment_name"] = equipment_name

                result_state["final_response"] = json.dumps(
                    parsed_response,
                    ensure_ascii=False,
                )
        except Exception:
            pass

    return result_state


@router.post("/analyze")
async def analyze(
    company_id: str,
    equipment_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    # 1. 현재 사용자 소유 company만 조회
    try:
        company_result = (
            db.table("company")
            .select("*")
            .eq("company_id", company_id)
            .eq("user_id", current_user.id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "기업 정보를 조회하지 못했습니다.",
                "error": str(exc),
            },
        )

    company_row = first_row(company_result)

    if not company_row:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "기업 정보를 찾을 수 없거나 현재 사용자 소유가 아닙니다.",
            },
        )

    industry_code = normalize_industry_code(company_row.get("industry_code"))
    primary_purpose = normalize_text_list(company_row.get("primary_purpose"))

    company = CompanyContext(
        company_id=company_row.get("company_id"),
        company_name=company_row.get("company_name") or "",
        business_registration_no=company_row.get("business_registration_no"),
        industry_name=company_row.get("industry_name"),
        industry_code=industry_code,
        region=company_row.get("region") or "",
        company_type=company_row.get("company_type"),
        primary_purpose=primary_purpose,
        employee_count=company_row.get("employee_count"),
        annual_revenue=company_row.get("annual_revenue"),
        revenue_2y_ago_manwon=company_row.get("revenue_2y_ago_manwon"),
        revenue_3y_ago_manwon=company_row.get("revenue_3y_ago_manwon"),
        total_assets_manwon=company_row.get("total_assets_manwon"),
        is_disclosure_group_member=company_row.get("is_disclosure_group_member"),
        established_year=company_row.get("established_year"),
        workplace_type=company_row.get("workplace_type"),
        created_at=company_row.get("created_at"),
        updated_at=company_row.get("updated_at"),
    )

    # 2. 설비 조회
    try:
        equipment_result = fetch_latest_or_selected_equipment(
            db=db,
            company_id=company_id,
            equipment_id=equipment_id,
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "설비 정보를 조회하지 못했습니다.",
                "error": str(exc),
            },
        )

    equipment_row = first_row(equipment_result)

    if not equipment_row:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "설비 정보를 찾을 수 없습니다.",
            },
        )

    selected_equipment_id = equipment_row.get("equipment_id")

    if not selected_equipment_id:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "설비 ID를 찾을 수 없습니다.",
            },
        )

    equipment = EquipmentInput(
        name=equipment_row.get("name") or "",
        category=equipment_row.get("category") or "",
        process=equipment_row.get("process"),
        age_years=equipment_row.get("age_years") or 0,
        energy_cost_annual=equipment_row.get("energy_cost_annual") or 0,
        defect_rate=equipment_row.get("defect_rate"),
        maintenance_cost_annual=equipment_row.get("maintenance_cost_annual"),
        current_capacity_value=equipment_row.get("current_capacity_value"),
        production_qty=equipment_row.get("production_qty"),
        contribution_margin_won=equipment_row.get("contribution_margin_won"),
        scenario_a_investment_manwon=equipment_row.get(
            "scenario_a_investment_manwon"
        ),
        scenario_b_investment_manwon=equipment_row.get(
            "scenario_b_investment_manwon"
        ),
    )

    # 3. FactofitState 생성
    state: FactofitState = {
        "user_query": f"{equipment.name} ROI 분석",
        "intent": "roi",
        "is_safe": True,
        "company_info": company,
        "equipment": equipment,
        "matched_policies": [],
        "roi_result": None,
        "draft_result": None,
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None,
    }

    # 4. 기존 분석 결과 정리
    try:
        (
            db.table("roi_output")
            .delete()
            .eq("company_id", company_id)
            .eq("equipment_id", selected_equipment_id)
            .execute()
        )
    except Exception as exc:
        print(f"기존 roi_output 삭제 실패: {exc}")

    try:
        # analyze.py는 현재 policy matching node를 직접 실행하지 않는다.
        # 따라서 matched_policy는 company 기준으로 정리한다.
        (
            db.table("matched_policy")
            .delete()
            .eq("company_id", company_id)
            .execute()
        )
    except Exception as exc:
        print(f"기존 matched_policy 삭제 실패: {exc}")

    try:
        # 현재 draft_result 테이블에는 equipment_id 컬럼이 없으므로
        # company_id 기준으로만 기존 초안을 정리한다.
        (
            db.table("draft_result")
            .delete()
            .eq("company_id", company_id)
            .execute()
        )
    except Exception as exc:
        print(f"기존 draft_result 삭제 실패: {exc}")

    # 5. CAPEX/ROI + 신청서 초안 실행
    try:
        result_state = capex_advisor_node(state)
        result_state = application_draft_node(result_state)
        result_state = patch_draft_defaults(
            result_state=result_state,
            company_name=company.company_name,
            equipment_name=equipment.name,
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "분석 노드 실행에 실패했습니다.",
                "error": str(exc),
            },
        )

    # 6. roi_output 저장
    roi_result = result_state.get("roi_result")
    roi_output_saved = False

    if roi_result:
        try:
            roi_data = make_jsonable(roi_result)

            insert_payload = {
                "company_id": company_id,
                "equipment_id": selected_equipment_id,
                "roi_data": roi_data,
                "created_at": now_iso(),
            }

            scenario_a = roi_data.get("scenario_a") if isinstance(roi_data, dict) else {}
            scenario_b = roi_data.get("scenario_b") if isinstance(roi_data, dict) else {}

            if isinstance(scenario_a, dict):
                insert_payload.update(
                    {
                        "scenario_a_investment_manwon": scenario_a.get(
                            "investment_manwon"
                        ),
                        "scenario_a_subsidy_manwon": scenario_a.get(
                            "subsidy_manwon"
                        ),
                    }
                )

            if isinstance(scenario_b, dict):
                insert_payload.update(
                    {
                        "scenario_b_investment_manwon": scenario_b.get(
                            "investment_manwon"
                        ),
                        "scenario_b_subsidy_manwon": scenario_b.get(
                            "subsidy_manwon"
                        ),
                    }
                )

            (
                db.table("roi_output")
                .insert(insert_payload)
                .execute()
            )

            roi_output_saved = True

        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "roi_output 저장에 실패했습니다.",
                    "error": str(exc),
                    "hint": "public.roi_output 테이블 컬럼과 analyze.py insert payload를 확인해주세요.",
                    "data": {
                        "company": company_row,
                        "equipment": equipment_row,
                        "equipment_id": selected_equipment_id,
                        "roi_result": make_jsonable(result_state.get("roi_result")),
                        "matched_policies": make_jsonable(
                            result_state.get("matched_policies", [])
                        ),
                        "draft_result": make_jsonable(result_state.get("draft_result")),
                        "response": result_state.get("final_response", ""),
                        "unsupported_equipment": result_state.get(
                            "unsupported_equipment",
                            False,
                        ),
                    },
                },
            )

    # 7. matched_policy 저장
    # 현재 analyze.py는 policy_matching_node를 직접 실행하지 않는다.
    # result_state에 matched_policies가 들어온 경우에만 저장한다.
    matched_policies = result_state.get("matched_policies", [])
    matched_policy_saved_count = 0

    if matched_policies:
        try:
            for policy in matched_policies:
                if not isinstance(policy, dict):
                    continue

                metadata = policy.get("metadata", {})
                if not isinstance(metadata, dict):
                    metadata = {}

                policy_id = (
                    policy.get("policy_id")
                    or policy.get("id")
                    or metadata.get("policy_id")
                    or None
                )

                if not policy_id:
                    continue

                policy_id = str(policy_id).strip()

                if not policy_id:
                    continue

                title = (
                    policy.get("title")
                    or metadata.get("title")
                    or ""
                )

                distance = policy.get("distance", 1)
                match_score = policy.get("match_score")

                if match_score is None:
                    try:
                        match_score = round(1 - float(distance), 3)
                    except Exception:
                        match_score = 0

                (
                    db.table("matched_policy")
                    .insert(
                        {
                            "company_id": company_id,
                            "policy_id": policy_id,
                            "title": title,
                            "match_score": match_score,
                            "eligible": policy.get("eligible", True),
                            "reason": policy.get(
                                "reason",
                                "업종/지역/기업규모 기반 매칭",
                            ),
                            "llm_score": policy.get("llm_score", ""),
                        }
                    )
                    .execute()
                )

                matched_policy_saved_count += 1

        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "matched_policy 저장에 실패했습니다.",
                    "error": str(exc),
                    "hint": "matched_policy.policy_id가 policy 테이블 FK라면 policy 테이블에 실제 존재하는 policy_id만 저장해야 합니다.",
                    "data": {
                        "company": company_row,
                        "equipment": equipment_row,
                        "equipment_id": selected_equipment_id,
                        "roi_result": make_jsonable(result_state.get("roi_result")),
                        "matched_policies": make_jsonable(
                            result_state.get("matched_policies", [])
                        ),
                        "draft_result": make_jsonable(result_state.get("draft_result")),
                        "response": result_state.get("final_response", ""),
                        "unsupported_equipment": result_state.get(
                            "unsupported_equipment",
                            False,
                        ),
                    },
                },
            )

    # 8. draft_result 저장
    draft_result = result_state.get("draft_result")
    draft_result_saved = False

    if draft_result:
        try:
            first_policy_id = get_first_valid_policy_id(db, matched_policies)

            draft_content = make_jsonable(draft_result)

            if not isinstance(draft_content, dict):
                draft_content = {"content": draft_content}

            insert_payload = {
                "company_id": company_id,
                "policy_id": first_policy_id,
                "draft_content": draft_content,
                "created_at": now_iso(),
            }

            (
                db.table("draft_result")
                .insert(insert_payload)
                .execute()
            )

            draft_result_saved = True

        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "draft_result 저장에 실패했습니다.",
                    "error": str(exc),
                    "hint": (
                        "draft_result.policy_id가 policy 테이블 FK라면, "
                        "추천 정책이 없을 때는 빈 문자열이 아니라 null로 저장해야 합니다. "
                        "또한 draft_result 테이블에는 equipment_id를 넣지 않습니다."
                    ),
                    "data": {
                        "company": company_row,
                        "equipment": equipment_row,
                        "equipment_id": selected_equipment_id,
                        "roi_result": make_jsonable(result_state.get("roi_result")),
                        "matched_policies": make_jsonable(
                            result_state.get("matched_policies", [])
                        ),
                        "draft_result": make_jsonable(result_state.get("draft_result")),
                        "response": result_state.get("final_response", ""),
                        "unsupported_equipment": result_state.get(
                            "unsupported_equipment",
                            False,
                        ),
                    },
                },
            )

    return {
        "success": True,
        "data": {
            "company": company_row,
            "equipment": equipment_row,
            "equipment_id": selected_equipment_id,
            "roi_result": make_jsonable(result_state.get("roi_result")),
            "roi_output_saved": roi_output_saved,
            "matched_policies": make_jsonable(
                result_state.get("matched_policies", [])
            ),
            "matched_policy_saved_count": matched_policy_saved_count,
            "draft_result": make_jsonable(result_state.get("draft_result")),
            "draft_result_saved": draft_result_saved,
            "response": result_state.get("final_response", ""),
            "unsupported_equipment": result_state.get(
                "unsupported_equipment",
                False,
            ),
        },
    }