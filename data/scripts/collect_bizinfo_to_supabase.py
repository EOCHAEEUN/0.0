import os
import re
import time
import requests
from html import unescape
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_openai import ChatOpenAI


# =========================
# 수집 설정
# =========================

PAGE_UNIT = 100
MAX_PAGES = 10  # 100건 x 10페이지 = 최대 1000건
SLEEP_SECONDS = 0.5

# 제조업 관련성 최소 점수
MIN_RELEVANCE_SCORE = 4


# =========================
# 환경변수 / Supabase 연결
# =========================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()
BIZINFO_API_KEY = os.getenv("BIZINFO_API_KEY", "").strip()

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL이 .env에 없습니다.")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.")

if not BIZINFO_API_KEY:
    raise ValueError("BIZINFO_API_KEY가 .env에 없습니다.")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
DATA_LLM_MODEL = os.getenv("DATA_LLM_MODEL", "nvidia/nemotron-3-super-120b-a12b:free").strip()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

llm = ChatOpenAI(
    model=DATA_LLM_MODEL,
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0,
) if OPENROUTER_API_KEY else None


# =========================
# 기준 데이터
# =========================

REGIONS = [
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"
]


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
    "농업", "어업", "문화예술", "공연", "예비창업"
]

# 팩토핏 서비스 핵심 키워드 — "제조", "에너지" 같은 단독 범용어는 제외한다.
# 단순 제조기업/R&D/사업화 공고가 아니라 설비투자·공정개선·효율화 맥락만 통과시킨다.
CAPEX_KEYWORDS = [
    "설비", "제조설비", "생산설비", "노후설비", "설비투자",
    "스마트공장", "스마트제조", "공정개선", "공정자동화",
    "자동화설비", "로봇자동화", "노후", "교체",
    "에너지효율", "에너지절감", "고효율", "CAPEX",
]


# =========================
# 유틸 함수
# =========================

def clean_html(value: str) -> str:
    if not value:
        return ""

    text = re.sub(r"<[^>]+>", " ", str(value))
    text = unescape(text)
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_date(value: str):
    if not value:
        return None

    value = str(value).strip().replace(".", "-")

    for fmt in ["%Y-%m-%d", "%Y%m%d"]:
        try:
            return datetime.strptime(value[:10], fmt).date().isoformat()
        except ValueError:
            pass

    return None


def parse_deadline(period: str):
    """
    예:
    2026-06-02 ~ 2026-06-19 -> deadline=2026-06-19, deadline_note=None
    상시접수 -> deadline=None, deadline_note='상시접수'
    """
    if not period:
        return None, None

    period = str(period).strip()

    if "~" in period:
        _, end_raw = [x.strip() for x in period.split("~", 1)]
        end_date = parse_date(end_raw)

        if end_date:
            return end_date, None

        return None, period

    parsed = parse_date(period)

    if parsed:
        return parsed, None

    return None, period


def extract_region(hashtags: str, title: str = "", summary: str = ""):
    text = " ".join([hashtags or "", title or "", summary or ""])

    for region in REGIONS:
        if region in text:
            return region

    return None


def infer_industry_codes(text: str):
    if not text:
        return []

    codes = set()

    for keyword, mapped_codes in INDUSTRY_CODE_MAP.items():
        if keyword in text:
            codes.update(mapped_codes)

    return sorted(codes)


def split_hashtags(raw: str):
    if not raw:
        return []

    return [
        tag.strip()
        for tag in raw.split(",")
        if tag.strip()
    ]


def has_capex_keyword(title: str, body: str) -> bool:
    text = f"{title} {body}"
    return any(kw in text for kw in CAPEX_KEYWORDS)


def has_manufacturing_industry_code(industry_codes: list[str]) -> bool:
    return any(str(code).startswith("C") for code in industry_codes or [])


def extract_amount_with_llm(text: str) -> int | None:
    if not llm or not text or len(text) < 50:
        return None

    prompt = (
        "다음 정부 지원사업 공고에서 최대 지원 금액을 만원 단위 정수로만 반환해줘. "
        "없으면 null 반환. 설명 금지.\n\n"
        + text[:2000]
    )

    try:
        response = llm.invoke(prompt)
        raw = response.content.strip()

        if not raw or raw.lower() in ("null", "none", "없음"):
            return None

        cleaned = raw.replace(",", "").strip()

        if cleaned.isdigit():
            return int(cleaned)

        match = re.search(r"\d+", cleaned)
        if match:
            return int(match.group())

    except Exception as e:
        print(f"  → LLM 금액 추출 실패: {e}")

    return None


