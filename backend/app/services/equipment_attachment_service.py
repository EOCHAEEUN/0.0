from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status

from app.core.database import get_db
from app.models.equipment_attachment import (
    ATTACHMENT_TYPE_LABELS,
    DOCUMENT_ATTACHMENT_TYPES,
    PHOTO_ATTACHMENT_TYPES,
)

EQUIPMENT_ATTACHMENTS_BUCKET = "equipment-attachments"
MAX_FILE_BYTES = 20 * 1024 * 1024
SIGNED_URL_TTL_SECONDS = 3600

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
DOCUMENT_EXTENSIONS = frozenset({".pdf", ".hwp", ".hwpx"})
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS

IMAGE_MIME_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/jpg"}
)
DOCUMENT_MIME_TYPES = frozenset(
    {
        "application/pdf",
        "application/x-hwp",
        "application/haansofthwp",
        "application/vnd.hancom.hwp",
        "application/vnd.hancom.hwpx",
        "application/octet-stream",
    }
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _sanitize_storage_segment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", str(value or "").strip()) or "unknown"


def _safe_filename(filename: str) -> str:
    base = Path(filename or "file").name
    cleaned = re.sub(r"[^\w.\-()가-힣]+", "_", base).strip("._")
    return (cleaned or "file")[:180]


def _extension_for_filename(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def _is_image_extension(ext: str) -> bool:
    return ext in IMAGE_EXTENSIONS


def _is_document_extension(ext: str) -> bool:
    return ext in DOCUMENT_EXTENSIONS


def _normalize_attachment_type(value: str) -> str:
    normalized = _sanitize_storage_segment(value).lower()
    if normalized not in ATTACHMENT_TYPE_LABELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 attachment_type 입니다.",
        )
    return normalized


def _validate_attachment_type_for_extension(
    attachment_type: str,
    extension: str,
) -> None:
    if attachment_type in PHOTO_ATTACHMENT_TYPES:
        if not _is_image_extension(extension):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="설비 사진은 JPG, PNG, WEBP 형식만 업로드할 수 있습니다.",
            )
        return

    if attachment_type in DOCUMENT_ATTACHMENT_TYPES:
        if not (_is_image_extension(extension) or _is_document_extension(extension)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="문서는 PDF, HWP, HWPX 또는 이미지 형식만 업로드할 수 있습니다.",
            )
        return

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="지원하지 않는 attachment_type 입니다.",
    )


def _validate_upload_file(
    *,
    filename: str,
    content_type: str,
    content_bytes: bytes,
    attachment_type: str,
) -> str:
    extension = _extension_for_filename(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="허용되지 않는 파일 확장자입니다.",
        )

    if len(content_bytes) <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="빈 파일은 업로드할 수 없습니다.",
        )

    if len(content_bytes) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="파일 크기는 20MB 이하만 업로드할 수 있습니다.",
        )

    _validate_attachment_type_for_extension(attachment_type, extension)

    mime_type = (content_type or "").split(";")[0].strip().lower()
    if _is_image_extension(extension) and mime_type and mime_type not in IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 MIME 타입이 올바르지 않습니다.",
        )

    if _is_document_extension(extension):
        if extension == ".pdf" and not content_bytes.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효한 PDF 헤더를 찾지 못했습니다.",
            )
        if mime_type and mime_type not in DOCUMENT_MIME_TYPES and mime_type not in IMAGE_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="문서 MIME 타입이 올바르지 않습니다.",
            )

    return extension


def _guess_mime_type(extension: str, content_type: str) -> str:
    mime_type = (content_type or "").split(";")[0].strip().lower()
    if mime_type:
        return mime_type
    if extension in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if extension == ".png":
        return "image/png"
    if extension == ".webp":
        return "image/webp"
    if extension == ".pdf":
        return "application/pdf"
    if extension == ".hwp":
        return "application/x-hwp"
    if extension == ".hwpx":
        return "application/vnd.hancom.hwpx"
    return "application/octet-stream"


