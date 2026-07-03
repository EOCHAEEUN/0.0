from __future__ import annotations

import argparse
import os
import re
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

import policy_amount_utils as amount_utils


SCRIPT_DIR = Path(__file__).resolve().parent

for env_path in [
    Path.cwd() / ".env",
    SCRIPT_DIR / ".env",
    SCRIPT_DIR.parent / ".env",
    SCRIPT_DIR.parent.parent / ".env",
    SCRIPT_DIR / "backend" / ".env",
    SCRIPT_DIR.parent / "backend" / ".env",
    SCRIPT_DIR.parent.parent / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()

DEFAULT_SOURCE_TABLE = os.getenv("POLICY_VALIDATION_TARGET_TABLE", "policy_validation_new").strip()
DEFAULT_TARGET_TABLE = os.getenv("POLICY_SYNC_TARGET_TABLE", "policy").strip()
DEFAULT_BATCH_SIZE = int(os.getenv("POLICY_SYNC_BATCH_SIZE", "100"))
GEMINI_ENRICHMENT_KEY = "gemini_policy_enrichment_v7"
EXCLUDED_COLLECTION_FIELDS = {
    "max_employee_count",
    "min_revenue",
    "max_revenue",
    "required_documents_count",
    "relevance_score",
    "is_selected",
    "selected_reason",
}
POLICY_PAYLOAD_FIELDS = {
    "policy_id", "title", "organization", "region", "url",
    "posted_at", "deadline", "deadline_display", "deadline_note",
    "policy_category", "policy_subcategory",
    "service_category", "service_subcategory", "support_method",
    "industry_codes", "hashtags",
    "amount_candidates", "selected_amount_candidate", "support_ratio",
    "max_amount", "max_amount_actual", "max_amount_note",
    "max_amount_source", "max_amount_evidence", "max_amount_basis_text",
    "max_amount_basis_evidence_text",
    "max_amount_type_reason", "max_amount_type_ko",
    "roi_support_type", "roi_support_reason", "roi_support_synced_at",
    "roi_apply_method", "roi_apply_method_ko", "roi_apply_reason",
    "amount_extraction_status",
    "max_amount_status", "max_amount_type", "max_amount_numeric_manwon",
    "required_documents", "required_documents_json", "required_documents_status",
    "employee_min", "employee_max",
    "revenue_min_manwon", "revenue_max_manwon", "revenue_rules",
    "company_age_min", "company_age_max", "eligible_company_types",
    "eligibility_text", "eligibility_evidence", "eligibility_extraction_status",
    "summary", "raw_text", "raw_json", "temp_extraction_json",
    "source_name", "source_id",
    "support_primary_category", "support_items",
    "policy_primary_nature", "safety_justification_usable",
    "safety_justification_strength", "recommended_safety_viewpoints",
    "application_reflection_recommendation", "safety_justification_reason",
    "safety_justification_synced_at",
    "created_at",
}

AMOUNT_STATUS_CONFIRMED = "\ud655\uc815"
AMOUNT_STATUS_RATIO_ONLY = "\ube44\uc728 \ud655\uc778"
AMOUNT_STATUS_NEEDS_REVIEW = "\ud655\uc778 \ud544\uc694"


def clean_text(value: Any, max_len: int | None = None) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def has_gemini_enrichment(row: dict[str, Any]) -> bool:
    return GEMINI_ENRICHMENT_KEY in as_dict(row.get("temp_extraction_json"))


def has_required_policy_fields(row: dict[str, Any]) -> bool:
    return all(
        clean_text(row.get(field))
        for field in ["policy_id", "title", "organization", "url", "summary"]
    )


def has_support_signal(row: dict[str, Any]) -> bool:
    return (
        bool(row.get("is_selected"))
        or bool(row.get("amount_candidates"))
        or bool(as_dict(row.get("selected_amount_candidate")))
        or row.get("support_ratio") is not None
        or bool(row.get("support_items"))
        or bool(clean_text(row.get("support_primary_category")))
    )


def is_eligible_policy_row(row: dict[str, Any]) -> bool:
    return has_required_policy_fields(row) and has_support_signal(row)


BASIS_NOT_FOUND_PATTERNS = (
    "명확한 지원금 한도 문구를 찾지 못함",
    "지원금 한도 문구를 찾지 못함",
    "찾지 못함",
    "확인하지 못함",
    "확인 불가",
    "미확인",
    "Gemini 원문 근거 기반",
    "LLM 원문 근거 기반",
    "API/상세 공고 페이지 금액 문구 기반 자동 추출",
    "자동 추출",
)


def normalize_amount_type_key(value: Any) -> str:
    text = clean_text(value).lower()
    if not text:
        return "unknown"
    aliases = {
        "support_amount": "support_amount",
        "지원금": "support_amount",
        "지원금형": "support_amount",
        "subsidy": "subsidy",
        "보조금": "subsidy",
        "voucher": "voucher",
        "바우처": "voucher",
        "support_ratio": "support_ratio",
        "voucher": "voucher",
        "바우처": "voucher",
        "non_cash": "non_cash",
        "비현금지원": "non_cash",
        "loan": "loan",
        "융자": "loan",
        "guarantee": "guarantee",
        "보증": "guarantee",
        "interest_support": "interest_support",
        "이차보전": "interest_support",
        "total_budget": "total_budget",
        "전체예산": "total_budget",
        "project_budget": "project_budget",
        "사업예산": "project_budget",
        "total_project_cost": "total_project_cost",
        "총사업비": "total_project_cost",
        "total_support_scale": "total_support_scale",
        "총지원규모": "total_support_scale",
        "revenue_condition": "revenue_condition",
        "매출액 조건": "revenue_condition",
        "fee": "fee",
        "수수료": "fee",
        "self_funding": "self_funding",
        "자부담": "self_funding",
        "education_fee": "education_fee",
        "교육비": "education_fee",
        "equipment_usage_fee": "equipment_usage_fee",
        "장비사용료": "equipment_usage_fee",
        "consulting_fee": "consulting_fee",
        "컨설팅 비용": "consulting_fee",
        "지원비율": "support_ratio",
        "non_cash": "non_cash",
        "비현금지원": "non_cash",
        "loan": "loan",
        "융자": "loan",
        "대출": "loan",
        "guarantee": "guarantee",
        "보증": "guarantee",
        "investment": "investment",
        "투자": "investment",
        "tax": "tax",
        "세제지원": "tax",
        "unknown": "unknown",
        "금액 미기재": "unknown",
        "금액 성격 미확인": "unknown",
    }
    return aliases.get(text, text if text in set(aliases.values()) else "unknown")


def amount_type_to_korean(value: Any, amount: Any = None) -> str:
    amount_type = normalize_amount_type_key(value)
    if amount_type in amount_utils.AMOUNT_TYPE_KO:
        return amount_utils.AMOUNT_TYPE_KO[amount_type]
    labels = {
        "support_amount": "지원금",
        "subsidy": "보조금",
        "voucher": "바우처",
        "support_ratio": "지원비율",
        "non_cash": "비현금지원",
        "loan": "융자",
        "guarantee": "보증",
        "investment": "투자",
        "tax": "세제지원",
    }
    if amount_type == "unknown":
        return "금액 성격 미확인" if numeric_or_none(amount) is not None else "금액 미기재"
    return labels.get(amount_type, "금액 성격 미확인")


def clean_basis_value(value: Any, *, max_len: int = 180) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        text = ", ".join(
            part for item in value if (part := clean_basis_value(item, max_len=max_len))
        )
    elif isinstance(value, dict):
        items = []
        for key, item in value.items():
            item_text = clean_basis_value(item, max_len=max_len)
            if item_text:
                items.append(f"{clean_text(key)}: {item_text}")
        text = ", ".join(items)
    else:
        text = clean_text(value)
    text = re.sub(r"[\u3400-\u9fff]+", " ", text)
    text = text.replace("�", " ")
    text = re.sub(r"\s+", " ", text).strip(" /,;")
    if not text:
        return ""
    if len(text) > max_len:
        text = text[:max_len].rstrip(" ,;/") + "..."
    return text


def build_max_amount_type_reason(
    row: dict[str, Any],
    *,
    amount_type: Any = None,
    amount: Any = None,
) -> str:
    normalized_type = normalize_amount_type_key(
        amount_type if amount_type is not None else row.get("max_amount_type")
    )
    numeric_amount = numeric_or_none(amount)
    if numeric_amount is None:
        numeric_amount = numeric_or_none(
            row.get("max_amount") or row.get("max_amount_numeric_manwon")
        )
    support_method = clean_basis_value(row.get("support_method"), max_len=120)

    if normalized_type == "unknown" and numeric_amount is None:
        if support_method:
            return f"기업당 직접 지급 한도는 확인되지 않았고 지원 방식은 {support_method}로 확인되어 금액 미기재로 분류했습니다."
        return "기업당 직접 지급 한도나 정액 지원금 문구가 확인되지 않아 금액 미기재로 분류했습니다."
    if normalized_type == "unknown":
        return "금액 표현은 확인되지만 기업당 직접 지원금인지, 총사업비/사업예산/자부담/융자인지 성격이 불명확해 금액 성격 미확인으로 분류했습니다."

    reasons = {
        "support_amount": "기업당 지원 한도 또는 직접 비용 차감 가능한 지원금으로 확인되어 지원금으로 분류했습니다.",
        "subsidy": "기업 비용을 직접 보전하는 국비/보조금 성격으로 확인되어 보조금으로 분류했습니다.",
        "voucher": "현금 지급이 아니라 정해진 한도의 이용권 또는 바우처 성격으로 확인되어 바우처로 분류했습니다.",
        "support_ratio": "정액 한도보다 지원 비율이 핵심 조건으로 확인되어 지원비율로 분류했습니다.",
        "non_cash": "장비 이용, 시험분석, 컨설팅, 교육 등 현금 차감이 아닌 지원으로 확인되어 비현금지원으로 분류했습니다.",
        "loan": "상환 의무가 있는 융자/대출 성격으로 확인되어 융자로 분류했습니다.",
        "guarantee": "보증 또는 보증 연계 금융지원 성격으로 확인되어 보증으로 분류했습니다.",
        "investment": "보조금이 아닌 투자/출자 성격으로 확인되어 투자로 분류했습니다.",
        "tax": "현금 지원이 아닌 세액공제/감면 등 세제 성격으로 확인되어 세제지원으로 분류했습니다.",
    }
    return reasons.get(normalized_type, "금액 성격은 자동 분류됐지만 원문 근거 확인이 필요합니다.")


def contains_excluded_support_method(value: Any) -> bool:
    text = clean_text(value).lower()
    return any(
        keyword in text
        for keyword in [
            "융자",
            "대출",
            "보증",
            "이차보전",
            "loan",
            "guarantee",
            "investment",
            "투자",
        ]
    )


def classify_roi_support(
    *,
    max_amount: Any,
    max_amount_type: Any,
    support_method: Any = None,
    is_non_cash: bool = False,
) -> tuple[str, str]:
    amount_type = normalize_amount_type_key(max_amount_type)
    amount = numeric_or_none(max_amount)
    if amount_type in {"loan", "guarantee", "investment", "tax"}:
        return "계산 제외", "융자/보증/투자/세제지원은 직접 보조금이 아니므로 ROI 계산에서 제외합니다."
    if is_non_cash or amount_type == "non_cash" or contains_excluded_support_method(support_method):
        return "연계 추천", "현금 지원금은 아니지만 함께 신청할 수 있는 비현금 지원 성격으로 분류했습니다."
    if amount is not None and amount_type in {"support_amount", "subsidy", "voucher"}:
        return "ROI 직접 반영", "금액이 있고 직접 비용 차감 가능한 지원으로 판단되어 ROI 계산에 반영합니다."
    if amount is not None and amount_type == "support_ratio":
        return "검토 필요", "지원비율은 확인되지만 기업별 정액 차감액 산정이 필요해 검토 필요로 분류했습니다."
    if amount_type == "unknown" and amount is None:
        return "연계 추천", "금액은 미기재이나 지원 내용이 유효할 수 있어 ROI 계산이 아닌 연계 추천 후보로 분류했습니다."
    return "검토 필요", "금액 또는 지원 성격이 불명확해 자동 계산 전 검토가 필요합니다."


ROI_APPLY_METHOD_LABELS = {
    "subtract": "직접 차감",
    "ratio_cap": "비율 계산",
    "recommend_only": "연계 추천",
    "review": "검토 필요",
    "exclude": "추천 제외",
}


def normalize_roi_support_type(value: Any) -> str:
    text = clean_text(value)
    if text in {"ROI 직접 반영", "연계 추천", "검토 필요", "계산 제외"}:
        return text
    return ""


def roi_apply_method_to_korean(value: Any) -> str:
    return ROI_APPLY_METHOD_LABELS.get(clean_text(value), "검토 필요")


def classify_roi_apply_method(
    *,
    max_amount: Any,
    max_amount_type: Any,
    roi_support_type: Any = None,
    support_method: Any = None,
    is_non_cash: bool = False,
) -> tuple[str, str, str]:
    amount_type = normalize_amount_type_key(max_amount_type)
    amount = numeric_or_none(max_amount)
    roi_type = normalize_roi_support_type(roi_support_type)

    if amount_type in {"loan", "guarantee", "investment", "tax"}:
        method = "exclude"
        return (
            method,
            roi_apply_method_to_korean(method),
            "융자/대출/보증/투자/세제지원은 현금성 보조금이 아니므로 ROI 계산과 추천 후보에서 제외합니다.",
        )

    if contains_excluded_support_method(support_method):
        method = "exclude"
        return (
            method,
            roi_apply_method_to_korean(method),
            "지원 방식에 융자/대출/보증/이차보전 성격이 포함되어 직접 투자비 차감에서 제외합니다.",
        )

    if amount_type == "support_ratio":
        method = "ratio_cap"
        return (
            method,
            roi_apply_method_to_korean(method),
            "지원비율 성격의 공고이므로 투자액과 지원비율, 최대한도를 함께 보아 차감액을 산정해야 합니다.",
        )

    if amount is not None and amount_type in {"support_amount", "subsidy", "voucher"}:
        method = "subtract"
        return (
            method,
            roi_apply_method_to_korean(method),
            "현금성 지원금/보조금/바우처 한도로 판단되어 ROI 계산 시 투자비에서 직접 차감할 수 있습니다.",
        )

    if is_non_cash or amount_type == "non_cash":
        method = "recommend_only"
        return (
            method,
            roi_apply_method_to_korean(method),
            "비현금 지원은 비용을 직접 차감하지 않고 함께 신청하면 좋은 연계 공고로만 사용합니다.",
        )

    if roi_type == "연계 추천":
        method = "recommend_only"
        return (
            method,
            roi_apply_method_to_korean(method),
            "ROI 직접 차감 근거는 부족하지만 지원 내용이 있어 연계 추천 공고로 사용합니다.",
        )

    if roi_type == "계산 제외":
        method = "exclude"
        return (
            method,
            roi_apply_method_to_korean(method),
            "FactoFit ROI/추천 목적과 맞지 않거나 금융성 지원으로 분류되어 추천 후보에서 제외합니다.",
        )

    method = "review"
    return (
        method,
        roi_apply_method_to_korean(method),
        "금액이 전체예산/총사업비/자격기준 금액인지 기업 직접 지원금인지 불명확해 ROI에 직접 반영하지 않습니다.",
    )


def is_generic_basis_text(text: str) -> bool:
    return any(pattern in text for pattern in BASIS_NOT_FOUND_PATTERNS)


def append_unique_basis_part(parts: list[str], label: str, value: str) -> None:
    normalized_value = re.sub(r"\s+", " ", value).strip(" /,;")
    if not normalized_value:
        return
    for part in parts:
        if normalized_value in part or part.endswith(normalized_value):
            return
    parts.append(f"{label}: {normalized_value}")


def build_max_amount_basis_text(row: dict[str, Any]) -> str | None:
    amount = numeric_or_none(row.get("max_amount") or row.get("max_amount_numeric_manwon"))
    amount_type = normalize_amount_type_key(row.get("max_amount_type"))
    amount_label = amount_type_to_korean(amount_type, amount)
    actual = clean_basis_value(row.get("max_amount_actual"), max_len=120)
    note = clean_basis_value(row.get("max_amount_note"), max_len=160)
    support_method = clean_basis_value(row.get("support_method"), max_len=120)
    parts: list[str] = []
    if amount is not None and amount_type not in {
        "unknown",
        "non_cash",
        "loan",
        "guarantee",
        "investment",
        "tax",
    }:
        append_unique_basis_part(parts, "금액 판단", f"{amount_label} {amount:,}만원")
    else:
        append_unique_basis_part(parts, "금액 판단", amount_label)

    append_unique_basis_part(parts, "금액 표현", actual)
    append_unique_basis_part(parts, "지원 방식", support_method)
    if note and not is_generic_basis_text(note):
        append_unique_basis_part(parts, "주의 사항", note)

    return " / ".join(parts) if parts else None


def build_max_amount_basis_evidence_text(row: dict[str, Any]) -> str | None:
    evidence = clean_basis_value(row.get("max_amount_evidence"), max_len=300)
    if not evidence or is_generic_basis_text(evidence):
        return None
    return evidence


def clean_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    text = str(value).strip()
    return [text] if text else []


def filter_policy_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in payload.items()
        if (
            value is not None
            and key in POLICY_PAYLOAD_FIELDS
            and key not in EXCLUDED_COLLECTION_FIELDS
        )
    }