# =========================
# 우리 서비스용 카테고리 분류
# =========================

def classify_service_category(text: str):
    """
    기업마당 원본 분류:
      policy_category = 기술
      policy_subcategory = 기술사업화/이전/지도, 시험/인증 등

    우리 서비스용 분류:
      service_category = 스마트공장, 공정개선, 설비/자동화, R&D/사업화 등
    """

    if not text:
        return "기술지원", None

    # 구체적인 키워드부터 먼저 검사
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


def calculate_relevance_score(row: dict) -> int:
    text = " ".join([
        str(row.get("title") or ""),
        str(row.get("summary") or ""),
        str(row.get("policy_category") or ""),
        str(row.get("policy_subcategory") or ""),
        str(row.get("service_category") or ""),
        str(row.get("service_subcategory") or ""),
        str(row.get("region") or ""),
        " ".join(row.get("industry_codes") or []),
        " ".join(row.get("hashtags") or []),
    ])

    score = 0

    for keyword in MANUFACTURING_KEYWORDS:
        if keyword in text:
            score += 2

    for keyword in EXCLUDE_KEYWORDS:
        if keyword in text:
            score -= 5

    return score


# =========================
# 기업마당 API 정규화
# =========================

def normalize_bizinfo_item(item: dict) -> dict:
    title = item.get("pblancNm") or ""
    organization = item.get("jrsdInsttNm") or item.get("excInsttNm") or "기관 미상"
    summary = clean_html(item.get("bsnsSumryCn") or "")
    hashtags_raw = item.get("hashtags") or item.get("hashTags") or ""
    hashtags = split_hashtags(hashtags_raw)

    deadline, deadline_note = parse_deadline(item.get("reqstBeginEndDe") or "")

    search_text = " ".join([
        title,
        summary,
        hashtags_raw,
        item.get("trgetNm") or "",
        item.get("pldirSportRealmLclasCodeNm") or "",
        item.get("pldirSportRealmMlsfcCodeNm") or "",
    ])

    industry_codes = infer_industry_codes(search_text)
    region = extract_region(hashtags_raw, title, summary)

    service_category, service_subcategory = classify_service_category(search_text)

    raw_text = "\n".join([
        f"공고명: {title}",
        f"공고ID: {item.get('pblancId') or ''}",
        f"지원대상: {item.get('trgetNm') or ''}",
        f"소관기관: {item.get('jrsdInsttNm') or ''}",
        f"수행기관: {item.get('excInsttNm') or ''}",
        f"기업마당 대분류: {item.get('pldirSportRealmLclasCodeNm') or ''}",
        f"기업마당 중분류: {item.get('pldirSportRealmMlsfcCodeNm') or ''}",
        f"서비스 분류: {service_category or ''}",
        f"서비스 세부분류: {service_subcategory or ''}",
        f"신청기간: {item.get('reqstBeginEndDe') or ''}",
        f"신청방법: {clean_html(item.get('reqstMthPapersCn') or '')}",
        f"문의처: {item.get('refrncNm') or ''}",
        f"사업개요: {summary}",
        f"해시태그: {hashtags_raw}",
        f"상세URL: {item.get('pblancUrl') or ''}",
        f"신청URL: {item.get('rceptEngnHmpgUrl') or ''}",
    ])

    row = {
        # 기존 policy 테이블 컬럼
        "policy_id": item.get("pblancId"),
        "title": title,
        "organization": organization,

        # 중요:
        # max_amount / max_amount_note는 여기서 저장하지 않음.
        # 지원금은 enrich_max_amount.py가 상세페이지/첨부파일까지 확인해서 채움.
        # collect에서 넣으면 기존 추출값이 NULL로 덮일 수 있음.

        "deadline": deadline,
        "deadline_note": deadline_note,

        "industry_codes": industry_codes,
        "region": region,
        "url": item.get("pblancUrl") or "",
        "summary": summary,

        # 기업마당 API에는 정형 필드가 없으므로 None
        "max_employee_count": None,
        "min_revenue": None,
        "max_revenue": None,

        # 기업마당 원본 분류
        "policy_category": item.get("pldirSportRealmLclasCodeNm"),
        "policy_subcategory": item.get("pldirSportRealmMlsfcCodeNm"),

        # 우리 서비스용 분류
        "service_category": service_category,
        "service_subcategory": service_subcategory,

        # 추가 보존 컬럼
        "source_name": "bizinfo",
        "source_id": item.get("pblancId"),
        "raw_text": raw_text,
        "raw_json": item,
        "hashtags": hashtags,
    }

    return row


