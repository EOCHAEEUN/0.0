"""
Enrich policy eligibility fields in Supabase.

Run:
    python data/scripts/enrich_policy_eligibility.py
    python data/scripts/enrich_policy_eligibility.py --self-check

Useful env vars:
    ELIGIBILITY_LIMIT=100
    ELIGIBILITY_DRY_RUN=1
    ELIGIBILITY_USE_LLM=1
    ELIGIBILITY_SLEEP_SECONDS=0.2

Required policy columns:
    employee_min, employee_max,
    revenue_min_manwon, revenue_max_manwon,
    company_age_min, company_age_max,
    eligible_company_types,
    eligibility_text,
    eligibility_extraction_status,
    eligibility_evidence
"""

from __future__ import annotations

import json
import os
import re
import time
from html import unescape
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

try:
    from supabase import Client, create_client
    _SUPABASE_AVAILABLE = True
except ImportError:
    _SUPABASE_AVAILABLE = False
    Client = None  # type: ignore[assignment,misc]
    create_client = None  # type: ignore[assignment]

try:
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover - optional dependency at runtime
    ChatOpenAI = None


SCHEMA_SQL = """
alter table policy
add column if not exists employee_min integer,
add column if not exists employee_max integer,
add column if not exists revenue_min_manwon integer,
add column if not exists revenue_max_manwon integer,
add column if not exists company_age_min integer,
add column if not exists company_age_max integer,
add column if not exists eligible_company_types text[],
add column if not exists eligibility_text text,
add column if not exists eligibility_extraction_status text,
add column if not exists eligibility_evidence text;
"""


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
DATA_LLM_MODEL = os.getenv(
    "DATA_LLM_MODEL",
    "nvidia/nemotron-3-super-120b-a12b:free",
).strip()

LIMIT = int(os.getenv("ELIGIBILITY_LIMIT", "100"))
DRY_RUN = os.getenv("ELIGIBILITY_DRY_RUN", "0").strip() == "1"
USE_LLM = os.getenv("ELIGIBILITY_USE_LLM", "1").strip() != "0"
SLEEP_SECONDS = float(os.getenv("ELIGIBILITY_SLEEP_SECONDS", "0.2"))
FORCE_RECHECK = os.getenv("ELIGIBILITY_FORCE_RECHECK", "0").strip() == "1"


# ── Lazy-init singletons ─────────────────────────────────
# Supabase/LLM 연결은 실제로 필요할 때(fetch_policies/update_policy/extract_with_llm)만 생성.
# --self-check 실행 시에는 생성되지 않으므로 .env 없이도 동작.

_supabase_client: "Client | None" = None
_llm_instance: Any = None
_llm_initialized: bool = False


def get_supabase() -> "Client":
    global _supabase_client
    if _supabase_client is None:
        if not _SUPABASE_AVAILABLE:
            raise RuntimeError("supabase package is not installed. Run: pip install supabase")
        if not SUPABASE_URL:
            raise ValueError("SUPABASE_URL is missing. Check .env or backend/.env.")
        if not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing.")
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client


def get_llm() -> Any:
    global _llm_instance, _llm_initialized
    if not _llm_initialized:
        _llm_initialized = True
        if USE_LLM and OPENROUTER_API_KEY and ChatOpenAI:
            _llm_instance = ChatOpenAI(
                model=DATA_LLM_MODEL,
                openai_api_key=OPENROUTER_API_KEY,
                openai_api_base="https://openrouter.ai/api/v1",
                temperature=0,
            )
    return _llm_instance


ELIGIBILITY_SECTION_KEYWORDS = [
    "지원대상",
    "신청대상",
    "지원 대상",
    "신청 대상",
    "신청자격",
    "신청 자격",
    "자격요건",
    "자격 요건",
    "지원자격",
    "지원 자격",
    "대상기업",
    "대상 기업",
    "지원조건",
    "지원 조건",
    "신청요건",
    "신청 요건",
    "참여대상",
    "참여 대상",
    "모집대상",
    "모집 대상",
    "제외대상",
    "제외 대상",
]

