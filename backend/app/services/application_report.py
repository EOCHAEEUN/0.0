from __future__ import annotations

import io
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.database import get_db


REPORT_TITLE = "AI 신청서 초안 · 고도화 버전"
DEFAULT_FONT_PATHS = (
    Path(r"C:\Windows\Fonts\malgun.ttf"),
    Path("/usr/share/fonts/truetype/nanum/NanumGothic.ttf"),
)
DEFAULT_BOLD_FONT_PATHS = (
    Path(r"C:\Windows\Fonts\malgunbd.ttf"),
    Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"),
)


def _first(rows: list[dict] | None) -> dict:
    return rows[0] if rows else {}


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    items = value if isinstance(value, list) else str(value).split(",")
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = str(item).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
    return result


def _number(value: Any, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _manwon(value: Any) -> str:
    return f"{round(_number(value)):,}만원"


def _percent(value: Any) -> str:
    return f"{_number(value):,.1f}%"


def _validate_submission_narratives(narratives: dict[str, str]) -> None:
    banned_patterns = (
        "겠습니다",
        "고자 합니다",
        "바랍니다",
        "할 수 있습니다",
        "수 있습니다",
        "기대됩니다",
        "추정됩니다",
        "판단됩니다",
        "예상됩니다",
    )
    allowed_endings = ("합니다.", "습니다.", "입니다.")

    for field, text in narratives.items():
        matched = next((pattern for pattern in banned_patterns if pattern in text), None)
        if matched:
            raise ValueError(
                f"높임말 보고서의 {field} 문장에 비단정 표현 '{matched}'이 포함되어 있습니다."
            )

        sentences = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", text)
            if sentence.strip()
        ]
        invalid = [
            sentence
            for sentence in sentences
            if sentence.endswith((".", "!", "?"))
            and not sentence.endswith(allowed_endings)
        ]
        if invalid:
            raise ValueError(
                f"높임말 보고서의 {field} 문장이 단정형 종결어미로 끝나지 않습니다: "
                f"{invalid[0]}"
            )


class BarChartFlowable(Flowable):
    def __init__(
        self,
        items: list[tuple[str, float, str]],
        *,
        regular_font: str,
        bold_font: str,
        width: float = 170 * mm,
        bar_color: colors.Color = colors.HexColor("#527A68"),
    ):
        super().__init__()
        self.items = items
        self.regular_font = regular_font
        self.bold_font = bold_font
        self.width = width
        self.height = max(26 * mm, len(items) * 13 * mm)
        self.bar_color = bar_color

    def draw(self):
        if not self.items:
            return
        label_width = 39 * mm
        value_width = 25 * mm
        bar_width = self.width - label_width - value_width
        max_value = max((value for _, value, _ in self.items), default=1) or 1
        row_height = self.height / len(self.items)

        for index, (label, value, display) in enumerate(self.items):
            y = self.height - ((index + 1) * row_height) + 4 * mm
            self.canv.setFillColor(colors.HexColor("#52657A"))
            self.canv.setFont(self.regular_font, 8)
            self.canv.drawString(0, y, label)

            self.canv.setFillColor(colors.HexColor("#E8EDF1"))
            self.canv.roundRect(
                label_width,
                y - 1.5 * mm,
                bar_width,
                4.5 * mm,
                2 * mm,
                fill=True,
                stroke=False,
            )
            actual_width = max(1.5 * mm, bar_width * max(0, value) / max_value)
            self.canv.setFillColor(self.bar_color)
            self.canv.roundRect(
                label_width,
                y - 1.5 * mm,
                actual_width,
                4.5 * mm,
                2 * mm,
                fill=True,
                stroke=False,
            )

            self.canv.setFillColor(colors.HexColor("#0B1F3A"))
            self.canv.setFont(self.bold_font, 8)
            self.canv.drawRightString(self.width, y, display)


class ComparisonChartFlowable(Flowable):
    def __init__(
        self,
        items: list[tuple[str, float, float, str, str]],
        *,
        regular_font: str,
        bold_font: str,
        width: float = 170 * mm,
    ):
        super().__init__()
        self.items = items
        self.regular_font = regular_font
        self.bold_font = bold_font
        self.width = width
        self.height = max(34 * mm, len(items) * 20 * mm)

    def draw(self):
        if not self.items:
            return
        label_width = 38 * mm
        value_width = 27 * mm
        bar_width = self.width - label_width - value_width
        row_height = self.height / len(self.items)

        for index, (label, current, benchmark, current_text, benchmark_text) in enumerate(self.items):
            y = self.height - ((index + 1) * row_height) + 8 * mm
            max_value = max(current, benchmark, 1)

            self.canv.setFillColor(colors.HexColor("#0B1F3A"))
            self.canv.setFont(self.bold_font, 8.5)
            self.canv.drawString(0, y + 3 * mm, label)

            for offset, value, display, color in (
                (0, current, current_text, colors.HexColor("#4F6F9F")),
                (-6 * mm, benchmark, benchmark_text, colors.HexColor("#B6C1CC")),
            ):
                bar_y = y + offset
                self.canv.setFillColor(colors.HexColor("#E8EDF1"))
                self.canv.roundRect(
                    label_width, bar_y, bar_width, 3.5 * mm, 1.6 * mm,
                    fill=True, stroke=False,
                )
                self.canv.setFillColor(color)
                self.canv.roundRect(
                    label_width,
                    bar_y,
                    max(1.5 * mm, bar_width * max(0, value) / max_value),
                    3.5 * mm,
                    1.6 * mm,
                    fill=True,
                    stroke=False,
                )
                self.canv.setFont(self.regular_font, 7.5)
                self.canv.setFillColor(colors.HexColor("#52657A"))
                self.canv.drawRightString(self.width, bar_y + 0.7 * mm, display)


