from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.services.dashboard_overview import (
    _d_day_label,
    _is_empty_policy_snapshot,
    _parse_deadline,
    _policy_deadline_raw,
    _safe_number,
    _safe_text,
    _snapshot_policy_rows,
    _verify_company,
)

logger = logging.getLogger(__name__)
SEOUL = ZoneInfo("Asia/Seoul")
CANDIDATE_LIMIT = 5
CLOSING_SOON_DAYS = 30
PRIORITY_DISPLAY_LIMIT = 5
LIVE_DISCOVERY_DISPLAY_LIMIT = 6
CLOSING_URGENT_DAYS = 7

# 지원사업 카드/요약에 실제로 쓰이는 policy 컬럼만 선택한다.
# raw_text/attachment_text/raw_json/temp_extraction_json/amount_candidates/
# selected_amount_candidate 같은 대용량 원문·중간산출물 컬럼(정책 261건 기준
# select("*") 시 약 34MB, 이 6개 컬럼만으로 약 14MB)은 이 화면에서 쓰이지 않아
# 제외한다. summary/eligibility_evidence/max_amount_basis_* 등 짧은 근거 텍스트는
# 카드의 fallback 문구(_build_funding_detail_lines, _resolve_deadline_date 등)에
# 실제로 쓰이므로 유지한다.
POLICY_OVERVIEW_SELECT_FIELDS = (
    "policy_id,title,organization,deadline,deadline_display,deadline_note,summary,url,"
    "max_amount,max_amount_actual,max_amount_numeric_manwon,max_amount_type,"
    "max_amount_type_ko,max_amount_basis_text,max_amount_basis_evidence_text,"
    "max_amount_note,support_method,support_items,support_primary_category,"
    "support_categories,support_ratio,policy_primary_nature,policy_category,"
    "policy_subcategory,roi_support_type,roi_support_reason,"
    "required_documents_count,required_documents_json,eligibility_text,"
    "eligibility_extraction_status,eligibility_evidence,eligible_company_types,"
    "industry_codes,region,company_age_min,company_age_max,employee_min,"
    "employee_max,revenue_min_manwon,revenue_max_manwon,posted_at,created_at,"
    "is_selected"
)
NON_CASH_KEYWORDS = (
    "컨설팅",
    "멘토링",
    "교육",
    "시험분석",
    "인증",
    "장비활용",
    "기술지도",
)
FINANCIAL_NATURES = ("자금지원", "융자", "보증")
FINANCIAL_AMOUNT_TYPES = ("loan", "guarantee", "interest_support")
DIRECT_AMOUNT_TYPES = ("subsidy", "support_amount", "voucher")
DISTRICT_PATTERN = re.compile(r"([\uac00-\ud7a3]{1,12}(?:시|군|구))")
NATIONWIDE_TERMS = ("\uc804\uad6d",)

# 지원사업 유형별 분석(SupportTypeGuideSection) 카드 집계용 분류.
# support_type_label(위 _resolve_support_type)과 별개로, 구조화 필드 우선순위 기반으로
# 정책 하나가 여러 유형(직접/금융/비금융)에 동시에 걸쳐 있을 수 있음을 반영한다.
SUPPORT_COMPONENT_DIRECT = "direct_grant"
SUPPORT_COMPONENT_FINANCE = "financial_support"
SUPPORT_COMPONENT_LINKED = "non_financial_linked"

DIRECT_GRANT_KEYWORDS = (
    "현금보조",
    "현금지원",
    "사업비 지원",
    "보조금",
    "투자비 직접 보전",
    "시설투자비",
    "설비투자비",
    "장비투자비",
)
FINANCE_SUPPORT_KEYWORDS = (
    "융자",
    "보증",
    "이자지원",
    "이자 지원",
    "대출",
    "정책자금",
)
NON_FINANCIAL_LINKED_KEYWORDS = (
    "현물서비스",
    "컨설팅",
    "멘토링",
    "교육",
    "시험",
    "인증",
    "장비활용",
    "공동장비",
    "기술지원",
    "기술지도",
    "판로",
    "전시",
    "수출",
    "디지털 인프라",
)


def _seoul_today() -> date:
    return datetime.now(SEOUL).date()


