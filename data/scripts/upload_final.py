from __future__ import annotations

import argparse
import io
import json
import os
import re
import time
import zipfile
from datetime import datetime
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlparse
from xml.etree import ElementTree

import requests
from dotenv import load_dotenv
try:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover - optional local dependency
    ChatOpenAI = None
    HumanMessage = None
    SystemMessage = None
from supabase import Client, create_client


# -----------------------------------------------------------------------------
# Environment
# -----------------------------------------------------------------------------
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
BIZINFO_API_KEY = os.getenv("BIZINFO_API_KEY", "").strip()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
DATA_LLM_MODEL = os.getenv(
    "DATA_LLM_MODEL",
    "google/gemini-2.5-flash",
).strip()

TARGET_TABLE = os.getenv("POLICY_VALIDATION_TARGET_TABLE", "policy_validation_new").strip()
DEFAULT_PAGE_UNIT = int(os.getenv("BIZINFO_PAGE_UNIT", "100"))
DEFAULT_MAX_PAGES = int(os.getenv("BIZINFO_MAX_PAGES", "10"))
DEFAULT_MAX_POLICIES = int(os.getenv("MAX_POLICIES", "0"))  # 0 = all
DEFAULT_DRY_RUN = os.getenv("DRY_RUN", "1").strip() != "0"
DEFAULT_SLEEP_SECONDS = float(os.getenv("BIZINFO_SLEEP_SECONDS", "0.4"))
DEFAULT_SEARCH_LCLAS_IDS = os.getenv("BIZINFO_SEARCH_LCLAS_IDS", "01,02,03,07,09")

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is missing from .env files.")
if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
if not BIZINFO_API_KEY:
    raise ValueError("BIZINFO_API_KEY is missing from .env files.")

def create_data_llm(model_name: str):
    if not ChatOpenAI or not OPENROUTER_API_KEY:
        return None
    return ChatOpenAI(
        model=model_name,
        openai_api_key=OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1",
        temperature=0,
    )


llm = create_data_llm(DATA_LLM_MODEL)


# -----------------------------------------------------------------------------
# Classification criteria copied from the policy collection pipeline.
# This script writes only to policy_validation_new, never to policy.
# -----------------------------------------------------------------------------
REGIONS = [
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
]

BIZINFO_SEARCH_LCLAS_NAMES = {
    "01": "금융",
    "02": "기술",
    "03": "인력",
    "07": "경영",
    "09": "기타",
}

INDUSTRY_CODE_MAP = {
    "제조": ["C"],
    "스마트공장": ["C"],
    "스마트제조": ["C"],
    "식품": ["C10"],
    "섬유": ["C13"],
    "화학": ["C20"],
    "바이오": ["C21"],
    "의약": ["C21"],
    "의료기기": ["C27"],
    "고무": ["C22"],
    "플라스틱": ["C22"],
    "금속": ["C24", "C25"],
    "금속가공": ["C25"],
    "전자": ["C26"],
    "반도체": ["C26"],
    "전기": ["C28"],
    "기계": ["C29"],
    "장비": ["C29"],
    "로봇": ["C29"],
    "자동차": ["C30"],
    "부품": ["C30"],
    "소부장": ["C20", "C24", "C25", "C26", "C28", "C29"],
    "뿌리": ["C24", "C25", "C28", "C29"],
}

MANUFACTURING_KEYWORDS = [
    "제조", "공정", "공정개선", "스마트공장", "스마트제조",
    "제조데이터", "제조AI", "제조로봇", "로봇", "자동화",
    "설비", "장비", "기자재",
    "기술개발", "R&D", "사업화", "시제품", "실증",
    "제품고급화", "인증", "시험", "신뢰성", "성능평가",
    "에너지효율", "고효율", "탄소중립", "온실가스", "에너지절감",
    "금속", "플라스틱", "사출", "프레스", "CNC",
    "기계", "부품", "소부장", "뿌리",
]

EXCLUDE_KEYWORDS = [
    "음식점", "외식", "카페", "숙박", "관광",
    "농업", "어업", "문화예술", "공연", "예비창업",
]

CAPEX_KEYWORDS = [
    "설비", "제조설비", "생산설비", "노후설비", "설비투자",
    "스마트공장", "스마트제조", "공정개선", "공정자동화",
    "자동화설비", "로봇자동화", "노후", "교체",
    "에너지효율", "에너지절감", "고효율", "CAPEX",
]

SUPPORT_METHOD_KEYWORDS = {
    "현금지원": ["보조금", "지원금", "국비 지원", "바우처", "사업비 지원"],
    "공동장비": ["공동장비", "공동활용", "장비 활용", "시설 이용", "공동연구실"],
    "컨설팅멘토링": ["컨설팅", "멘토링", "자문", "전문가 매칭", "코칭"],
    "기술개발": ["R&D", "기술개발", "시제품", "실증", "사업화"],
    "시험인증": ["시험", "인증", "신뢰성", "성능평가", "검증"],
    "교육": ["교육", "연수", "세미나", "워크숍"],
    "판로수출": ["판로", "수출", "해외 마케팅", "바이어", "해외진출"],
    "에너지효율": ["에너지효율", "에너지절감", "고효율", "탄소중립", "온실가스"],
    "스마트공장": ["스마트공장", "스마트제조"],
}

POSTED_DATE_KEYS = [
    "pblancRegistDt",
    "pblancRegistDe",
    "pblancRegistDate",
    "registDt",
    "registDe",
    "regDate",
    "creatDt",
    "createDt",
    "frstRegistDt",
    "frstRegistDe",
    "writngDe",
    "writngDt",
]

POSTED_LABELS = [
    "공고등록일",
    "공고 등록일",
    "공고일",
    "등록일",
    "게시일",
    "작성일",
]

DEADLINE_LABELS = [
    "신청기간",
    "접수기간",
    "신청 기간",
    "접수 기간",
    "신청마감일",
    "신청 마감일",
    "마감일",
    "접수마감",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
    )
}
MAX_ATTACHMENTS_PER_POLICY = int(os.getenv("MAX_ATTACHMENTS_PER_POLICY", "5"))
MAX_ATTACHMENT_BYTES = int(os.getenv("MAX_ATTACHMENT_BYTES", str(15 * 1024 * 1024)))
SUPPORTED_ATTACHMENT_EXTENSIONS = {".pdf", ".hwpx", ".docx", ".xlsx"}
UNSUPPORTED_ATTACHMENT_EXTENSIONS = {".hwp"}


