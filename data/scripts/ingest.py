"""Supabase policy 테이블 → ChromaDB 임베딩. 실행: python data/scripts/ingest.py"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent / "backend"))

from app.core.database import get_db
from app.core.vectordb import get_policy_collection

def ingest():
    supabase = get_db()
    collection = get_policy_collection()

    # Supabase에서 policy 데이터 가져오기
    response = supabase.table("policy").select(
        "policy_id, title, organization, max_amount, deadline, url, summary, industry_codes, region, "
        "employee_min, employee_max, revenue_min_manwon, revenue_max_manwon, "
        "company_age_min, company_age_max, eligible_company_types, "
        "eligibility_text, eligibility_extraction_status, eligibility_evidence"
    ).execute()

    policies = response.data
    print(f"총 {len(policies)}개 공고 발견")

    for p in policies:
        # summary 없으면 title 사용
        document = p.get("summary") or p.get("title", "")
        if not document:
            continue

        # industry_codes가 list면 첫번째 값 사용
        industry_codes = p.get("industry_codes", [])
        if isinstance(industry_codes, list):
            industry_code = ",".join(industry_codes) if industry_codes else ""
        else:
            industry_code = str(industry_codes)

        metadata = {}
        all_fields = {
            "title": p.get("title", ""),
            "organization": p.get("organization", ""),
            "max_amount": p.get("max_amount", 0),
            "deadline": str(p.get("deadline", "9999-12-31")),
            "url": p.get("url", ""),
            "industry_code": industry_code,
            "region": p.get("region", ""),
            "employee_min": p.get("employee_min"),
            "employee_max": p.get("employee_max"),
            "revenue_min_manwon": p.get("revenue_min_manwon"),
            "revenue_max_manwon": p.get("revenue_max_manwon"),
            "company_age_min": p.get("company_age_min"),
            "company_age_max": p.get("company_age_max"),
            "eligible_company_types": p.get("eligible_company_types"),
            "eligibility_text": p.get("eligibility_text"),
            "eligibility_extraction_status": p.get("eligibility_extraction_status"),
            "eligibility_evidence": p.get("eligibility_evidence"),
        }
        for k, v in all_fields.items():
            if v is not None and v != [] and v != "":
                metadata[k] = v

        collection.upsert(
            ids=[p["policy_id"]],
            documents=[document],
            metadatas=[metadata]
        )
        print(f"  ✓ {p.get('title', '')}")

    print(f"완료: {collection.count()}개 임베딩")

if __name__ == "__main__":
    ingest()