COMPANY_TYPE_KEYWORDS = [
    "중소기업",
    "중견기업",
    "소기업",
    "소상공인",
    "소공인",
    "창업기업",
    "스타트업",
    "벤처기업",
    "제조기업",
    "제조업",
    "뿌리기업",
    "법인사업자",
    "개인사업자",
    "여성기업",
    "사회적기업",
    "장애인기업",
    "수출기업",
]

# 숫자 조건 힌트 키워드: 매출/직원수/업력 관련 표현
NUMERIC_CONDITION_HINT_KEYWORDS = [
    "매출", "매출액", "연매출", "매출규모", "평균매출액", "연간매출액",
    "근로자", "상시근로자", "직원", "종업원", "고용인원",
    "창업", "업력", "설립", "사업개시", "법인설립",
]

# 매출 관련 evidence 우선순위 키워드
REVENUE_EVIDENCE_KEYWORDS = [
    "매출", "매출액", "연매출", "매출규모", "평균매출액", "연간매출액",
]

# 매출 조건으로 오인할 수 있는 노이즈 컨텍스트
_REVENUE_NOISE_CONTEXTS = [
    "수출실적", "수출액", "지원금액", "지원 금액", "보조금", "국비",
    "총사업비", "사업비", "참가비", "수수료", "투자금",
]


# =========================================================
# 텍스트 정리
# =========================================================

def clean_html(value: str) -> str:
    if not value:
        return ""

    text = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return clean_text(text)


def clean_text(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).replace("\x00", " ")
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def raw_json_to_text(value: Any) -> str:
    parts: list[str] = []

    def walk(item: Any) -> None:
        if item is None:
            return
        if isinstance(item, dict):
            for key, nested in item.items():
                if isinstance(nested, (dict, list)):
                    walk(nested)
                else:
                    parts.append(f"{key}: {nested}")
            return
        if isinstance(item, list):
            for nested in item:
                walk(nested)
            return
        parts.append(str(item))

    walk(value)
    return clean_html(" ".join(parts))


def split_sentences(text: str) -> list[str]:
    text = clean_text(text)
    if not text:
        return []

    normalized = re.sub(r"([.!?。])\s+", r"\1\n", text)
    normalized = re.sub(r"(다\.|요\.|음\.)\s+", r"\1\n", normalized)
    parts = re.split(r"[\n\r]+|[•·○●▶▷■□]", normalized)
    return [part.strip() for part in parts if len(part.strip()) >= 4]


def build_policy_text(policy: dict[str, Any]) -> str:
    raw_json = policy.get("raw_json")
    raw_json_text = raw_json_to_text(raw_json)

    chunks = [
        policy.get("title") or "",
        policy.get("summary") or "",
        policy.get("raw_text") or "",
        raw_json_text,
    ]
    return clean_html("\n".join(str(chunk) for chunk in chunks if chunk))


def extract_candidate_sections(text: str, radius: int = 4) -> list[str]:
    sentences = split_sentences(text)
    if not sentences:
        return []

    sections: list[str] = []
    seen = set()

    for index, sentence in enumerate(sentences):
        if not any(keyword in sentence for keyword in ELIGIBILITY_SECTION_KEYWORDS):
            continue

        start = max(0, index - 1)
        end = min(len(sentences), index + radius + 1)
        section = clean_text(" ".join(sentences[start:end]))
        if section and section not in seen:
            seen.add(section)
            sections.append(section)

    if sections:
        return sections[:6]

    # Fallback: keep text windows around common company type keywords.
    for index, sentence in enumerate(sentences):
        if not any(keyword in sentence for keyword in COMPANY_TYPE_KEYWORDS):
            continue
        start = max(0, index - 1)
        end = min(len(sentences), index + 3)
        section = clean_text(" ".join(sentences[start:end]))
        if section and section not in seen:
            seen.add(section)
            sections.append(section)

    return sections[:6]


# =========================================================
# 숫자 / 단위 변환
# =========================================================

def parse_korean_number(value: str) -> float:
    return float(value.replace(",", "").strip())


def money_to_manwon(value: float, unit: str) -> int:
    unit = unit.replace(" ", "")
    if "조" in unit:
        return int(value * 100_000_000)
    if "억" in unit:
        return int(value * 10_000)
    if "천만" in unit:
        return int(value * 1_000)
    if "백만" in unit:
        return int(value * 100)
    if "만원" in unit:
        return int(value)
    if unit == "원":
        return int(value / 10_000)
    return int(value)