def _normalize_policy_id(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _normalize_match_score(value: Any) -> int | None:
    number = _safe_number(value)
    if number is None:
        return None
    if number <= 1:
        number *= 100
    return int(max(0, min(100, round(number))))


def _company_age_years(company: dict[str, Any]) -> int | None:
    established = _safe_number(company.get("established_year"))
    if established is None:
        return None
    return max(0, _seoul_today().year - int(established))


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def _policy_support_text(policy: dict[str, Any]) -> str:
    return " ".join(
        str(policy.get(key) or "")
        for key in (
            "support_method",
            "support_items",
            "summary",
            "max_amount_type_ko",
            "roi_support_reason",
        )
    )


def _resolve_support_type(policy: dict[str, Any]) -> dict[str, str]:
    nature = _safe_text(policy.get("policy_primary_nature"))
    category = _safe_text(policy.get("support_primary_category"))
    amount_type = _safe_text(policy.get("max_amount_type")).lower()
    roi_support_type = _safe_text(policy.get("roi_support_type"))
    support_text = _policy_support_text(policy)

    if (
        any(token in nature for token in FINANCIAL_NATURES)
        or category == "금융지원"
        or amount_type in FINANCIAL_AMOUNT_TYPES
    ):
        return {
            "support_type_label": "금융지원",
            "support_type_detail": "융자·보증·이자지원 조건 확인",
        }

    if amount_type == "non_cash" or (
        "연계 추천" in roi_support_type and _contains_any(support_text, NON_CASH_KEYWORDS)
    ):
        return {
            "support_type_label": "비금융 연계지원",
            "support_type_detail": "컨설팅·시험분석·인증 등 연계 가능",
        }

    if amount_type == "voucher":
        return {
            "support_type_label": "바우처 지원",
            "support_type_detail": "바우처 지원 조건 확인",
        }

    if (
        "ROI 직접 반영" in roi_support_type
        or amount_type in DIRECT_AMOUNT_TYPES
    ):
        return {
            "support_type_label": "직접 지원금",
            "support_type_detail": "지원 한도와 세부 조건은 공고문에서 확인",
        }

    if amount_type == "support_ratio":
        return {
            "support_type_label": "지원비율형 지원",
            "support_type_detail": "지원 비율과 한도는 공고문에서 확인",
        }

    return {
        "support_type_label": "지원 조건 확인 필요",
        "support_type_detail": "지원 형태와 한도는 공고문에서 확인",
    }


def _classify_support_text(text: str) -> str | None:
    if not text:
        return None
    if _contains_any(text, FINANCE_SUPPORT_KEYWORDS):
        return SUPPORT_COMPONENT_FINANCE
    if _contains_any(text, NON_FINANCIAL_LINKED_KEYWORDS):
        return SUPPORT_COMPONENT_LINKED
    if _contains_any(text, DIRECT_GRANT_KEYWORDS):
        return SUPPORT_COMPONENT_DIRECT
    return None


def _classify_support_item(item: Any) -> str | None:
    if not isinstance(item, dict):
        return _classify_support_text(_safe_text(item))
    return (
        _classify_support_text(_safe_text(item.get("funding_type")))
        or _classify_support_text(_safe_text(item.get("category")))
        or _classify_support_text(_safe_text(item.get("name")))
    )


def _map_legacy_label_to_component(label: str) -> str | None:
    if label == "금융지원":
        return SUPPORT_COMPONENT_FINANCE
    if label == "비금융 연계지원":
        return SUPPORT_COMPONENT_LINKED
    if label in ("직접 지원금", "바우처 지원", "지원비율형 지원"):
        return SUPPORT_COMPONENT_DIRECT
    return None


def _classify_tag_list(value: Any) -> set[str]:
    tags = value if isinstance(value, list) else [value]
    return {
        classified
        for classified in (_classify_support_text(_safe_text(tag)) for tag in tags)
        if classified
    }


def _classify_policy_fallback(policy: dict[str, Any], legacy_label: str) -> list[str]:
    types: set[str] = set()
    types |= _classify_tag_list(policy.get("support_method"))

    roi_classified = _classify_support_text(_safe_text(policy.get("roi_support_type")))
    if roi_classified:
        types.add(roi_classified)

    category = _safe_text(policy.get("support_primary_category"))
    if category == "금융지원":
        types.add(SUPPORT_COMPONENT_FINANCE)
    elif category in ("지원금", "바우처", "바우처 지원"):
        types.add(SUPPORT_COMPONENT_DIRECT)
    else:
        category_classified = _classify_support_text(category)
        if category_classified:
            types.add(category_classified)

    types |= _classify_tag_list(policy.get("support_categories"))

    nature = _safe_text(policy.get("policy_primary_nature"))
    if any(token in nature for token in FINANCIAL_NATURES):
        types.add(SUPPORT_COMPONENT_FINANCE)

    if types:
        return sorted(types)

    legacy = _map_legacy_label_to_component(legacy_label)
    return [legacy] if legacy else []


def _resolve_support_component_types(policy: dict[str, Any], legacy_label: str) -> list[str]:
    items = _coerce_support_items(policy.get("support_items"))
    item_types = {
        classified
        for classified in (_classify_support_item(item) for item in items)
        if classified
    }
    if item_types:
        return sorted(item_types)

    return _classify_policy_fallback(policy, legacy_label)


def _documents_need_check(policy: dict[str, Any]) -> bool:
    count = _safe_number(policy.get("required_documents_count"))
    docs = policy.get("required_documents_json")
    if count is not None and count > 0:
        return True
    if docs in (None, "", [], {}):
        return True
    if isinstance(docs, list) and len(docs) == 0:
        return True
    return False


def _eligibility_needs_check(policy: dict[str, Any]) -> bool:
    if policy.get("eligible") is False:
        return True
    status = _safe_text(policy.get("eligibility_extraction_status")).lower()
    if status in ("failed", "missing", "incomplete", "partial"):
        return True
    if not _safe_text(policy.get("eligibility_text")):
        return True
    return False


def _is_closing_urgent(policy: dict[str, Any]) -> bool:
    deadline = _resolve_deadline_date(policy)
    if not deadline:
        return False
    today = _seoul_today()
    if deadline < today:
        return False
    return (deadline - today).days <= CLOSING_URGENT_DAYS


def _resolve_application_status(policy: dict[str, Any]) -> str:
    if _is_closing_urgent(policy):
        return "마감 임박"
    if _documents_need_check(policy):
        return "서류 확인 필요"
    if _eligibility_needs_check(policy):
        return "조건 확인 필요"
    return "우선 검토"


def _resolve_live_discovery_status(policy: dict[str, Any]) -> str:
    if _eligibility_needs_check(policy):
        return "조건 확인 필요"
    return "기본 조건 통과 후보"


def _resolve_action_label(policy: dict[str, Any], *, is_live: bool = False) -> str:
    if _is_closing_urgent(policy):
        return "마감 확인 →"
    support = _resolve_support_type(policy)
    label = support["support_type_label"]
    if label == "금융지원":
        return "금융조건 보기 →"
    if label == "비금융 연계지원":
        return "상세 보기 →"
    if _documents_need_check(policy) and not is_live:
        return "서류 확인 →"
    return "상세 보기 →"


def _summarize_reason(reason: str, *, max_len: int = 120) -> str:
    text = reason.strip()
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    # 단어 중간에서 끊기지 않도록 마지막 공백 기준으로 잘라낸다(예: "...확..." 방지).
    truncated = text[: max_len - 1]
    last_space = truncated.rfind(" ")
    if last_space > 0:
        truncated = truncated[:last_space]
    return truncated.rstrip(" ,.·") + "…"


_ISO_DATE_PATTERN = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})")
_LOOSE_DATE_PATTERN = re.compile(r"(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})")
_NOTICE_LABEL_PATTERNS = (
    re.compile(r"공고일\s*[:：]?\s*(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})"),
    re.compile(r"등록일\s*[:：]?\s*(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})"),
    re.compile(r"게시일\s*[:：]?\s*(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})"),
)
_RECEPTION_RANGE_START_PATTERN = re.compile(
    r"(20\d{2}\.\s*\d{1,2}\.\s*\d{1,2})\([월화수목금토일]\)\s*~"
)
_RECEPTION_PERIOD_PATTERN = re.compile(r"접수기간.*?(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})")


def _normalize_date_str(raw: str) -> str | None:
    match = _ISO_DATE_PATTERN.match(raw.strip()) or _LOOSE_DATE_PATTERN.search(raw)
    if not match:
        return None
    year, month, day = match.group(1), match.group(2), match.group(3)
    try:
        return date(int(year), int(month), int(day)).isoformat()
    except ValueError:
        return None


def _extract_notice_date_from_text(text: str) -> tuple[str, str] | None:
    """반환값: (YYYY-MM-DD, '등록' 또는 '접수 시작'). 못 찾으면 None."""
    if not text:
        return None
    for pattern in _NOTICE_LABEL_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = _normalize_date_str(match.group(1))
            if normalized:
                return normalized, "등록"
    match = _RECEPTION_RANGE_START_PATTERN.search(text)
    if match:
        normalized = _normalize_date_str(match.group(1))
        if normalized:
            return normalized, "접수 시작"
    match = _RECEPTION_PERIOD_PATTERN.search(text)
    if match:
        normalized = _normalize_date_str(match.group(1))
        if normalized:
            return normalized, "접수 시작"
    return None


