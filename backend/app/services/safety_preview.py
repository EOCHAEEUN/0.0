from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from app.core.database import get_db
from app.tools.equipment_normalizer import normalize_equipment_category


VIEWPOINTS: dict[str, dict[str, Any]] = {
    "worker_risk_reduction": {
        "title": "작업자 위험 노출 감소",
        "keywords": ["방호", "비상", "인터록", "안전문", "끼임", "협착", "절단", "프레스"],
        "judgement": "개선 필요",
    },
    "operation_stability": {
        "title": "설비 운용 안정성 개선",
        "keywords": ["전기", "제어", "유압", "오일", "마모", "브레이크", "구동", "점검"],
        "judgement": "개선 필요",
    },
    "post_install_safety_management": {
        "title": "교체 후 안전관리 체계 구축",
        "keywords": ["검사", "교육", "기록", "정기", "작업시작", "관리", "보관"],
        "judgement": "설치 후 준비 예정",
    },
    "automation_safety": {
        "title": "자동화 설비 안전성 보완",
        "keywords": ["센서", "자동", "이송", "로봇", "제어", "회로"],
        "judgement": "개선 필요",
    },
    "work_environment_improvement": {
        "title": "작업환경 개선",
        "keywords": ["소음", "분진", "배기", "환기", "MSDS", "작업환경", "환경측정"],
        "judgement": "개선 필요",
    },
    "accident_prevention_system": {
        "title": "사고 예방 및 사후관리 체계 보완",
        "keywords": ["위험성평가", "관리감독", "안전관리", "사고", "개선조치"],
        "judgement": "설치 후 준비 예정",
    },
}

DEFAULT_VIEWPOINT_KEYS = [
    "worker_risk_reduction",
    "operation_stability",
    "post_install_safety_management",
]

GENERATION_SOURCE = "rule_based_policy_context_v9"

TRUE_STATUSES = {"사용 가능", "조건부 사용 가능", "available", "conditional", "true", "1", "yes", "y"}

DEFAULT_DESCRIPTIONS = {
    "worker_risk_reduction": "주요 안전장치 확인을 통해 작업자 위험 노출을 줄일 필요가 있습니다.",
    "operation_stability": "구동부와 제어계통 점검 자료로 설비 운용 안정성을 확인해야 합니다.",
    "post_install_safety_management": "설비 교체 후 점검, 교육, 기록 관리 체계를 마련해야 합니다.",
    "automation_safety": "자동화 장치와 방호장치의 연동 상태 확인이 필요합니다.",
    "work_environment_improvement": "작업환경 개선 전후 상태를 확인할 수 있는 자료가 필요합니다.",
    "accident_prevention_system": "위험요인 확인과 조치 기록으로 사고 예방 체계를 보완해야 합니다.",
}

FORBIDDEN_DESCRIPTION_FRAGMENTS = (
    "정책 검토 사유",
    "2026년도",
    "2026년",
    "사업 공고",
    "지원사업",
    "반영 권장",
)


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    if not text:
        return []
    if text.startswith("[") and text.endswith("]"):
        text = text.strip("[]")
    if "," in text:
        return [part.strip().strip("\"'") for part in text.split(",") if part.strip()]
    return [text]


