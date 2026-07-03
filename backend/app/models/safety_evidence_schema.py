from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SafetyEvidenceUploadResponse(BaseModel):
    success: bool = True
    data: dict[str, Any]


class SafetyEvidenceSummaryResponse(BaseModel):
    success: bool = True
    data: dict[str, Any]


class SafetyEvidenceDownloadResponse(BaseModel):
    success: bool = True
    data: dict[str, Any]


class SafetyEvidenceDeleteResponse(BaseModel):
    success: bool = True
    data: dict[str, Any]


class SafetyEvidenceSummaryQuery(BaseModel):
    analysis_id: str = Field(..., min_length=1)
    policy_id: str = Field(..., min_length=1)
    equipment_id: str = Field(..., min_length=1)