def set_bound(current: int | None, value: int, bound: str) -> int:
    if current is None:
        return value
    # min → 가장 큰 값 유지 (가장 까다로운 하한), max → 가장 작은 값 유지 (가장 까다로운 상한)
    return min(current, value) if bound == "max" else max(current, value)


# =========================================================
# 추출 함수
# =========================================================

def extract_employee_bounds(text: str) -> tuple[int | None, int | None]:
    employee_min: int | None = None
    employee_max: int | None = None

    patterns = [
        (r"(?:상시\s*)?(?:근로자|종업원|직원|고용인원|인력)\s*(?:수)?\s*(\d+)\s*(?:명|인)\s*(?:이상|초과)", "min"),
        (r"(?:상시\s*)?(?:근로자|종업원|직원|고용인원|인력)\s*(?:수)?\s*(\d+)\s*(?:명|인)\s*(?:이하|미만|이내)", "max"),
        (r"(\d+)\s*(?:명|인)\s*(?:이상|초과)\s*(?:의)?\s*(?:근로자|종업원|직원)", "min"),
        (r"(\d+)\s*(?:명|인)\s*(?:이하|미만|이내)\s*(?:의)?\s*(?:근로자|종업원|직원)", "max"),
        # "5인 이상", "50인 미만" — 선행 주어 없는 단독 인(人) 표기
        (r"(\d+)\s*인\s*(?:이상|초과)", "min"),
        (r"(\d+)\s*인\s*(?:이하|미만|이내)", "max"),
    ]

    for pattern, bound in patterns:
        for match in re.finditer(pattern, text):
            value = int(match.group(1).replace(",", ""))
            if bound == "min":
                employee_min = set_bound(employee_min, value, "min")
            else:
                employee_max = set_bound(employee_max, value, "max")

    range_patterns = [
        r"(\d+)\s*(?:명|인)\s*(?:이상|초과)\s*(\d+)\s*(?:명|인)\s*(?:이하|미만|이내)",
        r"(\d+)\s*~\s*(\d+)\s*(?:명|인)",
    ]
    for pattern in range_patterns:
        for match in re.finditer(pattern, text):
            low = int(match.group(1).replace(",", ""))
            high = int(match.group(2).replace(",", ""))
            employee_min = set_bound(employee_min, low, "min")
            employee_max = set_bound(employee_max, high, "max")

    return employee_min, employee_max


