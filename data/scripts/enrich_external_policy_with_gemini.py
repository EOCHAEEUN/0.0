from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from supabase import Client, create_client

import collect_external_policy_sources as collector
import upload_final as core


SOURCE_CHOICES = [
    "all",
    "smart-factory",
    "energy-agency",
    "kosmes",
    "technopark",
]
SOURCE_DB_NAMES = {
    "smart-factory": "smart_factory",
    "energy-agency": "energy_agency",
    "kosmes": "kosmes",
    "technopark": "technopark",
}
SUPPORT_TYPES = {
    "현금보조",
    "바우처",
    "융자",
    "이차보전",
    "보증",
    "현물서비스",
    "공동장비",
    "지원비율",
    "복합지원",
    "확인불가",
}
SUPPORT_TRACKS = {
    "핵심설비",
    "제조기술개발",
    "시험인증",
    "공동장비활용",
    "에너지효율",
    "제조인력",
    "일반제조지원",
}
CASH_TYPES = {"현금보조", "바우처"}
NON_CASH_TYPES = {"융자", "이차보전", "보증", "현물서비스", "공동장비"}
DISPLAY_SUPPORT_CATEGORIES = {
    "지원금",
    "금융지원",
    "기술·사업화",
    "시험·인증",
    "장비·공간",
    "인력·교육",
}
DISPLAY_CATEGORY_PRIORITY = [
    "지원금",
    "금융지원",
    "기술·사업화",
    "시험·인증",
    "장비·공간",
    "인력·교육",
]
ENRICHMENT_KEY = "gemini_policy_enrichment_v7"
PROMPT_VERSION = "structured_summary_v10_direct_amount_recovery"

AMOUNT_ROLES = {
    "정부지원금",
    "기관지원금",
    "융자한도",
    "서비스가치",
    "총사업비",
    "주관기관부담금",
    "기업부담금",
    "자부담",
    "기타",
    "확인불가",
}
REPRESENTATIVE_AMOUNT_ROLES = {"정부지원금", "기관지원금"}
DIRECT_SUPPORT_AMOUNT_SIGNALS = [
    "현금지원",
    "현금 지원",
    "직접지원",
    "직접 지원",
    "정부지원금",
    "정부 지원금",
    "기관지원금",
    "기관 지원금",
    "지원액",
    "지원규모",
    "지원 규모",
    "지원한도",
    "지원 한도",
    "기업당 최대",
    "과제당 최대",
    "건당 최대",
    "기업당",
    "과제당",
    "지원",
]
NON_SUPPORT_AMOUNT_SIGNALS = [
    "총사업비",
    "총 사업비",
    "주관기관 부담",
    "주관기관부담",
    "도입기업 부담",
    "도입기업부담",
    "기업부담",
    "기업 부담",
    "자부담",
    "민간부담",
    "분담비율",
]
DEFAULT_CACHE_PATH = (
    Path(__file__).resolve().parent.parent
    / "cache"
    / "external_policy_gemini_enrichment.json"
)
SELECT_COLUMNS = ",".join(
    [
        "policy_id",
        "source_name",
        "source_id",
        "title",
        "organization",
        "region",
        "url",
        "deadline",
        "deadline_display",
        "policy_category",
        "policy_subcategory",
        "summary",
        "detail_text",
        "attachment_text",
        "raw_text",
        "eligibility_text",
        "max_amount_actual",
        "max_amount_status",
        "max_amount_type",
        "max_amount_numeric_manwon",
        "max_amount_evidence",
        "required_documents_json",
        "temp_extraction_json",
    ]
)


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Read existing policy_external_collected rows and enrich summary, "
            "support amount, eligibility, and required documents with one Gemini "
            "call per policy. This script never recollects announcements."
        )
    )
    parser.add_argument("--source", choices=SOURCE_CHOICES, default="all")
    parser.add_argument(
        "--target-table",
        default=collector.DEFAULT_TARGET_TABLE,
    )
    parser.add_argument(
        "--policy-id",
        action="append",
        default=[],
        help="Process only this policy_id. May be supplied multiple times.",
    )
    parser.add_argument("--limit", type=int, default=0, help="0 means all")
    parser.add_argument(
        "--dry-run",
        type=int,
        choices=[0, 1],
        default=1,
        help="Default 1. Use 0 to update validated fields in Supabase.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help=f"Reprocess rows already marked with {ENRICHMENT_KEY}.",
    )
    parser.add_argument(
        "--include-without-attachment",
        action="store_true",
        help="Also analyze rows whose attachment_text is empty.",
    )
    parser.add_argument(
        "--model",
        default=collector.DEFAULT_GEMINI_MODEL,
    )
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument(
        "--cache-path",
        default=str(DEFAULT_CACHE_PATH),
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Do not reuse a prior Gemini response with the same source hash.",
    )
    parser.add_argument(
        "--csv-output",
        default="",
        help="Optional comparison report path.",
    )
    return parser.parse_args()


