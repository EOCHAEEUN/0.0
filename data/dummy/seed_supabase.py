"""Supabase 초기 데이터 시딩. 실행: python data/scripts/seed_supabase.py"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent / "backend"))

from app.core.database import get_db

def seed():
    db = get_db()
    db.table("companies").upsert({
        "id": "test-company-001",
        "name": "안산금속(주)",
        "industry_code": "C24",
        "employee_count": 45,
        "region": "경기도 안산시",
        "energy_cost_annual": 4800,
    }).execute()
    print("✓ 테스트 기업 데이터 시딩 완료")

if __name__ == "__main__":
    seed()
