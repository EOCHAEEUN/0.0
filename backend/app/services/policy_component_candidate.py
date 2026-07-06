from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass, field
import json
import re
from typing import Any


SUPPORT_TYPES = {
    "direct_grant",
    "voucher",
    "loan",
    "interest_support",
    "guarantee",
    "in_kind",
    "testing_certification",
    "consulting",
    "mentoring",
    "education",
    "equipment_access",
    "other",
}

CAPEX_KEYWORDS = (
    "설비",
    "장비",
    "시설",
    "자동화",
    "제조로봇",
    "로봇",
    "금형",
    "공정",
    "생산설비",
    "안전장비",
    "방호장치",
    "보호구",
    "작업환경 개선",
    "환경개선 시설",
    "인프라 구축",
    "계측기",
    "제어장치",
    "에너지관리시스템",
    "설치공사",
    "스마트공장",
    "dx retrofit",
    "제조운영 시스템",
)

NON_CAPEX_KEYWORDS = (
    "시험",
    "분석",
    "검사",
    "인증",
    "수수료",
    "출원",
    "특허",
    "상표",
    "지식재산",
    "심판",
    "소송",
    "평가",
    "실사",
    "컨설팅",
    "멘토링",
    "교육",
    "훈련",
    "마케팅",
    "홍보",
    "전시",
    "박람회",
    "브랜드",
    "디자인",
    "콘텐츠",
    "영상",
    "인건비",
    "고용",
    "근로자",
    "휴직",
    "출산",
    "육아",
    "보험",
    "관광",
    "여행",
    "인센티브",
    "r&d",
    "연구개발",
    "기술개발",
    "사업화",
    "시제품",
    "poc",
    "실증",
    "데이터 구매",
    "saas",
    "secaas",
    "sw 임차",
    "운영비",
    "프로그램 운영",
)

R_AND_D_KEYWORDS = (
    "r&d",
    "연구개발",
    "기술개발",
    "사업화",
    "시제품",
    "poc",
    "실증",
)

SERVICE_OR_OPERATING_KEYWORDS = (
    "데이터 구매",
    "saas",
    "secaas",
    "sw 임차",
    "운영비",
    "프로그램 운영",
)


@dataclass
class PolicyComponentCandidate:
    policy_id: str
    policy_title: str
    component_key: str
    component_name: str
    support_type: str
    effect_layer: str
    calculation_method: str
    proposed_roi_apply_method: str = "none"
    review_status: str = "pending"
    fixed_amount_manwon: float | None = None
    cap_amount_manwon: float | None = None
    support_ratio: float | None = None
    eligible_cost_ratio: float | None = None
    term_months: int | None = None
    interest_rate: float | None = None
    interest_subsidy_rate: float | None = None
    repayment_method: str | None = None
    evidence_text: str | None = None
    evidence_source_type: str | None = None
    evidence_source_name: str | None = None
    evidence_page_or_section: str | None = None
    source_kind: str = ""
    source_index: int = 0
    source_component_json: dict[str, Any] = field(default_factory=dict)
    quality_flags: list[str] = field(default_factory=list)
    review_reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _integer(value: Any) -> int | None:
    number = _number(value)
    return int(number) if number is not None else None


def _ratio(value: Any) -> float | None:
    number = _number(value)
    if number is None:
        return None
    if number <= 1:
        return number
    if number <= 100:
        return number / 100
    return None


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _items(value: Any) -> tuple[list[Any], bool]:
    if value in (None, ""):
        return [], False
    if isinstance(value, list):
        return value, False
    if isinstance(value, dict):
        return [value], True
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError, json.JSONDecodeError):
            return [value], True
        if isinstance(parsed, list):
            return parsed, False
        if isinstance(parsed, dict):
            return [parsed], True
    return [], True


def _support_packages(policy: dict[str, Any]) -> tuple[list[Any], bool]:
    temp = _mapping(policy.get("temp_extraction_json"))
    enrichment = _mapping(temp.get("gemini_policy_enrichment_v7"))
    return _items(enrichment.get("support_packages"))


