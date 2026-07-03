import pytest
from fastapi import HTTPException

from app.services import equipment_attachment_service as service


def test_validate_upload_rejects_unknown_extension():
    with pytest.raises(HTTPException) as exc:
        service._validate_upload_file(
            filename="virus.exe",
            content_type="application/octet-stream",
            content_bytes=b"test",
            attachment_type="equipment_spec",
        )
    assert exc.value.status_code == 400


def test_validate_upload_rejects_oversized_file():
    with pytest.raises(HTTPException) as exc:
        service._validate_upload_file(
            filename="large.pdf",
            content_type="application/pdf",
            content_bytes=b"%PDF-" + (b"0" * (service.MAX_FILE_BYTES + 1)),
            attachment_type="equipment_spec",
        )
    assert exc.value.status_code == 413


def test_validate_upload_rejects_photo_type_with_pdf():
    with pytest.raises(HTTPException) as exc:
        service._validate_upload_file(
            filename="photo.pdf",
            content_type="application/pdf",
            content_bytes=b"%PDF-1.4",
            attachment_type="equipment_photo",
        )
    assert exc.value.status_code == 400


def test_validate_upload_accepts_photo_png():
    extension = service._validate_upload_file(
        filename="front.png",
        content_type="image/png",
        content_bytes=b"\x89PNG\r\n\x1a\n",
        attachment_type="equipment_photo",
    )
    assert extension == ".png"


def test_safe_filename_preserves_korean_characters():
    assert service._safe_filename("설비_사양서 A-102.pdf") == "설비_사양서_A-102.pdf"


def test_sort_attachment_rows_primary_first():
    rows = [
        {"is_primary_photo": False, "created_at": "2026-01-02T00:00:00Z"},
        {"is_primary_photo": True, "created_at": "2026-01-01T00:00:00Z"},
    ]
    sorted_rows = service._sort_attachment_rows(rows)
    assert sorted_rows[0]["is_primary_photo"] is True