def extract_revenue_bounds(text: str) -> tuple[int | None, int | None]:
    """
    매출 조건을 추출해 (min_manwon, max_manwon) 반환.

    처리 대상 예시:
    - "최근년도 매출액 50억원 이상"              → (500000, None)
    - "최근년도 매출액 20억원 이상"              → (200000, None)
    - "직전년도 매출규모 100억원 미만"           → (None, 1000000)
    - "평균매출액 또는 연간매출액이 1,200억원 이하" → (None, 12000000)
    - "직전년도(2025년) 매출액이 20억원 이상"    → (200000, None)
    - "기업당 최대 지원금 1,000만원"             → (None, None)

    설계 원칙:
    - subject와 amount 사이에 [^0-9０-９]{0,40}? (숫자를 먹지 않는 non-greedy) 사용
    - 노이즈 컨텍스트(수출실적, 지원금 등)는 앞 30자로 필터링
    - 여러 조건이 있으면 min은 가장 큰 값, max는 가장 작은 값 유지
    """
    revenue_min: int | None = None
    revenue_max: int | None = None

    # 매출 관련 주어 표현 (우선순위 순서로 나열)
    subject = (
        r"(?:"
        r"연\s*간\s*매출액?|"                                              # 연간매출액, 연간 매출액
        r"연\s*매출액?|"                                                    # 연매출액, 연 매출액
        r"평균\s*매출액?|"                                                  # 평균매출액, 평균 매출액
        r"최근\s*\d+\s*년\s*(?:간\s*)?(?:평균\s*)?매출액?|"               # 최근 3년 평균 매출액
        r"최근\s*년도\s*매출(?:액|규모)?|"                                  # 최근년도 매출액, 최근년도 매출규모
        r"직전\s*년도\s*(?:\(\s*\d{4}\s*년\s*\))?\s*매출(?:액|규모)?|"    # 직전년도(2025년) 매출액
        r"전\s*년도\s*매출(?:액|규모)?|"                                    # 전년도 매출액
        r"매출(?:액|규모)?"                                                 # 매출액, 매출규모, 매출
        r")"
    )
    amount = r"(\d[\d,]*(?:\.\d+)?)\s*(조원|억원|억|천만원|천만|백만원|백만|만원|원)"
    bound_min = r"(?:이상|초과)"
    bound_max = r"(?:이하|미만|이내)"

    # 숫자를 먹지 않는 구간: non-greedy, 0~40자, 숫자 제외
    gap = r"[^0-9０-９]{0,40}?"

    patterns = [
        (rf"{subject}{gap}{amount}\s*{bound_min}", "min"),   # subject → amount 이상
        (rf"{subject}{gap}{amount}\s*{bound_max}", "max"),   # subject → amount 이하
        (rf"{amount}\s*{bound_min}{gap}{subject}", "min"),   # amount 이상 → subject (역순)
        (rf"{amount}\s*{bound_max}{gap}{subject}", "max"),   # amount 이하 → subject (역순)
    ]

    for pattern, bound in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            # 노이즈 필터: 매치 앞 30자에 노이즈 키워드가 있으면 스킵
            ctx_before = text[max(0, match.start() - 30):match.start()]
            if any(noise in ctx_before for noise in _REVENUE_NOISE_CONTEXTS):
                continue

            groups = match.groups()
            # 숫자로 시작하는 첫 그룹 = 금액 숫자부
            number_group = next((g for g in groups if g and re.match(r"^\d", g)), None)
            if not number_group:
                continue
            number_index = groups.index(number_group)
            unit = groups[number_index + 1] if number_index + 1 < len(groups) else "만원"
            value = money_to_manwon(parse_korean_number(number_group), unit)

            if value <= 0:
                continue

            if bound == "min":
                revenue_min = set_bound(revenue_min, value, "min")
            else:
                revenue_max = set_bound(revenue_max, value, "max")

    return revenue_min, revenue_max


def extract_company_age_bounds(text: str) -> tuple[int | None, int | None]:
    age_min: int | None = None
    age_max: int | None = None

    patterns = [
        (r"(?:창업|업력|설립|사업개시|법인설립)[^.。;\n]{0,20}?(\d+)\s*년\s*(?:이상|초과)", "min"),
        (r"(?:창업|업력|설립|사업개시|법인설립)[^.。;\n]{0,20}?(\d+)\s*년\s*(?:이하|미만|이내)", "max"),
        (r"(\d+)\s*년\s*(?:이상|초과)[^.。;\n]{0,20}?(?:창업|업력|설립|사업개시)", "min"),
        (r"(\d+)\s*년\s*(?:이하|미만|이내)[^.。;\n]{0,20}?(?:창업|업력|설립|사업개시)", "max"),
    ]

    for pattern, bound in patterns:
        for match in re.finditer(pattern, text):
            value = int(match.group(1))
            if bound == "min":
                age_min = set_bound(age_min, value, "min")
            else:
                age_max = set_bound(age_max, value, "max")

    return age_min, age_max


def extract_company_types(text: str) -> list[str]:
    found = []
    for keyword in COMPANY_TYPE_KEYWORDS:
        if keyword in text and keyword not in found:
            found.append(keyword)
    return found


def has_condition_hint(text: str) -> bool:
    """원문에 매출/직원수/업력 숫자 조건 힌트(키워드 + 근방 숫자+단위)가 있으면 True."""
    unit_pattern = re.compile(r"\d+\s*(?:명|인|년|억원?|천만원?|백만원?|만원|원)")
    for keyword in NUMERIC_CONDITION_HINT_KEYWORDS:
        if keyword not in text:
            continue
        for m in re.finditer(re.escape(keyword), text):
            ctx = text[max(0, m.start() - 20):min(len(text), m.end() + 80)]
            if unit_pattern.search(ctx):
                return True
    return False


