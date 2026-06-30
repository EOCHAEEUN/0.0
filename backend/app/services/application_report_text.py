# -*- coding: utf-8 -*-
from __future__ import annotations

from app.services.application_report_core import *

def _consumer_judgement(summary: dict[str, Any], safety_items: list[dict[str, Any]]) -> str:
    match_score = _number(summary.get("match_score"))
    payback_months = summary.get("payback_months")
    self_funding = _number(summary.get("self_funding_manwon"))
    required_count = sum(len(item.get("required_evidences") or []) for item in safety_items)

    if match_score and match_score < 55:
        return "신청 전 조건 재확인 필요"
    if payback_months is not None and _number(payback_months) >= 72:
        return "투자규모 재검토 필요"
    if self_funding >= 50000:
        return "투자규모 재검토 필요"
    if required_count:
        return "보완 후 신청 권장"
    return "신청 검토 가능"


def _annual_net_benefit(scenario: dict[str, Any], breakdown: dict[str, Any]) -> float:
    direct = _first_number(
        scenario.get("annual_net_benefit_manwon"),
        scenario.get("annual_savings_manwon"),
        scenario.get("annual_effect_manwon"),
        scenario.get("net_benefit_manwon"),
        default=0,
    )
    if direct:
        return direct
    return sum(
        _first_number(
            breakdown.get(key),
            breakdown.get(f"{key}_manwon"),
            default=0,
        )
        for key in [
            "energy_saving",
            "maintenance_saving",
            "defect_reduction",
            "productivity_gain",
        ]
    )


def _consumer_evidence_rows(data: dict[str, Any]) -> list[list[str]]:
    rows = [
        ["필수", "공고 원문 및 지원 가능 비목 확인", "지원조건과 지원한도 확인", "공고문 원문 재확인"],
        ["필수", "공급사 견적서 및 설비 사양서", "총 사업비와 지원 가능 비목 입증", "최신 견적서 확보"],
        ["필수", "기존 설비 사진", "교체 필요성 입증", "전/후 사진 정리"],
        ["보완", "고장 이력·비가동 시간·수리 횟수", "사업 필요성 정량화", "최근 1년 기록 정리"],
        ["보완", "전기요금·유지보수비 기준자료", "ROI 산출 근거", "월별 비용자료 확보"],
        ["보완", "공정 흐름도 및 AI 기능 구성도", "도입 범위와 추진내용 설명", "공정도 업데이트"],
    ]
    safety_improvement = data.get("safety_improvement") or {}
    for item in safety_improvement.get("items") or []:
        evidences = item.get("required_evidences") or []
        if not evidences:
            rows.append([
                "보완",
                item.get("viewpoint_title") or item.get("viewpoint_key") or "안전개선 준비자료",
                item.get("description") or "안전개선 필요성 입증",
                "관련 사진 또는 확인자료 확보",
            ])
            continue
        for evidence in evidences:
            rows.append([
                "보완",
                get_evidence_label(evidence),
                item.get("description") or "안전개선 필요성 입증",
                "점검표, 사진 또는 관리자 확인자료 확보",
            ])
    return rows