def _resolve_notice_date_label(policy: dict[str, Any]) -> str:
    """우선순위: posted_at/notice_date/published_at → 접수 시작일 필드 →
    raw_text/attachment_text/summary/deadline_note 정규식 추출 → created_at(등록 추정)
    → '공고문 확인 필요'. 특정 정책 하드코딩 없음."""
    for key in ("posted_at", "notice_date", "published_at"):
        value = _safe_text(policy.get(key))
        if not value:
            continue
        normalized = _normalize_date_str(value)
        if normalized:
            return f"{normalized} 등록"

    for key in ("application_start_date", "start_date"):
        value = _safe_text(policy.get(key))
        if not value:
            continue
        normalized = _normalize_date_str(value)
        if normalized:
            return f"{normalized} 접수 시작"

    text_blob = " ".join(
        _safe_text(policy.get(key))
        for key in ("raw_text", "attachment_text", "summary", "deadline_note")
        if _safe_text(policy.get(key))
    )
    extracted = _extract_notice_date_from_text(text_blob)
    if extracted:
        date_iso, kind = extracted
        return f"{date_iso} {kind}"

    created_at = _safe_text(policy.get("created_at"))
    normalized_created = _normalize_date_str(created_at) if created_at else None
    if normalized_created:
        return f"{normalized_created} 등록 추정"

    return "공고문 확인 필요"


# 접수 마감일(deadline) 추출용 원문 후보 필드. deadline_display/deadline_note가
# "미정"/"예산 소진 시" 같은 placeholder만 담고 있을 때 실제 날짜를 찾기 위한 폴백.
DEADLINE_TEXT_FIELDS = ("raw_text", "attachment_text", "summary", "deadline_note")

_DEADLINE_STATEMENT_PATTERN = re.compile(r"신청\s*마감일은\s*(20\d{2}-\d{2}-\d{2})")
_DEADLINE_LABELED_PATTERNS = (
    re.compile(r"접수\s*마감[^0-9]{0,10}(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})"),
    re.compile(r"신청\s*마감[^0-9]{0,10}(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})"),
)
_DEADLINE_PERIOD_RANGE_PATTERN = re.compile(
    r"(?:접수기간|신청기간)[^0-9]{0,10}(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})"
    r"[^0-9]{0,20}[~∼\-][^0-9]{0,20}(20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})"
)
_DEADLINE_WEEKDAY_RANGE_PATTERN = re.compile(
    r"(20\d{2}\.\s*\d{1,2}\.\s*\d{1,2})\([월화수목금토일]\)\s*~\s*(20\d{2}\.\s*\d{1,2}\.\s*\d{1,2})"
)


def _collect_deadline_raw_text(policy: dict[str, Any]) -> str:
    parts = [_safe_text(policy.get(key)) for key in DEADLINE_TEXT_FIELDS]
    return " ".join(part for part in parts if part)


def _extract_deadline_date_from_text(text: str) -> str | None:
    """반환값: YYYY-MM-DD 문자열 또는 None. 기간 표현은 종료일을 사용한다."""
    if not text:
        return None

    match = _DEADLINE_STATEMENT_PATTERN.search(text)
    if match:
        return match.group(1)

    for pattern in _DEADLINE_LABELED_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = _normalize_date_str(match.group(1))
            if normalized:
                return normalized

    match = _DEADLINE_WEEKDAY_RANGE_PATTERN.search(text)
    if match:
        normalized = _normalize_date_str(match.group(2))
        if normalized:
            return normalized

    match = _DEADLINE_PERIOD_RANGE_PATTERN.search(text)
    if match:
        normalized = _normalize_date_str(match.group(2))
        if normalized:
            return normalized

    return None


def _resolve_deadline_date(policy: dict[str, Any]) -> date | None:
    """구조화 필드(deadline/deadline_display/end_date/application_end_date)로 실제
    날짜를 못 찾으면 raw_text/attachment_text/summary/deadline_note에서 접수·신청
    마감일을 추출한다. "미정"/"예산 소진 시" 같은 placeholder는 날짜로 취급하지 않는다.
    특정 policy_id에 대한 예외 처리는 없다."""
    parsed = _parse_deadline(_policy_deadline_raw(policy))
    if parsed:
        return parsed

    for key in ("application_end_date", "end_date"):
        value = _safe_text(policy.get(key))
        if value:
            parsed = _parse_deadline(value)
            if parsed:
                return parsed

    extracted = _extract_deadline_date_from_text(_collect_deadline_raw_text(policy))
    if extracted:
        try:
            return date.fromisoformat(extracted)
        except ValueError:
            return None

    return None


# 지원내용 상세(funding_detail_lines) 추출용 원문 후보 필드. 정책마다 채워진 필드가 달라
# 모두 이어붙여 하나의 텍스트로 놓고 패턴을 찾는다(특정 정책 하드코딩 없음).
FUNDING_TEXT_FIELDS = (
    "max_amount_basis_evidence_text",
    "max_amount_basis_text",
    "max_amount_note",
    "summary",
    "eligibility_evidence",
    "raw_text",
    "attachment_text",
)

_SCALE_TOTAL_PATTERN = re.compile(r"총\s*([0-9][0-9,\.]*)\s*(억원|백만원|만원)")
_SCALE_SITE_COUNT_PATTERN = re.compile(r"([0-9]+)\s*개소")
_PER_UNIT_CAP_PATTERN = re.compile(
    r"(사업장|기업)\s*당\s*최대\s*([0-9][0-9,\.]*)\s*(만원|억원|백만원|천만원)"
)
_ENTITY_RATIO_PATTERN = re.compile(r"(중소기업|중견기업|소상공인)\s*([0-9]{1,3})\s*%")
_DUPLICATE_BAN_PATTERN = re.compile(r"중복\s*지원[^.]{0,20}(불가능|불가)")


def _collect_funding_raw_text(policy: dict[str, Any]) -> str:
    parts = [_safe_text(policy.get(key)) for key in FUNDING_TEXT_FIELDS]
    return " ".join(part for part in parts if part)