def _classify_support_type(source: dict[str, Any]) -> str:
    explicit = _text(
        source.get("type")
        or source.get("funding_type")
        or source.get("support_type")
    ).lower()
    detail = " ".join(
        _text(source.get(key))
        for key in ("name", "subtype", "category", "type", "funding_type")
    ).lower()

    exact = {
        "현금보조": "direct_grant",
        "direct_grant": "direct_grant",
        "grant": "direct_grant",
        "바우처": "voucher",
        "voucher": "voucher",
        "융자": "loan",
        "loan": "loan",
        "이차보전": "interest_support",
        "interest_support": "interest_support",
        "보증": "guarantee",
        "guarantee": "guarantee",
        "공동장비": "equipment_access",
        "equipment_access": "equipment_access",
        "testing_certification": "testing_certification",
        "consulting": "consulting",
        "mentoring": "mentoring",
        "education": "education",
        "in_kind": "in_kind",
    }
    if any(
        word in detail
        for word in (
            "이차보전",
            "이자지원",
            "이자차액",
            "이자 차액",
            "이자보전",
            "금리지원",
        )
    ):
        return "interest_support"
    if any(word in detail for word in ("신용보증", "보증서", "보증지원")):
        return "guarantee"
    if any(word in detail for word in ("융자", "정책자금", "대출")):
        return "loan"
    if any(word in detail for word in ("멘토링", "멘토", "코칭")):
        return "mentoring"
    if any(word in detail for word in ("컨설팅", "기술지도", "자문")):
        return "consulting"
    if any(word in detail for word in ("교육", "훈련", "연수", "인력양성")):
        return "education"
    if any(word in detail for word in ("시험", "인증", "성능평가", "검사", "분석")):
        return "testing_certification"
    if any(
        word in detail
        for word in (
            "특허",
            "상표",
            "출원",
            "지식재산",
            "심판",
            "소송",
            "실사",
            "보험",
            "인건비",
            "고용",
            "근로자",
            "휴직",
            "출산",
            "육아",
            "마케팅",
            "홍보",
            "전시",
            "박람회",
            "브랜드",
            "디자인",
            "콘텐츠",
            "영상",
            "관광",
            "여행",
            "인센티브",
        )
    ):
        return "other"
    if explicit in exact:
        return exact[explicit]
    if any(word in detail for word in ("공동장비", "장비활용", "시설이용", "공간제공")):
        return "equipment_access"
    if explicit in {"현물서비스", "non_cash"} or any(
        word in detail for word in ("현물", "서비스 제공")
    ):
        return "in_kind"
    if "바우처" in detail:
        return "voucher"
    if any(word in detail for word in ("현금지원", "직접지원", "보조금", "출연금")):
        return "direct_grant"
    return "other"


def _source_context(source: dict[str, Any]) -> str:
    return " ".join(
        _text(source.get(key))
        for key in ("name", "subtype", "evidence")
    ).lower()


def _matching_keywords(context: str, keywords: tuple[str, ...]) -> list[str]:
    return [keyword for keyword in keywords if keyword in context]


def _capex_assessment(source: dict[str, Any]) -> dict[str, Any]:
    context = _source_context(source)
    positive = _matching_keywords(context, CAPEX_KEYWORDS)
    excluded = _matching_keywords(context, NON_CAPEX_KEYWORDS)
    r_and_d = _matching_keywords(context, R_AND_D_KEYWORDS)
    non_r_and_d_excluded = [
        keyword for keyword in excluded if keyword not in R_AND_D_KEYWORDS
    ]
    return {
        "positive": positive,
        "excluded": excluded,
        "r_and_d": r_and_d,
        "non_r_and_d_excluded": non_r_and_d_excluded,
        "service_or_operating": _matching_keywords(
            context, SERVICE_OR_OPERATING_KEYWORDS
        ),
        "roi_deductible": source.get("roi_deductible") is True,
        "is_capex": bool(positive)
        and not non_r_and_d_excluded
        and (not excluded or bool(r_and_d)),
    }


def _is_capex_candidate(source: dict[str, Any]) -> bool:
    return bool(_capex_assessment(source)["is_capex"])


def _policy_reference(policy: dict[str, Any]) -> dict[str, Any]:
    return {
        "selected_amount_candidate": policy.get("selected_amount_candidate"),
        "max_amount_numeric_manwon": policy.get("max_amount_numeric_manwon"),
        "support_ratio": policy.get("support_ratio"),
        "roi_apply_method": policy.get("roi_apply_method"),
    }


def _append_once(values: list[str], value: str) -> None:
    if value not in values:
        values.append(value)