def numeric_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def date_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError:
        return None


def normalize_amount_status(status: Any, amount: Any) -> str | None:
    text = clean_text(status)
    if text in {AMOUNT_STATUS_CONFIRMED, "extracted"}:
        return "extracted"
    if text in {AMOUNT_STATUS_RATIO_ONLY, "ratio_only"}:
        return "no_cash_amount"
    if text in {AMOUNT_STATUS_NEEDS_REVIEW, "not_found"}:
        return "needs_review"
    if text:
        return text
    return "extracted" if amount is not None else "pending"


def build_policy_url(row: dict[str, Any]) -> str:
    url = clean_text(row.get("url"))
    if url:
        return url

    source_api_json = row.get("source_api_json")
    if isinstance(source_api_json, dict):
        api_url = clean_text(source_api_json.get("pblancUrl"))
        if api_url:
            return api_url

    policy_id = clean_text(row.get("policy_id"))
    if policy_id:
        return f"https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId={policy_id}"

    return "https://www.bizinfo.go.kr"


def build_deadline_note(row: dict[str, Any]) -> str | None:
    parts = []
    display = clean_text(row.get("deadline_display"))
    deadline_type = clean_text(row.get("deadline_type"))
    deadline_status = clean_text(row.get("deadline_status"))

    if display:
        parts.append(display)
    if deadline_type:
        parts.append(f"type={deadline_type}")
    if deadline_status:
        parts.append(f"status={deadline_status}")
    if row.get("is_early_close_possible") is True:
        parts.append("예산 소진 시 조기마감 가능")

    return " / ".join(parts) if parts else None


