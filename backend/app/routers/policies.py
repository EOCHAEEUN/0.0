from fastapi import APIRouter, Query

router = APIRouter()

@router.get("/policies")
async def get_policies(limit: int = Query(default=10)):
    return {
        "success": True,
        "data": {
            "policies": [
                {
                    "policy_id": "sample-policy-001",
                    "title": "스마트 제조혁신 지원사업",
                    "organization": "중소벤처기업부",
                    "max_amount": 8000,
                    "deadline": "2026-07-15",
                    "dday": 36,
                    "match_score": 0.94,
                    "fit_label": "높음",
                    "target_industry": ["C24", "C25"],
                    "url": "https://example.com"
                }
            ],
            "total": 1
        }
    }
