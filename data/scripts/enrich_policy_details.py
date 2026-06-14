import os
import json
import re
import time
import zlib
import struct
import zipfile
import tempfile
from pathlib import Path
from html import unescape
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import fitz  # pymupdf
import olefile
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_openai import ChatOpenAI

try:
    import pdfplumber
except Exception:
    pdfplumber = None


# =========================================================
# 환경변수 / Supabase 연결
# =========================================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL이 .env에 없습니다.")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
DATA_LLM_MODEL = os.getenv("DATA_LLM_MODEL", "nvidia/nemotron-3-super-120b-a12b:free").strip()
DEBUG_AMOUNT_DUMP_DIR = Path(os.getenv("DEBUG_AMOUNT_DUMP_DIR", "data/debug_amount_texts"))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

llm = ChatOpenAI(
    model=DATA_LLM_MODEL,
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0,
) if OPENROUTER_API_KEY else None

# MuPDF 경고 메시지 줄이기
try:
    fitz.TOOLS.mupdf_display_errors(False)
except Exception:
    pass


# =========================================================
# 설정
# =========================================================

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

LIMIT = int(os.getenv("ENRICH_LIMIT", "100"))
SLEEP_SECONDS = float(os.getenv("ENRICH_SLEEP_SECONDS", "0.5"))
TERMINAL_AMOUNT_STATUSES = [
    "extracted",
    "no_cash_amount",
    "needs_review",
    "no_attachment",
]


@dataclass
class AmountCandidate:
    amount: int
    evidence: str
    score: int
    reason: str


PREFERRED_AMOUNT_CONTEXT_KEYWORDS = [
    "정부 지원금", "정부지원금", "정부지원", "정부 지원", "국비", "정부출연금",
    "정부 출연금", "정부지원 연구개발비", "지원한도", "지원 한도", "지원금액",
    "지원 금액", "지원액", "최대지원금", "최대 지원금", "기업당", "업체당",
    "과제당", "개사당", "1개사당", "세부주관기관",
]

EXCLUDED_AMOUNT_CONTEXT_KEYWORDS = [
    "총사업비", "총 사업비", "사업비 합계", "합계", "예산규모", "공고 예산",
    "총예산", "총 예산", "총지원규모", "총 지원규모", "민간부담금",
    "민간 부담금", "기업부담금", "기업 부담금", "자부담", "도입기업",
    "포스코 지원금", "지자체 지원금", "운영관리비", "운영 관리비",
    "총도입비", "총 도입비", "단가표", "부가세", "수수료", "보증 한도",
    "보증지원", "보증 지원",
]

AMOUNT_UNIT_HINTS = [
    ("억원", "억원"),
    ("억 원", "억원"),
    ("백만원", "백만원"),
    ("백만 원", "백만원"),
    ("천만원", "천만원"),
    ("천만 원", "천만원"),
    ("만원", "만원"),
    ("만 원", "만원"),
    ("천원", "천원"),
    ("천 원", "천원"),
]


# =========================================================
# 텍스트 정리
# =========================================================

def clean_html(value: str) -> str:
    if not value:
        return ""

    text = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_text(value: str) -> str:
    if not value:
        return ""

    text = value.replace("\x00", " ")
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_document_text(value: str) -> str:
    """첨부 문서 추출 결과 정리. 표 추출용 탭/줄바꿈은 보존한다."""
    if not value:
        return ""

    text = value.replace("\x00", " ")
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    lines = []
    for line in text.replace("\r", "\n").split("\n"):
        line = re.sub(r"[ ]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def has_amount_hint(text: str) -> bool:
    if not text:
        return False

    compact = normalize_for_match(clean_text(text))
    if re.search(r"\d+(?:\.\d+)?(?:억원|억|천만원|천만|백만원|백만|만원|천원|원)", compact):
        return True

    hint_keywords = [
        "지원한도", "지원금액", "지원액", "지원규모", "지원금",
        "보조금", "국비", "정부지원금", "사업비", "최대", "기업당",
        "업체당", "과제당", "개사당",
    ]
    return bool(re.search(r"\d", compact)) and any(keyword in compact for keyword in hint_keywords)


def dump_debug_text(policy_id: str, title: str, collected: list[tuple[str, str]], reason: str) -> None:
    if os.getenv("DEBUG_AMOUNT_DUMP", "1").strip() == "0":
        return

    try:
        DEBUG_AMOUNT_DUMP_DIR.mkdir(parents=True, exist_ok=True)
        safe_policy_id = re.sub(r"[^A-Za-z0-9_.-]+", "_", policy_id or "unknown")
        path = DEBUG_AMOUNT_DUMP_DIR / f"{safe_policy_id}.txt"

        parts = [
            f"policy_id: {policy_id}",
            f"title: {title}",
            f"reason: {reason}",
            "",
        ]
        for index, (text, source) in enumerate(collected, start=1):
            parts.extend([
                "=" * 80,
                f"[{index}] source: {source}",
                f"length: {len(text or '')}",
                "",
                clean_text(text or "")[:8000],
                "",
            ])

        path.write_text("\n".join(parts), encoding="utf-8")
        print(f"  → 디버그 텍스트 저장: {path}")
    except Exception as e:
        print(f"  → 디버그 텍스트 저장 실패: {e}")


NO_CASH_SUPPORT_KEYWORDS = [
    "무상지원",
    "무상 지원",
    "무상임대",
    "무상 임대",
    "무료 지원",
    "공동활용",
    "장비 임차",
    "장비임차",
    "장비 대여",
    "장비대여",
    "인허가 지원",
    "인증지원",
    "기술지도",
    "기술 지원",
    "기술지원",
    "컨설팅",
    "교육 지원",
    "기술이전",
    "매칭서비스",
]


def classify_no_cash_support(title: str, text: str) -> tuple[bool, str]:
    combined = clean_text(f"{title} {text}")
    if not combined:
        return False, ""

    if extract_amount_candidate_windows(combined):
        return False, ""

    sentences = split_sentences(combined)
    for sentence in sentences:
        if any(keyword in sentence for keyword in NO_CASH_SUPPORT_KEYWORDS):
            return True, sentence[:700]

    return False, ""


# =========================================================
# 지원금 추출
# =========================================================

def normalize_for_match(text: str) -> str:
    if not text:
        return ""

    text = text.replace(",", "")
    text = text.replace(" ", "")
    text = text.replace("\n", "")
    text = text.replace("\t", "")
    text = text.replace("￦", "")
    text = text.replace("원정", "원")
    return text


def split_sentences(text: str):
    if not text:
        return []

    text = clean_text(text)
    parts = re.split(
        r"(?<=[.!?。])|\n|ㆍ|※|○|●|□|■|◇|◆|▶|▷| - | – |·",
        text,
    )
    return [p.strip() for p in parts if p and len(p.strip()) >= 4]


def find_evidence_sentence(original_text: str, amount: int | None = None) -> str:
    if not original_text:
        return ""

    sentences = split_sentences(original_text)

    money_keywords = [
        "만원", "백만원", "백만 원", "천만원", "천만 원", "억원", "천원", "원",
        "지원한도", "지원 한도", "한도", "최대", "최고",
        "기업당", "업체당", "과제당", "1개사", "개사당",
        "이내", "내외", "지원금", "지원금액", "지원액", "지원규모",
        "사업비", "국비", "보조금",
    ]

    preferred_keywords = [
        "지원한도", "지원 한도", "한도", "최대", "기업당",
        "업체당", "과제당", "개사당", "지원금", "지원금액",
        "지원액", "지원규모", "보조금",
    ]

    for sentence in sentences:
        if any(k in sentence for k in preferred_keywords) and any(k in sentence for k in money_keywords):
            return sentence[:700]

    for sentence in sentences:
        if any(k in sentence for k in money_keywords):
            return sentence[:700]

    return clean_text(original_text)[:700]


AMOUNT_WINDOW_KEYWORDS = [
    "지원한도", "지원 한도", "지원금액", "지원액", "지원규모",
    "지원금", "보조금", "국비", "정부지원금", "사업비",
    "최대", "최고", "기업당", "업체당", "과제당", "개사당",
    "만원", "백만원", "천만원", "억원", "천원",
]


NOISE_WINDOW_KEYWORDS = [
    "매출액",
    "상시근로자수",
    "사업자번호",
    "전화번호",
    "핸드폰",
    "연락처",
    "설립연월일",
    "생년월일",
    "접수 번호",
]


def is_noise_amount_window(sentence: str) -> bool:
    if not sentence:
        return False

    if any(keyword in sentence for keyword in NOISE_WINDOW_KEYWORDS):
        support_hits = sum(1 for keyword in ["지원한도", "지원금액", "지원액", "지원규모", "보조금", "국비"] if keyword in sentence)
        return support_hits == 0

    return False


def extract_amount_candidate_windows(text: str, window_size: int = 3) -> list[str]:
    sentences = split_sentences(text)
    if not sentences:
        return []

    windows = []
    seen = set()

    for index, sentence in enumerate(sentences):
        if not any(keyword in sentence for keyword in AMOUNT_WINDOW_KEYWORDS):
            continue
        if is_noise_amount_window(sentence):
            continue

        start = max(0, index - window_size)
        end = min(len(sentences), index + window_size + 1)
        window = clean_text(" ".join(sentences[start:end]))
        if is_noise_amount_window(window):
            continue
        if not window or window in seen:
            continue

        seen.add(window)
        windows.append(window)

    windows.sort(key=len)
    return windows[:8]


def extract_amount_from_candidate_windows(text: str) -> tuple[int | None, str | None, str | None]:
    for window in extract_amount_candidate_windows(text):
        amount, evidence = extract_max_amount_with_evidence(window)
        if amount:
            return amount, evidence or window[:700], window

    return None, None, None


def extract_max_amount_with_evidence(text: str) -> tuple[int | None, str | None]:
    if not text:
        return None, None

    original_text = clean_text(text)
    compact_text = normalize_for_match(original_text)
    candidates = []

    patterns = [
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+(?:\.\d+)?)억(?:원)?(?:이내|내외|지원|한도|까지)?", 10000),
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+)천만(?:원)?(?:이내|내외|지원|한도|까지)?", 1000),
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+)백만(?:원)?(?:이내|내외|지원|한도|까지)?", 100),
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+)만원(?:이내|내외|지원|한도|까지)?", 1),
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+)천원(?:이내|내외|지원|한도|까지)?", 0.1),
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d{7,})원(?:이내|내외|지원|한도|까지)?", 1 / 10000),
    ]

    bad_context_keywords = [
        "자부담", "민간부담", "부가세", "VAT", "참가비", "수수료",
        "보증금", "예치금", "총사업비", "총 사업비", "총예산",
        "총 예산", "총지원규모", "총 지원규모",
    ]

    good_context_keywords = [
        "지원", "한도", "최대", "최고", "기업당", "업체당",
        "과제당", "개사당", "이내", "내외", "국비", "정부지원금",
        "보조금", "지원금", "지원금액", "지원액", "지원규모",
    ]

    for pattern, multiplier in patterns:
        for match in re.finditer(pattern, compact_text):
            try:
                amount = int(float(match.group(1)) * multiplier)
            except Exception:
                continue

            if amount < 10 or amount > 100000:
                continue

            start = max(0, match.start() - 80)
            end = min(len(compact_text), match.end() + 80)
            nearby = compact_text[start:end]
            immediate_prefix = compact_text[max(0, match.start() - 16):match.start()]
            matched_text = match.group(0)

            score = 0
            immediate_support_prefix = compact_text[max(0, match.start() - 24):match.start()]
            for keyword in good_context_keywords:
                if keyword in matched_text or keyword in nearby:
                    score += 2
                if keyword in immediate_support_prefix:
                    score += 8
            for keyword in bad_context_keywords:
                if keyword in nearby:
                    score -= 3
                if keyword in immediate_prefix:
                    score -= 10
            if immediate_prefix.endswith("총"):
                score -= 10
            if amount < 100:
                score -= 2

            candidates.append({
                "amount": amount,
                "score": score,
                "matched_text": matched_text,
            })

    if not candidates:
        return None, None

    candidates.sort(key=lambda x: (x["score"], x["amount"]), reverse=True)
    best = candidates[0]
    evidence = find_evidence_sentence(original_text, best["amount"])
    return best["amount"], evidence


