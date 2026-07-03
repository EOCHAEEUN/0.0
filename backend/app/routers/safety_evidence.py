from __future__ import annotations

import traceback

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.auth import CurrentUser
from app.services.safety_evidence_service import (
    build_safety_evidence_summary,
    bootstrap_safety_evidence_baseline,
    create_safety_evidence_download_url,
    delete_safety_evidence_file,
    upload_safety_evidence_file,
)


router = APIRouter()


def _resolve_company_id_for_user(user_id: str) -> str:
    db = get_db()
    rows = (
        db.table("company")
        .select("company_id")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="기업 정보를 찾을 수 없습니다.")
    company_id = str(rows[0].get("company_id") or "").strip()
    if not company_id:
        raise HTTPException(status_code=404, detail="기업 정보를 찾을 수 없습니다.")
    return company_id


@router.post("/safety-evidence/upload")
async def upload_safety_evidence(
    analysis_id: str = Form(...),
    policy_id: str = Form(...),
    equipment_id: str = Form(...),
    viewpoint_key: str = Form(...),
    safety_rule_id: str = Form(...),
    evidence_type: str = Form(...),
    evidence_label: str = Form(...),
    memo: str | None = Form(default=None),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        company_id = _resolve_company_id_for_user(current_user.id)
        result = upload_safety_evidence_file(
            current_user_id=current_user.id,
            company_id=company_id,
            analysis_id=analysis_id,
            policy_id=policy_id,
            equipment_id=equipment_id,
            viewpoint_key=viewpoint_key,
            safety_rule_id=safety_rule_id,
            evidence_type=evidence_type,
            evidence_label=evidence_label,
            memo=memo,
            file_name=file.filename or "evidence.pdf",
            file_mime_type=file.content_type or "",
            file_bytes=await file.read(),
        )
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="안전 증빙 파일 업로드에 실패했습니다.",
        ) from exc


@router.post("/safety-evidence/bootstrap")
async def bootstrap_safety_evidence(
    company_id: str = Query(...),
    analysis_id: str = Query(...),
    policy_id: str = Query(...),
    equipment_id: str | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        result = bootstrap_safety_evidence_baseline(
            current_user_id=current_user.id,
            company_id=company_id,
            analysis_id=analysis_id,
            policy_id=policy_id,
            equipment_id=equipment_id,
        )
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"안전 증빙 기준 생성에 실패했습니다. ({exc})",
        ) from exc


@router.get("/safety-evidence/summary")
async def get_safety_evidence_summary(
    analysis_id: str = Query(...),
    policy_id: str = Query(...),
    equipment_id: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        company_id = _resolve_company_id_for_user(current_user.id)
        summary = build_safety_evidence_summary(
            company_id=company_id,
            analysis_id=analysis_id,
            policy_id=policy_id,
            equipment_id=equipment_id,
        )
        return {"success": True, "data": summary}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="증빙 현황을 불러오지 못했습니다.",
        ) from exc


@router.get("/safety-evidence/{file_id}/download")
async def get_safety_evidence_download_url(
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        payload = create_safety_evidence_download_url(
            file_id=file_id,
            current_user_id=current_user.id,
        )
        return {"success": True, "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="다운로드 URL 생성에 실패했습니다.",
        ) from exc


@router.delete("/safety-evidence/{file_id}")
async def remove_safety_evidence_file(
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        payload = delete_safety_evidence_file(
            file_id=file_id,
            current_user_id=current_user.id,
        )
        return {"success": True, "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="증빙 파일 삭제에 실패했습니다.",
        ) from exc