class StackedBudgetFlowable(Flowable):
    def __init__(
        self,
        subsidy: float,
        self_funding: float,
        *,
        regular_font: str,
        bold_font: str,
        width: float = 170 * mm,
    ):
        super().__init__()
        self.subsidy = max(0, subsidy)
        self.self_funding = max(0, self_funding)
        self.regular_font = regular_font
        self.bold_font = bold_font
        self.width = width
        self.height = 27 * mm

    def draw(self):
        total = self.subsidy + self.self_funding
        if total <= 0:
            return
        subsidy_width = self.width * self.subsidy / total
        bar_y = 11 * mm

        self.canv.setFillColor(colors.HexColor("#4F6F9F"))
        self.canv.roundRect(0, bar_y, subsidy_width, 8 * mm, 3 * mm, fill=True, stroke=False)
        self.canv.setFillColor(colors.HexColor("#D8B25C"))
        self.canv.roundRect(
            subsidy_width - 3 * mm,
            bar_y,
            self.width - subsidy_width + 3 * mm,
            8 * mm,
            3 * mm,
            fill=True,
            stroke=False,
        )

        self.canv.setFillColor(colors.HexColor("#52657A"))
        self.canv.setFont(self.regular_font, 8)
        self.canv.drawString(0, 3 * mm, "정부 지원금")
        self.canv.drawRightString(self.width, 3 * mm, "자기부담금")

        self.canv.setFillColor(colors.HexColor("#0B1F3A"))
        self.canv.setFont(self.bold_font, 8.5)
        self.canv.drawString(24 * mm, 3 * mm, _manwon(self.subsidy))
        self.canv.drawRightString(self.width - 24 * mm, 3 * mm, _manwon(self.self_funding))


def _scenario_key(matched_policy: dict, roi_data: dict) -> str:
    matches = {item.lower() for item in _as_list(matched_policy.get("scenario_match"))}
    if "b" in matches and "a" not in matches and "c" not in matches:
        return "scenario_b"
    if str(roi_data.get("recommended") or "").lower() in {"scenario_b", "b"}:
        return "scenario_b"
    return "scenario_a"


def _draft_sections(draft_content: Any) -> dict:
    if not isinstance(draft_content, dict):
        return {}
    nested = draft_content.get("content")
    return nested if isinstance(nested, dict) else draft_content


