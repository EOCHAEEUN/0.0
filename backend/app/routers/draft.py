from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents.draft import application_draft_node
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.auth import CurrentUser
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.state import FactofitState


router = APIRouter()


class DraftRequest(BaseModel):
    company_id: str
    equipment_id: str
    policy_id: str
    analysis_id: str | None = None


def _normalize_industry_code(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(code).strip() for code in value if str(code).strip()]

    text = str(value).strip()
    if not text:
        return []

    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]

    return [
        code.strip().strip('"').strip("'")
        for code in text.split(",")
        if code.strip().strip('"').strip("'")
    ]


def _normalize_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    text = str(value).strip()
    if not text:
        return []

    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]

    return [
        item.strip().strip('"').strip("'")
        for item in text.split(",")
        if item.strip().strip('"').strip("'")
    ]


def _normalize_scenario_match(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip().lower() for item in value if str(item).strip()]

    text = str(value).strip().lower()
    if not text:
        return []

    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]

    return [
        item.strip().strip('"').strip("'").lower()
        for item in text.split(",")
        if item.strip().strip('"').strip("'")
    ]


def _safe_text(*values: Any, default: str = "") -> str:
    for value in values:
        if value is None:
            continue

        text = str(value).strip()
        if text:
            return text

    return default


def _safe_number(*values: Any) -> float | int | None:
    for value in values:
        if value is None or value == "":
            continue

        try:
            number = float(value)
        except (TypeError, ValueError):
            continue

        if number.is_integer():
            return int(number)

        return number

    return None


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _is_empty_policy_snapshot(snapshot: Any) -> bool:
    if not isinstance(snapshot, dict) or not snapshot:
        return True
    if not snapshot.get("snapshot_version"):
        return True
    return False


