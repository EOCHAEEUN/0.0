from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services import application_report as report  # noqa: E402


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, db, table_name: str):
        self.db = db
        self.table_name = table_name
        self.filters: dict[str, str] = {}
        self._limit: int | None = None
        self._order: tuple[str, bool] | None = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, value):
        self._limit = value
        return self

    def order(self, key, desc=False):
        self._order = (key, desc)
        return self

    def execute(self):
        rows = list(self.db.tables.get(self.table_name, []))
        for key, value in self.filters.items():
            rows = [row for row in rows if str(row.get(key, "")) == str(value)]
        if self._order:
            order_key, desc = self._order
            rows = sorted(rows, key=lambda item: item.get(order_key) or "", reverse=desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return FakeResult(rows)


class FakeDB:
    def __init__(self, tables):
        self.tables = tables
        self.write_calls: list[tuple] = []

    def table(self, name: str):
        return FakeQuery(self, name)


COMPANY_ID = "company-1"
EQUIPMENT_ID = "equipment-1"
POLICY_ID = "policy-1"
ANALYSIS_ID = "analysis-1"
OTHER_ANALYSIS_ID = "analysis-2"

LLM_BUSINESS_NECESSITY = (
    "LLM 생성 사업 필요성 문단입니다. 노후 설비 개선과 생산 안정성 확보를 위해 "
    "지원사업 연계가 필요합니다."
)
LLM_COMPANY_OVERVIEW = (
    "LLM 생성 기업 개요 문단입니다. 제조기업으로서 핵심 생산 역량과 "
    "지역 산업 기반을 보유하고 있습니다."
)


def test_safety_additional_info_is_normalized_for_pdf():
    normalized = report._normalize_safety_maintenance_evidence_for_report(
        {
            "source": "safety_check_improvement",
            "items": [
                {
                    "equipment_name": "프레스",
                    "inspection_purpose_label": "안전장치 점검",
                    "check_content": "비상정지 버튼 작동 확인",
                    "current_safety_measures": "파일보유",
                    "improvement_plan": "월 1회 작동 상태 확인",
                    "additional_info": "교체 후 작업자 안전교육을 정례화",
                }
            ],
        },
        default_equipment_name="프레스",
    )

    item = normalized["items"][0]
    assert item["additional_info"] == "교체 후 작업자 안전교육을 정례화"
    assert "신청서 반영" in report._format_safety_maintenance_plan_for_table(item)
    assert "작업자 안전교육" in report._safety_maintenance_narrative(item)


def _base_tables(*, draft_rows: list[dict] | None = None) -> dict[str, list[dict]]:
    roi_data = {
        "recommended": "scenario_a",
        "scenario_a": {
            "label": "전체 교체",
            "investment_manwon": 10000,
            "subsidy_manwon": 7000,
            "payback_years": 2.5,
            "annual_net_benefit_manwon": 1200,
            "breakdown": {
                "energy_saving_manwon": 500,
                "maintenance_saving_manwon": 400,
                "defect_saving_manwon": 300,
            },
        },
        "benchmark": {"avg_replacement_cycle_yr": 10, "avg_defect_rate_pct": 2.5},
    }
    return {
        "company": [
            {
                "company_id": COMPANY_ID,
                "company_name": "테스트기업",
                "region": "경기",
                "company_type": "중소기업",
                "industry_code": ["25"],
                "industry_name": ["금속가공"],
                "employee_count": 50,
                "annual_revenue": 50000,
            }
        ],
        "equipment": [
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "name": "CNC 설비",
                "age_years": 12,
                "energy_cost_annual": 800,
                "maintenance_cost_annual": 300,
                "defect_rate": 3.1,
                "production_qty": 12000,
                "process": "가공",
            }
        ],
        "matched_policy": [
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "title": "스마트공장 지원사업",
                "organization": "중소벤처기업부",
                "reason": "업종 및 지역 조건이 부합합니다.",
                "match_score": 82,
                "scenario_label": "전체 교체",
            }
        ],
        "policy": [
            {
                "policy_id": POLICY_ID,
                "title": "스마트공장 지원사업",
                "organization": "중소벤처기업부",
                "max_amount": 7000,
            }
        ],
        "roi_output": [
            {
                "id": ANALYSIS_ID,
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "roi_data": roi_data,
                "created_at": "2026-01-01T00:00:00",
                "policy_snapshot": {
                    "snapshot_version": 1,
                    "recommended_policy_id": POLICY_ID,
                    "policies": [
                        {
                            "policy_id": POLICY_ID,
                            "title": "스마트공장 지원사업",
                            "organization": "중소벤처기업부",
                            "reason": "업종 및 지역 조건이 부합합니다.",
                            "match_score": 82,
                            "scenario_label": "전체 교체",
                            "max_amount_numeric_manwon": 7000,
                        }
                    ],
                },
            }
        ],
        "draft_result": draft_rows or [],
        "safety_check_improvement": [],
    }


def _load_report(**kwargs):
    tables = kwargs.pop("tables")
    fake_db = FakeDB(tables)
    with patch.object(report, "get_db", return_value=fake_db), patch.object(
        report,
        "_load_safety_improvement_fallback",
        return_value={"source": "none", "items": []},
    ), patch.object(
        report,
        "_auto_generate_safety_improvement_for_report",
        return_value={"source": "none", "items": []},
    ), patch.object(
        report,
        "_load_safety_maintenance_evidence_fallback",
        return_value={"source": "none", "items": []},
    ):
        return report.load_application_report_data(
            COMPANY_ID,
            EQUIPMENT_ID,
            POLICY_ID,
            **kwargs,
        )


