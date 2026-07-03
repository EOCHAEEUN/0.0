from __future__ import annotations

import re
from typing import Any


AMOUNT_TYPE_KO = {
    "subsidy": "보조금",
    "support_amount": "지원금",
    "support_ratio": "지원비율",
    "voucher": "바우처",
    "non_cash": "비현금지원",
    "loan": "융자",
    "guarantee": "보증",
    "interest_support": "이차보전",
    "total_budget": "전체예산",
    "project_budget": "사업예산",
    "total_project_cost": "총사업비",
    "total_support_scale": "총지원규모",
    "revenue_condition": "매출액 조건",
    "fee": "수수료",
    "self_funding": "자부담",
    "education_fee": "교육비",
    "equipment_usage_fee": "장비사용료",
    "consulting_fee": "컨설팅 비용",
    "unknown": "금액 성격 미확인",
}

ROI_METHOD_KO = {
    "subtract": "직접 차감",
    "ratio_cap": "비율 계산",
    "recommend_only": "연계 추천",
    "review": "검토 필요",
    "exclude": "추천 제외",
}

REPRESENTATIVE_TYPE_PRIORITY = {
    "subsidy": 10,
    "support_amount": 10,
    "support_ratio": 8,
    "voucher": 7,
    "loan": 5,
    "guarantee": 5,
    "interest_support": 5,
    "non_cash": 3,
    "consulting_fee": 2,
    "equipment_usage_fee": 2,
    "education_fee": 1,
    "fee": 0,
    "unknown": 0,
}

REPRESENTATIVE_EXCLUDED_TYPES = {
    "total_budget",
    "project_budget",
    "total_project_cost",
    "total_support_scale",
    "revenue_condition",
    "fee",
    "self_funding",
    "education_fee",
    "equipment_usage_fee",
    "consulting_fee",
    "unknown",
}

LIMIT_KEYWORDS = {
    "최대",
    "한도",
    "이내",
    "이하",
    "기업당",
    "기업별",
    "과제당",
    "업체당",
    "사업장당",
    "컨소시엄당",
    "제품당",
    "1개사",
    "개별기업",
    "개사당",
    "내외",
}

ENTITY_LIMIT_KEYWORDS = {
    "기업당",
    "기업별",
    "과제당",
    "업체당",
    "사업장당",
    "컨소시엄당",
    "제품당",
    "1개사",
    "개별기업",
    "개사당",
}

REPRESENTATIVE_EXCLUDE_KEYWORDS = {
    "총지원규모",
    "총 지원규모",
    "지원규모",
    "전체예산",
    "전체 예산",
    "총예산",
    "총 예산",
    "사업예산",
    "총사업비",
    "총 사업비",
    "과제비",
    "매출액",
    "연매출",
    "자부담",
    "민간부담",
    "민간부담금",
    "수수료",
    "표준수수료",
    "교육비",
    "컨설팅비",
    "컨설팅 비용",
    "장비사용료",
}

NON_CASH_KEYWORDS = {
    "컨설팅",
    "진단",
    "시험",
    "인증",
    "교육",
    "멘토링",
    "자문",
    "장비활용",
    "장비 활용",
    "장비사용",
    "시설이용",
    "수수료",
}

FINANCE_KEYWORDS = {
    "융자",
    "대출",
    "보증",
    "보증료",
    "이차보전",
    "이자지원",
    "이자 지원",
}

TOTAL_SCALE_KEYWORDS = {
    "총지원규모",
    "총 지원규모",
    "지원규모",
    "전체예산",
    "전체 예산",
    "총예산",
    "총 예산",
    "사업예산",
}

SUPPORT_CONTEXT_KEYWORDS = [
    "지원", "지원금", "지원액", "정부지원", "정부출연", "출연금", "보조",
    "보조금", "국비", "도비", "시비", "군비", "사업비", "총사업비",
    "총 사업비", "지원예산", "과제비", "개발비", "제작비", "소요비용",
    "비용", "한도", "최대", "이내", "이하", "정액", "바우처", "융자",
    "기업당", "기업별", "과제당", "업체당", "사업장당", "컨소시엄당", "제품당",
]


