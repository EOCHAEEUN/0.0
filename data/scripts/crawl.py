"""공고 수동 정제 헬퍼 — 공고를 JSON으로 변환해 processed/ 에 저장"""
import json
from pathlib import Path
from datetime import date

PROCESSED = Path(__file__).parent.parent / "processed"

def save_policy(policy: dict) -> None:
    PROCESSED.mkdir(exist_ok=True)
    out = PROCESSED / f"{policy['policy_id']}.json"
    out.write_text(json.dumps(policy, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"저장: {out.name}")

# 샘플 템플릿
SAMPLE = {
    "policy_id": "kiat-2026-001",
    "title": "KIAT 스마트 제조혁신 공정개선 사업",
    "organization": "KIAT",
    "max_amount": 8000,
    "deadline": date(2026, 7, 15),
    "industry_codes": ["C24", "C25", "C28"],
    "region": None,
    "url": "https://www.kiat.or.kr",
    "summary": "중소 제조기업 스마트 공정개선 설비투자 지원. 금속가공업 우대. 최대 8,000만원.",
}

if __name__ == "__main__":
    save_policy(SAMPLE)