def _build_funding_detail_lines(policy: dict[str, Any]) -> list[str]:
    """support_items(구조화) 우선, 부족하면 원문 텍스트에서 지원규모/한도/비율/중복지원
    패턴을 일반 규칙으로 추출한다. 특정 정책명/ID를 위한 예외 처리는 두지 않는다."""
    lines: list[str] = []
    seen: set[str] = set()

    def add(line: str) -> None:
        normalized = line.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            lines.append(normalized)

    for item in _coerce_support_items(policy.get("support_items")):
        if not isinstance(item, dict):
            continue
        name = _safe_text(item.get("name"))
        amount = _safe_text(item.get("amount"))
        ratio = _safe_number(item.get("support_ratio"))
        if name and amount:
            line = f"{name}: {amount}"
            if ratio is not None and "%" not in amount:
                line += f" (지원비율 {round(ratio * 100)}%)"
            add(line)

    # support_items가 이미 개별 한도/금액을 알려주면 원문 정규식으로 같은 한도를 또
    # 뽑아 중복 표시하지 않는다. 단, 비율·중복지원 여부는 items에 없는 정보라 항상 확인한다.
    has_item_lines = len(lines) > 0

    raw_text = _collect_funding_raw_text(policy)
    if raw_text:
        if not has_item_lines:
            cap_match = _PER_UNIT_CAP_PATTERN.search(raw_text)
            if cap_match:
                add(f"{cap_match.group(1)}당 지원한도: 최대 {cap_match.group(2)}{cap_match.group(3)}")

            total_match = _SCALE_TOTAL_PATTERN.search(raw_text)
            site_match = _SCALE_SITE_COUNT_PATTERN.search(raw_text)
            if site_match:
                # 원문에 총액 표현이 없으면 이미 계산된 max_amount_actual로 보완한다
                # (헤더와 같은 값을 반복 표시하는 대신, 개소 수와 묶어 새로운 정보를 준다).
                total_label = (
                    f"총 {total_match.group(1)}{total_match.group(2)}"
                    if total_match
                    else _safe_text(policy.get("max_amount_actual"))
                )
                if total_label:
                    add(f"지원규모: {total_label} / 약 {site_match.group(1)}개소")
                else:
                    add(f"지원규모: 약 {site_match.group(1)}개소")
            elif total_match:
                add(f"지원규모: 총 {total_match.group(1)}{total_match.group(2)}")

        seen_entities: set[str] = set()
        ratio_parts: list[str] = []
        for entity, percent in _ENTITY_RATIO_PATTERN.findall(raw_text):
            if entity in seen_entities:
                continue
            seen_entities.add(entity)
            ratio_parts.append(f"{entity} {percent}%")
        if ratio_parts:
            add(f"지원비율: {', '.join(ratio_parts)}")

        if _DUPLICATE_BAN_PATTERN.search(raw_text):
            add("타 유사사업과의 중복지원 불가")

    return lines[:6]


def _coerce_support_items(value: Any) -> list[Any]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("[") or text.startswith("{"):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return [text]
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                return [parsed]
            return [text]
        return [text]
    return []


def _support_item_phrase(item: Any) -> str:
    if isinstance(item, dict):
        name = _safe_text(item.get("name"))
        amount = _safe_text(item.get("amount"))
        if name and amount:
            return f"{name} {amount}"
        return name or amount
    return _safe_text(item)


def _format_support_items_summary(value: Any, *, max_len: int = 80) -> str:
    phrases = [
        phrase
        for phrase in (_support_item_phrase(item) for item in _coerce_support_items(value))
        if phrase
    ]
    if not phrases:
        return ""
    text = ", ".join(phrases[:3])
    if len(phrases) > 3:
        text = f"{text} 등"
    return _summarize_reason(text, max_len=max_len)


def _build_why_check_now(
    policy: dict[str, Any],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
) -> list[str]:
    lines: list[str] = []
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    )
    if scenario:
        lines.append(f"현재 투자안({scenario})과 연결된 지원 조건입니다.")
    support_summary = _format_support_items_summary(policy.get("support_items"))
    summary = _safe_text(policy.get("summary"))
    if support_summary:
        lines.append(f"지원 내용: {support_summary}")
    elif summary:
        lines.append(f"지원 내용: {_summarize_reason(summary, max_len=80)}")

    missing: list[str] = []
    amount = _safe_text(policy.get("max_amount_actual"))
    if not amount:
        missing.append("지원한도")
    if _documents_need_check(policy):
        missing.append("제출서류")
    if _is_closing_urgent(policy) or _policy_deadline_raw(policy):
        missing.append("마감일")
    if missing:
        lines.append(f"지금 확인할 항목: {', '.join(missing)}")
    elif equipment and _safe_text(equipment.get("name")):
        lines.append(f"{equipment['name']} 설비 조건과 함께 검토할 수 있습니다.")
    return lines[:3]


def _build_preflight_checks(policy: dict[str, Any]) -> list[dict[str, str]]:
    support = _resolve_support_type(policy)
    amount = _safe_text(policy.get("max_amount_actual")) or "공고문 확인 필요"
    docs_count = _safe_number(policy.get("required_documents_count"))
    if docs_count is not None and docs_count > 0:
        docs_label = f"제출서류 {int(docs_count)}건 확인"
    else:
        docs_label = "제출서류 공고문 확인 필요"
    eligible_label = (
        "매칭 반영됨" if policy.get("eligible") is True else "조건 확인 필요"
    )
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    ) or "-"
    return [
        {"label": "기본 기업 조건", "value": eligible_label},
        {"label": "투자안 연결", "value": scenario},
        {"label": "지원 형태", "value": support["support_type_label"]},
        {"label": "지원 한도", "value": amount},
        {"label": "제출서류", "value": docs_label},
    ]


def _enrich_policy_with_detail(
    policy: dict[str, Any],
    detail: dict[str, Any] | None,
) -> dict[str, Any]:
    if not detail:
        return dict(policy)
    merged = {**detail, **policy}
    for key in (
        "title",
        "organization",
        "deadline",
        "deadline_display",
        "summary",
        "url",
        "max_amount_actual",
        "max_amount_numeric_manwon",
        "max_amount_type",
        "max_amount_type_ko",
        "support_method",
        "support_items",
        "policy_primary_nature",
        "support_primary_category",
        "support_categories",
        "roi_support_type",
        "roi_support_reason",
        "required_documents_count",
        "required_documents_json",
        "eligibility_text",
        "eligibility_extraction_status",
        "posted_at",
        "notice_date",
        "published_at",
        "application_start_date",
        "application_end_date",
        "start_date",
        "end_date",
        "application_period",
        "created_at",
        "deadline_note",
        "max_amount_basis_text",
        "max_amount_basis_evidence_text",
        "max_amount_note",
        "raw_text",
        "attachment_text",
    ):
        if not merged.get(key) and detail.get(key) is not None:
            merged[key] = detail.get(key)
    merged["policy_id"] = _normalize_policy_id(
        policy.get("policy_id") or detail.get("policy_id")
    )
    return merged


def _is_live_policy_excluded(policy: dict[str, Any]) -> bool:
    roi_support_type = _safe_text(policy.get("roi_support_type"))
    if "계산 제외" in roi_support_type:
        return True
    deadline = _parse_deadline(_policy_deadline_raw(policy))
    if deadline and deadline < _seoul_today():
        return True
    return False


