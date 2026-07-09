from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.agents import draft as draft_agent  # noqa: E402
from app.models.company import CompanyContext  # noqa: E402
from app.models.equipment import EquipmentInput  # noqa: E402
from app.routers.draft import (  # noqa: E402
    DraftRequest,
    _enrich_draft_content,
    _get_scenario_subsidy,
)
from app.services import application_report as report  # noqa: E402
from app.services.draft_content import normalize_llm_draft_payload  # noqa: E402
from tests.test_application_report_draft import (  # noqa: E402
    ANALYSIS_ID,
    COMPANY_ID,
    EQUIPMENT_ID,
    POLICY_ID,
    _base_tables,
    _load_report,
)

COMPANY = "테스트기업"
EQUIPMENT = "CNC 설비"
POLICY = "스마트공장 지원사업"


def _long(text: str) -> str:
    value = text.strip()
    if len(value) < 80:
        value = f"{value} 추가 검토와 단계별 실행 계획을 통해 사업 타당성을 보완합니다."
    return value[:350]


LLM_PAYLOAD = {
    "application_purpose": _long(
        f"{COMPANY}은 {EQUIPMENT}의 노후화 개선과 생산 데이터 관리 고도화를 위해 "
        f"{POLICY} 연계를 검토하고 있습니다. 설비 교체와 공정 개선을 병행합니다."
    ),
    "business_necessity": _long(
        f"현재 {EQUIPMENT}는 사용연수와 에너지·유지보수 부담이 증가하고 있어 "
        "생산 안정성과 품질 관리 수준을 동시에 개선할 필요가 있습니다."
    ),
    "implementation_plan": _long(
        "추진 계획은 설비 사양 확정, 견적·발주, 설치 환경 정비, 시운전, 성과관리 순으로 "
        "진행합니다. 각 단계별 점검 기준을 사전에 정의하고 운영 데이터를 축적합니다."
    ),
    "expected_effects": _long(
        "도입 후에는 에너지 사용 효율, 유지보수 부담, 품질 안정성, 생산 대응력, "
        "납기 신뢰도 개선을 단계적으로 확인할 계획입니다."
    ),
    "expected_benefits": [
        "에너지 사용량 절감으로 운영비 부담 완화",
        "설비 가동 안정성 향상으로 생산 일정 리스크 감소",
        "공정 데이터 축적으로 품질 관리 고도화",
    ],
    "policy_utilization_strategy": _long(
        f"{POLICY}의 스마트공장 구축 취지에 맞게 설비 개선과 데이터 수집 체계를 "
        "연계하는 방향으로 지원 가능 항목을 검토합니다. 세부 비목은 공고 기준을 따릅니다."
    ),
    "final_recommendation": _long(
        "A/B 시나리오 비교 결과 전체 교체 시나리오를 우선 검토합니다. "
        "견적 확정, 안전점검 보완, 성과지표 정의를 선행한 뒤 신청을 진행하는 것이 적절합니다."
    ),
    "company_context": _long(
        f"{COMPANY}은 지역 제조 현장에서 {EQUIPMENT}를 핵심 공정 설비로 운용하고 있으며 "
        "설비 안정성과 데이터 기반 관리 수준을 함께 높여야 하는 상황입니다."
    ),
    "diagnostic_interpretation": _long(
        "ROI 분석과 설비 연식 정보를 종합하면 단순 유지보수보다 교체 및 운영 데이터 관리 체계를 "
        "함께 정비하는 방향이 사업 타당성을 설명하기에 적합합니다."
    ),
    "execution_detail": _long(
        "실행 단계에서는 현장 요구 사양을 확정하고 견적 비교, 발주, 설치 공간 정비, 시운전 검수, "
        "운영자 교육 순서로 도입 리스크를 관리합니다."
    ),
    "policy_analysis": _long(
        f"{POLICY}은 제조 현장의 디지털 전환과 생산성 개선 취지에 맞는 공고로, "
        f"{EQUIPMENT} 개선 투자와 운영 데이터 확보 계획을 함께 제시하기에 적합합니다."
    ),
    "performance_plan": _long(
        "성과관리는 도입 전후 에너지 사용량, 유지보수 건수, 품질 이슈, 생산 대응 시간을 "
        "같은 기준으로 기록하고 월 단위로 개선 여부를 확인하는 방식으로 운영합니다."
    ),
    "risk_review": _long(
        "주요 리스크는 견적 변동, 납기 지연, 설치 기간 생산 차질, 안전증빙 보완 지연입니다. "
        "사전 견적 확인과 일정 분리, 증빙 체크리스트로 보완합니다."
    ),
    "submission_readiness": _long(
        "현재 신청서에는 기업 기본정보, 설비 개선 목적, 투자 시나리오, 기대효과를 반영할 수 있으며 "
        "최종 제출 전 견적서와 안전 관련 증빙을 함께 확인해야 합니다."
    ),
    "performance_governance": _long(
        "성과관리 체계는 담당자를 지정해 월별 운영 데이터를 취합하고, 견적·검수·점검 자료를 "
        "사후관리 증빙으로 보관하는 방식으로 구성합니다."
    ),
    "user_request_reflection": _long(
        "사용자가 요청한 안전커버 보강과 작업자 교육 계획을 설비 도입 일정에 연계해 추진합니다. "
        "완료 결과는 점검표와 교육 기록으로 관리하고 사업 성과 증빙에 포함합니다."
    ),
}


