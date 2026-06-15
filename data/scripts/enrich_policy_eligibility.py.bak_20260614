"""
Enrich policy eligibility fields in Supabase.

Run:
    python data/scripts/enrich_policy_eligibility.py

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
from supabase import Client, create_client

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

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is missing. Check .env or backend/.env.")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

llm = None
if USE_LLM and OPENROUTER_API_KEY and ChatOpenAI:
    llm = ChatOpenAI(
        model=DATA_LLM_MODEL,
        openai_api_key=OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1",
        temperature=0,
    )


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

    # Python regex look-behind must be fixed width, so avoid sentence boundary
    # look-behinds here and split on practical separators used in Korean notices.
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
    return min(current, value) if bound == "max" else max(current, value)


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
                # "미만" is technically exclusive, but storing as max is enough for MVP filtering.
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
    revenue_min: int | None = None
    revenue_max: int | None = None

    subject = r"(?:연매출액|연매출|(?:연\s*)?(?:매출액|매출|매출규모|평균매출액|전년도\s*매출액|최근\s*\d+년\s*평균\s*매출액))"
    amount = r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(조원|억원|천만원|백만원|만원|원|억|조)"

    patterns = [
        (rf"{subject}[^.。;\n]{{0,25}}{amount}\s*(?:이상|초과)", "min"),
        (rf"{subject}[^.。;\n]{{0,25}}{amount}\s*(?:이하|미만|이내)", "max"),
        (rf"{amount}\s*(?:이상|초과)[^.。;\n]{{0,25}}{subject}", "min"),
        (rf"{amount}\s*(?:이하|미만|이내)[^.。;\n]{{0,25}}{subject}", "max"),
    ]

    for pattern, bound in patterns:
        for match in re.finditer(pattern, text):
            # Some patterns put amount groups first, others after subject.
            groups = [group for group in match.groups() if group]
            number_group = next((g for g in groups if re.match(r"^\d", g)), None)
            if not number_group:
                continue
            number_index = groups.index(number_group)
            unit = groups[number_index + 1] if number_index + 1 < len(groups) else "만원"
            value = money_to_manwon(parse_korean_number(number_group), unit)
            if bound == "min":
                revenue_min = set_bound(revenue_min, value, "min")
            else:
                revenue_max = set_bound(revenue_max, value, "max")

    return revenue_min, revenue_max


def extract_company_age_bounds(text: str) -> tuple[int | None, int | None]:
    age_min: int | None = None
    age_max: int | None = None

    patterns = [
        (r"(?:창업|업력|설립)[^.。;\n]{0,20}?(\d+)\s*년\s*(?:이상|초과)", "min"),
        (r"(?:창업|업력|설립)[^.。;\n]{0,20}?(\d+)\s*년\s*(?:이하|미만|이내)", "max"),
        (r"(\d+)\s*년\s*(?:이상|초과)[^.。;\n]{0,20}?(?:창업|업력|설립)", "min"),
        (r"(\d+)\s*년\s*(?:이하|미만|이내)[^.。;\n]{0,20}?(?:창업|업력|설립)", "max"),
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


def find_best_evidence(sections: list[str]) -> str:
    if not sections:
        return ""

    scored = []
    for section in sections:
        score = 0
        score += sum(3 for keyword in ELIGIBILITY_SECTION_KEYWORDS if keyword in section)
        score += sum(1 for keyword in COMPANY_TYPE_KEYWORDS if keyword in section)
        score += 2 if re.search(r"\d+\s*(명|인|년|억|만원|원)", section) else 0
        scored.append((score, len(section), section))

    scored.sort(reverse=True)
    return scored[0][2][:1200]


def merge_bounds(*values: int | None, bound: str) -> int | None:
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return min(cleaned) if bound == "max" else max(cleaned)


def extract_with_regex(text: str) -> dict[str, Any]:
    sections = extract_candidate_sections(text)
    target = clean_text("\n".join(sections)) if sections else clean_text(text[:5000])

    emp_min, emp_max = extract_employee_bounds(target)
    rev_min, rev_max = extract_revenue_bounds(target)
    age_min, age_max = extract_company_age_bounds(target)
    company_types = extract_company_types(target)
    evidence = find_best_evidence(sections) or target[:1200]

    has_data = any([
        emp_min is not None,
        emp_max is not None,
        rev_min is not None,
        rev_max is not None,
        age_min is not None,
        age_max is not None,
        company_types,
    ])

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
    }


def build_llm_prompt(title: str, text: str) -> str:
    return f"""당신은 정부 지원사업 공고의 지원자격 조건을 구조화하는 데이터 추출가입니다.