def _district_tokens(value: Any) -> set[str]:
    return {token.strip() for token in DISTRICT_PATTERN.findall(_safe_text(value)) if token.strip()}


def _region_matches_company(policy_region: Any, company_region: Any) -> bool:
    policy_text = _safe_text(policy_region)
    company_text = _safe_text(company_region)
    if not company_text or not policy_text:
        return True
    if any(term in policy_text for term in NATIONWIDE_TERMS):
        return True

    policy_districts = _district_tokens(policy_text)
    if policy_districts:
        company_districts = _district_tokens(company_text)
        return bool(company_districts and policy_districts.intersection(company_districts))

    region_short = company_text.split()[0] if company_text else ""
    return bool(region_short and region_short in policy_text)


def _passes_live_company_filters(policy: dict[str, Any], company: dict[str, Any]) -> bool:
    company_codes = [
        code.strip()
        for code in str(company.get("industry_code") or "").split(",")
        if code.strip()
    ]
    policy_codes = [
        code.strip()
        for code in str(policy.get("industry_codes") or "").split(",")
        if code.strip()
    ]
    region = _safe_text(company.get("region"))
    policy_region = _safe_text(policy.get("region"))
    code_match = (
        not company_codes
        or not policy_codes
        or "C" in policy_codes
        or any(code in policy_codes for code in company_codes)
    )
    region_match = _region_matches_company(policy_region, region)
    company_types = [
        item.strip()
        for item in str(company.get("company_type") or "").split(",")
        if item.strip()
    ]
    eligible_types = [
        item.strip()
        for item in str(policy.get("eligible_company_types") or "").split(",")
        if item.strip()
    ]
    type_match = (
        not eligible_types
        or not company_types
        or any(company_type in eligible_types for company_type in company_types)
    )
    employee_count = _safe_number(company.get("employee_count"))
    employee_min = _safe_number(policy.get("employee_min"))
    employee_max = _safe_number(policy.get("employee_max"))
    employee_match = True
    if employee_count is not None:
        if employee_min is not None and employee_count < employee_min:
            employee_match = False
        if employee_max is not None and employee_count > employee_max:
            employee_match = False

    revenue = _safe_number(company.get("annual_revenue"))
    revenue_min = _safe_number(policy.get("revenue_min_manwon"))
    revenue_max = _safe_number(policy.get("revenue_max_manwon"))
    revenue_match = True
    if revenue is not None:
        if revenue_min is not None and revenue < revenue_min:
            revenue_match = False
        if revenue_max is not None and revenue > revenue_max:
            revenue_match = False

    age_years = _company_age_years(company)
    age_min = _safe_number(policy.get("company_age_min"))
    age_max = _safe_number(policy.get("company_age_max"))
    age_match = True
    if age_years is not None:
        if age_min is not None and age_years < age_min:
            age_match = False
        if age_max is not None and age_years > age_max:
            age_match = False

    return code_match and region_match and type_match and employee_match and revenue_match and age_match


def _format_deadline_label(policy: dict[str, Any]) -> str:
    display = _safe_text(policy.get("deadline_display"))
    # deadline_display에 이미 실제 날짜가 들어있으면(예: "2026-07-30 마감") 그대로 쓴다.
    if display and _parse_deadline(display):
        return display

    # "미정"/"예산 소진 시" 같은 placeholder만 있는 경우 실제 날짜를 다시 찾아본다.
    resolved = _resolve_deadline_date(policy)
    if resolved:
        return f"{resolved.isoformat()} 마감"

    if display:
        return display
    deadline = _policy_deadline_raw(policy)
    if deadline:
        return str(deadline)
    return "마감일 공고문 확인"



def _scenario_label_from_match(scenario_match: Any) -> str:
    if not isinstance(scenario_match, list):
        return ""
    normalized = {str(item).strip().lower() for item in scenario_match if item is not None}
    if "a" in normalized and "b" in normalized:
        return "A/B 공통"
    if "a" in normalized:
        return "전체교체"
    if "b" in normalized:
        return "부분교체"
    return ""


def _deadline_info(policy: dict[str, Any]) -> dict[str, Any]:
    raw = _policy_deadline_raw(policy)
    deadline = _resolve_deadline_date(policy)
    today = _seoul_today()
    if deadline:
        deadline_iso = deadline.isoformat()
        days_remaining = (deadline - today).days
        if days_remaining < 0:
            return {
                "deadline": deadline_iso,
                "deadline_display": f"{deadline_iso} 마감",
                "d_day": "마감됨",
                "days_remaining": days_remaining,
                "is_past": True,
            }
        return {
            "deadline": deadline_iso,
            "deadline_display": f"{deadline_iso} 마감",
            "d_day": _d_day_label(days_remaining),
            "days_remaining": days_remaining,
            "is_past": False,
        }
    display = _safe_text(policy.get("deadline_display"), raw)
    return {
        "deadline": raw or None,
        "deadline_display": display or None,
        "d_day": display or "-",
        "days_remaining": None,
        "is_past": False,
    }


def _format_support_amount(policy: dict[str, Any]) -> str:
    actual = _safe_text(policy.get("max_amount_actual"))
    if actual:
        return actual
    manwon = _safe_number(policy.get("max_amount_numeric_manwon"), policy.get("max_amount"))
    if manwon is not None:
        return f"최대 {int(manwon):,}만원"
    return "지원금 조건 확인 필요"


def _build_tags(
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    policy: dict[str, Any],
) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for value in (
        _safe_text(policy.get("policy_category")),
        _safe_text(policy.get("policy_subcategory")),
        _safe_text((equipment or {}).get("category")),
        _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(policy.get("scenario_match")),
        _safe_text(company.get("industry_name")),
        _safe_text(company.get("region")),
    ):
        if not value or value in seen:
            continue
        seen.add(value)
        tags.append(value)
    return tags[:6]


def _build_condition_links(
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    policy: dict[str, Any],
) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    category = _safe_text(policy.get("policy_category"))
    if category:
        links.append({"label": "정책 분류", "value": category})
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    )
    if scenario:
        links.append({"label": "투자 시나리오", "value": scenario})
    organization = _safe_text(policy.get("organization"))
    if organization:
        links.append({"label": "주관 기관", "value": organization})
    region = _safe_text(company.get("region"))
    if region:
        links.append({"label": "지역", "value": region})
    industry = _safe_text(company.get("industry_name"))
    if industry:
        links.append({"label": "업종", "value": industry})
    company_type = _safe_text(company.get("company_type"))
    if company_type:
        links.append({"label": "기업 규모", "value": company_type})
    equipment_name = _safe_text((equipment or {}).get("name"))
    if equipment_name:
        links.append({"label": "설비", "value": equipment_name})
    return links