def find_best_evidence(sections: list[str]) -> str:
    if not sections:
        return ""

    scored = []
    for section in sections:
        score = 0
        score += sum(3 for keyword in ELIGIBILITY_SECTION_KEYWORDS if keyword in section)
        score += sum(1 for keyword in COMPANY_TYPE_KEYWORDS if keyword in section)
        # 매출 조건 문장 우선순위 상향
        score += sum(4 for keyword in REVENUE_EVIDENCE_KEYWORDS if keyword in section)
        score += 2 if re.search(r"\d+\s*(명|인|년|억|만원|원)", section) else 0
        scored.append((score, len(section), section))

    scored.sort(reverse=True)
    return scored[0][2][:1200]


def merge_bounds(*values: int | None, bound: str) -> int | None:
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return min(cleaned) if bound == "max" else max(cleaned)


# =========================================================
# Regex + LLM 결과 merge
# =========================================================

def merge_regex_llm(regex: dict[str, Any], llm_res: dict[str, Any]) -> dict[str, Any]:
    """LLM 결과로 regex의 NULL 값만 채우고, eligible_company_types는 합집합."""
    merged = dict(regex)
    numeric_keys = [
        "employee_min", "employee_max",
        "revenue_min_manwon", "revenue_max_manwon",
        "company_age_min", "company_age_max",
    ]
    for k in numeric_keys:
        if merged.get(k) is None and llm_res.get(k) is not None:
            merged[k] = llm_res[k]

    # eligible_company_types: 합집합, 순서 유지, 중복 제거
    seen: set[str] = set()
    combined: list[str] = []
    for t in (regex.get("eligible_company_types") or []) + (llm_res.get("eligible_company_types") or []):
        if t and t not in seen:
            seen.add(t)
            combined.append(t)
    merged["eligible_company_types"] = combined

    # evidence: LLM이 더 길면 LLM 사용
    regex_ev = regex.get("eligibility_evidence") or ""
    llm_ev = llm_res.get("eligibility_evidence") or ""
    if len(llm_ev) > len(regex_ev):
        merged["eligibility_evidence"] = llm_ev

    # eligibility_text: LLM 요약 우선
    if llm_res.get("eligibility_text"):
        merged["eligibility_text"] = llm_res["eligibility_text"]

    has_numeric = any(merged.get(k) is not None for k in numeric_keys)
    merged["has_numeric_condition"] = has_numeric
    merged["has_data"] = has_numeric or bool(merged["eligible_company_types"] or merged.get("eligibility_text"))
    return merged


# =========================================================
# Regex 추출
# =========================================================

def extract_with_regex(text: str) -> dict[str, Any]:
    sections = extract_candidate_sections(text)
    target = clean_text("\n".join(sections)) if sections else clean_text(text[:5000])

    emp_min, emp_max = extract_employee_bounds(target)
    rev_min, rev_max = extract_revenue_bounds(target)
    age_min, age_max = extract_company_age_bounds(target)
    company_types = extract_company_types(target)
    evidence = find_best_evidence(sections) or target[:1200]

    numeric_values = [emp_min, emp_max, rev_min, rev_max, age_min, age_max]
    has_numeric_condition = any(v is not None for v in numeric_values)
    has_data = has_numeric_condition or bool(company_types)

    return {
        "employee_min": emp_min,
        "employee_max": emp_max,
        "revenue_min_manwon": rev_min,
        "revenue_max_manwon": rev_max,
        "company_age_min": age_min,
        "company_age_max": age_max,
        "eligible_company_types": company_types,
        "eligibility_text": evidence if has_data else "",
        "eligibility_evidence": evidence if has_data else "",
        "has_data": has_data,
        "has_numeric_condition": has_numeric_condition,
    }


# =========================================================
# LLM 추출
# =========================================================