아래 공고 제목과 지원자격 후보 문장에서 신청 가능한 기업 조건을 추출하세요.

[제목]
{title}

[지원자격 후보 문장]
{text[:3500]}

규칙:
1. 직원 수 조건은 명확한 경우에만 employee_min / employee_max에 숫자로 넣으세요.
2. 매출 조건은 만원 단위로 revenue_min_manwon / revenue_max_manwon에 넣으세요. 예: 120억원 이하 = 1200000.
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
    result["has_data"] = any([
        result[key] is not None for key in integer_keys
    ]) or bool(result["eligible_company_types"] or result["eligibility_text"])
    return result


def extract_with_llm(title: str, text: str) -> dict[str, Any] | None:
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


def fetch_policies(limit: int = LIMIT) -> list[dict[str, Any]]:
    result = (
        supabase
        .table("policy")
        .select(
            "policy_id,title,summary,raw_text,raw_json,"
            "employee_min,employee_max,revenue_min_manwon,revenue_max_manwon,"
            "company_age_min,company_age_max,eligible_company_types,"
            "eligibility_text,eligibility_extraction_status,eligibility_evidence"
        )
        .or_(
            'eligibility_extraction_status.is.null,'
            'eligibility_extraction_status.in.("pending","failed"),'
            "revenue_min_manwon.eq.0,"
            "revenue_max_manwon.eq.0"
        )
        .limit(limit)
        .execute()
    )
    return result.data or []


def _determine_regex_status(extracted: dict[str, Any]) -> str:
    numeric_keys = [
        "employee_min", "employee_max",
        "revenue_min_manwon", "revenue_max_manwon",
        "company_age_min", "company_age_max",
    ]
    has_numeric = any(extracted.get(k) is not None for k in numeric_keys)
    return "structured_extracted" if has_numeric else "type_only_extracted"


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
        "eligibility_evidence": evidence[:400] if evidence else None,
        "eligibility_extraction_status": status,
    }
    return payload


def update_policy(policy_id: str, payload: dict[str, Any]) -> None:
    if DRY_RUN:
        print(f"  -> DRY RUN update payload: {json.dumps(payload, ensure_ascii=False)}")
        return

    supabase.table("policy").update(payload).eq("policy_id", policy_id).execute()


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
    if regex_result["has_data"]:
        payload = build_update_payload(regex_result, _determine_regex_status(regex_result))
        update_policy(policy_id, payload)
        print("  -> extracted by regex")
        return True

    llm_result = extract_with_llm(title, text)
    if llm_result and llm_result.get("has_data"):
        payload = build_update_payload(llm_result, "llm_extracted")
        update_policy(policy_id, payload)
        print("  -> extracted by LLM")
        return True

    sections = extract_candidate_sections(text)
    evidence = find_best_evidence(sections)
    status = "needs_review" if evidence else "not_found"
    payload = build_update_payload({
        "eligibility_text": evidence,
        "eligibility_evidence": evidence,
        "eligible_company_types": extract_company_types(evidence),
    }, status)
    update_policy(policy_id, payload)
    print(f"  -> {status}: no structured eligibility fields")
    return False


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
    print(f"DRY_RUN={DRY_RUN}, USE_LLM={USE_LLM and llm is not None}")

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


if __name__ == "__main__":
    main()