def _build_candidate(
    policy: dict[str, Any],
    source: dict[str, Any],
    source_kind: str,
    source_index: int,
    unsupported_shape: bool = False,
) -> PolicyComponentCandidate:
    support_type = _classify_support_type(source)
    component_name = _text(
        source.get("name")
        or source.get("subtype")
        or source.get("category")
        or support_type
    )
    amount = _number(
        source.get("amount_numeric_manwon")
        if source_kind == "support_package"
        else source.get("amount_manwon")
    )
    ratio = _ratio(source.get("support_ratio"))
    evidence = _text(source.get("evidence")) or None
    flags: list[str] = []
    reasons: list[str] = []
    proposed_method = "none"
    cap_amount: float | None = None
    assessment = _capex_assessment(source)

    if support_type in {"direct_grant", "voucher"}:
        has_package_terms = amount is not None or ratio is not None
        capex = assessment["is_capex"] and has_package_terms
        if capex:
            cap_amount = amount
            effect_layer = "capex_offset"
            if ratio is not None and amount is not None:
                effect_layer = "capex_offset"
                calculation_method = "ratio_cap"
                proposed_method = "ratio_cap"
            elif amount is not None:
                calculation_method = "fixed_cap"
                proposed_method = "subtract"
            else:
                calculation_method = "ratio_cap"
                _append_once(flags, "missing_amount")
                _append_once(
                    reasons,
                    "지원율은 있으나 package 자체의 지원 한도가 없어 ROI 방식을 제안하지 않았습니다.",
                )
            if assessment["r_and_d"]:
                _append_once(flags, "manual_capex_review_required")
                _append_once(
                    reasons,
                    "R&D·시제품·실증·사업화 항목에 명시적 CAPEX 지출 근거가 함께 있어 수동 검토가 필요합니다.",
                )
        else:
            effect_layer = "reference_only"
            calculation_method = "qualitative"
            if not has_package_terms:
                _append_once(flags, "missing_amount")
            if assessment["positive"] and assessment["excluded"]:
                _append_once(flags, "capex_keyword_conflict")
                _append_once(
                    reasons,
                    "CAPEX 긍정 키워드와 비CAPEX 제외 키워드가 함께 있어 자동 CAPEX 후보에서 제외했습니다.",
                )
            elif assessment["r_and_d"]:
                _append_once(flags, "non_capex_expense_unknown")
                _append_once(
                    reasons,
                    "R&D·시제품·실증·사업화 비용은 설비 투자비와 직접 연결되는지 별도 확인이 필요합니다.",
                )
            else:
                _append_once(flags, "non_capex_support_scope")
                _append_once(reasons, "명시적인 설비·장비·시설·공정 CAPEX 근거가 없습니다.")
            if assessment["service_or_operating"]:
                _append_once(flags, "service_or_operating_cost")
            if assessment["roi_deductible"] and not assessment["positive"]:
                _append_once(flags, "roi_deductible_not_sufficient")
                _append_once(
                    reasons,
                    "roi_deductible=true만으로는 CAPEX 직접 차감 근거가 충분하지 않습니다.",
                )
    elif support_type == "loan":
        effect_layer = "financing_effect"
        calculation_method = "loan_terms"
        if source.get("interest_rate") is None or source.get("term_months") is None:
            _append_once(flags, "missing_rate")
            _append_once(
                reasons,
                "융자 조건 중 금리 또는 상환기간이 누락되었습니다.",
            )
    elif support_type == "interest_support":
        effect_layer = "financing_effect"
        calculation_method = "interest_rate_subsidy"
        if source.get("interest_subsidy_rate") is None:
            _append_once(flags, "missing_rate")
    elif support_type == "guarantee":
        effect_layer = "financing_effect"
        calculation_method = "guarantee_limit"
    elif support_type in {"consulting", "mentoring", "education"}:
        effect_layer = "execution_support"
        calculation_method = "qualitative"
    elif support_type in {
        "in_kind",
        "equipment_access",
        "testing_certification",
    }:
        effect_layer = "reference_only"
        calculation_method = "qualitative"
        _append_once(
            reasons,
            "현물·서비스 지원이지만 객관적 환산 근거가 없습니다.",
        )
    else:
        effect_layer = "reference_only"
        calculation_method = "qualitative"
        _append_once(flags, "ambiguous_support_type")
        _append_once(reasons, "지원 유형이 원문상 모호합니다.")

    if (
        support_type not in {"direct_grant", "voucher"}
        and assessment["positive"]
        and assessment["excluded"]
    ):
        _append_once(flags, "capex_keyword_conflict")
        _append_once(
            reasons,
            "CAPEX 긍정 키워드와 비CAPEX 제외 키워드가 함께 있어 자동 CAPEX 후보에서 제외했습니다.",
        )
    if (
        support_type not in {"direct_grant", "voucher"}
        and assessment["roi_deductible"]
    ):
        _append_once(flags, "roi_deductible_not_sufficient")

    if ratio is None and calculation_method == "ratio_cap":
        _append_once(flags, "missing_rate")
    if evidence is None:
        _append_once(flags, "missing_evidence")
    if unsupported_shape:
        _append_once(flags, "unsupported_source_shape")

    source_json = {
        "component": source,
        "policy_reference": _policy_reference(policy),
    }
    if source_kind == "policy_summary" and any(
        value not in (None, "", {}, [])
        for value in _policy_reference(policy).values()
    ):
        _append_once(flags, "policy_level_amount_only")
        _append_once(
            reasons,
            "정책 전체 대표금액만 있어 개별 지원항목 금액을 확정할 수 없습니다.",
        )

    return PolicyComponentCandidate(
        policy_id=_text(policy.get("policy_id") or policy.get("id")),
        policy_title=_text(policy.get("title")),
        component_key=f"{source_kind}_{source_index}_{support_type}",
        component_name=component_name,
        support_type=support_type,
        effect_layer=effect_layer,
        calculation_method=calculation_method,
        proposed_roi_apply_method=proposed_method,
        fixed_amount_manwon=None,
        cap_amount_manwon=cap_amount,
        support_ratio=ratio if support_type in {"direct_grant", "voucher"} else None,
        eligible_cost_ratio=_ratio(source.get("eligible_cost_ratio")),
        term_months=_integer(source.get("term_months")),
        interest_rate=_number(source.get("interest_rate")),
        interest_subsidy_rate=_number(source.get("interest_subsidy_rate")),
        repayment_method=_text(source.get("repayment_method")) or None,
        evidence_text=evidence,
        evidence_source_type=source_kind,
        evidence_source_name=_text(policy.get("organization")) or None,
        evidence_page_or_section=_text(source.get("evidence_page_or_section")) or None,
        source_kind=source_kind,
        source_index=source_index,
        source_component_json=source_json,
        quality_flags=flags,
        review_reasons=reasons,
    )