def as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def load_cache(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_cache(path: Path, cache: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def extract_json_object(text: str) -> dict[str, Any] | None:
    cleaned = str(text or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(cleaned[start : end + 1])
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


SECTION_LABEL_GROUPS = {
    "사업 목적": [
        "사업목적",
        "사업 목적",
        "추진목적",
        "추진 목적",
        "사업개요",
        "사업 개요",
        "모집개요",
        "모집 개요",
    ],
    "지원 내용": [
        "지원내용",
        "지원 내용",
        "지원분야",
        "지원 분야",
        "지원프로그램",
        "지원 프로그램",
        "사업내용",
        "사업 내용",
    ],
    "지원 규모·금액": [
        "지원규모",
        "지원 규모",
        "지원한도",
        "지원 한도",
        "지원금",
        "정부지원금",
        "정부출연금",
        "지원조건",
        "지원 조건",
        "사업비",
        "기업당",
        "과제당",
    ],
    "지원 대상·자격": [
        "지원대상",
        "지원 대상",
        "신청대상",
        "신청 대상",
        "신청자격",
        "신청 자격",
        "지원자격",
        "지원 자격",
        "참여자격",
        "참여 자격",
    ],
    "신청·제출서류": [
        "신청방법",
        "신청 방법",
        "접수방법",
        "접수 방법",
        "제출서류",
        "제출 서류",
        "구비서류",
        "구비 서류",
        "신청서류",
        "신청 서류",
        "필수서류",
        "필수 서류",
    ],
}


def clean_source_text(value: Any, max_len: int = 60000) -> str:
    return core.clean_text(value, max_len)


def text_window(
    text: str,
    center: int,
    before: int = 450,
    after: int = 1500,
) -> str:
    return core.clean_text(
        text[max(0, center - before) : min(len(text), center + after)],
        before + after,
    )


def section_windows(
    text: str,
    labels: list[str],
    *,
    max_windows: int = 3,
) -> list[str]:
    candidates: list[tuple[int, str]] = []
    for label in labels:
        start = 0
        while len(candidates) < max_windows * 3:
            index = text.find(label, start)
            if index < 0:
                break
            candidates.append((index, text_window(text, index)))
            start = index + len(label)

    selected: list[str] = []
    seen: set[str] = set()
    for _, window in sorted(candidates, key=lambda item: item[0]):
        fingerprint = compact_evidence_text(window[:300])
        if not fingerprint or fingerprint in seen:
            continue
        if any(
            fingerprint[:100] in existing
            or existing[:100] in fingerprint
            for existing in seen
        ):
            continue
        seen.add(fingerprint)
        selected.append(window)
        if len(selected) >= max_windows:
            break
    return selected


def selected_document_sections(
    detail_text: str,
    attachment_text: str,
    raw_text: str,
) -> dict[str, str]:
    combined = "\n\n".join(
        text
        for text in [detail_text, attachment_text]
        if text
    )
    if not combined:
        combined = raw_text
    if not combined:
        return {}

    sections: dict[str, str] = {
        "문서 앞부분": core.clean_text(combined[:4000], 4000),
    }
    for group_name, labels in SECTION_LABEL_GROUPS.items():
        windows = section_windows(combined, labels)
        if windows:
            sections[group_name] = core.clean_text(
                "\n\n".join(windows),
                3500,
            )
    if len(combined) > 5000:
        sections["문서 뒷부분"] = core.clean_text(combined[-2500:], 2500)
    return sections


def source_sections(row: dict[str, Any]) -> dict[str, str]:
    detail_text = clean_source_text(row.get("detail_text"), 30000)
    attachment_text = clean_source_text(
        row.get("attachment_text"),
        50000,
    )
    raw_text = clean_source_text(row.get("raw_text"), 30000)
    candidates = {
        "공고 제목": core.clean_text(row.get("title"), 300),
        **selected_document_sections(
            detail_text,
            attachment_text,
            raw_text,
        ),
    }
    sections: dict[str, str] = {}
    remaining = 25000
    for label, text in candidates.items():
        if not text or remaining <= 0:
            continue
        selected = core.clean_text(text, remaining)
        if selected:
            sections[label] = selected
            remaining -= len(selected)
    return sections


def compact_evidence_text(value: Any) -> str:
    return re.sub(
        r"[^0-9A-Za-z가-힣%]",
        "",
        core.clean_text(value),
    ).lower()


def evidence_in_source(evidence: Any, row: dict[str, Any]) -> bool:
    compact_evidence = compact_evidence_text(evidence)
    if len(compact_evidence) < 8:
        return False
    compact_source = compact_evidence_text(
        "\n".join(source_sections(row).values())
    )
    if compact_evidence in compact_source:
        return True

    chunk_size = 14
    chunks = [
        compact_evidence[index : index + chunk_size]
        for index in range(0, len(compact_evidence), chunk_size)
        if len(compact_evidence[index : index + chunk_size]) >= 10
    ]
    matched = sum(chunk in compact_source for chunk in chunks)
    if chunks and matched / len(chunks) >= 0.6:
        return True

    tokens = re.findall(
        r"[가-힣A-Za-z]{2,}|\d+(?:\.\d+)?%?",
        core.clean_text(evidence),
    )
    distinctive = [
        token
        for token in tokens
        if token not in {"최대", "지원", "이내", "이하", "이상", "확정"}
    ]
    if len(distinctive) < 2:
        return False
    token_matches = sum(
        compact_evidence_text(token) in compact_source
        for token in distinctive
    )
    return token_matches / len(distinctive) >= 0.65


def source_hash(row: dict[str, Any], model: str) -> str:
    source = {
        "prompt_version": PROMPT_VERSION,
        "model": model,
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "sections": source_sections(row),
    }
    serialized = json.dumps(source, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def build_prompt(row: dict[str, Any]) -> str:
    sections = source_sections(row)
    source_text = "\n\n".join(
        f"### {label}\n{text}"
        for label, text in sections.items()
        if text
    )
    return f"""
아래 정부·공공기관 지원사업 원문을 검수하여 JSON 객체 하나만 출력하세요.
원문에 없는 내용은 추측하지 마세요.

공고 정보:
- 정책 ID: {core.clean_text(row.get("policy_id"))}
- 제목: {core.clean_text(row.get("title"))}
- 기관: {core.clean_text(row.get("organization"))}
- 지역: {core.clean_text(row.get("region"))}
- 마감: {core.clean_text(row.get("deadline_display"))}

지원 유형 허용값:
- 현금보조: 반환 의무 없는 보조금, 정부출연금, 사업비 직접 지원
- 바우처: 정해진 서비스 구매에 쓰는 바우처
- 융자: 상환해야 하는 정책자금·대출
- 이차보전: 대출 이자 일부 지원
- 보증: 신용보증·보증서
- 현물서비스: 컨설팅, 기술지도, 멘토링, 교육 등 비현금 서비스
- 공동장비: 장비·시설·시험장비 이용
- 지원비율: 금액 없이 지원 비율만 확인
- 복합지원: 서로 다른 지원 유형이 둘 이상 존재
- 확인불가

지원 목적 트랙 허용값:
핵심설비, 제조기술개발, 시험인증, 공동장비활용, 에너지효율,
제조인력, 일반제조지원

중요 규칙:
1. purpose와 support_content는 각각 완결된 한 문장으로 작성하세요.
2. 두 문장은 반드시 "합니다", "지원합니다", "사업입니다"처럼 완결형으로 끝내세요.
3. purpose_evidence와 support_content_evidence에 직접적인 원문 근거를 적으세요.
4. 날짜, 마감일, 지원 대상, 지원 금액을 purpose나 support_content에 넣지 마세요.
5. support_packages에는 서로 다른 지원 항목을 모두 기록하세요.
   같은 유형이어도 지원 목적이 다르면 별도 항목으로 나누고,
   name에는 "시제품 제작비", "전문가 컨설팅", "시험·인증비"처럼
   사용자가 이해할 수 있는 짧은 지원 항목명을 작성하세요.
   금액이 없어도 원문에서 컨설팅, 기술지도, 멘토링, 교육, 장비 활용,
   시설 이용, 시험, 분석, 인증, 성능평가, 시제품 제작, 특허, 마케팅 등
   구체적인 지원이 확인되면 반드시 별도 항목으로 기록하세요.
   이 경우 amount_actual, amount_numeric_manwon, support_ratio는 null로 두고,
   원문 지원 문장을 evidence에 기록하세요.
6. 총예산, 전체 사업비, 매출액, 수출액, 자부담, 민간부담금,
   수수료, 급여, 성과 수치는 기업이 받는 지원금으로 보지 마세요.
7. amount_numeric_manwon은 원문 금액을 만원 단위 숫자로 변환하세요.
8. 융자·이차보전·보증·현물서비스·공동장비는 금액이 있어도
   roi_deductible을 false로 두세요.
9. 현금보조·바우처도 기업당/과제당 한도와 원문 근거가 명확할 때만
   roi_deductible을 true로 두세요.
10. evidence는 원문에서 확인되는 짧고 직접적인 근거 문장이어야 합니다.
   금액 항목의 evidence에는 반환한 금액 숫자와 지원금·한도·보조금 등
   금액의 성격을 설명하는 표현이 함께 있어야 합니다.
11. eligibility와 required_documents도 근거가 없으면 빈 값으로 두세요.
12. 지원 대상이 여러 유형이면 빠뜨리지 말고 eligibility_text에 요약하세요.
13. eligibility_text는 단순히 "기업", "중소기업", "도입기업"이라고만
    작성하지 말고 지역·업종·기업규모·선정조건 등 확인 가능한 구체 조건을
    함께 작성하세요. 구체 조건이 없으면 빈 값으로 두세요.
14. 현금보조·바우처는 실제 비용 지급, 보조금, 출연금, 사업비 또는
    지원 비율이 원문에 명시된 경우에만 사용하세요. 단순히 시제품 제작,
    컨설팅, 인증 등을 "지원한다"는 문장만 있고 금액·비율·비용 지급 근거가
    없다면 현물서비스로 분류하세요.
15. 지원 항목의 type은 지급 방식이고 name과 subtype은 지원 목적입니다.
    시험·인증비, 교육비, 장비 도입비처럼 현금으로 지급되더라도 목적을
    name과 subtype에 분명하게 기록하세요.
16. 원가계산비, 기술임치비, 수수료, 이용료, 부가세 등이 신청기업이나
    사업비에 "필수 편성", "의무 부담", "납부"되는 비용이면 지원 항목이
    아닙니다. support_packages에 넣지 마세요. 다만 해당 비용을 기관이
    명시적으로 지원·보조·면제한다는 근거가 있으면 지원 항목으로 기록하세요.
17. 금액표에서는 정부지원금, 주관기관 부담금, 도입기업 부담금, 자부담,
    총사업비를 반드시 구분하세요. 주관기관·기업 부담금과 총사업비는
    지원 패키지 금액으로 만들지 마세요.
18. amount_role 허용값은 정부지원금, 기관지원금, 융자한도, 서비스가치,
    총사업비, 주관기관부담금, 기업부담금, 자부담, 기타, 확인불가입니다.
    현금보조와 바우처는 정부지원금 또는 기관지원금일 때만 확정하세요.
19. payer에는 실제 비용을 지급하는 정부·지자체·기관명을, recipient에는
    지원을 받는 기업·기관을 적으세요. 표 구조상 주체를 연결할 수 없으면
    amount_role을 확인불가로 두고 roi_deductible을 false로 설정하세요.
20. 기초·고도화·동일수준·기업성장단계·지역처럼 지원금이 달라지는 조건은
    condition_label에 기록하세요. 같은 조건에서 정부·주관기관·기업이
    나누어 부담하는 금액을 각각 별도 지원 패키지로 만들면 안 됩니다.
21. 지원 금액이 숫자 없이 비율만 확인되면 amount_actual과
    amount_numeric_manwon은 null, support_ratio만 기록하세요.
22. 현금지원, 직접지원, 지원액, 지원규모, 지원한도, 기업당 최대,
    과제당 최대, 건당 최대처럼 금액 성격이 직접 명시되면 해당 금액과
    단위를 빠뜨리지 마세요. 총사업비나 부담금과 함께 나열된 숫자는 제외하세요.

출력 형식:
{{
  "purpose": "지원사업의 핵심 목적을 설명하는 완결된 문장입니다.",
  "purpose_evidence": "사업 목적 원문 근거",
  "support_content": "기업에 제공하는 주요 지원 내용을 설명합니다.",
  "support_content_evidence": "지원 내용 원문 근거",
  "support_types": ["현금보조"],
  "support_tracks": ["핵심설비"],
  "support_packages": [
    {{
      "type": "현금보조",
      "name": "시제품 제작비",
      "subtype": "시제품 제작",
      "amount_actual": "기업당 최대 2억원",
      "amount_numeric_manwon": 20000,
      "support_ratio": 50,
      "amount_role": "정부지원금",
      "payer": "정부",
      "recipient": "지원기업",
      "condition_label": "고도화",
      "evidence": "총사업비의 50%, 기업당 최대 2억원 지원",
      "roi_deductible": true,
      "status": "확정"
    }}
  ],
  "eligibility_text": "지원 대상 요약",
  "eligibility_evidence": "지원 대상 원문 근거",
  "required_documents": [
    {{
      "name": "사업신청서",
      "required": true,
      "evidence": "제출서류 원문 근거"
    }}
  ],
  "review_notes": []
}}

원문:
{source_text}
""".strip()


def call_gemini(
    prompt: str,
    model: str,
    api_key: str,
) -> dict[str, Any]:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model.removeprefix('models/')}:generateContent"
    )
    body = {
        "systemInstruction": {
            "parts": [
                {
                    "text": (
                        "당신은 한국 정부지원사업 공고를 구조화하는 데이터 "
                        "검수자입니다. 원문 근거가 없는 값은 만들지 않고, "
                        "반드시 유효한 JSON 객체만 출력합니다."
                    )
                }
            ]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        },
    }
    for json_attempt in range(2):
        if json_attempt:
            body["contents"][0]["parts"][0]["text"] = (
                prompt
                + "\n\n이전 응답은 JSON 형식이 올바르지 않았습니다. "
                "설명이나 코드블록 없이 유효한 JSON 객체 하나만 다시 출력하세요."
            )
        response = None
        for api_attempt in range(1, 4):
            response = requests.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key,
                },
                json=body,
                timeout=120,
            )
            if response.status_code not in {429, 500, 502, 503, 504}:
                break
            if api_attempt < 3:
                time.sleep(2**api_attempt)
        assert response is not None
        response.raise_for_status()
        payload = response.json()
        texts = [
            str(part.get("text"))
            for candidate in payload.get("candidates") or []
            for part in (candidate.get("content") or {}).get("parts") or []
            if part.get("text")
        ]
        parsed = extract_json_object("\n".join(texts))
        if parsed:
            return parsed
    raise ValueError("Gemini response did not contain a valid JSON object")