def build_amount_extraction_prompt(title: str, text: str) -> str:
    return f"""당신은 정부 지원사업 공고의 후보 문장에서 신청 기업/과제 1건 기준의 정부/국비 최대지원금만 판단하는 검수자입니다.

아래는 공고 제목과 금액 키워드 주변 후보 문장입니다. max_amount는 "정부/국비/정부출연금/지원한도 기준 최대지원금"만 해당합니다.
총사업비, 예산규모, 총예산, 총지원규모, 민간부담금, 기업부담금, 자부담, 지자체/민간/주관기관 지원금, 포스코 지원금, 보증한도, 단가표, 총도입비, 운영관리비는 제외하세요.

[제목]
{title}

[후보 문장]
{text[:1800]}

【반드시 지켜야 할 규칙】
1. 지원금액이 명확하면 "최대 3억원", "1억원 이내", "50,000천원"처럼 후보 문장에 있는 표현 그대로 반환하세요.
2. 총사업비, 예산규모, 총예산, 총지원규모, 자부담, 참가비, 보증금, 부가세, 단가표, 총도입비만 있으면 "없음"이라고 답변하세요.
3. 표에 총사업비와 정부지원금이 함께 있으면 반드시 정부지원금/국비/정부출연금/지원한도 컬럼의 금액만 반환하세요.
4. 후보 문장에 금액은 있지만 정부/국비 최대지원금인지 불명확하면 가장 보수적으로 "없음"이라고 답변하세요.
5. 금액 표현이 전혀 없으면 "없음"이라고 답변하세요.
6. 절대 "null", "None", "N/A", 빈 문자열을 출력하지 마세요.
7. 반드시 아래 JSON 형식으로만 답변하세요.

{{
  "지원금액": "최대 3억원" 또는 "없음",
  "근거문장": "본문에서 실제로 발견된 문장 (없으면 빈 문자열)"
}}
"""


def parse_amount_to_manwon(amount_text: str) -> int | None:
    if not amount_text:
        return None

    text = amount_text.replace(",", "").replace(" ", "").strip()
    lowered = text.lower()
    if lowered in ("null", "none", "n/a", "없음", ""):
        return None
    if re.match(r"^(총|총예산|총사업비|총지원규모)", text):
        return None

    mixed_match = re.search(
        r"(\d+(?:\.\d+)?)억(?:원)?(?:(\d+(?:\.\d+)?)(?:천만원|천만|만원|만))?",
        text,
    )
    if mixed_match:
        amount = int(float(mixed_match.group(1)) * 10000)
        extra_value = mixed_match.group(2)
        extra_unit = mixed_match.group(0)
        if extra_value:
            if "천만" in extra_unit or "천만원" in extra_unit:
                amount += int(float(extra_value) * 1000)
            else:
                amount += int(float(extra_value))
        if amount < 10 or amount > 100000:
            return None
        return amount

    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return None

    value = float(match.group(1))

    if "억원" in text or "억" in text:
        amount = int(value * 10000)
    elif "천만원" in text or "천만" in text:
        amount = int(value * 1000)
    elif "백만원" in text or "백만" in text:
        amount = int(value * 100)
    elif "만원" in text or "만" in text:
        amount = int(value)
    elif "원" in text:
        amount = int(value / 10000)
    else:
        amount = int(value)

    if amount < 10 or amount > 100000:
        return None

    return amount


def compact_context(text: str) -> str:
    return normalize_for_match(clean_text(text or ""))


def has_any_context(text: str, keywords: list[str]) -> bool:
    compact = compact_context(text)
    return any(compact_context(keyword) in compact for keyword in keywords)


def infer_amount_unit(context: str) -> str:
    for keyword, unit in AMOUNT_UNIT_HINTS:
        if keyword in context:
            return unit
    return ""


def parse_amount_cell_to_manwon(cell: str, context: str = "") -> int | None:
    if not cell:
        return None

    text = clean_text(str(cell))
    has_currency_unit = (
        any(keyword in text for keyword, _ in AMOUNT_UNIT_HINTS)
        or bool(re.search(r"\d+(?:\.\d+)?\s*억", text))
        or bool(re.search(r"\d[\d,]*(?:\.\d+)?\s*원", text))
    )

    if has_currency_unit:
        amount = parse_amount_to_manwon(text)
        if amount is not None:
            return amount

    if "%" in text and not has_currency_unit:
        return None

    unit = infer_amount_unit(context)
    if not unit:
        return None

    amount = parse_amount_to_manwon(f"{text}{unit}") if re.fullmatch(r"[\d,]+(?:\.\d+)?", text) else None
    if amount is not None:
        return amount

    # 표에서는 헤더/상단에 "(단위: 억원)"처럼 단위가 있고 셀에는 숫자만 있는 경우가 많다.
    match = re.search(r"\d+(?:\.\d+)?", text.replace(",", ""))
    if not match:
        return None

    return parse_amount_to_manwon(f"{match.group(0)}{unit}")