def build_policy_payload(
    row: dict[str, Any],
    source_table: str = DEFAULT_SOURCE_TABLE,
) -> dict[str, Any] | None:
    policy_id = clean_text(row.get("policy_id"))
    title = clean_text(row.get("title"))
    organization = clean_text(row.get("organization")) or "기관 미상"
    if not policy_id or not title:
        return None

    amount_candidates = row.get("amount_candidates")
    if not isinstance(amount_candidates, list):
        amount_candidates = []
    selected_amount_candidate = row.get("selected_amount_candidate")
    if not isinstance(selected_amount_candidate, dict):
        selected_amount_candidate = None
    if selected_amount_candidate:
        derived = amount_utils.derive_policy_amount_fields(
            selected_amount_candidate,
            amount_candidates,
        )
        row = {**row, **{key: value for key, value in derived.items() if value is not None}}

    max_amount_type = normalize_amount_type_key(row.get("max_amount_type"))
    temp_extraction = row.get("temp_extraction_json")
    roi_direct = (
        temp_extraction.get("ROI직접차감가능")
        if isinstance(temp_extraction, dict)
        else None
    )
    is_non_cash = (
        max_amount_type
        in {
            "loan",
            "non_cash",
            "융자",
            "이차보전",
            "보증",
            "현물서비스",
            "공동장비",
        }
        or roi_direct is False
    )
    selected_type = (
        normalize_amount_type_key(selected_amount_candidate.get("max_amount_type"))
        if selected_amount_candidate
        else max_amount_type
    )
    excluded_representative = selected_type in amount_utils.REPRESENTATIVE_EXCLUDED_TYPES
    max_amount = (
        None
        if is_non_cash or excluded_representative
        else numeric_or_none(row.get("max_amount_numeric_manwon"))
    )
    roi_support_type, roi_support_reason = classify_roi_support(
        max_amount=max_amount,
        max_amount_type=max_amount_type,
        support_method=row.get("support_method"),
        is_non_cash=is_non_cash,
    )
    roi_apply_method, roi_apply_method_ko, roi_apply_reason = classify_roi_apply_method(
        max_amount=max_amount,
        max_amount_type=max_amount_type,
        roi_support_type=roi_support_type,
        support_method=row.get("support_method"),
        is_non_cash=is_non_cash,
    )

    payload: dict[str, Any] = {
        "policy_id": policy_id,
        "title": title,
        "organization": organization,
        "policy_category": row.get("policy_category"),
        "policy_subcategory": row.get("policy_subcategory"),
        "service_category": row.get("service_category"),
        "service_subcategory": row.get("service_subcategory"),
        "amount_candidates": amount_candidates,
        "selected_amount_candidate": selected_amount_candidate,
        "support_ratio": amount_utils.normalize_support_ratio(row.get("support_ratio")),
        "max_amount": max_amount,
        "max_amount_actual": (
            None if is_non_cash else row.get("max_amount_actual")
        ),
        "max_amount_note": row.get("max_amount_note"),
        "max_amount_source": source_table,
        "max_amount_evidence": row.get("max_amount_evidence"),
        "max_amount_basis_text": build_max_amount_basis_text(row),
        "max_amount_basis_evidence_text": build_max_amount_basis_evidence_text(row),
        "max_amount_type": max_amount_type,
        "max_amount_type_ko": amount_type_to_korean(max_amount_type, max_amount),
        "max_amount_type_reason": build_max_amount_type_reason(
            row,
            amount_type=max_amount_type,
            amount=max_amount,
        ),
        "roi_support_type": roi_support_type,
        "roi_support_reason": roi_support_reason,
        "roi_apply_method": roi_apply_method,
        "roi_apply_method_ko": roi_apply_method_ko,
        "roi_apply_reason": roi_apply_reason,
        "amount_extraction_status": normalize_amount_status(row.get("max_amount_status"), max_amount),
        "posted_at": date_or_none(row.get("posted_at")),
        "deadline": date_or_none(row.get("deadline")),
        "deadline_display": row.get("deadline_display"),
        "deadline_note": build_deadline_note(row),
        "required_documents": row.get("required_documents"),
        "required_documents_json": row.get("required_documents_json"),
        "required_documents_status": row.get("required_documents_status"),
        "industry_codes": clean_list(row.get("industry_codes")),
        "region": row.get("region"),
        "employee_min": numeric_or_none(row.get("employee_min")),
        "employee_max": numeric_or_none(row.get("employee_max")),
        "revenue_min_manwon": numeric_or_none(row.get("revenue_min_manwon")),
        "revenue_max_manwon": numeric_or_none(row.get("revenue_max_manwon")),
        "revenue_rules": row.get("revenue_rules"),
        "company_age_min": numeric_or_none(row.get("company_age_min")),
        "company_age_max": numeric_or_none(row.get("company_age_max")),
        "eligible_company_types": clean_list(row.get("eligible_company_types")),
        "eligibility_text": row.get("eligibility_text"),
        "eligibility_extraction_status": row.get("eligibility_extraction_status"),
        "eligibility_evidence": row.get("eligibility_evidence"),
        "url": build_policy_url(row),
        "summary": row.get("summary"),
        "support_primary_category": row.get("support_primary_category"),
        "support_items": (
            row.get("support_items")
            if isinstance(row.get("support_items"), list)
            else []
        ),
        "policy_primary_nature": row.get("policy_primary_nature"),
        "safety_justification_usable": row.get("safety_justification_usable"),
        "safety_justification_strength": row.get("safety_justification_strength"),
        "recommended_safety_viewpoints": row.get("recommended_safety_viewpoints"),
        "application_reflection_recommendation": row.get("application_reflection_recommendation"),
        "safety_justification_reason": row.get("safety_justification_reason"),
        "safety_justification_synced_at": row.get("safety_justification_synced_at"),
        "source_name": row.get("source_name") or "bizinfo",
        "source_id": row.get("source_id") or policy_id,
        "raw_json": row.get("source_api_json"),
        "temp_extraction_json": (
            row.get("temp_extraction_json")
            if isinstance(row.get("temp_extraction_json"), dict)
            else {}
        ),
        "raw_text": row.get("raw_text"),
        "hashtags": clean_list(row.get("hashtags")),
    }

    if "support_method" in row:
        payload["support_method"] = row.get("support_method")

    return filter_policy_payload(payload)


