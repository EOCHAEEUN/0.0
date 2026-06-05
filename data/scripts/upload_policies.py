import json
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# data/scripts/upload_policies.py 기준
# data/processed 폴더를 바라봄
PROCESSED = Path(__file__).parent.parent / "processed"


def load_policy_files():
    policies = []

    for path in PROCESSED.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))

        # 혹시 industry_codes가 문자열로 저장되어 있으면 리스트로 보정
        if isinstance(data.get("industry_codes"), str):
            try:
                data["industry_codes"] = json.loads(data["industry_codes"])
            except json.JSONDecodeError:
                data["industry_codes"] = [data["industry_codes"]]

        policies.append(data)

    return policies


def upload_policies():
    policies = load_policy_files()

    if not policies:
        print("업로드할 JSON 파일이 없습니다.")
        return

    response = (
        supabase
        .table("policy")
        .upsert(policies, on_conflict="policy_id")
        .execute()
    )

    print(f"{len(policies)}건 업로드 완료")
    print(response)


if __name__ == "__main__":
    upload_policies()