def normalize_table_cell(value) -> str:
    return clean_text(str(value or "").replace("\n", " "))


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def is_amount_context_excluded(context: str) -> bool:
    if not has_any_context(context, EXCLUDED_AMOUNT_CONTEXT_KEYWORDS):
        return False

    # "정부지원금(총사업비 50%)"처럼 설명에 총사업비가 들어가는 경우는 허용한다.
    return not has_any_context(context, PREFERRED_AMOUNT_CONTEXT_KEYWORDS)


def build_table_amount_candidates(rows: list[list[str]], table_context: str = "") -> list[AmountCandidate]:
    if not rows:
        return []

    normalized_rows = [
        [normalize_table_cell(cell) for cell in row]
        for row in rows
        if any(normalize_table_cell(cell) for cell in row)
    ]
    if not normalized_rows:
        return []

    if (
        has_any_context(table_context, ["민간부담금", "민간 부담금", "합계"])
        and not has_any_context(table_context, ["최대", "지원한도", "지원 한도", "국비 최대"])
    ):
        return []

    candidates: list[AmountCandidate] = []
    header_rows: list[list[str]] = []

    for row_index, row in enumerate(normalized_rows):
        max_header_len = max((len(header) for header in header_rows), default=0)
        if (
            header_rows
            and max_header_len
            and len(row) < max_header_len
            and row
            and parse_amount_cell_to_manwon(row[0], table_context) is not None
            and not has_any_context(header_rows[-1][0] if header_rows[-1] else "", PREFERRED_AMOUNT_CONTEXT_KEYWORDS)
        ):
            row = [""] + row

        row_text = " ".join(row)
        has_header_signal = has_any_context(
            row_text,
            PREFERRED_AMOUNT_CONTEXT_KEYWORDS + EXCLUDED_AMOUNT_CONTEXT_KEYWORDS + ["지원유형", "구분", "지원내용"],
        )

        if has_header_signal and row_index <= 3 and not any(re.search(r"\d", cell) for cell in row):
            header_rows.append(row)
            continue

        # 표 중간에 다단 헤더가 다시 나오는 경우 갱신한다.
        if has_header_signal and not any(re.search(r"\d", cell) for cell in row):
            header_rows.append(row)
            header_rows = header_rows[-3:]
            continue

        row_label = " ".join(cell for idx, cell in enumerate(row[:2]) if cell)

        for col_index, cell in enumerate(row):
            if not re.search(r"\d", cell):
                continue

            column_labels = []
            for header in header_rows[-3:]:
                if col_index < len(header) and header[col_index]:
                    column_labels.append(header[col_index])

            label = " ".join(column_labels + [row_label]).strip()
            if has_any_context(label, EXCLUDED_AMOUNT_CONTEXT_KEYWORDS) and not has_any_context(label, PREFERRED_AMOUNT_CONTEXT_KEYWORDS):
                continue
            if has_any_context(row_text, ["합계"]) and not has_any_context(row_text, ["최대", "지원한도", "지원 한도", "국비 최대"]):
                continue

            context = " ".join([table_context, label, row_text]).strip()
            amount = parse_amount_cell_to_manwon(cell, context)
            if amount is None or amount < 10 or amount > 100000:
                continue

            if is_amount_context_excluded(context):
                continue

            score = 0
            if has_any_context(label, ["정부 지원금", "정부지원금", "국비", "정부출연금", "정부 출연금", "정부지원 연구개발비"]):
                score += 120
            if has_any_context(label, ["지원한도", "지원 한도", "지원금액", "최대지원금", "최대 지원금"]):
                score += 90
            if has_any_context(context, ["기업당", "업체당", "과제당", "개사당", "1개사당", "세부주관기관"]):
                score += 35
            if has_any_context(context, PREFERRED_AMOUNT_CONTEXT_KEYWORDS):
                score += 20
            if has_any_context(context, EXCLUDED_AMOUNT_CONTEXT_KEYWORDS):
                score -= 60

            if score <= 0:
                continue

            evidence = clean_text(f"{label} / {cell}")[:700]
            candidates.append(AmountCandidate(
                amount=amount,
                evidence=evidence,
                score=score,
                reason="structured_table",
            ))

    return candidates


