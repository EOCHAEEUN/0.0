from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from app.services.safety_preview import create_safety_preview, get_safety_preview


router = APIRouter()


def _normalize_policy_id(value: str) -> str:
    policy_id = str(value or "").strip()
    if not policy_id:
        return ""
    normalized = re.sub(r":[AB](?:\d+)?$", "", policy_id, flags=re.IGNORECASE)
    normalized = re.sub(r":\d+$", "", normalized)
    normalized = re.sub(r":[AB]$", "", normalized, flags=re.IGNORECASE)
    return normalized


@router.get("/analysis/{analysis_id}/policies/{policy_id}/safety-preview")
async def read_safety_preview(
    analysis_id: str,
    policy_id: str,
    equipment_id: Optional[str] = Query(default=None),
    investment_plan_id: Optional[str] = Query(default=None),
):
    normalized_policy_id = _normalize_policy_id(policy_id) or policy_id
    preview = get_safety_preview(
        analysis_id=analysis_id,
        policy_id=normalized_policy_id,
        equipment_id=equipment_id,
        investment_plan_id=investment_plan_id,
    )

    if not preview:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "data": None,
                "message": "안전개선 준비 항목을 아직 생성하지 않았습니다.",
            },
        )

    return {"success": True, "data": preview}


@router.post("/analysis/{analysis_id}/policies/{policy_id}/safety-preview")
async def generate_safety_preview(
    analysis_id: str,
    policy_id: str,
    equipment_id: Optional[str] = Query(default=None),
    investment_plan_id: Optional[str] = Query(default=None),
    body: dict[str, Any] | None = Body(default=None),
):
    normalized_policy_id = _normalize_policy_id(policy_id) or policy_id
    try:
        preview = create_safety_preview(
            analysis_id=analysis_id,
            policy_id=normalized_policy_id,
            equipment_id=equipment_id,
            investment_plan_id=investment_plan_id,
            body=body or {},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": "안전개선 준비 항목을 생성하지 못했습니다.",
                "error": str(exc),
            },
        )

    if preview.get("can_run_safety_logic") is not True:
        return {
            "success": True,
            "data": preview,
            "message": preview.get("message") or "이 정책은 안전개선 Preview 생성 대상이 아닙니다.",
        }

    return {"success": True, "data": preview}