INCOMPLETE_SENTENCE_ENDINGS = (
    "목표로",
    "대상으로",
    "지원하며",
    "지원하고",
    "신청해야",
    "하고자",
    "통해",
    "위해",
    "예정",
)
GENERIC_ELIGIBILITY_VALUES = {
    "기업",
    "도입 기업",
    "도입기업",
    "중소기업",
    "중소·중견기업",
    "중소중견기업",
    "충남 소재 기업",
    "강원지역 중소기업",
    "스마트공장 구축 대상 기업",
    "지원 대상 기업",
}


def normalize_complete_sentence(value: Any) -> str | None:
    sentence = core.clean_text(value, 320).strip(" -")
    if len(sentence) < 15:
        return None
    if sentence.endswith(INCOMPLETE_SENTENCE_ENDINGS):
        return None
    if not sentence.endswith(
        (
            "다.",
            "니다.",
            "합니다.",
            "됩니다.",
            "있습니다.",
            "사업입니다.",
        )
    ):
        return None
    return sentence


def shorten_complete_sentence(
    sentence: str,
    max_len: int = 210,
) -> str | None:
    normalized = core.clean_text(sentence, 320).strip(" -")
    if len(normalized) <= max_len:
        return normalize_complete_sentence(normalized)

    body = normalized.rstrip(".")
    ending = next(
        (
            suffix
            for suffix in [
                "지원합니다",
                "사업입니다",
                "확인해야 합니다",
                "합니다",
                "됩니다",
                "있습니다",
                "입니다",
            ]
            if body.endswith(suffix)
        ),
        "입니다",
    )
    stem = body[: -len(ending)] if body.endswith(ending) else body
    available = max_len - len(ending) - 1
    shortened = stem[:available].rstrip()
    if " " in shortened:
        shortened = shortened.rsplit(" ", 1)[0].rstrip(" ,·/")
    candidate = f"{shortened}{ending}."
    return normalize_complete_sentence(candidate)


def store_structured_summary(lines: list[str]) -> str | None:
    if len(lines) != 5:
        return None
    stored: list[str] = []
    for line in lines:
        shortened = shorten_complete_sentence(line)
        if not shortened:
            return None
        stored.append(f"- {shortened}")
    return "\n".join(stored)


def normalize_grounded_sentence(
    sentence_value: Any,
    evidence_value: Any,
    row: dict[str, Any],
) -> str | None:
    sentence = normalize_complete_sentence(sentence_value)
    evidence = core.clean_text(evidence_value, 500)
    if not sentence or not evidence or not evidence_in_source(evidence, row):
        return None
    return sentence


def amount_is_grounded(
    numeric_manwon: float | None,
    evidence: str,
    row: dict[str, Any],
) -> bool:
    if numeric_manwon is None:
        return True
    evidence_candidates = core.extract_amount_candidates(
        evidence,
        require_support_context=False,
    )
    evidence_matches = any(
        abs(float(candidate["manwon"]) - numeric_manwon)
        <= max(1.0, numeric_manwon * 0.01)
        for candidate in evidence_candidates
    )
    if not evidence_matches:
        return False

    source_candidates = core.extract_amount_candidates(
        "\n".join(source_sections(row).values()),
        require_support_context=True,
    )
    return any(
        abs(float(candidate["manwon"]) - numeric_manwon)
        <= max(1.0, numeric_manwon * 0.01)
        for candidate in source_candidates
    )