def _load_owned_equipment(equipment_id: str, user_id: str) -> dict[str, Any]:
    db = get_db()
    equipment_rows = (
        db.table("equipment")
        .select("equipment_id, company_id")
        .eq("equipment_id", equipment_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not equipment_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="설비를 찾을 수 없습니다.",
        )

    equipment = equipment_rows[0]
    company_id = _safe_text(equipment.get("company_id"))
    company_rows = (
        db.table("company")
        .select("company_id, user_id")
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not company_rows:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="설비에 접근할 권한이 없습니다.",
        )
    return equipment


def _load_owned_attachment(
    *,
    equipment_id: str,
    attachment_id: str,
    user_id: str,
) -> dict[str, Any]:
    _load_owned_equipment(equipment_id, user_id)
    db = get_db()
    rows = (
        db.table("equipment_attachments")
        .select("*")
        .eq("attachment_id", attachment_id)
        .eq("equipment_id", equipment_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="첨부파일을 찾을 수 없습니다.",
        )
    row = rows[0]
    if _safe_text(row.get("user_id")) and _safe_text(row.get("user_id")) != user_id:
        company_id = _safe_text(row.get("company_id"))
        company_rows = (
            db.table("company")
            .select("company_id")
            .eq("company_id", company_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not company_rows:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="첨부파일에 접근할 권한이 없습니다.",
            )
    return row


def _create_signed_url(bucket: str, storage_path: str) -> str:
    db = get_db()
    try:
        signed = db.storage.from_(bucket).create_signed_url(
            storage_path,
            SIGNED_URL_TTL_SECONDS,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"서명 URL 생성에 실패했습니다: {exc}",
        ) from exc

    signed_url = _safe_text((signed or {}).get("signedURL"), (signed or {}).get("signedUrl"))
    if not signed_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서명 URL 생성 결과가 비어 있습니다.",
        )
    return signed_url


def _serialize_attachment_row(row: dict[str, Any]) -> dict[str, Any]:
    bucket = _safe_text(row.get("storage_bucket"), EQUIPMENT_ATTACHMENTS_BUCKET)
    storage_path = _safe_text(row.get("storage_path"))
    mime_type = _safe_text(row.get("mime_type"))
    attachment_type = _safe_text(row.get("attachment_type"))
    is_image = mime_type.startswith("image/") or _is_image_extension(
        _extension_for_filename(_safe_text(row.get("original_filename")))
    )

    signed_url = _create_signed_url(bucket, storage_path) if storage_path else ""
    payload: dict[str, Any] = {
        "attachment_id": _safe_text(row.get("attachment_id")),
        "equipment_id": _safe_text(row.get("equipment_id")),
        "company_id": _safe_text(row.get("company_id")),
        "attachment_type": attachment_type,
        "attachment_type_label": ATTACHMENT_TYPE_LABELS.get(attachment_type, attachment_type),
        "original_filename": _safe_text(row.get("original_filename")),
        "mime_type": mime_type,
        "file_size_bytes": int(row.get("file_size_bytes") or 0),
        "is_primary_photo": bool(row.get("is_primary_photo")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "signed_url": signed_url,
    }
    if is_image:
        payload["preview_url"] = signed_url
    else:
        payload["download_url"] = signed_url
    return payload


def _sort_attachment_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_key(row: dict[str, Any]) -> tuple[int, str]:
        primary_rank = 0 if row.get("is_primary_photo") else 1
        created_at = _safe_text(row.get("created_at"))
        return primary_rank, created_at

    return sorted(rows, key=sort_key)


def _clear_primary_photos(*, equipment_id: str) -> None:
    db = get_db()
    db.table("equipment_attachments").update(
        {"is_primary_photo": False, "updated_at": _now_iso()}
    ).eq("equipment_id", equipment_id).eq("attachment_type", "equipment_photo").eq(
        "is_primary_photo", True
    ).execute()


def list_equipment_attachments(*, equipment_id: str, user_id: str) -> dict[str, Any]:
    equipment = _load_owned_equipment(equipment_id, user_id)
    db = get_db()
    rows = (
        db.table("equipment_attachments")
        .select("*")
        .eq("equipment_id", equipment_id)
        .eq("company_id", _safe_text(equipment.get("company_id")))
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    sorted_rows = _sort_attachment_rows(rows)
    attachments = [_serialize_attachment_row(row) for row in sorted_rows]
    return {
        "equipment_id": equipment_id,
        "company_id": _safe_text(equipment.get("company_id")),
        "total_count": len(attachments),
        "attachments": attachments,
    }


def upload_equipment_attachment(
    *,
    equipment_id: str,
    user_id: str,
    attachment_type: str,
    is_primary_photo: bool,
    filename: str,
    content_type: str,
    content_bytes: bytes,
) -> dict[str, Any]:
    equipment = _load_owned_equipment(equipment_id, user_id)
    company_id = _safe_text(equipment.get("company_id"))
    normalized_type = _normalize_attachment_type(attachment_type)
    extension = _validate_upload_file(
        filename=filename,
        content_type=content_type,
        content_bytes=content_bytes,
        attachment_type=normalized_type,
    )

    wants_primary = bool(is_primary_photo)
    if wants_primary and normalized_type != "equipment_photo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="대표 사진은 equipment_photo 타입만 지정할 수 있습니다.",
        )

    attachment_id = str(uuid4())
    safe_name = _safe_filename(filename)
    storage_path = "/".join(
        [
            _sanitize_storage_segment(user_id),
            _sanitize_storage_segment(company_id),
            _sanitize_storage_segment(equipment_id),
            f"{attachment_id}_{safe_name}",
        ]
    )
    mime_type = _guess_mime_type(extension, content_type)

    db = get_db()
    try:
        db.storage.from_(EQUIPMENT_ATTACHMENTS_BUCKET).upload(
            path=storage_path,
            file=content_bytes,
            file_options={
                "content-type": mime_type,
                "upsert": "false",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"첨부파일 업로드에 실패했습니다: {exc}",
        ) from exc

    if wants_primary:
        _clear_primary_photos(equipment_id=equipment_id)

    payload = {
        "attachment_id": attachment_id,
        "equipment_id": equipment_id,
        "company_id": company_id,
        "user_id": user_id,
        "attachment_type": normalized_type,
        "original_filename": Path(filename or safe_name).name,
        "storage_bucket": EQUIPMENT_ATTACHMENTS_BUCKET,
        "storage_path": storage_path,
        "mime_type": mime_type,
        "file_size_bytes": len(content_bytes),
        "is_primary_photo": wants_primary,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    try:
        result = db.table("equipment_attachments").insert(payload).execute()
        row = (result.data or [payload])[0]
    except Exception as exc:
        try:
            db.storage.from_(EQUIPMENT_ATTACHMENTS_BUCKET).remove([storage_path])
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"첨부파일 메타데이터 저장에 실패했습니다: {exc}",
        ) from exc

    return {
        "attachment": _serialize_attachment_row(row),
        "total_count": len(
            db.table("equipment_attachments")
            .select("attachment_id")
            .eq("equipment_id", equipment_id)
            .execute()
            .data
            or []
        ),
    }


def delete_equipment_attachment(
    *,
    equipment_id: str,
    attachment_id: str,
    user_id: str,
) -> dict[str, Any]:
    row = _load_owned_attachment(
        equipment_id=equipment_id,
        attachment_id=attachment_id,
        user_id=user_id,
    )
    bucket = _safe_text(row.get("storage_bucket"), EQUIPMENT_ATTACHMENTS_BUCKET)
    storage_path = _safe_text(row.get("storage_path"))
    db = get_db()

    storage_deleted = False
    if storage_path:
        try:
            db.storage.from_(bucket).remove([storage_path])
            storage_deleted = True
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"스토리지 파일 삭제에 실패했습니다: {exc}",
            ) from exc

    try:
        db.table("equipment_attachments").delete().eq(
            "attachment_id", attachment_id
        ).eq("equipment_id", equipment_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"첨부파일 메타데이터 삭제에 실패했습니다: {exc}",
        ) from exc

    remaining = (
        db.table("equipment_attachments")
        .select("attachment_id")
        .eq("equipment_id", equipment_id)
        .execute()
        .data
        or []
    )
    return {
        "deleted_attachment_id": attachment_id,
        "storage_deleted": storage_deleted,
        "total_count": len(remaining),
    }


def set_primary_equipment_photo(
    *,
    equipment_id: str,
    attachment_id: str,
    user_id: str,
) -> dict[str, Any]:
    row = _load_owned_attachment(
        equipment_id=equipment_id,
        attachment_id=attachment_id,
        user_id=user_id,
    )
    attachment_type = _safe_text(row.get("attachment_type"))
    if attachment_type != "equipment_photo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="equipment_photo 타입만 대표 사진으로 지정할 수 있습니다.",
        )

    _clear_primary_photos(equipment_id=equipment_id)

    db = get_db()
    updated = (
        db.table("equipment_attachments")
        .update({"is_primary_photo": True, "updated_at": _now_iso()})
        .eq("attachment_id", attachment_id)
        .eq("equipment_id", equipment_id)
        .execute()
        .data
        or []
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="대표 사진 지정에 실패했습니다.",
        )

    return {
        "attachment": _serialize_attachment_row(updated[0]),
    }