def extract_policy_component_candidates(
    policy: dict[str, Any] | Any,
) -> list[PolicyComponentCandidate]:
    if not isinstance(policy, dict):
        return []

    packages, malformed_packages = _support_packages(policy)
    candidates: list[PolicyComponentCandidate] = []
    malformed_items = False
    for index, package in enumerate(packages):
        if not isinstance(package, dict):
            continue
        candidates.append(
            _build_candidate(
                policy,
                package,
                "support_package",
                index,
                malformed_packages,
            )
        )

    if not candidates:
        support_items, malformed_items = _items(policy.get("support_items"))
        for index, item in enumerate(support_items):
            source = item if isinstance(item, dict) else {"name": _text(item)}
            candidates.append(
                _build_candidate(
                    policy,
                    source,
                    "support_item",
                    index,
                    malformed_items or not isinstance(item, dict),
                )
            )

    if not candidates:
        summary_source = {
            "name": _text(policy.get("support_primary_category"))
            or _text(policy.get("policy_primary_nature"))
            or _text(policy.get("title"))
            or "지원 내용 확인 필요",
            "category": policy.get("support_primary_category"),
            "support_type": policy.get("policy_primary_nature"),
            "subtype": ", ".join(
                _text(value)
                for value in (
                    policy.get("support_categories")
                    if isinstance(policy.get("support_categories"), list)
                    else []
                )
                if _text(value)
            ),
            "evidence": None,
        }
        candidates.append(
            _build_candidate(
                policy,
                summary_source,
                "policy_summary",
                0,
                malformed_packages or malformed_items,
            )
        )

    if len(candidates) > 1:
        for candidate in candidates:
            _append_once(candidate.quality_flags, "multiple_support_effects")
    return candidates


def extract_component_candidates(
    policies: list[dict[str, Any]] | Any,
) -> list[PolicyComponentCandidate]:
    if not isinstance(policies, list):
        return []
    candidates: list[PolicyComponentCandidate] = []
    for policy in policies:
        candidates.extend(extract_policy_component_candidates(policy))
    return candidates