def canonical_deadline_display(row: dict[str, Any]) -> str:
    deadline = core.clean_text(row.get("deadline"))
    display = core.clean_text(row.get("deadline_display"))
    if display and display not in {"미정", "확인 필요"}:
        reference_year = core.infer_reference_year(display, deadline)
        dates = core.extract_all_dates(
            display,
            reference_year=reference_year,
        )
        times = re.findall(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)", display)
        normalized_times = [f"{int(hour):02d}:{minute}" for hour, minute in times]
        if len(dates) >= 2:
            start = dates[0]
            end = dates[-1]
            if len(normalized_times) >= 2:
                start += f" {normalized_times[0]}"
                end += f" {normalized_times[-1]}"
            elif len(normalized_times) == 1:
                end += f" {normalized_times[0]}"
            return f"{start} ~ {end}"
        if len(dates) == 1:
            value = dates[0]
            if normalized_times:
                value += f" {normalized_times[-1]}"
            return value
    return deadline


def summary_deadline_line(row: dict[str, Any]) -> str:
    display = canonical_deadline_display(row)
    if " ~ " in display:
        return f"신청 기간은 {display}입니다."
    if display:
        return f"신청 마감일은 {display}입니다."
    return "신청 마감일은 공식 공고에서 확인해야 합니다."


def support_item_sort_key(
    item: dict[str, Any],
    representative: dict[str, Any] | None = None,
) -> tuple[Any, ...]:
    category_priority = {
        category: index
        for index, category in enumerate(DISPLAY_CATEGORY_PRIORITY)
    }
    numeric = item.get("amount_manwon")
    ratio = item.get("support_ratio")
    representative_match = False
    if representative:
        representative_numeric = representative.get("amount_numeric_manwon")
        representative_ratio = representative.get("support_ratio")
        same_funding_type = (
            core.clean_text(item.get("funding_type"))
            == core.clean_text(representative.get("type"))
        )
        if (
            same_funding_type
            and representative_numeric is not None
            and numeric is not None
        ):
            representative_match = float(numeric) == float(representative_numeric)
        elif (
            same_funding_type
            and representative_ratio is not None
            and ratio is not None
        ):
            representative_match = float(ratio) == float(representative_ratio)
    return (
        0 if representative_match else 1,
        -(float(numeric) if numeric is not None else 0),
        -(float(ratio) if ratio is not None else 0),
        category_priority.get(core.clean_text(item.get("category")), 99),
        core.clean_text(item.get("name")),
    )


def summary_support_items_line(
    items: list[dict[str, Any]],
    representative: dict[str, Any] | None = None,
) -> str:
    ordered = sorted(
        items,
        key=lambda item: support_item_sort_key(item, representative),
    )
    phrases: list[str] = []
    for item in ordered[:3]:
        name = core.clean_text(item.get("name"), 70)
        amount = core.clean_text(item.get("amount"), 90)
        if name and amount:
            phrases.append(f"{name} {amount}")
        elif name:
            phrases.append(name)
    if phrases:
        return f"주요 지원은 {', '.join(phrases)}입니다."
    return "지원 규모와 방식은 공식 공고에서 확인해야 합니다."


def normalize_eligibility(
    text_value: Any,
    evidence_value: Any,
    row: dict[str, Any],
) -> tuple[str | None, str | None]:
    text = core.clean_text(text_value, 4000).strip()
    evidence = core.clean_text(evidence_value, 1200)
    if not text or not evidence or not evidence_in_source(evidence, row):
        return None, None

    compact = re.sub(r"\s+", " ", text).strip(" .")
    if compact in GENERIC_ELIGIBILITY_VALUES:
        return None, None
    if len(compact) < 12:
        return None, None

    specificity_signals = [
        "소재",
        "업종",
        "제조",
        "식품",
        "정보보호",
        "협력사",
        "중소기업기본법",
        "중견기업",
        "사업자등록",
        "본사",
        "공장",
        "매출",
        "근로자",
        "설립",
        "선정",
        "영위",
        "지역",
        "법인",
    ]
    if not any(signal in compact for signal in specificity_signals):
        return None, None
    return compact, evidence


def build_structured_summary(
    row: dict[str, Any],
    enrichment: dict[str, Any],
) -> str | None:
    purpose = enrichment.get("purpose")
    support_content = enrichment.get("support_content")
    if not purpose or not support_content:
        return None

    eligibility = core.clean_text(
        enrichment.get("eligibility_text"),
        240,
    )
    if eligibility:
        eligibility = eligibility.rstrip(".")
        eligibility_line = (
            f"지원 대상은 {eligibility}."
            if eligibility.endswith(("입니다", "합니다", "됩니다"))
            else f"지원 대상은 {eligibility}입니다."
        )
    else:
        eligibility_line = "지원 대상은 공식 공고에서 확인해야 합니다."
    lines = [
        purpose,
        support_content,
        eligibility_line,
        summary_support_items_line(
            enrichment.get("support_items") or [],
            enrichment.get("representative_package"),
        ),
        summary_deadline_line(row),
    ]
    return store_structured_summary(lines)


def normalize_support_types(value: Any) -> list[str]:
    values = value if isinstance(value, list) else []
    result = [
        core.clean_text(item)
        for item in values
        if core.clean_text(item) in SUPPORT_TYPES
    ]
    return list(dict.fromkeys(result))


def normalize_support_tracks(value: Any) -> list[str]:
    values = value if isinstance(value, list) else []
    result = [
        core.clean_text(item)
        for item in values
        if core.clean_text(item) in SUPPORT_TRACKS
    ]
    return list(dict.fromkeys(result))


def infer_amount_role(
    value: Any,
    package_type: str,
    package_label: str,
    evidence: str,
) -> str:
    declared = core.clean_text(value)
    if declared in AMOUNT_ROLES:
        return declared
    context = f"{package_label} {evidence}"
    if package_type == "융자":
        return "융자한도"
    if package_type in {"현물서비스", "공동장비"}:
        return "서비스가치"
    role_signals = [
        ("기업부담금", ["도입기업 부담", "기업부담", "기업 부담"]),
        ("주관기관부담금", ["주관기관 부담", "주관기관부담"]),
        ("자부담", ["자부담", "민간부담"]),
        (
            "정부지원금",
            [
                "정부지원금",
                "정부 지원금",
                "국비 지원",
                "국고 지원",
                "정부지원한도",
            ],
        ),
        (
            "기관지원금",
            [
                "지자체 지원",
                "기관 지원",
                "지원금 지급",
                "보조금 지급",
                "기업당 최대",
                "과제당 최대",
            ],
        ),
        ("총사업비", ["총사업비", "총 사업비"]),
    ]
    for role, signals in role_signals:
        if any(signal in context for signal in signals):
            return role
    if package_type in CASH_TYPES and any(
        signal in context
        for signal in ["지원가능", "지원 가능", "지원한도", "지원 한도", "출연금"]
    ):
        return "정부지원금"
    return "확인불가"


def recover_direct_support_amount(
    evidence: str,
    amount_actual: str | None,
    amount_role: str,
) -> tuple[float | None, str | None]:
    if amount_role not in REPRESENTATIVE_AMOUNT_ROLES:
        return None, amount_actual

    source = " ".join(filter(None, [evidence, amount_actual]))
    if not source:
        return None, amount_actual
    candidates = core.extract_amount_candidates(
        source,
        require_support_context=False,
    )
    eligible: list[dict[str, Any]] = []
    for candidate in candidates:
        context = core.clean_text(candidate.get("context"), 400)
        has_direct_signal = any(
            signal in context for signal in DIRECT_SUPPORT_AMOUNT_SIGNALS
        )
        has_maximum_signal = "최대" in context and any(
            unit in context
            for unit in ["억원", "억 원", "백만원", "백만 원", "만원", "만 원", "천원", "천 원"]
        )
        has_non_support_signal = any(
            signal in context for signal in NON_SUPPORT_AMOUNT_SIGNALS
        )
        has_explicit_support_role = any(
            signal in context
            for signal in [
                "현금지원",
                "현금 지원",
                "직접지원",
                "직접 지원",
                "정부지원금",
                "정부 지원금",
                "기관지원금",
                "기관 지원금",
                "지원한도",
                "지원 한도",
            ]
        )
        if not has_direct_signal and not has_maximum_signal:
            continue
        if has_non_support_signal and not has_explicit_support_role:
            continue
        eligible.append(candidate)

    unique_amounts = {
        round(float(candidate["manwon"]), 2)
        for candidate in eligible
    }
    if len(unique_amounts) != 1:
        return None, amount_actual
    numeric_value = unique_amounts.pop()
    return numeric_value, (
        amount_actual or core.format_amount_manwon(numeric_value)
    )