def extract_structured_table_amount(text: str) -> tuple[int | None, str | None]:
    """탭으로 직렬화된 표에서 정부/국비 기준 최대지원금을 우선 추출한다."""
    if not text or "\t" not in text:
        return None, None

    tables: list[list[list[str]]] = []
    current: list[list[str]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if "\t" in line:
            current.append([cell.strip() for cell in line.split("\t")])
            continue
        if current:
            tables.append(current)
            current = []

    if current:
        tables.append(current)

    candidates: list[AmountCandidate] = []
    for rows in tables:
        table_context = " ".join(" ".join(row) for row in rows[:3])
        candidates.extend(build_table_amount_candidates(rows, table_context))

    if not candidates:
        return None, None

    candidates.sort(key=lambda item: (item.score, item.amount), reverse=True)
    best = candidates[0]
    return best.amount, best.evidence


def extract_amount_with_llm(title: str, text: str) -> tuple[int | None, str, bool]:
    """
    LLM으로 최대 지원 금액 추출.
    반환: (만원 단위 정수, 근거 문장, 금액 없음 확정 여부)
    """
    if not llm:
        print("  → LLM 미초기화 (OPENROUTER_API_KEY 없음)")
        return None, "", False

    if not text or len(text) < 100:
        return None, "", False

    prompt = build_amount_extraction_prompt(title, text)

    try:
        response = llm.invoke(prompt)
        raw = response.content.strip()
        print(f"  → LLM 응답: {raw[:200]!r}")

        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            amount_text = str(data.get("지원금액", "")).strip()
            evidence = str(data.get("근거문장", "")).strip()

            if amount_text == "없음" or amount_text.lower() in ("null", "none", "n/a", ""):
                return None, evidence, True

            amount = parse_amount_to_manwon(amount_text)
            if amount:
                return amount, evidence or amount_text, False

            print(f"  → 금액 문자열 변환 실패 — 지원금액: {amount_text!r}")
            return None, evidence, False

        if "없음" in raw or raw.lower() in ("null", "none", "n/a", ""):
            return None, "", True

        fallback_amount = parse_amount_to_manwon(raw)
        if fallback_amount:
            return fallback_amount, raw[:300], False

        print(f"  → LLM JSON 파싱 실패 — raw: {raw[:300]!r}")

    except Exception as e:
        print(f"  → LLM 파싱 에러: {type(e).__name__}: {e}")

    return None, "", False


def get_best_text_for_llm(collected: list[tuple[str, str]]) -> tuple[str, str]:
    detail_text = ""
    attachment_texts = []

    for text, source in collected:
        if not text:
            continue
        if source == "detail_page":
            detail_text = text
        elif len(text) > 500:
            attachment_texts.append((text, source))

    if detail_text and attachment_texts:
        best_attachment, best_source = attachment_texts[0]
        combined = f"[상세페이지]\n{detail_text[:2000]}\n\n[첨부파일: {best_source}]\n{best_attachment[:3000]}"
        return combined, f"detail_page+{best_source}"

    best_text, best_source = max(collected, key=lambda item: len(item[0]))
    return best_text, best_source


# =========================================================
# 상세페이지
# =========================================================

def fetch_detail_page_text(url: str):
    if not url:
        return ""

    response = requests.get(url, headers=REQUEST_HEADERS, timeout=25)
    response.raise_for_status()

    if response.encoding is None:
        response.encoding = response.apparent_encoding

    return clean_html(response.text)


# =========================================================
# PDF 처리
# =========================================================

def extract_pdf_text(file_bytes: bytes):
    if not file_bytes:
        return ""

    # PDF 아닌 경우 방지
    if not file_bytes.startswith(b"%PDF"):
        # 서버가 content-type은 pdf라 해도 실제 파일이 아닐 수 있음
        pass

    text_parts = []

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        if pdfplumber is not None:
            try:
                with pdfplumber.open(tmp_path) as pdf:
                    for page_index, page in enumerate(pdf.pages, start=1):
                        tables = page.extract_tables() or []
                        for table_index, table in enumerate(tables, start=1):
                            table_rows = []
                            for row in table or []:
                                cells = [normalize_table_cell(cell) for cell in row or []]
                                if any(cells):
                                    table_rows.append("\t".join(cells))
                            if table_rows:
                                text_parts.append(f"[PDF_TABLE page={page_index} table={table_index}]")
                                text_parts.extend(table_rows)
            except Exception as e:
                print(f"  → PDF 표 추출 실패(pdfplumber): {e}")

        doc = fitz.open(tmp_path)

        if doc.is_encrypted:
            try:
                doc.authenticate("")
            except Exception:
                doc.close()
                return ""

        for page in doc:
            try:
                page_text = page.get_text()
                if page_text:
                    text_parts.append(page_text)
            except Exception:
                continue

        doc.close()
        return clean_document_text("\n".join(text_parts))

    except Exception as e:
        print(f"  → PDF 텍스트 추출 실패: {e}")
        return ""

    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


# =========================================================
# HWP 처리
# =========================================================

def is_hwp_bytes(file_bytes: bytes):
    if not file_bytes:
        return False

    with tempfile.NamedTemporaryFile(delete=False, suffix=".hwp") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        return olefile.isOleFile(tmp_path)
    except Exception:
        return False
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


def is_compressed_hwp(ole):
    try:
        with ole.openstream("FileHeader") as f:
            header = f.read()

        if len(header) < 40:
            return False

        properties = struct.unpack_from("<I", header, 36)[0]
        return bool(properties & 0x01)

    except Exception:
        return False


def decompress_hwp_stream(data: bytes):
    try:
        # HWP BodyText는 raw deflate인 경우가 많음
        return zlib.decompress(data, -15)
    except Exception:
        try:
            return zlib.decompress(data)
        except Exception:
            return data


def clean_hwp_text(text: str):
    if not text:
        return ""

    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    text = text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_hwp_records(data: bytes):
    """
    HWP record 중 HWPTAG_PARA_TEXT(tag_id=67) 추출.
    레코드 헤더: [tag:10][level:2][size:12], size==0xFFF이면 다음 4바이트가 실제 크기.
    """
    text_parts = []
    offset = 0

    while offset + 4 <= len(data):
        try:
            header = struct.unpack_from("<I", data, offset)[0]
        except Exception:
            break

        offset += 4

        tag_id = header & 0x3FF
        size = (header >> 12) & 0xFFF  # bits 12-23

        if size == 0xFFF:
            if offset + 4 > len(data):
                break
            try:
                size = struct.unpack_from("<I", data, offset)[0]
            except Exception:
                break
            offset += 4

        if size < 0 or offset + size > len(data):
            break

        record_data = data[offset:offset + size]
        offset += size

        # HWPTAG_PARA_TEXT = 67
        if tag_id == 67:
            try:
                text = record_data.decode("utf-16le", errors="ignore")
                text = clean_hwp_text(text)
                if text:
                    text_parts.append(text)
            except Exception:
                continue

    return "\n".join(text_parts)


def extract_hwp_prvtext(ole) -> str:
    """OLE HWP의 PrvText 스트림에서 미리보기 텍스트 추출 (BodyText 실패 시 폴백)"""
    try:
        if ole.exists("PrvText"):
            with ole.openstream("PrvText") as f:
                data = f.read()
            text = data.decode("utf-16le", errors="ignore")
            return clean_hwp_text(text)
    except Exception:
        pass
    return ""


def extract_hwp_text(file_bytes: bytes):
    text_parts = []

    with tempfile.NamedTemporaryFile(delete=False, suffix=".hwp") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        if not olefile.isOleFile(tmp_path):
            # OLE가 아니면 HWPX(ZIP) 형식일 수 있음
            print("  → HWP 파일이 OLE 형식 아님, HWPX로 재시도")
            return extract_hwpx_text(file_bytes)

        ole = olefile.OleFileIO(tmp_path)
        compressed = is_compressed_hwp(ole)

        section_streams = []
        for stream in ole.listdir():
            if (
                len(stream) == 2
                and stream[0] == "BodyText"
                and stream[1].startswith("Section")
            ):
                section_streams.append(stream)

        section_streams.sort(key=lambda x: x[1])

        for stream in section_streams:
            try:
                with ole.openstream(stream) as f:
                    data = f.read()

                if compressed:
                    data = decompress_hwp_stream(data)

                section_text = parse_hwp_records(data)
                if section_text:
                    text_parts.append(section_text)

            except Exception as e:
                print(f"  → HWP 섹션 추출 실패 {stream}: {e}")
                continue

        body_text = clean_text("\n".join(text_parts))

        if not body_text:
            # BodyText 파싱 결과 없으면 PrvText로 폴백
            prv_text = extract_hwp_prvtext(ole)
            if prv_text:
                print("  → BodyText 없음, PrvText 폴백 사용")
                ole.close()
                return prv_text

        ole.close()
        return body_text

    except Exception as e:
        print(f"  → HWP 텍스트 추출 실패: {e}")
        return ""

    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


# =========================================================
# HWPX 처리
# =========================================================

def extract_hwpx_text(file_bytes: bytes):
    text_parts = []

    with tempfile.NamedTemporaryFile(delete=False, suffix=".hwpx") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        if not zipfile.is_zipfile(tmp_path):
            print("  → HWPX 파일이 ZIP 형식이 아님, 건너뜀")
            return ""

        with zipfile.ZipFile(tmp_path, "r") as z:
            xml_files = [
                name for name in z.namelist()
                if name.endswith(".xml")
            ]

            # 본문 가능성이 높은 XML 우선
            xml_files = sorted(
                xml_files,
                key=lambda name: (
                    0 if any(k in name.lower() for k in ["section", "contents", "body"]) else 1,
                    name
                )
            )

            for xml_name in xml_files:
                try:
                    xml_data = z.read(xml_name)
                    root = ET.fromstring(xml_data)

                    for table_index, table in enumerate(
                        [elem for elem in root.iter() if local_name(elem.tag).lower() in ("tbl", "table")],
                        start=1,
                    ):
                        table_rows = []
                        for row in table.iter():
                            if local_name(row.tag).lower() not in ("tr", "row"):
                                continue

                            cells = []
                            for cell in row:
                                if local_name(cell.tag).lower() in ("tc", "cell"):
                                    cell_text = clean_text(" ".join(t.strip() for t in cell.itertext() if t and t.strip()))
                                    cells.append(cell_text)

                            if any(cells):
                                table_rows.append("\t".join(cells))

                        if table_rows:
                            text_parts.append(f"[HWPX_TABLE file={xml_name} table={table_index}]")
                            text_parts.extend(table_rows)

                    for elem in root.iter():
                        if elem.text and elem.text.strip():
                            text_parts.append(elem.text.strip())

                except Exception:
                    continue

        return clean_document_text("\n".join(text_parts))

    except Exception as e:
        print(f"  → HWPX 텍스트 추출 실패: {e}")
        return ""

    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


# =========================================================
# ZIP 처리
# =========================================================

def safe_decode_filename(name: str):
    try:
        return name.encode("cp437").decode("cp949")
    except Exception:
        return name


def extract_text_from_zip(file_bytes: bytes):
    text_parts = []
    hwp_failed = False

    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        with zipfile.ZipFile(tmp_path, "r") as z:
            names = z.namelist()

            preferred_names = sorted(
                names,
                key=lambda name: (
                    0 if any(k in safe_decode_filename(name) for k in ["공고", "공고문", "붙임", "지원", "사업"]) else 1,
                    safe_decode_filename(name)
                )
            )

            for name in preferred_names:
                if name.endswith("/"):
                    continue

                decoded_name = safe_decode_filename(name)
                lower = decoded_name.lower()

                try:
                    inner_bytes = z.read(name)
                except Exception:
                    continue

                if lower.endswith(".pdf"):
                    print(f"    → ZIP 내부 PDF 확인: {decoded_name}")
                    pdf_text = extract_pdf_text(inner_bytes)
                    if pdf_text:
                        text_parts.append(pdf_text)

                elif lower.endswith(".hwp"):
                    print(f"    → ZIP 내부 HWP 확인: {decoded_name}")
                    hwp_text = extract_hwp_text(inner_bytes)
                    if hwp_text:
                        text_parts.append(hwp_text)
                    else:
                        hwp_failed = True

                elif lower.endswith(".hwpx"):
                    print(f"    → ZIP 내부 HWPX 확인: {decoded_name}")
                    hwpx_text = extract_hwpx_text(inner_bytes)
                    if hwpx_text:
                        text_parts.append(hwpx_text)

                elif lower.endswith(".txt"):
                    print(f"    → ZIP 내부 TXT 확인: {decoded_name}")
                    try:
                        text_parts.append(inner_bytes.decode("utf-8", errors="ignore"))
                    except Exception:
                        pass

        if text_parts:
            return clean_document_text("\n".join(text_parts)), "attachment_zip_extracted"

        if hwp_failed:
            return "", "attachment_zip_hwp_failed"

        return "", "attachment_zip_checked_not_found"

    except Exception as e:
        print(f"  → ZIP 텍스트 추출 실패: {e}")
        return "", "attachment_zip_failed"

    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


# =========================================================
# 첨부파일 공통 처리
# =========================================================

def get_attachment_candidates(raw_json: dict):
    if not raw_json:
        return []

    candidates = []

    for url_key, name_key in [
        ("printFlpthNm", "printFileNm"),
        ("flpthNm", "fileNm"),
    ]:
        url_raw = raw_json.get(url_key) or ""
        name_raw = raw_json.get(name_key) or ""

        urls = [u.strip() for u in url_raw.split("@") if u.strip()]
        names = [n.strip() for n in name_raw.split("@") if n.strip()]

        for i, url in enumerate(urls):
            candidates.append({
                "url": url,
                "name": names[i] if i < len(names) else "",
                "url_key": url_key,
            })

    # 공고문/사업안내 파일을 먼저 보고, 신청서/양식/서식류는 후순위로 둔다.
    # 신청 양식 파일은 정상 파싱되어도 지원금액 본문이 없는 경우가 많다.
    preferred_name_keywords = [
        "공고문", "모집공고", "공고", "사업안내", "안내문", "사업계획",
        "지원사업", "시행계획", "세부사업",
    ]
    low_priority_name_keywords = [
        "신청서", "신청서식", "양식", "서식", "붙임2", "붙임 2",
        "체크리스트", "개인정보", "동의서", "확약서",
        "카달로그", "카탈로그", "catalog", "포스터", "poster",
    ]

    def attachment_sort_key(item: dict):
        name = str(item.get("name", ""))
        name_lower = name.lower()

        is_low_priority = any(k in name for k in low_priority_name_keywords)
        is_preferred = any(k in name for k in preferred_name_keywords)
        is_pdf = name_lower.endswith(".pdf")
        is_hwp = name_lower.endswith(".hwp") or name_lower.endswith(".hwpx")

        return (
            1 if is_low_priority else 0,
            0 if is_preferred else 1,
            0 if is_pdf else 1,
            0 if is_hwp else 1,
            name,
        )

    candidates.sort(
        key=attachment_sort_key
    )

    return candidates


def download_attachment(url: str):
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=45)
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "").lower()
    return response.content, content_type