# =========================
# 기업마당 API 호출
# =========================

def fetch_bizinfo(page_index: int = 1, page_unit: int = 100):
    url = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"

    params = {
        "crtfcKey": BIZINFO_API_KEY,
        "dataType": "json",
        "searchCnt": page_unit,
        "pageUnit": page_unit,
        "pageIndex": page_index,

        # 02 = 기술
        # 제조/스마트공장/R&D/공정개선/설비/시험인증은 대부분 기술 대분류에 들어옴
        "searchLclasId": "02",
    }

    response = requests.get(url, params=params, timeout=30)

    print("[기업마당] status:", response.status_code)

    response.raise_for_status()

    data = response.json()

    if "reqErr" in data:
        raise RuntimeError(f"기업마당 API 오류: {data['reqErr']}")

    return data.get("jsonArray", [])


# =========================
# Supabase 저장
# =========================

def upsert_policies(rows: list[dict]):
    if not rows:
        print("저장할 데이터가 없습니다.")
        return

    result = (
        supabase
        .table("policy")
        .upsert(rows, on_conflict="policy_id")
        .execute()
    )

    print(f"Supabase 저장 완료: {len(rows)}건")
    return result


# =========================
# 메인
# =========================

def main():
    total_raw_count = 0
    total_saved_count = 0
    seen_policy_ids = set()

    for page_index in range(1, MAX_PAGES + 1):
        print("\n" + "=" * 80)
        print(f"[수집] 기업마당 {page_index}페이지 / 최대 {MAX_PAGES}페이지")

        try:
            items = fetch_bizinfo(page_index=page_index, page_unit=PAGE_UNIT)
        except Exception as e:
            print(f"  → {page_index}페이지 수집 실패: {e}")
            continue

        print(f"  → 원본 수집: {len(items)}건")
        total_raw_count += len(items)

        if not items:
            print("  → 더 이상 데이터 없음. 수집 종료")
            break

        page_rows = []

        for item in items:
            row = normalize_bizinfo_item(item)

            policy_id = row.get("policy_id")

            if not policy_id:
                continue

            # 같은 실행 중 중복 방지
            if policy_id in seen_policy_ids:
                continue

            seen_policy_ids.add(policy_id)

            # CAPEX 키워드 + 제조업(C계열) 업종코드 기준을 모두 만족한 공고만 저장
            if not has_capex_keyword(row.get("title", ""), row.get("summary", "")):
                continue

            if not has_manufacturing_industry_code(row.get("industry_codes", [])):
                continue

            score = calculate_relevance_score(row)

            # 제조업 관련성이 낮은 공고는 제외
            if score < MIN_RELEVANCE_SCORE:
                continue

            row["relevance_score"] = score
            row["is_selected"] = True
            row["selected_reason"] = "CAPEX 키워드 + 제조업 업종코드 기준 통과"

            # LLM 금액 추출 (실패해도 저장은 계속)
            amount = extract_amount_with_llm(row.get("summary", ""))
            if amount is not None:
                row["max_amount"] = amount
                row["amount_extraction_status"] = "extracted"
                row["max_amount_source"] = "llm_summary"
                print(f"  → LLM 금액 추출: {amount}만원 ({policy_id})")

            page_rows.append(row)

        print(f"  → CAPEX 키워드 + 제조업 필터 통과: {len(page_rows)}건")

        if page_rows:
            upsert_policies(page_rows)
            total_saved_count += len(page_rows)

        time.sleep(SLEEP_SECONDS)

    print("\n" + "=" * 80)
    print("기업마당 수집 작업 완료")
    print(f"총 원본 수집: {total_raw_count}건")
    print(f"총 저장 대상: {total_saved_count}건")
    print(f"수집 페이지: 최대 {MAX_PAGES}페이지")
    print(f"페이지당 요청 수: {PAGE_UNIT}건")


if __name__ == "__main__":
    main()
