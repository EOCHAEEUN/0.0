import os
import re
import time
import zlib
import struct
import zipfile
import tempfile
from pathlib import Path
from html import unescape
import xml.etree.ElementTree as ET

import fitz  # pymupdf
import olefile
import requests
from dotenv import load_dotenv
from supabase import create_client, Client


# =========================================================
# 환경변수 / Supabase 연결
# =========================================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL이 .env에 없습니다.")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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

LIMIT = 100
SLEEP_SECONDS = 0.5


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


# =========================================================
# 지원금 추출
# =========================================================

def split_sentences(text: str):
    if not text:
        return []

    text = clean_text(text)

    parts = re.split(
        r"(?<=[.!?。])|\n|ㆍ|※|○|●|□|■|◇|◆|▶|▷| - | – |·",
        text
    )

    return [p.strip() for p in parts if p and len(p.strip()) >= 4]


def find_evidence_sentence(original_text: str, amount: int | None = None) -> str:
    if not original_text:
        return ""

    sentences = split_sentences(original_text)

    money_keywords = [
        "만원", "백만원", "천만원", "억원", "원",
        "지원한도", "지원 한도", "한도", "최대", "최고",
        "기업당", "업체당", "과제당", "1개사", "개사당",
        "이내", "내외", "지원금", "사업비", "국비", "보조금"
    ]

    preferred_keywords = [
        "지원한도", "지원 한도", "한도", "최대", "기업당",
        "업체당", "과제당", "개사당", "지원금"
    ]

    # 1차: 지원한도 맥락 강한 문장
    for sentence in sentences:
        if any(k in sentence for k in preferred_keywords) and any(k in sentence for k in money_keywords):
            return sentence[:700]

    # 2차: 금액 단위 포함 문장
    for sentence in sentences:
        if any(k in sentence for k in money_keywords):
            return sentence[:700]

    return clean_text(original_text)[:700]


def extract_max_amount_with_evidence(text: str):
    """
    반환:
      (만원 단위 금액, 근거 문장)
      또는 (None, None)

    예:
      25백만원 -> 2500
      2,000만원 -> 2000
      1억원 -> 10000
      2천만원 -> 2000
      20000000원 -> 2000
    """

    if not text:
        return None, None

    original_text = clean_text(text)
    compact_text = normalize_for_match(original_text)

    candidates = []

    patterns = [
        # 국비 1.5억원 같은 소수 억원
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+(?:\.\d+)?)억원(?:이내|내외|지원|한도|까지)?", 10000),

        # 2천만원
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+)천만원(?:이내|내외|지원|한도|까지)?", 1000),

        # 25백만원
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+)백만원(?:이내|내외|지원|한도|까지)?", 100),

        # 2000만원
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d+)만원(?:이내|내외|지원|한도|까지)?", 1),

        # 20000000원
        (r"(?:기업당|업체당|과제당|1개사당|개사당|최대|최고|지원한도|한도|국비|정부지원금)?(\d{7,})원(?:이내|내외|지원|한도|까지)?", 1 / 10000),
    ]

    bad_context_keywords = [
        "자부담", "민간부담", "부가세", "VAT", "참가비", "수수료",
        "보증금", "예치금", "총사업비", "총 사업비"
    ]

    good_context_keywords = [
        "지원", "한도", "최대", "최고", "기업당", "업체당",
        "과제당", "개사당", "이내", "내외", "국비", "정부지원금",
        "보조금", "지원금"
    ]

    for pattern, multiplier in patterns:
        for match in re.finditer(pattern, compact_text):
            raw_value = match.group(1)

            try:
                value = float(raw_value)
            except Exception:
                continue

            amount = int(value * multiplier)

            # 10만원 미만, 10억원 초과는 우선 제외
            if amount < 10 or amount > 100000:
                continue

            start = max(0, match.start() - 80)
            end = min(len(compact_text), match.end() + 80)
            nearby = compact_text[start:end]
            matched_text = match.group(0)

            score = 0

            for keyword in good_context_keywords:
                if keyword in matched_text or keyword in nearby:
                    score += 2

            for keyword in bad_context_keywords:
                if keyword in nearby:
                    score -= 3

            # 금액이 너무 작으면 낮은 우선순위
            if amount < 100:
                score -= 2

            candidates.append({
                "amount": amount,
                "score": score,
                "matched_text": matched_text,
            })

    if not candidates:
        return None, None

    # 맥락 점수 우선, 다음 큰 금액 우선
    candidates.sort(key=lambda x: (x["score"], x["amount"]), reverse=True)
    best = candidates[0]

    evidence = find_evidence_sentence(original_text, best["amount"])

    return best["amount"], evidence


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
        return clean_text("\n".join(text_parts))

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
        size = (header >> 20) & 0xFFF

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