def test_pdf_summary_prefers_llm_draft_paragraphs():
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "business_necessity": LLM_BUSINESS_NECESSITY,
                    "company_overview": LLM_COMPANY_OVERVIEW,
                },
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert data["summary"]["business_necessity"] == LLM_BUSINESS_NECESSITY
    assert data["summary"]["company_overview"] == LLM_COMPANY_OVERVIEW
    assert data["narrative_sources"]["business_necessity"] == "draft_result"
    assert data["narrative_sources"]["company_overview"] == "draft_result"


def test_partial_empty_draft_field_falls_back_to_template_only_for_that_field():
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "business_necessity": LLM_BUSINESS_NECESSITY,
                    "company_overview": "없음",
                },
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert data["summary"]["business_necessity"] == LLM_BUSINESS_NECESSITY
    assert "LLM 생성" not in data["summary"]["company_overview"]
    assert "귀사는" in data["summary"]["company_overview"]
    assert data["narrative_sources"]["business_necessity"] == "draft_result"
    assert data["narrative_sources"]["company_overview"] == "template_fallback"


def test_pdf_generation_succeeds_without_draft_result():
    tables = _base_tables(draft_rows=[])
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert data["summary"]["business_necessity"]
    assert all(source == "template_fallback" for source in data["narrative_sources"].values())
    assert data["summary"]["investment_manwon"] == 10000
    assert data["summary"]["subsidy_manwon"] == 7000


def test_analysis_id_scoped_draft_does_not_mix_other_analysis():
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": OTHER_ANALYSIS_ID,
                "created_at": "2026-01-03T00:00:00",
                "draft_content": {
                    "business_necessity": "다른 분석 이력의 LLM 초안 문단입니다. 섞이면 안 됩니다.",
                },
            },
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "business_necessity": LLM_BUSINESS_NECESSITY,
                },
            },
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert data["summary"]["business_necessity"] == LLM_BUSINESS_NECESSITY
    assert "다른 분석" not in data["summary"]["business_necessity"]


def test_roi_numbers_remain_unchanged_when_draft_is_applied():
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "business_necessity": LLM_BUSINESS_NECESSITY,
                    "investment_manwon": 1,
                    "subsidy_manwon": 1,
                    "payback_months": 999,
                },
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert data["summary"]["investment_manwon"] == 10000
    assert data["summary"]["subsidy_manwon"] == 7000
    assert data["summary"]["self_funding_manwon"] == 3000
    assert data["summary"]["payback_months"] == pytest.approx(30.0)


def test_expected_benefits_list_used_as_expected_effects_fallback():
    benefit_items = [
        "에너지 사용량을 줄여 연간 운영비 부담을 완화하는 효과를 기대합니다.",
        "설비 가동 안정성을 높여 생산 일정 리스크를 낮추는 방향입니다.",
        "공정 데이터 축적으로 품질 관리 수준을 지속 개선합니다.",
    ]
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "expected_benefits": benefit_items,
                },
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    joined = " ".join(benefit_items)
    assert joined in data["summary"]["expected_effects"] or data["summary"]["expected_effects"] == joined
    assert data["summary"]["expected_effects_bullets"] == benefit_items[:3]
    assert data["narrative_sources"]["expected_effects"] == "draft_result"


def test_application_purpose_does_not_override_implementation_plan():
    purpose_text = (
        "application_purpose 전용 문장입니다. CNC 설비 개선과 생산 효율 향상을 위해 "
        "지원사업을 활용하고자 합니다."
    )
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "application_purpose": purpose_text,
                },
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert purpose_text not in data["summary"]["implementation_plan"]
    assert "CNC 설비" in data["summary"]["implementation_plan"]
    assert data["narrative_sources"]["implementation_plan"] == "template_fallback"


def test_three_field_draft_narrative_source_summary():
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "business_necessity": LLM_BUSINESS_NECESSITY,
                    "expected_effects": (
                        "LLM 기대효과 문단입니다. 에너지 절감과 품질 안정화를 "
                        "동시에 달성할 수 있습니다."
                    ),
                    "company_overview": LLM_COMPANY_OVERVIEW,
                },
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")
    summary = data["narrative_source_summary"]

    assert summary["draft_result_count"] == 3
    assert summary["template_fallback_count"] == len(data["narrative_sources"]) - 3
    assert summary["partial_llm"] is True
    assert summary["status"] == "partial_llm"


def test_nested_draft_content_sections_are_supported():
    nested_text = (
        "중첩 sections 구조의 LLM 정책 분석 문단입니다. 공고 조건과 기업 현황을 "
        "종합 검토한 결과입니다."
    )
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {
                    "sections": {
                        "policy_analysis": nested_text,
                    }
                },
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert data["summary"]["policy_analysis"] == nested_text
    assert data["narrative_sources"]["policy_analysis"] == "draft_result"


def test_db_write_calls_remain_zero_during_pdf_data_load():
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": {"business_necessity": LLM_BUSINESS_NECESSITY},
            }
        ]
    )
    fake_db = FakeDB(tables)
    with patch.object(report, "get_db", return_value=fake_db), patch.object(
        report,
        "_load_safety_improvement_fallback",
        return_value={"source": "none", "items": []},
    ), patch.object(
        report,
        "_auto_generate_safety_improvement_for_report",
        return_value={"source": "none", "items": []},
    ), patch.object(
        report,
        "_load_safety_maintenance_evidence_fallback",
        return_value={"source": "none", "items": []},
    ):
        report.load_application_report_data(
            COMPANY_ID,
            EQUIPMENT_ID,
            POLICY_ID,
            analysis_id=ANALYSIS_ID,
            tone="submission",
        )
    assert fake_db.write_calls == []