def extract_text_from_attachment(file_bytes: bytes, content_type: str, filename: str):
    filename_lower = (filename or "").lower()

    # ZIP이 PDF보다 먼저면 안 됨. HWPX도 ZIP 구조라 확장자 먼저 봐야 함.

    if (
        filename_lower.endswith(".pdf")
        or "pdf" in content_type
        or file_bytes.startswith(b"%PDF")
    ):
        return extract_pdf_text(file_bytes), "attachment_pdf"

    if filename_lower.endswith(".hwp"):
        text = extract_hwp_text(file_bytes)
        if text:
            return text, "attachment_hwp"
        return "", "attachment_hwp_failed"

    if filename_lower.endswith(".hwpx"):
        text = extract_hwpx_text(file_bytes)
        if text:
            return text, "attachment_hwpx"
        return "", "attachment_hwpx_failed"

    if (
        filename_lower.endswith(".zip")
        or "zip" in content_type
        or file_bytes.startswith(b"PK")
    ):
        return extract_text_from_zip(file_bytes)

    # 확장자는 애매한데 OLE면 HWP일 가능성
    if is_hwp_bytes(file_bytes):
        text = extract_hwp_text(file_bytes)
        if text:
            return text, "attachment_hwp"
        return "", "attachment_hwp_failed"

    if "text" in content_type or "html" in content_type:
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            return clean_html(text), "attachment_text"
        except Exception:
            return "", "attachment_text_failed"

    return "", "attachment_unknown"



# =========================================================
# 매출 조건(revenue_rules) 추출
# =========================================================

REVENUE_LIMIT = int(os.getenv("REVENUE_ENRICH_LIMIT", str(LIMIT)))

REVENUE_OPERATOR_MAP = {
    "이상": "이상",
    "초과": "초과",
    "이하": "이하",
    "미만": "미만",
    "gte": "이상",
    "gt": "초과",
    "lte": "이하",
    "lt": "미만",
}

REVENUE_AMOUNT_PATTERN = re.compile(
    r"(?P<number>\d[\d,]*(?:\.\d+)?)\s*"
    r"(?P<unit>억\s*원|억원|억|천만\s*원|천만원|천만|"
    r"백만\s*원|백만원|백만|만\s*원|만원|만|원)\s*"
    r"(?P<operator>이상|초과|이하|미만)"
)


def parse_revenue_to_manwon(value) -> int | None:
    """매출액 표현을 만원 단위 정수로 변환한다."""
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        amount = int(value)
        return amount if amount >= 0 else None

    text = str(value).replace(",", "").replace(" ", "").strip()
    if not text:
        return None

    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return None

    number = float(match.group(1))

    if "억원" in text or "억" in text:
        amount = int(number * 10000)
    elif "천만원" in text or "천만" in text:
        amount = int(number * 1000)
    elif "백만원" in text or "백만" in text:
        amount = int(number * 100)
    elif "만원" in text or "만" in text:
        amount = int(number)
    elif "원" in text:
        amount = int(number / 10000)
    else:
        # JSON의 value_manwon처럼 단위 없이 숫자만 온 경우
        amount = int(number)

    return amount if amount >= 0 else None