def build_llm_prompt(title: str, text: str) -> str:
    return f"""당신은 정부 지원사업 공고의 지원자격 조건을 구조화하는 데이터 추출가입니다.

아래 공고 제목과 지원자격 후보 문장에서 신청 가능한 기업 조건을 추출하세요.

[제목]
{title}

[지원자격 후보 문장]
{text[:3500]}

규칙:
1. 직원 수 조건은 명확한 경우에만 employee_min / employee_max에 숫자로 넣으세요.
2. 매출 조건은 만원 단위 정수로 revenue_min_manwon / revenue_max_manwon에 넣으세요.
   단위 변환 예시:
   - 20억원 이상  → revenue_min_manwon = 200000
   - 50억원 이상  → revenue_min_manwon = 500000
   - 100억원 미만 → revenue_max_manwon = 1000000
   - 1,200억원 이하 → revenue_max_manwon = 12000000
   주의: 지원금액, 사업비, 보조금, 수출실적은 매출 조건이 아닙니다.
3. 업력/창업연수 조건은 company_age_min / company_age_max에 년 단위 숫자로 넣으세요.
4. 중소기업, 소공인, 소상공인, 제조업, 창업기업 같은 기업유형은 eligible_company_types 배열에 넣으세요.
5. 조건이 명확하지 않으면 null 또는 빈 배열을 사용하세요.
6. 반드시 아래 JSON 형식으로만 답변하세요.

{{
  "employee_min": null,
  "employee_max": null,
  "revenue_min_manwon": null,
  "revenue_max_manwon": null,
  "company_age_min": null,
  "company_age_max": null,
  "eligible_company_types": [],
  "eligibility_text": "지원자격 요약",
  "eligibility_evidence": "원문 근거 문장"
}}
"""


