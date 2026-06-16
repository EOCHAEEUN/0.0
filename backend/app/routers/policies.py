from datetime import datetime
from typing import Any
import asyncio

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.models.company import CompanyContext
from app.agents.policy import policy_matching_node
from app.state import FactofitState


router = APIRouter()


def normalize_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]

    if isinstance(value, str):
        value = value.strip()

        if not value:
            return []

        if value.startswith("{") and value.endswith("}"):
            value = value[1:-1]

        return [
            item.strip().strip('"').strip("'")
            for item in value.split(",")
            if item.strip()
        ]

    return []


def get_first_row(result: Any):
    data = getattr(result, "data", None)

    if isinstance(data, list) and data:
        return data[0]

    if isinstance(data, dict):
        return data

    return None


def get_policy_id(policy: dict) -> str:
    metadata = policy.get("metadata", {}) or {}

    return (
        policy.get("policy_id")
        or policy.get("id")
        or metadata.get("policy_id")
        or metadata.get("id")
        or ""
    )


def get_policy_title(policy: dict) -> str:
    metadata = policy.get("metadata", {}) or {}

    return (
        policy.get("title")
        or metadata.get("title")
        or policy.get("name")
        or metadata.get("name")
        or ""
    )


def get_match_score(policy: dict) -> float:
    if policy.get("match_score") is not None:
        try:
            return round(float(policy.get("match_score")), 3)
        except Exception:
            return 0.0

    try:
        return round(1 - float(policy.get("distance", 1)), 3)
    except Exception:
        return 0.0


def saved_policy_to_response(row: dict) -> dict:
    return {
        "id": row.get("policy_id"),
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "match_score": row.get("match_score"),
        "eligible": row.get("eligible"),
        "reason": row.get("reason"),
        "llm_score": row.get("llm_score"),
        "created_at": row.get("created_at"),
        "metadata": {
            "title": row.get("title"),
            "policy_id": row.get("policy_id"),
        },
    }


async def run_policy_node(state: FactofitState):
    return await asyncio.wait_for(
        asyncio.to_thread(policy_matching_node, state),
        timeout=90,
    )


@router.get("/policies")
async def get_policies(
    company_id: str = Query(...),
    limit: int = Query(default=10),
    refresh: bool = Query(default=False),
):
    db = get_db()

    # 1. 기존 matched_policy 결과가 있으면 먼저 반환
    # 지원사업 페이지를 다시 열 때마다 LLM/vector search를 매번 돌리지 않기 위함
    if not refresh:
        try:
            saved_result = (
                db.table("matched_policy")
                .select("*")
                .eq("company_id", company_id)
                .order("match_score", desc=True)
                .limit(limit)
                .execute()
            )

            saved_rows = getattr(saved_result, "data", []) or []

            if saved_rows:
                return {
                    "success": True,
                    "data": {
                        "policies": [
                            saved_policy_to_response(row)
                            for row in saved_rows
                        ],
                        "total": len(saved_rows),
                        "source": "matched_policy_cache",
                    },
                }
        except Exception as e:
            print(f"기존 matched_policy 조회 실패: {e}")

    # 2. 기업 정보 조회
    try:
        company_result = (
            db.table("company")
            .select("*")
            .eq("company_id", company_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "기업 정보를 조회하지 못했습니다.",
                "error": str(e),
            },
        )

    company_row = get_first_row(company_result)

    if not company_row:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "기업 정보를 찾을 수 없습니다.",
            },
        )

    # 3. CompanyContext 생성
    company = CompanyContext(
        company_id=company_row.get("company_id"),
        company_name=company_row.get("company_name") or "",
        business_registration_no=company_row.get("business_registration_no"),
        industry_name=company_row.get("industry_name"),
        industry_code=normalize_list(company_row.get("industry_code")),
        region=company_row.get("region") or "",
        company_type=company_row.get("company_type"),
        primary_purpose=normalize_list(company_row.get("primary_purpose")),
        employee_count=company_row.get("employee_count"),
        annual_revenue=company_row.get("annual_revenue"),
        revenue_2y_ago_manwon=company_row.get("revenue_2y_ago_manwon"),
        revenue_3y_ago_manwon=company_row.get("revenue_3y_ago_manwon"),
        total_assets_manwon=company_row.get("total_assets_manwon"),
        is_disclosure_group_member=company_row.get("is_disclosure_group_member"),
        established_year=company_row.get("established_year"),
        workplace_type=company_row.get("workplace_type"),
        created_at=company_row.get("created_at"),
        updated_at=company_row.get("updated_at"),
    )

    # 4. 기존 policy_matching_node 그대로 호출
    # 노드 구조 변경 없음
    state: FactofitState = {
        "user_query": "제조설비 지원사업",
        "intent": "policy",
        "is_safe": True,
        "company_info": company,
        "equipment": None,
        "matched_policies": [],
        "roi_result": None,
        "draft_result": None,
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None,
    }

    try:
        result_state = await run_policy_node(state)

    except asyncio.TimeoutError:
        # 504로 터뜨리지 않고 프론트가 정상 처리할 수 있게 빈 결과 반환
        return {
            "success": True,
            "data": {
                "policies": [],
                "total": 0,
                "saved_count": 0,
                "source": "policy_timeout_fallback",
                "message": "지원사업 추천 처리 시간이 오래 걸려 임시로 빈 결과를 반환했습니다.",
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "지원사업 추천 노드 실행 실패",
                "error": str(e),
            },
        )

    matched = result_state.get("matched_policies", []) or []
    limited = matched[:limit]

    # 5. 기존 matched_policy 삭제 후 새 결과 저장
    try:
        (
            db.table("matched_policy")
            .delete()
            .eq("company_id", company_id)
            .execute()
        )
    except Exception as e:
        print(f"기존 matched_policy 삭제 실패: {e}")

    saved_count = 0

    for policy in limited:
        if not isinstance(policy, dict):
            continue

        try:
            (
                db.table("matched_policy")
                .insert(
                    {
                        "company_id": company_id,
                        "policy_id": get_policy_id(policy),
                        "title": get_policy_title(policy),
                        "match_score": get_match_score(policy),
                        "eligible": policy.get("eligible", True),
                        "reason": policy.get("reason", "RAG 유사도 기반 매칭"),
                        "llm_score": policy.get("llm_score", ""),
                        "created_at": datetime.now().isoformat(),
                    }
                )
                .execute()
            )
            saved_count += 1
        except Exception as e:
            print(f"matched_policy 저장 실패: {e}")

    return {
        "success": True,
        "data": {
            "policies": limited,
            "total": len(matched),
            "saved_count": saved_count,
            "source": "policy_matching_node",
        },
    }