def normalize_condition_label(value: Any) -> str | None:
    condition = core.clean_text(value, 100)
    if not condition:
        return None
    compact = re.sub(r"\s+", "", condition)
    allowed_patterns = [
        r"기초(?:단계|수준)?",
        r"고도화\d+",
        r"동일수준",
        r"초기기업",
        r"잠재기업",
        r"성장나래",
        r"예비선도",
        r"선도기업",
        r"스타기업",
        r"중간\d+이상",
        r"강릉시",
        r"동해시",
    ]
    if any(re.fullmatch(pattern, compact) for pattern in allowed_patterns):
        return compact
    return None


def normalize_package(
    value: Any,
    row: dict[str, Any],
) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    package_type = core.clean_text(value.get("type"))
    evidence = core.clean_text(value.get("evidence"), 500)
    if package_type not in SUPPORT_TYPES or package_type == "확인불가":
        return None
    if not evidence or not evidence_in_source(evidence, row):
        return None
    if any(
        excluded in evidence
        for excluded in [
            "개인정보 수집",
            "개인정보 이용",
            "제3자 제공 동의서",
            "사업자등록증명원과 동일",
            "신청서 양식",
            "공란처리",
        ]
    ):
        return None

    numeric = value.get("amount_numeric_manwon")
    try:
        numeric_value = round(float(numeric), 2) if numeric is not None else None
    except (TypeError, ValueError):
        numeric_value = None
    if numeric_value is not None and numeric_value <= 0:
        numeric_value = None
    if not amount_is_grounded(numeric_value, evidence, row):
        numeric_value = None

    ratio = value.get("support_ratio")
    try:
        ratio_value = round(float(ratio), 2) if ratio is not None else None
    except (TypeError, ValueError):
        ratio_value = None
    if ratio_value is not None and not 0 < ratio_value <= 100:
        ratio_value = None

    requested_roi_deductible = bool(value.get("roi_deductible"))
    roi_deductible = requested_roi_deductible
    if package_type not in CASH_TYPES:
        roi_deductible = False
    if roi_deductible and numeric_value is None:
        roi_deductible = False
    amount_actual = core.clean_text(value.get("amount_actual"), 160) or None
    name = core.clean_text(
        value.get("name") or value.get("subtype"),
        100,
    ) or None
    subtype = core.clean_text(value.get("subtype"), 100) or None
    package_label = " ".join(filter(None, [name, subtype]))
    amount_role = infer_amount_role(
        value.get("amount_role"),
        package_type,
        package_label,
        evidence,
    )
    payer = core.clean_text(value.get("payer"), 100) or None
    recipient = core.clean_text(value.get("recipient"), 100) or None
    condition_label = normalize_condition_label(value.get("condition_label"))
    if not condition_label:
        condition_match = re.search(
            r"(기초단계|기초수준|기초|고도화\s*\d+|동일수준|초기기업|"
            r"잠재기업|성장나래|예비선도|선도기업|스타기업|강릉시|동해시)",
            f"{package_label} {evidence}",
        )
        if condition_match:
            condition_label = re.sub(
                r"\s+",
                "",
                condition_match.group(1),
            )
    cost_context = " ".join(filter(None, [package_label, amount_actual, evidence]))
    mandatory_cost_signals = [
        "필수 편성",
        "의무 편성",
        "반드시 편성",
        "납부하여야",
        "납부해야",
        "지원 제외",
        "지원대상에서 제외",
    ]
    burden_signals = ["기업 부담", "기업부담", "자부담", "민간부담"]
    fee_labels = [
        "부담금",
        "수수료",
        "부가세",
        "원가계산",
        "기술임치",
        "이용료",
        "사용료",
    ]
    is_mandatory_cost = any(
        signal in cost_context for signal in mandatory_cost_signals
    ) or (
        any(signal in cost_context for signal in burden_signals)
        and any(label in package_label for label in fee_labels)
    )
    if is_mandatory_cost:
        explicit_support_signals = [
            "비용 지원",
            "비용을 지원",
            "지원금 지급",
            "보조금 지급",
            "면제",
        ]
        if not any(signal in cost_context for signal in explicit_support_signals):
            return None
    recovered_from_direct_evidence = False
    if numeric_value is None and package_type in CASH_TYPES:
        recovered_numeric, recovered_actual = recover_direct_support_amount(
            evidence,
            amount_actual,
            amount_role,
        )
        if recovered_numeric is not None:
            numeric_value = recovered_numeric
            amount_actual = recovered_actual
            roi_deductible = amount_role in REPRESENTATIVE_AMOUNT_ROLES
            recovered_from_direct_evidence = True
    if amount_role in {
        "총사업비",
        "주관기관부담금",
        "기업부담금",
        "자부담",
    }:
        return None
    if package_type in CASH_TYPES and amount_role not in REPRESENTATIVE_AMOUNT_ROLES:
        roi_deductible = False
        numeric_value = None
        amount_actual = None
    if amount_actual and numeric_value is None and package_type in CASH_TYPES:
        amount_actual = None
    compact_evidence = re.sub(r"\s+", "", evidence)
    cash_role_grounded = any(
        re.sub(r"\s+", "", signal) in compact_evidence
        for signal in [
            "정부지원",
            "정부 지원",
            "지자체",
            "기관 지원",
            "현금지원",
            "직접지원",
            "지원금",
            "지원액",
            "지원규모",
            "지원한도",
            "지원 한도",
            "보조금",
            "출연금",
            "지원가능",
            "지원 가능",
            "기업당 최대",
            "과제당 최대",
            "건당 최대",
        ]
    )
    if (
        package_type in CASH_TYPES
        and amount_role in REPRESENTATIVE_AMOUNT_ROLES
        and not recovered_from_direct_evidence
        and not cash_role_grounded
    ):
        numeric_value = None
        ratio_value = None
        amount_actual = None
        roi_deductible = False
    if (
        package_type in CASH_TYPES
        and numeric_value is None
        and ratio_value is None
    ):
        if amount_role == "확인불가":
            package_type = "현물서비스"
            amount_role = "서비스가치"
        roi_deductible = False
        amount_actual = None

    return {
        "type": package_type,
        "name": name,
        "subtype": subtype,
        "amount_actual": amount_actual,
        "amount_numeric_manwon": numeric_value,
        "support_ratio": ratio_value,
        "amount_role": amount_role,
        "payer": payer,
        "recipient": recipient,
        "condition_label": condition_label,
        "amount_status": (
            "확정"
            if numeric_value is not None
            and amount_role in REPRESENTATIVE_AMOUNT_ROLES
            else (
                "비율 확인"
                if ratio_value is not None
                and amount_role in REPRESENTATIVE_AMOUNT_ROLES
                else "확인 필요"
            )
        ),
        "evidence": evidence,
        "roi_deductible": roi_deductible,
        "status": (
            "확정"
            if core.clean_text(value.get("status")) == "확정"
            else "확인필요"
        ),
    }