def _draft_request() -> DraftRequest:
    return DraftRequest(
        company_id=COMPANY_ID,
        equipment_id=EQUIPMENT_ID,
        policy_id=POLICY_ID,
        analysis_id=ANALYSIS_ID,
    )


def _enrich(llm_payload: dict) -> dict:
    return _enrich_draft_content(
        llm_payload,
        body=_draft_request(),
        company_data={"company_name": COMPANY},
        equipment_data={"name": EQUIPMENT, "defect_rate": 3.1},
        selected_policy={"title": POLICY, "policy_id": POLICY_ID, "organization": "중소벤처기업부"},
        selected_roi_scenario={
            "investment_manwon": 10000,
            "subsidy_manwon": 7000,
            "payback_years": 2.5,
        },
        scenario_used="a",
        scenario_label="전체 교체",
    )


def test_normalize_llm_draft_payload_keeps_extended_fields():
    normalized = normalize_llm_draft_payload(
        LLM_PAYLOAD,
        company_name=COMPANY,
        equipment_name=EQUIPMENT,
        policy_title=POLICY,
    )
    for key in (
        "application_purpose",
        "business_necessity",
        "implementation_plan",
        "expected_effects",
        "policy_utilization_strategy",
        "final_recommendation",
        "company_context",
        "diagnostic_interpretation",
        "execution_detail",
        "policy_analysis",
        "performance_plan",
        "risk_review",
        "submission_readiness",
        "performance_governance",
    ):
        assert normalized.get(key)
    assert len(normalized[key]) >= 80
    assert len(normalized.get("expected_benefits") or []) == 3


def test_enrich_draft_content_persists_extended_fields():
    enriched = _enrich(LLM_PAYLOAD)
    for key in (
        "application_purpose",
        "business_necessity",
        "implementation_plan",
        "expected_effects",
        "policy_utilization_strategy",
        "final_recommendation",
        "company_context",
        "diagnostic_interpretation",
        "execution_detail",
        "policy_analysis",
        "performance_plan",
        "risk_review",
        "submission_readiness",
        "performance_governance",
        "expected_benefits",
    ):
        assert enriched.get(key)
    assert enriched["investment_manwon"] == 10000
    assert enriched["subsidy_manwon"] == 7000


def test_scenario_subsidy_never_exceeds_policy_limit():
    subsidy = _get_scenario_subsidy(
        {"subsidy_manwon": 16000},
        {"max_amount": 80},
    )
    assert subsidy == 80


def test_partial_llm_payload_keeps_existing_fallbacks():
    partial = {
        "business_necessity": LLM_PAYLOAD["business_necessity"],
        "expected_effects": LLM_PAYLOAD["expected_effects"],
    }
    enriched = _enrich(partial)
    assert enriched["business_necessity"] == partial["business_necessity"]
    assert "implementation_plan" not in enriched or not enriched.get("implementation_plan")
    assert enriched["application_purpose"]


def test_legacy_draft_without_extended_fields_still_enriches():
    legacy = {
        "business_necessity": LLM_PAYLOAD["business_necessity"],
        "expected_effects": LLM_PAYLOAD["expected_effects"],
        "expected_benefits": LLM_PAYLOAD["expected_benefits"],
    }
    enriched = _enrich(legacy)
    assert enriched["business_necessity"]
    assert enriched["expected_effects"]
    assert enriched["expected_benefits"]


def test_pdf_prefers_extended_draft_fields():
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": _enrich(LLM_PAYLOAD),
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")
    sources = data["narrative_sources"]

    assert sources["implementation_plan"] == "draft_result"
    assert sources["policy_utilization_strategy"] == "draft_result"
    assert sources["final_recommendation"] == "draft_result"
    assert sources["business_necessity"] == "draft_result"
    assert sources["expected_effects"] == "draft_result"
    assert sources["risk_review"] == "draft_result"
    assert sources["submission_readiness"] == "draft_result"
    assert data["narrative_source_summary"]["draft_result_count"] >= 14
    assert data["narrative_source_summary"]["template_fallback_count"] <= 3