def has_any(text: str, keywords: set[str] | list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def last_keyword_index(text: str, keywords: set[str] | list[str]) -> int:
    indexes = [text.rfind(keyword) for keyword in keywords]
    return max(indexes) if indexes else -1


def clean_text(value: Any, max_len: int | None = None) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def parse_amount_number(raw_number: str, unit: str) -> float:
    raw = str(raw_number).strip()
    if re.fullmatch(r"\d{1,3}\.\d{3}", raw):
        raw = raw.replace(".", "")
    number = float(raw.replace(",", ""))
    normalized_unit = unit.replace(" ", "")
    if normalized_unit in {"억원", "억"}:
        return number * 10000
    if normalized_unit in {"천만원", "천만 원".replace(" ", "")}:
        return number * 1000
    if normalized_unit in {"백만원", "백만 원".replace(" ", "")}:
        return number * 100
    if normalized_unit in {"천원", "천 원".replace(" ", "")}:
        return number / 10
    if normalized_unit in {"만원", "만 원".replace(" ", "")}:
        return number
    if normalized_unit == "원":
        return number / 10000
    return number


def format_amount_manwon(manwon: float | int | None) -> str | None:
    if manwon is None:
        return None
    value = float(manwon)
    if value >= 10000:
        eok = value / 10000
        return f"최대 {int(eok)}억원" if eok.is_integer() else f"최대 {eok:.1f}억원"
    return f"최대 {int(value):,}만원" if value.is_integer() else f"최대 {value:,.1f}만원"


def extract_support_ratio(text: str) -> float | None:
    normalized = clean_text(text)
    if not normalized:
        return None
    if any(keyword in normalized for keyword in ["전액 지원", "무상 지원", "전액지원", "무상지원"]):
        return 1.0

    pattern = re.compile(r"(?P<ratio>\d{1,3}(?:\.\d+)?)\s*%")
    candidates: list[float] = []
    for match in pattern.finditer(normalized):
        start = max(0, match.start() - 80)
        end = min(len(normalized), match.end() + 100)
        context = normalized[start:end]
        local = normalized[max(0, match.start() - 35): min(len(normalized), match.end() + 35)]
        ratio = float(match.group("ratio"))
        if ratio <= 0 or ratio > 100:
            continue
        if not any(keyword in context for keyword in SUPPORT_CONTEXT_KEYWORDS):
            continue
        if any(keyword in local for keyword in ["자부담", "민간부담", "부담금", "매출", "수수료"]):
            continue
        candidates.append(ratio / 100)
    return max(candidates) if candidates else None


def normalize_support_ratio(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        ratio = float(value)
    except (TypeError, ValueError):
        return None
    if ratio <= 0:
        return None
    if ratio > 1:
        if ratio <= 100:
            ratio = ratio / 100
        else:
            return None
    if ratio > 1:
        return None
    return round(ratio, 4)


def classify_amount_candidate(candidate: dict[str, Any], context: str | None = None) -> dict[str, Any]:
    text = clean_text(context or candidate.get("raw_text") or candidate.get("context"), 500)
    wide_text = clean_text(candidate.get("raw_text") or candidate.get("context") or text, 500)
    combined_text = f"{text} {wide_text}"
    amount_text = clean_text(candidate.get("amount_text"))
    amount_index = text.find(amount_text) if amount_text else -1
    before_amount = text[:amount_index] if amount_index >= 0 else text
    support_limit_context = "지원" in text and has_any(text, LIMIT_KEYWORDS)
    entity_support_limit_context = support_limit_context and has_any(before_amount, ENTITY_LIMIT_KEYWORDS)
    total_scale_is_closer = (
        has_any(before_amount, TOTAL_SCALE_KEYWORDS)
        and last_keyword_index(before_amount, TOTAL_SCALE_KEYWORDS)
        > last_keyword_index(before_amount, ENTITY_LIMIT_KEYWORDS)
    )
    if has_any(combined_text, FINANCE_KEYWORDS):
        if "보증" in combined_text:
            amount_type = "guarantee"
        elif "이차보전" in combined_text or "이자지원" in combined_text or "이자 지원" in combined_text:
            amount_type = "interest_support"
        else:
            amount_type = "loan"
    elif has_any(text, NON_CASH_KEYWORDS) and not has_any(text, {"보조금", "지원금", "국비", "정부지원금", "구축비"}):
        if "교육" in text:
            amount_type = "education_fee"
        elif "장비" in text or "시설" in text:
            amount_type = "equipment_usage_fee"
        elif "수수료" in text:
            amount_type = "fee"
        elif "컨설팅" in text or "진단" in text:
            amount_type = "consulting_fee"
        else:
            amount_type = "non_cash"
    elif has_any(text, REPRESENTATIVE_EXCLUDE_KEYWORDS) and not has_any(text, LIMIT_KEYWORDS):
        if any(keyword in text for keyword in ["매출액", "연매출"]):
            amount_type = "revenue_condition"
        elif any(keyword in text for keyword in ["자부담", "민간부담", "민간부담금"]):
            amount_type = "self_funding"
        elif any(keyword in text for keyword in ["수수료", "표준수수료"]):
            amount_type = "fee"
        elif any(keyword in text for keyword in ["교육비"]):
            amount_type = "education_fee"
        elif any(keyword in text for keyword in ["장비사용료"]):
            amount_type = "equipment_usage_fee"
        elif any(keyword in text for keyword in ["컨설팅비", "컨설팅 비용"]):
            amount_type = "consulting_fee"
        elif any(keyword in text for keyword in ["전체예산", "전체 예산", "총예산", "총 예산"]):
            amount_type = "total_budget"
        elif any(keyword in text for keyword in ["사업예산"]):
            amount_type = "project_budget"
        elif any(keyword in text for keyword in ["총사업비", "총 사업비", "과제비"]):
            amount_type = "total_project_cost"
        else:
            amount_type = "total_support_scale"
    else:
        amount_type = "unknown"
    if amount_type == "unknown" and total_scale_is_closer:
        amount_type = "total_support_scale"
    if amount_type == "unknown" and entity_support_limit_context:
        amount_type = "support_amount"
    rules = [
        ("revenue_condition", ["매출액", "연매출", "매출 조건"]),
        ("self_funding", ["자부담", "민간부담금", "민간부담", "부담금"]),
        ("fee", ["수수료", "표준수수료"]),
        ("education_fee", ["교육비", "연수비"]),
        ("equipment_usage_fee", ["장비사용료", "장비 사용료", "시설이용료", "시설 이용료"]),
        ("consulting_fee", ["컨설팅 비용", "컨설팅비", "진단비"]),
        ("total_budget", ["전체예산", "총 예산", "총예산"]),
        ("total_support_scale", ["총 지원규모", "총지원규모", "지원규모"]),
        ("project_budget", ["사업예산", "지원예산"]),
        ("total_project_cost", ["총사업비", "총 사업비", "과제비"]),
        ("loan", ["융자", "대출", "자금지원"]),
        ("guarantee", ["보증"]),
        ("interest_support", ["이차보전", "이자지원", "이자 지원"]),
        ("voucher", ["바우처"]),
        ("non_cash", ["비현금", "컨설팅", "진단", "시험", "인증", "장비활용", "장비 활용"]),
        ("subsidy", ["보조금", "국비", "정부지원금", "정부출연금", "출연금"]),
        ("support_amount", ["지원금", "지원액", "지원 한도", "지원한도", "구축비", "사업비 지원", "비용 지원"]),
    ]
    if amount_type == "unknown":
        for candidate_type, keywords in rules:
            if support_limit_context and candidate_type in {
                "revenue_condition",
                "self_funding",
                "fee",
                "education_fee",
                "equipment_usage_fee",
                "consulting_fee",
                "total_support_scale",
                "project_budget",
                "total_project_cost",
            }:
                continue
            if any(keyword in text for keyword in keywords):
                amount_type = candidate_type
                break
    if amount_type == "unknown" and "지원" in text and has_any(text, LIMIT_KEYWORDS):
        amount_type = "support_amount"

    if (
        amount_type in {"support_amount", "subsidy"}
        and has_any(wide_text, REPRESENTATIVE_EXCLUDE_KEYWORDS)
        and not has_any(text, LIMIT_KEYWORDS)
    ):
        amount_type = "unknown"

    support_ratio = candidate.get("support_ratio")
    if support_ratio is None:
        support_ratio = extract_support_ratio(text)
    support_ratio = normalize_support_ratio(support_ratio)

    roi_method = "review"
    if amount_type in {"subsidy", "support_amount"}:
        roi_method = "subtract"
    elif amount_type == "voucher":
        roi_method = "subtract"
    elif amount_type == "support_ratio":
        roi_method = "ratio_cap"
    elif amount_type in {"loan", "guarantee", "interest_support"}:
        roi_method = "exclude"
    elif amount_type in {"non_cash", "consulting_fee", "education_fee", "equipment_usage_fee"}:
        roi_method = "recommend_only"

    result = dict(candidate)
    result.update(
        {
            "raw_text": clean_text(candidate.get("raw_text") or text, 400),
            "evidence": clean_text(candidate.get("evidence") or text, 400),
            "amount_manwon": candidate.get("amount_manwon"),
            "display_amount": candidate.get("display_amount"),
            "support_ratio": support_ratio,
            "max_amount_type": amount_type,
            "max_amount_type_ko": AMOUNT_TYPE_KO.get(amount_type, AMOUNT_TYPE_KO["unknown"]),
            "roi_apply_method": roi_method,
            "roi_apply_method_ko": ROI_METHOD_KO.get(roi_method, ROI_METHOD_KO["review"]),
            "is_roi_usable": roi_method in {"subtract", "ratio_cap"},
            "is_selected_amount": False,
            "reason": candidate.get("reason") or _candidate_reason(amount_type, support_ratio),
        }
    )
    return result


def _candidate_reason(amount_type: str, support_ratio: float | None) -> str:
    if amount_type == "support_ratio" or support_ratio is not None:
        return "지원비율 문구를 확인했습니다. 최대한도 확인 필요"
    if amount_type in REPRESENTATIVE_EXCLUDED_TYPES:
        return "전체 규모/비용/조건 성격의 금액으로 대표 지원금에서 제외합니다."
    if amount_type in {"subsidy", "support_amount"}:
        return "기업 기준 현금성 지원 후보입니다."
    if amount_type == "voucher":
        return "직접 비용에 사용할 수 있는 바우처 후보입니다."
    if amount_type in {"loan", "guarantee", "interest_support"}:
        return "금융성 지원 한도로 ROI 직접 차감 대상은 아닙니다."
    return "금액 성격 확인이 필요합니다."


def extract_amount_candidates(text: str) -> list[dict[str, Any]]:
    normalized = clean_text(text)
    if not normalized:
        return []

    pattern = re.compile(
        r"(?P<num>\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*"
        r"(?P<unit>억원|억 원|억|천만원|천만 원|백만원|백만 원|만원|만 원|천원|천 원|원)"
    )
    candidates: list[dict[str, Any]] = []
    seen: set[tuple[float, str]] = set()
    separators = [",", "，", "\n", ";", "。", ".", "|", " / ", "·", "•", "○", "※"]
    for match in pattern.finditer(normalized):
        start = max(0, match.start() - 90)
        end = min(len(normalized), match.end() + 120)
        local_start = max(0, match.start() - 70)
        local_end = min(len(normalized), match.end() + 80)
        context = normalized[start:end]
        local_context = normalized[local_start:local_end]
        clause_start = max(normalized.rfind(separator, 0, match.start()) for separator in separators)
        clause_end_candidates = [
            index for separator in separators if (index := normalized.find(separator, match.end())) != -1
        ]
        if clause_start >= 0:
            local_context = normalized[clause_start + 1:local_end]
        if clause_end_candidates:
            local_context = local_context[: max(0, min(clause_end_candidates) - (clause_start + 1 if clause_start >= 0 else local_start))]
        if len(local_context) < 18:
            local_context = normalized[max(0, match.start() - 45): min(len(normalized), match.end() + 45)]
        if not any(keyword in context for keyword in SUPPORT_CONTEXT_KEYWORDS):
            continue
        manwon = parse_amount_number(match.group("num"), match.group("unit"))
        if match.group("unit").replace(" ", "") == "원" and manwon < 100:
            continue
        key = (round(manwon, 2), context)
        if key in seen:
            continue
        seen.add(key)
        candidate = classify_amount_candidate(
            {
                "label": _infer_label(context),
                "raw_text": context,
                "amount_manwon": round(manwon, 2),
                "amount_text": match.group(0),
                "display_amount": format_amount_manwon(manwon),
                "evidence": context,
                "local_context": local_context,
            },
            local_context,
        )
        candidate["raw_text"] = context
        candidate["evidence"] = context
        candidate["local_context"] = local_context
        candidates.append(candidate)
    ratio = extract_support_ratio(normalized)
    if ratio is not None and not any(row.get("support_ratio") == ratio for row in candidates):
        ratio_text = f"{ratio * 100:g}%"
        candidates.append(
            classify_amount_candidate(
                {
                    "label": "지원비율",
                    "raw_text": f"{ratio_text} 지원",
                    "amount_manwon": None,
                    "display_amount": f"최대 {ratio_text} 지원",
                    "support_ratio": ratio,
                    "evidence": normalized[:400],
                },
                normalized[:500],
            )
        )
        candidates[-1]["max_amount_type"] = "support_ratio"
        candidates[-1]["max_amount_type_ko"] = AMOUNT_TYPE_KO["support_ratio"]
        candidates[-1]["roi_apply_method"] = "ratio_cap"
        candidates[-1]["roi_apply_method_ko"] = ROI_METHOD_KO["ratio_cap"]
        candidates[-1]["reason"] = "지원비율만 확인되어 최대한도 확인 필요"
    return candidates


def _infer_label(context: str) -> str:
    for label in [
        "보조금", "지원금", "정부지원금", "사업비", "총사업비", "지원규모",
        "바우처", "융자", "보증", "컨설팅 비용", "장비사용료", "교육비",
    ]:
        if label in context:
            return label
    return "금액 후보"


def select_representative_amount_candidate(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    eligible = [
        candidate
        for candidate in candidates
        if candidate.get("max_amount_type") not in REPRESENTATIVE_EXCLUDED_TYPES
        and candidate.get("amount_manwon") is not None
    ]
    if not eligible:
        return None

    def sort_key(candidate: dict[str, Any]) -> tuple[int, int, int, float]:
        amount_type = clean_text(candidate.get("max_amount_type"))
        priority = REPRESENTATIVE_TYPE_PRIORITY.get(amount_type, 0)
        local = clean_text(candidate.get("local_context") or candidate.get("raw_text"))
        has_limit_word = int(
            any(keyword in local for keyword in LIMIT_KEYWORDS)
        )
        has_exclude_word = int(
            any(keyword in local for keyword in REPRESENTATIVE_EXCLUDE_KEYWORDS)
            and not any(keyword in local for keyword in {"기업당", "과제당", "업체당", "사업장당", "1개사", "개사당"})
        )
        # Amount is intentionally the last tiebreaker only.
        amount = float(candidate.get("amount_manwon") or 0)
        return priority, has_limit_word, -has_exclude_word, amount

    selected = max(eligible, key=sort_key)
    return dict(selected)


def normalize_candidate_selection(candidates: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    selected = select_representative_amount_candidate(candidates)
    selected_key = None
    if selected:
        selected_key = (
            selected.get("amount_manwon"),
            selected.get("raw_text"),
            selected.get("max_amount_type"),
        )
        selected["is_selected_amount"] = True
    normalized = []
    for candidate in candidates:
        row = dict(candidate)
        row["is_selected_amount"] = (
            selected_key
            == (row.get("amount_manwon"), row.get("raw_text"), row.get("max_amount_type"))
        )
        normalized.append(row)
    if selected:
        selected = next((row for row in normalized if row.get("is_selected_amount")), selected)
    return normalized, selected


def derive_policy_amount_fields(
    selected_candidate: dict[str, Any] | None,
    candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    support_ratio = None
    for candidate in candidates or []:
        if candidate.get("support_ratio") is not None:
            support_ratio = normalize_support_ratio(candidate.get("support_ratio"))
            break

    if not selected_candidate:
        return {
            "amount_candidates": candidates or [],
            "selected_amount_candidate": None,
            "support_ratio": support_ratio,
            "max_amount_actual": None,
            "max_amount_status": "확인 필요",
            "max_amount_type": "unknown",
            "max_amount_numeric_manwon": None,
            "max_amount_evidence": None,
            "max_amount_note": "대표 지원금 후보 확인 필요",
        }

    amount = selected_candidate.get("amount_manwon")
    amount_type = clean_text(selected_candidate.get("max_amount_type")) or "unknown"
    return {
        "amount_candidates": candidates or [],
        "selected_amount_candidate": selected_candidate,
        "support_ratio": normalize_support_ratio(selected_candidate.get("support_ratio")) or support_ratio,
        "max_amount_actual": selected_candidate.get("display_amount") or format_amount_manwon(amount),
        "max_amount_status": "확정" if amount is not None else "비율 확인",
        "max_amount_type": amount_type,
        "max_amount_type_ko": AMOUNT_TYPE_KO.get(amount_type, AMOUNT_TYPE_KO["unknown"]),
        "max_amount_numeric_manwon": amount,
        "max_amount_evidence": selected_candidate.get("evidence") or selected_candidate.get("raw_text"),
        "max_amount_note": selected_candidate.get("reason"),
        "max_amount_type_reason": selected_candidate.get("reason"),
        "roi_apply_method": selected_candidate.get("roi_apply_method"),
        "roi_apply_method_ko": selected_candidate.get("roi_apply_method_ko"),
        "roi_apply_reason": selected_candidate.get("reason"),
    }
