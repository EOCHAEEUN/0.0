from typing import Literal

AttachmentType = Literal[
    "equipment_photo",
    "equipment_spec",
    "maintenance_record",
    "safety_evidence",
    "quote",
]

ATTACHMENT_TYPE_LABELS: dict[str, str] = {
    "equipment_photo": "설비 사진",
    "equipment_spec": "설비 사양서",
    "maintenance_record": "정비 기록",
    "safety_evidence": "안전 증빙",
    "quote": "견적서",
}

PHOTO_ATTACHMENT_TYPES = frozenset({"equipment_photo"})
DOCUMENT_ATTACHMENT_TYPES = frozenset(
    {"equipment_spec", "maintenance_record", "safety_evidence", "quote"}
)