def _snapshot_policy_rows(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in snapshot.get("policies") or []:
        if not isinstance(item, dict):
            continue
        policy_id = str(item.get("policy_id") or "").strip()
        if not policy_id:
            continue
        rows.append(item)
    return rows


def _snapshot_policy_by_id(snapshot: dict[str, Any], requested_policy_id: str) -> dict[str, Any] | None:
    requested = str(requested_policy_id or "").strip()
    if not requested:
        return None

    return next(
        (
            row
            for row in _snapshot_policy_rows(snapshot)
            if str(row.get("policy_id") or "").strip() == requested
        ),
        None,
    )


def _matched_policy_from_snapshot(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_id": str(item.get("policy_id") or ""),
        "title": item.get("title") or "선택 지원사업",
        "organization": item.get("organization") or "주관기관 정보 없음",
        "reason": item.get("reason")
        or "분석 시점에 저장된 정책 스냅샷 기준 추천 결과입니다.",
        "scenario_match": item.get("scenario_match"),
        "scenario_label": item.get("scenario_label"),
        "match_score": item.get("match_score"),
        "llm_score": item.get("llm_score"),
        "eligible": item.get("eligible", True),
    }


def _policy_from_snapshot(item: dict[str, Any]) -> dict[str, Any]:
    support_items = item.get("support_items")
    if isinstance(support_items, list):
        support_summary = ", ".join(
            [str(entry).strip() for entry in support_items if str(entry).strip()]
        )
    else:
        support_summary = ""

    return {
        "policy_id": str(item.get("policy_id") or ""),
        "title": item.get("title") or "지원사업명 미확인",
        "organization": item.get("organization"),
        "agency": item.get("organization"),
        "provider": item.get("organization"),
        "max_amount": item.get("max_amount_numeric_manwon")
        or item.get("max_amount_actual"),
        "summary": item.get("summary") or support_summary,
        "raw_text": item.get("summary") or support_summary,
        "url": item.get("url"),
        "source_url": item.get("url"),
        "policy_url": item.get("url"),
        "deadline": item.get("deadline"),
        "deadline_display": item.get("deadline_display"),
        "policy_category": item.get("policy_category"),
        "policy_subcategory": item.get("policy_subcategory"),
        "support_items": support_items if isinstance(support_items, list) else [],
    }


def _resolve_draft_scenario(policy: dict, roi_data: dict) -> tuple[str, dict]:
    """
    Pick the ROI scenario used for the draft.

    A: use scenario_a
    B: use scenario_b
    C or A+B: common-fit policy, but draft basis defaults to scenario_a.
    """
    scenario_match = _normalize_scenario_match(policy.get("scenario_match"))

    if "c" in scenario_match or set(scenario_match) == {"a", "b"}:
        return "a", _as_dict(roi_data.get("scenario_a"))

    if "a" in scenario_match:
        return "a", _as_dict(roi_data.get("scenario_a"))

    if "b" in scenario_match:
        return "b", _as_dict(roi_data.get("scenario_b"))

    recommended = _safe_text(
        roi_data.get("recommended"),
        roi_data.get("recommended_scenario"),
        roi_data.get("selected_scenario"),
    ).lower()

    if "b" in recommended:
        return "b", _as_dict(roi_data.get("scenario_b"))

    return "a", _as_dict(roi_data.get("scenario_a"))


def _get_scenario_investment(scenario: dict, equipment_data: dict, scenario_used: str):
    if scenario_used == "b":
        fallback_investment = equipment_data.get("scenario_b_investment_manwon")
    else:
        fallback_investment = equipment_data.get("scenario_a_investment_manwon")

    return _safe_number(
        scenario.get("investment_manwon"),
        scenario.get("total_investment_manwon"),
        scenario.get("investment_cost_manwon"),
        scenario.get("total_cost_manwon"),
        scenario.get("initial_investment_manwon"),
        scenario.get("investment"),
        fallback_investment,
    )


def _get_scenario_subsidy(scenario: dict, policy_detail: dict):
    return _safe_number(
        scenario.get("subsidy_manwon"),
        scenario.get("subsidy_amount_manwon"),
        scenario.get("expected_subsidy_manwon"),
        scenario.get("support_amount_manwon"),
        scenario.get("support_amount"),
        policy_detail.get("max_amount"),
        policy_detail.get("max_amount_manwon"),
        policy_detail.get("support_amount"),
        policy_detail.get("subsidy_amount"),
        policy_detail.get("support_limit"),
    )


def _get_scenario_payback(scenario: dict):
    return _safe_number(
        scenario.get("payback_months"),
        scenario.get("payback_period_months"),
        scenario.get("payback"),
        scenario.get("payback_month"),
        scenario.get("recovery_months"),
    )


def _fetch_policy_detail_by_id(db: Any, policy_id: str) -> dict:
    if not policy_id:
        return {}

    try:
        result = (
            db.table("policy")
            .select("*")
            .eq("policy_id", policy_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception as exc:
        print(f"policy 상세정보 조회 실패: {exc}")

    return {}


def _merge_policy(matched_policy: dict, policy_detail: dict) -> dict:
    """
    matched_policy: recommendation result.
    policy: canonical announcement detail.
    Recommendation fields should override only recommendation-specific fields.
    """
    policy_detail = policy_detail or {}
    matched_policy = matched_policy or {}

    metadata = {
        **_as_dict(policy_detail.get("metadata")),
        **_as_dict(matched_policy.get("metadata")),
    }

    return {
        **policy_detail,
        **matched_policy,
        "policy_id": _safe_text(
            matched_policy.get("policy_id"),
            policy_detail.get("policy_id"),
            policy_detail.get("id"),
        ),
        "title": _safe_text(
            matched_policy.get("title"),
            policy_detail.get("title"),
            metadata.get("title"),
        ),
        "organization": _safe_text(
            policy_detail.get("organization"),
            policy_detail.get("agency"),
            policy_detail.get("provider"),
            metadata.get("organization"),
            metadata.get("agency"),
            matched_policy.get("organization"),
        ),
        "summary": _safe_text(
            policy_detail.get("summary"),
            policy_detail.get("description"),
            metadata.get("summary"),
            metadata.get("description"),
        ),
        "raw_text": _safe_text(
            policy_detail.get("raw_text"),
            policy_detail.get("content"),
            policy_detail.get("support_content"),
            metadata.get("raw_text"),
            metadata.get("content"),
        ),
        "url": _safe_text(
            policy_detail.get("url"),
            policy_detail.get("source_url"),
            policy_detail.get("policy_url"),
            metadata.get("url"),
            metadata.get("source_url"),
            metadata.get("policy_url"),
        ),
        "max_amount": _safe_number(
            policy_detail.get("max_amount"),
            policy_detail.get("max_amount_manwon"),
            policy_detail.get("support_amount"),
            policy_detail.get("subsidy_amount"),
            policy_detail.get("support_limit"),
            metadata.get("max_amount"),
        ),
        "deadline": _safe_text(
            policy_detail.get("deadline"),
            policy_detail.get("end_date"),
            policy_detail.get("deadline_display"),
            metadata.get("deadline"),
            metadata.get("end_date"),
        ),
        "reason": _safe_text(
            matched_policy.get("reason"),
            metadata.get("reason"),
            "업종·지역·설비 정보와 ROI 분석 결과를 기준으로 추천되었습니다.",
        ),
        "llm_score": _safe_text(matched_policy.get("llm_score"), metadata.get("llm_score")),
        "scenario_match": matched_policy.get("scenario_match") or metadata.get("scenario_match"),
        "scenario_label": _safe_text(
            matched_policy.get("scenario_label"),
            metadata.get("scenario_label"),
        ),
        "match_score": matched_policy.get("match_score"),
    }


def _coerce_draft_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return dict(value)

    if isinstance(value, str) and value.strip():
        return {
            "business_necessity": value.strip(),
        }

    return {}


def _build_expected_benefits(draft_content: dict, scenario: dict, equipment_data: dict) -> list[str]:
    existing = draft_content.get("expected_benefits")

    if isinstance(existing, list):
        benefits = [str(item).strip() for item in existing if str(item).strip()]
        if benefits:
            return benefits

    energy_saving = _safe_number(
        scenario.get("energy_saving_manwon"),
        scenario.get("energy_saving_annual_manwon"),
        scenario.get("annual_energy_saving_manwon"),
    )
    maintenance_saving = _safe_number(
        scenario.get("maintenance_saving_manwon"),
        scenario.get("maintenance_saving_annual_manwon"),
        scenario.get("annual_maintenance_saving_manwon"),
    )
    defect_rate = _safe_number(equipment_data.get("defect_rate"))

    benefits = [
        "노후 설비 개선을 통한 생산 안정성 향상",
        "에너지 사용 효율 개선 및 운영 비용 절감",
        "유지보수 부담 완화와 품질 관리 기준 강화",
    ]

    if energy_saving is not None:
        benefits[1] = f"연간 에너지 비용 약 {energy_saving:,}만원 절감 기대"

    if maintenance_saving is not None:
        benefits[2] = f"연간 유지보수 비용 약 {maintenance_saving:,}만원 절감 기대"

    if defect_rate is not None:
        benefits.append(f"현재 불량률 {defect_rate:g}% 개선을 통한 품질 안정화 기대")

    return benefits[:4]


def _build_required_documents(draft_content: dict) -> list[str]:
    existing = draft_content.get("required_documents")

    if isinstance(existing, list):
        documents = [str(item).strip() for item in existing if str(item).strip()]
        if documents:
            return documents

    return [
        "사업자등록증",
        "설비 견적서",
        "현 설비 사진",
        "최근 재무제표",
        "지원사업 공고문",
    ]


def _enrich_draft_content(
    draft_content: Any,
    *,
    body: DraftRequest,
    company_data: dict,
    equipment_data: dict,
    selected_policy: dict,
    selected_roi_scenario: dict,
    scenario_used: str,
    scenario_label: str,
) -> dict:
    """
    LLM writes the sentences, but DB is the source of truth for IDs,
    company/equipment names, policy details, scenario amounts and core values.
    """
    content = _coerce_draft_dict(draft_content)

    company_name = _safe_text(company_data.get("company_name"), default="기업명 미입력")
    equipment_name = _safe_text(equipment_data.get("name"), default="설비명 미입력")
    policy_title = _safe_text(selected_policy.get("title"), default="추천 지원사업 미선택")
    organization = _safe_text(
        selected_policy.get("organization"),
        selected_policy.get("agency"),
        selected_policy.get("provider"),
        default="주관사 정보 없음",
    )

    investment_manwon = _get_scenario_investment(
        selected_roi_scenario,
        equipment_data,
        scenario_used,
    )
    subsidy_manwon = _get_scenario_subsidy(selected_roi_scenario, selected_policy)
    payback_months = _get_scenario_payback(selected_roi_scenario)

    application_purpose = _safe_text(
        content.get("application_purpose"),
        f"{equipment_name} 설비의 노후화 개선 및 생산 효율 향상을 위해 {policy_title}을 활용하고자 합니다.",
    )

    business_necessity = _safe_text(
        content.get("business_necessity"),
        f"현재 {equipment_name} 설비의 사용연수와 운영비 부담을 고려할 때, 설비 개선을 통한 에너지 비용 절감과 생산 안정성 확보가 필요합니다.",
    )

    expected_effects = _safe_text(
        content.get("expected_effects"),
        f"{scenario_label} 기준 설비투자를 통해 에너지 효율 개선, 유지보수 부담 완화, 품질 안정화 효과를 기대할 수 있습니다.",
    )

    ai_reasons = content.get("ai_reasons")
    if not isinstance(ai_reasons, list) or not ai_reasons:
        ai_reasons = [
            _safe_text(selected_policy.get("reason"), "지원사업 조건과 기업·설비 정보의 적합성이 확인되었습니다."),
            f"{scenario_label} 기준 ROI 분석 결과를 신청 목적과 투자 근거에 반영했습니다.",
            "DB에 저장된 기업정보, 설비정보, 추천정책 정보를 신청서 초안의 기준값으로 사용했습니다.",
        ]

    return {
        **content,
        "company_id": body.company_id,
        "equipment_id": body.equipment_id,
        "policy_id": body.policy_id,
        "company_name": company_name,
        "equipment_name": equipment_name,
        "selected_policy": policy_title,
        "agency": organization,
        "organization": organization,
        "policy_url": _safe_text(selected_policy.get("url")),
        "policy_summary": _safe_text(selected_policy.get("summary")),
        "policy_raw_text": _safe_text(selected_policy.get("raw_text")),
        "policy_deadline": _safe_text(selected_policy.get("deadline")),
        "application_purpose": application_purpose,
        "investment_manwon": investment_manwon,
        "subsidy_manwon": subsidy_manwon,
        "payback_months": payback_months,
        "expected_benefits": _build_expected_benefits(content, selected_roi_scenario, equipment_data),
        "readiness_score": _safe_number(content.get("readiness_score"), selected_policy.get("match_score"), 70),
        "ai_reasons": [str(item).strip() for item in ai_reasons if str(item).strip()],
        "business_necessity": business_necessity,
        "expected_effects": expected_effects,
        "required_documents": _build_required_documents(content),
        "scenario_used": scenario_used,
        "scenario_label": scenario_label,
        "created_at": datetime.now().isoformat(),
    }


@router.post("/draft")
async def generate_draft(
    body: DraftRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    company_result = (
        db.table("company")
        .select("*")
        .eq("company_id", body.company_id)
        .eq("user_id", current_user.id)
        .execute()
    )

    if not company_result.data:
        raise HTTPException(status_code=404, detail="기업 정보를 찾을 수 없습니다.")

    company_data = company_result.data[0]
    prefetched_roi_output = None

    if body.analysis_id:
        roi_row = (
            db.table("roi_output")
            .select("*")
            .eq("id", body.analysis_id)
            .eq("company_id", body.company_id)
            .limit(1)
            .execute()
        )
        if not roi_row.data:
            raise HTTPException(status_code=404, detail="遺꾩꽍 ?대젰??李얠쓣 ???놁뒿?덈떎.")

        prefetched_roi_output = roi_row.data[0]
        snapshot_equipment_id = str(prefetched_roi_output.get("equipment_id") or "").strip()
        if snapshot_equipment_id:
            body = body.model_copy(update={"equipment_id": snapshot_equipment_id})

    company = CompanyContext(
        company_id=company_data.get("company_id"),
        company_name=company_data.get("company_name", ""),
        industry_code=_normalize_industry_code(company_data.get("industry_code")),
        industry_name=company_data.get("industry_name"),
        region=company_data.get("region", ""),
        company_type=company_data.get("company_type"),
        primary_purpose=_normalize_list(company_data.get("primary_purpose")),
        employee_count=company_data.get("employee_count"),
        annual_revenue=company_data.get("annual_revenue"),
        revenue_2y_ago_manwon=company_data.get("revenue_2y_ago_manwon"),
        revenue_3y_ago_manwon=company_data.get("revenue_3y_ago_manwon"),
        total_assets_manwon=company_data.get("total_assets_manwon"),
        established_year=company_data.get("established_year"),
        workplace_type=company_data.get("workplace_type"),
    )

    equipment_result = (
        db.table("equipment")
        .select("*")
        .eq("company_id", body.company_id)
        .eq("equipment_id", body.equipment_id)
        .execute()
    )

    if not equipment_result.data:
        raise HTTPException(status_code=404, detail="설비 정보를 찾을 수 없습니다.")

    equipment_data = equipment_result.data[0]

    equipment = EquipmentInput(
        name=equipment_data.get("name", ""),
        category=equipment_data.get("category", ""),
        age_years=equipment_data.get("age_years", 0),
        energy_cost_annual=equipment_data.get("energy_cost_annual", 0),
        defect_rate=equipment_data.get("defect_rate"),
        maintenance_cost_annual=equipment_data.get("maintenance_cost_annual"),
        current_capacity_value=equipment_data.get("current_capacity_value"),
        production_qty=equipment_data.get("production_qty"),
        process=equipment_data.get("process"),
        contribution_margin_won=equipment_data.get("contribution_margin_won"),
        scenario_a_investment_manwon=equipment_data.get("scenario_a_investment_manwon"),
        scenario_b_investment_manwon=equipment_data.get("scenario_b_investment_manwon"),
    )

    if body.analysis_id:
        roi_row = (
            db.table("roi_output")
            .select("*")
            .eq("id", body.analysis_id)
            .eq("company_id", body.company_id)
            .limit(1)
            .execute()
        )
        if not roi_row.data:
            raise HTTPException(status_code=404, detail="분석 이력을 찾을 수 없습니다.")

        roi_output = roi_row.data[0]
        snapshot = _as_dict(roi_output.get("policy_snapshot"))
        if _is_empty_policy_snapshot(snapshot):
            raise HTTPException(
                status_code=409,
                detail="저장된 정책 정보 없음",
            )

        snapshot_policy = _snapshot_policy_by_id(snapshot, body.policy_id)
        if not snapshot_policy:
            raise HTTPException(
                status_code=409,
                detail="저장된 정책 정보에서 요청한 정책을 찾을 수 없습니다.",
            )

        roi_data = _as_dict(roi_output.get("roi_data"))
        selected_matched_policy = _matched_policy_from_snapshot(snapshot_policy)
        selected_policy = _policy_from_snapshot(snapshot_policy)
    else:
        roi_result = (
            db.table("roi_output")
            .select("*")
            .eq("company_id", body.company_id)
            .eq("equipment_id", body.equipment_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if not roi_result.data:
            raise HTTPException(status_code=404, detail="ROI 분석 결과를 찾을 수 없습니다.")

        roi_data = roi_result.data[0].get("roi_data") or {}

        top_policy_result = (
            db.table("matched_policy")
            .select("*")
            .eq("company_id", body.company_id)
            .eq("equipment_id", body.equipment_id)
            .order("match_score", desc=True)
            .limit(5)
            .execute()
        )

        top_policies = top_policy_result.data or []
        selected_matched_policy = next(
            (
                policy
                for policy in top_policies
                if str(policy.get("policy_id", "")).strip() == body.policy_id
            ),
            None,
        )

        if not selected_matched_policy:
            raise HTTPException(
                status_code=400,
                detail="신청서 초안은 추천 TOP 5 정책에 대해서만 생성할 수 있습니다.",
            )

        policy_detail = _fetch_policy_detail_by_id(db, body.policy_id)
        selected_policy = _merge_policy(selected_matched_policy, policy_detail)

    scenario_used, selected_roi_scenario = _resolve_draft_scenario(
        selected_policy,
        roi_data,
    )

    scenario_label = _safe_text(
        selected_policy.get("scenario_label"),
        "A안 전체교체 적합" if scenario_used == "a" else "B안 부분개선 적합",
    )

    state: FactofitState = {
        "user_query": f"{equipment.name} {selected_policy.get('title', '')} 신청서 초안 작성",
        "intent": "draft",
        "is_safe": True,
        "company_info": company,
        "equipment": equipment,
        "equipment_id": body.equipment_id,
        "equipments": [equipment_data],
        "selected_equipment_id": body.equipment_id,
        "matched_policies": [selected_policy],
        "selected_policy": selected_policy,
        "policy_intent_choice": None,
        "selected_equipment_for_policy": None,
        "roi_result": selected_roi_scenario,
        "draft_result": None,
        "draft_context": {
            "scenario_used": scenario_used,
            "scenario_label": scenario_label,
            "policy": selected_policy,
            "roi_recommended": roi_data.get("recommended"),
        },
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None,
        "safety_dashboard": None,
        "options": None # ← 추추추가
    }

    try:
        result_state = application_draft_node(state)
        raw_draft_content = result_state.get("draft_result")
    except Exception as exc:
        # LLM quota/rate-limit/API errors should not break the draft API.
        # The router will still create a DB-backed draft using company/equipment/ROI/policy data.
        print(f"신청서 LLM 생성 실패 - DB 기반 fallback 초안으로 대체합니다: {exc}")
        raw_draft_content = {}

    if not raw_draft_content:
        raw_draft_content = {}

    draft_content = _enrich_draft_content(
        raw_draft_content,
        body=body,
        company_data=company_data,
        equipment_data=equipment_data,
        selected_policy=selected_policy,
        selected_roi_scenario=selected_roi_scenario,
        scenario_used=scenario_used,
        scenario_label=scenario_label,
    )

    draft_payload = {
        "company_id": body.company_id,
        "equipment_id": body.equipment_id,
        "policy_id": body.policy_id,
        "draft_content": draft_content,
        "created_at": datetime.now().isoformat(),
    }

    # Keep only one latest draft for the same company/equipment/policy.
    db.table("draft_result").delete().eq(
        "company_id",
        body.company_id,
    ).eq(
        "equipment_id",
        body.equipment_id,
    ).eq(
        "policy_id",
        body.policy_id,
    ).execute()

    saved_draft = db.table("draft_result").insert(draft_payload).execute()

    return {
        "success": True,
        "data": {
            "draft_result_id": (
                saved_draft.data[0].get("draft_result_id")
                if saved_draft.data
                else None
            ),
            "analysis_id": body.analysis_id,
            "policy_id": body.policy_id,
            "company_id": body.company_id,
            "equipment_id": body.equipment_id,
            "scenario_used": scenario_used,
            "scenario_label": scenario_label,
            "draft_result": draft_content,
        },
    }
