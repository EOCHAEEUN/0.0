from __future__ import annotations

import re
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.database import get_db

logger = logging.getLogger(__name__)


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


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


def _parse_deadline(raw: str) -> date | None:
    text = str(raw or "").strip()
    if not text or text in {"None", "마감일 미정"}:
        return None
    match = re.search(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", text)
    if not match:
        return None
    year, month, day = (int(part) for part in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _format_deadline_display(deadline: date) -> str:
    return f"{deadline.year}.{deadline.month:02d}.{deadline.day:02d}"


def _d_day_label(days_remaining: int) -> str:
    if days_remaining < 0:
        return "마감"
    if days_remaining == 0:
        return "D-Day"
    return f"D-{days_remaining}"


def _policy_deadline_raw(policy: dict[str, Any]) -> str:
    return _safe_text(
        policy.get("deadline_display"),
        policy.get("deadline"),
        policy.get("end_date"),
        policy.get("application_end_date"),
    )


def _policy_match_score(policy: dict[str, Any]) -> float:
    return float(_safe_number(policy.get("match_score"), policy.get("llm_score")) or 0)


def _equipment_needs_priority(equipment: dict[str, Any]) -> bool:
    age = _safe_number(equipment.get("age_years"))
    if age is not None and age >= 7:
        return True
    missing = not all(
        _safe_text(equipment.get(key))
        or equipment.get(key) is not None
        for key in ("name", "category", "age_years", "energy_cost_annual")
    )
    return missing


def _equipment_basic_missing(equipment: dict[str, Any] | None) -> list[str]:
    if not equipment:
        return ["equipment"]
    missing: list[str] = []
    for field in ("name", "category", "age_years", "energy_cost_annual"):
        value = equipment.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(field)
    return missing


def _resolve_active_analysis_id(
    *,
    requested_analysis_id: str | None,
    roi_outputs: list[dict[str, Any]],
) -> str | None:
    if requested_analysis_id:
        for row in roi_outputs:
            if str(row.get("id") or "") == requested_analysis_id:
                return requested_analysis_id

    if roi_outputs:
        return str(roi_outputs[0].get("id") or "") or None
    return None


def _resolve_priority_equipment(
    *,
    company: dict[str, Any],
    equipments: list[dict[str, Any]],
    active_roi: dict[str, Any] | None,
) -> dict[str, Any] | None:
    equipment_by_id = {
        str(item.get("equipment_id") or ""): item for item in equipments if item.get("equipment_id")
    }

    active_equipment_id = _safe_text((active_roi or {}).get("equipment_id"))
    if active_equipment_id and active_equipment_id in equipment_by_id:
        return equipment_by_id[active_equipment_id]

    representative_id = _safe_text(company.get("representative_equipment_id"))
    if representative_id and representative_id in equipment_by_id:
        return equipment_by_id[representative_id]

    return None


def _priority_policy(
    snapshot: dict[str, Any],
    policies: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not policies:
        return None

    recommended_id = _safe_text(snapshot.get("recommended_policy_id"))
    if recommended_id:
        matched = next(
            (row for row in policies if str(row.get("policy_id") or "") == recommended_id),
            None,
        )
        if matched:
            return matched

    scored = sorted(policies, key=_policy_match_score, reverse=True)
    if scored and _policy_match_score(scored[0]) > 0:
        return scored[0]

    dated: list[tuple[date, dict[str, Any]]] = []
    today = date.today()
    for policy in policies:
        deadline = _parse_deadline(_policy_deadline_raw(policy))
        if deadline and deadline >= today:
            dated.append((deadline, policy))
    if dated:
        dated.sort(key=lambda item: item[0])
        return dated[0][1]

    return scored[0] if scored else None


def _build_deadlines(
    policies: list[dict[str, Any]],
    *,
    analysis_id: str,
    priority_policy_id: str | None,
    legacy_missing: bool,
) -> list[dict[str, Any]]:
    if legacy_missing:
        return []

    today = date.today()
    rows: list[dict[str, Any]] = []
    for policy in policies:
        raw = _policy_deadline_raw(policy)
        deadline = _parse_deadline(raw)
        if not deadline or deadline < today:
            continue
        days_remaining = (deadline - today).days
        if days_remaining > 30:
            continue
        policy_id = str(policy.get("policy_id") or "")
        rows.append(
            {
                "policy_id": policy_id or None,
                "title": _safe_text(policy.get("title"), default="공고명 미확인"),
                "deadline": raw,
                "deadline_display": _format_deadline_display(deadline),
                "d_day": _d_day_label(days_remaining),
                "days_remaining": days_remaining,
                "status_hint": _deadline_status_hint(policy, days_remaining),
                "is_priority": bool(priority_policy_id and policy_id == priority_policy_id),
            }
        )

    rows.sort(key=lambda item: int(item.get("days_remaining") or 999))
    return rows[:5]


def _deadline_status_hint(policy: dict[str, Any], days_remaining: int) -> str:
    if days_remaining <= 3:
        return "제출서류 확인 필요"
    if days_remaining <= 7:
        return "기업규모 요건 확인"
    reason = _safe_text(policy.get("reason"))
    if reason:
        return reason[:40]
    return "공고 조건 확인 필요"


def _build_priority_tags(
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    policy: dict[str, Any] | None,
) -> list[str]:
    tags: list[str] = []
    industry = _safe_text(company.get("industry_name"))
    if industry:
        tags.append(industry)
    category = _safe_text((equipment or {}).get("category"))
    if category:
        tags.append(category)
    age = _safe_number((equipment or {}).get("age_years"))
    if age is not None and age >= 7:
        tags.append("노후 설비 교체")
    scenario_label = _safe_text((policy or {}).get("scenario_label"))
    if scenario_label:
        tags.append(scenario_label)
    tags.append("우선 검토 1순위")
    deduped: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if tag in seen:
            continue
        seen.add(tag)
        deduped.append(tag)
    return deduped[:4]


def _priority_reason(policy: dict[str, Any] | None, *, legacy_missing: bool) -> str:
    if legacy_missing:
        return "분석 당시 정책 이력이 없어 추천 공고를 표시할 수 없습니다."
    if not policy:
        return "현재 분석에 연결된 지원사업이 없습니다."
    reason = _safe_text(policy.get("reason"))
    if reason:
        return reason
    deadline = _parse_deadline(_policy_deadline_raw(policy))
    if deadline:
        days = (deadline - date.today()).days
        if days <= 7:
            return "마감일 확인이 필요한 공고라 업종코드와 제출서류를 먼저 확인해보세요."
    return "업종·지역·설비 조건과 ROI 분석 결과를 기준으로 우선 확인할 공고입니다."


def _analysis_status_label(roi_data: dict[str, Any]) -> str:
    stage = _safe_text(roi_data.get("analysis_stage")).lower()
    if stage in {"completed", "complete", "done"}:
        return "분석 완료"
    if stage in {"draft", "in_progress", "running"}:
        return "검토 중"
    return "분석 완료"


def _build_recent_analyses(
    roi_outputs: list[dict[str, Any]],
    equipments: list[dict[str, Any]],
    *,
    limit: int = 3,
) -> list[dict[str, Any]]:
    equipment_by_id = {
        str(item.get("equipment_id") or ""): item for item in equipments if item.get("equipment_id")
    }
    rows: list[dict[str, Any]] = []
    for index, roi in enumerate(roi_outputs[:limit], start=1):
        equipment_id = str(roi.get("equipment_id") or "")
        equipment = equipment_by_id.get(equipment_id, {})
        roi_data = _as_dict(roi.get("roi_data"))
        recommended = _safe_text(roi_data.get("recommended")).lower()
        scenario = _as_dict(
            roi_data.get("scenario_b" if "b" in recommended else "scenario_a")
        )
        investment = _safe_number(
            scenario.get("investment_manwon"),
            roi.get("scenario_a_investment_manwon"),
            roi.get("scenario_b_investment_manwon"),
        )
        payback = _safe_number(scenario.get("payback_years"))
        detail_parts = [
            compact
            for compact in [
                _safe_text(equipment.get("category")),
                _safe_text(equipment.get("process")),
                "최근 분석",
            ]
            if compact
        ]
        metric = ""
        if investment is not None:
            metric = f"투자금 {int(investment):,}만원"
        elif payback is not None:
            metric = f"회수기간 {float(payback):g}년"
        rows.append(
            {
                "index": index,
                "analysis_id": str(roi.get("id") or ""),
                "equipment_id": equipment_id or None,
                "title": f"{_safe_text(equipment.get('name'), default='설비')} 투자분석",
                "equipment_name": _safe_text(equipment.get("name"), default="설비명 미확인"),
                "summary": " · ".join(detail_parts),
                "detail": metric or "ROI 분석 결과 확인",
                "status": _analysis_status_label(roi_data),
                "created_at": roi.get("created_at"),
            }
        )
    return rows


def _build_today_tasks(
    *,
    deadlines: list[dict[str, Any]],
    representative_equipment: dict[str, Any] | None,
    active_analysis: dict[str, Any] | None,
    legacy_missing: bool,
    draft_exists: bool,
    company: dict[str, Any],
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    urgent_deadlines = [
        row for row in deadlines if int(row.get("days_remaining") or 99) <= 7
    ]
    if urgent_deadlines:
        items.append(
            {
                "key": "deadline",
                "label": "마감 임박 공고 확인",
                "summary": f"D-{urgent_deadlines[0]['days_remaining']} {urgent_deadlines[0]['title']}",
            }
        )

    if not _safe_text(company.get("representative_equipment_id")) and not active_analysis:
        items.append(
            {
                "key": "representative_equipment",
                "label": "대표 설비 선택",
                "summary": "대표 설비를 먼저 선택해주세요",
            }
        )

    missing = _equipment_basic_missing(representative_equipment)
    if representative_equipment and missing:
        items.append(
            {
                "key": "equipment_fields",
                "label": "설비 기본정보 보완",
                "summary": "대표 설비 입력값을 확인해주세요",
            }
        )

    if not active_analysis:
        items.append(
            {
                "key": "analysis",
                "label": "ROI 분석 시작",
                "summary": "ROI 분석을 시작해보세요",
            }
        )

    if legacy_missing:
        items.append(
            {
                "key": "policy_snapshot",
                "label": "정책 이력 없음",
                "summary": "분석 당시 정책 이력이 없습니다",
            }
        )

    if active_analysis and not legacy_missing and not draft_exists:
        items.append(
            {
                "key": "draft",
                "label": "신청서 초안 준비",
                "summary": "신청서 초안 생성이 필요합니다",
            }
        )

    if urgent_deadlines:
        summary = "확인할 마감 일정 있음"
    elif items:
        summary = items[0]["summary"]
    else:
        summary = "현재 확인할 마감 없음"

    return {
        "count": len(items),
        "summary": summary,
        "items": items,
    }


def _verify_company(db: Any, company_id: str, user_id: str) -> dict[str, Any]:
    result = (
        db.table("company")
        .select("*")
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise PermissionError("기업 정보를 찾을 수 없거나 접근 권한이 없습니다.")
    return result.data[0]


def set_representative_equipment(
    *,
    company_id: str,
    equipment_id: str | None,
    user_id: str,
) -> dict[str, Any]:
    db = get_db()
    company = _verify_company(db, company_id, user_id)

    normalized_equipment_id = _safe_text(equipment_id) or None
    update_payload: dict[str, Any] = {
        "representative_equipment_id": normalized_equipment_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if not normalized_equipment_id:
        updated = (
            db.table("company")
            .update(update_payload)
            .eq("company_id", company_id)
            .eq("user_id", user_id)
            .execute()
        )
        row = (updated.data or [company])[0]
        return {
            "company_id": company_id,
            "representative_equipment_id": None,
            "equipment_name": None,
            "equipment": None,
            "company": row,
            "cleared": True,
        }

    equipment_result = (
        db.table("equipment")
        .select("equipment_id,company_id,name,category,process,age_years")
        .eq("equipment_id", normalized_equipment_id)
        .limit(1)
        .execute()
    )
    if not equipment_result.data:
        raise ValueError("존재하지 않는 설비입니다.")

    equipment_row = equipment_result.data[0]
    if str(equipment_row.get("company_id") or "") != str(company_id):
        raise PermissionError("다른 회사의 설비는 대표 설비로 설정할 수 없습니다.")

    updated = (
        db.table("company")
        .update(update_payload)
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .execute()
    )
    row = (updated.data or [company])[0]
    return {
        "company_id": company_id,
        "representative_equipment_id": normalized_equipment_id,
        "equipment_name": equipment_row.get("name"),
        "equipment": equipment_row,
        "company": row,
        "cleared": False,
    }


def load_dashboard_overview(
    *,
    company_id: str,
    user_id: str,
    analysis_id: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    representative_id: str | None = None
    representative_equipment: dict[str, Any] | None = None
    representative_lookup_attempted = False

    logger.info(
        "dashboard_overview start company_id=%s analysis_id=%s",
        company_id,
        analysis_id,
    )
    try:
        company = _verify_company(db, company_id, user_id)
    except Exception:
        logger.exception(
            "dashboard_overview step=company_query failed table=company company_id=%s analysis_id=%s",
            company_id,
            analysis_id,
        )
        raise
    representative_id = _safe_text(company.get("representative_equipment_id")) or None
    logger.info(
        "dashboard_overview step=company_query success table=company company_id=%s representative_exists=%s",
        company_id,
        bool(representative_id),
    )

    try:
        equipments = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .order("created_at", desc=False)
            .execute()
            .data
            or []
        )
    except Exception:
        logger.exception(
            "dashboard_overview step=equipment_list failed table=equipment company_id=%s analysis_id=%s",
            company_id,
            analysis_id,
        )
        raise
    logger.info(
        "dashboard_overview step=equipment_list success table=equipment company_id=%s equipment_count=%s",
        company_id,
        len(equipments),
    )

    if representative_id:
        representative_lookup_attempted = True
        try:
            representative_query = (
                db.table("equipment")
                .select("*")
                .eq("equipment_id", representative_id)
                .limit(1)
                .execute()
            )
        except Exception:
            logger.exception(
                "dashboard_overview step=representative_equipment_query failed table=equipment company_id=%s analysis_id=%s representative_equipment_id=%s",
                company_id,
                analysis_id,
                representative_id,
            )
            raise
        representative_equipment = (representative_query.data or [None])[0]
        if representative_equipment and str(representative_equipment.get("company_id") or "") != str(
            company_id
        ):
            logger.warning(
                "dashboard_overview step=representative_equipment_query mismatch company_id=%s representative_equipment_id=%s equipment_company_id=%s",
                company_id,
                representative_id,
                representative_equipment.get("company_id"),
            )
            representative_equipment = None
        logger.info(
            "dashboard_overview step=representative_equipment_query success table=equipment company_id=%s representative_found=%s",
            company_id,
            bool(representative_equipment),
        )

    try:
        roi_outputs = (
            db.table("roi_output")
            .select("*")
            .eq("company_id", company_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
            .data
            or []
        )
    except Exception:
        logger.exception(
            "dashboard_overview step=roi_output_list failed table=roi_output company_id=%s analysis_id=%s",
            company_id,
            analysis_id,
        )
        raise
    logger.info(
        "dashboard_overview step=roi_output_list success table=roi_output company_id=%s roi_count=%s",
        company_id,
        len(roi_outputs),
    )

    try:
        active_analysis_id = _resolve_active_analysis_id(
            requested_analysis_id=analysis_id,
            roi_outputs=roi_outputs,
        )
    except Exception:
        logger.exception(
            "dashboard_overview step=active_analysis_resolve failed company_id=%s analysis_id=%s",
            company_id,
            analysis_id,
        )
        raise
    active_roi = next(
        (row for row in roi_outputs if str(row.get("id") or "") == str(active_analysis_id or "")),
        None,
    )
    logger.info(
        "dashboard_overview step=active_analysis_resolve success company_id=%s requested_analysis_id=%s resolved_analysis_id=%s",
        company_id,
        analysis_id,
        active_analysis_id,
    )

    priority_equipment = _resolve_priority_equipment(
        company=company,
        equipments=equipments,
        active_roi=active_roi,
    )

    snapshot = _as_dict((active_roi or {}).get("policy_snapshot"))
    legacy_missing = bool(active_analysis_id and _is_empty_policy_snapshot(snapshot))
    policies = [] if legacy_missing else _snapshot_policy_rows(snapshot)
    priority_policy = None if legacy_missing else _priority_policy(snapshot, policies)
    priority_policy_id = str((priority_policy or {}).get("policy_id") or "") or None
    logger.info(
        "dashboard_overview step=policy_snapshot_parse success company_id=%s analysis_id=%s legacy_missing=%s policy_count=%s",
        company_id,
        active_analysis_id,
        legacy_missing,
        len(policies),
    )

    deadlines = _build_deadlines(
        policies,
        analysis_id=str(active_analysis_id or ""),
        priority_policy_id=priority_policy_id,
        legacy_missing=legacy_missing,
    )

    today = date.today()
    closing_soon = len(
        [
            row
            for row in deadlines
            if int(row.get("days_remaining") or 99) <= 30
        ]
    )

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_analysis_count = 0
    for row in roi_outputs:
        created_raw = _safe_text(row.get("created_at"))
        if not created_raw:
            continue
        try:
            created_at = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at >= thirty_days_ago:
            recent_analysis_count += 1

    draft_exists = False
    if active_analysis_id and priority_policy_id:
        try:
            draft_result = (
                db.table("draft_result")
                .select("draft_result_id")
                .eq("company_id", company_id)
                .eq("analysis_id", active_analysis_id)
                .eq("policy_id", priority_policy_id)
                .limit(1)
                .execute()
            )
        except Exception:
            logger.exception(
                "dashboard_overview step=draft_result_query failed table=draft_result company_id=%s analysis_id=%s policy_id=%s",
                company_id,
                active_analysis_id,
                priority_policy_id,
            )
            raise
        if not draft_result.data:
            draft_result = (
                db.table("draft_result")
                .select("draft_result_id")
                .eq("company_id", company_id)
                .eq("policy_id", priority_policy_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        draft_exists = bool(draft_result.data)
        logger.info(
            "dashboard_overview step=draft_result_query success table=draft_result company_id=%s analysis_id=%s policy_id=%s draft_exists=%s",
            company_id,
            active_analysis_id,
            priority_policy_id,
            draft_exists,
        )

    priority_count = len(
        [equipment for equipment in equipments if _equipment_needs_priority(equipment)]
    )
    if priority_count == 0 and priority_equipment:
        priority_count = 1

    hero_reason = ""
    if priority_equipment:
        name = _safe_text(priority_equipment.get("name"), default="대표 설비")
        age = _safe_number(priority_equipment.get("age_years"))
        if age is not None:
            hero_reason = (
                f"{name}은(는) 노후도와 유지보수 부담을 기준으로 "
                "현재 투자 검토 우선순위가 높습니다."
            )
        else:
            hero_reason = (
                f"{name}은(는) 운영비와 투자효과를 기준으로 "
                "먼저 확인할 설비로 정리했습니다."
            )

    today_tasks = _build_today_tasks(
        deadlines=deadlines,
        representative_equipment=priority_equipment,
        active_analysis={
            "analysis_id": active_analysis_id,
            "equipment_id": _safe_text((active_roi or {}).get("equipment_id")),
        }
        if active_roi
        else None,
        legacy_missing=legacy_missing,
        draft_exists=draft_exists,
        company=company,
    )

    empty_state: str | None = None
    if not company:
        empty_state = "company_missing"
    elif not equipments:
        empty_state = "equipment_missing"
    elif not active_roi:
        empty_state = "analysis_missing"

    return {
        "company": {
            "company_id": company.get("company_id"),
            "company_name": company.get("company_name"),
            "industry_name": company.get("industry_name"),
            "region": company.get("region"),
            "company_type": company.get("company_type"),
            "representative_equipment_id": company.get("representative_equipment_id"),
        },
        "active_analysis": {
            "analysis_id": active_analysis_id,
            "equipment_id": _safe_text((active_roi or {}).get("equipment_id")) or None,
            "equipment_name": _safe_text((priority_equipment or {}).get("name")) or None,
            "analysis_created_at": (active_roi or {}).get("created_at"),
            "status": "completed" if active_roi else "missing",
            "policy_snapshot_legacy_missing": legacy_missing,
        },
        "hero": {
            "priority_equipment_count": priority_count,
            "priority_equipment_name": _safe_text(
                (priority_equipment or {}).get("name"),
                default="대표 설비",
            ),
            "summary": "운영비 · 노후도 · 투자효과를 바탕으로 먼저 확인할 대상을 정리했어요.",
            "reason": hero_reason,
        },
        "counts": {
            "registered_equipment": len(equipments),
            "closing_soon": closing_soon,
            "matched_policies": 0 if legacy_missing else len(policies),
            "recent_analyses": recent_analysis_count,
        },
        "today_tasks": today_tasks,
        "representative_equipment": representative_equipment,
        "needs_representative_equipment": not bool(representative_equipment),
        "representative_lookup_attempted": representative_lookup_attempted,
        "priority_policy": {
            "exists": bool(priority_policy) and not legacy_missing,
            "policy_id": priority_policy_id,
            "title": _safe_text((priority_policy or {}).get("title")) or None,
            "deadline": _policy_deadline_raw(priority_policy or {}) or None,
            "d_day": deadlines[0]["d_day"] if deadlines else None,
            "tags": _build_priority_tags(
                company=company,
                equipment=priority_equipment,
                policy=priority_policy,
            ),
            "reason": _priority_reason(priority_policy, legacy_missing=legacy_missing),
            "legacy_missing": legacy_missing,
        },
        "deadlines": deadlines,
        "recent_analyses": _build_recent_analyses(roi_outputs, equipments, limit=10),
        "equipments": [
            {
                "equipment_id": item.get("equipment_id"),
                "name": item.get("name"),
                "category": item.get("category"),
                "process": item.get("process"),
                "age_years": item.get("age_years"),
                "is_representative": str(item.get("equipment_id") or "")
                == _safe_text(company.get("representative_equipment_id")),
            }
            for item in equipments
        ],
        "empty_state": empty_state,
    }