def normalize_llm_payload(data: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    integer_keys = [
        "employee_min",
        "employee_max",
        "revenue_min_manwon",
        "revenue_max_manwon",
        "company_age_min",
        "company_age_max",
    ]

    for key in integer_keys:
        value = data.get(key)
        if value in ("", "null", "None", None):
            result[key] = None
            continue
        try:
            result[key] = int(float(str(value).replace(",", "")))
        except Exception:
            result[key] = None

    types = data.get("eligible_company_types") or []
    if isinstance(types, str):
        types = [item.strip() for item in re.split(r"[,/]", types) if item.strip()]
    result["eligible_company_types"] = [
        str(item).strip() for item in types if str(item).strip()
    ]
    result["eligibility_text"] = clean_text(data.get("eligibility_text") or "")
    result["eligibility_evidence"] = clean_text(data.get("eligibility_evidence") or "")

    has_numeric = any(result.get(k) is not None for k in integer_keys)
    result["has_numeric_condition"] = has_numeric
    result["has_data"] = has_numeric or bool(result["eligible_company_types"] or result["eligibility_text"])
    return result


def extract_with_llm(title: str, text: str) -> dict[str, Any] | None:
    llm = get_llm()
    if not llm:
        return None

    sections = extract_candidate_sections(text)
    target = "\n\n".join(sections) if sections else text[:3500]
    if len(target) < 50:
        return None

    try:
        response = llm.invoke(build_llm_prompt(title, target))
        raw = response.content.strip()
        print(f"  -> LLM response: {raw[:180]!r}")
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return None
        return normalize_llm_payload(json.loads(match.group()))
    except Exception as exc:
        print(f"  -> LLM extraction failed: {type(exc).__name__}: {exc}")
        return None


# =========================================================
# Supabase 조회 / 업데이트
# =========================================================

def fetch_policies(limit: int = LIMIT) -> list[dict[str, Any]]:
    sb = get_supabase()
    query = (
        sb.table("policy")
        .select(
            "policy_id,title,summary,raw_text,raw_json,"
            "employee_min,employee_max,revenue_min_manwon,revenue_max_manwon,"
            "company_age_min,company_age_max,eligible_company_types,"
            "eligibility_text,eligibility_extraction_status,eligibility_evidence"
        )
        .limit(limit)
    )
    if not FORCE_RECHECK:
        # 기본 필터: 미처리, 실패, 재검토 필요, revenue 0 값 포함
        query = query.or_(
            'eligibility_extraction_status.is.null,'
            'eligibility_extraction_status.in.("pending","failed","needs_review"),'
            "revenue_min_manwon.eq.0,"
            "revenue_max_manwon.eq.0"
        )
    # FORCE_RECHECK=1 이면 필터 없이 전체 limit 범위 재처리
    return (query.execute()).data or []


def _zero_to_none(value: int | None) -> int | None:
    return None if value == 0 else value


def build_update_payload(extracted: dict[str, Any], status: str) -> dict[str, Any]:
    evidence = extracted.get("eligibility_evidence") or None
    payload = {
        "employee_min": extracted.get("employee_min"),
        "employee_max": extracted.get("employee_max"),
        "revenue_min_manwon": _zero_to_none(extracted.get("revenue_min_manwon")),
        "revenue_max_manwon": _zero_to_none(extracted.get("revenue_max_manwon")),
        "company_age_min": extracted.get("company_age_min"),
        "company_age_max": extracted.get("company_age_max"),
        "eligible_company_types": extracted.get("eligible_company_types") or [],
        "eligibility_text": extracted.get("eligibility_text") or None,
        "eligibility_evidence": evidence[:1000] if evidence else None,
        "eligibility_extraction_status": status,
    }
    return payload


def update_policy(policy_id: str, payload: dict[str, Any]) -> None:
    if DRY_RUN:
        print(f"  -> DRY RUN update payload: {json.dumps(payload, ensure_ascii=False)}")
        return

    get_supabase().table("policy").update(payload).eq("policy_id", policy_id).execute()


def _determine_status(has_numeric: bool, has_types: bool, has_hint: bool) -> str:
    """
    - structured_extracted : 직원수/매출/업력 숫자 조건 1개 이상 추출
    - type_only_extracted   : 기업유형만 추출 (숫자 조건 없음)
    - needs_review          : 숫자 조건 힌트는 있는데 구조화 실패
    """
    if has_numeric:
        return "structured_extracted"
    if has_types:
        return "type_only_extracted"
    if has_hint:
        return "needs_review"
    return "type_only_extracted"


# =========================================================
# 한 건 처리
# =========================================================

def enrich_one(policy: dict[str, Any]) -> bool:
    policy_id = policy.get("policy_id") or ""
    title = policy.get("title") or ""
    text = build_policy_text(policy)

    print("\n" + "=" * 80)
    print(f"[policy] {policy_id}")
    print(title)

    if not policy_id:
        print("  -> skipped: missing policy_id")
        return False

    if not text or len(text) < 30:
        payload = build_update_payload({}, "not_found")
        payload["eligibility_text"] = None
        payload["eligibility_evidence"] = "No usable text in summary/raw_text/raw_json."
        update_policy(policy_id, payload)
        print("  -> not_found: no usable text")
        return False

    regex_result = extract_with_regex(text)
    has_numeric = regex_result.get("has_numeric_condition", False)
    has_types = bool(regex_result.get("eligible_company_types"))
    hint = has_condition_hint(text)

    # 숫자 조건 추출 성공 → 바로 저장
    if has_numeric:
        payload = build_update_payload(regex_result, "structured_extracted")
        update_policy(policy_id, payload)
        print("  -> structured_extracted by regex")
        return True

    # 기업유형만 있고 숫자 힌트도 없음 → LLM 없이 저장
    if has_types and not hint:
        payload = build_update_payload(regex_result, "type_only_extracted")
        update_policy(policy_id, payload)
        print("  -> type_only_extracted (no numeric hint)")
        return True

    # 숫자 힌트 있거나 데이터 없음 → LLM 보완 시도
    llm_result = extract_with_llm(title, text)

    if llm_result is not None:
        # regex에서 기업유형을 잡은 경우 merge, 아니면 LLM 단독 사용
        merged = merge_regex_llm(regex_result, llm_result) if has_types else llm_result
        has_numeric_after = merged.get("has_numeric_condition", False)
        has_types_after = bool(merged.get("eligible_company_types"))

        status = _determine_status(has_numeric_after, has_types_after, hint)
        payload = build_update_payload(merged, status)
        update_policy(policy_id, payload)
        print(f"  -> {status} (LLM)")
        return has_numeric_after or has_types_after

    # LLM 없거나 실패 → evidence만 저장
    sections = extract_candidate_sections(text)
    evidence = find_best_evidence(sections)
    types_from_regex = regex_result.get("eligible_company_types") or []
    status = _determine_status(False, bool(types_from_regex), hint)

    payload = build_update_payload({
        "eligibility_text": evidence,
        "eligibility_evidence": evidence,
        "eligible_company_types": types_from_regex,
    }, status)
    update_policy(policy_id, payload)
    print(f"  -> {status}: no structured eligibility fields")
    return False


# =========================================================
# 안내 SQL
# =========================================================

CLEANUP_SQL = """\
-- revenue 0값 NULL 정리 (스크립트 실행 전 Supabase SQL Editor에서 한 번만 실행)
UPDATE policy SET revenue_min_manwon = NULL WHERE revenue_min_manwon = 0;
UPDATE policy SET revenue_max_manwon = NULL WHERE revenue_max_manwon = 0;
"""


def main() -> None:
    print("[schema] If columns are missing, run this SQL in Supabase SQL Editor:")
    print(SCHEMA_SQL.strip())
    print()
    print("[cleanup] revenue 0값이 있으면 아래 SQL로 NULL 처리하세요:")
    print(CLEANUP_SQL.strip())
    print()

    policies = fetch_policies(LIMIT)
    print(f"Policies to enrich: {len(policies)}")
    print(f"DRY_RUN={DRY_RUN}, USE_LLM={USE_LLM and bool(OPENROUTER_API_KEY)}, FORCE_RECHECK={FORCE_RECHECK}")

    success = 0
    failed = 0
    for policy in policies:
        try:
            ok = enrich_one(policy)
            success += 1 if ok else 0
            failed += 0 if ok else 1
        except Exception as exc:
            failed += 1
            policy_id = policy.get("policy_id", "unknown")
            print(f"  -> failed [{policy_id}]: {type(exc).__name__}: {exc}")
            try:
                update_policy(policy_id, {
                    "eligibility_extraction_status": "needs_review",
                    "eligibility_evidence": f"{type(exc).__name__}: {exc}",
                })
            except Exception:
                pass

        time.sleep(SLEEP_SECONDS)

    print("\n" + "=" * 80)
    print("Eligibility enrichment complete")
    print(f"success: {success}")
    print(f"failed/review: {failed}")


# =========================================================
# Self-check  (python enrich_policy_eligibility.py --self-check)
# =========================================================

def _run_self_check() -> None:
    PASS = "PASS"
    FAIL = "FAIL"

    def check(label: str, got: Any, expected: Any) -> bool:
        ok = got == expected
        mark = PASS if ok else FAIL
        print(f"  [{mark}] {label}")
        if not ok:
            print(f"         expected : {expected}")
            print(f"         got      : {got}")
        return ok

    all_ok = True

    print("\n" + "=" * 60)
    print("Self-check: extract_revenue_bounds")
    print("=" * 60)
    revenue_cases = [
        ("최근년도 매출액 50억원 이상",               (500000, None)),
        ("최근년도 매출액 20억원 이상",               (200000, None)),
        ("직전년도 매출규모 100억원 미만",            (None, 1000000)),
        ("평균매출액 또는 연간매출액이 1,200억원 이하", (None, 12000000)),
        ("직전년도(2025년) 매출액이 20억원 이상",     (200000, None)),
        ("기업당 최대 지원금 1,000만원",              (None, None)),
    ]
    for text, expected in revenue_cases:
        all_ok &= check(repr(text), extract_revenue_bounds(text), expected)

    print("\n" + "=" * 60)
    print("Self-check: extract_employee_bounds")
    print("=" * 60)
    employee_cases = [
        ("근로자 5인 이상",      (5, None)),
        ("상시근로자 50인 미만", (None, 50)),
    ]
    for text, expected in employee_cases:
        all_ok &= check(repr(text), extract_employee_bounds(text), expected)

    print("\n" + "=" * 60)
    print("Self-check: extract_company_age_bounds")
    print("=" * 60)
    age_cases = [
        ("창업 7년 이내",       (None, 7)),
        ("창업 1년 이상 경과",  (1, None)),
        ("창업한 지 4년 이상",  (4, None)),
    ]
    for text, expected in age_cases:
        all_ok &= check(repr(text), extract_company_age_bounds(text), expected)

    print("\n" + "=" * 60)
    result_str = "ALL PASSED" if all_ok else "SOME FAILED"
    print(f"Self-check result: {result_str}")
    print("=" * 60)

    if not all_ok:
        raise SystemExit(1)


if __name__ == "__main__":
    import sys
    if "--self-check" in sys.argv:
        _run_self_check()
    else:
        main()
