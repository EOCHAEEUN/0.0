# backend/app/models/documents.py

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CompanyDocumentResponse(BaseModel):
    document_id: str
    user_id: str
    company_id: str

    document_type: str
    document_label: str
    original_filename: str

    public_url: str
    mime_type: str
    file_size: int

    parse_status: str = "stored"

    storage_bucket: Optional[str] = None
    storage_path: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CompanyDocumentUploadResponse(BaseModel):
    success: bool
    message: str
    data: CompanyDocumentResponse


class CompanyDocumentsResponse(BaseModel):
    success: bool
    documents: list[CompanyDocumentResponse]



# 프론트 응답 jason
# {
#   "success": true,
#   "documents": [
#     {
#       "document_id": "uuid",
#       "user_id": "user-uuid",
#       "company_id": "company-uuid",
#       "document_type": "business_registration",
#       "document_label": "사업자등록증",
#       "original_filename": "사업자등록증.pdf",
#       "public_url": "https://...",
#       "mime_type": "application/pdf",
#       "file_size": 123456,
#       "parse_status": "stored",
#       "storage_bucket": "company-documents",
#       "storage_path": "company-id/business_registration/file.pdf",
#       "created_at": "2026-06-23T12:00:00",
#       "updated_at": "2026-06-23T12:00:00"
#     }
#   ]
# }