# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime

from app.services.application_report_core import (
    REPORT_TYPE_APPLICATION_EVIDENCE,
    REPORT_TYPE_CONSUMER_SUMMARY,
    ReportContext,
    build_report_context,
    load_application_report_data,
)
from app.services.application_report_tables import (
    build_application_report_pdf,
    generate_application_evidence_report_pdf,
)
from app.services.application_report_text import generate_consumer_summary_report_pdf


def generate_application_report_pdf(
    *,
    report_type: str = REPORT_TYPE_APPLICATION_EVIDENCE,
    analysis_id: str | None = None,
    draft_result_id: str | None = None,
    company_id: str | None = None,
    equipment_id: str | None = None,
    policy_id: str | None = None,
    user_id: str | None = None,
    tone: str = "submission",
) -> bytes:
    ctx = build_report_context(
        analysis_id=analysis_id,
        draft_result_id=draft_result_id,
        company_id=company_id,
        equipment_id=equipment_id,
        policy_id=policy_id,
        user_id=user_id,
        tone=tone,
    )
    if report_type == REPORT_TYPE_CONSUMER_SUMMARY:
        return generate_consumer_summary_report_pdf(ctx)
    if report_type == REPORT_TYPE_APPLICATION_EVIDENCE:
        return generate_application_evidence_report_pdf(ctx)
    raise ValueError(f"Unsupported report_type: {report_type}")


def report_file_name(data: dict, report_type: str = REPORT_TYPE_APPLICATION_EVIDENCE) -> str:
    if report_type == REPORT_TYPE_CONSUMER_SUMMARY:
        return f"consumer_summary_report_{datetime.now():%Y%m%d}.pdf"
    company = str(data["summary"]["company_name"]).replace(" ", "_")
    equipment = str(data["summary"]["equipment_name"]).replace(" ", "_")
    tone_suffix = {
        "analyst": "평서문종결체",
        "nominal": "명사형종결체",
        "submission": "높임말종결체",
    }.get(data.get("tone"), "높임말종결체")
    return f"factofit_{company}_{equipment}_{tone_suffix}_{datetime.now():%Y%m%d}.pdf"


__all__ = [
    "REPORT_TYPE_APPLICATION_EVIDENCE",
    "REPORT_TYPE_CONSUMER_SUMMARY",
    "ReportContext",
    "build_report_context",
    "load_application_report_data",
    "build_application_report_pdf",
    "generate_application_evidence_report_pdf",
    "generate_consumer_summary_report_pdf",
    "generate_application_report_pdf",
    "report_file_name",
]