# -----------------------------------------------------------------------------
# Text and date helpers
# -----------------------------------------------------------------------------
def clean_html(value: Any) -> str:
    if value is None:
        return ""
    text = re.sub(r"<script[\s\S]*?</script>", " ", str(value), flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = text.replace("\xa0", " ").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", text).strip()


def clean_text(value: Any, max_len: int | None = None) -> str:
    text = clean_html(value)
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip() + "..."
    return text


def first_non_empty(*values: Any) -> str:
    for value in values:
        text = clean_text(value)
        if text:
            return text
    return ""


def normalize_summary_bullets(text: str) -> list[str]:
    lines: list[str] = []
    for raw_line in str(text or "").splitlines():
        line = clean_text(raw_line)
        if not line:
            continue
        line = re.sub(r"^\s*(?:[-*•ㆍ]|\d+[.)]|[①-⑩])\s*", "", line).strip()
        line = line.rstrip(".。")
        line = re.sub(r"(합니다|했습니다|됩니다|입니다|한다|했다|된다|이다|함|음)\s*$", "", line).strip()
        if line:
            lines.append(line)
    return lines


def strip_summary_label(line: str) -> str:
    """Remove UI-unfriendly labels from 5-line summaries."""
    return re.sub(
        r"^\s*(?:"
        r"지원\s*대상|지원\s*내용|지원\s*범위|지원\s*규모|신청\s*기간|"
        r"활용\s*목적|기대\s*효과|주요\s*내용|대상|내용|범위|기간|목적"
        r")\s*[:：]\s*",
        "",
        clean_text(line),
    ).strip()


def enforce_five_bullet_summary(lines: list[str]) -> str:
    cleaned: list[str] = []
    seen = set()

    for line in lines:
        line = clean_text(line, 120).rstrip(".。")
        line = strip_summary_label(line)
        line = re.sub(r"\s+", " ", line).strip()
        if not line or line in {"확인 필요", "공식 공고 확인 필요", "공고문 기준 확인 필요"}:
            continue
        if line in seen:
            continue
        seen.add(line)
        cleaned.append(line)
        if len(cleaned) == 5:
            break

    fallback_lines = [
        "지원 대상과 신청 조건은 공식 공고 확인 필요",
        "지원 내용과 세부 수행 범위는 공고문 기준 확인 필요",
        "지원 규모와 기업별 한도는 공식 공고 확인 필요",
        "신청 기간과 제출 방식은 상세 공고 기준 확인 필요",
        "제조 현장의 생산성 향상과 경쟁력 강화를 위한 활용 가능",
    ]

    for line in fallback_lines:
        if len(cleaned) >= 5:
            break
        if line not in seen:
            cleaned.append(line)
            seen.add(line)

    return "\n".join(f"- {line}" for line in cleaned[:5])


def normalize_summary_for_storage(summary: str) -> str:
    """Normalize any summary source into five unlabeled bullet lines."""
    lines = normalize_summary_bullets(summary)
    return enforce_five_bullet_summary(lines)


def compact_summary_phrase(text: str, max_len: int = 90) -> str:
    phrase = clean_text(text)
    phrase = re.sub(r"[.!?。].*$", "", phrase).strip()
    phrase = re.sub(r"(입니다|합니다|됩니다|한다|된다|이다)\s*$", "", phrase).strip()
    phrase = re.sub(r"\s+", " ", phrase)
    if len(phrase) > max_len:
        phrase = phrase[:max_len].rstrip()
    return phrase


def infer_support_scope(service_category: str, service_subcategory: str | None, text: str) -> str:
    combined = f"{service_category} {service_subcategory or ''} {text}"

    if "스마트공장" in combined or "디지털" in combined or "AI" in combined:
        return "스마트공장 구축과 제조 디지털화 지원"
    if "설비" in combined or "자동화" in combined or "로봇" in combined:
        return "설비 개선과 자동화 도입 관련 지원"
    if "공정" in combined or "생산성" in combined or "품질" in combined:
        return "공정개선과 생산성 향상 관련 지원"
    if "에너지" in combined or "탄소" in combined:
        return "에너지 절감과 고효율 설비 전환 지원"
    if "시험" in combined or "인증" in combined or "신뢰성" in combined:
        return "시험, 인증, 기술자문 등 세부 항목 지원"
    if "R&D" in combined or "기술개발" in combined or "사업화" in combined:
        return "기술개발과 사업화 과제 수행 지원"

    return "공고문 기준 세부 지원 항목 확인 필요"


def build_rule_based_summary(
    item: dict[str, Any],
    title: str,
    original_summary: str,
    service_category: str,
    service_subcategory: str | None,
    deadline_display: str,
) -> str:
    target = first_non_empty(item.get("trgetNm"), "지원 대상은 공식 공고 확인 필요")
    support_area = " / ".join(part for part in [service_category, service_subcategory] if part)

    support_scope = infer_support_scope(
        service_category,
        service_subcategory,
        f"{title} {original_summary}",
    )

    lines = [
        f"{target} 대상",
        f"{support_area or '지원 분야'} 분야 지원",
        support_scope,
        f"{deadline_display or '공식 공고'} 기준 확인 필요",
        "제조 현장 생산성 향상과 경쟁력 강화",
    ]
    return enforce_five_bullet_summary(lines)


def rewrite_summary_to_five_bullets(
    item: dict[str, Any],
    title: str,
    organization: str,
    original_summary: str,
    detail_text: str,
    service_category: str,
    service_subcategory: str | None,
    deadline_display: str,
    use_llm: bool,
) -> str:
    fallback = build_rule_based_summary(
        item=item,
        title=title,
        original_summary=original_summary,
        service_category=service_category,
        service_subcategory=service_subcategory,
        deadline_display=deadline_display,
    )

    if not use_llm or not llm or not HumanMessage or not SystemMessage:
        return fallback

    prompt = f"""
다음 지원사업 정보를 DB summary 컬럼에 저장할 5줄 요약으로 재작성하세요.

규칙:
- 반드시 정확히 5줄만 작성
- 각 줄은 반드시 "- "로 시작
- 각 줄은 명사형으로 끝냄
- 문장 끝 마침표 금지
- "~함", "~음", "~다", "~합니다", "~입니다" 종결 금지
- 명사만 나열하지 말고 필요한 조사로 의미를 연결
- 금액, 조건, 서류 등 불확실한 정보는 추측하지 말고 "확인 필요"로 끝냄
- 없는 내용은 만들지 않음

권장 구성:
1줄: 지원 대상
2줄: 지원 내용
3줄: 지원 규모 또는 지원 범위
4줄: 신청 조건 또는 신청 기간
5줄: 활용 목적 또는 기대 효과

공고명: {title}
기관: {organization}
지원대상: {clean_text(item.get("trgetNm"), 500)}
신청기간 표시: {deadline_display}
분류: {service_category} {service_subcategory or ""}

API 사업개요:
{original_summary[:1800]}

상세페이지 일부:
{detail_text[:1200]}
"""

    try:
        response = llm.invoke(
            [
                SystemMessage(
                    content=(
                        "당신은 정부 지원사업 데이터를 정제하는 편집자입니다. "
                        "출력 형식을 엄격히 지키고, 요약문 외 설명은 쓰지 않습니다."
                    )
                ),
                HumanMessage(content=prompt),
            ]
        )
        lines = normalize_summary_bullets(response.content)
        if len(lines) >= 5:
            return enforce_five_bullet_summary(lines)
    except Exception as exc:
        print(f"  - summary LLM rewrite failed: {exc}")

    return fallback


def parse_iso_date(value: Any, reference_year: int | None = None) -> str | None:
    text = clean_text(value)
    if not text:
        return None

    compact = re.sub(r"\D", "", text)
    if len(compact) >= 8 and compact[:4].startswith("20"):
        try:
            return datetime.strptime(compact[:8], "%Y%m%d").date().isoformat()
        except ValueError:
            pass

    match = re.search(
        r"(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일)?",
        text,
    )
    if match:
        year, month, day = map(int, match.groups())
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None

    if reference_year:
        match = re.search(r"(?<!\d)(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일)?(?!\d)", text)
        if match:
            month, day = map(int, match.groups())
            try:
                return datetime(reference_year, month, day).date().isoformat()
            except ValueError:
                return None

    return None


def extract_all_dates(text: Any, reference_year: int | None = None) -> list[str]:
    source = clean_text(text)
    dates: list[str] = []

    for match in re.finditer(
        r"20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*(?:일)?",
        source,
    ):
        parsed = parse_iso_date(match.group(0))
        if parsed and parsed not in dates:
            dates.append(parsed)

    for match in re.finditer(r"(?<!\d)20\d{6}(?!\d)", source):
        parsed = parse_iso_date(match.group(0))
        if parsed and parsed not in dates:
            dates.append(parsed)

    if reference_year:
        for match in re.finditer(r"(?<!\d)(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일)?(?!\d)", source):
            parsed = parse_iso_date(match.group(0), reference_year=reference_year)
            if parsed and parsed not in dates:
                dates.append(parsed)

    return dates


def infer_reference_year(*values: Any) -> int:
    text = " ".join(clean_text(value) for value in values)
    match = re.search(r"20\d{2}", text)
    if match:
        return int(match.group(0))
    return datetime.now().year


def has_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def extract_label_window(text: str, labels: list[str], window: int = 260) -> str:
    if not text:
        return ""

    best = ""
    for label in labels:
        idx = text.find(label)
        if idx < 0:
            continue
        segment = text[idx : idx + window]
        if not best or len(segment) > len(best):
            best = segment

    return clean_text(best, window)


def normalize_deadline_phrase(text: str) -> tuple[str | None, str | None]:
    normalized = re.sub(r"\s+", "", text)

    if "예산소진" in normalized or "예산소진시" in normalized:
        return "budget_exhaustion", "예산 소진 시"
    if "선착순" in normalized:
        return "first_come", "선착순"
    if "상시모집" in normalized or "상시접수" in normalized or "수시접수" in normalized:
        return "always_open", "상시 모집"
    if "추후공지" in normalized or "추후공고" in normalized or "별도공지" in normalized:
        return "notice_later", "추후 공지"
    if "미정" in normalized or "마감일미정" in normalized:
        return "unknown", "미정"

    return None, None


def parse_deadline(raw_value: Any, reference_year: int | None = None) -> dict[str, Any]:
    raw_text = clean_text(raw_value, 500)
    if not raw_text:
        return {
            "deadline_start_date": None,
            "deadline": None,
            "deadline_type": "unknown",
            "is_early_close_possible": False,
            "deadline_display": "미정",
            "deadline_raw_text": "",
            "deadline_status": "없음",
            "deadline_confidence": "none",
            "deadline_evidence": "신청마감일 근거 확인 불가",
            "date_memo": "API와 상세페이지에서 신청마감일 근거를 찾지 못함",
        }

    phrase_type, phrase_display = normalize_deadline_phrase(raw_text)
    dates = extract_all_dates(raw_text, reference_year=reference_year)
    early_close = "조기" in raw_text or "예산 소진" in raw_text or "예산소진" in raw_text

    if len(dates) >= 2:
        return {
            "deadline_start_date": dates[0],
            "deadline": dates[-1],
            "deadline_type": "fixed_range",
            "is_early_close_possible": early_close,
            "deadline_display": f"{dates[-1]} 마감",
            "deadline_raw_text": raw_text,
            "deadline_status": "조건부" if early_close else "확정",
            "deadline_confidence": "high",
            "deadline_evidence": raw_text,
            "date_memo": "명확한 신청기간 종료일 기준" + (" / 조기마감 가능 문구 포함" if early_close else ""),
        }

    if len(dates) == 1:
        date = dates[0]
        date_is_end = has_any(raw_text, ["까지", "마감", "종료", "접수마감", "신청마감"])

        if phrase_type and not date_is_end:
            return {
                "deadline_start_date": date,
                "deadline": None,
                "deadline_type": phrase_type,
                "is_early_close_possible": early_close or phrase_type in {"budget_exhaustion", "first_come"},
                "deadline_display": phrase_display,
                "deadline_raw_text": raw_text,
                "deadline_status": "조건부",
                "deadline_confidence": "medium",
                "deadline_evidence": raw_text,
                "date_memo": "시작일 또는 안내 날짜만 확인되어 D-day 기준 종료일은 비움",
            }

        return {
            "deadline_start_date": None,
            "deadline": date,
            "deadline_type": "fixed_date",
            "is_early_close_possible": early_close,
            "deadline_display": f"{date} 마감",
            "deadline_raw_text": raw_text,
            "deadline_status": "조건부" if early_close else "확정",
            "deadline_confidence": "medium" if phrase_type else "high",
            "deadline_evidence": raw_text,
            "date_memo": "단일 마감일 기준" + (" / 조기마감 가능 문구 포함" if early_close else ""),
        }

    if phrase_type:
        return {
            "deadline_start_date": None,
            "deadline": None,
            "deadline_type": phrase_type,
            "is_early_close_possible": phrase_type in {"budget_exhaustion", "first_come"},
            "deadline_display": phrase_display,
            "deadline_raw_text": raw_text,
            "deadline_status": "조건부" if phrase_type in {"budget_exhaustion", "first_come"} else "확인 필요",
            "deadline_confidence": "medium",
            "deadline_evidence": raw_text,
            "date_memo": "정확한 종료일 없이 한글 마감 유형만 확인",
        }

    return {
        "deadline_start_date": None,
        "deadline": None,
        "deadline_type": "unknown",
        "is_early_close_possible": False,
        "deadline_display": "미정",
        "deadline_raw_text": raw_text,
        "deadline_status": "확인 필요",
        "deadline_confidence": "low",
        "deadline_evidence": raw_text,
        "date_memo": "날짜 또는 상시/예산소진/미정 문구를 확정하지 못함",
    }


def parse_posted_at(item: dict[str, Any], detail_text: str) -> dict[str, Any]:
    evidence = ""

    for key in POSTED_DATE_KEYS:
        value = item.get(key)
        parsed = parse_iso_date(value)
        if parsed:
            return {
                "posted_at": parsed,
                "posted_date_status": "확정",
                "posted_date_evidence": f"기업마당 API {key}: {clean_text(value)}",
            }

    for key, value in item.items():
        key_lower = str(key).lower()
        if not any(token in key_lower for token in ["regist", "create", "creat", "writ"]):
            continue
        parsed = parse_iso_date(value)
        if parsed:
            return {
                "posted_at": parsed,
                "posted_date_status": "확정",
                "posted_date_evidence": f"기업마당 API {key}: {clean_text(value)}",
            }

    label_window = extract_label_window(detail_text, POSTED_LABELS)
    if label_window:
        evidence = label_window
        parsed = parse_iso_date(label_window)
        if parsed:
            return {
                "posted_at": parsed,
                "posted_date_status": "확정",
                "posted_date_evidence": label_window,
            }

    return {
        "posted_at": None,
        "posted_date_status": "없음",
        "posted_date_evidence": evidence or "기업마당 API와 상세페이지에서 공고등록일 확인 불가",
    }


# -----------------------------------------------------------------------------
# Amount extraction
# -----------------------------------------------------------------------------
AMOUNT_LABELS = [
    "지원금",
    "지원액",
    "지원금액",
    "정부지원금",
    "정부출연금",
    "지원 규모",
    "지원규모",
    "지원 한도",
    "지원한도",
    "지원 내용",
    "지원내용",
    "지원 조건",
    "지원조건",
    "사업 지원",
    "사업지원",
    "보조금",
    "사업비",
    "총 사업비",
    "총사업비",
    "과제비",
    "총 과제비",
    "총과제비",
    "개발비",
    "제작비",
    "소요비용",
    "지원비",
    "국비",
    "도비",
    "시비",
    "군비",
    "지원예산",
    "예산",
    "현금",
    "기업당",
    "과제당",
    "업체당",
    "최대",
    "한도",
]

AMOUNT_CONTEXT_KEYWORDS = [
    "지원",
    "지원금",
    "지원액",
    "정부지원",
    "정부출연",
    "출연금",
    "보조",
    "보조금",
    "국비",
    "도비",
    "시비",
    "군비",
    "사업비",
    "총사업비",
    "총 사업비",
    "지원예산",
    "과제비",
    "개발비",
    "제작비",
    "소요비용",
    "비용",
    "한도",
    "최대",
    "이내",
    "이하",
    "정액",
    "바우처",
    "융자",
    "기업당",
    "과제당",
    "업체당",
]

AMOUNT_EXCLUDE_CONTEXT = [
    "자부담",
    "민간부담",
    "부담금",
    "매출",
    "매출액",
    "납부",
    "수수료",
    "보증금",
    "총예산",
    "총 예산",
    "전체예산",
    "전체 예산",
]


def normalize_policy_category(item: dict[str, Any]) -> tuple[str | None, str | None]:
    """Return Bizinfo source category names for screen badges."""
    category = first_non_empty(
        item.get("pldirSportRealmLclasCodeNm"),
        item.get("sportRealmLclasCodeNm"),
        item.get("lclasNm"),
    )
    subcategory = first_non_empty(
        item.get("pldirSportRealmMlsfcCodeNm"),
        item.get("sportRealmMlsfcCodeNm"),
        item.get("mlsfcNm"),
    )

    # This collector currently requests searchLclasId=02 from Bizinfo.
    if not category and clean_text(item.get("searchLclasId")) == "02":
        category = "기술"

    return category or None, subcategory or None


def amount_source_text(item: dict[str, Any], detail_text: str) -> str:
    priority_keys = [
        "pblancNm",
        "bsnsSumryCn",
        "trgetNm",
        "reqstBeginEndDe",
        "pldirSportRealmLclasCodeNm",
        "pldirSportRealmMlsfcCodeNm",
    ]
    parts = [clean_text(item.get(key), 3000) for key in priority_keys]

    for key, value in item.items():
        if key in priority_keys:
            continue
        text = clean_text(value, 1000)
        if text:
            parts.append(text)

    if detail_text:
        parts.append(clean_text(detail_text, 12000))

    return "\n".join(part for part in parts if part)


def parse_amount_number(raw_number: str, unit: str) -> float:
    number = float(str(raw_number).replace(",", ""))
    normalized_unit = unit.replace(" ", "")

    if normalized_unit in {"억원", "억"}:
        return number * 10000
    if normalized_unit in {"천만원", "천만원"}:
        return number * 1000
    if normalized_unit in {"백만원", "백만원"}:
        return number * 100
    if normalized_unit in {"천원", "천원"}:
        return number / 10
    if normalized_unit in {"만원", "만원"}:
        return number
    if normalized_unit == "원":
        return number / 10000
    return number


def format_amount_manwon(manwon: float) -> str:
    if manwon >= 10000:
        eok = manwon / 10000
        if eok.is_integer():
            return f"최대 {int(eok)}억원"
        return f"최대 {eok:.1f}억원"

    if float(manwon).is_integer():
        return f"최대 {int(manwon):,}만원"
    return f"최대 {manwon:,.1f}만원"


def classify_amount_type(context: str) -> str:
    if "융자" in context:
        return "loan"
    if "바우처" in context:
        return "voucher"
    if "보조" in context or "정부지원" in context or "국비" in context:
        return "subsidy"
    return "support_amount"


def extract_amount_candidates(
    text: str,
    *,
    require_support_context: bool = True,
    source_boost: int = 0,
) -> list[dict[str, Any]]:
    normalized = clean_text(text)
    if not normalized:
        return []

    pattern = re.compile(
        r"(?P<num>\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*"
        r"(?P<unit>억원|억 원|억|천만원|천만 원|백만원|백만 원|만원|만 원|천원|천 원|원)"
    )
    candidates: list[dict[str, Any]] = []

    for match in pattern.finditer(normalized):
        start = max(0, match.start() - 90)
        end = min(len(normalized), match.end() + 120)
        local_start = max(0, match.start() - 35)
        local_end = min(len(normalized), match.end() + 35)
        context = normalized[start:end]
        local_context = normalized[local_start:local_end]
        has_support_context = any(keyword in context for keyword in AMOUNT_CONTEXT_KEYWORDS)
        has_excluded_context = any(keyword in context for keyword in AMOUNT_EXCLUDE_CONTEXT)
        has_local_excluded_context = any(keyword in local_context for keyword in AMOUNT_EXCLUDE_CONTEXT)
        manwon = parse_amount_number(match.group("num"), match.group("unit"))

        if match.group("unit").replace(" ", "") == "원" and manwon < 100:
            continue
        if require_support_context and not has_support_context:
            continue
        if has_local_excluded_context:
            continue
        if has_excluded_context and not any(k in context for k in ["지원", "정부지원", "보조", "국비"]):
            continue

        score = 0
        score = source_boost
        for keyword in ["최대", "한도", "지원금", "지원액", "정부지원", "정부출연", "출연금", "보조금", "국비"]:
            if keyword in context:
                score += 3
        for keyword in ["지원", "사업비", "과제비", "개발비", "제작비", "소요비용", "이내", "이하", "바우처", "융자", "기업당", "과제당"]:
            if keyword in context:
                score += 1

        candidates.append(
            {
                "manwon": manwon,
                "context": clean_text(context, 300),
                "score": score,
                "type": classify_amount_type(context),
            }
        )

    return candidates


def extract_support_ratio_info(text: str) -> dict[str, Any] | None:
    normalized = clean_text(text)
    if not normalized:
        return None

    pattern = re.compile(r"(?:최대|정부지원|지원|국비|보조)?\s*(?P<ratio>\d{1,3}(?:\.\d+)?)\s*%")
    candidates = []
    for match in pattern.finditer(normalized):
        start = max(0, match.start() - 100)
        end = min(len(normalized), match.end() + 140)
        context = normalized[start:end]
        local_context = normalized[max(0, match.start() - 35): min(len(normalized), match.end() + 35)]
        ratio = float(match.group("ratio"))

        if ratio <= 0 or ratio > 100:
            continue
        if not any(keyword in context for keyword in AMOUNT_CONTEXT_KEYWORDS):
            continue
        if any(keyword in local_context for keyword in ["자부담", "민간부담", "부담금", "매출", "수수료"]):
            continue

        score = 0
        for keyword in ["최대", "지원", "정부지원", "국비", "보조", "이내", "한도"]:
            if keyword in context:
                score += 2
        candidates.append({"ratio": ratio, "context": clean_text(context, 300), "score": score})

    if not candidates:
        return None

    best = sorted(candidates, key=lambda row: (row["score"], row["ratio"]), reverse=True)[0]
    ratio = best["ratio"]
    ratio_text = f"{int(ratio)}%" if ratio.is_integer() else f"{ratio:g}%"
    return {
        "max_amount_actual": f"최대 {ratio_text} 지원",
        "max_amount_status": "비율 확인",
        "max_amount_type": "support_ratio",
        "max_amount_numeric_manwon": None,
        "max_amount_evidence": best["context"],
        "max_amount_note": "금액 한도는 미확인, 지원비율 문구만 자동 추출",
    }


def extract_amount_info_with_llm(source: str) -> dict[str, Any] | None:
    if not llm or not HumanMessage or not SystemMessage:
        return None

    prompt = f"""
아래 정부지원사업 원문에서 기업이 받을 수 있는 지원금/지원한도/정부지원금/국비 최대 금액을 추출하세요.

규칙:
- 실제 원문에 금액 근거가 있을 때만 추출하세요.
- 총예산, 전체 사업비, 민간부담금, 자부담, 매출액, 수수료는 지원금으로 보지 마세요.
- 여러 금액이 있으면 기업당/과제당/최대/지원한도/정부지원금에 가장 가까운 금액을 선택하세요.
- 금액 한도가 없고 지원비율만 있으면 actual에 "최대 80% 지원"처럼 쓰고 numeric_manwon은 null로 두세요.
- 금액도 비율도 없으면 status를 "확인 필요"로 두고 numeric_manwon은 null로 두세요.
- JSON 객체 하나만 출력하세요.

출력 형식:
{{
  "status": "확정 또는 확인 필요",
  "actual": "최대 3억원",
  "numeric_manwon": 30000,
  "amount_type": "subsidy 또는 voucher 또는 loan 또는 support_amount 또는 support_ratio 또는 unknown",
  "evidence": "원문에서 금액 근거가 되는 짧은 문구"
}}

원문:
{source[:12000]}
"""

    try:
        response = llm.invoke(
            [
                SystemMessage(
                    content=(
                        "당신은 정부지원사업 지원금 정보를 구조화하는 데이터 검수자입니다. "
                        "원문 근거가 없으면 추측하지 않고 JSON만 출력합니다."
                    )
                ),
                HumanMessage(content=prompt),
            ]
        )
        parsed = extract_json_object(response.content)
        if not parsed:
            return None

        status = clean_text(parsed.get("status")) or "확인 필요"
        actual = clean_text(parsed.get("actual"))
        evidence = clean_text(parsed.get("evidence"), 400)
        amount_type = clean_text(parsed.get("amount_type")) or "unknown"
        numeric = parsed.get("numeric_manwon")

        try:
            numeric_value = float(numeric) if numeric is not None else None
        except (TypeError, ValueError):
            numeric_value = None

        if status != "확정" or not actual:
            return None

        return {
            "max_amount_actual": actual,
            "max_amount_status": "비율 확인" if numeric_value is None and amount_type == "support_ratio" else "확정",
            "max_amount_type": amount_type,
            "max_amount_numeric_manwon": round(numeric_value, 2) if numeric_value is not None else None,
            "max_amount_evidence": evidence or "LLM이 원천 API/상세페이지 원문에서 지원금 문구 추출",
            "max_amount_note": "LLM 원문 근거 기반 지원금 자동 추출",
        }
    except Exception as exc:
        print(f"  - amount LLM extraction failed: {exc}")
        return None


def extract_amount_info(item: dict[str, Any], detail_text: str) -> dict[str, Any]:
    source = amount_source_text(item, detail_text)
    windows = [extract_label_window(source, [label], window=900) for label in AMOUNT_LABELS]
    targeted_text = "\n".join(window for window in windows if window) or source
    candidates = extract_amount_candidates(
        targeted_text,
        require_support_context=False,
        source_boost=2,
    )

    if not candidates and targeted_text != source:
        candidates = extract_amount_candidates(source, require_support_context=True)

    if not candidates:
        ratio_result = extract_support_ratio_info(targeted_text)
        if not ratio_result and targeted_text != source:
            ratio_result = extract_support_ratio_info(source)
        if ratio_result:
            return ratio_result

        llm_result = extract_amount_info_with_llm(source)
        if llm_result:
            return llm_result

        hwp_amount_note = None
        if "HWP/미지원 첨부파일 확인 필요" in source:
            print("  - 지원금 미확인: 금액 정보가 HWP 첨부파일 안에 있을 가능성 있음")
            hwp_amount_note = "HWP 첨부파일 내 금액 정보 확인 필요"

        return {
            "max_amount_actual": "지원금 확인 필요",
            "max_amount_status": "확인 필요",
            "max_amount_type": "unknown",
            "max_amount_numeric_manwon": None,
            "max_amount_evidence": "원천 API와 상세 공고 페이지에서 명확한 지원금 한도 문구를 찾지 못함",
            "max_amount_note": hwp_amount_note or "원천 API와 상세페이지에서 지원금 문구 확인 불가",
        }

    best = sorted(candidates, key=lambda row: (row["score"], row["manwon"]), reverse=True)[0]
    manwon = round(float(best["manwon"]), 2)

    return {
        "max_amount_actual": format_amount_manwon(manwon),
        "max_amount_status": "확정",
        "max_amount_type": best["type"],
        "max_amount_numeric_manwon": manwon,
        "max_amount_evidence": best["context"],
        "max_amount_note": "기업마당 API/상세 공고 페이지 금액 문구 기반 자동 추출",
    }


# -----------------------------------------------------------------------------
# Required document extraction
# -----------------------------------------------------------------------------
DOCUMENT_LABELS = [
    "제출서류",
    "제출 서류",
    "구비서류",
    "구비 서류",
    "신청서류",
    "신청 서류",
    "첨부서류",
    "첨부 서류",
    "필수서류",
    "필수 서류",
    "제출대상 서류",
    "신청 시 제출",
]

DOCUMENT_NAME_RULES = [
    ("사업신청서", ["사업신청서", "신청서", "지원신청서", "참여신청서", "신청양식", "신청 양식"]),
    ("사업계획서", ["사업계획서", "수행계획서", "추진계획서", "개발계획서", "연구개발계획서", "계획서"]),
    ("사업자등록증", ["사업자등록증", "사업자 등록증"]),
    ("법인등기부등본", ["법인등기부등본", "법인 등기부", "등기사항전부증명서"]),
    ("중소기업확인서", ["중소기업확인서", "중소기업 확인서", "중견기업확인서", "중견기업 확인서"]),
    ("기업부설연구소 인정서", ["기업부설연구소", "연구개발전담부서", "연구소 인정서"]),
    ("공장등록증", ["공장등록증", "공장 등록증"]),
    ("국세 납세증명서", ["국세납세증명서", "국세 납세증명서", "국세완납증명서"]),
    ("지방세 납세증명서", ["지방세납세증명서", "지방세 납세증명서", "지방세완납증명서"]),
    ("재무제표", ["재무제표", "표준재무제표", "결산재무제표", "감사보고서"]),
    ("부가가치세과세표준증명원", ["부가가치세과세표준증명원", "부가세과세표준증명", "과세표준증명원"]),
    ("4대보험 가입자명부", ["4대보험", "4대 보험", "가입자명부", "가입자 명부"]),
    ("개인정보 수집·이용 동의서", ["개인정보 수집", "개인정보활용동의서", "개인정보 동의서"]),
    ("참여확약서", ["참여확약서", "확약서", "서약서"]),
    ("신용정보 조회 동의서", ["신용정보조회동의서", "신용정보 조회", "기업신용정보"]),
    ("견적서", ["견적서", "비교견적", "비교 견적"]),
    ("통장사본", ["통장사본", "통장 사본", "계좌사본"]),
    ("지식재산권·인증 증빙", ["특허", "인증서", "지식재산권", "수상실적", "실적증명"]),
    ("발표자료", ["발표자료", "발표 자료", "PPT", "피피티"]),
]

DOCUMENT_NOISE_KEYWORDS = [
    "공고",
    "모집",
    "운영요령",
    "운영 요령",
    "관리지침",
    "관리 지침",
    "안내문",
    "매뉴얼",
    "FAQ",
    "질의응답",
    "바로보기",
    "다운로드",
    "사업설명",
    "설명회",
]

STANDARD_DOCUMENTS = [
    "사업신청서",
    "사업계획서",
    "사업자등록증",
    "중소기업확인서",
    "개인정보 수집·이용 동의서",
    "참여확약서",
    "신용정보 조회 동의서",
]

STANDARD_FINANCE_DOCUMENTS = [
    "재무제표",
    "국세 납세증명서",
    "지방세 납세증명서",
    "부가가치세과세표준증명원",
]

STANDARD_COMPANY_DOCUMENTS = [
    "법인등기부등본",
    "공장등록증",
]


def normalize_doc_name(raw_name: str, matched_keyword: str = "") -> tuple[str, str]:
    source = f"{raw_name} {matched_keyword}"
    text = clean_text(source)
    compact = re.sub(r"\s+", "", text)

    for standard_name, keywords in DOCUMENT_NAME_RULES:
        for keyword in keywords:
            if re.sub(r"\s+", "", keyword) in compact:
                return standard_name, "필수서류"

    return "공식 공고 확인 필요", "확인 필요"


def is_noise_document_name(name: str) -> bool:
    text = clean_text(name)
    compact = re.sub(r"\s+", "", text)
    if not text:
        return True
    if len(text) > 60:
        return True
    return any(re.sub(r"\s+", "", keyword) in compact for keyword in DOCUMENT_NOISE_KEYWORDS)


def make_document_candidate(name: str, *, source: str, evidence: str = "") -> dict[str, Any]:
    normalized_name, category = normalize_doc_name(name, name)
    if normalized_name == "공식 공고 확인 필요":
        normalized_name = name
        category = "표준서류"

    return {
        "name": normalized_name,
        "category": category if category != "확인 필요" else "표준서류",
        "required": True,
        "source": source,
        "evidence": clean_text(evidence, 220) or "정부지원사업 표준 제출서류 체크리스트",
    }


def add_candidate_once(
    candidates: dict[str, dict[str, Any]],
    name: str,
    *,
    source: str,
    evidence: str = "",
) -> None:
    candidate = make_document_candidate(name, source=source, evidence=evidence)
    candidates.setdefault(candidate["name"], candidate)


def infer_standard_document_candidates(item: dict[str, Any], detail_text: str) -> list[dict[str, Any]]:
    text = required_document_source_text(item, detail_text)
    candidates: dict[str, dict[str, Any]] = {}

    for name in STANDARD_DOCUMENTS:
        add_candidate_once(candidates, name, source="standard_checklist", evidence=text[:500])

    if any(keyword in text for keyword in ["중소", "중견", "기업", "법인", "사업자"]):
        for name in STANDARD_COMPANY_DOCUMENTS:
            add_candidate_once(candidates, name, source="standard_checklist", evidence=text[:500])

    if any(keyword in text for keyword in ["R&D", "기술개발", "사업화", "과제", "지원금", "사업비", "보조금"]):
        for name in STANDARD_FINANCE_DOCUMENTS:
            add_candidate_once(candidates, name, source="standard_checklist", evidence=text[:500])

    if any(keyword in text for keyword in ["R&D", "기술개발", "연구개발", "기업부설연구소", "전담부서"]):
        add_candidate_once(candidates, "기업부설연구소 인정서", source="standard_checklist", evidence=text[:500])

    if any(keyword in text for keyword in ["특허", "인증", "지식재산", "수상", "실적", "성과"]):
        add_candidate_once(candidates, "지식재산권·인증 증빙", source="standard_checklist", evidence=text[:500])

    if any(keyword in text for keyword in ["견적", "구축", "설비", "장비", "시스템", "스마트공장", "자동화"]):
        add_candidate_once(candidates, "견적서", source="standard_checklist", evidence=text[:500])

    return list(candidates.values())


def extract_keyword_context(text: str, keyword: str, window: int = 180) -> str:
    idx = text.find(keyword)
    if idx < 0:
        return ""
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(keyword) + window // 2)
    return clean_text(text[start:end], window)


def required_document_source_text(item: dict[str, Any], detail_text: str) -> str:
    priority_keys = [
        "pblancNm",
        "bsnsSumryCn",
        "trgetNm",
        "reqstBeginEndDe",
        "pldirSportRealmLclasCodeNm",
        "pldirSportRealmMlsfcCodeNm",
    ]
    parts = [clean_text(item.get(key), 3000) for key in priority_keys]

    for key, value in item.items():
        if key in priority_keys:
            continue
        text = clean_text(value, 1000)
        if text:
            parts.append(text)

    if detail_text:
        parts.append(clean_text(detail_text, 15000))

    return "\n".join(part for part in parts if part)


def extract_required_document_candidates(item: dict[str, Any], detail_text: str) -> list[dict[str, Any]]:
    source = required_document_source_text(item, detail_text)
    if not source:
        return []

    windows = [extract_label_window(source, [label], window=1400) for label in DOCUMENT_LABELS]
    target_text = "\n".join(window for window in windows if window) or source

    candidates: dict[str, dict[str, Any]] = {}

    for standard_name, keywords in DOCUMENT_NAME_RULES:
        for keyword in keywords:
            context = extract_keyword_context(target_text, keyword)
            if not context:
                continue
            add_candidate_once(
                candidates,
                standard_name,
                source="detail_page",
                evidence=context,
            )
            break

    attachment_pattern = re.compile(
        r"([가-힣A-Za-z0-9_()\[\]·ㆍ\-\s]{2,80}\.(?:hwp|hwpx|pdf|docx?|xlsx?))",
        re.IGNORECASE,
    )
    for match in attachment_pattern.finditer(target_text):
        raw_name = clean_text(match.group(1), 100)
        if is_noise_document_name(raw_name):
            continue
        normalized_name, category = normalize_doc_name(raw_name, raw_name)
        if normalized_name == "공식 공고 확인 필요" or category == "확인 필요":
            continue
        add_candidate_once(
            candidates,
            normalized_name,
            source="attachment_name",
            evidence=extract_keyword_context(target_text, raw_name) or raw_name,
        )

    standard_candidates = infer_standard_document_candidates(item, detail_text)
    if len(candidates) < 5:
        for doc in standard_candidates:
            candidates.setdefault(doc["name"], doc)

    return list(candidates.values())


def extract_json_object(text: str) -> dict[str, Any] | None:
    raw = str(text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return None

    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def fallback_required_documents(candidates: list[dict[str, Any]], error_message: str = "") -> dict[str, Any]:
    if not candidates:
        return {
            "required_documents_text": "공식 공고 확인 필요",
            "required_documents": [],
            "overall_status": "확인 필요",
            "memo": error_message or "원천 API와 상세페이지에서 제출서류 후보를 찾지 못함",
        }

    docs = candidates[:12]
    has_standard_docs = any(doc.get("source") == "standard_checklist" for doc in docs)
    return {
        "required_documents_text": ", ".join(doc["name"] for doc in docs),
        "required_documents": [
            {
                "name": doc["name"],
                "category": doc.get("category") or "필수서류",
                "required": bool(doc.get("required", True)),
            }
            for doc in docs
        ],
        "overall_status": "표준 체크리스트" if has_standard_docs else "후보 추출",
        "memo": error_message or (
            "상세 공고 명시 서류가 부족해 정부지원사업 표준 제출서류 체크리스트를 함께 적용"
            if has_standard_docs
            else "원천 API/상세페이지 문구 기반 자동 후보 추출"
        ),
    }


def refine_required_documents_with_llm(
    item: dict[str, Any],
    detail_text: str,
    candidates: list[dict[str, Any]],
    *,
    use_llm: bool,
) -> dict[str, Any]:
    if not candidates:
        return fallback_required_documents(candidates)

    if not use_llm or not llm or not HumanMessage or not SystemMessage:
        return fallback_required_documents(candidates)

    title = clean_text(item.get("pblancNm"))
    allowed_names = {doc["name"] for doc in candidates}
    has_standard_docs = any(doc.get("source") == "standard_checklist" for doc in candidates)
    compact_candidates = [
        {
            "name": doc["name"],
            "category": doc.get("category"),
            "source": doc.get("source"),
            "evidence": clean_text(doc.get("evidence"), 220),
        }
        for doc in candidates[:40]
    ]

    prompt = f"""
아래 지원사업의 제출서류 후보를 최종 정제하세요.

규칙:
- 후보 목록에 없는 서류를 새로 만들지 마세요.
- 확인 필요, unknown, 빈 값은 제외하세요.
- 같은 뜻의 서류는 표준 서류명 하나로 통일하세요.
- source가 standard_checklist인 서류는 공고에 직접 명시된 확정 서류가 아니라 표준 체크리스트입니다.
- 결과는 JSON 객체 하나만 출력하세요.

출력 형식:
{{
  "required_documents_text": "사업신청서, 사업자등록증",
  "required_documents": [
    {{"name": "사업신청서", "category": "필수서류", "required": true}}
  ],
  "overall_status": "확정 또는 후보 추출 또는 확인 필요",
  "memo": "짧은 판단 근거"
}}

공고명: {title}
후보 목록:
{json.dumps(compact_candidates, ensure_ascii=False)}
"""

    try:
        response = llm.invoke(
            [
                SystemMessage(
                    content=(
                        "당신은 정부지원사업 제출서류 데이터를 정제하는 검수자입니다. "
                        "후보에 없는 서류를 만들지 않고 JSON만 출력합니다."
                    )
                ),
                HumanMessage(content=prompt),
            ]
        )
        parsed = extract_json_object(response.content)
        if not parsed:
            return fallback_required_documents(candidates, "LLM 응답 JSON 파싱 실패")

        refined_docs = []
        for doc in parsed.get("required_documents") or []:
            if not isinstance(doc, dict):
                continue
            name, category = normalize_doc_name(doc.get("name", ""), "")
            if name not in allowed_names:
                continue
            refined_docs.append(
                {
                    "name": name,
                    "category": category if category != "확인 필요" else doc.get("category") or "필수서류",
                    "required": bool(doc.get("required", True)),
                }
            )

        if not refined_docs:
            return fallback_required_documents(candidates, "LLM 결과에 유효한 후보 서류가 없음")

        return {
            "required_documents_text": ", ".join(doc["name"] for doc in refined_docs),
            "required_documents": refined_docs,
            "overall_status": "표준 체크리스트" if has_standard_docs else (parsed.get("overall_status") or "확정"),
            "memo": clean_text(parsed.get("memo"), 300) or "LLM 제출서류 후보 정제 완료",
        }
    except Exception as exc:
        return fallback_required_documents(candidates, f"LLM 제출서류 정제 실패: {exc}")


# -----------------------------------------------------------------------------
# Bizinfo API and detail page
# -----------------------------------------------------------------------------
def fetch_bizinfo(page_index: int, page_unit: int, search_lclas_id: str) -> list[dict[str, Any]]:
    url = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"
    params = {
        "crtfcKey": BIZINFO_API_KEY,
        "dataType": "json",
        "searchCnt": page_unit,
        "pageUnit": page_unit,
        "pageIndex": page_index,
        "searchLclasId": search_lclas_id,
    }

    response = requests.get(url, params=params, headers=HEADERS, timeout=30)
    category_name = BIZINFO_SEARCH_LCLAS_NAMES.get(search_lclas_id, search_lclas_id)
    print(f"[기업마당 API] category={search_lclas_id}({category_name}) page={page_index} status={response.status_code}")
    response.raise_for_status()

    data = response.json()
    if "reqErr" in data:
        raise RuntimeError(f"기업마당 API 오류: {data['reqErr']}")

    return data.get("jsonArray", []) or []


def build_detail_url(item: dict[str, Any]) -> str:
    url = clean_text(item.get("pblancUrl"))
    if url:
        return url

    policy_id = clean_text(item.get("pblancId"))
    if not policy_id:
        return ""

    return f"https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId={policy_id}"


def filename_from_response(url: str, response: requests.Response) -> str:
    disposition = response.headers.get("content-disposition") or response.headers.get("Content-Disposition") or ""
    match = re.search(r"filename\*=UTF-8''([^;]+)", disposition, flags=re.IGNORECASE)
    if match:
        return unquote(match.group(1).strip().strip('"'))

    match = re.search(r'filename="?([^";]+)"?', disposition, flags=re.IGNORECASE)
    if match:
        return unquote(match.group(1).strip().strip('"'))

    path = urlparse(url).path
    return unquote(Path(path).name) or "attachment"


def extension_from_filename(filename: str, content_type: str = "") -> str:
    ext = Path(filename.split("?")[0]).suffix.lower()
    if ext:
        return ext

    content_type = content_type.lower()
    if "pdf" in content_type:
        return ".pdf"
    if "spreadsheet" in content_type or "excel" in content_type:
        return ".xlsx"
    if "wordprocessingml" in content_type:
        return ".docx"
    return ""


def xml_bytes_to_text(raw: bytes) -> str:
    try:
        root = ElementTree.fromstring(raw)
    except ElementTree.ParseError:
        return clean_html(raw.decode("utf-8", errors="ignore"))

    parts = []
    for text in root.itertext():
        cleaned = clean_text(text)
        if cleaned:
            parts.append(cleaned)
    return clean_text(" ".join(parts))


def extract_text_from_zip_xml(data: bytes, wanted_paths: list[str]) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            parts = []
            for name in archive.namelist():
                normalized = name.replace("\\", "/")
                if not any(normalized.startswith(path) or normalized == path for path in wanted_paths):
                    continue
                try:
                    raw = archive.read(name)
                    if normalized.lower().endswith(".xml"):
                        parts.append(xml_bytes_to_text(raw))
                    elif normalized.lower().endswith(".txt"):
                        parts.append(clean_html(raw.decode("utf-8", errors="ignore")))
                except Exception:
                    continue
    except zipfile.BadZipFile:
        return ""

    return clean_text("\n".join(part for part in parts if part), 20000)


def extract_pdf_text(data: bytes) -> str:
    for module_name in ["pypdf", "PyPDF2"]:
        try:
            module = __import__(module_name)
            reader = module.PdfReader(io.BytesIO(data))
            pages = []
            for page in reader.pages[:30]:
                pages.append(page.extract_text() or "")
            return clean_text("\n".join(pages), 20000)
        except Exception:
            continue
    return ""


def extract_attachment_text(data: bytes, ext: str) -> str:
    if ext == ".pdf":
        return extract_pdf_text(data)
    if ext == ".hwpx":
        return extract_text_from_zip_xml(data, ["Contents/", "Preview/PrvText.txt"])
    if ext == ".docx":
        return extract_text_from_zip_xml(data, ["word/document.xml", "word/header", "word/footer"])
    if ext == ".xlsx":
        return extract_text_from_zip_xml(data, ["xl/sharedStrings.xml", "xl/worksheets/"])
    return ""


def is_probable_attachment_url(url: str) -> bool:
    lowered = unquote(url).lower()
    if any(ext in lowered for ext in [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx"]):
        return True
    return any(token in lowered for token in ["download", "file", "atch", "attach", "첨부"])


def extract_attachment_links(html: str, base_url: str) -> list[str]:
    links: list[str] = []
    seen = set()

    candidates = []
    candidates.extend(re.findall(r"""(?:href|src)\s*=\s*["']([^"']+)["']""", html, flags=re.IGNORECASE))
    candidates.extend(
        re.findall(
            r"""["']([^"']+\.(?:pdf|hwp|hwpx|docx?|xlsx?)(?:\?[^"']*)?)["']""",
            html,
            flags=re.IGNORECASE,
        )
    )

    for candidate in candidates:
        if candidate.startswith(("javascript:", "#", "mailto:")):
            continue
        absolute = urljoin(base_url, candidate)
        if not is_probable_attachment_url(absolute):
            continue
        if absolute in seen:
            continue
        seen.add(absolute)
        links.append(absolute)

    return links[:MAX_ATTACHMENTS_PER_POLICY]


def fetch_attachment_texts(detail_html: str, detail_url: str) -> str:
    links = extract_attachment_links(detail_html, detail_url)
    if not links:
        return ""

    blocks = []
    unsupported = []

    for index, link in enumerate(links, start=1):
        try:
            response = requests.get(link, headers=HEADERS, timeout=45)
            response.raise_for_status()
            data = response.content or b""
            filename = filename_from_response(link, response)
            ext = extension_from_filename(filename, response.headers.get("content-type", ""))

            if len(data) > MAX_ATTACHMENT_BYTES:
                unsupported.append(f"{filename} ({ext or 'unknown'}, 용량 초과)")
                continue

            if ext in UNSUPPORTED_ATTACHMENT_EXTENSIONS:
                unsupported.append(f"{filename} ({link})")
                continue

            if ext not in SUPPORTED_ATTACHMENT_EXTENSIONS:
                continue

            text = extract_attachment_text(data, ext)
            if not text:
                unsupported.append(f"{filename} ({ext}, 본문 추출 실패)")
                continue

            blocks.append(
                f"[첨부파일 본문 {index}: {filename}]\n"
                f"{clean_text(text, 12000)}"
            )
        except Exception as exc:
            unsupported.append(f"{link} (다운로드 실패: {exc})")

    if unsupported:
        blocks.append(
            "[HWP/미지원 첨부파일 확인 필요]\n"
            + "\n".join(f"- {item}" for item in unsupported[:10])
        )

    if blocks:
        print(f"  - 첨부파일 텍스트 반영: {len(blocks)} block(s), link={len(links)}")
    return "\n\n".join(blocks)


def fetch_detail_text(url: str) -> str:
    if not url:
        return ""

    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        detail_html = response.text
        detail_text = clean_html(detail_html)
        attachment_text = fetch_attachment_texts(detail_html, url)
        return "\n\n".join(part for part in [detail_text, attachment_text] if part)
    except Exception as exc:
        print(f"  - 상세페이지 조회 실패: {exc}")
        return ""


# -----------------------------------------------------------------------------
# Policy normalization
# -----------------------------------------------------------------------------
def fetch_attachment_content(detail_html: str, detail_url: str) -> dict[str, Any]:
    links = extract_attachment_links(detail_html, detail_url)
    blocks: list[str] = []
    files: list[dict[str, Any]] = []
    unsupported: list[str] = []

    for index, link in enumerate(links, start=1):
        file_meta: dict[str, Any] = {
            "url": link,
            "filename": "",
            "extension": "",
            "content_type": "",
            "extraction_status": "pending",
        }
        try:
            response = requests.get(link, headers=HEADERS, timeout=45)
            response.raise_for_status()
            data = response.content or b""
            content_type = response.headers.get("content-type", "")
            filename = filename_from_response(link, response)
            ext = extension_from_filename(filename, content_type)
            file_meta.update({
                "filename": filename,
                "extension": ext,
                "content_type": content_type,
                "size_bytes": len(data),
            })

            if len(data) > MAX_ATTACHMENT_BYTES:
                file_meta["extraction_status"] = "skipped_too_large"
                unsupported.append(f"{filename} ({ext or 'unknown'}, too large)")
            elif ext in UNSUPPORTED_ATTACHMENT_EXTENSIONS:
                file_meta["extraction_status"] = "unsupported_hwp"
                unsupported.append(f"{filename} ({link})")
            elif ext not in SUPPORTED_ATTACHMENT_EXTENSIONS:
                file_meta["extraction_status"] = "unsupported_extension"
            else:
                text = extract_attachment_text(data, ext)
                if text:
                    file_meta["extraction_status"] = "extracted"
                    file_meta["text_length"] = len(text)
                    blocks.append(
                        f"[attachment_text {index}: {filename}]\n"
                        f"{clean_text(text, 12000)}"
                    )
                else:
                    file_meta["extraction_status"] = "extract_failed"
                    unsupported.append(f"{filename} ({ext}, extract failed)")
        except Exception as exc:
            file_meta["extraction_status"] = "download_failed"
            file_meta["error_message"] = str(exc)
            unsupported.append(f"{link} (download failed: {exc})")
        files.append(file_meta)

    if unsupported:
        blocks.append(
            "[HWP/unsupported attachment check required]\n"
            + "\n".join(f"- {item}" for item in unsupported[:10])
        )

    if blocks:
        print(f"  - attachment text captured: {len(blocks)} block(s), link={len(links)}")

    return {
        "attachment_text": "\n\n".join(blocks),
        "attachment_files": files,
    }


def fetch_detail_content(url: str) -> dict[str, Any]:
    if not url:
        return {
            "detail_text": "",
            "attachment_text": "",
            "attachment_files": [],
            "combined_text": "",
        }

    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        detail_html = response.text
        detail_text = clean_html(detail_html)
        attachment = fetch_attachment_content(detail_html, url)
        attachment_text = attachment.get("attachment_text") or ""
        combined_text = "\n\n".join(part for part in [detail_text, attachment_text] if part)
        return {
            "detail_text": detail_text,
            "attachment_text": attachment_text,
            "attachment_files": attachment.get("attachment_files") or [],
            "combined_text": combined_text,
        }
    except Exception as exc:
        print(f"  - detail page fetch failed: {exc}")
        return {
            "detail_text": "",
            "attachment_text": "",
            "attachment_files": [],
            "combined_text": "",
            "error_message": str(exc),
        }


def split_hashtags(raw: Any) -> list[str]:
    return [tag.strip() for tag in clean_text(raw).split(",") if tag.strip()]


def infer_industry_codes(text: str) -> list[str]:
    codes: set[str] = set()
    for keyword, mapped_codes in INDUSTRY_CODE_MAP.items():
        if keyword in text:
            codes.update(mapped_codes)
    return sorted(codes)


def extract_region(text: str, title: str = "", organization: str = "") -> str | None:
    bracket_match = re.match(r"^\s*\[([^\]]+)\]", title or "")
    if bracket_match:
        bracket_text = bracket_match.group(1)
        for region in REGIONS:
            if region in bracket_text:
                return region

    for region in REGIONS:
        if region in (organization or ""):
            return region

    for region in REGIONS:
        if region in (text or ""):
            return region
    return None


def classify_support_method_rule_based(text: str) -> list[str]:
    return [
        category
        for category, keywords in SUPPORT_METHOD_KEYWORDS.items()
        if any(keyword in text for keyword in keywords)
    ]


def extract_support_method_with_llm(source: str) -> list[str] | None:
    if not llm or not HumanMessage or not SystemMessage:
        return None

    prompt = f"""
아래 정부지원사업 원문을 읽고, 이 공고가 실제로 제공하는 지원방식을 아래 9개 중에서 모두 골라주세요(해당 없으면 빈 배열).

카테고리: 현금지원, 공동장비, 컨설팅멘토링, 기술개발, 시험인증, 교육, 판로수출, 에너지효율, 스마트공장

규칙:
- 원문에 근거가 있는 카테고리만 선택하세요.
- 여러 개 해당되면 전부 포함하세요.
- JSON 객체 하나만 출력하세요.

출력 형식:
{{"support_method": ["현금지원", "기술개발"]}}

원문:
{source[:8000]}
"""
    try:
        response = llm.invoke(
            [
                SystemMessage(
                    content=(
                        "당신은 정부지원사업 지원방식을 분류하는 데이터 검수자입니다. "
                        "원문 근거가 없으면 빈 배열로 두고 JSON만 출력합니다."
                    )
                ),
                HumanMessage(content=prompt),
            ]
        )
        parsed = extract_json_object(response.content)
        if not parsed:
            return None
        result = parsed.get("support_method")
        if not isinstance(result, list):
            return None
        return [category for category in result if category in SUPPORT_METHOD_KEYWORDS]
    except Exception as exc:
        print(f"  - support_method LLM extraction failed: {exc}")
        return None


def extract_support_method(search_text: str, use_llm: bool = True) -> list[str]:
    matched = classify_support_method_rule_based(search_text)
    if matched:
        return matched
    if use_llm:
        llm_result = extract_support_method_with_llm(search_text[:8000])
        if llm_result:
            return llm_result
    return []


def classify_service_category(text: str) -> tuple[str, str | None]:
    if any(k in text for k in ["스마트공장", "스마트제조", "제조데이터", "제조AI", "AI융합"]):
        return "스마트공장", "제조 디지털화"
    if any(k in text for k in ["제조로봇", "로봇자동화", "로봇", "자동화"]):
        return "설비/자동화", "로봇·자동화"
    if any(k in text for k in ["공정개선", "공정", "생산성", "제품고급화", "품질개선"]):
        return "공정개선", "생산성·품질개선"
    if any(k in text for k in ["에너지효율", "고효율", "탄소중립", "온실가스", "에너지절감", "에너지"]):
        return "에너지효율", "탄소중립·효율화"
    if any(k in text for k in ["시험", "인증", "신뢰성", "성능평가", "검증"]):
        return "시험/인증", "성능·신뢰성"
    if any(k in text for k in ["R&D", "기술개발", "공동기술개발", "시제품", "실증", "사업화"]):
        return "R&D/사업화", "기술개발·실증"
    if any(k in text for k in ["설비", "장비", "기자재"]):
        return "설비/장비", "장비도입·활용"
    if any(k in text for k in ["제조", "금속", "플라스틱", "사출", "프레스", "CNC", "기계", "부품", "소부장", "뿌리"]):
        return "제조지원", "제조업 일반"
    return "기술지원", None


def calculate_relevance_score(row: dict[str, Any]) -> int:
    text = " ".join(
        [
            clean_text(row.get("title")),
            clean_text(row.get("summary")),
            clean_text(row.get("policy_category")),
            clean_text(row.get("policy_subcategory")),
            clean_text(row.get("service_category")),
            clean_text(row.get("service_subcategory")),
            clean_text(row.get("region")),
            " ".join(row.get("industry_codes") or []),
            " ".join(row.get("hashtags") or []),
        ]
    )

    score = 0
    for keyword in MANUFACTURING_KEYWORDS:
        if keyword in text:
            score += 2
    for keyword in EXCLUDE_KEYWORDS:
        if keyword in text:
            score -= 5
    return score


def has_capex_keyword(title: str, body: str) -> bool:
    text = f"{title} {body}"
    return any(keyword in text for keyword in CAPEX_KEYWORDS)


def has_manufacturing_industry_code(industry_codes: list[str]) -> bool:
    return any(str(code).startswith("C") for code in industry_codes or [])


def get_best_deadline(item: dict[str, Any], detail_text: str, reference_year: int) -> dict[str, Any]:
    api_period = clean_text(item.get("reqstBeginEndDe"))
    detail_period = extract_label_window(detail_text, DEADLINE_LABELS)

    api_result = parse_deadline(api_period, reference_year=reference_year)
    detail_result = parse_deadline(detail_period, reference_year=reference_year)

    # Prefer detail page when it gives a real end date and API does not.
    if detail_result.get("deadline") and not api_result.get("deadline"):
        return detail_result

    # Prefer detail page when API has only an unknown/empty value.
    if api_result.get("deadline_type") == "unknown" and detail_result.get("deadline_type") != "unknown":
        return detail_result

    # Otherwise keep the structured API period because it is usually cleaner.
    return api_result


def correct_deadline_with_posted_at(deadline: dict[str, Any], posted_at: str | None) -> dict[str, Any]:
    if not posted_at or not deadline.get("deadline"):
        return deadline

    try:
        posted_date = datetime.strptime(posted_at, "%Y-%m-%d").date()
        deadline_date = datetime.strptime(str(deadline["deadline"]), "%Y-%m-%d").date()
    except ValueError:
        return deadline

    if deadline_date >= posted_date:
        return deadline

    raw_text = clean_text(deadline.get("deadline_raw_text"))
    phrase_type, phrase_display = normalize_deadline_phrase(raw_text)

    if not phrase_type:
        deadline["deadline_status"] = "확인 필요"
        deadline["deadline_confidence"] = "low"
        deadline["date_memo"] = (
            clean_text(deadline.get("date_memo"))
            + " / 마감일이 공고등록일보다 과거라 검토 필요"
        ).strip(" /")
        return deadline

    deadline.update(
        {
            "deadline_start_date": None,
            "deadline": None,
            "deadline_type": phrase_type,
            "is_early_close_possible": phrase_type in {"budget_exhaustion", "first_come"},
            "deadline_display": phrase_display,
            "deadline_status": "조건부" if phrase_type in {"budget_exhaustion", "first_come"} else "확인 필요",
            "deadline_confidence": "medium",
            "deadline_evidence": raw_text,
            "date_memo": (
                "상세페이지의 다른 날짜가 공고등록일보다 과거라 마감일에서 제외하고 "
                f"'{phrase_display}' 문구를 우선 적용"
            ),
        }
    )
    return deadline


def build_source_fields(item: dict[str, Any], detail_text: str) -> dict[str, Any] | None:
    policy_id = clean_text(item.get("pblancId"))
    if not policy_id:
        return None

    title = clean_text(item.get("pblancNm"))
    organization = clean_text(item.get("jrsdInsttNm") or item.get("excInsttNm")) or "기관 미상"
    summary = clean_text(item.get("bsnsSumryCn"), max_len=4000)
    reference_year = infer_reference_year(
        title,
        summary,
        item.get("reqstBeginEndDe"),
        item.get("pblancRegistDt"),
        detail_text[:2000],
    )
    posted = parse_posted_at(item, detail_text)
    deadline = get_best_deadline(item, detail_text, reference_year=reference_year)
    deadline = correct_deadline_with_posted_at(deadline, posted.get("posted_at"))

    return {
        "source_name": "bizinfo",
        "policy_id": policy_id,
        "title": title,
        "organization": organization,
        "url": build_detail_url(item),
        "posted_at": posted.get("posted_at"),
        "posted_date_status": posted.get("posted_date_status"),
        "deadline_start_date": deadline.get("deadline_start_date"),
        "deadline": deadline.get("deadline"),
        "deadline_type": deadline.get("deadline_type"),
        "deadline_display": deadline.get("deadline_display"),
        "deadline_status": deadline.get("deadline_status"),
        "is_early_close_possible": deadline.get("is_early_close_possible"),
        "_original_summary": summary,
    }


def build_raw_content_fields(
    item: dict[str, Any],
    detail_content: dict[str, Any] | str,
) -> dict[str, Any]:
    if isinstance(detail_content, dict):
        detail_text = clean_text(detail_content.get("detail_text"), 30000)
        attachment_text = clean_text(detail_content.get("attachment_text"), 30000)
        attachment_files = detail_content.get("attachment_files") or []
        combined_text = clean_text(detail_content.get("combined_text"), 50000)
        error_message = clean_text(detail_content.get("error_message"))
    else:
        detail_text = clean_text(detail_content, 30000)
        attachment_text = ""
        attachment_files = []
        combined_text = detail_text
        error_message = ""

    api_text = " ".join(
        clean_text(item.get(key), 4000)
        for key in [
            "pblancNm",
            "bsnsSumryCn",
            "trgetNm",
            "pldirSportRealmLclasCodeNm",
            "pldirSportRealmMlsfcCodeNm",
            "reqstBeginEndDe",
            "hashtags",
            "hashTags",
        ]
        if clean_text(item.get(key))
    )
    raw_text = clean_text("\n\n".join(part for part in [api_text, combined_text] if part), 60000)

    return {
        "source_api_json": item,
        "detail_text": detail_text,
        "attachment_text": attachment_text,
        "attachment_files": attachment_files,
        "raw_text": raw_text,
        "_combined_text": combined_text,
        "_detail_error_message": error_message,
    }


def build_service_fields(
    item: dict[str, Any],
    raw_fields: dict[str, Any],
    source_fields: dict[str, Any],
    use_llm: bool = True,
) -> dict[str, Any]:
    summary = clean_text(source_fields.get("_original_summary"), 4000)
    hashtags_raw = clean_text(item.get("hashtags") or item.get("hashTags"))
    hashtags = split_hashtags(hashtags_raw)
    search_text = " ".join(
        [
            clean_text(source_fields.get("title")),
            summary,
            hashtags_raw,
            clean_text(item.get("trgetNm")),
            clean_text(item.get("pldirSportRealmLclasCodeNm")),
            clean_text(item.get("pldirSportRealmMlsfcCodeNm")),
            clean_text(raw_fields.get("raw_text"), 5000),
        ]
    )
    industry_codes = infer_industry_codes(search_text)
    region = extract_region(
        search_text,
        title=clean_text(source_fields.get("title")),
        organization=clean_text(source_fields.get("organization")),
    )
    policy_category, policy_subcategory = normalize_policy_category(item)
    service_category, service_subcategory = classify_service_category(search_text)
    support_method = extract_support_method(search_text, use_llm=use_llm)
    relevance_score = calculate_relevance_score({
        "title": source_fields.get("title"),
        "summary": summary,
        "policy_category": policy_category,
        "policy_subcategory": policy_subcategory,
        "service_category": service_category,
        "service_subcategory": service_subcategory,
        "region": region,
        "industry_codes": industry_codes,
        "hashtags": hashtags,
    })
    capex = has_capex_keyword(clean_text(source_fields.get("title")), search_text)
    manufacturing = has_manufacturing_industry_code(industry_codes)

    return {
        "policy_category": policy_category,
        "policy_subcategory": policy_subcategory,
        "service_category": service_category,
        "service_subcategory": service_subcategory,
        "support_method": support_method,
        "industry_codes": industry_codes,
        "region": region,
        "hashtags": hashtags,
        "relevance_score": relevance_score,
        "has_capex_keyword": capex,
        "has_manufacturing_code": manufacturing,
        "is_selected": True,
        "selected_reason": (
            f"relevance_score={relevance_score}; "
            f"has_capex_keyword={capex}; has_manufacturing_code={manufacturing}"
        ),
    }


def build_extraction_fields(
    item: dict[str, Any],
    raw_fields: dict[str, Any],
    source_fields: dict[str, Any],
    service_fields: dict[str, Any],
    use_llm_summary: bool = True,
) -> dict[str, Any]:
    detail_text = clean_text(raw_fields.get("raw_text"), 60000)
    summary = clean_text(source_fields.get("_original_summary"), 4000)
    amount_info = extract_amount_info(item, detail_text)
    required_doc_candidates = extract_required_document_candidates(item, detail_text)
    required_docs = refine_required_documents_with_llm(
        item,
        detail_text,
        required_doc_candidates,
        use_llm=use_llm_summary,
    )
    summary_for_db = rewrite_summary_to_five_bullets(
        item=item,
        title=clean_text(source_fields.get("title")),
        organization=clean_text(source_fields.get("organization")),
        original_summary=summary,
        detail_text=detail_text,
        service_category=clean_text(service_fields.get("service_category")),
        service_subcategory=clean_text(service_fields.get("service_subcategory")),
        deadline_display=clean_text(source_fields.get("deadline_display")),
        use_llm=use_llm_summary,
    )

    return {
        "summary": normalize_summary_for_storage(summary_for_db),
        "required_documents": required_docs.get("required_documents_text"),
        "required_documents_json": required_docs.get("required_documents"),
        "required_documents_status": required_docs.get("overall_status"),
        "required_documents_count": len(required_docs.get("required_documents") or []),
        "max_amount_actual": amount_info.get("max_amount_actual"),
        "max_amount_status": amount_info.get("max_amount_status"),
        "max_amount_type": amount_info.get("max_amount_type"),
        "max_amount_numeric_manwon": amount_info.get("max_amount_numeric_manwon"),
        "max_amount_evidence": amount_info.get("max_amount_evidence"),
        "max_amount_note": amount_info.get("max_amount_note"),
        "employee_min": None,
        "employee_max": None,
        "revenue_min_manwon": None,
        "revenue_max_manwon": None,
        "company_age_min": None,
        "company_age_max": None,
        "eligible_company_types": None,
        "eligibility_text": clean_text(item.get("trgetNm") or detail_text[:1200], 4000),
        "eligibility_evidence": clean_text(item.get("trgetNm") or "", 1200),
        "eligibility_extraction_status": "needs_review",
    }


def build_meta_fields(
    raw_fields: dict[str, Any],
    extraction_fields: dict[str, Any],
) -> dict[str, Any]:
    now = datetime.utcnow().isoformat()
    error_message = clean_text(raw_fields.get("_detail_error_message"))
    amount_status = clean_text(extraction_fields.get("max_amount_status"))
    required_count = int(extraction_fields.get("required_documents_count") or 0)
    extraction_status = "success"
    if error_message or amount_status == "확인 필요" or required_count == 0:
        extraction_status = "partial"

    return {
        "collection_status": "collected",
        "extraction_status": extraction_status,
        "error_message": error_message or None,
        "collected_at": now,
        "updated_at": now,
    }


def build_payload(
    item: dict[str, Any],
    detail_content: dict[str, Any] | str,
    use_llm_summary: bool = True,
) -> dict[str, Any] | None:
    detail_text = (
        clean_text(detail_content.get("combined_text"), 50000)
        if isinstance(detail_content, dict)
        else clean_text(detail_content, 50000)
    )
    source_fields = build_source_fields(item, detail_text)
    if not source_fields:
        return None

    raw_fields = build_raw_content_fields(item, detail_content)
    service_fields = build_service_fields(
        item,
        raw_fields,
        source_fields,
        use_llm=use_llm_summary,
    )
    extraction_fields = build_extraction_fields(
        item,
        raw_fields,
        source_fields,
        service_fields,
        use_llm_summary=use_llm_summary,
    )
    meta_fields = build_meta_fields(raw_fields, extraction_fields)
    payload = {
        **source_fields,
        **raw_fields,
        **extraction_fields,
        **service_fields,
        **meta_fields,
    }
    payload.pop("_original_summary", None)
    payload.pop("_combined_text", None)
    payload.pop("_detail_error_message", None)
    payload["_filter_context"] = {
        "relevance_score": payload.get("relevance_score"),
        "industry_codes": payload.get("industry_codes"),
        "has_capex_keyword": payload.get("has_capex_keyword"),
        "has_manufacturing_code": payload.get("has_manufacturing_code"),
    }
    return payload


def is_service_candidate(payload: dict[str, Any], min_score: int) -> bool:
    context = payload.get("_filter_context") or {}
    return (
        context.get("has_capex_keyword")
        and context.get("has_manufacturing_code")
        and int(context.get("relevance_score") or 0) >= min_score
    )


def apply_selection_fields(payload: dict[str, Any], include_all: bool, min_score: int) -> None:
    context = payload.get("_filter_context") or {}
    selected = True if include_all else is_service_candidate(payload, min_score)
    payload["is_selected"] = selected
    if include_all:
        payload["selected_reason"] = "include_all=true; collected without service-candidate filtering"
        return

    payload["selected_reason"] = (
        f"relevance_score={context.get('relevance_score')}; "
        f"has_capex_keyword={context.get('has_capex_keyword')}; "
        f"has_manufacturing_code={context.get('has_manufacturing_code')}; "
        f"min_score={min_score}; "
        f"selected={selected}"
    )


def strip_internal_fields(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if not key.startswith("_")}


def parse_search_lclas_ids(raw: str) -> list[str]:
    ids = [part.strip() for part in (raw or "").split(",") if part.strip()]
    return ids or ["01", "02", "03", "07", "09"]


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------
def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Collect Bizinfo policies from the source API/detail pages and upsert "
            "date-normalized rows into policy_validation_new. CSV files are never used."
        )
    )
    parser.add_argument("--target-table", default=TARGET_TABLE)
    parser.add_argument("--page-unit", type=int, default=DEFAULT_PAGE_UNIT)
    parser.add_argument("--max-pages", type=int, default=DEFAULT_MAX_PAGES)
    parser.add_argument("--max-policies", type=int, default=DEFAULT_MAX_POLICIES, help="0 means all")
    parser.add_argument(
        "--search-lclas-ids",
        default=DEFAULT_SEARCH_LCLAS_IDS,
        help="Comma-separated Bizinfo large category ids to collect. Default: 01,02,03,07,09",
    )
    parser.add_argument("--dry-run", type=int, choices=[0, 1], default=1 if DEFAULT_DRY_RUN else 0)
    parser.add_argument(
        "--mode",
        choices=["all", "dates"],
        default="all",
        help="Backward-compatible no-op. This script always collects source API dates.",
    )
    parser.add_argument("--sleep", type=float, default=DEFAULT_SLEEP_SECONDS)
    parser.add_argument("--min-score", type=int, default=4)
    parser.add_argument(
        "--include-all",
        action="store_true",
        help="Mark every collected row as selected. Rows are still collected even without this flag.",
    )
    parser.add_argument("--no-detail", action="store_true", help="Skip detail page fetch and use API response only.")
    parser.add_argument(
        "--no-llm-summary",
        action="store_true",
        help="Use deterministic 5-line summary fallback without LLM rewriting.",
    )
    parser.add_argument(
        "--llm-model",
        default=DATA_LLM_MODEL,
        help="OpenRouter model id for summary/document cleanup. Default: google/gemini-2.5-flash",
    )
    return parser.parse_args()


def main() -> None:
    global llm
    args = resolve_args()
    if args.target_table != TARGET_TABLE:
        raise ValueError(
            "target table override is disabled. "
            f"Expected {TARGET_TABLE}, got {args.target_table}"
        )

    dry_run = bool(args.dry_run)
    llm = create_data_llm(args.llm_model)

    supabase: Client | None = None
    if not dry_run:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    print(f"Target table: {args.target_table}")
    print(f"DRY_RUN: {dry_run}")
    print(f"MAX_PAGES: {args.max_pages}")
    print(f"PAGE_UNIT: {args.page_unit}")
    print(f"MAX_POLICIES: {args.max_policies} (0 means all)")
    search_lclas_ids = parse_search_lclas_ids(args.search_lclas_ids)
    print(
        "SEARCH_LCLAS_IDS: "
        + ", ".join(
            f"{category_id}({BIZINFO_SEARCH_LCLAS_NAMES.get(category_id, category_id)})"
            for category_id in search_lclas_ids
        )
    )
    print(f"DETAIL_FETCH: {not args.no_detail}")
    print(f"LLM_MODEL: {args.llm_model}")
    print(f"LLM_SUMMARY: {bool(llm) and not args.no_llm_summary}")
    print("CSV input: disabled")

    seen_policy_ids: set[str] = set()
    total_raw = 0
    total_collected = 0
    total_selected = 0
    success_count = 0
    fail_count = 0
    preview_count = 0

    stop_collecting = False
    for search_lclas_id in search_lclas_ids:
        if stop_collecting:
            break

        category_name = BIZINFO_SEARCH_LCLAS_NAMES.get(search_lclas_id, search_lclas_id)
        for page_index in range(1, args.max_pages + 1):
            print("\n" + "=" * 80)
            print(
                f"[수집] 기업마당 category={search_lclas_id}({category_name}) "
                f"page={page_index}/{args.max_pages}"
            )

            try:
                items = fetch_bizinfo(
                    page_index=page_index,
                    page_unit=args.page_unit,
                    search_lclas_id=search_lclas_id,
                )
            except Exception as exc:
                print(f"  [ERROR] API page fetch failed: {exc}")
                continue

            total_raw += len(items)
            print(f"  - API rows: {len(items)}")

            if not items:
                break

            for item in items:
                policy_id = clean_text(item.get("pblancId"))
                if not policy_id or policy_id in seen_policy_ids:
                    continue
                seen_policy_ids.add(policy_id)

                if args.max_policies > 0 and total_collected >= args.max_policies:
                    stop_collecting = True
                    break

                try:
                    detail_url = build_detail_url(item)
                    detail_content = (
                        {
                            "detail_text": "",
                            "attachment_text": "",
                            "attachment_files": [],
                            "combined_text": "",
                        }
                        if args.no_detail
                        else fetch_detail_content(detail_url)
                    )
                    payload = build_payload(
                        item,
                        detail_content,
                        use_llm_summary=not args.no_llm_summary,
                    )

                    if not payload:
                        continue

                    apply_selection_fields(payload, include_all=args.include_all, min_score=args.min_score)

                    total_collected += 1
                    if payload.get("is_selected"):
                        total_selected += 1
                    context = payload.get("_filter_context") or {}
                    clean_payload = strip_internal_fields(payload)

                    print(
                        f"  [{total_collected}] {policy_id} | "
                        f"category={search_lclas_id}({category_name}) | "
                        f"selected={clean_payload.get('is_selected')} | "
                        f"posted={clean_payload.get('posted_at') or '-'} | "
                        f"deadline={clean_payload.get('deadline') or clean_payload.get('deadline_display') or '-'} | "
                        f"score={context.get('relevance_score')}"
                    )

                    if dry_run:
                        preview_count += 1
                        preview_payload = {
                            k: v
                            for k, v in clean_payload.items()
                            if k not in ("source_api_json", "detail_text", "attachment_text", "raw_text")
                        }
                        preview_payload["_raw_lengths"] = {
                            "detail_text": len(clean_payload.get("detail_text") or ""),
                            "attachment_text": len(clean_payload.get("attachment_text") or ""),
                            "raw_text": len(clean_payload.get("raw_text") or ""),
                        }
                        print(json.dumps(preview_payload, ensure_ascii=False, indent=2))
                    else:
                        assert supabase is not None
                        supabase.table(args.target_table).upsert(
                            clean_payload,
                            on_conflict="policy_id",
                        ).execute()
                        success_count += 1

                    time.sleep(args.sleep)

                except Exception as exc:
                    fail_count += 1
                    print(f"  [ERROR] {policy_id}: {exc}")

            if stop_collecting:
                break

    print("\n" + "=" * 80)
    print("Done")
    print(f"Raw API rows: {total_raw}")
    print(f"Collected rows: {total_collected}")
    print(f"Selected rows: {total_selected}")
    print(f"Previewed: {preview_count}")
    print(f"Upserted: {success_count}")
    print(f"Failed: {fail_count}")


if __name__ == "__main__":
    main()