def _first_text(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value is not None and not isinstance(value, (dict, list)):
            text = str(value).strip()
            if text:
                return text
    return ""


def _can_run(policy: dict[str, Any]) -> bool:
    metadata = _as_dict(policy.get("metadata"))
    value = (
        policy.get("can_run_safety_logic")
        if policy.get("can_run_safety_logic") is not None
        else metadata.get("can_run_safety_logic")
    )
    if isinstance(value, bool):
        return value
    if value is not None:
        return str(value).strip().lower() in TRUE_STATUSES

    status = _first_text(
        policy.get("safety_justification_usable"),
        metadata.get("safety_justification_usable"),
    )
    return status.strip().lower() in TRUE_STATUSES


def _lookup_existing_preview(
    analysis_id: str,
    policy_id: str,
    equipment_id: str | None,
    investment_plan_id: str | None,
) -> dict[str, Any] | None:
    db = get_db()
    query = (
        db.table("safety_viewer_policy")
        .select("*")
        .eq("analysis_id", analysis_id)
        .eq("policy_id", policy_id)
        .eq("investment_plan_id", investment_plan_id or "")
        .limit(1)
    )
    if equipment_id:
        query = query.eq("equipment_id", equipment_id)
    else:
        query = query.is_("equipment_id", "null")

    rows = getattr(query.execute(), "data", []) or []
    if rows:
        return _with_current_descriptions(rows[0])

    fallback_query = (
        db.table("safety_viewer_policy")
        .select("*")
        .eq("policy_id", policy_id)
        .eq("investment_plan_id", investment_plan_id or "")
        .order("updated_at", desc=True)
        .limit(1)
    )
    if equipment_id:
        fallback_query = fallback_query.eq("equipment_id", equipment_id)
    fallback_rows = getattr(fallback_query.execute(), "data", []) or []
    if not fallback_rows:
        fallback_rows = getattr(
            db.table("safety_viewer_policy")
            .select("*")
            .eq("policy_id", policy_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute(),
            "data",
            [],
        ) or []
    if not fallback_rows:
        return None
    return _with_current_descriptions(fallback_rows[0])


def _with_current_descriptions(row: dict[str, Any]) -> dict[str, Any]:
    if not row:
        return row

    updated = dict(row)
    items = []
    for raw_item in row.get("safety_preview_items") or []:
        if not isinstance(raw_item, dict):
            continue
        item = dict(raw_item)
        item["description"] = _short_description(
            str(item.get("viewpoint_key") or ""),
            str(item.get("description") or ""),
        )
        evidences = item.get("required_evidences") or []
        if not isinstance(evidences, list):
            evidences = []
        item["required_evidence_count"] = len(evidences)
        items.append(item)
    updated["safety_preview_items"] = items
    return updated


def get_safety_preview(
    analysis_id: str,
    policy_id: str,
    equipment_id: str | None = None,
    investment_plan_id: str | None = None,
) -> dict[str, Any] | None:
    return _lookup_existing_preview(analysis_id, policy_id, equipment_id, investment_plan_id)


def _fetch_policy(policy_id: str) -> dict[str, Any] | None:
    db = get_db()
    result = (
        db.table("policy")
        .select("*")
        .eq("policy_id", policy_id)
        .limit(1)
        .execute()
    )
    rows = getattr(result, "data", []) or []
    if not rows:
        return None

    policy = rows[0]
    metadata = dict(_as_dict(policy.get("metadata")))
    try:
        ai_result = (
            db.table("policy_ai_safety_justification")
            .select("*")
            .eq("policy_id", policy_id)
            .limit(1)
            .execute()
        )
        ai_rows = getattr(ai_result, "data", []) or []
        if ai_rows:
            policy = {**policy, **{k: v for k, v in ai_rows[0].items() if v is not None}}
            metadata.update({k: v for k, v in ai_rows[0].items() if v is not None})
            policy["metadata"] = metadata
    except Exception:
        pass

    return policy


def _fetch_equipment(equipment_id: str | None, body: dict[str, Any]) -> dict[str, Any]:
    body_equipment = _as_dict(body.get("equipment"))
    if equipment_id:
        try:
            result = get_db().table("equipment").select("*").eq("equipment_id", equipment_id).limit(1).execute()
            rows = getattr(result, "data", []) or []
            if rows:
                return rows[0]
        except Exception:
            pass

    return {
        "equipment_id": equipment_id,
        "name": _first_text(body_equipment.get("name"), body.get("equipment_name"), "?좏깮 ?ㅻ퉬"),
        "category": _first_text(body_equipment.get("category"), body.get("equipment_type"), body.get("equipment_category")),
        "process": _first_text(body_equipment.get("process")),
    }

    metadata = _as_dict(policy.get("metadata"))
    policy_title = _first_text(policy.get("title"), metadata.get("title"), "선택한 공고")
    policy_nature = _first_text(policy.get("policy_primary_nature"), metadata.get("policy_primary_nature"))
    recommendation = _first_text(
        policy.get("application_reflection_recommendation"),
        metadata.get("application_reflection_recommendation"),
    )
    reason = _first_text(policy.get("safety_justification_reason"), metadata.get("safety_justification_reason"))
    policy_prefix_parts = [policy_title]
    if policy_nature:
        policy_prefix_parts.append(policy_nature)
    if recommendation:
        policy_prefix_parts.append(recommendation)
    policy_prefix = " / ".join(policy_prefix_parts)
    if rule_titles:
        description = (
            f"{policy_prefix} 기준으로 {equipment_name} 투자안은 {', '.join(rule_titles[:2])} 항목을 "
            f"{title} 관점에서 준비해야 합니다."
        )
    else:
        description = f"{policy_prefix} 기준으로 {equipment_name} 투자안의 {title} 준비 자료를 확인해야 합니다."
    if reason:
        description = f"{description} 정책 검토 사유: {reason[:160]}"

    return {
        "equipment_id": equipment_id,
        "name": _first_text(body_equipment.get("name"), body.get("equipment_name"), "선택 설비"),
        "category": _first_text(body_equipment.get("category"), body.get("equipment_type"), body.get("equipment_category")),
        "process": _first_text(body_equipment.get("process")),
    }


def _fetch_legal_rules(equipment_type: str) -> list[dict[str, Any]]:
    normalized = normalize_equipment_category(equipment_type, equipment_type)
    try:
        rows = getattr(get_db().table("safety_rule_legal").select("*").execute(), "data", []) or []
    except Exception:
        return []

    matched = []
    for row in rows:
        category = normalize_equipment_category(
            _first_text(row.get("equipment_category")),
            _first_text(row.get("equipment_category")),
        )
        if category == normalized or category in {"common", "공통", "general"}:
            matched.append(row)

    return matched


def _recommended_viewpoint_text(policy: dict[str, Any]) -> str:
    metadata = _as_dict(policy.get("metadata"))
    values = _as_list(
        policy.get("recommended_safety_viewpoints")
        or metadata.get("recommended_safety_viewpoints")
    )
    return " ".join(values).lower()


def _policy_context_text(policy: dict[str, Any]) -> str:
    metadata = _as_dict(policy.get("metadata"))
    values = [
        policy.get("title"),
        metadata.get("title"),
        policy.get("summary"),
        metadata.get("summary"),
        policy.get("policy_primary_nature"),
        metadata.get("policy_primary_nature"),
        policy.get("application_reflection_recommendation"),
        metadata.get("application_reflection_recommendation"),
        policy.get("safety_justification_reason"),
        metadata.get("safety_justification_reason"),
        policy.get("recommended_safety_viewpoints"),
        metadata.get("recommended_safety_viewpoints"),
    ]
    return " ".join(_first_text(value) for value in values if _first_text(value)).lower()


def _policy_viewpoint_keys(policy: dict[str, Any]) -> list[str]:
    recommended_text = _recommended_viewpoint_text(policy)
    text = recommended_text or _policy_context_text(policy)
    candidates = [
        ("automation_safety", ["automation_safety", "자동화", "ai", "ax", "로봇", "센서", "제어"]),
        ("operation_stability", ["operation_stability", "설비 운용", "운용 안정", "설비 안정", "고장", "예지", "유지보수"]),
        ("work_environment_improvement", ["work_environment_improvement", "작업환경", "환경 개선", "소음", "분진", "배기"]),
        ("worker_risk_reduction", ["worker_risk_reduction", "작업자", "위험 노출", "위험 감소", "방호", "비상"]),
        ("post_install_safety_management", ["post_install_safety_management", "안전관리", "설치 후", "점검", "교육", "기록"]),
        ("accident_prevention_system", ["accident_prevention_system", "사고", "위험성평가", "예방", "사후관리"]),
    ]

    candidates = [
        ("automation_safety", ["automation_safety", "\uc790\ub3d9\ud654", "ai", "ax", "\ub85c\ubd07", "\uc13c\uc11c", "\uc81c\uc5b4"]),
        ("operation_stability", ["operation_stability", "\uc124\ube44 \uc6b4\uc6a9", "\uc6b4\uc6a9 \uc548\uc815", "\uc124\ube44 \uc774\uc6a9", "\uc774\uc6a9 \uc548\uc815", "\uc124\ube44 \uc548\uc815", "\uace0\uc7a5", "\uc608\uc9c0", "\uc720\uc9c0\ubcf4\uc218"]),
        ("work_environment_improvement", ["work_environment_improvement", "\uc791\uc5c5\ud658\uacbd", "\ud658\uacbd \uac1c\uc120", "\uc18c\uc74c", "\ubd84\uc9c4", "\ubc30\uae30"]),
        ("worker_risk_reduction", ["worker_risk_reduction", "\uc791\uc5c5\uc790", "\uc704\ud5d8 \ub178\ucd9c", "\uc704\ud5d8 \uac10\uc18c", "\ubc29\ud638", "\ube44\uc0c1"]),
        ("post_install_safety_management", ["post_install_safety_management", "\uc548\uc804\uad00\ub9ac", "\uc124\uce58 \ud6c4", "\uc810\uac80", "\uad50\uc721", "\uae30\ub85d"]),
        ("accident_prevention_system", ["accident_prevention_system", "\uc0ac\uace0", "\uc704\ud5d8\uc131\ud3c9\uac00", "\uc608\ubc29", "\uc0ac\ud6c4\uad00\ub9ac"]),
    ]

    keys = []
    chunks = [chunk.strip() for chunk in recommended_text.replace(",", "|").split("|") if chunk.strip()]
    for chunk in chunks:
        for key, needles in candidates:
            if any(needle.lower() in chunk for needle in needles):
                keys.append(key)
                break

    if not keys:
        keys = [
            key
            for key, needles in candidates
            if any(needle.lower() in text for needle in needles)
        ]
    return _dedupe(keys)


def _rule_text(rule: dict[str, Any]) -> str:
    return " ".join(
        [
            _first_text(rule.get("check_item")),
            _first_text(rule.get("inspection_type")),
            _first_text(rule.get("legal_check_group_label")),
            _first_text(rule.get("legal_check_detail")),
            _first_text(rule.get("required_compliance_action")),
            _first_text(rule.get("proof_method")),
            _first_text(rule.get("evidence_text")),
        ]
    ).lower()


def _score_viewpoints(
    policy: dict[str, Any],
    rules: list[dict[str, Any]],
    roi_context: dict[str, Any],
) -> list[tuple[str, int, list[dict[str, Any]]]]:
    recommended_text = _recommended_viewpoint_text(policy)
    policy_text = _policy_context_text(policy)
    policy_viewpoint_keys = _policy_viewpoint_keys(policy)
    roi_text = " ".join(str(value) for value in roi_context.values() if value is not None).lower()
    scored = []

    for key, definition in VIEWPOINTS.items():
        keywords = definition["keywords"]
        matched_rules = [
            rule for rule in rules
            if any(keyword.lower() in _rule_text(rule) for keyword in keywords)
        ]
        score = 0
        title = definition["title"].lower()
        if key in policy_viewpoint_keys:
            score += 30 - min(policy_viewpoint_keys.index(key), 5) * 5
        if key in recommended_text or title in recommended_text:
            score += 3
        if any(keyword.lower() in policy_text for keyword in keywords):
            score += 2
        if matched_rules:
            score += 2 + min(len(matched_rules), 2)
        if any(keyword.lower() in roi_text for keyword in keywords):
            score += 2
        if key in {"worker_risk_reduction", "operation_stability"} and not policy_viewpoint_keys:
            score += 1
        scored.append((key, score, matched_rules))

    scored.sort(key=lambda item: item[1], reverse=True)
    selected = [item for item in scored if item[1] > 0][:3]
    if len(selected) < 3:
        used = {item[0] for item in selected}
        for key in DEFAULT_VIEWPOINT_KEYS:
            if key not in used:
                selected.append((key, 0, []))
            if len(selected) >= 3:
                break
    return selected[:3]


def _evidences_from_rule(rule: dict[str, Any]) -> list[str]:
    direct_values = []
    for key in [
        "required_evidence",
        "required_evidences",
        "evidence",
        "record_type",
        "inspection_record",
        "proof_method",
    ]:
        direct_values.extend(_as_list(rule.get(key)))
    if direct_values:
        return direct_values[:3]

    text = _rule_text(rule)
    if "방호" in text:
        return ["방호장치 설치 사진", "개선 전후 사진"]
    if "비상" in text:
        return ["비상정지장치 작동 확인 사진 또는 영상"]
    if "검사" in text:
        return ["안전검사 결과서", "검사 이력"]
    if "교육" in text:
        return ["작업자 교육일지", "교육 참석자 명단"]
    if "기록" in text or "점검" in text:
        return ["작업 전 점검 기록", "정기점검 기록"]
    return ["개선 전후 사진", "점검 기록"]


def _fallback_evidences(viewpoint_key: str) -> list[str]:
    if viewpoint_key == "worker_risk_reduction":
        return ["방호장치 설치 사진", "비상정지장치 작동 확인 사진", "개선 전후 사진"]
    if viewpoint_key == "operation_stability":
        return ["설비 점검 기록", "유지보수 이력", "개선 전후 사진"]
    if viewpoint_key == "post_install_safety_management":
        return ["안전검사 결과서", "작업자 교육일지", "정기점검 기록"]
    if viewpoint_key == "automation_safety":
        return ["센서/제어장치 설치 사진", "인터록 작동 확인 자료"]
    if viewpoint_key == "work_environment_improvement":
        return ["작업환경 개선 전후 사진", "작업환경측정 결과"]
    return ["위험성평가 기록", "개선조치 결과 기록"]


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    result = []
    for item in items:
        text = str(item).strip()
        if text and text not in seen:
            seen.add(text)
            result.append(text)
    return result


def _evidence_label(evidence: Any) -> str:
    if isinstance(evidence, dict):
        return _first_text(evidence.get("label"), evidence.get("base_label"), evidence.get("evidence_type"))
    return str(evidence or "").strip()


def _evidence_type_for_label(base_label: str) -> str:
    text = base_label.lower()
    if "check" in text or "점검" in base_label or "점검표" in base_label:
        return "checklist"
    if "관리감독" in base_label or "확인" in base_label:
        return "supervisor_confirmation"
    if "조치" in base_label or "기록" in base_label:
        return "action_record"
    if "검사" in base_label or "증" in base_label:
        return "inspection_certificate"
    if "사진" in base_label or "영상" in base_label:
        return "photo_video"
    if "교육" in base_label:
        return "training_record"
    return "supporting_document"


def _evidence_context_prefix(viewpoint_key: str, viewpoint_title: str) -> str:
    title = viewpoint_title or ""
    if viewpoint_key == "automation_safety" or "자동" in title:
        return "자동화 장치"
    if viewpoint_key == "worker_risk_reduction" or "작업자" in title or "위험" in title:
        return "방호장치"
    if viewpoint_key == "operation_stability" or "운용" in title or "안정" in title:
        return "구동부·제어계통"
    if viewpoint_key == "post_install_safety_management" or "교체" in title or "관리" in title:
        return "교체 후 안전관리"
    if viewpoint_key == "work_environment_improvement" or "작업환경" in title:
        return "작업환경"
    if viewpoint_key == "accident_prevention_system" or "사고" in title:
        return "사고예방 체계"
    return title[:18].strip() or "안전개선"


def make_contextual_evidence_label(base_label: str, viewpoint_key: str, viewpoint_title: str) -> str:
    base = str(base_label or "").strip()
    if not base:
        return "준비자료 확인 필요"
    prefix = _evidence_context_prefix(viewpoint_key, viewpoint_title)
    if base.startswith(prefix):
        return base
    return f"{prefix} {base}".strip()


def build_required_evidence(
    base_label: str,
    viewpoint_key: str,
    viewpoint_title: str,
    safety_rule_id: str | None = None,
    safety_rule_title: str | None = None,
    evidence_type: str | None = None,
) -> dict[str, str]:
    base = str(base_label or "").strip()
    return {
        "label": make_contextual_evidence_label(base, viewpoint_key, viewpoint_title),
        "base_label": base,
        "context": viewpoint_title,
        "safety_rule_id": safety_rule_id or "",
        "safety_rule_title": safety_rule_title or "",
        "evidence_type": evidence_type or _evidence_type_for_label(base),
    }


def _dedupe_evidences(items: list[Any]) -> list[Any]:
    seen: set[str] = set()
    result: list[Any] = []
    for item in items:
        label = _evidence_label(item)
        if not label or label in seen:
            continue
        seen.add(label)
        result.append(item)
    return result


def _short_description(viewpoint_key: str, description: str) -> str:
    text = DEFAULT_DESCRIPTIONS.get(viewpoint_key) or description
    for fragment in FORBIDDEN_DESCRIPTION_FRAGMENTS:
        text = text.replace(fragment, "")
    text = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.!?。！？])\s+", text)
    if sentences and sentences[0].strip():
        text = sentences[0].strip()
    if len(text) > 120:
        text = text[:117].rstrip() + "..."
    return text