def build_dry_run_report(
    policies: list[dict[str, Any]],
    candidates: list[PolicyComponentCandidate] | None = None,
) -> dict[str, Any]:
    resolved = candidates if candidates is not None else extract_component_candidates(policies)
    support_types = Counter(item.support_type for item in resolved)
    effect_layers = Counter(item.effect_layer for item in resolved)
    source_kinds = Counter(item.source_kind for item in resolved)
    review_reasons = Counter(
        reason
        for item in resolved
        for reason in item.review_reasons
    )
    candidate_counts = Counter(item.policy_id for item in resolved)
    distribution = Counter(candidate_counts.values())
    zero_candidate_count = sum(
        _text(policy.get("policy_id") or policy.get("id")) not in candidate_counts
        for policy in policies
    )
    financing_roi_violations = [
        item
        for item in resolved
        if item.effect_layer == "financing_effect"
        and item.proposed_roi_apply_method != "none"
    ]
    execution_roi_violations = [
        item
        for item in resolved
        if item.effect_layer == "execution_support"
        and item.proposed_roi_apply_method != "none"
    ]
    reference_roi_violations = [
        item
        for item in resolved
        if item.effect_layer == "reference_only"
        and item.proposed_roi_apply_method != "none"
    ]
    capex_evidence_violations = [
        item
        for item in resolved
        if item.effect_layer == "capex_offset"
        and not _is_capex_candidate(
            _mapping(item.source_component_json.get("component"))
        )
    ]
    representative_amount_suspects = [
        item
        for item in resolved
        if _is_suspected_policy_amount_copy(item)
    ]
    key_counts = Counter(
        (item.policy_id, item.component_key) for item in resolved
    )
    duplicate_key_count = sum(count - 1 for count in key_counts.values() if count > 1)
    quality_flags = Counter(
        flag
        for item in resolved
        for flag in item.quality_flags
    )
    scope_keywords = {
        "testing_certification_ip": (
            "시험",
            "분석",
            "검사",
            "인증",
            "특허",
            "상표",
            "출원",
            "지식재산",
            "심판",
            "소송",
        ),
        "consulting_education_mentoring": ("컨설팅", "멘토링", "교육", "훈련"),
        "employment_insurance_marketing": (
            "인건비",
            "고용",
            "근로자",
            "보험",
            "마케팅",
            "홍보",
            "전시",
            "박람회",
            "브랜드",
            "디자인",
            "콘텐츠",
        ),
        "research_prototype_poc": R_AND_D_KEYWORDS,
    }
    scope_roi_candidate_counts = {
        name: sum(
            item.proposed_roi_apply_method != "none"
            and any(
                keyword
                in _source_context(
                    _mapping(item.source_component_json.get("component"))
                )
                for keyword in keywords
            )
            for item in resolved
        )
        for name, keywords in scope_keywords.items()
    }

    return {
        "processed_policy_count": len(policies),
        "candidate_count": len(resolved),
        "average_candidates_per_policy": (
            round(len(resolved) / len(policies), 3) if policies else 0
        ),
        "zero_candidate_policy_count": zero_candidate_count,
        "one_candidate_policy_count": sum(
            count == 1 for count in candidate_counts.values()
        ),
        "multiple_candidate_policy_count": sum(
            count >= 2 for count in candidate_counts.values()
        ),
        "support_packages_candidate_count": source_kinds["support_package"],
        "support_items_fallback_candidate_count": source_kinds["support_item"],
        "policy_summary_fallback_candidate_count": source_kinds["policy_summary"],
        "unsupported_source_shape_candidate_count": quality_flags[
            "unsupported_source_shape"
        ],
        "support_type_counts": dict(sorted(support_types.items())),
        "effect_layer_counts": dict(sorted(effect_layers.items())),
        "capex_candidate_count": effect_layers["capex_offset"],
        "financing_candidate_count": effect_layers["financing_effect"],
        "execution_support_candidate_count": effect_layers["execution_support"],
        "reference_only_candidate_count": effect_layers["reference_only"],
        "missing_amount_candidate_count": sum(
            "missing_amount" in item.quality_flags for item in resolved
        ),
        "ambiguous_candidate_count": sum(
            "ambiguous_support_type" in item.quality_flags for item in resolved
        ),
        "proposed_roi_apply_method_counts": dict(
            sorted(Counter(item.proposed_roi_apply_method for item in resolved).items())
        ),
        "capex_missing_structured_evidence_count": len(capex_evidence_violations),
        "financing_non_none_roi_count": len(financing_roi_violations),
        "execution_non_none_roi_count": len(execution_roi_violations),
        "reference_non_none_roi_count": len(reference_roi_violations),
        "suspected_policy_amount_duplication_count": len(
            representative_amount_suspects
        ),
        "duplicate_component_key_count": duplicate_key_count,
        "quality_flag_counts": dict(sorted(quality_flags.items())),
        "review_reason_counts": dict(sorted(review_reasons.items())),
        "scope_roi_candidate_counts": scope_roi_candidate_counts,
        "candidates_per_policy_distribution": {
            str(count): policies_count
            for count, policies_count in sorted(distribution.items())
        },
        "auto_approved_count": 0,
        "all_candidates_pending": all(
            item.review_status == "pending" for item in resolved
        ),
        "safety_checks_passed": not any(
            (
                financing_roi_violations,
                execution_roi_violations,
                reference_roi_violations,
                capex_evidence_violations,
                representative_amount_suspects,
                duplicate_key_count,
            )
        ),
    }