def package_display_category(
    package: dict[str, Any],
    support_tracks: list[str],
) -> str:
    package_type = core.clean_text(package.get("type"))
    name = " ".join(
        filter(
            None,
            [
                core.clean_text(package.get("name")),
                core.clean_text(package.get("subtype")),
            ],
        )
    )
    if package_type in {"융자", "이차보전", "보증"}:
        return "금융지원"
    if any(
        keyword in name
        for keyword in ["시험", "인증", "성능평가", "분석", "검사"]
    ):
        return "시험·인증"
    if any(
        keyword in name
        for keyword in [
            "교육",
            "채용",
            "훈련",
            "연수",
            "재직자",
            "세미나",
            "워크숍",
            "인력양성",
            "인력 지원",
        ]
    ):
        return "인력·교육"
    if any(
        keyword in name
        for keyword in ["장비", "시설", "공간", "입주", "임대", "사용료"]
    ):
        return "장비·공간"
    if any(
        keyword in name
        for keyword in [
            "컨설팅",
            "기술지도",
            "멘토링",
            "자문",
            "코칭",
            "시제품",
            "제품",
            "사업화",
            "특허",
            "상표",
            "마케팅",
            "디자인",
            "판로",
            "홍보",
            "AI",
            "AX",
            "솔루션",
            "데이터",
            "디지털",
            "인프라",
            "스마트",
        ]
    ):
        return "기술·사업화"
    if package_type == "공동장비":
        return "장비·공간"
    if package_type in CASH_TYPES or package_type == "지원비율":
        return "지원금"
    relevant_tracks = {
        track
        for track in support_tracks
        if track in {"시험인증", "공동장비활용", "제조인력"}
    }
    if relevant_tracks == {"시험인증"}:
        return "시험·인증"
    if relevant_tracks == {"공동장비활용"}:
        return "장비·공간"
    if relevant_tracks == {"제조인력"}:
        return "인력·교육"
    return "기술·사업화"


def default_package_name(
    package: dict[str, Any],
    category: str,
) -> str:
    explicit = core.clean_text(
        package.get("name") or package.get("subtype"),
        100,
    )
    condition_label = core.clean_text(
        package.get("condition_label"),
        100,
    )
    if explicit:
        if condition_label and condition_label not in explicit:
            return f"{explicit} ({condition_label})"
        return explicit
    defaults = {
        "현금보조": "사업비 지원",
        "바우처": "바우처 지원",
        "융자": "정책자금 융자",
        "이차보전": "대출 이자 지원",
        "보증": "신용보증 지원",
        "공동장비": "공동장비 활용",
        "지원비율": "사업비 비율 지원",
        "현물서비스": {
            "시험·인증": "시험·인증 지원",
            "장비·공간": "장비·공간 지원",
            "인력·교육": "교육·인력 지원",
            "기술·사업화": "기술·사업화 지원",
        }.get(category, "현물서비스 지원"),
    }
    return defaults.get(core.clean_text(package.get("type")), "지원 항목")


def grouped_support_item_name(
    package: dict[str, Any],
    category: str,
    amount: str | None,
) -> str:
    original = default_package_name(package, category)
    if amount:
        return original

    compact = re.sub(r"\s+", "", original)
    if any(
        keyword in compact
        for keyword in ["교육", "훈련", "연수", "세미나", "워크숍"]
    ):
        return "교육훈련"
    if any(
        keyword in compact
        for keyword in [
            "컨설팅",
            "기술지도",
            "멘토링",
            "자문",
            "코칭",
            "로드맵",
            "표준화",
            "최적화",
            "전주기",
            "사후관리",
            "유지보수",
            "운영안정화",
            "구축/운영",
            "구축운영",
            "지도",
        ]
    ):
        if any(
            keyword in compact
            for keyword in [
                "AI",
                "AX",
                "데이터",
                "디지털",
                "솔루션",
                "스마트",
                "로드맵",
                "표준화",
                "최적화",
                "전주기",
                "구축/운영",
                "구축운영",
                "유지보수",
                "운영안정화",
            ]
        ):
            return "디지털 전환 컨설팅"
        return "기술·사업화 컨설팅"
    if any(
        keyword in compact
        for keyword in ["시험", "분석", "인증", "성능평가", "검사", "신뢰성"]
    ):
        return "시험·인증 지원"
    if any(
        keyword in compact
        for keyword in [
            "조달",
            "구매",
            "단가협상",
            "공동구매",
            "운영지원",
            "판로",
            "박람회",
        ]
    ):
        return "판로·운영 지원"
    if any(
        keyword in compact
        for keyword in [
            "시제품",
            "제품고도화",
            "제품화",
            "특허",
            "상표",
            "지식재산",
            "마케팅",
            "디자인",
            "홍보",
        ]
    ):
        return "사업화 지원"
    if any(
        keyword in compact
        for keyword in ["공동장비", "시험장비", "시설이용", "장비활용"]
    ):
        return "공동장비·시설 활용"
    if any(
        keyword in compact
        for keyword in ["인프라", "시스템구축", "플랫폼", "데이터환경"]
    ):
        return "디지털 인프라 지원"
    if any(
        keyword in compact
        for keyword in [
            "AI",
            "AX",
            "솔루션",
            "디지털",
            "데이터",
            "스마트화",
            "스마트공장",
        ]
    ):
        return "디지털 전환 지원"
    return original