def _build_item(
    no: int,
    viewpoint_key: str,
    matched_rules: list[dict[str, Any]],
    equipment_name: str,
    policy: dict[str, Any],
) -> dict[str, Any]:
    definition = VIEWPOINTS[viewpoint_key]
    title = definition["title"]
    evidences: list[Any] = []
    for rule in matched_rules:
        rule_id = _first_text(rule.get("rule_id"), rule.get("id"))
        rule_title = _first_text(rule.get("check_item"), rule.get("legal_check_group_label"), rule_id)
        for base_label in _evidences_from_rule(rule):
            evidences.append(
                build_required_evidence(
                    base_label,
                    viewpoint_key,
                    title,
                    safety_rule_id=rule_id,
                    safety_rule_title=rule_title,
                )
            )
    if not evidences:
        evidences = [
            build_required_evidence(base_label, viewpoint_key, title)
            for base_label in _fallback_evidences(viewpoint_key)
        ]
    evidences = _dedupe_evidences(evidences)[:4]
    rule_titles = [
        _first_text(rule.get("check_item"), rule.get("legal_check_group_label"), rule.get("rule_id"))
        for rule in matched_rules[:4]
    ]
    rule_ids = [_first_text(rule.get("rule_id"), rule.get("id")) for rule in matched_rules[:4]]

    if rule_titles:
        description = (
            f"{equipment_name} 투자안과 관련해 {', '.join(rule_titles[:2])} 항목을 중심으로 "
            f"{title} 관점의 준비가 필요합니다."
        )
    else:
        description = f"{equipment_name} 투자안을 기준으로 {title} 관점의 준비 자료를 확인해야 합니다."

    metadata = _as_dict(policy.get("metadata"))
    policy_title = _first_text(policy.get("title"), metadata.get("title"), "선택한 공고")
    policy_nature = _first_text(policy.get("policy_primary_nature"), metadata.get("policy_primary_nature"))
    recommendation = _first_text(
        policy.get("application_reflection_recommendation"),
        metadata.get("application_reflection_recommendation"),
    )
    reason = _first_text(policy.get("safety_justification_reason"), metadata.get("safety_justification_reason"))
    policy_prefix_parts = [policy_title]
    if policy_nature:
        policy_prefix_parts.append(policy_nature)
    if recommendation:
        policy_prefix_parts.append(recommendation)
    policy_prefix = " / ".join(policy_prefix_parts)
    if rule_titles:
        description = (
            f"{policy_prefix} 기준으로 {equipment_name} 투자안은 {', '.join(rule_titles[:2])} 항목을 "
            f"{title} 관점에서 준비해야 합니다."
        )
    else:
        description = f"{policy_prefix} 기준으로 {equipment_name} 투자안의 {title} 준비 자료를 확인해야 합니다."
    if reason:
        description = f"{description} 정책 검토 사유: {reason[:160]}"

    policy_title = _first_text(policy.get("title"), metadata.get("title"), "\uc120\ud0dd\ud55c \uacf5\uace0")
    policy_prefix_parts = [policy_title]
    if policy_nature:
        policy_prefix_parts.append(policy_nature)
    if recommendation:
        policy_prefix_parts.append(recommendation)
    policy_prefix = " / ".join(policy_prefix_parts)
    if rule_titles:
        description = (
            f"{policy_prefix} \uae30\uc900\uc73c\ub85c {equipment_name} \ud22c\uc790\uc548\uc740 "
            f"{', '.join(rule_titles[:2])} \ud56d\ubaa9\uc744 {title} \uad00\uc810\uc5d0\uc11c "
            f"\uc900\ube44\ud574\uc57c \ud569\ub2c8\ub2e4."
        )
    else:
        description = (
            f"{policy_prefix} \uae30\uc900\uc73c\ub85c {equipment_name} \ud22c\uc790\uc548\uc758 "
            f"{title} \uc900\ube44 \uc790\ub8cc\ub97c \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4."
        )
    if reason:
        description = f"{description} \uc815\ucc45 \uac80\ud1a0 \uc0ac\uc720: {reason[:160]}"
    description = _short_description(viewpoint_key, description)

    return {
        "no": no,
        "viewpoint_key": viewpoint_key,
        "viewpoint_title": title,
        "current_judgement": definition["judgement"],
        "required_evidence_count": len(evidences),
        "required_evidences": evidences,
        "matched_safety_rule_ids": [item for item in rule_ids if item],
        "matched_rule_titles": [item for item in rule_titles if item],
        "description": description,
        "policy_reason": reason,
    }