def _fit_status(policy: dict[str, Any], match_score: int | None) -> str:
    eligible = policy.get("eligible")
    if eligible is False:
        return "조건 확인 필요"
    if match_score is None:
        return "조건 확인 필요"
    if match_score >= 70:
        return "적합"
    if match_score >= 50:
        return "검토 필요"
    return "조건 확인 필요"


def _deterministic_reason(
    policy: dict[str, Any],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
) -> str:
    parts: list[str] = []
    industry = _safe_text(company.get("industry_name"))
    region = _safe_text(company.get("region"))
    if industry and region:
        parts.append(f"{industry}·{region} 조건과 연결")
    category = _safe_text((equipment or {}).get("category"))
    if category:
        parts.append(f"{category} 설비 조건 반영")
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    )
    if scenario:
        parts.append(f"{scenario} 시나리오와 연계")
    if parts:
        return " · ".join(parts) + "되어 우선 검토 대상으로 정리했습니다."
    return "기업·설비·투자 조건을 기준으로 우선 검토할 공고입니다."


def _map_policy_card(
    policy: dict[str, Any],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    rank: int | None = None,
    is_live: bool = False,
) -> dict[str, Any]:
    deadline = _deadline_info(policy)
    reason = _safe_text(policy.get("reason")) or _deterministic_reason(
        policy, company=company, equipment=equipment
    )
    support = _resolve_support_type(policy)
    application_status = (
        _resolve_live_discovery_status(policy)
        if is_live
        else _resolve_application_status(policy)
    )
    policy_id = _normalize_policy_id(policy.get("policy_id"))
    amount = _safe_text(policy.get("max_amount_actual"))
    docs_count = _safe_number(policy.get("required_documents_count"))
    return {
        "rank": rank,
        "policy_id": policy_id,
        "title": _safe_text(policy.get("title"), default="공고명 미확인"),
        "organization": _safe_text(policy.get("organization"), default="-"),
        "deadline": deadline["deadline"],
        "deadline_display": _format_deadline_label(policy),
        "d_day": deadline["d_day"],
        "days_remaining": deadline["days_remaining"],
        "is_past_deadline": deadline["is_past"],
        "application_status": application_status,
        "support_type_label": support["support_type_label"],
        "support_type_detail": support["support_type_detail"],
        "support_component_types": _resolve_support_component_types(
            policy, support["support_type_label"]
        ),
        # 원본 구조화 필드 그대로 노출: support_component_types가 비어 있는 경우
        # 프론트에서도 동일한 우선순위로 폴백 분류를 할 수 있게 하기 위함.
        "support_items": policy.get("support_items"),
        "support_method": policy.get("support_method"),
        "roi_support_type": policy.get("roi_support_type"),
        "support_primary_category": policy.get("support_primary_category"),
        "support_categories": policy.get("support_categories"),
        "policy_primary_nature": policy.get("policy_primary_nature"),
        "notice_date_label": _resolve_notice_date_label(policy),
        "posted_at": policy.get("posted_at"),
        "notice_date": policy.get("notice_date"),
        "published_at": policy.get("published_at"),
        "application_start_date": policy.get("application_start_date"),
        "start_date": policy.get("start_date"),
        "created_at": policy.get("created_at"),
        "funding_detail_lines": _build_funding_detail_lines(policy),
        "recommendation_summary": _summarize_reason(reason),
        "match_reason": reason,
        "why_check_now": _build_why_check_now(
            policy, company=company, equipment=equipment
        ),
        "preflight_checks": _build_preflight_checks(policy),
        "support_amount_text": amount or "공고문 확인 필요",
        "required_documents_label": (
            f"제출서류 {int(docs_count)}건 확인"
            if docs_count is not None and docs_count > 0
            else "제출서류 공고문 확인 필요"
        ),
        "action_label": _resolve_action_label(policy, is_live=is_live),
        "tags": _build_tags(company=company, equipment=equipment, policy=policy),
        "condition_links": _build_condition_links(
            company=company, equipment=equipment, policy=policy
        ),
        "eligible": policy.get("eligible", True),
        "scenario_label": _safe_text(policy.get("scenario_label"))
        or _scenario_label_from_match(policy.get("scenario_match")),
        "url": _safe_text(policy.get("url")) or None,
        "summary": _safe_text(policy.get("summary")) or None,
        "required_documents_count": docs_count,
        "exists": True,
    }


def _order_snapshot_policies(
    policies: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    if not policies:
        return []
    ordered = list(policies)
    recommended_id = _normalize_policy_id(snapshot.get("recommended_policy_id"))
    if not recommended_id:
        return ordered
    index = next(
        (
            idx
            for idx, policy in enumerate(ordered)
            if _normalize_policy_id(policy.get("policy_id")) == recommended_id
        ),
        -1,
    )
    if index > 0:
        recommended = ordered.pop(index)
        ordered.insert(0, recommended)
    return ordered


def _count_closing_soon(policies: list[dict[str, Any]]) -> int:
    today = _seoul_today()
    count = 0
    for policy in policies:
        deadline = _parse_deadline(_policy_deadline_raw(policy))
        if not deadline or deadline < today:
            continue
        days = (deadline - today).days
        if days <= CLOSING_SOON_DAYS:
            count += 1
    return count


def _count_policy_db_total(db: Any) -> int:
    try:
        result = db.table("policy").select("policy_id", count="exact").execute()
        return int(result.count or 0)
    except Exception:
        logger.exception("support_projects policy_db_total count failed")
        return 0


def _fetch_policy_details(db: Any, policy_ids: list[str]) -> dict[str, dict[str, Any]]:
    unique = []
    seen: set[str] = set()
    for policy_id in policy_ids:
        normalized = _normalize_policy_id(policy_id)
        if normalized and normalized not in seen:
            unique.append(normalized)
            seen.add(normalized)
    if not unique:
        return {}
    try:
        result = (
            db.table("policy")
            .select(POLICY_OVERVIEW_SELECT_FIELDS)
            .in_("policy_id", unique)
            .execute()
        )
        return {
            _normalize_policy_id(row.get("policy_id") or row.get("id")): row
            for row in (result.data or [])
            if isinstance(row, dict)
        }
    except Exception:
        logger.exception("support_projects policy detail fetch failed")
        return {}


def _merge_matched_policy_row(row: dict[str, Any], detail: dict[str, Any] | None) -> dict[str, Any]:
    detail = detail or {}
    policy_id = _normalize_policy_id(row.get("policy_id") or detail.get("policy_id"))
    return {
        "policy_id": policy_id,
        "title": _safe_text(row.get("title"), detail.get("title"), default="공고명 미확인"),
        "organization": _safe_text(
            row.get("organization"),
            detail.get("organization"),
            detail.get("agency"),
            default="-",
        ),
        "match_score": row.get("match_score")
        if row.get("match_score") is not None
        else detail.get("match_score"),
        "llm_score": row.get("llm_score") or detail.get("llm_score"),
        "eligible": row.get("eligible", True),
        "reason": _safe_text(row.get("reason"), detail.get("reason")),
        "scenario_match": row.get("scenario_match") or detail.get("scenario_match"),
        "scenario_label": _safe_text(row.get("scenario_label"), detail.get("scenario_label")),
        "summary": _safe_text(detail.get("summary")),
        "deadline": detail.get("deadline"),
        "deadline_display": detail.get("deadline_display"),
        "max_amount_actual": detail.get("max_amount_actual"),
        "max_amount_numeric_manwon": detail.get("max_amount") or detail.get("max_amount_numeric_manwon"),
        "policy_category": detail.get("policy_category"),
        "policy_subcategory": detail.get("policy_subcategory"),
        "url": detail.get("url"),
        "support_items": detail.get("support_items"),
    }


def _resolve_equipment(
    db: Any,
    *,
    company: dict[str, Any],
    equipment_id: str | None,
    roi_equipment_id: str | None = None,
) -> dict[str, Any] | None:
    company_id = str(company.get("company_id") or "")
    target_id = _safe_text(equipment_id) or _safe_text(roi_equipment_id) or _safe_text(
        company.get("representative_equipment_id")
    )
    try:
        query = db.table("equipment").select("*").eq("company_id", company_id)
        if target_id:
            query = query.eq("equipment_id", target_id)
        result = query.limit(1).execute()
        if result.data:
            return result.data[0]
        fallback = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .limit(1)
            .execute()
        )
        return (fallback.data or [None])[0]
    except Exception:
        logger.exception("support_projects equipment lookup failed company_id=%s", company_id)
        return None