def build_support_items(
    packages: list[dict[str, Any]],
    support_tracks: list[str],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for package in packages:
        if package.get("status") != "확정":
            continue
        category = package_display_category(package, support_tracks)
        if category not in DISPLAY_SUPPORT_CATEGORIES:
            continue
        amount = core.clean_text(package.get("amount_actual"), 160) or None
        numeric = package.get("amount_numeric_manwon")
        ratio = package.get("support_ratio")
        if amount and re.search(r"\d", amount) and numeric is None and ratio is None:
            amount = None
        if not amount and ratio is not None:
            ratio_text = (
                str(int(ratio))
                if float(ratio).is_integer()
                else str(ratio)
            )
            amount = f"최대 {ratio_text}% 지원"
        item = {
            "category": category,
            "name": grouped_support_item_name(
                package,
                category,
                amount,
            ),
            "amount": amount,
            "amount_manwon": numeric,
            "funding_type": package.get("type"),
            "amount_status": package.get("amount_status"),
        }
        condition_label = core.clean_text(package.get("condition_label"), 100)
        if condition_label:
            item["condition_label"] = condition_label
        amount_role = core.clean_text(package.get("amount_role"))
        if amount_role:
            item["amount_role"] = amount_role
        if ratio is not None:
            item["support_ratio"] = ratio
        items.append(item)

    unique: dict[tuple[str, str, str], dict[str, Any]] = {}
    for item in items:
        key = (
            item["category"],
            item["name"],
            core.clean_text(item.get("amount")),
        )
        unique[key] = item
    return sorted(
        unique.values(),
        key=lambda item: support_item_sort_key(item),
    )


def support_categories(
    items: list[dict[str, Any]],
) -> list[str]:
    present = {
        core.clean_text(item.get("category"))
        for item in items
        if core.clean_text(item.get("category")) in DISPLAY_SUPPORT_CATEGORIES
    }
    return [
        category
        for category in DISPLAY_CATEGORY_PRIORITY
        if category in present
    ]


def normalize_documents(
    value: Any,
    row: dict[str, Any],
) -> list[dict[str, Any]]:
    documents = []
    for item in value if isinstance(value, list) else []:
        if not isinstance(item, dict):
            continue
        name = core.clean_text(item.get("name"), 100)
        evidence = core.clean_text(item.get("evidence"), 300)
        if not name or not evidence or not evidence_in_source(evidence, row):
            continue
        documents.append(
            {
                "name": name,
                "category": "필수서류" if bool(item.get("required")) else "선택서류",
                "required": bool(item.get("required")),
                "evidence": evidence,
            }
        )
    unique: dict[str, dict[str, Any]] = {}
    for document in documents:
        unique[document["name"]] = document
    return list(unique.values())


def choose_representative_package(
    packages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    confirmed = [
        package
        for package in packages
        if package.get("status") == "확정" and package.get("evidence")
    ]
    if not confirmed:
        return None

    cash = [
        package
        for package in confirmed
        if package.get("type") in CASH_TYPES
        and package.get("amount_role") in REPRESENTATIVE_AMOUNT_ROLES
        and package.get("amount_numeric_manwon") is not None
    ]
    if cash:
        return max(
            cash,
            key=lambda package: float(package["amount_numeric_manwon"]),
        )

    ratios = [
        package
        for package in confirmed
        if (
            package.get("type") in CASH_TYPES
            or package.get("type") == "지원비율"
        )
        and package.get("amount_role") in REPRESENTATIVE_AMOUNT_ROLES
        and package.get("support_ratio") is not None
    ]
    if ratios:
        return max(
            ratios,
            key=lambda package: float(package["support_ratio"]),
        )
    return None


def apply_conditional_amount_status(
    packages: list[dict[str, Any]],
) -> None:
    eligible = [
        package
        for package in packages
        if package.get("status") == "확정"
        and package.get("type") in CASH_TYPES
        and package.get("amount_role") in REPRESENTATIVE_AMOUNT_ROLES
        and (
            package.get("amount_numeric_manwon") is not None
            or package.get("support_ratio") is not None
        )
    ]
    numeric_values = {
        float(package["amount_numeric_manwon"])
        for package in eligible
        if package.get("amount_numeric_manwon") is not None
    }
    condition_values = {
        core.clean_text(package.get("condition_label"))
        for package in eligible
        if core.clean_text(package.get("condition_label"))
    }
    is_conditional = len(numeric_values) > 1 or len(condition_values) > 1
    if is_conditional:
        for package in eligible:
            package["amount_status"] = "조건별"


def representative_amount_status(
    representative: dict[str, Any] | None,
) -> str:
    if not representative:
        return "확인 필요"
    status = core.clean_text(representative.get("amount_status"))
    if status in {"확정", "조건별", "비율 확인", "확인 필요"}:
        return status
    if representative.get("amount_numeric_manwon") is not None:
        return "확정"
    if representative.get("support_ratio") is not None:
        return "비율 확인"
    return "확인 필요"


def representative_amount_text(
    representative: dict[str, Any] | None,
) -> str | None:
    if not representative:
        return None
    amount_actual = core.clean_text(
        representative.get("amount_actual"),
        160,
    )
    status = representative_amount_status(representative)
    condition_label = core.clean_text(
        representative.get("condition_label"),
        100,
    )
    if amount_actual:
        if status == "조건별":
            condition_prefix = (
                f"{condition_label} 기준 "
                if condition_label
                else "조건별 "
            )
            return f"{condition_prefix}{amount_actual}"
        return amount_actual
    ratio = representative.get("support_ratio")
    if ratio is None:
        return None
    ratio_text = (
        str(int(ratio))
        if float(ratio).is_integer()
        else str(ratio)
    )
    prefix = (
        f"{condition_label} 기준 "
        if status == "조건별" and condition_label
        else ""
    )
    return f"{prefix}최대 {ratio_text}% 지원"


def validate_result(
    raw_result: dict[str, Any],
    row: dict[str, Any],
) -> dict[str, Any]:
    purpose = normalize_grounded_sentence(
        raw_result.get("purpose"),
        raw_result.get("purpose_evidence"),
        row,
    )
    support_content = normalize_grounded_sentence(
        raw_result.get("support_content"),
        raw_result.get("support_content_evidence"),
        row,
    )
    support_tracks = normalize_support_tracks(raw_result.get("support_tracks"))
    packages = [
        package
        for package in (
            normalize_package(item, row)
            for item in raw_result.get("support_packages") or []
        )
        if package
    ]
    apply_conditional_amount_status(packages)
    support_types = list(
        dict.fromkeys(package["type"] for package in packages)
    )
    eligibility_text, eligibility_evidence = normalize_eligibility(
        raw_result.get("eligibility_text"),
        raw_result.get("eligibility_evidence"),
        row,
    )

    documents = normalize_documents(
        raw_result.get("required_documents"),
        row,
    )
    review_notes = [
        core.clean_text(note, 300)
        for note in raw_result.get("review_notes") or []
        if core.clean_text(note)
    ][:10]

    if len(packages) > 1 and "복합지원" not in support_types:
        support_types.append("복합지원")
    if not support_types:
        support_types = ["확인불가"]
    support_items = build_support_items(packages, support_tracks)
    categories = support_categories(support_items)

    result = {
        "purpose": purpose,
        "support_content": support_content,
        "support_types": support_types,
        "support_tracks": support_tracks,
        "support_packages": packages,
        "support_items": support_items,
        "support_categories": categories,
        "support_primary_category": categories[0] if categories else None,
        "representative_package": choose_representative_package(packages),
        "eligibility_text": eligibility_text,
        "eligibility_evidence": eligibility_evidence,
        "required_documents": documents,
        "review_notes": review_notes,
    }
    result["summary"] = build_structured_summary(row, result)
    return result


def merge_temp_extraction(
    current_value: Any,
    enrichment: dict[str, Any],
    model: str,
    context_hash: str,
) -> dict[str, Any]:
    current = as_dict(current_value)
    current[ENRICHMENT_KEY] = {
        **enrichment,
        "model": model,
        "context_hash": context_hash,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    return current


def build_update_payload(
    row: dict[str, Any],
    enrichment: dict[str, Any],
    model: str,
    context_hash: str,
) -> dict[str, Any]:
    update: dict[str, Any] = {
        "temp_extraction_json": merge_temp_extraction(
            row.get("temp_extraction_json"),
            enrichment,
            model,
            context_hash,
        )
    }
    if enrichment.get("summary"):
        update["summary"] = enrichment["summary"]
    update.update(
        {
            "support_primary_category": enrichment.get(
                "support_primary_category"
            ),
            "support_categories": enrichment.get("support_categories") or [],
            "support_items": enrichment.get("support_items") or [],
        }
    )

    representative = enrichment.get("representative_package")
    if representative:
        package_type = representative["type"]
        amount_status = representative_amount_status(representative)
        if amount_status in {"확정", "조건별", "비율 확인"}:
            amount_actual = representative_amount_text(representative)
            numeric_manwon = representative.get("amount_numeric_manwon")
            if not amount_actual and numeric_manwon is not None:
                amount_actual = core.format_amount_manwon(
                    float(numeric_manwon)
                )
            update.update(
                {
                    "max_amount_type": (
                        "지원비율"
                        if amount_status == "비율 확인"
                        else package_type
                    ),
                    "max_amount_status": amount_status,
                    "max_amount_actual": amount_actual,
                    "max_amount_evidence": representative.get("evidence"),
                    "max_amount_note": (
                        "Gemini 원문 근거 기반 대표 지원항목 판독"
                        + (
                            f"; 적용 조건: "
                            f"{representative.get('condition_label')}"
                            if representative.get("condition_label")
                            else ""
                        )
                    ),
                    "max_amount_numeric_manwon": (
                        representative.get("amount_numeric_manwon")
                        if representative.get("roi_deductible")
                        and package_type in CASH_TYPES
                        else None
                    ),
                }
            )

    if (
        enrichment.get("eligibility_text")
        and enrichment.get("eligibility_evidence")
    ):
        update.update(
            {
                "eligibility_text": enrichment["eligibility_text"],
                "eligibility_evidence": enrichment["eligibility_evidence"],
                "eligibility_extraction_status": "success",
            }
        )

    documents = enrichment.get("required_documents") or []
    if documents:
        update.update(
            {
                "required_documents": ", ".join(
                    document["name"] for document in documents
                ),
                "required_documents_json": documents,
                "required_documents_status": "원문 근거 확인",
            }
        )
    return update


def already_processed(row: dict[str, Any]) -> bool:
    return ENRICHMENT_KEY in as_dict(row.get("temp_extraction_json"))


def fetch_rows(
    supabase: Client,
    table_name: str,
    source: str,
    policy_ids: list[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        query = (
            supabase.table(table_name)
            .select(SELECT_COLUMNS)
            .range(offset, offset + page_size - 1)
        )
        if source != "all":
            query = query.eq("source_name", SOURCE_DB_NAMES[source])
        page = query.execute().data or []
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    if policy_ids:
        wanted = set(policy_ids)
        rows = [
            row
            for row in rows
            if core.clean_text(row.get("policy_id")) in wanted
        ]
    return rows


def write_csv(path_value: str, rows: list[dict[str, Any]]) -> Path:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "policy_id",
        "source_name",
        "title",
        "status",
        "support_types",
        "support_tracks",
        "support_primary_category",
        "support_categories",
        "support_items",
        "support_packages_json",
        "support_evidence_json",
        "roi_deductible_items",
        "review_notes",
        "support_item_count",
        "support_package_count",
        "representative_type",
        "representative_status",
        "representative_amount_role",
        "representative_condition",
        "representative_payer",
        "representative_recipient",
        "representative_amount",
        "representative_numeric_manwon",
        "summary_before",
        "summary_after",
        "eligibility_before",
        "eligibility_after",
        "required_documents",
        "updated_fields",
        "error_message",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return path


def main() -> None:
    collector.load_environment()
    args = resolve_args()
    table_name = collector.validate_table_name(args.target_table)
    dry_run = bool(args.dry_run)
    api_key = collector.get_gemini_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing")

    supabase = create_client(
        core.SUPABASE_URL,
        core.SUPABASE_SERVICE_ROLE_KEY,
    )
    rows = fetch_rows(
        supabase,
        table_name,
        args.source,
        args.policy_id,
    )
    cache_path = Path(args.cache_path)
    cache = {} if args.no_cache else load_cache(cache_path)

    processed = 0
    updated = 0
    skipped = 0
    failed = 0
    cache_hits = 0
    report_rows: list[dict[str, Any]] = []

    print(f"target_table={table_name}")
    print(f"source={args.source}")
    print(f"model={args.model}")
    print(f"dry_run={dry_run}")
    print(f"force={args.force}")
    print(f"candidate_rows={len(rows)}")

    for row in rows:
        if args.limit and processed >= args.limit:
            break
        if not args.include_without_attachment and not core.clean_text(
            row.get("attachment_text")
        ):
            skipped += 1
            continue
        if not args.force and already_processed(row):
            skipped += 1
            continue

        processed += 1
        policy_id = core.clean_text(row.get("policy_id"))
        context_hash = source_hash(row, args.model)
        try:
            raw_result = None
            cached = cache.get(policy_id)
            if (
                not args.no_cache
                and isinstance(cached, dict)
                and cached.get("context_hash") == context_hash
                and isinstance(cached.get("result"), dict)
            ):
                raw_result = cached["result"]
                cache_hits += 1

            if raw_result is None:
                raw_result = call_gemini(
                    build_prompt(row),
                    args.model,
                    api_key,
                )
                cache[policy_id] = {
                    "context_hash": context_hash,
                    "model": args.model,
                    "result": raw_result,
                }
                save_cache(cache_path, cache)

            enrichment = validate_result(raw_result, row)
            update_payload = build_update_payload(
                row,
                enrichment,
                args.model,
                context_hash,
            )
            status = "dry_run"
            if not dry_run:
                (
                    supabase.table(table_name)
                    .update(update_payload)
                    .eq("policy_id", policy_id)
                    .execute()
                )
                updated += 1
                status = "updated"

            representative = enrichment.get("representative_package") or {}
            print(
                f"[{processed}] {row.get('source_name')} | {policy_id} | "
                f"type={','.join(enrichment.get('support_types') or [])} | "
                f"representative={representative.get('type') or '-'} | "
                f"fields={','.join(update_payload)} | {status}"
            )
            report_rows.append(
                {
                    "policy_id": policy_id,
                    "source_name": row.get("source_name"),
                    "title": row.get("title"),
                    "status": status,
                    "support_types": ", ".join(
                        enrichment.get("support_types") or []
                    ),
                    "support_tracks": ", ".join(
                        enrichment.get("support_tracks") or []
                    ),
                    "support_primary_category": enrichment.get(
                        "support_primary_category"
                    ),
                    "support_categories": ", ".join(
                        enrichment.get("support_categories") or []
                    ),
                    "support_items": json.dumps(
                        enrichment.get("support_items") or [],
                        ensure_ascii=False,
                    ),
                    "support_packages_json": json.dumps(
                        enrichment.get("support_packages") or [],
                        ensure_ascii=False,
                    ),
                    "support_evidence_json": json.dumps(
                        [
                            {
                                "type": package.get("type"),
                                "name": package.get("name"),
                                "amount_role": package.get("amount_role"),
                                "amount_status": package.get("amount_status"),
                                "condition_label": package.get(
                                    "condition_label"
                                ),
                                "payer": package.get("payer"),
                                "recipient": package.get("recipient"),
                                "evidence": package.get("evidence"),
                            }
                            for package in (
                                enrichment.get("support_packages") or []
                            )
                        ],
                        ensure_ascii=False,
                    ),
                    "roi_deductible_items": json.dumps(
                        [
                            {
                                "type": package.get("type"),
                                "name": package.get("name"),
                                "amount_actual": package.get("amount_actual"),
                                "amount_numeric_manwon": package.get(
                                    "amount_numeric_manwon"
                                ),
                            }
                            for package in (
                                enrichment.get("support_packages") or []
                            )
                            if package.get("roi_deductible") is True
                        ],
                        ensure_ascii=False,
                    ),
                    "review_notes": json.dumps(
                        enrichment.get("review_notes") or [],
                        ensure_ascii=False,
                    ),
                    "support_item_count": len(
                        enrichment.get("support_items") or []
                    ),
                    "support_package_count": len(
                        enrichment.get("support_packages") or []
                    ),
                    "representative_type": representative.get("type"),
                    "representative_status": representative_amount_status(
                        representative
                    ),
                    "representative_amount_role": representative.get(
                        "amount_role"
                    ),
                    "representative_condition": representative.get(
                        "condition_label"
                    ),
                    "representative_payer": representative.get("payer"),
                    "representative_recipient": representative.get("recipient"),
                    "representative_amount": representative_amount_text(
                        representative
                    ),
                    "representative_numeric_manwon": representative.get(
                        "amount_numeric_manwon"
                    ),
                    "summary_before": row.get("summary"),
                    "summary_after": update_payload.get("summary"),
                    "eligibility_before": row.get("eligibility_text"),
                    "eligibility_after": update_payload.get("eligibility_text"),
                    "required_documents": update_payload.get(
                        "required_documents"
                    ),
                    "updated_fields": ", ".join(update_payload),
                    "error_message": "",
                }
            )
        except Exception as exc:
            failed += 1
            print(f"[ERROR] {policy_id}: {exc}")
            report_rows.append(
                {
                    "policy_id": policy_id,
                    "source_name": row.get("source_name"),
                    "title": row.get("title"),
                    "status": "failed",
                    "support_types": "",
                    "support_tracks": "",
                    "support_primary_category": "",
                    "support_categories": "",
                    "support_items": "",
                    "support_packages_json": "",
                    "support_evidence_json": "",
                    "roi_deductible_items": "",
                    "review_notes": "",
                    "support_item_count": 0,
                    "support_package_count": 0,
                    "representative_type": "",
                    "representative_status": "",
                    "representative_amount_role": "",
                    "representative_condition": "",
                    "representative_payer": "",
                    "representative_recipient": "",
                    "representative_amount": "",
                    "representative_numeric_manwon": "",
                    "summary_before": row.get("summary"),
                    "summary_after": "",
                    "eligibility_before": row.get("eligibility_text"),
                    "eligibility_after": "",
                    "required_documents": "",
                    "updated_fields": "",
                    "error_message": str(exc),
                }
            )
        time.sleep(args.sleep)

    if args.csv_output:
        output_path = write_csv(args.csv_output, report_rows)
        print(f"CSV report: {output_path}")

    print("=" * 80)
    print("Done")
    print(f"Processed rows: {processed}")
    print(f"Updated rows: {updated}")
    print(f"Skipped rows: {skipped}")
    print(f"Cache hits: {cache_hits}")
    print(f"Failed rows: {failed}")


if __name__ == "__main__":
    main()
