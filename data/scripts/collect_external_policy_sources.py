from __future__ import annotations

import argparse
import csv
import hashlib
import io
import importlib.util
import json
import os
import random
import re
import struct
import subprocess
import sys
import tempfile
import time
import zipfile
import zlib
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Iterable
from urllib.parse import unquote, urlencode, urljoin, urlparse
from xml.etree import ElementTree

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

import upload_final as core
import promote_external_policy_to_policy as promotion

try:
    import olefile
except ImportError:  # pragma: no cover - optional HWP dependency
    olefile = None


"""
스마트공장 사업관리시스템, 한국에너지공단, 중소벤처기업진흥공단,
전국 테크노파크 통합 사업공고를 수집해 upload_final.py와 동일한
정규화/제조·설비 필터를 적용하는 별도 수집기입니다.

K-Startup 수집 코드는 향후 재검토를 위해 남겨두되 현재 실행 경로에서는
비활성화합니다.

안전 기본값:
- dry-run이 기본이며 --dry-run 0을 명시해야 Supabase에 저장합니다.
- 마감일이 확인된 과거 공고는 기본적으로 제외합니다.
- 기존 행을 삭제하지 않고 policy_id 기준으로 upsert만 수행합니다.
- LLM은 기본 비활성화이며 --use-llm을 지정할 때만 공식 Gemini API를 사용합니다.
"""


SCRIPT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
}

SMART_FACTORY_BASE_URL = "https://www.smart-factory.kr"
SMART_FACTORY_LIST_PATH = "/usr/bg/ba/ma/bsnsPbanc/selectBsnsPbancPage.do"
SMART_FACTORY_DETAIL_PATH = "/usr/bg/ba/ma/bsnsPbanc/selectBsnsPbancDtlPage.do"
SMART_FACTORY_PUBLIC_DETAIL_PATH = "/usr/bg/ba/ma/bsnsPbancDtl"
SMART_FACTORY_ATTACHMENT_LIST_PATH = "/files/selectTmpltAtchList.do"
SMART_FACTORY_ATTACHMENT_DOWNLOAD_PATH = "/file/pdfFileDownload.do"

ENERGY_AGENCY_BASE_URL = "https://www.energy.or.kr"
ENERGY_AGENCY_LIST_PATH = "/front/board/List2.do"
ENERGY_AGENCY_DETAIL_PATH = "/front/board/View2.do"
ENERGY_AGENCY_FILE_PATH = "/commonFile/fileDownload.do"
KPASS_BASE_URL = "https://www.k-pass.kr"
KPASS_LIST_PATH = "/notice/ancList.do"
KPASS_DETAIL_PATH = "/notice/ancView.do"
RENEWABLE_ENERGY_BASE_URL = "https://www.knrec.or.kr"
RENEWABLE_ENERGY_LIST_PATH = "/biz/pds/businoti/list.do"
SMTECH_BASE_URL = "https://www.smtech.go.kr"
SMTECH_PUBLIC_NOTICE_PATH = "/front/ifg/no/notice02_intro.do"
GBSA_BASE_URL = "https://www.gbsa.or.kr"
GBSA_NOTICE_PATH = "/board/notice.do"

STRICT_EXTERNAL_SOURCES = {
    "kpass",
    "renewable-energy",
    "tipa-smtech",
    "regional-agency",
}
CONDITIONAL_DEADLINE_TYPES = {
    "always_open",
    "first_come",
    "budget_exhaustion",
}
APPLICATION_DEADLINE_LABELS = [
    "접수기간",
    "접수 기간",
    "신청기간",
    "신청 기간",
    "모집기간",
    "모집 기간",
    "공고접수기간",
    "과제 접수 기간",
    "제안서 제출",
]
NON_APPLICATION_DATE_LABELS = [
    "사업기간",
    "사업 기간",
    "협약기간",
    "협약 기간",
    "수행기간",
    "수행 기간",
    "지원기간",
    "지원 기간",
    "위탁기간",
    "위탁 기간",
]
ENERGY_AGENCY_KEYWORDS = [
    "에너지진단",
    "고효율",
    "에너지절약시설",
    "융자",
    "설비교체",
    "전력절감",
    "탄소중립",
    "탄소감축",
    "ESCO",
    "보조금",
    "FEMS",
    "EMS",
]
ENERGY_AGENCY_EXCLUDE_KEYWORDS = [
    "표창",
    "포상",
    "수요조사",
    "선정결과",
    "교육생",
    "교육 안내",
    "포럼",
    "설명회",
    "이벤트",
    "부정행위 신고",
    "소상공인",
    "사회복지시설",
    "지침 일부개정",
    "지침 개정안",
]

KOSMES_BASE_URL = "https://www.kosmes.or.kr"
KOSMES_NOTICE_LIST_PATH = "/sh/nts/notice_list.json"
KOSMES_NOTICE_DETAIL_PATH = "/nsh/SH/NTS/SHNTS001F0.do"
KOSMES_FILE_DOWNLOAD_PATH = "/fileDown2.do"
KOSMES_KEYWORDS = [
    "스마트제조",
    "스마트공장",
    "설비",
    "자동화",
    "공정",
    "탄소중립",
    "정책자금",
    "융자",
    "기술개발",
    "제품화",
    "시제품",
    "실증",
    "제조인력",
    "생산인력",
    "제조",
]
KOSMES_EXCLUDE_KEYWORDS = [
    "채용",
    "입찰",
    "교육생",
    "설명회",
    "세미나",
    "포상",
    "선정결과",
]

TECHNOPARK_BASE_URL = "https://www.technopark.or.kr"
TECHNOPARK_LIST_PATH = "/www/linkBoard/list.do"

ATTACHMENT_CANDIDATE_LIMIT = int(
    os.getenv("EXTERNAL_ATTACHMENT_CANDIDATE_LIMIT", "15")
)
ATTACHMENT_DOWNLOAD_LIMIT = int(
    os.getenv("EXTERNAL_ATTACHMENT_DOWNLOAD_LIMIT", "5")
)
ATTACHMENT_MAX_BYTES = int(
    os.getenv("EXTERNAL_ATTACHMENT_MAX_BYTES", str(15 * 1024 * 1024))
)
ATTACHMENT_TOTAL_MAX_BYTES = int(
    os.getenv("EXTERNAL_ATTACHMENT_TOTAL_MAX_BYTES", str(40 * 1024 * 1024))
)
ATTACHMENT_EXTENSION_PRIORITY = {
    ".pdf": 0,
    ".hwpx": 1,
    ".docx": 2,
    ".xlsx": 3,
    ".hwp": 4,
}
ATTACHMENT_EXTRACTABLE_EXTENSIONS = {
    ".pdf",
    ".hwp",
    ".hwpx",
    ".docx",
    ".xlsx",
}
TECHNOPARK_KEYWORDS = [
    "제조",
    "스마트공장",
    "스마트제조",
    "설비",
    "장비",
    "공동장비",
    "자동화",
    "로봇",
    "공정",
    "생산",
    "시제품",
    "제품고도화",
    "제품화",
    "기술개발",
    "실증",
    "시험",
    "인증",
    "성능평가",
    "제조AI",
    "제조데이터",
    "생산기술",
    "금형",
    "설계",
    "가공",
    "금속",
    "기계",
    "부품",
    "식품",
    "바이오",
    "전자",
    "반도체",
    "자동차",
    "뿌리",
    "사출",
    "프레스",
    "CNC",
    "에너지",
    "탄소",
    "고효율",
]
ELIGIBILITY_START_LABELS = [
    "지원대상",
    "지원 대상",
    "신청대상",
    "신청 대상",
    "사업대상",
    "사업 대상",
    "대상기업",
    "대상 기업",
    "지원자격",
    "지원 자격",
    "신청자격",
    "신청 자격",
    "참여대상",
    "참여 대상",
]
ELIGIBILITY_STOP_LABELS = [
    "지원내용",
    "지원 내용",
    "지원규모",
    "지원 규모",
    "지원한도",
    "지원 한도",
    "지원금",
    "사업내용",
    "사업 내용",
    "신청방법",
    "신청 방법",
    "접수방법",
    "접수 방법",
    "제출서류",
    "제출 서류",
    "문의처",
    "문의",
    "추진절차",
    "선정방법",
    "평가방법",
]
FORBIDDEN_ELIGIBILITY_WORDS = [
    "지원규모",
    "지원 규모",
    "지원한도",
    "지원 한도",
    "지원금",
    "사업비",
    "최대",
    "만원",
    "억원",
    "신청방법",
    "신청 방법",
    "접수방법",
    "접수 방법",
    "제출서류",
    "제출 서류",
    "문의처",
    "문의",
]
DEFAULT_TARGET_TABLE = os.getenv(
    "EXTERNAL_POLICY_TARGET_TABLE",
    "policy_external_collected",
).strip()
DEFAULT_GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-2.5-flash-lite",
).strip()
EXCLUDED_COLLECTION_FIELDS = {
    "max_employee_count",
    "min_revenue",
    "max_revenue",
    "required_documents_count",
    "relevance_score",
    "is_selected",
    "selected_reason",
}


def sanitize_collection_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return core.filter_validation_payload(payload)


def load_environment() -> None:
    for env_path in [
        core.SCRIPT_DIR / ".env",
        core.SCRIPT_DIR.parent / ".env",
        core.SCRIPT_DIR.parent.parent / ".env",
        core.SCRIPT_DIR.parent.parent / "backend" / ".env",
    ]:
        if env_path.exists():
            load_dotenv(env_path)


def get_gemini_api_key() -> str:
    return (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    ).strip()