def extract_hwp_text(file_bytes: bytes):
    text_parts = []

    with tempfile.NamedTemporaryFile(delete=False, suffix=".hwp") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        if not olefile.isOleFile(tmp_path):
            print("  → HWP 파일이 OLE 형식이 아님")
            return ""

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

        ole.close()

        return clean_text("\n".join(text_parts))

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

                    for elem in root.iter():
                        if elem.text and elem.text.strip():
                            text_parts.append(elem.text.strip())

                except Exception:
                    continue

        return clean_text("\n".join(text_parts))

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
            return clean_text("\n".join(text_parts)), "attachment_zip_extracted"

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
        url = raw_json.get(url_key)
        name = raw_json.get(name_key)

        if url:
            candidates.append({
                "url": url,
                "name": name or "",
                "url_key": url_key,
            })

    # 공고문 PDF가 먼저 오도록 정렬
    candidates.sort(
        key=lambda x: (
            0 if str(x.get("name", "")).lower().endswith(".pdf") else 1,
            0 if "공고" in str(x.get("name", "")) else 1,
            x.get("name", "")
        )
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
# Supabase 조회 / 업데이트
# =========================================================

def fetch_policies_without_amount(limit: int = LIMIT):
    result = (
        supabase
        .table("policy")
        .select("policy_id,title,url,summary,raw_json,max_amount,amount_extraction_status")
        .like("policy_id", "PBLN_%")
        .is_("max_amount", "null")
        .or_("amount_extraction_status.is.null,amount_extraction_status.neq.extracted")
        .limit(limit)
        .execute()
    )

    return result.data or []


def update_amount_extracted(policy_id: str, amount: int, source: str, evidence: str):
    supabase.table("policy").update({
        "max_amount": amount,
        "max_amount_source": source,
        "max_amount_evidence": evidence,
        "amount_extraction_status": "extracted",
        "max_amount_note": None,
    }).eq("policy_id", policy_id).execute()


def update_amount_status(policy_id: str, status: str):
    supabase.table("policy").update({
        "amount_extraction_status": status,
    }).eq("policy_id", policy_id).execute()


# =========================================================
# 한 건 처리
# =========================================================

def try_extract_and_update(policy_id: str, text: str, source: str):
    amount, evidence = extract_max_amount_with_evidence(text)

    if amount:
        update_amount_extracted(
            policy_id=policy_id,
            amount=amount,
            source=source,
            evidence=evidence or ""
        )
        print(f"  → {source}에서 추출 성공: {amount}만원")
        print(f"  → 근거: {evidence}")
        return True

    return False


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

    # 1차: summary
    if try_extract_and_update(policy_id, summary, "summary"):
        return True

    # 2차: 상세페이지 HTML
    try:
        detail_text = fetch_detail_page_text(url)
        if try_extract_and_update(policy_id, detail_text, "detail_page"):
            return True
    except Exception as e:
        print(f"  → 상세페이지 요청 실패: {e}")

    # 3차: 첨부파일
    attachment_candidates = get_attachment_candidates(raw_json)

    if not attachment_candidates:
        print("  → 첨부파일 URL 없음")
        update_amount_status(policy_id, "no_attachment")
        return False

    statuses = []

    for attachment in attachment_candidates:
        attach_url = attachment["url"]
        attach_name = attachment["name"]

        print(f"  → 첨부파일 확인: {attach_name}")

        try:
            file_bytes, content_type = download_attachment(attach_url)

            attach_text, source_type = extract_text_from_attachment(
                file_bytes=file_bytes,
                content_type=content_type,
                filename=attach_name
            )

            statuses.append(source_type)

            if not attach_text:
                print(f"  → 첨부파일 텍스트 추출 실패: {source_type}")
                continue

            if try_extract_and_update(policy_id, attach_text, source_type):
                return True

        except Exception as e:
            print(f"  → 첨부파일 처리 실패: {e}")
            statuses.append("attachment_error")
            continue

    # 최종 상태 결정
    if "attachment_hwp_failed" in statuses or "attachment_zip_hwp_failed" in statuses:
        final_status = "attachment_hwp_failed"
    elif "attachment_zip_checked_not_found" in statuses:
        final_status = "attachment_zip_checked_not_found"
    elif "attachment_pdf" in statuses or "attachment_hwp" in statuses or "attachment_hwpx" in statuses:
        final_status = "attachment_checked_not_found"
    elif "attachment_error" in statuses:
        final_status = "attachment_error"
    else:
        final_status = "not_found"

    update_amount_status(policy_id, final_status)
    print(f"  → 금액 추출 실패: {final_status}")
    return False


# =========================================================
# 메인
# =========================================================

def main():
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


if __name__ == "__main__":
    main()