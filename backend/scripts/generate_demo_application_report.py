from pathlib import Path
import argparse
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.application_report import (  # noqa: E402
    REPORT_TYPE_APPLICATION_EVIDENCE,
    REPORT_TYPE_CONSUMER_SUMMARY,
    ReportContext,
    build_application_report_pdf,
    generate_application_report_pdf,
    generate_consumer_summary_report_pdf,
    load_application_report_data,
    report_file_name,
)


DEMO_COMPANY_ID = "8da9a28d-53b7-4859-8d22-aefd5a86fb13"
DEMO_EQUIPMENT_ID = "dab19f1e-4369-47d5-acb5-4ebd92ba54a2"
DEMO_POLICY_ID = "mss-2026-007"


def _sample_report_data() -> dict:
    summary = {
        "company_name": "데모제조",
        "equipment_name": "프레스 1호기",
        "policy_title": "2026년도 스마트공장 구축 지원사업",
        "industry_display": "제조업",
        "industry_codes": ["C24"],
        "process": "프레스 가공",
        "scenario_label": "A안 전체 교체",
        "investment_manwon": 52000,
        "subsidy_manwon": 32000,
        "self_funding_manwon": 20000,
        "payback_months": 50.4,
        "match_score": 87.0,
        "company_overview": "데모제조는 금속가공 공정을 운영하는 제조기업입니다.",
        "business_necessity": "노후 프레스 설비로 인한 정지시간과 품질 편차를 줄이기 위해 설비 개선이 필요합니다.",
        "implementation_plan": "AI 모니터링 기능이 포함된 신규 설비를 도입하고 공정 데이터를 수집합니다.",
        "expected_effects": "에너지비, 유지보수비, 불량비용 절감과 생산성 개선을 기대합니다.",
        "financial_assessment": "총 사업비와 예상 지원금을 기준으로 자기부담금과 회수기간을 산정했습니다.",
        "company_context": "업종, 지역, 기업 규모 조건을 기준으로 지원 가능성을 검토했습니다.",
        "diagnostic_interpretation": "사용연수와 비용 지표상 교체 검토 필요성이 확인됩니다.",
        "execution_detail": "견적 확정 후 설비 발주, 설치, 시운전, 성과 측정 순서로 추진합니다.",
        "policy_analysis": "정책 목적과 설비투자 방향이 부합하며 지원사업 신청 검토가 가능합니다.",
        "performance_plan": "월별 에너지비, 유지보수비, 불량률, 생산량을 기준으로 성과를 관리합니다.",
        "risk_review": "견적서, 설비 사양서, 기존 설비 사진, 비용 기준자료 보완이 필요합니다.",
        "application_background": "생산 안정성과 품질 개선을 위해 설비 투자 검토가 진행되었습니다.",
        "scenario_rationale": "A안은 투자금이 크지만 효과와 정책 적합도가 높아 우선 검토 대상으로 설정했습니다.",
        "policy_utilization_strategy": "지원금은 설비 본체와 AI 기능 구성에 우선 배분합니다.",
        "submission_readiness": "공고 원문, 견적서, 사양서, 안전개선 준비자료를 제출 전 확인해야 합니다.",
        "performance_governance": "도입 후 6개월간 주요 성과지표를 월별로 점검합니다.",
        "final_recommendation": "보완자료를 확보한 뒤 신청을 검토할 수 있습니다.",
        "tone_label": "데모 보고서",
    }
    return {
        "generated_at": "2026-06-29T00:00:00",
        "tone": "submission",
        "company": {
            "company_name": "데모제조",
            "company_type": "중소기업",
            "company_size": "중소기업",
            "region": "서울",
            "employee_count": 24,
            "annual_revenue": 180000,
            "established_year": 2018,
            "workplace_type": "제조 사업장",
            "industry_code": ["C24"],
            "industry_name": ["금속가공"],
        },
        "equipment": {
            "equipment_id": "demo-equipment",
            "name": "프레스 1호기",
            "category": "press",
            "process": "프레스 가공",
            "age_years": 9,
            "defect_rate": 4.8,
            "energy_cost_annual": 3600,
            "maintenance_cost_annual": 1200,
        },
        "policy": {
            "policy_id": "demo-policy",
            "title": "2026년도 스마트공장 구축 지원사업",
            "organization": "중소벤처기업부",
            "max_amount": 32000,
            "region": "전국",
            "industry_codes": ["C"],
            "eligible_company_types": ["중소기업"],
            "content": "스마트공장 및 제조 자동화 설비 구축을 지원합니다.",
        },
        "matched_policy": {
            "policy_id": "demo-policy",
            "title": "2026년도 스마트공장 구축 지원사업",
            "organization": "중소벤처기업부",
            "match_score": 87.0,
            "eligible": True,
            "reason": "설비 자동화 투자 목적과 지원사업 취지가 부합합니다.",
            "scenario_match": ["a"],
            "scenario_label": "A안 전체 교체",
        },
        "roi_output": {"roi_data": {}},
        "roi_data": {},
        "scenario_key": "scenario_a",
        "scenario": {
            "investment_manwon": 52000,
            "subsidy_manwon": 32000,
            "payback_months": 50.4,
            "annual_net_benefit_manwon": 1200,
        },
        "scenario_label": "A안 전체 교체",
        "breakdown": {
            "energy_saving_manwon": 300,
            "maintenance_saving_manwon": 200,
            "defect_saving_manwon": 400,
            "defect_reduction_manwon": 400,
            "productivity_gain_manwon": 300,
        },
        "benchmark": {
            "avg_replacement_cycle_yr": 7,
            "avg_defect_rate_pct": 3.2,
        },
        "draft": {},
        "safety_improvement": {
            "source": "offline_demo",
            "items": [
                {
                    "viewpoint_title": "작업자 위험 노출 감소",
                    "current_judgement": "개선 필요",
                    "description": "방호장치와 작업 전 점검자료를 준비해야 합니다.",
                    "required_evidences": [
                        {"label": "작업시작 전 점검표"},
                        {"label": "방호장치 작동 사진"},
                    ],
                }
            ],
        },
        "summary": summary,
    }