def fetch_rows(
    supabase: Client,
    source_table: str,
    *,
    batch_size: int,
    selected_only: bool,
    limit: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0

    while True:
        remaining = limit - len(rows) if limit > 0 else batch_size
        if limit > 0 and remaining <= 0:
            break

        page_size = min(batch_size, remaining) if limit > 0 else batch_size
        end = start + page_size - 1
        query = supabase.table(source_table).select("*").order("policy_id").range(start, end)
        if selected_only:
            query = query.eq("is_selected", True)

        response = query.execute()
        batch = response.data or []
        rows.extend(batch)

        if len(batch) < page_size:
            break
        start += page_size

    return rows


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Promote rows from policy_validation_new or "
            "policy_external_collected directly into the service policy table."
        )
    )
    parser.add_argument("--source-table", default=DEFAULT_SOURCE_TABLE)
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--limit", type=int, default=0, help="0 means all rows")
    parser.add_argument("--selected-only", action="store_true", help="Sync only rows where is_selected=true")
    parser.add_argument(
        "--require-gemini",
        action="store_true",
        help=f"Promote only rows containing temp_extraction_json.{GEMINI_ENRICHMENT_KEY}",
    )
    parser.add_argument(
        "--eligible-policy-only",
        action="store_true",
        help=(
            "Promote rows with required core fields and at least one support "
            "signal, instead of requiring is_selected=true."
        ),
    )
    parser.add_argument("--execute", action="store_true", help="Actually upsert into policy. Default is dry-run.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    if args.target_table != "policy":
        raise ValueError(f"target table must be policy, got {args.target_table}")
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    print(f"Source table: {args.source_table}")
    print(f"Target table: {args.target_table}")
    print(f"Mode: {'EXECUTE' if args.execute else 'DRY-RUN'}")
    print(f"Selected only: {args.selected_only}")
    print(f"Require Gemini: {args.require_gemini}")
    print(f"Eligible policy only: {args.eligible_policy_only}")
    print(f"Limit: {args.limit} (0 means all)")

    rows = fetch_rows(
        supabase,
        args.source_table,
        batch_size=args.batch_size,
        selected_only=args.selected_only,
        limit=args.limit,
    )
    fetched_count = len(rows)
    if args.require_gemini:
        rows = [row for row in rows if has_gemini_enrichment(row)]
    after_gemini_count = len(rows)
    if args.eligible_policy_only:
        rows = [row for row in rows if is_eligible_policy_row(row)]
    payloads = [
        payload
        for row in rows
        if (
            payload := build_policy_payload(
                row,
                source_table=args.source_table,
            )
        )
    ]

    print(f"Fetched rows: {fetched_count}")
    if args.require_gemini:
        print(f"Gemini-enriched rows: {len(rows)}")
        print(f"Skipped without Gemini: {fetched_count - after_gemini_count}")
    if args.eligible_policy_only:
        print(f"Eligible policy rows: {len(rows)}")
        print(f"Skipped by eligibility: {after_gemini_count - len(rows)}")
    print(f"Mapped payloads: {len(payloads)}")

    for payload in payloads[:5]:
        print(
            "  preview | "
            f"{payload.get('policy_id')} | "
            f"amount={payload.get('max_amount')} | "
            f"status={payload.get('amount_extraction_status')} | "
            f"deadline={payload.get('deadline') or '-'}"
        )

    if not args.execute:
        print("Dry-run complete. Add --execute to upsert into policy.")
        return

    upserted = 0
    for start in range(0, len(payloads), args.batch_size):
        batch = payloads[start:start + args.batch_size]
        if not batch:
            continue
        supabase.table(args.target_table).upsert(batch, on_conflict="policy_id").execute()
        upserted += len(batch)
        print(f"  upserted {upserted}/{len(payloads)}")

    print(f"Done. Upserted: {upserted}")


if __name__ == "__main__":
    main()