def _analysis_scenario(roi_row: dict[str, Any]) -> str:
    roi_data = roi_row.get("roi_data") if isinstance(roi_row.get("roi_data"), dict) else {}
    recommended = _safe_text(roi_data.get("recommended")).lower()
    if "b" in recommended:
        return "b"
    if "a" in recommended:
        return "a"
    return "unknown"


def _company_payload(company: dict[str, Any]) -> dict[str, Any]:
    return {
        "company_id": str(company.get("company_id") or ""),
        "company_name": _safe_text(company.get("company_name"), default="-"),
        "industry_name": _safe_text(company.get("industry_name")) or None,
        "region": _safe_text(company.get("region")) or None,
        "company_type": _safe_text(company.get("company_type")) or None,
    }


def _equipment_payload(equipment: dict[str, Any] | None) -> dict[str, Any] | None:
    if not equipment:
        return None
    return {
        "equipment_id": str(equipment.get("equipment_id") or ""),
        "name": _safe_text(equipment.get("name"), default="설비명 미확인"),
        "category": _safe_text(equipment.get("category")) or None,
        "process": _safe_text(equipment.get("process")) or None,
    }


def _build_policy_lists(
    policies: list[dict[str, Any]],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    priority_id: str,
    policy_details: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    details = policy_details or {}
    display_policies = policies[:PRIORITY_DISPLAY_LIMIT]
    enriched = [
        _enrich_policy_with_detail(
            policy,
            details.get(_normalize_policy_id(policy.get("policy_id"))),
        )
        for policy in display_policies
    ]
    all_matched = [
        _map_policy_card(policy, company=company, equipment=equipment, rank=index + 1)
        for index, policy in enumerate(enriched)
    ]
    candidate_rows = [
        policy
        for policy in enriched
        if _normalize_policy_id(policy.get("policy_id")) != priority_id
    ]
    candidates = [
        _map_policy_card(policy, company=company, equipment=equipment, rank=index + 2)
        for index, policy in enumerate(candidate_rows[: max(0, PRIORITY_DISPLAY_LIMIT - 1)])
    ]
    return candidates, all_matched


def _load_live_discovery_candidates(
    db: Any,
    *,
    company: dict[str, Any],
    exclude_policy_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], int, str | None]:
    exclude_policy_ids = exclude_policy_ids or set()
    try:
        result = db.table("policy").select(POLICY_OVERVIEW_SELECT_FIELDS).execute()
    except Exception:
        logger.exception("support_projects live discovery policy query failed")
        return [], 0, "추가 정책 후보를 불러오지 못했습니다."

    rows = [row for row in (result.data or []) if isinstance(row, dict)]
    filtered: list[dict[str, Any]] = []
    for policy in rows:
        policy_id = _normalize_policy_id(policy.get("policy_id") or policy.get("id"))
        if not policy_id or policy_id in exclude_policy_ids:
            continue
        if _is_live_policy_excluded(policy):
            continue
        if not _passes_live_company_filters(policy, company):
            continue
        filtered.append(policy)

    def live_sort_key(policy: dict[str, Any]) -> tuple:
        deadline = _parse_deadline(_policy_deadline_raw(policy))
        today = _seoul_today()
        if deadline and deadline >= today:
            deadline_rank = (deadline - today).days
        else:
            deadline_rank = 99999
        return (deadline_rank, _safe_text(policy.get("title")))

    filtered = sorted(filtered, key=live_sort_key)
    total_count = len(filtered)
    items = [
        _map_policy_card(policy, company=company, equipment=None, is_live=True)
        for policy in filtered[:LIVE_DISCOVERY_DISPLAY_LIMIT]
    ]
    return items, total_count, None


def _empty_live_discovery_payload() -> dict[str, Any]:
    return {
        "source": "current_policy_database",
        "total_count": 0,
        "items": [],
        "error": None,
    }


def _build_overview_payload(
    *,
    mode: str,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    analysis: dict[str, Any] | None,
    counts: dict[str, int],
    priority_policy: dict[str, Any] | None,
    priority_policies: list[dict[str, Any]],
    all_matched: list[dict[str, Any]],
    live_discovery: dict[str, Any],
    legacy_state: str | None = None,
    empty_state: str | None = None,
    analysis_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "mode": mode,
        "policy_database_total": counts.get("policy_db_total", 0),
        "analysis_context": analysis_context,
        "company": _company_payload(company),
        "equipment": _equipment_payload(equipment),
        "analysis": analysis,
        "counts": counts,
        "priority_policy": priority_policy,
        "priority_policies": priority_policies,
        "candidates": priority_policies,
        "all_matched": all_matched,
        "live_discovery": live_discovery,
        "legacy_state": legacy_state,
        "empty_state": empty_state,
    }