def generate_consumer_summary_report_pdf(ctx: ReportContext) -> bytes:
    data = ctx.data
    regular_font, bold_font = _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=13 * mm,
        title="consumer_summary_report",
        author="FactoFit",
    )

    base = getSampleStyleSheet()
    title = ParagraphStyle("ConsumerTitle", parent=base["Title"], fontName=bold_font, fontSize=18, leading=24)
    heading = ParagraphStyle("ConsumerHeading", fontName=bold_font, fontSize=12, leading=17, spaceBefore=5 * mm, spaceAfter=2 * mm)
    body = ParagraphStyle("ConsumerBody", fontName=regular_font, fontSize=8.8, leading=13)
    small = ParagraphStyle("ConsumerSmall", fontName=regular_font, fontSize=7.8, leading=11, textColor=colors.HexColor("#516070"))
    cell = ParagraphStyle("ConsumerCell", fontName=regular_font, fontSize=8.2, leading=11)
    cell_bold = ParagraphStyle("ConsumerCellBold", fontName=bold_font, fontSize=8.4, leading=11)

    summary = data.get("summary") or {}
    company = data.get("company") or {}
    equipment = data.get("equipment") or {}
    policy = data.get("policy") or {}
    scenario = data.get("scenario") or {}
    breakdown = data.get("breakdown") or {}
    safety_items = (data.get("safety_improvement") or {}).get("items") or []

    judgement = _consumer_judgement(summary, safety_items)
    annual_net = _annual_net_benefit(scenario, breakdown)
    evidence_rows = _consumer_evidence_rows(data)

    def table(rows: list[list[Any]], widths: list[float], header: bool = True) -> Table:
        flow_rows = [[_paragraph(value, cell_bold if header and r == 0 else cell) for value in row] for r, row in enumerate(rows)]
        t = Table(flow_rows, colWidths=[width * mm for width in widths], repeatRows=1 if header else 0)
        style = [
            ("BOX", (0, 0), (-1, -1), 0.45, colors.HexColor("#D7DEE8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D7DEE8")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]
        if header:
            style.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EDF3F8")))
        t.setStyle(TableStyle(style))
        return t

    metric_rows = [
        ["신청 판단", "정책 적합도", "예상 지원금", "내 부담금", "회수기간"],
        [
            judgement,
            format_score(summary.get("match_score")),
            format_manwon(summary.get("subsidy_manwon")),
            format_manwon(summary.get("self_funding_manwon")),
            format_months(summary.get("payback_months")),
        ],
    ]
    boss_rows = [
        ["사장님 질문", "현재 답변", "판단"],
        ["우리 회사가 받을 수 있나?", summary.get("policy_analysis") or summary.get("industry_display") or "-", judgement],
        ["내 돈은 얼마 들어가나?", format_manwon(summary.get("self_funding_manwon")), "지원금 차감 후 자기부담금 기준"],
        ["왜 지금 해야 하나?", summary.get("business_necessity") or "-", "설비 노후·비용·품질 지표 기준"],
        ["무엇이 부족한가?", f"준비자료 {len(evidence_rows)}건 확인 필요", "제출 전 증빙 보완"],
    ]
    budget_rows = [
        ["항목", "금액/기간", "근거"],
        ["총 사업비", format_manwon(summary.get("investment_manwon")), "ROI 계산 시나리오"],
        ["예상 지원금", format_manwon(summary.get("subsidy_manwon")), "정책 지원한도 및 시나리오"],
        ["자기부담금", format_manwon(summary.get("self_funding_manwon")), "총 사업비 - 예상 지원금"],
        ["연간 순편익", format_manwon(annual_net), "ROI breakdown"],
        ["예상 회수기간", format_months(summary.get("payback_months")), "ROI 계산값"],
    ]
    savings_rows = [
        ["절감/개선 항목", "금액", "비고"],
        ["에너지비 절감", format_manwon(_first_number(breakdown.get("energy_saving"), breakdown.get("energy_saving_manwon"))), "입력 에너지비 기준"],
        ["유지보수비 절감", format_manwon(_first_number(breakdown.get("maintenance_saving"), breakdown.get("maintenance_saving_manwon"))), "정비비 기준"],
        ["불량비용 절감", format_manwon(_first_number(breakdown.get("defect_reduction"), breakdown.get("defect_reduction_manwon"))), "불량률 기준"],
        ["생산성 개선 효과", format_manwon(_first_number(breakdown.get("productivity_gain"), breakdown.get("productivity_gain_manwon"))), "생산성 개선값"],
    ]
    evidence_table_rows = [["상태", "항목", "왜 필요한가", "다음 조치"], *evidence_rows[:18]]

    story: list[Any] = [
        _paragraph("표 중심 리포트 - 사장님용 1분 판단", title),
        _paragraph(f"생성일 {datetime.now():%Y.%m.%d} · FactoFit DB/ROI 계산값 기준", small),
        Spacer(1, 4 * mm),
        table(metric_rows, [35, 35, 35, 35, 35]),
        _paragraph("1. 핵심 요약", heading),
        table(boss_rows, [42, 91, 37]),
        _paragraph("2. 신청기업 및 설비 현황", heading),
        table(
            [
                ["구분", "내용", "구분", "내용"],
                ["기업명", summary.get("company_name") or company.get("company_name") or "-", "지역", company.get("region") or "-"],
                ["업종", summary.get("industry_display") or "-", "직원 수", f"{company.get('employee_count') or 0:,}명"],
                ["설비명", summary.get("equipment_name") or equipment.get("name") or "-", "사용연수", f"{equipment.get('age_years') or 0}년"],
            ],
            [25, 60, 25, 60],
        ),
        _paragraph("3. 사업 목적 및 추진내용", heading),
        table(
            [
                ["항목", "내용"],
                ["사업 목적", summary.get("implementation_plan") or summary.get("business_necessity") or "-"],
                ["지원사업", summary.get("policy_title") or policy.get("title") or "-"],
                ["정책 적합성", summary.get("policy_analysis") or "-"],
            ],
            [35, 135],
        ),
        _paragraph("4. 예산·ROI 판단 - 내 돈 기준", heading),
        table(budget_rows, [45, 42, 83]),
        Spacer(1, 2 * mm),
        table(savings_rows, [55, 40, 75]),
        _paragraph("5. 기대효과 및 성과관리", heading),
        table(
            [
                ["구분", "내용"],
                ["기대효과", summary.get("expected_effects") or "-"],
                ["성과관리", summary.get("performance_plan") or "-"],
            ],
            [35, 135],
        ),
        _paragraph("6. 증빙자료·탈락위험 체크", heading),
        table(evidence_table_rows, [21, 52, 58, 39]),
        _paragraph("7. 데이터 보안·신뢰 안내 및 제출 전 확인", heading),
        _paragraph(
            "본 리포트는 저장된 기업·설비·ROI·정책·안전개선 데이터를 기준으로 생성되었습니다. "
            "최종 제출 전 공고 원문, 실제 견적, 지원비율, 제출서류를 반드시 재확인해야 합니다.",
            body,
        ),
    ]
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