def create_safety_preview(
    analysis_id: str,
    policy_id: str,
    equipment_id: str | None = None,
    investment_plan_id: str | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body = body or {}
    existing = _lookup_existing_preview(analysis_id, policy_id, equipment_id, investment_plan_id)
    if existing and existing.get("generation_source") == GENERATION_SOURCE:
        existing_analysis_id = _first_text(existing.get("analysis_id"))
        existing_policy_id = _first_text(existing.get("policy_id"))
        existing_equipment_id = _first_text(existing.get("equipment_id"))
        existing_investment_plan_id = _first_text(existing.get("investment_plan_id"))
        requested_investment_plan_id = _first_text(investment_plan_id or "")
        requested_equipment_id = _first_text(equipment_id)

        # create 경로에서는 동일 식별자(analysis/policy/equipment/investment_plan)일 때만 재사용한다.
        # policy 단독 fallback row(타 analysis 데이터)를 재사용하면 이후 summary 단계에서 404가 발생할 수 있다.
        if (
            existing_analysis_id == analysis_id
            and existing_policy_id == policy_id
            and existing_investment_plan_id == requested_investment_plan_id
            and existing_equipment_id == requested_equipment_id
        ):
            return existing

    policy = _fetch_policy(policy_id) or _as_dict(body.get("policy"))
    if not _can_run(policy):
        return {
            "analysis_id": analysis_id,
            "policy_id": policy_id,
            "equipment_id": equipment_id,
            "investment_plan_id": investment_plan_id or "",
            "can_run_safety_logic": False,
            "safety_preview_items": [],
            "required_evidences": [],
            "matched_safety_rules": [],
            "message": "이 정책은 안전개선 Preview 생성 대상이 아닙니다.",
            "status": "skipped",
        }

    equipment = _fetch_equipment(equipment_id, body)
    equipment_name = _first_text(equipment.get("name"), body.get("equipment_name"), "선택 설비")
    equipment_type = _first_text(equipment.get("category"), equipment.get("process"), body.get("equipment_type"))
    normalized_type = normalize_equipment_category(equipment_type, equipment_name)
    roi_context = _as_dict(body.get("roi_context"))
    rules = _fetch_legal_rules(normalized_type)
    selected_viewpoints = _score_viewpoints(policy, rules, roi_context)
    items = [
        _build_item(index + 1, key, matched_rules, equipment_name, policy)
        for index, (key, _score, matched_rules) in enumerate(selected_viewpoints)
    ]
    required_evidences = _dedupe_evidences([
        evidence
        for item in items
        for evidence in item.get("required_evidences", [])
    ])
    matched_safety_rules = [
        {
            "rule_id": _first_text(rule.get("rule_id"), rule.get("id")),
            "title": _first_text(rule.get("check_item"), rule.get("legal_check_group_label")),
            "proof_method": rule.get("proof_method"),
        }
        for _key, _score, matched_rules in selected_viewpoints
        for rule in matched_rules[:4]
    ]
    payload = {
        "analysis_id": analysis_id,
        "policy_id": policy_id,
        "equipment_id": equipment_id,
        "investment_plan_id": investment_plan_id or "",
        "equipment_name": equipment_name,
        "equipment_type": normalized_type,
        "can_run_safety_logic": True,
        "generated_viewpoints": {
            item["viewpoint_key"]: item["viewpoint_title"]
            for item in items
        },
        "safety_preview_items": items,
        "required_evidences": required_evidences,
        "matched_safety_rules": matched_safety_rules,
        "generation_source": GENERATION_SOURCE,
        "description_model": None,
        "status": "generated",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = (
        get_db()
        .table("safety_viewer_policy")
        .upsert(
            payload,
            on_conflict="analysis_id,policy_id,equipment_id,investment_plan_id",
        )
        .execute()
    )
    rows = getattr(result, "data", []) or []
    return rows[0] if rows else payload
