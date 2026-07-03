from __future__ import annotations

import traceback

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.equipment_attachment_service import (
    delete_equipment_attachment,
    list_equipment_attachments,
    set_primary_equipment_photo,
    upload_equipment_attachment,
)

router = APIRouter()


@router.get("/equipment/{equipment_id}/attachments")
async def get_equipment_attachments(
    equipment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        payload = list_equipment_attachments(
            equipment_id=equipment_id,
            user_id=current_user.id,
        )
        return {"success": True, "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="첨부파일 목록을 불러오지 못했습니다.",
        ) from exc


@router.post("/equipment/{equipment_id}/attachments")
async def post_equipment_attachment(
    equipment_id: str,
    attachment_type: str = Form(...),
    is_primary_photo: bool = Form(default=False),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        payload = upload_equipment_attachment(
            equipment_id=equipment_id,
            user_id=current_user.id,
            attachment_type=attachment_type,
            is_primary_photo=is_primary_photo,
            filename=file.filename or "attachment",
            content_type=file.content_type or "",
            content_bytes=await file.read(),
        )
        return {"success": True, "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="첨부파일 업로드에 실패했습니다.",
        ) from exc


@router.delete("/equipment/{equipment_id}/attachments/{attachment_id}")
async def remove_equipment_attachment(
    equipment_id: str,
    attachment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        payload = delete_equipment_attachment(
            equipment_id=equipment_id,
            attachment_id=attachment_id,
            user_id=current_user.id,
        )
        return {"success": True, "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="첨부파일 삭제에 실패했습니다.",
        ) from exc


@router.patch("/equipment/{equipment_id}/attachments/{attachment_id}/primary")
async def patch_equipment_attachment_primary(
    equipment_id: str,
    attachment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        payload = set_primary_equipment_photo(
            equipment_id=equipment_id,
            attachment_id=attachment_id,
            user_id=current_user.id,
        )
        return {"success": True, "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="대표 사진 지정에 실패했습니다.",
        ) from exc