def _is_suspected_policy_amount_copy(
    candidate: PolicyComponentCandidate,
) -> bool:
    candidate_amount = candidate.cap_amount_manwon or candidate.fixed_amount_manwon
    if candidate_amount is None:
        return False
    source = _mapping(candidate.source_component_json.get("component"))
    source_amount = _number(
        source.get("amount_numeric_manwon")
        if candidate.source_kind == "support_package"
        else source.get("amount_manwon")
    )
    reference = _mapping(candidate.source_component_json.get("policy_reference"))
    policy_amount = _number(reference.get("max_amount_numeric_manwon"))
    return (
        source_amount is None
        and policy_amount is not None
        and candidate_amount == policy_amount
    )


def _sample(candidate: PolicyComponentCandidate) -> dict[str, Any]:
    source = _mapping(candidate.source_component_json.get("component"))
    source_summary = {
        key: source.get(key)
        for key in (
            "type",
            "funding_type",
            "category",
            "name",
            "subtype",
            "amount_numeric_manwon",
            "amount_manwon",
            "support_ratio",
            "amount_role",
            "roi_deductible",
            "evidence",
        )
        if source.get(key) not in (None, "", [], {})
    }
    if isinstance(source_summary.get("evidence"), str):
        source_summary["evidence"] = source_summary["evidence"][:180]
    return {
        "policy_id": candidate.policy_id,
        "policy_title": candidate.policy_title,
        "source_kind": candidate.source_kind,
        "source_summary": source_summary,
        "component_key": candidate.component_key,
        "support_type": candidate.support_type,
        "effect_layer": candidate.effect_layer,
        "calculation_method": candidate.calculation_method,
        "proposed_roi_apply_method": candidate.proposed_roi_apply_method,
        "quality_flags": candidate.quality_flags,
        "review_reasons": candidate.review_reasons,
    }


def build_dry_run_samples(
    candidates: list[PolicyComponentCandidate],
    limit: int = 5,
) -> dict[str, Any]:
    limit = max(0, limit)
    groups = {
        "capex_offset": lambda item: item.effect_layer == "capex_offset",
        "loan": lambda item: item.support_type == "loan",
        "interest_support": lambda item: item.support_type == "interest_support",
        "guarantee": lambda item: item.support_type == "guarantee",
        "execution_support": lambda item: item.support_type
        in {"consulting", "mentoring", "education"},
        "noncash_reference": lambda item: item.support_type
        in {"testing_certification", "in_kind", "equipment_access"},
        "fallback": lambda item: item.source_kind
        in {"support_item", "policy_summary"},
        "ambiguous": lambda item: item.support_type == "other"
        or "ambiguous_support_type" in item.quality_flags,
    }
    type_samples = {
        name: [_sample(item) for item in candidates if predicate(item)][:limit]
        for name, predicate in groups.items()
    }
    flag_names = (
        "missing_amount",
        "missing_rate",
        "missing_evidence",
        "ambiguous_support_type",
        "policy_level_amount_only",
        "non_capex_expense_unknown",
        "multiple_support_effects",
        "unsupported_source_shape",
    )
    flag_samples = {
        flag: [
            _sample(item)
            for item in candidates
            if flag in item.quality_flags
        ][:3]
        for flag in flag_names
    }
    return {
        "type_samples": type_samples,
        "quality_flag_samples": flag_samples,
    }