def _write_offline_demo_reports(output_dir: Path, report_types: list[str]) -> None:
    data = _sample_report_data()
    ctx = ReportContext(
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
    for report_type in report_types:
        output_path = output_dir / report_file_name(data, report_type)
        if report_type == REPORT_TYPE_CONSUMER_SUMMARY:
            output_path.write_bytes(generate_consumer_summary_report_pdf(ctx))
        else:
            output_path.write_bytes(build_application_report_pdf(data))
        print(output_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--report-type",
        choices=[REPORT_TYPE_CONSUMER_SUMMARY, REPORT_TYPE_APPLICATION_EVIDENCE, "both"],
        default="both",
    )
    parser.add_argument(
        "--no-offline-fallback",
        action="store_true",
        help="Do not generate local sample PDFs when DB access fails.",
    )
    args = parser.parse_args()

    output_dir = BACKEND_DIR / "generated_reports"
    output_dir.mkdir(parents=True, exist_ok=True)
    report_types = (
        [REPORT_TYPE_CONSUMER_SUMMARY, REPORT_TYPE_APPLICATION_EVIDENCE]
        if args.report_type == "both"
        else [args.report_type]
    )

    try:
        data = load_application_report_data(
            DEMO_COMPANY_ID,
            DEMO_EQUIPMENT_ID,
            DEMO_POLICY_ID,
            tone="submission",
        )
    except Exception as exc:
        print(f"Demo DB report data is not available: {exc}")
        if args.no_offline_fallback:
            print("Offline fallback is disabled.")
            return
        print("Generating offline sample PDFs instead.")
        _write_offline_demo_reports(output_dir, report_types)
        return

    for report_type in report_types:
        output_path = output_dir / report_file_name(data, report_type)
        output_path.write_bytes(
            generate_application_report_pdf(
                report_type=report_type,
                company_id=DEMO_COMPANY_ID,
                equipment_id=DEMO_EQUIPMENT_ID,
                policy_id=DEMO_POLICY_ID,
                tone="submission",
            )
        )
        print(output_path)


if __name__ == "__main__":
    main()