def test_pdf_summary_uses_llm_reflection_instead_of_raw_user_text():
    request_text = "최근 완료한 안전커버 보강과 작업자 안전교육 계획을 반드시 포함합니다."
    enriched = _enrich_draft_content(
        LLM_PAYLOAD,
        body=_draft_request().model_copy(
            update={"must_include_text": request_text}
        ),
        company_data={"company_name": COMPANY},
        equipment_data={"name": EQUIPMENT, "defect_rate": 3.1},
        selected_policy={
            "title": POLICY,
            "policy_id": POLICY_ID,
            "organization": "중소벤처기업부",
        },
        selected_roi_scenario={
            "investment_manwon": 10000,
            "subsidy_manwon": 7000,
            "payback_years": 2.5,
        },
        scenario_used="a",
        scenario_label="전체 교체",
    )
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": enriched,
            }
        ]
    )

    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")

    assert data["summary"]["must_include_text"] == request_text
    assert data["summary"]["user_request_reflection"] == enriched[
        "user_request_reflection"
    ]
    assert data["summary"]["user_request_reflection"] != request_text

    context = report.ReportContext(
        data=data,
        draft_result=data.get("draft"),
        roi_output=data.get("roi_output"),
        matched_policy=data.get("matched_policy"),
        company=data.get("company"),
        equipment=data.get("equipment"),
        policy=data.get("policy"),
        safety_viewer_policy=None,
        user_safety_files=[],
    )
    pdf_bytes = report.generate_application_evidence_report_pdf(context)
    assert pdf_bytes.startswith(b"%PDF")


def test_roi_numbers_unchanged_after_extended_draft():
    enriched = _enrich({**LLM_PAYLOAD, "investment_manwon": 1, "subsidy_manwon": 1})
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": enriched,
            }
        ]
    )
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")
    assert data["summary"]["investment_manwon"] == 10000
    assert data["summary"]["subsidy_manwon"] == 7000
    assert data["summary"]["self_funding_manwon"] == 3000


def test_application_draft_node_invokes_llm_once(monkeypatch):
    calls = {"count": 0}

    class FakeResponse:
        content = json.dumps(LLM_PAYLOAD, ensure_ascii=False)

    def fake_invoke(_messages):
        calls["count"] += 1
        return FakeResponse()

    monkeypatch.setattr(draft_agent, "llm_pro", SimpleNamespace(invoke=fake_invoke))

    state = {
        "user_query": "신청서 초안 작성",
        "company_info": CompanyContext(
            company_id=COMPANY_ID,
            company_name=COMPANY,
            industry_code=["25"],
            region="경기",
        ),
        "equipment": EquipmentInput(
            name=EQUIPMENT,
            category="가공",
            age_years=12,
            energy_cost_annual=800,
        ),
        "roi_result": {"recommended": "scenario_a"},
        "draft_context": {"scenario_label": "전체 교체"},
        "selected_policy": {"title": POLICY, "policy_id": POLICY_ID},
    }
    result = draft_agent.application_draft_node(state)

    assert calls["count"] == 1
    assert result["draft_result"]["implementation_plan"]
    assert result["draft_result"]["policy_utilization_strategy"]


def test_application_draft_prompt_includes_user_request_and_safety(monkeypatch):
    captured = {"messages": []}

    class FakeResponse:
        content = json.dumps(LLM_PAYLOAD, ensure_ascii=False)

    def fake_invoke(messages):
        captured["messages"] = messages
        return FakeResponse()

    monkeypatch.setattr(draft_agent, "llm_pro", SimpleNamespace(invoke=fake_invoke))
    state = {
        "user_query": "신청서 초안 작성",
        "company_info": CompanyContext(
            company_id=COMPANY_ID,
            company_name=COMPANY,
            industry_code=["25"],
            region="경기",
        ),
        "equipment": EquipmentInput(
            name=EQUIPMENT,
            category="가공",
            age_years=12,
            energy_cost_annual=800,
        ),
        "roi_result": {"recommended": "scenario_a"},
        "draft_context": {
            "scenario_label": "전체 교체",
            "must_include_text": "안전커버 보강 완료와 작업자 교육 계획을 포함",
            "safety_management": {
                "total_required_count": 2,
                "uploaded_required_count": 1,
                "viewpoints": [{"viewpoint_title": "비상정지 장치"}],
                "saved_improvements": [
                    {
                        "improvement_plan": "월 1회 안전장치 작동 상태를 확인",
                        "additional_info": "교체 후 작업자 안전교육을 정례화",
                    }
                ],
            },
        },
        "selected_policy": {"title": POLICY, "policy_id": POLICY_ID},
    }

    draft_agent.application_draft_node(state)

    prompt = captured["messages"][0].content
    assert "안전커버 보강 완료와 작업자 교육 계획을 포함" in prompt
    assert "비상정지 장치" in prompt
    assert '"uploaded_required_count": 1' in prompt
    assert "교체 후 작업자 안전교육을 정례화" in prompt