def parse_export_amount_usd(value) -> int | None:
    """100만불, 1백만 달러 등의 표현을 USD 정수로 변환한다."""
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        amount = int(value)
        return amount if amount >= 0 else None

    text = str(value).replace(",", "").replace(" ", "").strip()
    if not text:
        return None

    match = re.search(
        r"(\d+(?:\.\d+)?)"
        r"(억|천만|백만|만)?"
        r"(?:미국달러|달러|불|USD)",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        # JSON에서 숫자 문자열만 온 경우
        if re.fullmatch(r"\d+(?:\.\d+)?", text):
            return int(float(text))
        return None

    number = float(match.group(1))
    unit = match.group(2) or ""

    multiplier = {
        "억": 100_000_000,
        "천만": 10_000_000,
        "백만": 1_000_000,
        "만": 10_000,
        "": 1,
    }[unit]

    return int(number * multiplier)


def infer_revenue_type(text: str) -> str:
    compact = clean_text(text or "")

    has_average = any(
        keyword in compact
        for keyword in ["평균매출", "평균 매출", "3년 평균", "3개 사업연도 평균", "최근 3년"]
    )
    has_annual = any(
        keyword in compact
        for keyword in ["최근년도", "최근 연도", "연간매출", "연간 매출", "연매출"]
    )

    if has_average and has_annual and "또는" in compact:
        return "평균 또는 연간 매출액"
    if has_average:
        return "최근 3개 사업연도 평균매출액"
    if has_annual:
        return "최근년도 매출액"
    return "매출액"


def infer_track_name(evidence: str) -> str | None:
    """
    정규식 추출용 간단한 트랙명 추정.
    복잡한 트랙명은 LLM 결과를 우선 사용한다.
    """
    text = clean_text(evidence or "")
    if not text:
        return None

    # "수출지향형: 매출액 50억원 이상"처럼 콜론 앞에 트랙명이 있는 경우
    for separator in [":", "：", "→"]:
        if separator in text:
            prefix = text.split(separator, 1)[0].strip(" -ㆍ·[]()")
            if (
                2 <= len(prefix) <= 80
                and any(keyword in prefix for keyword in ["형", "트랙", "분야", "소부장", "글로벌", "수출"])
            ):
                return prefix

    # 매출 표현 앞의 짧은 문구가 트랙명처럼 보이는 경우
    if "매출" in text:
        prefix = text.split("매출", 1)[0].strip(" -ㆍ·[]()")
        if (
            2 <= len(prefix) <= 60
            and any(keyword in prefix for keyword in ["형", "트랙", "분야", "소부장", "글로벌", "수출"])
        ):
            return prefix

    return None


def extract_export_min_usd(text: str) -> int | None:
    cleaned = clean_text(text or "")
    patterns = [
        r"\d[\d,]*(?:\.\d+)?\s*(?:억|천만|백만|만)?\s*(?:미국달러|달러|불|USD)",
    ]

    for pattern in patterns:
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if match:
            return parse_export_amount_usd(match.group(0))

    return None


def split_revenue_segments(text: str) -> list[str]:
    if not text:
        return []

    document = clean_document_text(text)
    segments = []

    for line in document.splitlines():
        line = line.strip()
        if not line:
            continue

        parts = re.split(r"(?<=[.!?。])|※|○|●|□|■|◇|◆|▶|▷|ㆍ|·", line)
        segments.extend(
            clean_text(part)
            for part in parts
            if part and len(clean_text(part)) >= 4
        )

    return segments


def extract_revenue_candidate_windows(text: str, window_size: int = 2) -> list[str]:
    segments = split_revenue_segments(text)
    windows = []
    seen = set()

    for index, segment in enumerate(segments):
        if "매출" not in segment:
            continue
        if not any(operator in segment for operator in ["이상", "초과", "이하", "미만"]):
            continue
        if not re.search(r"\d", segment):
            continue

        start = max(0, index - window_size)
        end = min(len(segments), index + window_size + 1)
        window = clean_text(" ".join(segments[start:end]))

        if not window or window in seen:
            continue

        seen.add(window)
        windows.append(window)

    return windows[:20]


def extract_revenue_rules_regex(text: str) -> list[dict]:
    """단순 매출 조건을 정규식으로 추출한다."""
    rules = []
    seen = set()

    for window in extract_revenue_candidate_windows(text):
        if "매출" not in window:
            continue

        for match in REVENUE_AMOUNT_PATTERN.finditer(window):
            matched_text = match.group(0)
            value_manwon = parse_revenue_to_manwon(
                f"{match.group('number')}{match.group('unit')}"
            )
            if value_manwon is None:
                continue

            # 금액 주변에 매출이라는 단어가 있어야 지원금·사업비와 혼동하지 않는다.
            start = max(0, match.start() - 140)
            end = min(len(window), match.end() + 140)
            nearby = window[start:end]
            if "매출" not in nearby:
                continue

            rule = {
                "track": infer_track_name(window),
                "revenue_type": infer_revenue_type(nearby),
                "operator": match.group("operator"),
                "value_manwon": value_manwon,
                "export_min_usd": extract_export_min_usd(window),
                "evidence": window[:700],
            }

            key = (
                rule["track"] or "",
                rule["revenue_type"],
                rule["operator"],
                rule["value_manwon"],
                rule["export_min_usd"],
            )
            if key in seen:
                continue

            seen.add(key)
            rules.append(rule)

    return rules


def build_revenue_rules_prompt(title: str, text: str) -> str:
    return f"""당신은 정부 지원사업 공고에서 신청기업의 매출 자격조건을 구조화하는 검수자입니다.

[공고 제목]
{title}

[매출 조건 후보 문장]
{text[:7000]}

반드시 아래 규칙을 지키세요.

1. 신청기업의 매출 자격조건만 추출하세요. 지원금, 사업비, 예산, 보조금 금액은 제외하세요.
2. 공고 전체 공통 조건이면 track은 null로 반환하세요.
3. 트랙·유형·분야마다 조건이 다르면 각각 별도 항목으로 반환하세요.
4. operator는 반드시 "이상", "초과", "이하", "미만" 중 하나만 사용하세요.
5. value_manwon은 만원 단위 정수로 변환하세요.
   - 20억원 = 200000
   - 50억원 = 500000
   - 100억원 = 1000000
   - 1200억원 = 12000000
6. revenue_type은 다음 중 가장 알맞은 값을 사용하세요.
   - "최근년도 매출액"
   - "최근 3개 사업연도 평균매출액"
   - "매출액"
7. 같은 트랙에서 매출과 수출실적을 모두 요구하면 export_min_usd도 정수로 저장하세요.
8. "평균매출액 또는 연간매출액"처럼 OR 조건이면 두 항목으로 나누어 반환하세요.
9. evidence에는 실제 후보 문장을 짧게 보존하세요.
10. 매출 자격조건이 없으면 빈 배열 []만 반환하세요.
11. 설명이나 마크다운 없이 JSON 배열만 반환하세요.

반환 형식:
[
  {{
    "track": "트랙명 또는 null",
    "revenue_type": "최근년도 매출액",
    "operator": "이상",
    "value_manwon": 500000,
    "export_min_usd": 1000000,
    "evidence": "최근년도 매출액 50억원 이상이고 수출실적 100만불 이상"
  }}
]
"""


def normalize_revenue_rule(rule: dict) -> dict | None:
    if not isinstance(rule, dict):
        return None

    operator = REVENUE_OPERATOR_MAP.get(str(rule.get("operator") or "").strip())
    if not operator:
        return None

    value_manwon = parse_revenue_to_manwon(rule.get("value_manwon"))
    if value_manwon is None:
        # 모델이 value나 revenue_amount로 반환한 경우도 허용
        value_manwon = parse_revenue_to_manwon(
            rule.get("value")
            or rule.get("revenue_amount")
            or rule.get("revenue_amount_manwon")
        )
    if value_manwon is None:
        return None

    track = rule.get("track")
    if track is not None:
        track = clean_text(str(track))
        if track.lower() in ("null", "none", "공통", "전체", ""):
            track = None

    evidence = clean_text(str(rule.get("evidence") or ""))[:700]
    revenue_type = clean_text(str(rule.get("revenue_type") or "매출액"))
    if not revenue_type:
        revenue_type = infer_revenue_type(evidence)

    export_min_usd = parse_export_amount_usd(rule.get("export_min_usd"))
    if export_min_usd is None:
        export_min_usd = extract_export_min_usd(evidence)

    return {
        "track": track,
        "revenue_type": revenue_type,
        "operator": operator,
        "value_manwon": value_manwon,
        "export_min_usd": export_min_usd,
        "evidence": evidence,
    }


def extract_revenue_rules_with_llm(title: str, text: str) -> list[dict]:
    if not llm or not text:
        return []

    prompt = build_revenue_rules_prompt(title, text)

    try:
        response = llm.invoke(prompt)
        raw = response.content.strip()
        print(f"  → 매출조건 LLM 응답: {raw[:250]!r}")

        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)

        data = None

        try:
            data = json.loads(raw)
        except Exception:
            array_match = re.search(r"\[[\s\S]*\]", raw)
            if array_match:
                data = json.loads(array_match.group(0))
            else:
                object_match = re.search(r"\{[\s\S]*\}", raw)
                if object_match:
                    parsed_object = json.loads(object_match.group(0))
                    data = parsed_object.get("revenue_rules", [])

        if isinstance(data, dict):
            data = data.get("revenue_rules", [])

        if not isinstance(data, list):
            return []

        normalized = []
        for item in data:
            rule = normalize_revenue_rule(item)
            if rule:
                normalized.append(rule)

        return normalized

    except Exception as e:
        print(f"  → 매출조건 LLM 추출 실패: {type(e).__name__}: {e}")
        return []


def merge_revenue_rules(regex_rules: list[dict], llm_rules: list[dict]) -> list[dict]:
    """
    트랙을 잘 판단하는 LLM 결과를 우선하고,
    LLM이 놓친 금액·연산자 조합만 정규식 결과로 보완한다.
    """
    merged = []
    seen_exact = set()
    seen_condition = set()

    for rule in llm_rules + regex_rules:
        normalized = normalize_revenue_rule(rule)
        if not normalized:
            continue

        exact_key = (
            normalized["track"] or "",
            normalized["revenue_type"],
            normalized["operator"],
            normalized["value_manwon"],
            normalized["export_min_usd"],
        )
        condition_key = (
            normalized["revenue_type"],
            normalized["operator"],
            normalized["value_manwon"],
            normalized["export_min_usd"],
        )

        if exact_key in seen_exact:
            continue

        # 같은 조건을 LLM이 트랙명과 함께 반환했다면 track=None 정규식 결과는 생략
        if normalized["track"] is None and condition_key in seen_condition:
            continue

        seen_exact.add(exact_key)
        seen_condition.add(condition_key)
        merged.append(normalized)

    return merged


