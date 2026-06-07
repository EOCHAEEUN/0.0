"""공고 JSON → ChromaDB 임베딩. 실행: python data/scripts/ingest.py"""
import json, sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent / "backend"))

import chromadb

PROCESSED = Path(__file__).parent.parent / "processed"
CHROMA = Path(__file__).parent.parent.parent / "backend" / "chroma_db"

def ingest():
    client = chromadb.PersistentClient(path=str(CHROMA))
    col = client.get_or_create_collection("policy_announcements")
    files = list(PROCESSED.glob("*.json"))
    print(f"총 {len(files)}개 공고 발견")
    for f in files:
        p = json.loads(f.read_text(encoding="utf-8"))
        col.add(
            ids=[p["policy_id"]],
            documents=[p["summary"]],
            metadatas=[{
                "title": p["title"],
                "organization": p["organization"],
                "max_amount": p.get("max_amount"),
                "deadline": str(p.get("deadline")),
                "url": p["url"],
                "policy_category": p.get("policy_category", ""),
                "service_category": p.get("service_category", ""),
                "industry_codes": ",".join(p.get("industry_codes", [])),
                "region": p.get("region", "")
            }],
        )
        print(f"  ✓ {p['title']}")
    print(f"완료: {col.count()}개 임베딩")

if __name__ == "__main__":
    ingest()
