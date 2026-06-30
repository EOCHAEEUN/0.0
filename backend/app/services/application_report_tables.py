# -*- coding: utf-8 -*-
from __future__ import annotations

from app.services.application_report_core import *

def generate_application_evidence_report_pdf(ctx: ReportContext) -> bytes:
    return build_application_report_pdf(ctx.data)


def build_application_report_pdf(data: dict) -> bytes:
    regular_font, bold_font = _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=17 * mm,
        bottomMargin=15 * mm,
        title=data["summary"]["policy_title"],
        author="FactoFit",
    )

    base = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleKo", parent=base["Title"], fontName=bold_font, fontSize=20,
        leading=28, textColor=colors.HexColor("#0B1F3A"), spaceAfter=5 * mm,
    )
    eyebrow = ParagraphStyle(
        "EyebrowKo", fontName=regular_font, fontSize=9,
        textColor=colors.HexColor("#47607D"), spaceAfter=2 * mm,
    )
    heading = ParagraphStyle(
        "HeadingKo", fontName=bold_font, fontSize=13, leading=18,
        textColor=colors.HexColor("#0B1F3A"), spaceBefore=5 * mm, spaceAfter=3 * mm,
    )
    subheading = ParagraphStyle(
        "SubheadingKo", fontName=bold_font, fontSize=10, leading=15,
        textColor=colors.HexColor("#294866"), spaceBefore=3 * mm, spaceAfter=1.5 * mm,
    )
    body = ParagraphStyle(
        "BodyKo", fontName=regular_font, fontSize=9.5, leading=16,
        textColor=colors.HexColor("#27364A"),
    )
    small = ParagraphStyle(
        "SmallKo", fontName=regular_font, fontSize=8, leading=12,
        textColor=colors.HexColor("#5E6F82"),
    )
    metric = ParagraphStyle(
        "MetricKo", fontName=bold_font, fontSize=14, leading=18,
        textColor=colors.HexColor("#0B1F3A"), alignment=TA_CENTER,
    )
    right = ParagraphStyle(
        "RightKo", fontName=bold_font, fontSize=10,
        textColor=colors.HexColor("#0B1F3A"), alignment=TA_RIGHT,
    )

    summary = data["summary"]
    company = data["company"]
    equipment = data["equipment"]
    policy = data["policy"]
    matched = data["matched_policy"]
    scenario = data["scenario"]
    breakdown = data["breakdown"]
    benchmark = data["benchmark"]
    analyst_tone = data.get("tone") == "analyst"
    nominal_tone = data.get("tone") == "nominal"

    if nominal_tone:
        review_text = (
            "종합 검토 의견\n"
            f"{summary['company_name']}의 {summary['policy_title']} 지원 대상 조건 연계 가능성이 확인됨. "
            f"'{summary['scenario_label']}' 시나리오 기준 총 "
            f"{_manwon(summary['investment_manwon'])}의 투자 검토가 필요함. "
            "설비 노후도와 비용 절감 가능성이 투자 필요성을 뒷받침함. 최종 판단 전 실제 견적, "
            "지원 비율 및 생산성 개선 효과의 재확인이 요구됨."
        )
        evidence_notice = (
            "FactoFit에 저장된 기업·설비·ROI·정책 추천 데이터를 바탕으로 작성한 분석 초안임. "
            "최종 제출 전 공고 원문, 지원비율, 제출서류 및 실제 견적의 재확인이 필요함."
        )
    elif analyst_tone:
        review_text = (
            "종합 검토 의견\n"
            f"{summary['company_name']}은(는) {summary['policy_title']}의 지원 대상 조건과 "
            f"연계 가능성이 있다. '{summary['scenario_label']}' 시나리오를 기준으로 "
            f"총 {_manwon(summary['investment_manwon'])}의 투자를 검토한다. "
            "설비 노후도와 비용 절감 가능성은 투자 필요성을 뒷받침한다. 다만 최종 판단은 "
            "실제 견적, 지원 비율, 생산성 개선 효과를 재확인한 뒤 내려야 한다."
        )
        evidence_notice = (
            "본 문서는 FactoFit에 저장된 기업·설비·ROI·정책 추천 데이터를 바탕으로 작성한 "
            "분석 초안이다. 최종 제출 전 공고 원문, 지원비율, 제출서류, 실제 견적을 다시 "
            "확인해야 한다."
        )
    else:
        review_text = (
            "종합 검토 의견\n"
            f"{summary['company_name']}은(는) {summary['policy_title']}의 지원 대상 조건과 "
            f"연계 가능성이 있으며, '{summary['scenario_label']}' 시나리오를 기준으로 "
            f"총 {_manwon(summary['investment_manwon'])}의 투자를 검토하고 있습니다. "
            "본 보고서는 신청 타당성과 기대효과를 정량 자료 중심으로 정리한 제출 참고자료입니다."
        )
        evidence_notice = (
            "본 문서는 FactoFit에 저장된 기업·설비·ROI·정책 추천 데이터를 바탕으로 "
            "자동 생성한 신청서 참고 초안입니다. 최종 제출 전 공고 원문, 지원비율, "
            "제출서류 및 실제 견적을 담당자가 반드시 확인해야 합니다."
        )

    story: list[Any] = [
        _paragraph(REPORT_TITLE, eyebrow),
        _paragraph(summary["policy_title"], title),
        _paragraph(
            f"생성일 {datetime.now():%Y.%m.%d} · {summary['tone_label']} · "
            "FactoFit DB 및 ROI 분석 결과 기반",
            small,
        ),
        Spacer(1, 5 * mm),
    ]

    review_box = Table(
        [[
            _paragraph(
                review_text,
                body,
            )
        ]],
        colWidths=[170 * mm],
    )
    review_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EDF3F8")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#9DB2C8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [review_box, Spacer(1, 4 * mm)]

    overview = [
        ["기업명", summary["company_name"], "기업 규모", company.get("company_type") or company.get("company_size") or "-"],
        ["설립연도", company.get("established_year") or "-", "사업장 형태", company.get("workplace_type") or "-"],
        ["업종", summary["industry_display"], "지역", company.get("region") or "-"],
        ["직원 수", f"{company.get('employee_count') or 0:,}명", "연 매출", _manwon(company.get("annual_revenue"))],
    ]
    overview_table = Table(
        [[_paragraph(cell, body) for cell in row] for row in overview],
        colWidths=[28 * mm, 57 * mm, 28 * mm, 57 * mm],
    )
    overview_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F6F7F3")),
        ("FONTNAME", (0, 0), (-1, -1), regular_font),
        ("FONTNAME", (0, 0), (0, -1), bold_font),
        ("FONTNAME", (2, 0), (2, -1), bold_font),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E7EC")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [
        _paragraph("1. 신청기업 개요", heading),
        overview_table,
        Spacer(1, 3 * mm),
        _paragraph(summary["company_overview"], body),
        _paragraph("기업 현황 해석", subheading),
        _paragraph(summary["company_context"], body),
    ]
    if summary.get("application_background"):
        story += [
            _paragraph("신청 배경 및 문제 정의", subheading),
            _paragraph(summary["application_background"], body),
        ]

    revenue_items = [
        ("3년 전 매출", _number(company.get("revenue_3y_ago_manwon")), _manwon(company.get("revenue_3y_ago_manwon"))),
        ("2년 전 매출", _number(company.get("revenue_2y_ago_manwon")), _manwon(company.get("revenue_2y_ago_manwon"))),
        ("최근 연 매출", _number(company.get("annual_revenue")), _manwon(company.get("annual_revenue"))),
    ]
    if sum(1 for _, value, _ in revenue_items if value > 0) >= 2:
        story += [
            Spacer(1, 3 * mm),
            _paragraph("최근 매출 추이", small),
            BarChartFlowable(
                revenue_items,
                regular_font=regular_font,
                bold_font=bold_font,
                bar_color=colors.HexColor("#4F6F9F"),
            ),
        ]

    equipment_rows = [
        ["설비명 / 공정", f"{summary['equipment_name']} / {summary['process']}"],
        ["사용연수", f"{equipment.get('age_years') or 0}년"],
        ["불량률", _percent(equipment.get("defect_rate"))],
        ["연간 생산량", f"{round(_number(equipment.get('production_qty'))):,}개"],
        ["연간 에너지비", _manwon(equipment.get("energy_cost_annual"))],
        ["연간 유지보수비", _manwon(equipment.get("maintenance_cost_annual"))],
        ["업종 평균 비교", f"교체주기 {benchmark.get('avg_replacement_cycle_yr', '-')}년, 평균 불량률 {benchmark.get('avg_defect_rate_pct', '-')}%"],
    ]
    equipment_table = Table(
        [[_paragraph(cell, body) for cell in row] for row in equipment_rows],
        colWidths=[42 * mm, 128 * mm],
    )
    equipment_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E7EC")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F6F7F3")),
        ("FONTNAME", (0, 0), (0, -1), bold_font),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [
        _paragraph("2. 설비 현황 및 사업 필요성", heading),
        equipment_table,
        Spacer(1, 3 * mm),
        ComparisonChartFlowable(
            [
                (
                    "설비 사용연수",
                    _number(equipment.get("age_years")),
                    _number(benchmark.get("avg_replacement_cycle_yr")),
                    f"보유 설비 {equipment.get('age_years') or 0}년",
                    f"업종 평균 {benchmark.get('avg_replacement_cycle_yr') or 0}년",
                ),
                (
                    "설비 불량률",
                    _number(equipment.get("defect_rate")),
                    _number(benchmark.get("avg_defect_rate_pct")),
                    f"보유 설비 {_percent(equipment.get('defect_rate'))}",
                    f"업종 평균 {_percent(benchmark.get('avg_defect_rate_pct'))}",
                ),
            ],
            regular_font=regular_font,
            bold_font=bold_font,
        ),
        Spacer(1, 2 * mm),
        _paragraph(summary["business_necessity"], body),
        _paragraph("추가 진단 의견", subheading),
        _paragraph(summary["diagnostic_interpretation"], body),
    ]

    purpose_table = Table(
        [
            [_paragraph("적용 시나리오", small), _paragraph(summary["scenario_label"], metric)],
            [_paragraph("총 투자금", small), _paragraph(_manwon(summary["investment_manwon"]), metric)],
            [_paragraph("예상 지원금", small), _paragraph(_manwon(summary["subsidy_manwon"]), metric)],
        ],
        colWidths=[56 * mm, 114 * mm],
    )
    purpose_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5DF")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E7EC")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F6F7F3")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    purpose_section: list[Any] = [
        _paragraph("3. 사업 목적 및 추진내용", heading),
        purpose_table,
    ]
    scenario_matches = {
        item.lower()
        for item in _as_list(matched.get("scenario_match"))
    }
    if "c" in scenario_matches:
        scenario_note = ParagraphStyle(
            "ScenarioNoteKo",
            parent=small,
            fontName=regular_font,
            fontSize=8,
            leading=12,
            textColor=colors.HexColor("#7A8591"),
            leftIndent=0,
            rightIndent=0,
            alignment=0,
        )
        purpose_section += [
            Spacer(1, 2 * mm),
            _paragraph(
                "※ C안은 A/B 공통 적합 정책입니다. 별도 C안 ROI 계산은 없으며, "
                "신청서 초안은 기본적으로 A안 ROI 결과를 기준으로 생성됩니다.",
                scenario_note,
            ),
        ]

    purpose_section += [
        Spacer(1, 3 * mm),
        _paragraph(summary["implementation_plan"], body),
        _paragraph("세부 실행 및 관리 방향", subheading),
        _paragraph(summary["execution_detail"], body),
    ]
    story += purpose_section
    if summary.get("scenario_rationale"):
        story += [
            _paragraph("시나리오 선택 및 AI 적용 근거", subheading),
            _paragraph(summary["scenario_rationale"], body),
        ]

    source_labels = {
        "bizinfo": "기업마당(Bizinfo)",
        "kiat": "한국산업기술진흥원(KIAT)",
        "energy_corp": "한국에너지공단",
    }
    policy_source = str(policy.get("source_name") or "출처 미확인")
    policy_source_display = source_labels.get(policy_source.lower(), policy_source)
    policy_url = (
        policy.get("url")
        or policy.get("source_url")
        or policy.get("detail_url")
        or "-"
    )
    policy_evidence = (
        policy.get("eligibility_evidence")
        or policy.get("summary")
        or policy.get("eligibility_text")
        or "원문 근거가 저장되어 있지 않습니다."
    )
    support_scope = (
        policy.get("eligibility_text")
        or policy.get("summary")
        or "지원내용 요약이 저장되어 있지 않습니다."
    )
    policy_evidence_table = Table(
        [
            [
                _paragraph("구분", small),
                _paragraph("추출·확인 내용", small),
            ],
            [
                _paragraph("지원내용 요약", small),
                _paragraph(support_scope, body),
            ],
            [
                _paragraph("정책 원문 발췌", small),
                _paragraph(policy_evidence, body),
            ],
            [
                _paragraph("DB 추출 위치", small),
                _paragraph(
                    "policy.eligibility_text / policy.eligibility_evidence",
                    small,
                ),
            ],
            [
                _paragraph("매칭 판단 근거", small),
                _paragraph(
                    matched.get("reason")
                    or "정책 대상 조건과 기업 정보를 대조한 결과입니다.",
                    body,
                ),
            ],
            [
                _paragraph("매칭 DB 위치", small),
                _paragraph(
                    "matched_policy.match_score / matched_policy.eligible / "
                    "matched_policy.reason",
                    small,
                ),
            ],
            [
                _paragraph("수집 출처", small),
                _paragraph(policy_source_display, body),
            ],
            [
                _paragraph("공고 원문", small),
                _paragraph(policy_url, small),
            ],
            [
                _paragraph("지원 한도", small),
                _paragraph(
                    _manwon(policy.get("max_amount"))
                    if policy.get("max_amount")
                    else "한도 미확인",
                    body,
                ),
            ],
        ],
        colWidths=[34 * mm, 136 * mm],
    )
    policy_evidence_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF4")),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F6F7F3")),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    story += [PageBreak(), _paragraph("4. 지원사업 적합성", heading)]
    eligibility_items = [
        f"업종: {', '.join(summary['industry_codes']) or '-'} / 정책 대상 {', '.join(_as_list(policy.get('industry_codes'))) or '제한 없음'}",
        f"기업 유형: {company.get('company_type') or company.get('company_size') or '-'} / 정책 대상 {', '.join(_as_list(policy.get('eligible_company_types'))) or '제한 없음'}",
        f"지역: {company.get('region') or '-'} / 정책 조건 {policy.get('region') or '제한 없음'}",
        f"추천 적합도: {summary['match_score']:.1f}점 / 적격 판정: {'적격' if matched.get('eligible') else '확인 필요'}",
    ]
    for item in eligibility_items:
        story += [_paragraph(f"· {item}", body), Spacer(1, 1.5 * mm)]
    story += [
        _paragraph("지원내용 및 원문 추출 근거", subheading),
        policy_evidence_table,
        _paragraph("적합성 검토 의견", subheading),
        _paragraph(summary["policy_analysis"], body),
    ]
    if summary.get("policy_utilization_strategy"):
        story += [
            _paragraph("정책 활용 및 예산 구성 전략", subheading),
            _paragraph(summary["policy_utilization_strategy"], body),
            _paragraph("제출자료 준비사항", subheading),
            _paragraph(summary["submission_readiness"], body),
        ]

    metrics = [
        ["연간 에너지 절감", _manwon(breakdown.get("energy_saving_manwon"))],
        ["연간 유지보수 절감", _manwon(breakdown.get("maintenance_saving_manwon"))],
        ["연간 불량비용 절감", _manwon(breakdown.get("defect_saving_manwon"))],
        ["연간 순편익", _manwon(scenario.get("annual_net_benefit_manwon"))],
    ]
    metric_table = Table(
        [
            [
                [_paragraph(label, small), Spacer(1, 2 * mm), _paragraph(value, metric)]
                for label, value in metrics
            ]
        ],
        colWidths=[42.5 * mm] * 4,
    )
    metric_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F6F7F3")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E7EC")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E7EC")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story += [
        _paragraph("5. 기대효과", heading),
        metric_table,
        Spacer(1, 3 * mm),
        BarChartFlowable(
            [
                (
                    "에너지비 절감",
                    _number(breakdown.get("energy_saving_manwon")),
                    _manwon(breakdown.get("energy_saving_manwon")),
                ),
                (
                    "유지보수비 절감",
                    _number(breakdown.get("maintenance_saving_manwon")),
                    _manwon(breakdown.get("maintenance_saving_manwon")),
                ),
                (
                    "불량비용 절감",
                    _number(breakdown.get("defect_saving_manwon")),
                    _manwon(breakdown.get("defect_saving_manwon")),
                ),
            ],
            regular_font=regular_font,
            bold_font=bold_font,
            bar_color=colors.HexColor("#527A68"),
        ),
        Spacer(1, 2 * mm),
        _paragraph(summary["expected_effects"], body),
        _paragraph("성과 측정 및 사후관리", subheading),
        _paragraph(summary["performance_plan"], body),
    ]
    if summary.get("performance_governance"):
        story += [
            _paragraph("성과관리 운영체계", subheading),
            _paragraph(summary["performance_governance"], body),
        ]

    safety_improvement = data.get("safety_improvement") or {}
    safety_items = safety_improvement.get("items") or []
    if safety_items:
        safety_rows = [
            [
                _paragraph("안전개선 관점", small),
                _paragraph("현재 판단", small),
                _paragraph("준비할 자료", small),
                _paragraph("설명/근거", small),
            ]
        ]
        for item in safety_items[:6]:
            evidences = item.get("required_evidences") or []
            evidence_labels = [get_evidence_label(evidence) for evidence in evidences if evidence]
            safety_rows.append(
                [
                    _paragraph(item.get("viewpoint_title") or item.get("viewpoint_key") or "-", body),
                    _paragraph(item.get("current_judgement") or "-", body),
                    _paragraph(", ".join([label for label in evidence_labels if label][:4]) or "-", body),
                    _paragraph(item.get("description") or "-", body),
                ]
            )
        safety_table = Table(
            safety_rows,
            colWidths=[36 * mm, 27 * mm, 43 * mm, 64 * mm],
            repeatRows=1,
        )
        safety_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F7FA")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0B1F3A")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E2EA")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E2EA")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story += [
            _paragraph("안전개선 준비 항목", subheading),
            _paragraph(
                "선택 설비와 투자안 기준으로 생성된 안전개선 준비 항목입니다. 실제 증빙 파일 업로드는 이후 신청서 첨부 단계에서 연결합니다.",
                body,
            ),
            safety_table,
            Spacer(1, 3 * mm),
        ]

    budget = [
        ["총 사업비", _manwon(summary["investment_manwon"])],
        ["정부 지원금", _manwon(summary["subsidy_manwon"])],
        ["자기부담금", _manwon(summary["self_funding_manwon"])],
        ["예상 회수기간", f"{summary['payback_months']:,.1f}개월" if summary["payback_months"] is not None else "-"],
        ["정책 지원 한도", _manwon(policy.get("max_amount")) if policy.get("max_amount") else "-"],
    ]
    budget_table = Table(
        [[_paragraph(label, body), _paragraph(value, right)] for label, value in budget],
        colWidths=[100 * mm, 70 * mm],
    )
    budget_table.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#E2E7EC")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [
        KeepTogether([
            _paragraph("6. 예산계획", heading),
            StackedBudgetFlowable(
                summary["subsidy_manwon"],
                summary["self_funding_manwon"],
                regular_font=regular_font,
                bold_font=bold_font,
            ),
            Spacer(1, 2 * mm),
            budget_table,
            Spacer(1, 3 * mm),
            _paragraph(summary["financial_assessment"], body),
            _paragraph("주요 위험요인 및 확인사항", subheading),
            _paragraph(summary["risk_review"], body),
        ])
    ]
    if summary.get("final_recommendation"):
        conclusion_box = Table(
            [[_paragraph(summary["final_recommendation"], body)]],
            colWidths=[170 * mm],
        )
        conclusion_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EEF4EE")),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#9FB7A5")),
            ("LEFTPADDING", (0, 0), (-1, -1), 11),
            ("RIGHTPADDING", (0, 0), (-1, -1), 11),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ]))
        story += [
            _paragraph("종합 결론", heading),
            conclusion_box,
        ]

    evidence_sources = [
        (
            "company",
            company,
            [
                "company_name",
                "established_year",
                "employee_count",
                "annual_revenue",
                "industry_name",
                "region",
                "company_type",
            ],
            "기업 개요 및 매출 추이",
        ),
        (
            "equipment",
            equipment,
            [
                "name",
                "category",
                "process",
                "age_years",
                "defect_rate",
                "energy_cost_annual",
                "maintenance_cost_annual",
            ],
            "설비 현황 및 사업 필요성",
        ),
        (
            "roi_output",
            data["roi_data"],
            [
                "scenario_a",
                "scenario_b",
                "recommended",
                "ai_recommendation",
                "data_quality",
            ],
            "기대효과 및 회수기간",
        ),
        (
            "matched_policy",
            matched,
            ["match_score", "eligible", "reason", "scenario_match"],
            "정책 적합성 판단",
        ),
        (
            "policy",
            policy,
            [
                "title",
                "eligibility_text",
                "eligibility_evidence",
                "max_amount",
                "industry_codes",
            ],
            "지원 조건 및 정책 원문",
        ),
    ]

    evidence_rows = []
    evidence_chart_items = []
    missing_evidence_items = []
    for source_name, source_data, fields, usage in evidence_sources:
        available_fields = [
            field
            for field in fields
            if source_data.get(field) not in (None, "", [], {})
        ]
        missing_fields = [field for field in fields if field not in available_fields]
        if missing_fields:
            missing_evidence_items.append(
                f"{source_name}: {', '.join(missing_fields)}"
            )
        available_count = len(available_fields)
        evidence_chart_items.append(
            (
                source_name,
                available_count,
                f"{available_count}/{len(fields)}개",
            )
        )
        evidence_rows.append(
            [
                source_name,
                ", ".join(available_fields) or "-",
                usage,
                "반영" if available_count == len(fields) else "일부 반영",
            ]
        )

    evidence_table = Table(
        [
            [
                _paragraph("데이터 출처", small),
                _paragraph("실제 사용 컬럼", small),
                _paragraph("보고서 반영 영역", small),
                _paragraph("상태", small),
            ],
            *[
                [_paragraph(cell, small) for cell in row]
                for row in evidence_rows
            ],
        ],
        colWidths=[25 * mm, 72 * mm, 51 * mm, 22 * mm],
        repeatRows=1,
    )
    evidence_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF4")),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (-1, 1), (-1, -1), colors.HexColor("#476B55")),
    ]))

    calculation_rows = [
        ["총 투자금", "ROI 시나리오 투자금", _manwon(summary["investment_manwon"]), "자동 산출"],
        ["정부 지원금", "정책 지원한도와 투자금 비교", _manwon(summary["subsidy_manwon"]), "자동 산출"],
        ["자기부담금", "총 투자금 - 정부 지원금", _manwon(summary["self_funding_manwon"]), "자동 산출"],
        [
            "예상 회수기간",
            "투자금 ÷ 연간 순편익",
            f"{summary['payback_months']:,.1f}개월"
            if summary["payback_months"] is not None
            else "-",
            "재검토 필요" if (summary["payback_months"] or 0) >= 120 else "자동 산출",
        ],
        ["정책 적합도", "matched_policy.match_score", f"{summary['match_score']:.1f}점", "DB 원본"],
    ]
    calculation_table = Table(
        [
            [
                _paragraph("표시 항목", small),
                _paragraph("산출·추출 기준", small),
                _paragraph("보고서 값", small),
                _paragraph("구분", small),
            ],
            *[
                [_paragraph(cell, small) for cell in row]
                for row in calculation_rows
            ],
        ],
        colWidths=[31 * mm, 72 * mm, 38 * mm, 29 * mm],
        repeatRows=1,
    )
    calculation_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2EFE7")),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDD8CC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (-1, 1), (-1, -1), colors.HexColor("#8B5C34")),
    ]))

    story += [
        Spacer(1, 8 * mm), _paragraph("추출 근거 및 검토 메모", title),
        _paragraph(evidence_notice, body),
        _paragraph("데이터 출처별 활용 현황", heading),
        BarChartFlowable(
            evidence_chart_items,
            regular_font=regular_font,
            bold_font=bold_font,
            bar_color=colors.HexColor("#5F7897"),
        ),
        Spacer(1, 2 * mm),
        evidence_table,
        _paragraph("데이터 충족도 해석", subheading),
        _paragraph(
            "기업, 설비, ROI, 정책 매칭 및 정책 원문 데이터가 보고서의 주요 판단에 반영되어 "
            "있습니다. 출처별 활용 필드 수는 데이터의 존재 여부를 나타내며, 각 수치의 정확성과 "
            "최신성을 보장하는 지표는 아닙니다. 최종 제출 전 원본 증빙과 DB 값을 대조합니다.",
            body,
        ),
        _paragraph("추가 확보가 필요한 데이터", subheading),
        _paragraph(
            "; ".join(missing_evidence_items)
            if missing_evidence_items
            else "현재 보고서 생성에 필요한 주요 데이터가 모두 확인된 상태입니다.",
            body,
        ),
        PageBreak(),
        _paragraph("핵심 수치 산출 근거", heading),
        calculation_table,
        _paragraph("정책 적합성 근거", heading),
        _paragraph(matched.get("reason") or "-", body),
        _paragraph("정책 원문 근거", heading),
        _paragraph(policy.get("eligibility_evidence") or policy.get("summary") or "-", body),
        _paragraph("ROI 판단 근거", heading),
        _paragraph(
            (data["roi_data"].get("ai_recommendation") or {}).get("summary")
            or f"선택된 시나리오: {summary['scenario_label']}", body,
        ),
        _paragraph("데이터 품질", heading),
        _paragraph(
            (data["roi_data"].get("data_quality") or {}).get("message")
            or "저장된 입력값을 기준으로 계산했습니다.", body,
        ),
    ]
    if data.get("tone") == "submission":
        story += [
            _paragraph("근거 종합 해석", heading),
            _paragraph(
                "정책 적합성 근거는 기업의 업종과 규모를 정책 대상 조건에 대조한 결과입니다. "
                "정책 원문 근거는 AI 스마트공장 구축의 지원 범위와 최대 지원 한도를 확인하는 "
                "자료입니다. ROI 판단 근거는 선택 시나리오의 투자비와 절감액을 계산한 결과입니다. "
                "각 근거는 서로 다른 판단 목적을 가지며, 하나의 문장만으로 신청 타당성을 "
                "확정하지 않습니다. 최종 신청서는 정책 자격, 기술 구성, 비용 효과를 함께 입증합니다.",
                body,
            ),
            _paragraph("최종 검증 우선순위", heading),
            _paragraph(
                "첫째, 공고 원문에서 신청 자격과 지원 가능 비목을 확인합니다. "
                "둘째, 공급사 견적서와 설비 사양서에서 투자금과 AI 기능 범위를 확인합니다. "
                "셋째, 에너지 사용량과 유지보수비의 기준기간 자료를 확보합니다. "
                "넷째, 고장 이력과 비가동 시간의 증빙을 확보합니다. "
                "다섯째, 제출 문서와 DB에 기록된 기업명, 설비명, 금액 및 성과지표를 일치시킵니다.",
                body,
            ),
        ]

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont(regular_font, 7)
        canvas.setFillColor(colors.HexColor("#78889A"))
        canvas.drawString(17 * mm, 9 * mm, "FactoFit AI Application Report")
        canvas.drawRightString(A4[0] - 17 * mm, 9 * mm, str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