def build_revenue_update_payload(rules: list[dict]) -> dict:
    """
    단순 공통 조건이면 기존 min/max 컬럼도 보완한다.
    트랙별·복합 조건이면 기존 단일 min/max 값은 NULL로 정리한다.
    """
    payload = {
        "revenue_rules": rules,
    }

    if not rules:
        # 조건을 찾지 못한 경우 기존 수동/과거 값을 지우지 않는다.
        return payload

    has_track_rule = any(rule.get("track") for rule in rules)
    revenue_types = {rule.get("revenue_type") for rule in rules}

    if has_track_rule or len(revenue_types) > 1:
        payload["revenue_min_manwon"] = None
        payload["revenue_max_manwon"] = None
        return payload

    minimum_rules = [
        rule for rule in rules
        if rule.get("operator") in ("이상", "초과")
    ]
    maximum_rules = [
        rule for rule in rules
        if rule.get("operator") in ("이하", "미만")
    ]

    # 하나의 공통 범위만 기존 단순 컬럼으로 반영한다.
    payload["revenue_min_manwon"] = (
        minimum_rules[0]["value_manwon"]
        if len(minimum_rules) == 1
        else None
    )
    payload["revenue_max_manwon"] = (
        maximum_rules[0]["value_manwon"]
        if len(maximum_rules) == 1
        else None
    )

    return payload


def fetch_policies_without_revenue_rules(limit: int = REVENUE_LIMIT):
    result = (
        supabase
        .table("policy")
        .select(
            "policy_id,title,url,summary,raw_text,raw_json,"
            "revenue_min_manwon,revenue_max_manwon,revenue_rules"
        )
        .like("policy_id", "PBLN_%")
        .is_("revenue_rules", "null")
        .limit(limit)
        .execute()
    )

    return result.data or []


def update_revenue_rules(policy_id: str, rules: list[dict]) -> bool:
    payload = build_revenue_update_payload(rules)

    try:
        (
            supabase
            .table("policy")
            .update(payload)
            .eq("policy_id", policy_id)
            .execute()
        )
        return True
    except Exception as e:
        print(f"  → revenue_rules DB 저장 실패 [{policy_id}]: {e}")
        return False


def enrich_one_policy_revenue(policy: dict) -> bool:
    policy_id = policy.get("policy_id")
    title = policy.get("title") or ""
    summary = policy.get("summary") or ""
    raw_text = policy.get("raw_text") or ""
    url = policy.get("url") or ""
    raw_json = policy.get("raw_json") or {}

    print("\n" + "=" * 80)
    print(f"[매출조건 처리] {policy_id}")
    print(title)

    if not policy_id:
        return False

    collected: list[tuple[str, str]] = []
    statuses = []

    if summary:
        collected.append((summary, "summary"))
    if raw_text:
        collected.append((raw_text, "raw_text"))

    try:
        detail_text = fetch_detail_page_text(url)
        if detail_text and len(detail_text) >= 50:
            collected.append((detail_text, "detail_page"))
            print(f"  → 매출조건용 상세페이지 수집 ({len(detail_text)}자)")
    except Exception as e:
        print(f"  → 매출조건용 상세페이지 요청 실패: {e}")

    for attachment in get_attachment_candidates(raw_json):
        attach_url = attachment["url"]
        attach_name = attachment["name"]
        print(f"  → 매출조건용 첨부파일 확인: {attach_name}")

        try:
            file_bytes, content_type = download_attachment(attach_url)
            attach_text, source_type = extract_text_from_attachment(
                file_bytes=file_bytes,
                content_type=content_type,
                filename=attach_name,
            )
            statuses.append(source_type)

            if attach_text:
                collected.append((attach_text, source_type))
                print(f"    → 추출 완료 ({len(attach_text)}자)")
        except Exception as e:
            print(f"    → 첨부파일 처리 실패: {e}")
            statuses.append("attachment_error")

    regex_rules = []
    candidate_windows = []

    for source_text, source_name in collected:
        source_regex_rules = extract_revenue_rules_regex(source_text)
        if source_regex_rules:
            print(f"  → {source_name} 정규식 매출조건: {len(source_regex_rules)}건")
            regex_rules.extend(source_regex_rules)

        source_windows = extract_revenue_candidate_windows(source_text)
        candidate_windows.extend(source_windows)

    # 중복 후보 문장 제거
    unique_windows = list(dict.fromkeys(candidate_windows))
    llm_rules = []

    if unique_windows and llm:
        llm_text = "\n\n".join(unique_windows[:12])
        llm_rules = extract_revenue_rules_with_llm(title, llm_text)
        if llm_rules:
            print(f"  → LLM 매출조건: {len(llm_rules)}건")
    elif not unique_windows:
        print("  → 매출 조건 후보 문장 없음")
    else:
        print("  → OPENROUTER_API_KEY 없음: 정규식 결과만 사용")

    rules = merge_revenue_rules(regex_rules, llm_rules)

    if not update_revenue_rules(policy_id, rules):
        return False

    if rules:
        print(f"  → revenue_rules 저장 완료: {len(rules)}건")
    else:
        print("  → 매출 조건 없음: 빈 배열 [] 저장")

    return True


# =========================================================
# Supabase 조회 / 업데이트
# =========================================================

def fetch_policies_without_amount(limit: int = LIMIT):
    excluded_statuses = ",".join(TERMINAL_AMOUNT_STATUSES)
    result = (
        supabase
        .table("policy")
        .select("policy_id,title,url,summary,raw_json,max_amount,amount_extraction_status")
        .like("policy_id", "PBLN_%")
        .is_("max_amount", "null")
        .or_(
            f"amount_extraction_status.is.null,"
            f"amount_extraction_status.not.in.({excluded_statuses})"
        )
        .limit(limit)
        .execute()
    )

    return result.data or []


def update_amount_extracted(policy_id: str, amount: int, source: str, evidence: str) -> bool:
    try:
        supabase.table("policy").update({
            "max_amount": amount,
            "max_amount_source": source,
            "max_amount_evidence": evidence,
            "amount_extraction_status": "extracted",
            "max_amount_note": None,
        }).eq("policy_id", policy_id).execute()
        return True
    except Exception as e:
        print(f"  → DB 저장 실패 (extracted) [{policy_id}]: {e}")
        return False


def update_amount_status(policy_id: str, status: str, note: str | None = None) -> bool:
    payload = {
        "amount_extraction_status": status,
    }
    if note is not None:
        payload["max_amount_note"] = note

    try:
        supabase.table("policy").update(payload).eq("policy_id", policy_id).execute()
        return True
    except Exception as e:
        print(f"  → DB 저장 실패 ({status}) [{policy_id}]: {e}")
        return False


def fix_pending_with_amount():
    """pending 상태이지만 max_amount가 이미 설정된 레코드를 extracted로 보정"""
    try:
        result = (
            supabase
            .table("policy")
            .update({"amount_extraction_status": "extracted"})
            .like("policy_id", "PBLN_%")
            .eq("amount_extraction_status", "pending")
            .not_.is_("max_amount", "null")
            .execute()
        )
        count = len(result.data) if result.data else 0
        print(f"[보정] pending → extracted: {count}건")
    except Exception as e:
        print(f"[보정] 상태 보정 실패: {e}")


# =========================================================
# 한 건 처리
# =========================================================