class GeminiRestLLM:
    """Minimal LangChain-compatible adapter for Gemini generateContent REST."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_GEMINI_MODEL,
        timeout: int = 90,
    ) -> None:
        self.api_key = api_key
        self.model = model.removeprefix("models/")
        self.timeout = timeout
        self.rate_limited = False
        self.last_request_at = 0.0
        self.min_interval = float(os.getenv("GEMINI_MIN_INTERVAL", "4"))
        self.max_interval = float(os.getenv("GEMINI_MAX_INTERVAL", "6"))

    @staticmethod
    def _message_text(message: Any) -> str:
        content = getattr(message, "content", message)
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "\n".join(
                core.clean_text(
                    part.get("text") if isinstance(part, dict) else part
                )
                for part in content
            )
        return core.clean_text(content)

    def invoke(self, messages: Any) -> SimpleNamespace:
        if self.rate_limited:
            raise RuntimeError(
                "Gemini 429 이후 현재 실행의 추가 호출을 중단했습니다."
            )

        if not isinstance(messages, list):
            messages = [messages]

        system_parts: list[str] = []
        user_parts: list[str] = []
        for message in messages:
            text = self._message_text(message)
            message_type = getattr(message, "type", "")
            if message_type == "system":
                system_parts.append(text)
            else:
                user_parts.append(text)

        body: dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "\n\n".join(user_parts)}],
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": 512,
            },
        }
        if system_parts:
            body["systemInstruction"] = {
                "parts": [{"text": "\n\n".join(system_parts)}]
            }

        target_interval = random.uniform(
            min(self.min_interval, self.max_interval),
            max(self.min_interval, self.max_interval),
        )
        elapsed = time.monotonic() - self.last_request_at
        if elapsed < target_interval:
            time.sleep(target_interval - elapsed)

        response = requests.post(
            (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.model}:generateContent"
            ),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            },
            json=body,
            timeout=self.timeout,
        )
        self.last_request_at = time.monotonic()
        if response.status_code == 429:
            self.rate_limited = True
        response.raise_for_status()
        payload = response.json()

        texts: list[str] = []
        for candidate in payload.get("candidates") or []:
            for part in (candidate.get("content") or {}).get("parts") or []:
                if part.get("text"):
                    texts.append(str(part["text"]))

        if not texts:
            block_reason = (payload.get("promptFeedback") or {}).get("blockReason")
            raise RuntimeError(
                f"Gemini 응답에 텍스트가 없습니다. block_reason={block_reason or 'unknown'}"
            )
        return SimpleNamespace(content="\n".join(texts))


def create_gemini_llm(model: str) -> GeminiRestLLM | None:
    api_key = get_gemini_api_key()
    if not api_key:
        return None
    return GeminiRestLLM(api_key=api_key, model=model)


def pick(row: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return value
    return default


def join_period(start: Any, end: Any) -> str:
    start_text = core.clean_text(start)
    end_text = core.clean_text(end)
    if start_text and end_text:
        return f"{start_text} ~ {end_text}"
    return start_text or end_text


def normalize_source_id(source: str, *parts: Any) -> str:
    cleaned = [core.clean_text(part) for part in parts if core.clean_text(part)]
    return f"{source.upper()}:" + ":".join(cleaned)


def smart_factory_headers() -> dict[str, str]:
    return {
        **SCRIPT_HEADERS,
        "Content-Type": "application/json",
        "Origin": SMART_FACTORY_BASE_URL,
        "Referer": f"{SMART_FACTORY_BASE_URL}/usr/bg/ba/ma/bsnsPbanc",
        "reactDivision": "ReactDivision",
    }


def fetch_smart_factory_page(
    session: requests.Session,
    page: int,
    reception_status: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payload = {
        "key": "list",
        "bizYr": "",
        "bizClsfYrNm": "",
        "dtlPbancNm": "",
        "rcptStts": reception_status,
        "ordrSe": "REG",
        "currentPage": page,
    }
    response = session.post(
        f"{SMART_FACTORY_BASE_URL}{SMART_FACTORY_LIST_PATH}",
        headers=smart_factory_headers(),
        json=payload,
        timeout=40,
    )
    response.raise_for_status()
    data = response.json()
    if data.get("failMsg"):
        raise RuntimeError(core.clean_text(data["failMsg"]))
    return data.get("pbancList") or [], data.get("paginationInfo") or {}


def fetch_smart_factory_detail(
    session: requests.Session,
    pbanc_id: Any,
    pbanc_sn: Any,
) -> dict[str, Any]:
    response = session.post(
        f"{SMART_FACTORY_BASE_URL}{SMART_FACTORY_DETAIL_PATH}",
        headers=smart_factory_headers(),
        json={
            "key": "info",
            "pbancId": pbanc_id,
            "pbancSn": pbanc_sn,
        },
        timeout=40,
    )
    response.raise_for_status()
    data = response.json()
    if data.get("failMsg"):
        raise RuntimeError(core.clean_text(data["failMsg"]))
    return data.get("pbancInfo") or {}


def attachment_extension(value: Any) -> str:
    text = unquote(str(value or "")).split("?", 1)[0]
    suffix_match = re.search(
        r"\.(pdf|hwpx|docx|xlsx|hwp)(?=$|[\s(])",
        text,
        flags=re.IGNORECASE,
    )
    if suffix_match:
        return f".{suffix_match.group(1).lower()}"
    suffix = Path(text).suffix.lower()
    return suffix if suffix in ATTACHMENT_EXTENSION_PRIORITY else ""


def attachment_extension_from_bytes(
    data: bytes,
    content_type: str = "",
) -> str:
    content = data or b""
    if content.startswith(b"%PDF-"):
        return ".pdf"
    if content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return ".hwp"
    if content.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
                lowered = {name.lower() for name in names}
                if any(name.startswith("word/") for name in lowered):
                    return ".docx"
                if any(name.startswith("xl/") for name in lowered):
                    return ".xlsx"
                mimetype_name = next(
                    (
                        name
                        for name in names
                        if name.lower() == "mimetype"
                    ),
                    "",
                )
                is_hwpx_mimetype = (
                    bool(mimetype_name)
                    and b"application/hwp+zip"
                    in archive.read(mimetype_name)
                )
                if "contents/content.hpf" in lowered or is_hwpx_mimetype:
                    return ".hwpx"
        except (KeyError, OSError, zipfile.BadZipFile):
            pass
    normalized_type = str(content_type or "").lower()
    if "pdf" in normalized_type:
        return ".pdf"
    if "hwp+zip" in normalized_type:
        return ".hwpx"
    if "wordprocessingml" in normalized_type:
        return ".docx"
    if "spreadsheetml" in normalized_type:
        return ".xlsx"
    return ""


def attachment_priority(candidate: dict[str, Any]) -> tuple[int, int, str]:
    filename = core.clean_text(candidate.get("filename"))
    ext = (
        core.clean_text(candidate.get("extension")).lower()
        or attachment_extension(filename)
        or attachment_extension(candidate.get("url"))
    )
    lowered = filename.lower()
    document_rank = 0 if any(
        token in lowered
        for token in [
            "공고",
            "모집",
            "사업계획",
            "지원",
            "안내",
            "notice",
            "guide",
        ]
    ) else 1
    return (
        ATTACHMENT_EXTENSION_PRIORITY.get(ext, 99),
        document_rank,
        filename,
    )


def select_attachment_candidates(
    candidates: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in candidates:
        filename = core.clean_text(candidate.get("filename"))
        identity = core.clean_text(
            candidate.get("identity")
            or candidate.get("url")
            or f"{filename}:{candidate.get('attachment_sequence') or ''}"
        )
        if not identity or identity in seen:
            continue
        seen.add(identity)
        copied = dict(candidate)
        copied["filename"] = filename
        copied["extension"] = (
            core.clean_text(copied.get("extension")).lower()
            or attachment_extension(filename)
            or attachment_extension(copied.get("url"))
        )
        unique.append(copied)
    unique.sort(key=attachment_priority)
    return unique[:ATTACHMENT_CANDIDATE_LIMIT]


def is_invalid_attachment_response(
    data: bytes,
    content_type: str,
) -> bool:
    prefix = (data or b"")[:256].lstrip().lower()
    normalized_type = str(content_type or "").lower()
    return (
        not data
        or prefix.startswith((b"<html", b"<!doctype", b"{\"error", b"{'error"))
        or "text/html" in normalized_type
        or "application/json" in normalized_type
    )


def clean_hwp_text(value: str) -> str:
    text = re.sub(
        r"[\x00-\x08\x0b\x0c\x0e-\x1f]",
        " ",
        value or "",
    ).replace("\r", "\n")
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()


def parse_hwp_body_records(data: bytes) -> str:
    paragraphs: list[str] = []
    offset = 0
    while offset + 4 <= len(data):
        header = struct.unpack_from("<I", data, offset)[0]
        offset += 4
        tag_id = header & 0x3FF
        size = (header >> 20) & 0xFFF
        if size == 0xFFF:
            if offset + 4 > len(data):
                break
            size = struct.unpack_from("<I", data, offset)[0]
            offset += 4
        if offset + size > len(data):
            break
        record_data = data[offset : offset + size]
        offset += size
        if tag_id != 67:  # HWPTAG_PARA_TEXT
            continue
        paragraph = clean_hwp_text(
            record_data.decode("utf-16le", errors="ignore")
        )
        if paragraph:
            paragraphs.append(paragraph)
    return "\n".join(paragraphs)


def hwp_text_quality(text: str) -> dict[str, Any]:
    visible_count = sum(not char.isspace() for char in text)
    hangul_count = sum(
        0xAC00 <= ord(char) <= 0xD7A3
        for char in text
    )
    keyword_count = sum(
        keyword in text
        for keyword in [
            "지원",
            "사업",
            "신청",
            "기업",
            "공고",
            "제출",
            "금액",
            "대상",
        ]
    )
    hangul_ratio = hangul_count / max(1, visible_count)
    usable = (
        len(text) >= 500
        and hangul_ratio >= 0.25
        and keyword_count >= 2
    )
    return {
        "usable": usable,
        "text_length": len(text),
        "hangul_ratio": round(hangul_ratio, 3),
        "keyword_count": keyword_count,
    }


def extract_hwp_text(data: bytes) -> dict[str, Any]:
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".hwp",
        ) as temp_file:
            temp_file.write(data)
            temp_path = temp_file.name

        if olefile is None:
            return extract_hwp_text_with_hwp5txt(temp_path)

        if not olefile.isOleFile(temp_path):
            pyhwp_result = extract_hwp_text_with_hwp5txt(temp_path)
            if pyhwp_result.get("text"):
                return pyhwp_result
            return {
                "text": "",
                "method": "not_ole_hwp",
                "quality": {"usable": False},
            }

        ole = olefile.OleFileIO(temp_path)
        try:
            compressed = False
            if ole.exists("FileHeader"):
                header = ole.openstream("FileHeader").read()
                if len(header) >= 40:
                    properties = struct.unpack_from("<I", header, 36)[0]
                    compressed = bool(properties & 0x01)

            sections = sorted(
                stream
                for stream in ole.listdir()
                if (
                    len(stream) == 2
                    and stream[0] == "BodyText"
                    and stream[1].startswith("Section")
                )
            )
            body_parts: list[str] = []
            for stream in sections:
                section_data = ole.openstream(stream).read()
                if compressed:
                    try:
                        section_data = zlib.decompress(section_data, -15)
                    except zlib.error:
                        try:
                            section_data = zlib.decompress(section_data)
                        except zlib.error:
                            continue
                section_text = parse_hwp_body_records(section_data)
                if section_text:
                    body_parts.append(section_text)

            body_text = clean_hwp_text("\n".join(body_parts))
            body_quality = hwp_text_quality(body_text)
            if body_quality["usable"]:
                return {
                    "text": body_text,
                    "method": "bodytext",
                    "quality": body_quality,
                }

            preview_text = ""
            if ole.exists("PrvText"):
                preview_text = clean_hwp_text(
                    ole.openstream("PrvText")
                    .read()
                    .decode("utf-16le", errors="ignore")
                )
            preview_quality = hwp_text_quality(preview_text)
            if preview_quality["usable"]:
                return {
                    "text": preview_text,
                    "method": "preview",
                    "quality": preview_quality,
                }
            pyhwp_result = extract_hwp_text_with_hwp5txt(temp_path)
            if pyhwp_result.get("text"):
                return pyhwp_result
            return {
                "text": "",
                "method": "quality_failed",
                "quality": (
                    body_quality
                    if len(body_text) >= len(preview_text)
                    else preview_quality
                ),
            }
        finally:
            ole.close()
    except Exception as exc:
        if temp_path:
            pyhwp_result = extract_hwp_text_with_hwp5txt(temp_path)
            if pyhwp_result.get("text"):
                return pyhwp_result
        return {
            "text": "",
            "method": "extract_failed",
            "quality": {"usable": False},
            "error_message": str(exc),
        }
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


def extract_hwp_text_with_hwp5txt(file_path: str) -> dict[str, Any]:
    if importlib.util.find_spec("hwp5.hwp5txt") is None:
        return {
            "text": "",
            "method": "hwp5txt_unavailable",
            "quality": {"usable": False},
        }
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from hwp5.hwp5txt import main; main()",
                file_path,
            ],
            capture_output=True,
            check=False,
            timeout=90,
        )
        text = ""
        for encoding in ["utf-8", "cp949", "euc-kr"]:
            try:
                text = result.stdout.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        text = clean_hwp_text(text)
        quality = hwp_text_quality(text)
        if result.returncode == 0 and quality["usable"]:
            return {
                "text": text,
                "method": "hwp5txt",
                "quality": quality,
            }
        return {
            "text": "",
            "method": "hwp5txt_quality_failed",
            "quality": quality,
            "error_message": clean_hwp_text(
                result.stderr.decode("utf-8", errors="ignore")
            ),
        }
    except Exception as exc:
        return {
            "text": "",
            "method": "hwp5txt_failed",
            "quality": {"usable": False},
            "error_message": str(exc),
        }


def process_attachment_candidates(
    candidates: Iterable[dict[str, Any]],
    downloader: Any,
) -> dict[str, Any]:
    selected = select_attachment_candidates(candidates)
    files: list[dict[str, Any]] = []
    text_blocks: list[str] = []
    errors: list[str] = []
    downloaded_count = 0
    total_bytes = 0

    for index, candidate in enumerate(selected, start=1):
        meta = dict(candidate)
        meta.pop("identity", None)
        filename = core.clean_text(meta.get("filename"))
        ext = core.clean_text(meta.get("extension")).lower()
        declared_size = meta.get("size_bytes")

        if downloaded_count >= ATTACHMENT_DOWNLOAD_LIMIT:
            meta["extraction_status"] = "skipped_download_limit"
            files.append(meta)
            continue
        if isinstance(declared_size, (int, float)) and declared_size > ATTACHMENT_MAX_BYTES:
            meta["extraction_status"] = "skipped_too_large"
            files.append(meta)
            continue

        try:
            response = downloader(candidate)
            response.raise_for_status()
            data = response.content or b""
            content_type = response.headers.get("content-type", "")
            source_filename = filename
            source_ext = (
                core.clean_text(candidate.get("extension")).lower()
                or attachment_extension(source_filename)
            )
            response_name = repair_download_filename(
                core.filename_from_response(
                    core.clean_text(candidate.get("url")),
                    response,
                )
            )
            response_ext = attachment_extension(response_name)
            detected_ext = attachment_extension_from_bytes(
                data,
                content_type,
            )
            if (
                source_ext not in ATTACHMENT_EXTENSION_PRIORITY
                and response_name
                and response_name not in {
                "pdfFileDownload.do",
                "fileDown2.do",
                "fileDownload.do",
                }
            ):
                filename = response_name
            ext = (
                detected_ext
                or (
                    source_ext
                    if source_ext in ATTACHMENT_EXTENSION_PRIORITY
                    else ""
                )
                or response_ext
                or attachment_extension(filename)
                or source_ext
                or core.extension_from_filename(filename, content_type)
            )
            if detected_ext and attachment_extension(filename) != detected_ext:
                filename_stem = Path(filename).stem if filename else "attachment"
                filename = f"{filename_stem}{detected_ext}"
            meta.update(
                {
                    "filename": filename,
                    "extension": ext,
                    "content_type": content_type,
                    "size_bytes": len(data),
                }
            )

            if is_invalid_attachment_response(data, content_type):
                meta["extraction_status"] = "invalid_download_response"
                errors.append(f"{filename or candidate.get('url')}: invalid response")
            elif len(data) > ATTACHMENT_MAX_BYTES:
                meta["extraction_status"] = "skipped_too_large"
            elif total_bytes + len(data) > ATTACHMENT_TOTAL_MAX_BYTES:
                meta["extraction_status"] = "skipped_total_size_limit"
            else:
                downloaded_count += 1
                total_bytes += len(data)
                if ext == ".hwp":
                    hwp_result = extract_hwp_text(data)
                    hwp_text = hwp_result.get("text") or ""
                    hwp_method = hwp_result.get("method") or "extract_failed"
                    hwp_quality = hwp_result.get("quality") or {}
                    meta["hwp_extraction_method"] = hwp_method
                    meta["text_quality"] = hwp_quality
                    if hwp_text:
                        meta["extraction_status"] = (
                            "extracted_hwp_bodytext"
                            if hwp_method == "bodytext"
                            else "extracted_hwp_preview"
                        )
                        meta["text_length"] = len(hwp_text)
                        text_blocks.append(
                            f"[attachment_text {index}: {filename}]\n"
                            f"{core.clean_text(hwp_text, 12000)}"
                        )
                    else:
                        meta["extraction_status"] = (
                            "hwp_text_quality_failed"
                            if hwp_method == "quality_failed"
                            else "hwp_extract_failed"
                        )
                        if hwp_result.get("error_message"):
                            meta["error_message"] = hwp_result["error_message"]
                        errors.append(
                            f"{filename}: HWP extraction {hwp_method}"
                        )
                elif ext not in ATTACHMENT_EXTRACTABLE_EXTENSIONS:
                    meta["extraction_status"] = "unsupported_extension"
                else:
                    text = core.extract_attachment_text(data, ext)
                    if text:
                        meta["extraction_status"] = "extracted"
                        meta["text_length"] = len(text)
                        text_blocks.append(
                            f"[attachment_text {index}: {filename}]\n"
                            f"{core.clean_text(text, 12000)}"
                        )
                    else:
                        meta["extraction_status"] = "extract_failed"
                        errors.append(f"{filename}: text extraction failed")
        except Exception as exc:
            meta["extraction_status"] = "download_failed"
            meta["error_message"] = str(exc)
            errors.append(f"{filename or candidate.get('url')}: {exc}")
        files.append(meta)

    return {
        "attachment_text": "\n\n".join(text_blocks),
        "attachment_files": files,
        "error_message": " / ".join(errors[:10]),
        "attachment_stats": {
            "candidate_count": len(selected),
            "downloaded_count": downloaded_count,
            "extracted_count": sum(
                1 for file_meta in files
                if str(file_meta.get("extraction_status") or "").startswith(
                    "extracted"
                )
            ),
            "downloaded_bytes": total_bytes,
        },
    }


def _fetch_smart_factory_attachment_metadata(
    session: requests.Session,
    atch_file_id: str,
) -> dict[str, Any]:
    if not atch_file_id:
        return {
            "attachment_text": "",
            "attachment_files": [],
            "error_message": "",
        }

    payload = {
        "tmpltType": 0,
        "exclDocTypeCd": [],
        "speclDocTypeCd": [],
        "atchFileId": atch_file_id,
        "asmtId": None,
        "taskClsfCd": "",
        "rcrtPbancId": None,
        "instRcrtTaskClsfCd": None,
        "pbancId": None,
        "pbancSn": None,
        "upDocTypeCd": "F00276",
        "sbmsnEsntlYn": "N",
        "extnNm": (
            "png,jpg,jpeg,hwp,hwpx,xls,xlsx,pdf,ppt,pptx,"
            "doc,docx,cvs,txt,zip,egg"
        ),
        "docTypeCd": None,
        "giveTypeCd": None,
        "singleOnlyRead": "N",
        "tmpltDesignType": None,
    }
    try:
        response = session.post(
            f"{SMART_FACTORY_BASE_URL}{SMART_FACTORY_ATTACHMENT_LIST_PATH}",
            headers=smart_factory_headers(),
            json=payload,
            timeout=40,
        )
        response.raise_for_status()
        data = response.json()
        files = data.get("fileList") or []
        attachment_files = [
            {
                "filename": core.clean_text(row.get("orginalFileNm")),
                "extension": "." + core.clean_text(row.get("fileExtsnNm")).lstrip("."),
                "size_bytes": row.get("fileSizeCo"),
                "attachment_id": row.get("atchFileId"),
                "attachment_sequence": row.get("atchFileSn"),
                "document_type": core.clean_text(row.get("docTypeNm")),
                "registered_at": row.get("registDt"),
                "extraction_status": "metadata_only",
                "error_message": "다운로드 endpoint 미확인으로 텍스트 추출 생략",
            }
            for row in files
        ]
        error_message = ""
        if attachment_files:
            error_message = (
                "스마트공장 첨부 메타데이터는 확인했으나 다운로드가 전용 "
                "웹 컴포넌트 방식이어서 본 수집에서는 텍스트 추출하지 않음"
            )
        return {
            "attachment_text": "",
            "attachment_files": attachment_files,
            "error_message": error_message,
            "source_api_json": {
                "attachment_id": atch_file_id,
                "attachment_files": files,
            },
        }
    except Exception as exc:
        return {
            "attachment_text": "",
            "attachment_files": [],
            "error_message": f"스마트공장 첨부 목록 조회 실패: {exc}",
        }


def fetch_smart_factory_attachments(
    session: requests.Session,
    atch_file_id: str,
) -> dict[str, Any]:
    if not atch_file_id:
        return {
            "attachment_text": "",
            "attachment_files": [],
            "error_message": "",
        }

    payload = {
        "tmpltType": 0,
        "exclDocTypeCd": [],
        "speclDocTypeCd": [],
        "atchFileId": atch_file_id,
        "asmtId": None,
        "taskClsfCd": "",
        "rcrtPbancId": None,
        "instRcrtTaskClsfCd": None,
        "pbancId": None,
        "pbancSn": None,
        "upDocTypeCd": "F00276",
        "sbmsnEsntlYn": "N",
        "extnNm": (
            "png,jpg,jpeg,hwp,hwpx,xls,xlsx,pdf,ppt,pptx,"
            "doc,docx,cvs,txt,zip,egg"
        ),
        "docTypeCd": None,
        "giveTypeCd": None,
        "singleOnlyRead": "N",
        "tmpltDesignType": None,
    }
    try:
        response = session.post(
            f"{SMART_FACTORY_BASE_URL}{SMART_FACTORY_ATTACHMENT_LIST_PATH}",
            headers=smart_factory_headers(),
            json=payload,
            timeout=40,
        )
        response.raise_for_status()
        source_files = response.json().get("fileList") or []
        candidates = [
            {
                "filename": core.clean_text(row.get("orginalFileNm")),
                "extension": (
                    "."
                    + core.clean_text(row.get("fileExtsnNm")).lstrip(".").lower()
                ),
                "size_bytes": row.get("fileSizeCo"),
                "attachment_id": row.get("atchFileId"),
                "attachment_sequence": row.get("atchFileSn"),
                "document_type": core.clean_text(row.get("docTypeNm")),
                "registered_at": row.get("registDt"),
                "identity": (
                    f"{row.get('atchFileId')}:{row.get('atchFileSn')}"
                ),
            }
            for row in source_files
        ]

        def download(candidate: dict[str, Any]) -> requests.Response:
            return session.get(
                f"{SMART_FACTORY_BASE_URL}"
                f"{SMART_FACTORY_ATTACHMENT_DOWNLOAD_PATH}",
                params={
                    "atchFileId": candidate.get("attachment_id"),
                    "atchFileSn": candidate.get("attachment_sequence"),
                },
                headers={
                    **SCRIPT_HEADERS,
                    "Referer": f"{SMART_FACTORY_BASE_URL}/",
                },
                timeout=60,
            )

        result = process_attachment_candidates(candidates, download)
        result["source_api_json"] = {
            "attachment_id": atch_file_id,
            "attachment_files": source_files,
            "attachment_stats": result.get("attachment_stats") or {},
        }
        return result
    except Exception as exc:
        return {
            "attachment_text": "",
            "attachment_files": [],
            "error_message": f"smart-factory attachment collection failed: {exc}",
        }


def adapt_smart_factory_item(
    list_row: dict[str, Any],
    detail_row: dict[str, Any],
) -> tuple[dict[str, Any], str, str]:
    merged = {**list_row, **detail_row}
    pbanc_id = pick(merged, "pbancId")
    pbanc_sn = pick(merged, "pbancSn")
    policy_id = normalize_source_id("smartfactory", pbanc_id, pbanc_sn)
    title = pick(merged, "dtlPbancNm", "pbancNm")
    detail_text = core.clean_text(
        core.clean_html(pick(merged, "pbancCn")),
        max_len=30000,
    )
    period = pick(merged, "rcptYmdDa2002", "rcptYmdDa2001")
    detail_url = (
        f"{SMART_FACTORY_BASE_URL}{SMART_FACTORY_PUBLIC_DETAIL_PATH}?"
        + urlencode({"pbancId": pbanc_id, "pbancSn": pbanc_sn})
    )
    category = pick(merged, "bizClsfYrNm", default="스마트공장")

    target_text = extract_explicit_eligibility_text(detail_text) or ""
    item = {
        "pblancId": policy_id,
        "pblancNm": title,
        "jrsdInsttNm": pick(
            merged,
            "sprvInstNm",
            "mngInstNm",
            default="스마트공장 사업관리시스템",
        ),
        "bsnsSumryCn": detail_text,
        "reqstBeginEndDe": period,
        "pblancRegistDt": pick(merged, "pbancYmd"),
        "hashtags": f"스마트공장,스마트제조,제조업,{category}",
        "trgetNm": target_text,
        "pldirSportRealmLclasCodeNm": "기술",
        "pldirSportRealmMlsfcCodeNm": category,
    }
    return item, detail_text, detail_url


def fetch_energy_agency_page(
    session: requests.Session,
    page: int,
    keyword: str,
) -> list[dict[str, Any]]:
    response = session.post(
        f"{ENERGY_AGENCY_BASE_URL}{ENERGY_AGENCY_LIST_PATH}",
        data={
            "siteCd": "001000000000000",
            "boardMngNo": "2",
            "boardType": "LIST",
            "page": page,
            "searchfield": "ALL",
            "searchword": keyword,
        },
        headers=SCRIPT_HEADERS,
        timeout=40,
    )
    response.raise_for_status()
    pattern = re.compile(
        r"fn_Detail\('2','(?P<board_no>\d+)'\)[^>]*>\s*"
        r"<span>(?P<title>.*?)</span>.*?</a>.*?"
        r"<td[^>]*>\s*(?P<posted_at>20\d{2}-\d{2}-\d{2})\s*</td>",
        re.IGNORECASE | re.DOTALL,
    )
    return [
        {
            "board_no": match.group("board_no"),
            "title": core.clean_html(match.group("title")),
            "posted_at": match.group("posted_at"),
            "keyword": keyword,
        }
        for match in pattern.finditer(response.text)
    ]


def _extract_energy_agency_attachments_legacy(
    session: requests.Session,
    detail_html: str,
) -> dict[str, Any]:
    pattern = re.compile(
        r"fileDownload\('(?P<file_no>\d+)','(?P<file_seq>\d+)','2'\)"
        r"[^>]*>.*?<span>(?:<em[^>]*>.*?</em>)?(?P<filename>.*?)</span>",
        re.IGNORECASE | re.DOTALL,
    )
    files: list[dict[str, Any]] = []
    text_blocks: list[str] = []
    errors: list[str] = []

    for match in pattern.finditer(detail_html):
        file_no = match.group("file_no")
        file_seq = match.group("file_seq")
        filename = core.clean_html(match.group("filename"))
        meta: dict[str, Any] = {
            "filename": filename,
            "file_no": file_no,
            "file_sequence": file_seq,
            "extraction_status": "pending",
        }
        try:
            response = session.post(
                f"{ENERGY_AGENCY_BASE_URL}{ENERGY_AGENCY_FILE_PATH}",
                data={
                    "fileNo": file_no,
                    "fileSeq": file_seq,
                    "boardMngNo": "2",
                },
                headers=SCRIPT_HEADERS,
                timeout=60,
            )
            response.raise_for_status()
            actual_name = core.filename_from_response(
                f"{ENERGY_AGENCY_BASE_URL}{ENERGY_AGENCY_FILE_PATH}",
                response,
            )
            actual_name = repair_download_filename(actual_name)
            if actual_name and actual_name != "fileDownload.do":
                filename = actual_name
                meta["filename"] = filename
            ext = core.extension_from_filename(
                filename,
                response.headers.get("content-type", ""),
            )
            meta.update(
                {
                    "extension": ext,
                    "content_type": response.headers.get("content-type", ""),
                    "size_bytes": len(response.content or b""),
                }
            )
            text = core.extract_attachment_text(response.content or b"", ext)
            if text:
                meta["extraction_status"] = "extracted"
                meta["text_length"] = len(text)
                text_blocks.append(
                    f"[첨부파일: {filename}]\n{core.clean_text(text, 12000)}"
                )
            elif ext == ".hwp":
                meta["extraction_status"] = "unsupported_hwp"
                errors.append(f"{filename}: HWP 텍스트 추출 미지원")
            else:
                meta["extraction_status"] = "no_text"
        except Exception as exc:
            meta["extraction_status"] = "download_failed"
            meta["error_message"] = str(exc)
            errors.append(f"{filename}: {exc}")
        files.append(meta)

    return {
        "attachment_text": "\n\n".join(text_blocks),
        "attachment_files": files,
        "error_message": " / ".join(errors[:10]),
    }


def extract_energy_agency_attachments(
    session: requests.Session,
    detail_html: str,
) -> dict[str, Any]:
    pattern = re.compile(
        r"fileDownload\('(?P<file_no>\d+)','(?P<file_seq>\d+)','2'\)"
        r"[^>]*>.*?<span>(?:<em[^>]*>.*?</em>)?(?P<filename>.*?)</span>",
        re.IGNORECASE | re.DOTALL,
    )
    candidates = [
        {
            "filename": core.clean_html(match.group("filename")),
            "extension": attachment_extension(
                core.clean_html(match.group("filename"))
            ),
            "file_no": match.group("file_no"),
            "file_sequence": match.group("file_seq"),
            "identity": (
                f"{match.group('file_no')}:{match.group('file_seq')}"
            ),
        }
        for match in pattern.finditer(detail_html)
    ]

    def download(candidate: dict[str, Any]) -> requests.Response:
        return session.post(
            f"{ENERGY_AGENCY_BASE_URL}{ENERGY_AGENCY_FILE_PATH}",
            data={
                "fileNo": candidate.get("file_no"),
                "fileSeq": candidate.get("file_sequence"),
                "boardMngNo": "2",
            },
            headers=SCRIPT_HEADERS,
            timeout=60,
        )

    return process_attachment_candidates(candidates, download)


def extract_energy_application_period(text: str) -> str:
    for label in [
        "접수기간",
        "접수 기간",
        "신청기간",
        "신청 기간",
        "공고기간",
        "공고 기간",
        "공고일",
        "모집기간",
        "모집 기간",
    ]:
        window = core.extract_label_window(text, [label], window=260)
        if window:
            normalized = re.sub(
                r"(?<!\d)[’'`]?\s*(\d{2})\s*[.년]\s*",
                lambda match: f"20{match.group(1)}.",
                window,
            )
            dates = core.extract_all_dates(
                normalized,
                reference_year=date.today().year,
            )
            if len(dates) >= 2:
                return f"{min(dates)} ~ {max(dates)}"
            return core.clean_text(normalized, 260)
    return ""


TECHNOPARK_DEADLINE_LABELS_BY_REGION = {
    "부산": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "신청일정", "신청마감"],
        "모집": ["모집기간", "모집일정", "모집마감"],
        "공고": ["공고기간", "공고일", "공고마감"],
    },
    "경남": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "세종": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "인천": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "신청일정", "신청마감"],
        "모집": ["모집기간", "모집일정", "모집마감"],
        "공고": ["공고기간", "공고일"],
    },
    "충남": {
        "접수": ["접수기간", "신청접수기간", "신청·접수기간", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "경기대진": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "신청일정", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고일", "공고기간", "공고마감"],
    },
    "제주": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "신청일정", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "강원": {
        "접수": ["접수기간", "신청접수기간", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "전북": {
        "접수": ["접수기간", "신청접수기간", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "대구": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "경기": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "경북": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "광주": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "대전": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "서울": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "울산": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "전남": {
        "접수": ["접수기간", "신청접수기간", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "충북": {
        "접수": ["접수기간", "신청접수기간", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
    "포항": {
        "접수": ["접수기간", "접수일정", "접수마감"],
        "신청": ["신청기간", "사업신청기간", "신청마감"],
        "모집": ["모집기간", "모집일정"],
        "공고": ["공고기간", "공고일"],
    },
}
TECHNOPARK_DEADLINE_PRIORITY = ("접수", "신청", "모집", "공고")
TECHNOPARK_DEFAULT_DEADLINE_LABELS = {
    "접수": [
        "접수기간",
        "신청접수기간",
        "신청·접수기간",
        "접수일정",
        "접수마감",
        "접수마감일",
        "접수종료일",
        "마감일",
    ],
    "신청": [
        "신청기간",
        "사업신청기간",
        "온라인신청기간",
        "신청일정",
        "신청마감",
        "신청마감일",
    ],
    "모집": ["모집기간", "모집일정", "모집마감"],
    "공고": ["공고기간", "공고일", "공고마감"],
}
TECHNOPARK_DATE_TOKEN_PATTERN = (
    r"(?:(?:20\d{2})\s*(?:[.\-/]|년)\s*)?"
    r"\d{1,2}\s*(?:[.\-/]|월)\s*\d{1,2}\s*(?:일|\.)?"
    r"(?:\s*\([^)]{1,5}\))?"
    r"(?:\s+\d{1,2}:\d{2})?"
)
TECHNOPARK_DATE_RANGE_PATTERN = re.compile(
    rf"(?P<start>{TECHNOPARK_DATE_TOKEN_PATTERN})"
    r"\s*(?:~|∼|～|부터|–|—|\s-\s)\s*"
    rf"(?P<end>{TECHNOPARK_DATE_TOKEN_PATTERN})"
    r"(?:\s*까지)?",
    re.IGNORECASE,
)
TECHNOPARK_SINGLE_DATE_PATTERN = re.compile(
    rf"(?P<date>{TECHNOPARK_DATE_TOKEN_PATTERN})(?:\s*까지|\s*마감)",
    re.IGNORECASE,
)
TECHNOPARK_BARE_DATE_PATTERN = re.compile(
    rf"(?P<date>{TECHNOPARK_DATE_TOKEN_PATTERN})",
    re.IGNORECASE,
)
TECHNOPARK_CONDITIONAL_PERIOD_PATTERN = re.compile(
    r"(상시\s*(?:접수|모집|신청)|"
    r"(?:예산|사업비)\s*소진\s*시(?:까지)?|"
    r"선착순(?:\s*마감)?|"
    r"추후\s*(?:공지|공고)|"
    r"별도\s*(?:공지|공고))",
    re.IGNORECASE,
)


def _flexible_korean_label_pattern(label: str) -> str:
    """Allow TP labels such as '접 수 기 간' without matching arbitrary text."""
    pieces: list[str] = []
    for char in core.clean_text(label):
        if char.isspace():
            pieces.append(r"\s*")
        elif char in {"·", "ㆍ", "/", "・"}:
            pieces.append(r"\s*[·ㆍ/・]?\s*")
        else:
            pieces.append(re.escape(char) + r"\s*")
    return "".join(pieces)


def _technopark_deadline_labels(region: str) -> dict[str, list[str]]:
    regional = TECHNOPARK_DEADLINE_LABELS_BY_REGION.get(region, {})
    return {
        priority: list(
            dict.fromkeys(
                [
                    *(regional.get(priority) or []),
                    *TECHNOPARK_DEFAULT_DEADLINE_LABELS[priority],
                ]
            )
        )
        for priority in TECHNOPARK_DEADLINE_PRIORITY
    }


def _extract_period_expression(value: str) -> str:
    cleaned = core.clean_text(value, 320)
    if not cleaned or "{{" in cleaned or "}}" in cleaned:
        return ""

    range_match = TECHNOPARK_DATE_RANGE_PATTERN.search(cleaned)
    if range_match:
        expression = range_match.group(0)
        trailing_time = re.match(
            r"\s*(?P<time>\d{1,2}:\d{2})(?P<until>\s*까지)?",
            cleaned[range_match.end():],
        )
        if trailing_time and not re.search(r"\d{1,2}:\d{2}\s*(?:까지)?$", expression):
            expression += trailing_time.group(0)
        return core.clean_text(expression)

    single_match = TECHNOPARK_SINGLE_DATE_PATTERN.search(cleaned)
    if single_match:
        return core.clean_text(single_match.group(0))

    conditional_match = TECHNOPARK_CONDITIONAL_PERIOD_PATTERN.search(cleaned)
    if conditional_match:
        return core.clean_text(conditional_match.group(0))

    bare_date_match = TECHNOPARK_BARE_DATE_PATTERN.search(cleaned)
    if bare_date_match:
        expression = bare_date_match.group(0)
        trailing_time = re.match(
            r"\s*(?P<time>\d{1,2}:\d{2})",
            cleaned[bare_date_match.end():],
        )
        if trailing_time:
            expression += trailing_time.group(0)
        return core.clean_text(expression)
    return ""


def extract_technopark_application_period(
    text: str,
    region: str = "",
    detail_url: str = "",
) -> dict[str, Any]:
    """Extract the best TP application period using source-aware label priority."""
    cleaned = core.clean_text(text, 30000)
    if not cleaned:
        return {}

    labels_by_priority = _technopark_deadline_labels(region)

    for priority in TECHNOPARK_DEADLINE_PRIORITY:
        candidates: list[dict[str, Any]] = []
        for label in labels_by_priority[priority]:
            label_pattern = _flexible_korean_label_pattern(label)
            pattern = re.compile(
                rf"(?P<label>{label_pattern})\s*[:：]?\s*"
                r"(?P<value>.{0,320})",
                re.IGNORECASE | re.DOTALL,
            )
            for match in pattern.finditer(cleaned):
                expression = _extract_period_expression(match.group("value"))
                if not expression:
                    continue
                parsed = core.parse_deadline(
                    expression,
                    reference_year=core.infer_reference_year(
                        expression,
                        cleaned[:2000],
                    ),
                )
                if not parsed.get("deadline") and parsed.get(
                    "deadline_type"
                ) == "unknown":
                    continue
                candidates.append(
                    {
                        "period": expression,
                        "display": expression,
                        "label": core.clean_text(match.group("label")),
                        "priority": priority,
                        "region": region or None,
                        "detail_host": urlparse(detail_url).netloc or None,
                        "parsed": parsed,
                        "position": match.start(),
                    }
                )
        if candidates:
            candidates.sort(
                key=lambda candidate: (
                    candidate["parsed"].get("deadline") is None,
                    candidate["position"],
                )
            )
            return candidates[0]
    return {}


def repair_download_filename(value: str) -> str:
    text = str(value or "").strip()
    if not text or not any(
        marker in text
        for marker in ["Ã", "Ç", "¾", "½", "ê", "ë", "ì", "í", "ï"]
    ):
        return text
    try:
        repaired = text.encode("latin1").decode("utf-8")
        if repaired:
            return core.clean_text(repaired)
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    try:
        return core.clean_text(text.encode("latin1").decode("euc-kr"))
    except (UnicodeEncodeError, UnicodeDecodeError):
        return core.clean_text(text)


def clean_attachment_label(value: str) -> str:
    text = core.clean_text(value, 300)
    return re.sub(
        r"\s*\(\s*[\d,.]+\s*(?:bytes?|kb|mb|gb)\s*\)\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()


def fetch_energy_agency_detail(
    session: requests.Session,
    board_no: str,
) -> dict[str, Any]:
    response = session.post(
        f"{ENERGY_AGENCY_BASE_URL}{ENERGY_AGENCY_DETAIL_PATH}",
        data={
            "siteCd": "001000000000000",
            "boardMngNo": "2",
            "boardNo": board_no,
            "boardType": "LIST",
        },
        headers=SCRIPT_HEADERS,
        timeout=40,
    )
    response.raise_for_status()
    html = response.text
    title_match = re.search(
        r'<p[^>]*class="[^"]*view_top_tit[^"]*"[^>]*>(.*?)</p>',
        html,
        re.IGNORECASE | re.DOTALL,
    )
    date_match = re.search(
        r"작성일\s*:</span>\s*<em>(20\d{2}-\d{2}-\d{2})</em>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    content_match = re.search(
        r'<div[^>]*class="view_cont"[^>]*>(.*?)'
        r'<!--\s*/bott\s*-->',
        html,
        re.IGNORECASE | re.DOTALL,
    )
    detail_text = core.clean_html(
        content_match.group(1) if content_match else ""
    )
    attachments = extract_energy_agency_attachments(session, html)
    return {
        "board_no": board_no,
        "title": core.clean_html(title_match.group(1)) if title_match else "",
        "posted_at": date_match.group(1) if date_match else "",
        "detail_text": core.clean_text(detail_text, 30000),
        **attachments,
        "application_period": extract_energy_application_period(detail_text),
        "detail_url": (
            f"{ENERGY_AGENCY_BASE_URL}{ENERGY_AGENCY_DETAIL_PATH}?"
            + urlencode({"boardMngNo": "2", "boardNo": board_no})
        ),
    }


def adapt_energy_agency_item(
    list_row: dict[str, Any],
    detail_row: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], str]:
    board_no = core.clean_text(detail_row.get("board_no") or list_row.get("board_no"))
    title = core.clean_text(detail_row.get("title") or list_row.get("title"))
    detail_text = core.clean_text(detail_row.get("detail_text"), 30000)
    keyword_text = " ".join(
        keyword for keyword in ENERGY_AGENCY_KEYWORDS if keyword in f"{title} {detail_text}"
    )
    industrial = any(
        word in f"{title} {detail_text}"
        for word in [
            "산업",
            "사업장",
            "공장",
            "제조",
            "중소기업",
            "중견기업",
            "기업",
            "ESCO",
        ]
    )
    hashtags = [
        "한국에너지공단",
        "에너지효율",
        *keyword_text.split(),
    ]
    if industrial:
        hashtags.extend(["제조업", "설비투자"])

    policy_id = normalize_source_id("energyagency", board_no)
    target_text = extract_explicit_eligibility_text(detail_text) or ""
    item = {
        "pblancId": policy_id,
        "pblancNm": title,
        "jrsdInsttNm": "한국에너지공단",
        "bsnsSumryCn": detail_text,
        "reqstBeginEndDe": detail_row.get("application_period") or "",
        "pblancRegistDt": detail_row.get("posted_at") or list_row.get("posted_at"),
        "hashtags": ",".join(dict.fromkeys(filter(None, hashtags))),
        "trgetNm": target_text,
        "pldirSportRealmLclasCodeNm": "기술",
        "pldirSportRealmMlsfcCodeNm": "에너지효율·탄소감축",
    }
    detail_content = {
        "detail_text": detail_text,
        "attachment_text": detail_row.get("attachment_text") or "",
        "attachment_files": detail_row.get("attachment_files") or [],
        "combined_text": "\n\n".join(
            part
            for part in [
                detail_text,
                detail_row.get("attachment_text") or "",
            ]
            if part
        ),
        "error_message": detail_row.get("error_message") or "",
        "source_api_json": {
            "list": list_row,
            "detail": {
                key: value
                for key, value in detail_row.items()
                if key not in {"detail_text", "attachment_text"}
            },
        },
    }
    return item, detail_content, detail_row.get("detail_url") or ""


def _longest_content_value(value: Any) -> str:
    candidates: list[str] = []

    def visit(node: Any, key: str = "") -> None:
        if isinstance(node, dict):
            for child_key, child_value in node.items():
                visit(child_value, str(child_key))
            return
        if isinstance(node, list):
            for child in node:
                visit(child, key)
            return
        if not isinstance(node, str):
            return

        lowered_key = key.lower()
        if any(
            token in lowered_key
            for token in ["file", "fl_nm", "url", "path", "titl", "name"]
        ):
            return
        cleaned = core.clean_text(core.clean_html(node), 30000)
        if len(cleaned) >= 80:
            candidates.append(cleaned)

    visit(value)
    return max(candidates, key=len) if candidates else ""


def _extract_main_page_text(html: str) -> str:
    specific_candidates: list[str] = []
    specific_patterns = [
        r"<article\b[^>]*>(.*?)</article>",
        r'<div\b[^>]*(?:id|class)=["\'][^"\']*'
        r"(?:content|contents|board-view|view_cont|view-content|bbs-view|detail)"
        r'[^"\']*["\'][^>]*>(.*?)</div>',
    ]
    for pattern in specific_patterns:
        for match in re.finditer(pattern, html, re.IGNORECASE | re.DOTALL):
            text = core.clean_text(core.clean_html(match.group(1)), 30000)
            if len(text) >= 80:
                specific_candidates.append(text)

    if specific_candidates:
        return max(specific_candidates, key=len)

    main_match = re.search(
        r"<main\b[^>]*>(.*?)</main>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if main_match:
        return core.clean_text(core.clean_html(main_match.group(1)), 30000)
    return core.clean_text(core.clean_html(html), 30000)


def _trim_detail_text(text: str, title: str) -> str:
    cleaned = core.clean_text(text, 30000)
    title = core.clean_text(title)
    if title and title in cleaned:
        cleaned = cleaned[cleaned.find(title):]
    for marker in [
        "목록 이전글",
        "목록 다음글",
        "열람하신 정보에 대해 만족하십니까",
        "개인정보처리방침",
        "영상정보처리기기",
        "이메일무단수집거부",
        "패밀리 사이트",
    ]:
        marker_index = cleaned.find(marker)
        if marker_index > 200:
            cleaned = cleaned[:marker_index]
    return core.clean_text(cleaned, 30000)


def _console_safe(text: str) -> str:
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    return text.encode(
        encoding,
        errors="backslashreplace",
    ).decode(
        encoding,
        errors="replace",
    )


def fetch_kosmes_page(
    session: requests.Session,
    page: int,
    keyword: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    response = session.post(
        f"{KOSMES_BASE_URL}{KOSMES_NOTICE_LIST_PATH}",
        data={
            "nowPage": page,
            "pageCount": 10,
            "rowCount": 10,
            "param": "proc=List",
            "bKind": "popluar",
            "activatedTab": "01",
            "searchG": "titleCon",
            "searchT": keyword,
            "code": "",
        },
        headers=SCRIPT_HEADERS,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("ds_infoList") or [], data.get("pageInfo") or {}


def fetch_kosmes_detail(
    session: requests.Session,
    seq_no: str,
    list_row: dict[str, Any],
) -> dict[str, Any]:
    detail_url = (
        f"{KOSMES_BASE_URL}{KOSMES_NOTICE_DETAIL_PATH}?"
        + urlencode({"seqNo": seq_no, "tabPage": "01"})
    )
    result: dict[str, Any] = {
        **list_row,
        "SLNO": seq_no,
        "detail_url": detail_url,
    }
    errors: list[str] = []

    try:
        response = session.post(
            f"{KOSMES_BASE_URL}{KOSMES_NOTICE_LIST_PATH}",
            data={
                "nowPage": 1,
                "param": f"proc=View&seqNo={seq_no}",
                "activatedTab": "01",
            },
            headers=SCRIPT_HEADERS,
            timeout=60,
        )
        response.raise_for_status()
        detail_json = response.json()
        info = detail_json.get("ds_infoMap") or {}
        result.update(info)
        result["source_api_json"] = {
            "list": list_row,
            "detail": info,
        }
    except Exception as exc:
        errors.append(f"상세 JSON 조회 실패: {exc}")
        result["source_api_json"] = {"list": list_row}

    detail_text = _longest_content_value(result)
    if not detail_text:
        try:
            response = session.get(
                detail_url,
                headers=SCRIPT_HEADERS,
                timeout=40,
            )
            response.raise_for_status()
            detail_text = _extract_main_page_text(response.text)
        except Exception as exc:
            errors.append(f"상세 HTML 조회 실패: {exc}")

    attachment_files: list[dict[str, Any]] = []
    for index in range(1, 4):
        filename = core.clean_text(result.get(f"OD{index}_FL_NM"))
        masked_name = core.clean_text(result.get(f"OD{index}_FL_MSK_TXT"))
        if not filename:
            continue
        attachment_files.append(
            {
                "filename": filename,
                "masked_filename": masked_name or None,
                "extension": Path(filename).suffix.lower(),
                "extraction_status": "metadata_only",
                "error_message": (
                    "중진공 공통 JavaScript 다운로드 방식으로 "
                    "이번 수집에서는 첨부 텍스트 추출 생략"
                ),
            }
        )

    return {
        **result,
        "detail_text": core.clean_text(detail_text, 30000),
        "attachment_text": "",
        "attachment_files": attachment_files,
        "error_message": " / ".join(errors),
    }


def download_kosmes_attachments(
    session: requests.Session,
    detail_row: dict[str, Any],
) -> dict[str, Any]:
    detail_url = core.clean_text(detail_row.get("detail_url"))
    candidates = []
    for file_meta in detail_row.get("attachment_files") or []:
        candidate = dict(file_meta)
        candidate["identity"] = (
            core.clean_text(candidate.get("masked_filename"))
            or core.clean_text(candidate.get("filename"))
        )
        candidates.append(candidate)

    def download(candidate: dict[str, Any]) -> requests.Response:
        return session.post(
            f"{KOSMES_BASE_URL}{KOSMES_FILE_DOWNLOAD_PATH}",
            data={
                "name": candidate.get("masked_filename"),
                "Rname": candidate.get("filename"),
                "path": "upload",
            },
            headers={
                **SCRIPT_HEADERS,
                "Referer": detail_url or f"{KOSMES_BASE_URL}/",
            },
            timeout=60,
        )

    return process_attachment_candidates(candidates, download)


def adapt_kosmes_item(
    list_row: dict[str, Any],
    detail_row: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], str]:
    merged = {**list_row, **detail_row}
    seq_no = core.clean_text(merged.get("SLNO"))
    title = core.clean_text(merged.get("TITL_NM"))
    detail_text = core.clean_text(detail_row.get("detail_text"), 30000)
    category = core.clean_text(merged.get("CATG_CD"))
    posted_at = core.clean_text(merged.get("REG_DTM"))
    deadline = core.clean_text(merged.get("VALI_DT"))
    target_text = extract_explicit_eligibility_text(detail_text) or ""
    policy_id = normalize_source_id("kosmes", seq_no)
    detail_url = core.clean_text(detail_row.get("detail_url"))

    hashtags = ["중소벤처기업진흥공단", category]
    hashtags.extend(
        keyword
        for keyword in KOSMES_KEYWORDS
        if keyword in f"{title} {detail_text}"
    )
    item = {
        "pblancId": policy_id,
        "pblancNm": title,
        "jrsdInsttNm": "중소벤처기업진흥공단",
        "bsnsSumryCn": detail_text or title,
        "reqstBeginEndDe": (
            extract_energy_application_period(detail_text)
            or join_period(posted_at, deadline)
        ),
        "pblancRegistDt": posted_at,
        "hashtags": ",".join(dict.fromkeys(filter(None, hashtags))),
        "trgetNm": target_text,
        "pldirSportRealmLclasCodeNm": "",
        "pldirSportRealmMlsfcCodeNm": "",
    }
    detail_content = {
        "detail_text": detail_text,
        "attachment_text": detail_row.get("attachment_text") or "",
        "attachment_files": detail_row.get("attachment_files") or [],
        "combined_text": "\n\n".join(
            part
            for part in [
                detail_text,
                detail_row.get("attachment_text") or "",
            ]
            if part
        ),
        "error_message": detail_row.get("error_message") or "",
        "source_api_json": detail_row.get("source_api_json") or {
            "list": list_row
        },
    }
    return item, detail_content, detail_url


def fetch_technopark_page(
    session: requests.Session,
    page: int,
) -> list[dict[str, Any]]:
    response = session.get(
        f"{TECHNOPARK_BASE_URL}{TECHNOPARK_LIST_PATH}",
        params={
            "mid": "1012",
            "type": "P",
            "pageNo": page,
        },
        headers=SCRIPT_HEADERS,
        timeout=40,
    )
    response.raise_for_status()
    html = response.text
    rows: list[dict[str, Any]] = []
    row_pattern = re.compile(
        r"<tr\b[^>]*>(?P<body>.*?)</tr>",
        re.IGNORECASE | re.DOTALL,
    )
    for row_match in row_pattern.finditer(html):
        body = row_match.group("body")
        cells = re.findall(
            r"<td\b[^>]*>(.*?)</td>",
            body,
            re.IGNORECASE | re.DOTALL,
        )
        link_match = re.search(
            r'<a\b[^>]*href=["\'](?P<url>https?://[^"\']+)["\'][^>]*'
            r"(?:onclick=[\"'][^\"']*updateRdcnt\('(?P<link_id>\d+)'\)[^\"']*[\"'])?"
            r"[^>]*>(?P<title>.*?)</a>",
            body,
            re.IGNORECASE | re.DOTALL,
        )
        if not link_match or len(cells) < 4:
            continue
        region = core.clean_text(core.clean_html(cells[1]))
        title = core.clean_text(core.clean_html(link_match.group("title")))
        posted_at_match = re.search(r"20\d{2}-\d{2}-\d{2}", core.clean_html(cells[3]))
        detail_url = link_match.group("url").replace("&amp;", "&")
        link_id_match = re.search(
            r"updateRdcnt\('(?P<link_id>\d+)'\)",
            body,
            re.IGNORECASE,
        )
        link_id = (
            core.clean_text(link_id_match.group("link_id"))
            if link_id_match
            else ""
        )
        if not link_id:
            link_id = hashlib.sha1(detail_url.encode("utf-8")).hexdigest()[:16]
        rows.append(
            {
                "link_id": link_id,
                "region": region,
                "title": title,
                "posted_at": posted_at_match.group(0) if posted_at_match else "",
                "detail_url": detail_url,
            }
        )
    return rows


def extract_web_attachment_candidates(
    html: str,
    base_url: str,
) -> list[dict[str, Any]]:
    named_candidates: list[tuple[str, str]] = []
    for match in re.finditer(
        r"""<a\b(?P<attrs>[^>]*)>(?P<label>.*?)</a>""",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        attrs = match.group("attrs")
        href_match = re.search(
            r"""href\s*=\s*["'](?P<url>[^"']+)["']""",
            attrs,
            flags=re.IGNORECASE,
        )
        if not href_match:
            continue
        label = clean_attachment_label(
            core.clean_html(match.group("label"))
        )
        named_candidates.append((href_match.group("url"), label))

    raw_candidates: list[str] = []
    raw_candidates.extend(
        re.findall(
            (
                r"""(?:href|src|data-url|data-href|data-file|"""
                r"""data-download-url)\s*=\s*["']([^"']+)["']"""
            ),
            html,
            flags=re.IGNORECASE,
        )
    )
    for script_value in re.findall(
        r"""onclick\s*=\s*(?:"([^"]+)"|'([^']+)')""",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        script = next(
            (value for value in script_value if value),
            "",
        )
        raw_candidates.extend(
            re.findall(
                (
                    r"""(?:["']|^)((?:https?:)?//[^"'()\s]+|"""
                    r"""/[^"'()\s]*(?:download|filedown|boardfile|"""
                    r"""uploadmgr|atch)[^"'()\s]*)(?=["']|$)"""
                ),
                script,
                flags=re.IGNORECASE,
            )
        )
    raw_candidates.extend(
        re.findall(
            r"""["']([^"']+\.(?:pdf|hwp|hwpx|docx?|xlsx?)(?:\?[^"']*)?)["']""",
            html,
            flags=re.IGNORECASE,
        )
    )

    candidates = []
    for raw_url, label in [
        *named_candidates,
        *((raw_url, "") for raw_url in raw_candidates),
    ]:
        normalized_raw_url = raw_url.strip().lower()
        if normalized_raw_url.startswith(
            (
                "javascript:",
                "data:",
                "blob:",
                "#",
                "mailto:",
                "tel:",
            )
        ):
            continue
        url = urljoin(base_url, raw_url.replace("&amp;", "&"))
        if not core.is_probable_attachment_url(url):
            continue
        filename = (
            repair_download_filename(label)
            or Path(urlparse(url).path).name
        )
        filename_ext = attachment_extension(filename)
        url_ext = attachment_extension(url)
        supported_extensions = set(ATTACHMENT_EXTENSION_PRIORITY)
        if (
            filename_ext not in supported_extensions
            and url_ext not in supported_extensions
            and not any(
                marker in url.lower()
                for marker in [
                    "download",
                    "filedown",
                    "boardfile",
                    "uploadmgr",
                    "atchfile",
                ]
            )
        ):
            continue
        candidates.append(
            {
                "url": url,
                "filename": filename,
                "extension": filename_ext or url_ext,
                "identity": url,
            }
        )

    for match in re.finditer(
        (
            r"""<a\b[^>]*href=["']javascript:file_down\("""
            r"""\s*'(?P<no>[^']+)'\s*,\s*'(?P<gubun>[^']+)'"""
            r"""\s*,\s*'(?P<kinds>[^']+)'\s*\)["'][^>]*>"""
            r"""(?P<label>.*?)</a>"""
        ),
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        filename = repair_download_filename(
            clean_attachment_label(core.clean_html(match.group("label")))
        )
        url = urljoin(
            base_url,
            (
                "/biz/file/File_down.do"
                f"?no={match.group('no')}"
                f"&gubun={match.group('gubun')}"
                f"&kinds={match.group('kinds')}"
            ),
        )
        candidates.append(
            {
                "url": url,
                "filename": filename,
                "extension": attachment_extension(filename),
                "identity": url,
            }
        )

    for match in re.finditer(
        (
            r"""<a\b[^>]*href=["']javascript:fn_egov_downFile\("""
            r"""\s*'(?P<file_id>[^']+)'\s*,\s*'(?P<file_sn>[^']+)'"""
            r"""\s*\)["'][^>]*>(?P<label>.*?)</a>"""
        ),
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        filename = repair_download_filename(
            clean_attachment_label(core.clean_html(match.group("label")))
        )
        url = urljoin(
            base_url,
            (
                "/cmm/fms/FileDown.do"
                f"?atchFileId={match.group('file_id')}"
                f"&fileSn={match.group('file_sn')}"
            ),
        )
        candidates.append(
            {
                "url": url,
                "filename": filename,
                "extension": attachment_extension(filename),
                "identity": url,
            }
        )
    return select_attachment_candidates(candidates)


def fetch_web_attachment_content(
    session: requests.Session,
    html: str,
    base_url: str,
) -> dict[str, Any]:
    candidates = extract_web_attachment_candidates(html, base_url)

    def download(candidate: dict[str, Any]) -> requests.Response:
        url = core.clean_text(candidate.get("url"))
        headers = {
            **SCRIPT_HEADERS,
            "Accept": (
                "application/pdf,application/octet-stream,"
                "application/zip,*/*"
            ),
            "Referer": base_url,
        }
        response = session.get(
            url,
            headers=headers,
            timeout=60,
            allow_redirects=True,
        )
        return response

    return process_attachment_candidates(candidates, download)


def fetch_technopark_detail(
    session: requests.Session,
    row: dict[str, Any],
) -> dict[str, Any]:
    detail_url = core.clean_text(row.get("detail_url"))
    result: dict[str, Any] = {
        "detail_text": "",
        "attachment_text": "",
        "attachment_files": [],
        "error_message": "",
        "source_api_json": {"list": row},
    }
    try:
        try:
            response = session.get(
                detail_url,
                headers=SCRIPT_HEADERS,
                timeout=50,
                allow_redirects=True,
            )
        except requests.exceptions.SSLError:
            if not urlparse(detail_url).netloc.endswith("dgtp.or.kr"):
                raise
            response = session.get(
                detail_url,
                headers=SCRIPT_HEADERS,
                timeout=50,
                allow_redirects=True,
                verify=False,
            )
        response.raise_for_status()
        if not response.encoding or response.encoding.lower() in {
            "iso-8859-1",
            "ascii",
        }:
            response.encoding = response.apparent_encoding or "utf-8"
        html = response.text
        result["detail_text"] = _trim_detail_text(
            _extract_main_page_text(html),
            core.clean_text(row.get("title")),
        )
        attachment_content = fetch_web_attachment_content(
            session,
            html,
            response.url,
        )
        attachment_text = attachment_content.get("attachment_text") or ""
        attachment_files = attachment_content.get("attachment_files") or []
        for file_meta in attachment_files:
            original_name = str(file_meta.get("filename") or "").strip()
            repaired_name = repair_download_filename(original_name)
            if repaired_name and repaired_name != original_name:
                file_meta["filename"] = repaired_name
                attachment_text = attachment_text.replace(
                    original_name,
                    repaired_name,
                )
        result["attachment_text"] = attachment_text
        result["attachment_files"] = attachment_files
        result["error_message"] = (
            attachment_content.get("error_message") or ""
        )
        result["source_api_json"] = {
            "list": row,
            "resolved_url": response.url,
            "detail_host": urlparse(response.url).netloc,
        }
    except Exception as exc:
        result["error_message"] = f"지역 테크노파크 상세 조회 실패: {exc}"
    return result


def adapt_technopark_item(
    list_row: dict[str, Any],
    detail_row: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], str]:
    title = core.clean_text(list_row.get("title"))
    region = core.clean_text(list_row.get("region"))
    posted_at = core.clean_text(list_row.get("posted_at"))
    detail_text = core.clean_text(detail_row.get("detail_text"), 30000)
    detail_url = core.clean_text(list_row.get("detail_url"))
    target_text = extract_explicit_eligibility_text(detail_text) or ""
    source_id = core.clean_text(list_row.get("link_id"))
    policy_id = normalize_source_id("technopark", source_id)
    deadline_info = extract_technopark_application_period(
        detail_text,
        region=region,
        detail_url=detail_url,
    )

    matched_keywords = [
        keyword
        for keyword in TECHNOPARK_KEYWORDS
        if keyword in f"{title} {detail_text}"
    ]
    item = {
        "pblancId": policy_id,
        "pblancNm": title,
        "jrsdInsttNm": f"{region}테크노파크" if region else "지역 테크노파크",
        "bsnsSumryCn": detail_text or title,
        "reqstBeginEndDe": deadline_info.get("period") or "",
        "pblancRegistDt": posted_at,
        "hashtags": ",".join(
            dict.fromkeys(
                filter(
                    None,
                    ["테크노파크", region, *matched_keywords],
                )
            )
        ),
        "trgetNm": target_text,
        "pldirSportRealmLclasCodeNm": "",
        "pldirSportRealmMlsfcCodeNm": "",
        "_technopark_deadline": deadline_info,
    }
    detail_content = {
        "detail_text": detail_text,
        "attachment_text": detail_row.get("attachment_text") or "",
        "attachment_files": detail_row.get("attachment_files") or [],
        "combined_text": "\n\n".join(
            part
            for part in [
                detail_text,
                detail_row.get("attachment_text") or "",
            ]
            if part
        ),
        "error_message": detail_row.get("error_message") or "",
        "source_api_json": detail_row.get("source_api_json") or {
            "list": list_row
        },
    }
    return item, detail_content, detail_url


def _generic_external_item(
    *,
    policy_id: str,
    title: str,
    organization: str,
    detail_url: str,
    period: str = "",
    posted_at: str = "",
    region: str = "",
    detail_text: str = "",
    attachment_text: str = "",
    attachment_files: list[dict[str, Any]] | None = None,
    source_api_json: dict[str, Any] | None = None,
    error_message: str = "",
) -> tuple[dict[str, Any], dict[str, Any], str]:
    item = {
        "pblancId": policy_id,
        "pblancNm": title,
        "jrsdInsttNm": organization,
        "bsnsSumryCn": detail_text or title,
        "reqstBeginEndDe": period,
        "pblancRegistDt": posted_at,
        "hashtags": ",".join(
            filter(
                None,
                [organization, region],
            )
        ),
        "trgetNm": "",
        "pldirSportRealmLclasCodeNm": "",
        "pldirSportRealmMlsfcCodeNm": "",
    }
    detail_content = {
        "detail_text": detail_text,
        "attachment_text": attachment_text,
        "attachment_files": attachment_files or [],
        "combined_text": "\n\n".join(
            part for part in [detail_text, attachment_text] if part
        ),
        "error_message": error_message,
        "source_api_json": source_api_json or {},
    }
    return item, detail_content, detail_url


def _decode_korean_response(response: requests.Response) -> str:
    content = response.content or b""
    candidates: list[str] = []
    declared = response.encoding
    for encoding in [
        declared,
        "utf-8",
        "cp949",
        "euc-kr",
    ]:
        if not encoding:
            continue
        try:
            decoded = content.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
        if decoded not in candidates:
            candidates.append(decoded)
    if not candidates:
        return content.decode("utf-8", errors="replace")

    def quality(text: str) -> tuple[int, int]:
        hangul = sum("\uac00" <= char <= "\ud7a3" for char in text)
        replacement = text.count("\ufffd")
        return hangul, -replacement

    return max(candidates, key=quality)


def _fetch_generic_html_detail(
    session: requests.Session,
    url: str,
    *,
    method: str = "GET",
    data: dict[str, Any] | None = None,
    title: str = "",
) -> dict[str, Any]:
    try:
        response = session.request(
            method,
            url,
            data=data,
            headers=SCRIPT_HEADERS,
            timeout=50,
            allow_redirects=True,
        )
        response.raise_for_status()
        html = _decode_korean_response(response)
        detail_text = _trim_detail_text(
            _extract_main_page_text(html),
            title,
        )
        attachments = fetch_web_attachment_content(
            session,
            html,
            response.url,
        )
        return {
            "resolved_url": response.url,
            "html": html,
            "detail_text": detail_text,
            "attachment_text": attachments.get("attachment_text") or "",
            "attachment_files": attachments.get("attachment_files") or [],
            "error_message": attachments.get("error_message") or "",
        }
    except Exception as exc:
        return {
            "resolved_url": url,
            "html": "",
            "detail_text": "",
            "attachment_text": "",
            "attachment_files": [],
            "error_message": str(exc),
        }


def _fetch_kpass_detail(
    session: requests.Session,
    row: dict[str, Any],
) -> dict[str, Any]:
    source_id = core.clean_text(row.get("anc_id"))
    detail_url = f"{KPASS_BASE_URL}{KPASS_DETAIL_PATH}"
    try:
        response = session.post(
            detail_url,
            data={
                "ancId": source_id,
                "gubun": row.get("gubun") or "NEW",
            },
            headers=SCRIPT_HEADERS,
            timeout=50,
        )
        response.raise_for_status()
        html = _decode_korean_response(response)
        detail_text = _trim_detail_text(
            _extract_main_page_text(html),
            core.clean_text(row.get("title")),
        )
        posted_at_match = re.search(
            r"등록일\s*(20\d{2})[-./](\d{1,2})[-./](\d{1,2})",
            detail_text,
        )
        posted_at = (
            f"{posted_at_match.group(1)}-"
            f"{int(posted_at_match.group(2)):02d}-"
            f"{int(posted_at_match.group(3)):02d}"
            if posted_at_match
            else ""
        )
        candidates: list[dict[str, Any]] = []
        for match in re.finditer(
            (
                r"""<a\b[^>]*onclick=["'][^"']*"""
                r"""fn_egov_downFile\(\s*'(?P<anc_id>[^']+)'\s*,"""
                r"""\s*'(?P<file_id>[^']+)'\s*,\s*'(?P<seq>[^']+)'"""
                r"""\s*\)[^"']*["'][^>]*>(?P<label>.*?)</a>"""
            ),
            html,
            flags=re.IGNORECASE | re.DOTALL,
        ):
            filename = repair_download_filename(
                clean_attachment_label(
                    core.clean_html(match.group("label"))
                )
            )
            download_url = (
                f"{KPASS_BASE_URL}/cmm/FileDown.do"
                f"?ancId={match.group('anc_id')}"
                f"&atchFileId={match.group('file_id')}"
                f"&seq={match.group('seq')}&type=ANC"
            )
            candidates.append(
                {
                    "url": download_url,
                    "filename": filename,
                    "extension": attachment_extension(filename),
                    "identity": download_url,
                }
            )

        def download(candidate: dict[str, Any]) -> requests.Response:
            return session.get(
                core.clean_text(candidate.get("url")),
                headers={
                    **SCRIPT_HEADERS,
                    "Referer": response.url,
                    "Accept": (
                        "application/pdf,application/octet-stream,"
                        "application/zip,*/*"
                    ),
                },
                timeout=60,
                allow_redirects=True,
            )

        attachments = process_attachment_candidates(candidates, download)
        return {
            "detail_text": detail_text,
            "posted_at": posted_at,
            "attachment_text": attachments.get("attachment_text") or "",
            "attachment_files": attachments.get("attachment_files") or [],
            "error_message": attachments.get("error_message") or "",
        }
    except Exception as exc:
        return {
            "detail_text": "",
            "posted_at": "",
            "attachment_text": "",
            "attachment_files": [],
            "error_message": str(exc),
        }


def fetch_kpass_page(
    session: requests.Session,
    page: int,
) -> list[dict[str, Any]]:
    response = session.post(
        f"{KPASS_BASE_URL}{KPASS_LIST_PATH}",
        data={
            "pageIndex": page,
            "searchAncTitNm": "",
            "searchAncGrCd": "",
            "searchPrgWorkCd": "",
            "searchSrtDtm": "",
            "searchEndDtm": "",
        },
        headers=SCRIPT_HEADERS,
        timeout=50,
    )
    response.raise_for_status()
    html = _decode_korean_response(response)
    rows: list[dict[str, Any]] = []
    for match in re.finditer(
        (
            r"<tr[^>]*>.*?<span[^>]*onclick=[\"'][^\"']*"
            r"ancView\('(?P<anc_id>[^']+)',\s*"
            r"'(?P<gubun>[^']+)'\);?[^\"']*[\"'][^>]*>"
            r"(?P<title>.*?)</span>.*?"
            r"<td[^>]*>\s*(?P<period>20\d{2}.*?"
            r"20\d{2}-\d{2}-\d{2}).*?</td>"
        ),
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        rows.append(
            {
                "anc_id": match.group("anc_id"),
                "gubun": match.group("gubun"),
                "title": core.clean_text(
                    core.clean_html(match.group("title"))
                ),
                "period": core.clean_text(
                    core.clean_html(match.group("period"))
                ),
            }
        )
    return rows


def official_list_period_is_current(
    row: dict[str, Any],
    *,
    as_of: date,
) -> bool:
    title = core.clean_text(row.get("title"))
    title_year_match = re.search(r"(20\d{2})", title)
    if title_year_match and int(title_year_match.group(1)) != as_of.year:
        return False

    period = core.clean_text(row.get("period"))
    dates = re.findall(
        r"(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})",
        period,
    )
    if not dates:
        return False
    end_year, end_month, end_day = dates[-1]
    try:
        return date(
            int(end_year),
            int(end_month),
            int(end_day),
        ) >= as_of
    except ValueError:
        return False


def page_is_entirely_past_year(
    rows: Iterable[dict[str, Any]],
    *,
    as_of: date,
) -> bool:
    years: list[int] = []
    for row in rows:
        match = re.search(
            r"(20\d{2})",
            core.clean_text(row.get("title")),
        )
        if not match:
            return False
        years.append(int(match.group(1)))
    return bool(years) and max(years) < as_of.year


def iter_kpass(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    seen: set[str] = set()
    for page in range(1, args.max_pages + 1):
        rows = fetch_kpass_page(session, page)
        print(f"[kpass] page={page} rows={len(rows)}")
        if not rows:
            break
        current_rows = [
            row
            for row in rows
            if official_list_period_is_current(
                row,
                as_of=date.today(),
            )
        ]
        if not current_rows:
            print(
                f"[kpass] page={page} active_rows=0; "
                "older pages are skipped"
            )
            break
        for row in current_rows:
            source_id = core.clean_text(row.get("anc_id"))
            if not source_id or source_id in seen:
                continue
            seen.add(source_id)
            detail = _fetch_kpass_detail(session, row)
            detail_url = (
                f"{KPASS_BASE_URL}{KPASS_DETAIL_PATH}"
                f"?ancId={source_id}&gubun={row.get('gubun') or 'NEW'}"
            )
            yield (
                "kpass",
                *_generic_external_item(
                    policy_id=f"KPASS:{source_id}",
                    title=core.clean_text(row.get("title")),
                    organization="한국산업기술진흥원",
                    detail_url=detail_url,
                    period=core.clean_text(row.get("period")),
                    posted_at=core.clean_text(detail.get("posted_at")),
                    detail_text=detail.get("detail_text") or "",
                    attachment_text=detail.get("attachment_text") or "",
                    attachment_files=detail.get("attachment_files") or [],
                    source_api_json={"list": row},
                    error_message=detail.get("error_message") or "",
                ),
            )


def fetch_renewable_energy_page(
    session: requests.Session,
    page: int,
) -> list[dict[str, Any]]:
    response = session.get(
        f"{RENEWABLE_ENERGY_BASE_URL}{RENEWABLE_ENERGY_LIST_PATH}",
        params={"page": page},
        headers=SCRIPT_HEADERS,
        timeout=50,
    )
    response.raise_for_status()
    html = _decode_korean_response(response)
    rows_by_id: dict[str, dict[str, Any]] = {}
    generic_labels = {
        "첨부",
        "첨부파일",
        "담당부서",
        "상세보기",
        "보기",
    }
    for match in re.finditer(
        r"""<a\b[^>]*href=["'](?P<url>\.?/view\.do\?no=(?P<no>\d+)[^"']*)["'][^>]*>(?P<title>.*?)</a>""",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        title = core.clean_text(core.clean_html(match.group("title")))
        if not title:
            continue
        source_id = match.group("no")
        candidate = {
            "source_id": source_id,
            "title": title,
            "detail_url": urljoin(response.url, match.group("url")),
        }
        current = rows_by_id.get(source_id)
        candidate_score = (
            title not in generic_labels,
            any(token in title for token in ["공고", "모집", "사업", "지원"]),
            len(title),
        )
        current_title = core.clean_text(
            current.get("title") if current else ""
        )
        current_score = (
            current_title not in generic_labels,
            any(
                token in current_title
                for token in ["공고", "모집", "사업", "지원"]
            ),
            len(current_title),
        )
        if current is None or candidate_score > current_score:
            rows_by_id[source_id] = candidate
    return list(rows_by_id.values())


def iter_renewable_energy(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    seen: set[str] = set()
    for page in range(1, args.max_pages + 1):
        rows = fetch_renewable_energy_page(session, page)
        print(f"[renewable-energy] page={page} rows={len(rows)}")
        if not rows:
            break
        if page_is_entirely_past_year(rows, as_of=date.today()):
            print(
                f"[renewable-energy] page={page} contains only past-year "
                "rows; older pages are skipped"
            )
            break
        for row in rows:
            source_id = core.clean_text(row.get("source_id"))
            if not source_id or source_id in seen:
                continue
            seen.add(source_id)
            detail = _fetch_generic_html_detail(
                session,
                core.clean_text(row.get("detail_url")),
                title=core.clean_text(row.get("title")),
            )
            yield (
                "renewable-energy",
                *_generic_external_item(
                    policy_id=f"RENEWABLEENERGY:{source_id}",
                    title=core.clean_text(row.get("title")),
                    organization="한국에너지공단 신재생에너지센터",
                    detail_url=core.clean_text(row.get("detail_url")),
                    detail_text=detail.get("detail_text") or "",
                    attachment_text=detail.get("attachment_text") or "",
                    attachment_files=detail.get("attachment_files") or [],
                    source_api_json={"list": row},
                    error_message=detail.get("error_message") or "",
                ),
            )


def fetch_smtech_public_page(
    session: requests.Session,
    page: int,
) -> list[dict[str, Any]]:
    response = session.get(
        f"{SMTECH_BASE_URL}{SMTECH_PUBLIC_NOTICE_PATH}",
        params={"pageIndex": page},
        headers=SCRIPT_HEADERS,
        timeout=60,
    )
    response.raise_for_status()
    html = _decode_korean_response(response)
    rows: list[dict[str, Any]] = []
    pattern = re.compile(
        (
            r"""<a\b[^>]*href=["'](?P<url>[^"']*notice02_list\.do"""
            r"""[^"']*ancmId=(?P<ancm_id>\d+)[^"']*"""
            r"""dtlAncmSn=(?P<dtl_sn>\d+)[^"']*)["'][^>]*>"""
            r""".*?<img\b[^>]*title=["'](?P<title>[^"']+)["'][^>]*>"""
            r""".*?</a>"""
        ),
        flags=re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(html):
        title = core.clean_text(core.clean_html(match.group("title")))
        if not title:
            continue
        period_match = re.search(
            r"(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*~\s*"
            r"(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})",
            title,
        )
        rows.append(
            {
                "source_id": (
                    f"{match.group('ancm_id')}:{match.group('dtl_sn')}"
                ),
                "title": re.sub(
                    r"\(과제 접수 기간\).*",
                    "",
                    title,
                ).strip(),
                "period": period_match.group(0) if period_match else "",
                "detail_url": urljoin(
                    response.url,
                    match.group("url").replace("&amp;", "&"),
                ),
            }
        )
    return rows


def iter_tipa_smtech(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    seen: set[str] = set()
    for page in range(1, args.max_pages + 1):
        rows = fetch_smtech_public_page(session, page)
        print(f"[tipa-smtech] page={page} rows={len(rows)}")
        if not rows:
            break
        rows = [
            row
            for row in rows
            if official_list_period_is_current(
                row,
                as_of=date.today(),
            )
        ]
        if not rows:
            print(
                f"[tipa-smtech] page={page} active_rows=0; "
                "older pages are skipped"
            )
            break
        new_rows = 0
        for row in rows:
            source_id = core.clean_text(row.get("source_id"))
            if not source_id or source_id in seen:
                continue
            new_rows += 1
            seen.add(source_id)
            detail = _fetch_generic_html_detail(
                session,
                core.clean_text(row.get("detail_url")),
                title=core.clean_text(row.get("title")),
            )
            if "통합로그인 서비스 일시 장애" in core.clean_text(
                detail.get("detail_text")
            ):
                detail["detail_text"] = ""
                detail["attachment_text"] = ""
                detail["attachment_files"] = []
                detail["error_message"] = (
                    "SMTECH 상세 페이지가 통합로그인 장애 안내로 대체됨"
                )
            yield (
                "tipa-smtech",
                *_generic_external_item(
                    policy_id=f"SMTECH:{source_id}",
                    title=core.clean_text(row.get("title")),
                    organization="중소기업기술정보진흥원",
                    detail_url=core.clean_text(row.get("detail_url")),
                    period=core.clean_text(row.get("period")),
                    detail_text=detail.get("detail_text") or "",
                    attachment_text=detail.get("attachment_text") or "",
                    attachment_files=detail.get("attachment_files") or [],
                    source_api_json={"list": row},
                    error_message=detail.get("error_message") or "",
                ),
            )
        if new_rows == 0:
            break


def fetch_gbsa_page(
    session: requests.Session,
    page: int,
) -> list[dict[str, Any]]:
    response = session.get(
        f"{GBSA_BASE_URL}{GBSA_NOTICE_PATH}",
        params={"pageIndex": page},
        headers=SCRIPT_HEADERS,
        timeout=50,
    )
    response.raise_for_status()
    html = _decode_korean_response(response)
    rows: list[dict[str, Any]] = []
    for match in re.finditer(
        r"""<a\b[^>]*href=["'](?P<url>[^"']*notice\.do\?nttId=(?P<id>\d+)[^"']*)["'][^>]*>(?P<title>.*?)</a>""",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        title = core.clean_text(core.clean_html(match.group("title")))
        if title:
            rows.append(
                {
                    "source_id": match.group("id"),
                    "title": title,
                    "detail_url": urljoin(response.url, match.group("url")),
                }
            )
    return rows


def iter_regional_agency(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    seen: set[str] = set()
    for page in range(1, args.max_pages + 1):
        rows = fetch_gbsa_page(session, page)
        print(f"[regional-agency:gbsa] page={page} rows={len(rows)}")
        if not rows:
            break
        if page_is_entirely_past_year(rows, as_of=date.today()):
            print(
                f"[regional-agency:gbsa] page={page} contains only "
                "past-year rows; older pages are skipped"
            )
            break
        for row in rows:
            source_id = core.clean_text(row.get("source_id"))
            if not source_id or source_id in seen:
                continue
            seen.add(source_id)
            detail = _fetch_generic_html_detail(
                session,
                core.clean_text(row.get("detail_url")),
                title=core.clean_text(row.get("title")),
            )
            yield (
                "regional-agency",
                *_generic_external_item(
                    policy_id=f"GBSA:{source_id}",
                    title=core.clean_text(row.get("title")),
                    organization="경기도경제과학진흥원",
                    detail_url=core.clean_text(row.get("detail_url")),
                    region="경기",
                    detail_text=detail.get("detail_text") or "",
                    attachment_text=detail.get("attachment_text") or "",
                    attachment_files=detail.get("attachment_files") or [],
                    source_api_json={
                        "agency_code": "gbsa",
                        "list": row,
                    },
                    error_message=detail.get("error_message") or "",
                ),
            )


def is_current_or_conditional(
    payload: dict[str, Any],
    include_expired: bool,
    source: str = "",
) -> bool:
    if include_expired:
        return True
    deadline = core.clean_text(payload.get("deadline"))
    if not deadline:
        if source == "energy-agency":
            posted_at = core.clean_text(payload.get("posted_at"))
            if posted_at:
                try:
                    return (
                        datetime.strptime(posted_at, "%Y-%m-%d").year
                        >= date.today().year
                    )
                except ValueError:
                    pass
        return True
    try:
        return datetime.strptime(deadline, "%Y-%m-%d").date() >= date.today()
    except ValueError:
        return True


def validate_table_name(table_name: str) -> str:
    cleaned = core.clean_text(table_name)
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", cleaned):
        raise ValueError(f"Invalid table name: {table_name!r}")
    return cleaned


def render_sql_migration(
    rows: list[dict[str, Any]],
    target_table: str = DEFAULT_TARGET_TABLE,
) -> str:
    if not rows:
        raise ValueError("SQL로 내보낼 수집 공고가 없습니다.")
    target_table = validate_table_name(target_table)

    columns = sorted({key for row in rows for key in row})
    update_columns = [
        column
        for column in columns
        if column not in {"id", "policy_id", "created_at"}
    ]
    column_sql = ",\n        ".join(f'"{column}"' for column in columns)
    select_sql = ",\n        ".join(f'"{column}"' for column in columns)
    update_sql = ",\n        ".join(
        f'"{column}" = EXCLUDED."{column}"'
        for column in update_columns
    )
    payload_json = json.dumps(rows, ensure_ascii=False, indent=2)

    return f"""-- Generated by collect_external_policy_sources.py.
-- Source: External policy sources.
-- Rows: {len(rows)}
-- Existing rows are updated by policy_id; unrelated rows are not deleted.

BEGIN;

WITH incoming AS (
    SELECT *
    FROM jsonb_populate_recordset(
        NULL::public.{target_table},
        $smart_factory_payload$
{payload_json}
$smart_factory_payload$::jsonb
    )
)
INSERT INTO public.{target_table} (
        {column_sql}
)
SELECT
        {select_sql}
FROM incoming
ON CONFLICT (policy_id) DO UPDATE SET
        {update_sql};

COMMIT;
"""


def write_sql_migration(
    path: str,
    rows: list[dict[str, Any]],
    target_table: str = DEFAULT_TARGET_TABLE,
) -> Path:
    output_path = Path(path)
    if not output_path.is_absolute():
        output_path = Path.cwd() / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        render_sql_migration(rows, target_table),
        encoding="utf-8",
    )
    return output_path


def build_energy_temp_extraction(
    payload: dict[str, Any],
    detail_content: dict[str, Any] | str,
) -> dict[str, Any]:
    if isinstance(detail_content, dict):
        text = core.clean_text(detail_content.get("combined_text"), 50000)
    else:
        text = core.clean_text(detail_content, 50000)

    loan = any(keyword in text for keyword in ["융자", "융자금", "자금지원 지침"])
    consulting = any(keyword in text for keyword in ["에너지진단", "진단비", "컨설팅"])
    cash_subsidy = (
        any(keyword in text for keyword in ["보조금", "지원한도", "비용을 지원"])
        and not loan
    )

    if loan:
        support_type = "융자"
        roi_method = "자금조달경로"
        amount_type = "융자한도"
        roi_deductible = False
        review_reason = "융자 한도로 추정되어 ROI 투자비 직접 차감 대상이 아님"
    elif cash_subsidy:
        support_type = "현금보조"
        roi_method = "직접차감 후보"
        amount_type = "현금보조"
        roi_deductible = True
        review_reason = "현금성 지원으로 보이나 지원대상 비용과 중복지원 조건 검토 필요"
    elif consulting:
        roi_method = "간접효과"
        if "컨설팅" in text and "에너지진단" not in text and "진단비" not in text:
            support_type = "컨설팅"
            amount_type = "컨설팅비"
        elif "에너지진단" in text and "컨설팅" not in text:
            support_type = "진단"
            amount_type = "진단비"
        else:
            support_type = "진단·컨설팅"
            amount_type = "진단비"
        roi_deductible = False
        review_reason = "진단·컨설팅 지원은 설비 투자비 직접 차감 대상이 아님"
    else:
        support_type = "검토필요"
        roi_method = "미정"
        amount_type = "미정"
        roi_deductible = False
        review_reason = "지원유형과 금액 성격을 원문에서 추가 검토해야 함"

    amount_windows = [
        core.extract_label_window(text, [label], window=500)
        for label in ["지원한도", "기업당", "사업장 당", "사업장당", "과제당"]
    ]
    targeted_amount_text = "\n".join(
        window for window in amount_windows if window
    ) or text
    normalized_amount_text = re.sub(
        r"(\d{1,3})\.(\d{3})(?=\s*만원)",
        r"\1,\2",
        targeted_amount_text,
    )
    candidates = core.extract_amount_candidates(
        normalized_amount_text,
        require_support_context=False,
    )
    candidates = [
        candidate
        for candidate in candidates
        if not (
            any(
                keyword in candidate.get("context", "")
                for keyword in ["총예산", "총 사업비", "총사업비", "지원규모 : 총"]
            )
            and not any(
                keyword in candidate.get("context", "")
                for keyword in ["기업당", "사업장 당", "사업장당", "과제당", "최대", "한도"]
            )
        )
    ]
    best = (
        sorted(candidates, key=lambda row: (row["score"], row["manwon"]), reverse=True)[0]
        if candidates
        else None
    )
    temporary_amount = round(float(best["manwon"]), 2) if best else None
    evidence = (
        core.clean_text(best.get("context"), 400)
        if best
        else core.clean_text(payload.get("max_amount_evidence"), 400)
    )
    keywords = [
        keyword
        for keyword in ENERGY_AGENCY_KEYWORDS
        if keyword in text
    ]
    if any(word in text for word in ["설비", "시설", "공장", "사업장"]):
        keywords.append("설비투자")

    return {
        "수집출처": "한국에너지공단",
        "임시지원유형": support_type,
        "임시ROI반영방식": roi_method,
        "임시금액유형": amount_type,
        "임시금액_만원": temporary_amount,
        "ROI직접차감가능": roi_deductible,
        "검토필요": True,
        "검토사유": review_reason,
        "근거문장": evidence,
        "키워드": list(dict.fromkeys(keywords)),
    }


def write_csv_preview(path: str, rows: list[dict[str, Any]]) -> Path:
    if not rows:
        raise ValueError("CSV로 내보낼 수집 공고가 없습니다.")
    rows = [sanitize_collection_payload(row) for row in rows]
    output_path = Path(path)
    if not output_path.is_absolute():
        output_path = Path.cwd() / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    columns = sorted({key for row in rows for key in row})
    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            serialized = {
                key: (
                    json.dumps(value, ensure_ascii=False)
                    if isinstance(value, (dict, list))
                    else value
                )
                for key, value in row.items()
            }
            writer.writerow(serialized)
    return output_path


def _eligibility_label_pattern(labels: list[str]) -> re.Pattern[str]:
    variants = {
        re.escape(label.strip()).replace(r"\ ", r"\s*")
        for label in labels
        if label.strip()
    }
    return re.compile(
        r"(?:" + "|".join(sorted(variants, key=len, reverse=True)) + r")",
        re.IGNORECASE,
    )


def is_valid_eligibility_text(text: str | None) -> bool:
    cleaned = core.clean_text(text)
    if not cleaned or len(cleaned) > 500:
        return False
    return not any(word in cleaned for word in FORBIDDEN_ELIGIBILITY_WORDS)


def extract_explicit_eligibility_text(text: str) -> str | None:
    cleaned = core.clean_text(text, max_len=50000)
    if not cleaned:
        return None

    start_pattern = _eligibility_label_pattern(ELIGIBILITY_START_LABELS)
    stop_pattern = _eligibility_label_pattern(ELIGIBILITY_STOP_LABELS)
    start_match = start_pattern.search(cleaned)
    if not start_match:
        return None

    content_start = start_match.end()
    remainder = cleaned[content_start:]
    remainder = re.sub(
        r"^[\s:：\-–—·•○●▶▷■□\(\)\[\]<>]+",
        "",
        remainder,
    )
    remainder = re.sub(r"^(?:은|는)\s+", "", remainder)

    stop_match = stop_pattern.search(remainder)
    candidate = remainder[:stop_match.start()] if stop_match else remainder
    candidate = re.sub(
        r"[\s:：\-–—·•ㅇ○●▶▷■□\(\)\[\]<>]+$",
        "",
        candidate,
    )
    candidate = re.sub(r"(?:자세한|세부|상세)\s*$", "", candidate)
    candidate = core.clean_text(candidate)

    if not is_valid_eligibility_text(candidate):
        return None
    return candidate


def merge_temp_extraction(
    payload: dict[str, Any],
    values: dict[str, Any] | None,
) -> None:
    if not values:
        return
    current = payload.get("temp_extraction_json")
    merged = dict(current) if isinstance(current, dict) else {}
    merged.update({key: value for key, value in values.items() if value is not None})
    payload["temp_extraction_json"] = merged


def clear_common_amount(
    payload: dict[str, Any],
    review: dict[str, Any],
) -> None:
    review.setdefault("임시금액_만원", payload.get("max_amount_numeric_manwon"))
    review.setdefault("근거문장", payload.get("max_amount_evidence"))
    review.setdefault("ROI직접차감가능", False)
    review.setdefault("검토필요", True)
    review.setdefault(
        "검토사유",
        "현금성 최대지원금으로 확정할 수 없어 공통 금액 컬럼에서 제외",
    )
    merge_temp_extraction(payload, review)
    payload.update(
        {
            "max_amount_actual": None,
            "max_amount_status": "확인 필요",
            "max_amount_type": "non_cash",
            "max_amount_numeric_manwon": None,
            "max_amount_evidence": None,
            "max_amount_note": review["검토사유"],
        }
    )


def source_search_text(payload: dict[str, Any]) -> str:
    return " ".join(
        core.clean_text(payload.get(key), 30000)
        for key in ["title", "summary", "raw_text", "eligibility_text"]
        if payload.get(key)
    )


def add_deadline_review(payload: dict[str, Any]) -> None:
    if payload.get("deadline"):
        return
    note = core.clean_text(payload.get("deadline_display"))
    if not note or note == "미정":
        note = "공고문 참조"
    merge_temp_extraction(payload, {"deadline_note": note})


def normalize_smart_factory_to_policy_validation(
    payload: dict[str, Any],
) -> dict[str, Any]:
    text = source_search_text(payload)
    payload["policy_category"] = "스마트공장"
    subcategories = [
        (["공정개선", "공정 개선"], "공정개선"),
        (["자동화", "로봇"], "자동화·로봇"),
        (["제조데이터", "데이터 활용"], "제조데이터"),
        (["스마트공장", "스마트제조"], "스마트공장 구축"),
    ]
    payload["policy_subcategory"] = next(
        (
            label
            for keywords, label in subcategories
            if any(keyword in text for keyword in keywords)
        ),
        "보류",
    )
    if payload["policy_subcategory"] == "보류":
        merge_temp_extraction(
            payload,
            {
                "분류검토필요": True,
                "분류검토사유": "스마트공장 세부분류의 명확한 원문 근거를 찾지 못함",
            },
        )
    add_deadline_review(payload)
    return payload


def normalize_energy_agency_to_policy_validation(
    payload: dict[str, Any],
    detail_content: dict[str, Any] | str,
) -> dict[str, Any]:
    text = source_search_text(payload)
    payload["policy_category"] = "에너지효율"
    payload["policy_subcategory"] = next(
        (
            label
            for keywords, label in [
                (["에너지진단", "진단 지원"], "에너지진단"),
                (["ESCO"], "ESCO"),
                (["FEMS", "EMS"], "에너지관리시스템"),
                (["고효율", "설비교체", "설비 교체"], "고효율설비"),
                (["융자", "이차보전"], "에너지시설자금"),
            ]
            if any(keyword in text for keyword in keywords)
        ),
        "보류",
    )

    temp = build_energy_temp_extraction(payload, detail_content)
    merge_temp_extraction(payload, temp)
    if temp.get("ROI직접차감가능") is not True:
        clear_common_amount(payload, temp)

    posted_at = core.clean_text(payload.get("posted_at"))
    deadline = core.clean_text(payload.get("deadline"))
    if posted_at and deadline:
        try:
            posted_year = datetime.strptime(posted_at, "%Y-%m-%d").year
            deadline_year = datetime.strptime(deadline, "%Y-%m-%d").year
            if posted_year < date.today().year and deadline_year == date.today().year:
                payload.update(
                    {
                        "deadline": None,
                        "deadline_start_date": None,
                        "deadline_display": "공고문 참조",
                        "deadline_status": "확인 필요",
                    }
                )
                merge_temp_extraction(
                    payload,
                    {
                        "deadline_note": "공고문 참조",
                        "deadline_review_reason": (
                            "과거 게시물의 월·일을 현재 연도로 해석한 것으로 보여 날짜 제거"
                        ),
                    },
                )
        except ValueError:
            pass
    add_deadline_review(payload)
    return payload


def normalize_kosme_to_policy_validation(
    payload: dict[str, Any],
) -> dict[str, Any]:
    text = source_search_text(payload)
    loan_keywords = ["정책자금", "융자", "대출", "이차보전", "운전자금", "시설자금"]
    if any(keyword in text for keyword in loan_keywords):
        payload["policy_category"] = "정책자금"
        payload["policy_subcategory"] = next(
            (
                label
                for keyword, label in [
                    ("시설자금", "시설자금"),
                    ("운전자금", "운전자금"),
                    ("융자", "융자"),
                    ("정책자금", "정책자금"),
                ]
                if keyword in text
            ),
            "정책자금",
        )
        clear_common_amount(
            payload,
            {
                "임시지원유형": "정책자금",
                "임시금액유형": "융자·정책자금 한도",
                "ROI직접차감가능": False,
                "검토필요": True,
                "검토사유": "중진공 정책자금 한도는 현금성 보조금이 아님",
            },
        )
    elif any(keyword in text for keyword in ["기술개발", "시제품", "실증", "제품화"]):
        payload["policy_category"] = "기술개발"
        payload["policy_subcategory"] = "기술개발·제품화"
    elif any(keyword in text for keyword in ["제조인력", "생산인력", "인력양성"]):
        payload["policy_category"] = "인력지원"
        payload["policy_subcategory"] = "제조 전문인력"
    else:
        payload["policy_category"] = "보류"
        payload["policy_subcategory"] = "보류"
        merge_temp_extraction(
            payload,
            {
                "분류검토필요": True,
                "분류검토사유": "중진공 원문에서 공통 정책분류 근거를 확정하지 못함",
            },
        )
    add_deadline_review(payload)
    return payload


def normalize_techpark_to_policy_validation(
    payload: dict[str, Any],
) -> dict[str, Any]:
    # Regional TP detail pages often contain a global navigation menu with
    # unrelated manufacturing keywords. Prefer announcement-owned evidence.
    text = " ".join(
        core.clean_text(payload.get(key), 30000)
        for key in ["title", "attachment_text", "eligibility_text"]
        if payload.get(key)
    )
    classification = next(
        (
            (category, subcategory)
            for keywords, category, subcategory in [
                (["스마트공장", "스마트제조", "공정개선"], "스마트공장", "공정개선·스마트제조"),
                (["시제품", "제품고도화", "사업화"], "사업화", "시제품·제품고도화"),
                (["시험", "인증", "성능평가", "신뢰성"], "시험·인증", "시험·성능평가"),
                (["공동장비", "장비활용", "장비 활용"], "장비활용", "공동장비·시설 이용"),
                (["기술개발", "R&D", "실증"], "기술개발", "기술개발·실증"),
            ]
            if any(keyword in text for keyword in keywords)
        ),
        ("보류", "보류"),
    )
    payload["policy_category"], payload["policy_subcategory"] = classification
    if classification[0] == "보류":
        merge_temp_extraction(
            payload,
            {
                "분류검토필요": True,
                "분류검토사유": "테크노파크 공고의 지원유형을 원문만으로 확정하지 못함",
            },
        )

    non_cash = core.detect_non_cash_amount(
        text,
        core.clean_text(payload.get("max_amount_type")),
    )
    if non_cash:
        clear_common_amount(payload, non_cash)
    add_deadline_review(payload)
    return payload


def build_common_policy_payload(
    source: str,
    item: dict[str, Any],
    detail_content: dict[str, Any] | str,
    detail_url: str,
    use_llm: bool,
) -> dict[str, Any] | None:
    """Build common fields, then let the source adapter own source semantics."""
    payload = core.build_payload(
        item,
        detail_content,
        use_llm_summary=use_llm,
    )
    if not payload:
        return None

    payload["url"] = detail_url
    if isinstance(detail_content, dict) and detail_content.get("source_api_json"):
        payload["source_api_json"] = detail_content["source_api_json"]
    source_id = core.clean_text(item.get("pblancId"))
    if ":" in source_id:
        source_id = source_id.split(":", 1)[1]

    context = payload.get("_filter_context") or {}
    payload.update(
        {
            "source_name": source.replace("-", "_"),
            "source_id": source_id,
            "collection_status": "collected",
            "industry_codes": context.get("industry_codes") or [],
            "has_capex_keyword": bool(context.get("has_capex_keyword")),
            "has_manufacturing_code": bool(
                context.get("has_manufacturing_code")
            ),
        }
    )
    return payload


def normalize_external_payload(
    source: str,
    item: dict[str, Any],
    detail_content: dict[str, Any] | str,
    detail_url: str,
    use_llm: bool,
) -> dict[str, Any] | None:
    payload = build_common_policy_payload(
        source,
        item,
        detail_content,
        detail_url,
        use_llm,
    )
    if not payload:
        return None

    normalizers = {
        "smart-factory": lambda value: normalize_smart_factory_to_policy_validation(value),
        "energy-agency": lambda value: normalize_energy_agency_to_policy_validation(
            value,
            detail_content,
        ),
        "kosmes": lambda value: normalize_kosme_to_policy_validation(value),
        "technopark": lambda value: normalize_techpark_to_policy_validation(value),
    }
    payload = normalizers.get(source, lambda value: value)(payload)
    if source == "technopark":
        deadline_info = item.get("_technopark_deadline")
        if isinstance(deadline_info, dict) and deadline_info.get("display"):
            display = core.clean_text(deadline_info.get("display"), 500)
            label = core.clean_text(deadline_info.get("label"))
            payload["deadline_display"] = display
            payload["deadline_raw_text"] = display
            payload["deadline_evidence"] = " ".join(
                part for part in [label, display] if part
            )
            merge_temp_extraction(
                payload,
                {
                    "deadline_label": label or None,
                    "deadline_priority": deadline_info.get("priority"),
                    "deadline_detail_host": deadline_info.get("detail_host"),
                },
            )
    payload["_source"] = source
    return payload


def apply_source_selection_policy(
    source: str,
    payload: dict[str, Any],
) -> None:
    base_selected = bool(payload.get("_is_selected"))
    title = core.clean_text(payload.get("title"), 1000)
    if source in {
        "kpass",
        "renewable-energy",
        "tipa-smtech",
        "regional-agency",
    } and any(
        keyword in title
        for keyword in [
            "수행기관 선정",
            "운영기관 선정",
            "위탁운용사",
            "위탁정산기관",
            "컨설턴트 모집",
            "외부심사원",
            "평가위원",
            "심사위원",
            "용역 입찰",
            "입찰 공고",
        ]
    ):
        payload["_is_selected"] = False
        return

    owned_text = " ".join(
        core.clean_text(payload.get(key), 30000)
        for key in [
            "title",
            "detail_text",
            "attachment_text",
            "eligibility_text",
        ]
        if payload.get(key)
    )
    context = payload.get("_filter_context") or {}
    track = core.clean_text(context.get("policy_track"))

    if source == "tipa-smtech":
        payload["_is_selected"] = base_selected and bool(
            track == "manufacturing_rnd"
            and any(
                keyword in title
                for keyword in [
                    "R&D",
                    "기술개발",
                    "연구개발",
                    "사업화",
                    "실증",
                ]
            )
        )
        return

    if source == "renewable-energy":
        payload["_is_selected"] = base_selected and bool(
            any(
                keyword in owned_text
                for keyword in [
                    "공장",
                    "산업단지",
                    "제조",
                    "생산설비",
                    "고효율 설비",
                    "설비 교체",
                    "중소기업",
                ]
            )
            and any(
                keyword in owned_text
                for keyword in [
                    "지원",
                    "융자",
                    "이차보전",
                    "보조",
                    "사업비",
                ]
            )
        )
        return

    if source == "regional-agency":
        payload["_is_selected"] = base_selected and bool(
            any(
                keyword in owned_text
                for keyword in [
                    "제조",
                    "공장",
                    "생산",
                    "공정",
                    "설비",
                    "자동화",
                    "로봇",
                    "부품",
                    "소부장",
                    "뿌리",
                    "시제품",
                    "금형",
                    "가공",
                    "시험",
                    "인증",
                ]
            )
        )


def strict_external_quality_reasons(
    source: str,
    payload: dict[str, Any],
    *,
    as_of: date,
) -> list[str]:
    if source not in STRICT_EXTERNAL_SOURCES:
        return []

    reasons: list[str] = []
    for field, label in {
        "title": "제목 없음",
        "organization": "기관 없음",
        "url": "URL 없음",
        "summary": "요약 없음",
    }.items():
        if not core.clean_text(payload.get(field)):
            reasons.append(label)

    posted_at = promotion.parse_date(payload.get("posted_at"))
    deadline_start = promotion.parse_date(
        payload.get("deadline_start_date")
    )
    deadline = promotion.parse_date(payload.get("deadline"))
    deadline_type = core.clean_text(payload.get("deadline_type"))

    title = core.clean_text(payload.get("title"))
    title_year_match = re.search(r"(20\d{2})", title)
    inferred_year = (
        posted_at.year
        if posted_at
        else (
            int(title_year_match.group(1))
            if title_year_match
            else (deadline_start.year if deadline_start else None)
        )
    )
    if inferred_year is None:
        reasons.append("게시연도 확인 불가")
    elif inferred_year != as_of.year:
        reasons.append(f"현재연도 공고 아님({inferred_year})")

    if posted_at and posted_at.year != as_of.year:
        reasons.append(f"게시일이 현재연도 아님({posted_at.year})")

    if deadline_type in CONDITIONAL_DEADLINE_TYPES:
        pass
    elif deadline is None:
        reasons.append("마감일 확인 불가")
    elif deadline < as_of:
        reasons.append("마감 공고")

    reference_year = (
        posted_at.year
        if posted_at
        else inferred_year
    )
    if (
        deadline is not None
        and reference_year is not None
        and deadline.year > reference_year + 1
    ):
        reasons.append("게시연도 대비 비정상 미래 마감일")

    evidence_text = " ".join(
        core.clean_text(payload.get(key), 30000)
        for key in [
            "deadline_evidence",
            "deadline_raw_text",
            "deadline_display",
            "detail_text",
            "attachment_text",
        ]
        if payload.get(key)
    )
    has_application_label = any(
        label in evidence_text
        for label in APPLICATION_DEADLINE_LABELS
    )
    has_non_application_label = any(
        label in evidence_text
        for label in NON_APPLICATION_DATE_LABELS
    )
    source_api_json = payload.get("source_api_json")
    source_list = (
        source_api_json.get("list")
        if isinstance(source_api_json, dict)
        else {}
    )
    list_period_is_official = bool(
        deadline is not None
        and source in {"kpass", "tipa-smtech"}
        and isinstance(source_list, dict)
        and core.clean_text(source_list.get("period"))
    )
    if (
        deadline_type not in CONDITIONAL_DEADLINE_TYPES
        and deadline is not None
        and not has_application_label
        and not list_period_is_official
    ):
        reasons.append("접수·신청·모집기간 근거 없음")
    if has_non_application_label and not (
        has_application_label or list_period_is_official
    ):
        reasons.append("사업·협약·수행기간을 마감일로 오인 가능")

    return list(dict.fromkeys(reasons))


def repair_strict_source_deadline(
    source: str,
    payload: dict[str, Any],
) -> None:
    if source not in {"renewable-energy", "regional-agency"}:
        return

    reference_year_match = re.search(
        r"(20\d{2})",
        core.clean_text(payload.get("title")),
    )
    reference_year = (
        int(reference_year_match.group(1))
        if reference_year_match
        else date.today().year
    )
    for field in ["detail_text", "attachment_text"]:
        text = core.clean_text(payload.get(field), 50000)
        if not text:
            continue
        window = core.extract_label_window(
            text,
            APPLICATION_DEADLINE_LABELS,
        )
        if not window:
            continue

        compact = re.sub(r"\s+", "", window)
        if (
            any(token in compact for token in ["예산소진", "예산마감"])
            and any(token in compact for token in ["까지", "시"])
        ):
            start_match = re.search(
                r"(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*"
                r"(\d{1,2})",
                window,
            )
            payload.update(
                {
                    "deadline_start_date": (
                        f"{start_match.group(1)}-"
                        f"{int(start_match.group(2)):02d}-"
                        f"{int(start_match.group(3)):02d}"
                        if start_match
                        else None
                    ),
                    "deadline": None,
                    "deadline_type": "budget_exhaustion",
                    "deadline_display": "예산 소진 시",
                    "deadline_status": "조건부",
                    "is_early_close_possible": True,
                    "deadline_raw_text": window,
                    "deadline_evidence": window,
                }
            )
            return

        parsed = core.parse_deadline(
            window,
            reference_year=reference_year,
        )
        if parsed.get("deadline_type") == "unknown":
            continue
        payload.update(parsed)
        return


def fetch_duplicate_reference_rows(
    supabase: Client,
    table_name: str,
    *,
    batch_size: int = 500,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = (
            supabase.table(table_name)
            .select(
                "policy_id,title,organization,region,deadline,posted_at,"
                "source_name,source_id,url"
            )
            .range(offset, offset + batch_size - 1)
            .execute()
            .data
            or []
        )
        rows.extend(page)
        if len(page) < batch_size:
            break
        offset += batch_size
    return rows


def duplicate_rejection_reason(
    payload: dict[str, Any],
    *,
    batch_identity_rows: dict[tuple[str, str], dict[str, Any]],
    existing_external_rows: list[dict[str, Any]],
    bizinfo_rows: list[dict[str, Any]],
) -> str:
    identity = (
        promotion.normalized_identity(payload.get("organization")),
        promotion.normalized_identity(payload.get("title")),
    )
    if all(identity):
        previous = batch_identity_rows.get(identity)
        if previous:
            previous_posted = (
                promotion.parse_date(previous.get("posted_at"))
                or date.min
            )
            current_posted = (
                promotion.parse_date(payload.get("posted_at"))
                or date.min
            )
            if previous_posted >= current_posted:
                return (
                    "동일 제목·기관의 최신 수집 행 존재: "
                    f"{core.clean_text(previous.get('policy_id'))}"
                )

        for existing in existing_external_rows:
            existing_identity = (
                promotion.normalized_identity(
                    existing.get("organization")
                ),
                promotion.normalized_identity(existing.get("title")),
            )
            if existing_identity != identity:
                continue
            if core.clean_text(existing.get("policy_id")) == core.clean_text(
                payload.get("policy_id")
            ):
                continue
            existing_posted = (
                promotion.parse_date(existing.get("posted_at"))
                or date.min
            )
            current_posted = (
                promotion.parse_date(payload.get("posted_at"))
                or date.min
            )
            if existing_posted >= current_posted:
                return (
                    "DB에 동일 제목·기관의 최신 행 존재: "
                    f"{core.clean_text(existing.get('policy_id'))}"
                )

    bizinfo_duplicate = promotion.best_bizinfo_duplicate(
        payload,
        bizinfo_rows,
    )
    if bizinfo_duplicate.get(
        "status"
    ) in promotion.BIZINFO_DUPLICATE_BLOCK_STATUSES:
        return (
            "기업마당 중복 "
            f"({bizinfo_duplicate.get('status')}): "
            f"{core.clean_text(bizinfo_duplicate.get('policy_id'))}"
        )
    return ""


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Collect Smart Factory, Korea Energy Agency, KOSMES, and regional "
            "TechnoPark announcements, then apply upload_final.py normalization "
            "and manufacturing/CAPEX filters."
        )
    )
    parser.add_argument(
        "--source",
        choices=[
            "all",
            "smart-factory",
            "energy-agency",
            "kosmes",
            "technopark",
            "kpass",
            "renewable-energy",
            "tipa-smtech",
            "regional-agency",
        ],
        default="all",
    )
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--page-size", type=int, default=50)
    parser.add_argument("--max-policies", type=int, default=0, help="0 means all")
    parser.add_argument("--min-score", type=int, default=4)
    parser.add_argument(
        "--include-all",
        action="store_true",
        help=(
            "Include rejected rows in dry-run console/CSV review only. "
            "Rejected rows are never upserted or written to SQL output."
        ),
    )
    parser.add_argument("--include-expired", action="store_true")
    parser.add_argument("--dry-run", type=int, choices=[0, 1], default=1)
    parser.add_argument("--sleep", type=float, default=0.4)
    parser.add_argument(
        "--sql-output",
        help=(
            "Write collected rows to a Supabase SQL migration file. "
            "This never writes rows directly to Supabase."
        ),
    )
    parser.add_argument(
        "--csv-output",
        help=(
            "Write collected clean_payload rows to a UTF-8 CSV file. "
            "Available only with --dry-run 1."
        ),
    )
    parser.add_argument("--use-llm", action="store_true")
    parser.add_argument(
        "--llm-model",
        default=DEFAULT_GEMINI_MODEL,
        help="Official Gemini API model. Default: gemini-2.5-flash-lite",
    )
    parser.add_argument(
        "--smart-factory-status",
        choices=["ING", "PLAN", "END", "ALL"],
        default="ING",
        help="ING=접수중, PLAN=접수예정, END=마감, ALL=전체",
    )
    return parser.parse_args()


def iter_smart_factory(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    status = "" if args.smart_factory_status == "ALL" else args.smart_factory_status
    for page in range(1, args.max_pages + 1):
        rows, pagination = fetch_smart_factory_page(session, page, status)
        print(
            f"[smart-factory] page={page} rows={len(rows)} "
            f"total={pagination.get('totalCount', '-')}"
        )
        if not rows:
            break
        for row in rows:
            detail = fetch_smart_factory_detail(
                session,
                pick(row, "pbancId"),
                pick(row, "pbancSn"),
            )
            item, detail_text, detail_url = adapt_smart_factory_item(row, detail)
            attachments = fetch_smart_factory_attachments(
                session,
                core.clean_text(detail.get("atchFileId")),
            )
            detail_content = {
                "detail_text": detail_text,
                "attachment_text": attachments.get("attachment_text") or "",
                "attachment_files": attachments.get("attachment_files") or [],
                "combined_text": "\n\n".join(
                    part
                    for part in [
                        detail_text,
                        attachments.get("attachment_text") or "",
                    ]
                    if part
                ),
                "error_message": attachments.get("error_message") or "",
                "source_api_json": {
                    "list": row,
                    "detail": detail,
                    "attachments": attachments.get("source_api_json") or {},
                },
            }
            yield "smart-factory", item, detail_content, detail_url


def iter_energy_agency(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    seen_board_numbers: set[str] = set()
    for keyword in ENERGY_AGENCY_KEYWORDS:
        for page in range(1, args.max_pages + 1):
            rows = fetch_energy_agency_page(session, page, keyword)
            print(
                f"[energy-agency] keyword={keyword} page={page} rows={len(rows)}"
            )
            if not rows:
                break
            for row in rows:
                board_no = core.clean_text(row.get("board_no"))
                if not board_no or board_no in seen_board_numbers:
                    continue
                seen_board_numbers.add(board_no)
                detail = fetch_energy_agency_detail(session, board_no)
                combined_title_text = (
                    f"{row.get('title', '')} {detail.get('detail_text', '')}"
                )
                if any(
                    keyword in combined_title_text
                    for keyword in ENERGY_AGENCY_EXCLUDE_KEYWORDS
                ):
                    continue
                item, detail_content, detail_url = adapt_energy_agency_item(
                    row,
                    detail,
                )
                yield "energy-agency", item, detail_content, detail_url


def iter_kosmes(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    seen_sequence_numbers: set[str] = set()
    for keyword in KOSMES_KEYWORDS:
        for page in range(1, args.max_pages + 1):
            rows, page_info = fetch_kosmes_page(session, page, keyword)
            print(
                f"[kosmes] keyword={keyword} page={page} rows={len(rows)} "
                f"total={page_info.get('totalCount') or page_info.get('totalCnt') or '-'}"
            )
            if not rows:
                break
            for row in rows:
                seq_no = core.clean_text(row.get("SLNO"))
                if not seq_no or seq_no in seen_sequence_numbers:
                    continue
                seen_sequence_numbers.add(seq_no)
                title = core.clean_text(row.get("TITL_NM"))
                if any(keyword in title for keyword in KOSMES_EXCLUDE_KEYWORDS):
                    continue
                detail = fetch_kosmes_detail(session, seq_no, row)
                attachments = download_kosmes_attachments(session, detail)
                detail["attachment_text"] = (
                    attachments.get("attachment_text") or ""
                )
                detail["attachment_files"] = (
                    attachments.get("attachment_files") or []
                )
                detail["error_message"] = " / ".join(
                    filter(
                        None,
                        [
                            detail.get("error_message") or "",
                            attachments.get("error_message") or "",
                        ],
                    )
                )
                item, detail_content, detail_url = adapt_kosmes_item(
                    row,
                    detail,
                )
                yield "kosmes", item, detail_content, detail_url


def iter_technopark(
    session: requests.Session,
    args: argparse.Namespace,
) -> Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]:
    seen_links: set[str] = set()
    for page in range(1, args.max_pages + 1):
        rows = fetch_technopark_page(session, page)
        print(f"[technopark] page={page} rows={len(rows)}")
        if not rows:
            break
        for row in rows:
            source_id = core.clean_text(row.get("link_id"))
            if not source_id or source_id in seen_links:
                continue
            seen_links.add(source_id)
            detail = fetch_technopark_detail(session, row)
            item, detail_content, detail_url = adapt_technopark_item(
                row,
                detail,
            )
            yield "technopark", item, detail_content, detail_url


def main() -> None:
    load_environment()
    args = resolve_args()
    args.target_table = validate_table_name(args.target_table)
    dry_run = bool(args.dry_run)
    if args.include_all and not dry_run:
        raise ValueError("--include-all은 --dry-run 1에서만 사용할 수 있습니다.")
    if args.sql_output and not dry_run:
        raise ValueError("--sql-output은 --dry-run 1에서만 사용할 수 있습니다.")
    if args.csv_output and not dry_run:
        raise ValueError("--csv-output은 --dry-run 1에서만 사용할 수 있습니다.")
    core.llm = create_gemini_llm(args.llm_model) if args.use_llm else None
    if args.use_llm and core.llm is None:
        print(
            "[WARN] GEMINI_API_KEY 또는 GOOGLE_API_KEY가 없어 "
            "LLM을 비활성화하고 규칙 기반 처리로 계속합니다."
        )

    supabase: Client | None = None
    if not dry_run:
        supabase = create_client(
            core.SUPABASE_URL,
            core.SUPABASE_SERVICE_ROLE_KEY,
        )
    reference_client = supabase
    strict_source_requested = (
        args.source == "all"
        or args.source in STRICT_EXTERNAL_SOURCES
    )
    if (
        strict_source_requested
        and reference_client is None
        and core.SUPABASE_URL
        and core.SUPABASE_SERVICE_ROLE_KEY
    ):
        reference_client = create_client(
            core.SUPABASE_URL,
            core.SUPABASE_SERVICE_ROLE_KEY,
        )

    existing_external_rows: list[dict[str, Any]] = []
    bizinfo_rows: list[dict[str, Any]] = []
    if strict_source_requested:
        if reference_client is None:
            raise RuntimeError(
                "신규 외부 소스 중복 검사를 위해 Supabase 연결 정보가 필요합니다."
            )
        try:
            existing_external_rows = fetch_duplicate_reference_rows(
                reference_client,
                args.target_table,
            )
            bizinfo_rows = promotion.fetch_bizinfo_rows(reference_client)
        except Exception:
            if not dry_run:
                raise
            print(
                "[WARN] dry-run 중 DB 중복 기준행을 불러오지 못했습니다. "
                "날짜·내용 필터는 적용하지만 DB 중복 검사는 생략합니다."
            )
            existing_external_rows = []
            bizinfo_rows = []

    print(f"source={args.source}")
    print(f"target_table={args.target_table}")
    print(f"dry_run={dry_run}")
    print(f"active_only={not args.include_expired}")
    print(f"use_llm={bool(core.llm)}")
    print(f"llm_provider={'gemini' if core.llm else 'disabled'}")
    print(f"llm_model={args.llm_model if core.llm else 'disabled'}")

    session = requests.Session()
    collectors: list[
        Iterable[tuple[str, dict[str, Any], dict[str, Any], str]]
    ] = []
    if args.source in {"all", "smart-factory"}:
        collectors.append(iter_smart_factory(session, args))
    if args.source in {"all", "energy-agency"}:
        collectors.append(iter_energy_agency(session, args))
    if args.source in {"all", "kosmes"}:
        collectors.append(iter_kosmes(session, args))
    if args.source in {"all", "technopark"}:
        collectors.append(iter_technopark(session, args))
    if args.source in {"all", "kpass"}:
        collectors.append(iter_kpass(session, args))
    if args.source in {"all", "renewable-energy"}:
        collectors.append(iter_renewable_energy(session, args))
    if args.source in {"all", "tipa-smtech"}:
        collectors.append(iter_tipa_smtech(session, args))
    if args.source in {"all", "regional-agency"}:
        collectors.append(iter_regional_agency(session, args))

    seen_ids: set[str] = set()
    raw_count = 0
    collected_count = 0
    selected_count = 0
    rejected_count = 0
    upserted_count = 0
    failed_count = 0
    storage_rows: list[dict[str, Any]] = []
    preview_rows: list[dict[str, Any]] = []
    batch_identity_rows: dict[
        tuple[str, str],
        dict[str, Any],
    ] = {}

    for collector in collectors:
        try:
            for source, item, detail_content, detail_url in collector:
                raw_count += 1
                policy_id = core.clean_text(item.get("pblancId"))
                if not policy_id or policy_id in seen_ids:
                    continue
                seen_ids.add(policy_id)

                try:
                    payload = normalize_external_payload(
                        source,
                        item,
                        detail_content,
                        detail_url,
                        use_llm=args.use_llm,
                    )
                    if not payload:
                        continue
                    repair_strict_source_deadline(source, payload)
                    core.apply_selection_fields(
                        payload,
                        include_all=False,
                        min_score=args.min_score,
                    )
                    apply_source_selection_policy(source, payload)
                    quality_reasons: list[str] = []
                    if source in STRICT_EXTERNAL_SOURCES:
                        quality_reasons.extend(
                            strict_external_quality_reasons(
                                source,
                                payload,
                                as_of=date.today(),
                            )
                        )
                        duplicate_reason = duplicate_rejection_reason(
                            payload,
                            batch_identity_rows=batch_identity_rows,
                            existing_external_rows=existing_external_rows,
                            bizinfo_rows=bizinfo_rows,
                        )
                        if duplicate_reason:
                            quality_reasons.append(duplicate_reason)
                        if quality_reasons:
                            payload["_is_selected"] = False
                    elif not is_current_or_conditional(
                        payload,
                        args.include_expired,
                        source,
                    ):
                        continue

                    collected_count += 1
                    is_selected = bool(payload.get("_is_selected"))
                    if is_selected and source in STRICT_EXTERNAL_SOURCES:
                        identity = (
                            promotion.normalized_identity(
                                payload.get("organization")
                            ),
                            promotion.normalized_identity(
                                payload.get("title")
                            ),
                        )
                        if all(identity):
                            batch_identity_rows[identity] = payload
                    if is_selected:
                        selected_count += 1
                    else:
                        rejected_count += 1
                    clean_payload = sanitize_collection_payload(
                        core.strip_internal_fields(payload)
                    )
                    print(
                        _console_safe(
                            f"[{collected_count}] {source} | {policy_id} | "
                            f"selected={is_selected} | "
                            f"deadline={clean_payload.get('deadline') or clean_payload.get('deadline_display')} | "
                            f"title={clean_payload.get('title')}"
                            + (
                                f" | rejected={'; '.join(quality_reasons)}"
                                if quality_reasons
                                else ""
                            )
                        )
                    )

                    if dry_run:
                        if is_selected:
                            storage_rows.append(clean_payload)
                        if is_selected or args.include_all:
                            preview_rows.append(clean_payload)
                            print(
                                _console_safe(
                                    json.dumps(
                                        clean_payload,
                                        ensure_ascii=False,
                                        indent=2,
                                    )[:2500]
                                )
                            )
                    else:
                        if is_selected:
                            assert supabase is not None
                            supabase.table(args.target_table).upsert(
                                clean_payload,
                                on_conflict="policy_id",
                            ).execute()
                            upserted_count += 1

                    if args.max_policies and selected_count >= args.max_policies:
                        break
                    time.sleep(args.sleep)
                except Exception as exc:
                    failed_count += 1
                    print(f"[ERROR] {source} {policy_id}: {exc}")

                if args.max_policies and selected_count >= args.max_policies:
                    break
        except Exception as exc:
            failed_count += 1
            print(f"[SOURCE ERROR] {exc}")

        if args.max_policies and selected_count >= args.max_policies:
            break

    if args.sql_output:
        output_path = write_sql_migration(
            args.sql_output,
            storage_rows,
            args.target_table,
        )
        print(f"SQL migration: {output_path}")
    if args.csv_output:
        output_path = write_csv_preview(args.csv_output, preview_rows)
        print(f"CSV preview: {output_path}")

    print("=" * 80)
    print("Done")
    print(f"Raw rows: {raw_count}")
    print(f"Collected rows: {collected_count}")
    print(f"Selected rows: {selected_count}")
    print(f"Rejected rows: {rejected_count}")
    print(f"Upserted rows: {upserted_count}")
    print(f"Failed rows: {failed_count}")


if __name__ == "__main__":
    main()