def load_support_projects_overview(
    *,
    company_id: str,
    user_id: str,
    analysis_id: str | None = None,
    equipment_id: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    company = _verify_company(db, company_id, user_id)
    policy_db_total = _count_policy_db_total(db)

    if analysis_id:
        return _load_analysis_snapshot_overview(
            db=db,
            company=company,
            company_id=company_id,
            analysis_id=analysis_id,
            policy_db_total=policy_db_total,
        )

    return _load_live_discovery_overview(
        db=db,
        company=company,
        company_id=company_id,
        equipment_id=equipment_id,
        policy_db_total=policy_db_total,
    )


def _load_analysis_snapshot_overview(
    *,
    db: Any,
    company: dict[str, Any],
    company_id: str,
    analysis_id: str,
    policy_db_total: int,
) -> dict[str, Any]:
    try:
        result = (
            db.table("roi_output")
            .select(
                "id,company_id,equipment_id,created_at,policy_snapshot,roi_data,"
                "scenario_a_investment_manwon,scenario_b_investment_manwon"
            )
            .eq("id", analysis_id)
            .eq("company_id", company_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception(
            "support_projects roi_output query failed analysis_id=%s company_id=%s",
            analysis_id,
            company_id,
        )
        raise

    row = (result.data or [None])[0]
    if not row:
        raise LookupError("분석 결과를 찾을 수 없습니다.")

    equipment = _resolve_equipment(
        db,
        company=company,
        equipment_id=None,
        roi_equipment_id=str(row.get("equipment_id") or ""),
    )
    analysis_payload = {
        "analysis_id": str(row.get("id") or analysis_id),
        "created_at": row.get("created_at"),
        "scenario": _analysis_scenario(row),
    }

    snapshot = row.get("policy_snapshot")
    analysis_context = {
        "analysis_id": str(row.get("id") or analysis_id),
        "company_id": company_id,
        "equipment_id": str(row.get("equipment_id") or ""),
        "equipment_name": _safe_text((equipment or {}).get("name"), default="설비명 미확인"),
        "snapshot_status": "legacy_missing",
    }
    # analysis_snapshot 모드는 스냅샷의 canonical policies만 사용한다.
    # policy 테이블 전체를 select("*")로 스캔하는 live discovery 후보 조회는
    # 여기서는 수행하지 않는다 (raw_text/attachment_text 포함 33MB급 스캔이
    # 요청당 최대 2회 발생해 Render 저사양 환경에서 502를 유발했다).
    live_discovery = _empty_live_discovery_payload()

    if _is_empty_policy_snapshot(snapshot):
        live_items, live_total, live_error = _load_live_discovery_candidates(
            db,
            company=company,
            exclude_policy_ids=set(),
        )
        live_discovery = {
            "source": "current_policy_database",
            "total_count": live_total,
            "items": live_items,
            "error": live_error,
        }
        priority_policy = {"exists": True, **live_items[0]} if live_items else {"exists": False}
        return _build_overview_payload(
            mode="analysis_snapshot",
            company=company,
            equipment=equipment,
            analysis=analysis_payload,
            analysis_context=analysis_context,
            counts={
                "policy_db_total": policy_db_total,
                "matched_total": len(live_items),
                "priority_policy_count": 1 if live_items else 0,
                "closing_soon_count": _count_closing_soon(
                    [{"deadline": item.get("deadline")} for item in live_items]
                ),
            },
            priority_policy=priority_policy,
            priority_policies=live_items[1:],
            all_matched=live_items,
            live_discovery=live_discovery,
            legacy_state=None,
            empty_state="no_matches" if not live_items else None,
        )

    snapshot_dict = snapshot if isinstance(snapshot, dict) else {}
    analysis_context["snapshot_status"] = "available"
    raw_policies = _snapshot_policy_rows(snapshot_dict)
    policy_details = _fetch_policy_details(
        db,
        [_normalize_policy_id(policy.get("policy_id")) for policy in raw_policies],
    )
    policies = _order_snapshot_policies(raw_policies, snapshot_dict)
    policies = [
        _enrich_policy_with_detail(
            policy,
            policy_details.get(_normalize_policy_id(policy.get("policy_id"))),
        )
        for policy in policies
    ]
    matched_total = len(policies)
    priority_row = policies[0] if policies else None
    priority_id = _normalize_policy_id((priority_row or {}).get("policy_id"))

    priority_policy = None
    if priority_row:
        priority_policy = {
            "exists": True,
            **_map_policy_card(
                priority_row,
                company=company,
                equipment=equipment,
                rank=1,
            ),
        }

    priority_policies, all_matched = _build_policy_lists(
        policies,
        company=company,
        equipment=equipment,
        priority_id=priority_id,
        policy_details=policy_details,
    )

    # 위와 동일한 이유로 analysis_snapshot 경로에서는 live discovery 후보를
    # 다시 조회하지 않는다. live_discovery 탭 자체(_load_live_discovery_overview)는
    # 그대로 유지된다.
    live_discovery = _empty_live_discovery_payload()

    return _build_overview_payload(
        mode="analysis_snapshot",
        company=company,
        equipment=equipment,
        analysis=analysis_payload,
        analysis_context=analysis_context,
        counts={
            "policy_db_total": policy_db_total,
            "matched_total": min(matched_total, PRIORITY_DISPLAY_LIMIT),
            "priority_policy_count": min(matched_total, PRIORITY_DISPLAY_LIMIT),
            "closing_soon_count": _count_closing_soon(policies),
        },
        priority_policy=priority_policy or {"exists": False},
        priority_policies=priority_policies,
        all_matched=all_matched,
        live_discovery=live_discovery,
        legacy_state=None,
        empty_state="no_matches" if matched_total == 0 else None,
    )


def _load_live_discovery_overview(
    *,
    db: Any,
    company: dict[str, Any],
    company_id: str,
    equipment_id: str | None,
    policy_db_total: int,
) -> dict[str, Any]:
    equipment = _resolve_equipment(db, company=company, equipment_id=equipment_id)
    live_items, live_total, live_error = _load_live_discovery_candidates(
        db,
        company=company,
        exclude_policy_ids=set(),
    )
    live_discovery = {
        "source": "current_policy_database",
        "total_count": live_total,
        "items": live_items,
        "error": live_error,
    }

    priority_policy = None
    priority_policies: list[dict[str, Any]] = []
    if live_items:
        first = live_items[0]
        priority_policy = {"exists": True, **first}
        priority_policies = live_items[1:]

    return _build_overview_payload(
        mode="live_discovery",
        company=company,
        equipment=equipment,
        analysis=None,
        analysis_context=None,
        counts={
            "policy_db_total": policy_db_total,
            "matched_total": len(live_items),
            "priority_policy_count": 1 if priority_policy else 0,
            "closing_soon_count": _count_closing_soon(
                [{"deadline": item.get("deadline")} for item in live_items]
            ),
        },
        priority_policy=priority_policy or {"exists": False},
        priority_policies=priority_policies,
        all_matched=live_items,
        live_discovery=live_discovery,
        legacy_state=None,
        empty_state="no_matches" if not live_items else None,
    )