def try_extract_and_update(
    policy_id: str,
    title: str,
    text: str,
    source: str,
    use_llm: bool = True,
) -> tuple[bool, bool]:
    amount, evidence = extract_structured_table_amount(text)

    if amount:
        ok = update_amount_extracted(
            policy_id=policy_id,
            amount=amount,
            source=f"structured_table:{source}",
            evidence=evidence or "",
        )
        if ok:
            print(f"  → {source} 표 기반 추출 성공: {amount}만원")
            return True, False
        print(f"  → {source} 표에서 추출했으나 DB 저장 실패 ({amount}만원)")
        return False, False

    amount, evidence = extract_max_amount_with_evidence(text)

    if amount:
        ok = update_amount_extracted(
            policy_id=policy_id,
            amount=amount,
            source=source,
            evidence=evidence or "",
        )
        if ok:
            print(f"  → {source} 정규식 추출 성공: {amount}만원")
            return True, False
        print(f"  → {source}에서 정규식 추출했으나 DB 저장 실패 ({amount}만원)")
        return False, False

    amount, evidence, candidate_window = extract_amount_from_candidate_windows(text)
    if amount:
        ok = update_amount_extracted(
            policy_id=policy_id,
            amount=amount,
            source=f"regex_window:{source}",
            evidence=evidence or "",
        )
        if ok:
            print(f"  → {source} 후보문장 정규식 추출 성공: {amount}만원")
            return True, False
        print(f"  → {source} 후보문장에서 추출했으나 DB 저장 실패 ({amount}만원)")
        return False, False

    if not use_llm:
        return False, False

    candidate_windows = extract_amount_candidate_windows(text)
    if not candidate_windows:
        print(f"  → {source} 금액 단서 없음: LLM 생략")
        return False, False

    llm_text = "\n\n".join(candidate_windows[:4])
    amount, evidence, no_amount = extract_amount_with_llm(title, llm_text)

    if amount:
        ok = update_amount_extracted(
            policy_id=policy_id,
            amount=amount,
            source=f"llm_window:{source}",
            evidence=evidence,
        )
        if ok:
            print(f"  → {source} 후보문장 LLM 추출 성공: {amount}만원")
            return True, False
        print(f"  → {source} 후보문장에서 LLM 추출했으나 DB 저장 실패 ({amount}만원)")
        return False, False

    return False, no_amount


def enrich_one_policy(policy: dict):
    policy_id = policy.get("policy_id")
    title = policy.get("title") or ""
    summary = policy.get("summary") or ""
    url = policy.get("url") or ""
    raw_json = policy.get("raw_json") or {}

    print("\n" + "=" * 80)
    print(f"[처리] {policy_id}")
    print(title)

    if not policy_id:
        return False

    # 1차: summary 정규식 추출 + LLM fallback
    extracted, no_amount = try_extract_and_update(policy_id, title, summary, "summary", use_llm=True)
    if extracted:
        return True

    # 2차: 상세페이지 + 첨부파일 텍스트 전부 수집, 각 소스는 정규식으로 먼저 검사
    collected = []  # [(text, source_label), ...]
    statuses = []

    try:
        detail_text = fetch_detail_page_text(url)
        if detail_text and len(detail_text) >= 50:
            collected.append((detail_text, "detail_page"))
            print(f"  → 상세페이지 텍스트 수집 ({len(detail_text)}자)")
            extracted, no_amount = try_extract_and_update(
                policy_id,
                title,
                detail_text,
                "detail_page",
                use_llm=True,
            )
            if extracted:
                return True
    except Exception as e:
        print(f"  → 상세페이지 요청 실패: {e}")

    attachment_candidates = get_attachment_candidates(raw_json)

    for attachment in attachment_candidates:
        attach_url = attachment["url"]
        attach_name = attachment["name"]
        print(f"  → 첨부파일 텍스트 추출: {attach_name}")

        try:
            file_bytes, content_type = download_attachment(attach_url)
            attach_text, source_type = extract_text_from_attachment(
                file_bytes=file_bytes,
                content_type=content_type,
                filename=attach_name,
            )
            statuses.append(source_type)

            if attach_text:
                collected.append((attach_text, source_type))
                print(f"    → 추출 완료 ({len(attach_text)}자)")
                extracted, no_amount = try_extract_and_update(
                    policy_id,
                    title,
                    attach_text,
                    source_type,
                    use_llm=True,
                )
                if extracted:
                    return True
            else:
                print(f"    → 텍스트 없음: {source_type}")

        except Exception as e:
            print(f"  → 첨부파일 처리 실패: {e}")
            statuses.append("attachment_error")

    if not collected:
        if not attachment_candidates:
            update_amount_status(policy_id, "no_attachment", "첨부파일 URL 없음")
        else:
            tried = ", ".join(dict.fromkeys(statuses)) if statuses else "없음"
            update_amount_status(policy_id, "llm_failed", f"텍스트 추출 실패 ({tried})")
        print("  → 수집된 텍스트 없음")
        return False

    # 상세페이지와 첨부파일을 함께 사용해 LLM 1회 호출
    best_text, best_source = get_best_text_for_llm(collected)
    candidate_windows = extract_amount_candidate_windows(best_text)
    if not candidate_windows:
        no_cash, no_cash_evidence = classify_no_cash_support(title, best_text)
        if no_cash:
            dump_debug_text(policy_id, title, collected, "현금 지원금액 없음")
            update_amount_status(
                policy_id,
                "no_cash_amount",
                f"현금 지원금액 없음: {no_cash_evidence}",
            )
            print("  → 현금 지원금액 없음: no_cash_amount")
            return False

        dump_debug_text(policy_id, title, collected, "금액 단서 없음")
        update_amount_status(
            policy_id,
            "needs_review",
            f"금액 단서 없음 (수집 {len(collected)}건, 첨부 상태: {', '.join(dict.fromkeys(statuses)) if statuses else '없음'})",
        )
        print("  → 금액 단서 없음: needs_review")
        return False

    print(f"  → LLM 호출: {best_source} ({len(best_text)}자) — 수집 {len(collected)}건 기반")

    extracted, no_amount = try_extract_and_update(policy_id, title, best_text, best_source)
    if extracted:
        return True

    if no_amount:
        no_cash, no_cash_evidence = classify_no_cash_support(title, best_text)
        if no_cash:
            dump_debug_text(policy_id, title, collected, "현금 지원금액 없음")
            update_amount_status(
                policy_id,
                "no_cash_amount",
                f"현금 지원금액 없음: {no_cash_evidence}",
            )
            print("  → 현금 지원금액 없음: no_cash_amount")
            return False

        dump_debug_text(policy_id, title, collected, "LLM 지원금액 없음 판단")
        update_amount_status(
            policy_id,
            "needs_review",
            f"LLM은 지원금액 없음으로 판단했으나 확정 보류 (소스: {best_source}, 수집 {len(collected)}건)",
        )
        print("  → 지원금액 없음 판단 보류: needs_review")
        return False

    tried = ", ".join(dict.fromkeys(statuses)) if statuses else "없음"
    note = f"LLM 금액 추출 실패 (소스: {best_source}, 수집 {len(collected)}건, 첨부 상태: {tried})"
    no_cash, no_cash_evidence = classify_no_cash_support(title, best_text)
    if no_cash:
        dump_debug_text(policy_id, title, collected, "현금 지원금액 없음")
        update_amount_status(
            policy_id,
            "no_cash_amount",
            f"현금 지원금액 없음: {no_cash_evidence}",
        )
        print("  → 현금 지원금액 없음: no_cash_amount")
        return False

    dump_debug_text(policy_id, title, collected, "LLM 금액 추출 실패")
    update_amount_status(policy_id, "llm_failed", note)
    print("  → 금액 추출 실패: llm_failed")
    return False


# =========================================================
# 실행
# =========================================================

def run_amount_enrichment():
    """기존 최대 지원금액 보강 작업"""
    fix_pending_with_amount()

    policies = fetch_policies_without_amount(limit=LIMIT)
    print(f"max_amount NULL 공고 조회: {len(policies)}건")

    success_count = 0
    fail_count = 0

    for policy in policies:
        ok = enrich_one_policy(policy)

        if ok:
            success_count += 1
        else:
            fail_count += 1

        time.sleep(SLEEP_SECONDS)

    print("\n" + "=" * 80)
    print("지원금 보강 완료")
    print(f"성공: {success_count}건")
    print(f"실패: {fail_count}건")


def run_revenue_enrichment():
    """트랙별 매출 조건 revenue_rules 보강 작업"""
    policies = fetch_policies_without_revenue_rules(limit=REVENUE_LIMIT)
    print(f"revenue_rules NULL 공고 조회: {len(policies)}건")

    success_count = 0
    fail_count = 0

    for policy in policies:
        ok = enrich_one_policy_revenue(policy)

        if ok:
            success_count += 1
        else:
            fail_count += 1

        time.sleep(SLEEP_SECONDS)

    print("\n" + "=" * 80)
    print("매출 조건 보강 완료")
    print(f"처리 성공: {success_count}건")
    print(f"처리 실패: {fail_count}건")


def main():
    print("=" * 80)
    print("정책 상세정보 보강 시작")
    print("1단계: 최대 지원금액")
    print("2단계: 매출 조건 revenue_rules")

    run_amount_enrichment()
    run_revenue_enrichment()

    print("\n" + "=" * 80)
    print("정책 상세정보 보강 전체 완료")


if __name__ == "__main__":
    main()