def load_application_report_data(
    company_id: str,
    equipment_id: str,
    policy_id: str | None = None,
    *,
    user_id: str | None = None,
    tone: str = "submission",
) -> dict:
    if tone not in {"submission", "analyst", "nominal"}:
        raise ValueError("지원하지 않는 보고서 문체입니다.")

    db = get_db()

    company_query = db.table("company").select("*").eq("company_id", company_id)
    if user_id:
        company_query = company_query.eq("user_id", user_id)
    company = _first(company_query.limit(1).execute().data)
    if not company and user_id:
        company = _first(
            db.table("company")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )
    if not company:
        raise ValueError("기업 정보를 찾을 수 없습니다.")
    company_id = str(company.get("company_id") or company_id)

    equipment = _first(
        db.table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .limit(1)
        .execute()
        .data
    )
    if not equipment:
        equipment = _first(
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .limit(1)
            .execute()
            .data
        )
    if not equipment:
        raise ValueError("설비 정보를 찾을 수 없습니다.")
    equipment_id = str(equipment.get("equipment_id") or equipment_id)

    roi_output = _first(
        db.table("roi_output")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not roi_output:
        roi_output = {}

    matched_query = (
        db.table("matched_policy")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
    )
    if policy_id:
        matched_query = matched_query.eq("policy_id", policy_id)
    matched_policy = _first(
        matched_query.order("match_score", desc=True).limit(1).execute().data
    )

    policy_id = str(matched_policy.get("policy_id") or policy_id or "")
    policy = _first(
        db.table("policy").select("*").eq("policy_id", policy_id).limit(1).execute().data
    )
    if not matched_policy:
        matched_policy = {
            "policy_id": policy_id,
            "title": policy.get("title") or "선택 지원사업",
            "organization": (
                policy.get("organization")
                or policy.get("agency")
                or policy.get("provider")
                or "주관기관 정보 없음"
            ),
            "reason": "추천 캐시가 없어 선택한 공고 정보를 기준으로 PDF를 생성합니다.",
            "scenario_match": None,
            "scenario_label": None,
            "match_score": None,
        }
    draft = _first(
        db.table("draft_result")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .eq("policy_id", policy_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )

    roi_data = roi_output.get("roi_data") or {}
    scenario_key = _scenario_key(matched_policy, roi_data)
    scenario = roi_data.get(scenario_key) or {}
    breakdown = scenario.get("breakdown") or {}
    benchmark = roi_data.get("benchmark") or {}
    draft_sections = _draft_sections(draft.get("draft_content"))

    investment = _number(scenario.get("investment_manwon"))
    subsidy = _number(scenario.get("subsidy_manwon"))
    if not subsidy and policy.get("max_amount"):
        subsidy = min(investment, _number(policy.get("max_amount")))
    payback_years = _number(scenario.get("payback_years"))

    company_name = company.get("company_name") or "기업명 미입력"
    equipment_name = equipment.get("name") or "설비명 미입력"
    scenario_label = (
        matched_policy.get("scenario_label")
        or scenario.get("label")
        or ("전체 교체" if scenario_key == "scenario_a" else "부분 개선")
    )
    policy_title = policy.get("title") or matched_policy.get("title") or "지원사업명 미확인"
    industry_codes = _as_list(company.get("industry_code"))
    industry_names = _as_list(company.get("industry_name"))
    industry_display = ", ".join(industry_names or industry_codes) or "-"
    age_years = _number(equipment.get("age_years"))
    average_cycle = _number(benchmark.get("avg_replacement_cycle_yr"))
    defect_rate = _number(equipment.get("defect_rate"))
    average_defect_rate = _number(benchmark.get("avg_defect_rate_pct"))

    if tone == "nominal":
        if average_cycle and age_years > average_cycle:
            age_assessment = (
                f"사용연수가 업종 평균 교체주기 {average_cycle:g}년을 "
                f"{age_years - average_cycle:g}년 초과한 상태임."
            )
        elif average_cycle:
            age_assessment = (
                f"사용연수는 {age_years:g}년으로 업종 평균 교체주기 "
                f"{average_cycle:g}년 이내임. 비용 및 생산성 지표의 병행 검토가 필요함."
            )
        else:
            age_assessment = f"현재 확인된 설비 사용연수는 {age_years:g}년임."

        if average_defect_rate and defect_rate > average_defect_rate:
            defect_assessment = (
                f"불량률은 {_percent(defect_rate)}로 업종 평균 "
                f"{_percent(average_defect_rate)}를 상회함."
            )
        elif average_defect_rate:
            defect_assessment = (
                f"불량률은 {_percent(defect_rate)}로 업종 평균 "
                f"{_percent(average_defect_rate)} 이내에서 관리 중임."
            )
        else:
            defect_assessment = f"현재 입력된 불량률은 {_percent(defect_rate)}임."

        company_overview = (
            f"소재지는 {company.get('region') or '해당 지역'}이며, 기업 규모는 "
            f"{company.get('company_type') or company.get('company_size') or '제조기업'}임. "
            f"주요 업종은 {industry_display}이며, 종업원 수 "
            f"{company.get('employee_count') or 0:,}명, 최근 연 매출 "
            f"{_manwon(company.get('annual_revenue'))}으로 확인됨."
        )
        business_necessity = (
            f"{equipment_name} 설비의 노후도 및 운영비 부담에 대한 개선 필요성이 확인됨. "
            f"{age_assessment} {defect_assessment} 연간 에너지비용 "
            f"{_manwon(equipment.get('energy_cost_annual'))}, 유지보수비 "
            f"{_manwon(equipment.get('maintenance_cost_annual'))}이 발생 중임. "
            "생산 안정성 확보를 위한 설비 개선 및 공정 데이터화의 병행 추진이 필요함."
        )
        implementation_plan = (
            f"{equipment_name}에 '{scenario_label}' 시나리오 적용 예정임. "
            "초기 단계에서 설비 사양 및 견적 확정, 설치 기반 정비를 수행함. "
            "이후 설치 및 시운전을 거쳐 정상 가동 조건을 확보함. "
            "가동 이후 에너지 사용량, 유지보수비, 생산량, 불량률을 지속 측정하여 "
            "성과 관리 체계를 구축할 계획임."
        )
        expected_effects = (
            f"연간 에너지비용 {_manwon(breakdown.get('energy_saving_manwon'))}, "
            f"유지보수비 {_manwon(breakdown.get('maintenance_saving_manwon'))}, "
            f"불량비용 {_manwon(breakdown.get('defect_saving_manwon'))}의 절감이 예상됨. "
            f"연간 순편익은 {_manwon(scenario.get('annual_net_benefit_manwon'))}으로 추정됨. "
            "설비 운영 안정성, 생산 대응력 및 납기 신뢰도 개선 효과가 기대됨."
        )
    elif tone == "analyst":
        if average_cycle and age_years > average_cycle:
            age_assessment = (
                f"사용연수는 업종 평균 교체주기 {average_cycle:g}년을 "
                f"{age_years - average_cycle:g}년 초과했다."
            )
        elif average_cycle:
            age_assessment = (
                f"사용연수는 {age_years:g}년으로 업종 평균 교체주기 "
                f"{average_cycle:g}년 이내다. 다만 비용과 생산성 지표를 함께 볼 필요가 있다."
            )
        else:
            age_assessment = f"현재 확인되는 설비 사용연수는 {age_years:g}년이다."

        if average_defect_rate and defect_rate > average_defect_rate:
            defect_assessment = (
                f"불량률은 {_percent(defect_rate)}로 업종 평균 "
                f"{_percent(average_defect_rate)}를 상회한다."
            )
        elif average_defect_rate:
            defect_assessment = (
                f"불량률은 {_percent(defect_rate)}로 업종 평균 "
                f"{_percent(average_defect_rate)} 이내에서 관리되고 있다."
            )
        else:
            defect_assessment = f"현재 입력된 불량률은 {_percent(defect_rate)}다."

        company_overview = (
            f"동사는 {company.get('region') or '해당 지역'}에 소재한 "
            f"{company.get('company_type') or company.get('company_size') or '제조기업'}이다. "
            f"주력 사업은 {industry_display} 분야이며, 종업원 수는 "
            f"{company.get('employee_count') or 0:,}명, 최근 연 매출은 "
            f"{_manwon(company.get('annual_revenue'))}이다."
        )
        business_necessity = (
            f"설비 교체의 핵심 근거는 노후도와 운영비 부담이다. 동사는 "
            f"{equipment_name} 설비를 운영하고 있으며, {age_assessment} "
            f"{defect_assessment} 연간 에너지비용 "
            f"{_manwon(equipment.get('energy_cost_annual'))}, 유지보수비 "
            f"{_manwon(equipment.get('maintenance_cost_annual'))}도 지속적으로 발생한다. "
            "노후 설비 개선과 공정 데이터화를 동시에 추진해야 할 시점으로 판단한다."
        )
        implementation_plan = (
            f"추진 방향은 명확하다. {equipment_name}에 '{scenario_label}' 시나리오를 적용해 "
            "설비 사양과 견적을 확정하고, 설치와 시운전을 거쳐 정상 가동 조건을 확보한다. "
            "가동 이후에는 에너지 사용량, 유지보수비, 생산량, 불량률을 지속 측정한다. "
            "설비 도입을 일회성 교체로 끝내지 않고 성과 데이터가 축적되는 운영 체계로 "
            "연결하는 것이 본 사업의 핵심이다."
        )
        expected_effects = (
            f"투자 효과는 비용 절감과 생산 안정성 개선으로 요약된다. 연간 에너지비용 "
            f"{_manwon(breakdown.get('energy_saving_manwon'))}, 유지보수비 "
            f"{_manwon(breakdown.get('maintenance_saving_manwon'))}, 불량비용 "
            f"{_manwon(breakdown.get('defect_saving_manwon'))}의 절감이 예상된다. "
            f"연간 순편익은 {_manwon(scenario.get('annual_net_benefit_manwon'))}으로 추정된다. "
            "공정 데이터의 축적까지 고려하면 생산 대응력과 납기 신뢰도 개선으로 이어질 "
            "가능성이 높다."
        )
    else:
        if average_cycle and age_years > average_cycle:
            age_assessment = (
                f"사용연수는 업종 평균 교체주기 {average_cycle:g}년을 "
                f"{age_years - average_cycle:g}년 초과한 상태입니다."
            )
        elif average_cycle:
            age_assessment = (
                f"사용연수는 {age_years:g}년으로 업종 평균 교체주기 "
                f"{average_cycle:g}년 이내입니다. 비용과 생산성 지표의 병행 검토가 필요합니다."
            )
        else:
            age_assessment = f"현재 확인된 설비 사용연수는 {age_years:g}년입니다."

        if average_defect_rate and defect_rate > average_defect_rate:
            defect_assessment = (
                f"불량률은 {_percent(defect_rate)}로 업종 평균 "
                f"{_percent(average_defect_rate)}를 상회하고 있습니다."
            )
        elif average_defect_rate:
            defect_assessment = (
                f"불량률은 {_percent(defect_rate)}로 업종 평균 "
                f"{_percent(average_defect_rate)} 이내에서 관리되고 있습니다."
            )
        else:
            defect_assessment = f"현재 입력된 불량률은 {_percent(defect_rate)}입니다."

        business_necessity = (
            f"귀사는 {industry_display} 분야에서 {equipment_name} 설비를 운영하고 있습니다. "
            f"{age_assessment} {defect_assessment} 또한 연간 에너지비용 "
            f"{_manwon(equipment.get('energy_cost_annual'))}과 유지보수비 "
            f"{_manwon(equipment.get('maintenance_cost_annual'))}이 발생하고 있습니다. "
            "생산 공정의 안정성과 운영비 절감을 위해 설비 개선 투자와 "
            "스마트공장 전환을 연계하여 추진합니다."
        )
        implementation_plan = (
            f"본 사업에서는 {equipment_name}에 '{scenario_label}' 시나리오를 적용합니다. "
            "사업 초기에는 도입 설비의 사양과 견적을 확정하고 설치 기반을 정비합니다. "
            "이후 설비 설치와 시운전을 통해 정상 가동 조건을 확보합니다. "
            "가동 안정화 이후에는 에너지 사용량, 유지보수비, 생산량 및 불량률을 "
            "지속적으로 측정하여 사업 성과를 정량적으로 관리합니다."
        )
        expected_effects = (
            f"ROI 분석 결과상 연간 에너지비용 절감액은 "
            f"{_manwon(breakdown.get('energy_saving_manwon'))}입니다. "
            f"연간 유지보수비 절감액은 {_manwon(breakdown.get('maintenance_saving_manwon'))}이며, "
            f"불량비용 절감액은 {_manwon(breakdown.get('defect_saving_manwon'))}입니다. "
            f"이를 합산한 연간 순편익은 "
            f"{_manwon(scenario.get('annual_net_benefit_manwon'))}입니다. "
            "설비 운영 안정성과 공정 데이터 활용 수준은 향상된 상태입니다. "
            "생산 대응력과 납기 신뢰도 역시 강화된 상태입니다."
        )
        company_overview = (
            f"귀사는 {company.get('region') or '해당 지역'}에 소재한 "
            f"{company.get('company_type') or company.get('company_size') or '제조기업'}으로서, "
            f"{industry_display} 분야의 사업을 영위하고 있습니다. "
            f"현재 종업원 수는 {company.get('employee_count') or 0:,}명이며, "
            f"최근 연 매출은 {_manwon(company.get('annual_revenue'))}입니다."
        )
    payback_months = round(payback_years * 12, 1) if payback_years else None
    if tone == "nominal" and payback_months and payback_months > 120:
        financial_assessment = (
            f"예상 회수기간은 {payback_months:,.1f}개월로 장기임. 실제 견적, 지원 비율 및 "
            "생산성 개선 효과의 재확인이 필요함. 검토 결과에 따른 투자 규모 및 시나리오 "
            "조정이 요구됨."
        )
    elif tone == "nominal" and payback_months:
        financial_assessment = (
            f"예상 회수기간은 {payback_months:,.1f}개월임. 실제 견적 및 지원금 확정 결과에 "
            "따른 최종 투자 타당성 검토가 필요함."
        )
    elif tone == "nominal":
        financial_assessment = (
            "회수기간 산정 정보가 충분하지 않음. 실제 견적 및 지원금 규모 확정 후 "
            "투자 타당성 재검토가 필요함."
        )
    elif tone == "analyst" and payback_months and payback_months > 120:
        financial_assessment = (
            f"예상 회수기간은 {payback_months:,.1f}개월이다. 현재 가정만으로는 투자 회수기간이 "
            "과도하게 길다. 실제 견적과 지원 비율을 재확인하고, 생산성 개선 효과를 보수적으로 "
            "재산정한 뒤 투자 규모를 조정할 필요가 있다."
        )
    elif tone == "analyst" and payback_months:
        financial_assessment = (
            f"예상 회수기간은 {payback_months:,.1f}개월이다. 투자 타당성은 실제 견적과 "
            "지원금 확정 결과에 따라 달라진다. 최종 의사결정 전 주요 가정을 다시 확인해야 한다."
        )
    elif tone == "analyst":
        financial_assessment = (
            "회수기간 산정에 필요한 정보가 충분하지 않다. 실제 견적과 지원금 규모를 확정한 뒤 "
            "투자 타당성을 다시 판단해야 한다."
        )
    elif payback_months and payback_months > 120:
        financial_assessment = (
            f"현재 입력값 기준 예상 회수기간은 {payback_months:,.1f}개월로 장기입니다. "
            "최종 신청 전 실제 견적, 지원 비율 및 생산성 개선 효과의 재확인이 필요합니다. "
            "재확인 결과에 따라 투자 규모와 시나리오를 조정합니다."
        )
    elif payback_months:
        financial_assessment = (
            f"현재 입력값 기준 예상 회수기간은 {payback_months:,.1f}개월입니다. "
            "실제 견적과 지원금 확정 결과를 반영한 최종 투자 타당성 검토가 필요합니다."
        )
    else:
        financial_assessment = (
            "회수기간 산정에 필요한 정보가 부족합니다. 실제 견적과 지원금 규모를 "
            "확정한 이후 투자 타당성을 재검토합니다."
        )

    match_score = _number(matched_policy.get("match_score"))
    if 0 < match_score <= 1:
        match_score *= 100

    annual_operating_cost = (
        _number(equipment.get("energy_cost_annual"))
        + _number(equipment.get("maintenance_cost_annual"))
    )
    annual_net_benefit = _number(scenario.get("annual_net_benefit_manwon"))
    subsidy_rate = (subsidy / investment * 100) if investment else 0
    eligibility_basis = (
        matched_policy.get("reason")
        or "정책 대상 업종, 기업 유형, 지역 조건과 기업 정보를 대조한 결과"
    )
    application_background = ""
    scenario_rationale = ""
    policy_utilization_strategy = ""
    submission_readiness = ""
    performance_governance = ""
    final_recommendation = ""

    if tone == "nominal":
        company_context = (
            f"기업 운영 규모 대비 대상 설비의 역할이 중요함. 연간 생산량 "
            f"{round(_number(equipment.get('production_qty'))):,}개를 담당하는 설비로, "
            "가동 중단 또는 성능 저하 발생 시 생산 일정과 납기 대응에 직접적인 영향이 예상됨. "
            "단순 자산 교체가 아닌 핵심 생산 기반의 안정화 관점에서 접근할 필요가 있음."
        )
        diagnostic_interpretation = (
            f"현재 확인된 에너지비와 유지보수비의 합계는 연간 "
            f"{_manwon(annual_operating_cost)}임. 설비 연식과 불량률만으로 교체 여부를 "
            "단정하기 어려우므로 고장 이력, 비가동 시간, 수리 빈도, 작업자 의존도에 대한 "
            "추가 확인이 필요함. 해당 자료 확보 시 투자 필요성의 객관성 강화가 가능함."
        )
        execution_detail = (
            "추진 단계는 사양 확정, 공급사 비교, 설치 환경 정비, 설비 반입 및 시운전, "
            "성과 검증 순으로 구성함. 기존 생산계획에 미치는 영향을 최소화하도록 교체 일정을 "
            "수립하고, 시운전 완료 전 품질 기준과 안전 조건을 사전 정의할 필요가 있음. "
            "도입 후에는 기존 설비와 동일 기준으로 성과를 비교하도록 기준값 관리가 요구됨."
        )
        policy_analysis = (
            f"정책 추천 적합도는 {match_score:.1f}점이며, {eligibility_basis}에 따라 "
            "사업 연계 가능성이 확인됨. 다만 추천 점수는 신청 자격을 확정하는 값이 아님. "
            "공고일 기준 업종, 기업 규모, 지역, 중복수혜 제한 및 자부담 조건의 최종 확인이 필요함."
        )
        performance_plan = (
            f"예상 연간 순편익은 {_manwon(annual_net_benefit)}임. 성과 검증 항목은 에너지 사용량, "
            "유지보수비, 불량률, 생산량, 비가동 시간으로 구성함. 도입 전 3~6개월 기준값과 "
            "도입 후 월별 실적을 비교하고, 일시적 생산량 변동과 원재료 변화의 영향을 분리할 필요가 있음."
        )
        risk_review = (
            f"예상 지원금 비율은 총 투자금 대비 {subsidy_rate:.1f}%이며, 자기부담금은 "
            f"{_manwon(max(0, investment - subsidy))}임. 지원금 미확정, 실제 견적 상승, "
            "설치 지연, 절감 효과 미달이 주요 위험요인임. 계약 전 견적 유효기간과 사후관리 조건, "
            "성과 미달 시 대응 방안의 명시가 필요함."
        )
    elif tone == "analyst":
        company_context = (
            f"대상 설비는 연간 {round(_number(equipment.get('production_qty'))):,}개의 생산을 "
            "담당한다. 설비의 성능 저하가 생산 일정과 납기 대응에 직접 연결될 수 있다는 의미다. "
            "따라서 이번 투자는 단순한 자산 교체보다 핵심 생산 기반의 안정화라는 관점에서 봐야 한다."
        )
        diagnostic_interpretation = (
            f"에너지비와 유지보수비를 합한 연간 운영비는 {_manwon(annual_operating_cost)}이다. "
            "다만 설비 연식과 불량률만으로 교체를 단정할 수는 없다. 고장 이력, 비가동 시간, "
            "수리 빈도, 작업자 의존도까지 확보해야 투자 필요성을 더 강하게 입증할 수 있다."
        )
        execution_detail = (
            "실행은 사양 확정, 공급사 비교, 설치 환경 정비, 반입과 시운전, 성과 검증의 순서로 "
            "진행한다. 핵심은 교체 과정에서 발생할 생산 공백을 줄이는 것이다. 시운전 전에 품질과 "
            "안전 기준을 확정하고, 도입 전후 성과를 동일한 기준으로 비교할 수 있어야 한다."
        )
        policy_analysis = (
            f"정책 추천 적합도는 {match_score:.1f}점이다. {eligibility_basis}라는 점에서 "
            "사업 연계 가능성은 확인된다. 그러나 추천 점수가 신청 자격을 보장하지는 않는다. "
            "공고일 기준 업종, 기업 규모, 지역, 중복수혜 제한, 자부담 조건을 다시 확인해야 한다."
        )
        performance_plan = (
            f"예상 연간 순편익은 {_manwon(annual_net_benefit)}이다. 성과는 에너지 사용량, "
            "유지보수비, 불량률, 생산량, 비가동 시간으로 측정한다. 도입 전 3~6개월 평균과 "
            "도입 후 월별 실적을 비교하되 생산량과 원재료 조건의 차이를 분리해야 한다."
        )
        risk_review = (
            f"예상 지원금 비율은 {subsidy_rate:.1f}%, 자기부담금은 "
            f"{_manwon(max(0, investment - subsidy))}이다. 지원금 미확정, 견적 상승, 설치 지연, "
            "절감 효과 미달이 주요 변수다. 계약 전 견적 유효기간과 사후관리 조건을 확인하고, "
            "효과가 기대에 미치지 못할 경우의 대응 방안도 마련해야 한다."
        )
    else:
        company_context = (
            f"대상 설비는 연간 {round(_number(equipment.get('production_qty'))):,}개의 생산을 "
            "담당합니다. 설비의 가동 중단이나 성능 저하는 생산 일정과 납기 차질로 "
            "이어지는 핵심 요인입니다. 따라서 본 투자는 단순한 자산 교체가 아니라 핵심 생산 기반을 "
            "안정화하는 투자입니다."
        )
        diagnostic_interpretation = (
            f"현재 확인된 에너지비와 유지보수비의 합계는 연간 "
            f"{_manwon(annual_operating_cost)}입니다. 다만 설비 연식과 불량률만으로 교체 여부를 "
            "확정하기는 어렵습니다. 고장 이력과 비가동 시간, 수리 빈도 및 작업자 의존도에 "
            "대한 추가 확인이 필요합니다. 해당 자료는 투자 필요성을 객관적으로 입증하는 근거입니다."
        )
        execution_detail = (
            "추진 단계는 설비 사양 확정, 공급사 비교, 설치 환경 정비, 설비 반입 및 시운전, "
            "성과 검증 순으로 구성합니다. 기존 생산계획에 미치는 영향을 최소화하는 "
            "교체 일정을 수립합니다. 시운전 이전에 품질 기준과 안전 조건을 확정합니다. "
            "도입 전후의 성과를 동일한 기준으로 비교하도록 기준값을 관리합니다."
        )
        policy_analysis = (
            f"정책 추천 적합도는 {match_score:.1f}점입니다. {eligibility_basis} "
            "해당 매칭 결과를 기준으로 본 지원사업과의 연계 조건을 충족합니다. "
            "아래 원문 발췌는 신청자격이 아니라 "
            "AI 스마트공장 구축 지원 범위와 지원 한도를 설명하는 근거입니다. 추천 점수는 "
            "신청 자격 확정값과 구분되는 참고 지표입니다. 공고일 기준 업종과 기업 규모, "
            "지역, 중복수혜 제한 및 자부담 조건의 최종 확인이 필요합니다."
        )
        performance_plan = (
            f"예상 연간 순편익은 {_manwon(annual_net_benefit)}입니다. 성과 검증 항목은 에너지 "
            "사용량, 유지보수비, 불량률, 생산량 및 비가동 시간으로 구성합니다. 도입 전 3~6개월의 "
            "기준값과 도입 후 월별 실적을 비교합니다. 생산량과 원재료 조건의 변화가 결과에 미치는 "
            "영향을 구분하여 관리합니다."
        )
        risk_review = (
            f"예상 지원금 비율은 총 투자금 대비 {subsidy_rate:.1f}%이며, 자기부담금은 "
            f"{_manwon(max(0, investment - subsidy))}입니다. 지원금 미확정, 실제 견적 상승, "
            "설치 지연 및 절감 효과 미달이 주요 위험요인입니다. 계약 전 견적 유효기간과 "
            "사후관리 조건의 확인이 필요합니다. 성과 미달 상황에 대한 대응 방안을 사전에 마련합니다."
        )
        application_background = (
            f"본 신청의 출발점은 {equipment_name} 설비의 운영 안정성과 생산 데이터 관리 수준을 "
            "동시에 개선하는 데 있습니다. 현재 설비는 연간 생산량 "
            f"{round(_number(equipment.get('production_qty'))):,}개를 담당하며, 에너지비와 "
            f"유지보수비로 연간 {_manwon(annual_operating_cost)}이 발생합니다. "
            "현재 불량률만으로는 긴급 교체 필요성이 충분히 설명되지 않습니다. "
            "따라서 신청서에는 비용 지표와 함께 고장 이력, 비가동 시간, 수리 횟수, "
            "작업자 수기 기록 및 생산 차질 사례를 보완자료로 포함합니다."
        )
        scenario_rationale = (
            f"선택된 '{scenario_label}' 시나리오는 총 투자금 "
            f"{_manwon(investment)}을 기준으로 구성합니다. 해당 시나리오는 설비 개선과 "
            "데이터 수집 체계 구축을 함께 추진한다는 점에서 정책의 AI 스마트공장 지원 방향과 "
            "연결된 구성입니다. 설비 사양서에는 데이터 수집 항목, 통신 방식, 이상 징후 탐지 범위, "
            "유지보수 알림 방식 및 기존 공정과의 연계 범위를 구체적으로 명시합니다. "
            "이러한 구성은 단순 장비 구매와 AI 기반 공정개선 사업을 구분하는 핵심 근거입니다."
        )
        policy_utilization_strategy = (
            f"정책 지원 한도는 {_manwon(policy.get('max_amount')) if policy.get('max_amount') else '미확인 상태입니다.'} "
            f"이며, 현재 시나리오의 예상 지원금은 {_manwon(subsidy)}입니다. "
            "지원금은 설비 구매비만이 아니라 공정 데이터 수집, 시스템 연계, AI 기능 적용, "
            "시운전 및 성과 검증 비용과 연결하여 구성합니다. 세부 예산은 공고문의 지원 가능 "
            "비목과 일치하도록 견적 항목별로 분리합니다. 지원 제외 항목과 부가가치세, "
            "유지관리비의 자부담 여부도 예산서에 명확히 표시합니다."
        )
        submission_readiness = (
            "최종 제출자료는 사업자등록 및 기업 현황 자료, 대상 설비 사양서와 사진, 기존 설비의 "
            "운영·정비 기록, 공급사 비교견적, 공정 흐름도, AI 기능 구성도, 개인정보 및 보안 관리 "
            "방안, 구축 일정표, 성과지표 산정 근거로 구성합니다. 각 자료의 수치와 명칭은 본 보고서의 "
            "기업·설비·ROI 데이터와 동일하게 관리합니다. 공고 원문과 상충하는 항목은 제출 전에 "
            "정책 담당기관의 확인을 거쳐 정정합니다."
        )
        performance_governance = (
            "성과관리는 기준값 확정, 월별 측정, 원인 분석, 개선조치의 순서로 운영합니다. "
            "도입 이전 기간의 에너지 사용량과 유지보수비를 기준선으로 확정합니다. "
            "도입 이후에는 생산량당 에너지 사용량, 월별 고장 건수, 평균 수리시간, 비가동 시간, "
            "불량률을 동일한 주기로 기록합니다. 담당자와 승인자를 분리하고, 수치 변경 이력과 "
            "증빙 파일을 함께 보관합니다. 해당 관리체계는 사업 완료보고와 사후점검의 근거입니다."
        )
        final_recommendation = (
            f"종합적으로 본 사업은 정책 적합도 {match_score:.1f}점과 업종·기업 규모 조건을 "
            "기준으로 신청 검토가 가능한 사업입니다. 다만 예상 회수기간 "
            f"{payback_months:,.1f}개월은 현재 입력값 기준으로 장기입니다. "
            "따라서 신청 전 실제 견적과 지원 비율을 확정하고, AI 기능 도입으로 발생하는 "
            "생산성 개선 효과를 추가 산정합니다. 정량 근거가 보완된 이후 투자 규모와 "
            "자기부담금의 적정성을 최종 확정합니다."
            if payback_months
            else (
                f"종합적으로 본 사업은 정책 적합도 {match_score:.1f}점과 업종·기업 규모 조건을 "
                "기준으로 신청 검토가 가능한 사업입니다. 회수기간 산정에 필요한 실제 견적과 "
                "성과 가정의 확정이 필요합니다. 정량 근거가 보완된 이후 투자 규모와 "
                "자기부담금의 적정성을 최종 확정합니다."
            )
        )

        _validate_submission_narratives(
            {
                "company_overview": company_overview,
                "business_necessity": business_necessity,
                "implementation_plan": implementation_plan,
                "expected_effects": expected_effects,
                "financial_assessment": financial_assessment,
                "company_context": company_context,
                "diagnostic_interpretation": diagnostic_interpretation,
                "execution_detail": execution_detail,
                "policy_analysis": policy_analysis,
                "performance_plan": performance_plan,
                "risk_review": risk_review,
                "application_background": application_background,
                "scenario_rationale": scenario_rationale,
                "policy_utilization_strategy": policy_utilization_strategy,
                "submission_readiness": submission_readiness,
                "performance_governance": performance_governance,
                "final_recommendation": final_recommendation,
            }
        )

    return {
        "generated_at": datetime.now().isoformat(),
        "tone": tone,
        "company": company,
        "equipment": equipment,
        "policy": policy,
        "matched_policy": matched_policy,
        "roi_output": roi_output,
        "roi_data": roi_data,
        "scenario_key": scenario_key,
        "scenario": scenario,
        "scenario_label": scenario_label,
        "breakdown": breakdown,
        "benchmark": benchmark,
        "draft": draft,
        "summary": {
            "company_name": company_name,
            "equipment_name": equipment_name,
            "policy_title": policy_title,
            "industry_display": industry_display,
            "industry_codes": industry_codes,
            "process": equipment.get("process") or equipment.get("category") or "-",
            "scenario_label": scenario_label,
            "investment_manwon": investment,
            "subsidy_manwon": subsidy,
            "self_funding_manwon": max(0, investment - subsidy),
            "payback_months": payback_months,
            "match_score": match_score,
            "company_overview": company_overview,
            "business_necessity": business_necessity,
            "implementation_plan": implementation_plan,
            "expected_effects": expected_effects,
            "financial_assessment": financial_assessment,
            "company_context": company_context,
            "diagnostic_interpretation": diagnostic_interpretation,
            "execution_detail": execution_detail,
            "policy_analysis": policy_analysis,
            "performance_plan": performance_plan,
            "risk_review": risk_review,
            "application_background": application_background,
            "scenario_rationale": scenario_rationale,
            "policy_utilization_strategy": policy_utilization_strategy,
            "submission_readiness": submission_readiness,
            "performance_governance": performance_governance,
            "final_recommendation": final_recommendation,
            "tone_label": {
                "analyst": "평서문 종결체",
                "nominal": "명사형 종결체",
                "submission": "높임말 종결체",
            }[tone],
        },
    }


def _find_font(paths: tuple[Path, ...]) -> Path:
    env_path = os.getenv("FACTOFIT_REPORT_FONT")
    candidates = ([Path(env_path)] if env_path else []) + list(paths)
    for path in candidates:
        if path.is_file():
            return path
    raise RuntimeError("한글 PDF 폰트를 찾을 수 없습니다.")


def _register_fonts() -> tuple[str, str]:
    regular_name = "FactoFitGothic"
    bold_name = "FactoFitGothicBold"
    if regular_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(regular_name, str(_find_font(DEFAULT_FONT_PATHS))))
    if bold_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(
            TTFont(bold_name, str(_find_font(DEFAULT_BOLD_FONT_PATHS)))
        )
    return regular_name, bold_name


def _paragraph(text: Any, style: ParagraphStyle) -> Paragraph:
    safe = str(text or "-").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(safe.replace("\n", "<br/>"), style)


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


def report_file_name(data: dict) -> str:
    company = str(data["summary"]["company_name"]).replace(" ", "_")
    equipment = str(data["summary"]["equipment_name"]).replace(" ", "_")
    tone_suffix = {
        "analyst": "평서문종결체",
        "nominal": "명사형종결체",
        "submission": "높임말종결체",
    }.get(data.get("tone"), "높임말종결체")
    return f"factofit_{company}_{equipment}_{tone_suffix}_{datetime.now():%Y%m%d}.pdf"
