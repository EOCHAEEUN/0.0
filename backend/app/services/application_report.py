from __future__ import annotations

import io
import os
import re
from dataclasses import dataclass
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
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.database import get_db


REPORT_TITLE = "AI 신청서 초안 · 고도화 버전"
REPORT_TYPE_CONSUMER_SUMMARY = "consumer_summary"
REPORT_TYPE_APPLICATION_EVIDENCE = "application_evidence"


@dataclass
class ReportContext:
    data: dict[str, Any]
    draft_result: dict[str, Any] | None
    roi_output: dict[str, Any] | None
    matched_policy: dict[str, Any] | None
    company: dict[str, Any] | None
    equipment: dict[str, Any] | None
    policy: dict[str, Any] | None
    safety_viewer_policy: dict[str, Any] | None
    user_safety_files: list[dict[str, Any]]


# PDF 내 모든 문자는 맑은 고딕을 1순위로 사용합니다.
# Windows 배포 환경에서는 C:\Windows\Fonts\malgun.ttf / malgunbd.ttf가 적용되고,
# Linux 서버에서는 동일 폰트를 FACTOFIT_REPORT_FONT / FACTOFIT_REPORT_BOLD_FONT로 지정할 수 있습니다.
# 지정 폰트가 없을 때만 NanumGothic으로 fallback합니다.
DEFAULT_FONT_PATHS = (
    Path(r"C:\Windows\Fonts\malgun.ttf"),
    Path(r"C:\Windows\Fonts\malgunsl.ttf"),
    Path("/usr/share/fonts/truetype/malgun/malgun.ttf"),
    Path("/usr/local/share/fonts/malgun.ttf"),
    Path("/usr/share/fonts/truetype/nanum/NanumGothic.ttf"),
)
DEFAULT_BOLD_FONT_PATHS = (
    Path(r"C:\Windows\Fonts\malgunbd.ttf"),
    Path("/usr/share/fonts/truetype/malgun/malgunbd.ttf"),
    Path("/usr/local/share/fonts/malgunbd.ttf"),
    Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"),
)


# ==============================
# PDF Design Tokens
# ==============================
COLOR_NAVY = colors.HexColor("#0B1F3A")
COLOR_BLUE = colors.HexColor("#1F4E79")
COLOR_BLUE_LIGHT = colors.HexColor("#EDF3F8")
COLOR_BORDER = colors.HexColor("#D7DEE8")
COLOR_TEXT = colors.HexColor("#27364A")
COLOR_MUTED = colors.HexColor("#5E6F82")
COLOR_BG = colors.HexColor("#F7FAFC")
COLOR_CARD_BG = colors.HexColor("#FFFFFF")
COLOR_ORANGE = colors.HexColor("#A85C35")
COLOR_GRAY_BAR = colors.HexColor("#E8EDF1")
PAGE_CONTENT_WIDTH = 170 * mm


def _first(rows: list[dict] | None) -> dict:
    return rows[0] if rows else {}


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _is_empty_policy_snapshot(snapshot: Any) -> bool:
    if not isinstance(snapshot, dict) or not snapshot:
        return True
    if not snapshot.get("snapshot_version"):
        return True
    return False


def _snapshot_policy_rows(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in snapshot.get("policies") or []:
        if not isinstance(item, dict):
            continue
        policy_id = str(item.get("policy_id") or "").strip()
        if not policy_id:
            continue
        rows.append(item)
    return rows


def _snapshot_policy_by_id(
    snapshot: dict[str, Any],
    *,
    requested_policy_id: str | None,
) -> dict[str, Any] | None:
    rows = _snapshot_policy_rows(snapshot)
    if not rows:
        return None

    requested = str(requested_policy_id or "").strip()
    if requested:
        return next(
            (
                row
                for row in rows
                if str(row.get("policy_id") or "").strip() == requested
            ),
            None,
        )

    preferred_id = str(snapshot.get("recommended_policy_id") or "").strip()
    if preferred_id:
        preferred = next(
            (
                row
                for row in rows
                if str(row.get("policy_id") or "").strip() == preferred_id
            ),
            None,
        )
        if preferred:
            return preferred
    return rows[0]


def _matched_policy_from_snapshot(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_id": str(item.get("policy_id") or ""),
        "title": item.get("title") or "선택 지원사업",
        "organization": item.get("organization") or "주관기관 정보 없음",
        "reason": item.get("reason")
        or "분석 시점에 저장된 정책 스냅샷 기준 추천 결과입니다.",
        "scenario_match": item.get("scenario_match"),
        "scenario_label": item.get("scenario_label"),
        "match_score": item.get("match_score"),
        "llm_score": item.get("llm_score"),
        "eligible": item.get("eligible", True),
    }


def _policy_from_snapshot(item: dict[str, Any]) -> dict[str, Any]:
    support_items = item.get("support_items")
    if isinstance(support_items, list):
        support_summary = ", ".join(
            [str(entry).strip() for entry in support_items if str(entry).strip()]
        )
    else:
        support_summary = ""

    return {
        "policy_id": str(item.get("policy_id") or ""),
        "title": item.get("title") or "지원사업명 미확인",
        "organization": item.get("organization"),
        "agency": item.get("organization"),
        "provider": item.get("organization"),
        "max_amount": item.get("max_amount_numeric_manwon")
        or item.get("max_amount_actual"),
        "max_amount_type_ko": item.get("max_amount_type_ko")
        or item.get("max_amount_type")
        or item.get("support_amount_type"),
        "max_amount_type_reason": item.get("max_amount_type_reason"),
        "summary": item.get("summary") or support_summary,
        "eligibility_text": item.get("eligibility_text"),
        "required_documents_json": item.get("required_documents_json") or [],
        "deadline": item.get("deadline"),
        "deadline_display": item.get("deadline_display"),
        "source_url": item.get("url"),
        "url": item.get("url"),
        "source_name": item.get("source_name"),
        "policy_category": item.get("policy_category"),
        "policy_subcategory": item.get("policy_subcategory"),
        "support_items": support_items if isinstance(support_items, list) else [],
    }


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


def _company_revenue_baseline(company: dict[str, Any]) -> float:
    """과거 매출 값이 없을 때 기업 규모 기준 평균 연매출 값을 보정값으로 사용합니다."""
    return _first_number(
        company.get("avg_revenue_3y_manwon"),
        company.get("average_revenue_manwon"),
        company.get("avg_annual_revenue_manwon"),
        company.get("company_size_avg_revenue_manwon"),
        company.get("annual_revenue"),
        default=0,
    )


def _company_revenue_value(company: dict[str, Any], field: str) -> float:
    return _first_number(company.get(field), _company_revenue_baseline(company), default=0)


def _remove_ai_spec_sentence(text: Any) -> str:
    """신청서 초안에서 과도하게 세부적인 AI 사양서 설명 문장을 제거합니다."""
    value = str(text or "")
    patterns = (
        r"\s*설비 사양서에는 데이터 수집 항목, 통신 방식, 이상 징후 탐지 범위, 유지보수 알림 방식 및 기존 공정과의 연계 범위를 구체적으로 명시합니다\.\s*이러한 구성은 단순 장비 구매와 AI 기반 공정개선 사업을 구분하는 핵심 근거입니다\.?,?",
        r"\s*설비 사양서에는 데이터 수집 항목.*?핵심 근거입니다\.?,?",
    )
    for pattern in patterns:
        value = re.sub(pattern, "", value, flags=re.S)
    return value.strip()


def _policy_max_amount_type(policy: dict[str, Any]) -> str:
    return str(
        policy.get("max_amount_type_ko")
        or policy.get("max_amount_type")
        or policy.get("support_amount_type")
        or ""
    ).strip()


def _policy_max_amount_type_reason(policy: dict[str, Any]) -> str:
    """policy.max_amount_type_reason 값을 표 중심 PDF의 예상 지원금 근거로 사용합니다."""
    return str(policy.get("max_amount_type_reason") or "").strip()


def _enrich_policy_max_amount_type_reason_from_db(
    db: Any,
    *,
    policy: dict[str, Any],
    policy_id: str | None,
) -> dict[str, Any]:
    """
    analysis_id 기반 생성 시 policy_snapshot에는 max_amount_type_reason이 없을 수 있습니다.
    표 중심 PDF의 '예상 지원금 > 근거'는 최신 policy 테이블 값을 우선 반영합니다.
    """
    if policy.get("max_amount_type_reason"):
        return policy

    target_policy_id = str(policy.get("policy_id") or policy_id or "").strip()
    if not target_policy_id:
        return policy

    try:
        db_policy = _first(
            db.table("policy")
            .select("max_amount_type_reason")
            .eq("policy_id", target_policy_id)
            .limit(1)
            .execute()
            .data
        )
    except Exception as exc:
        print(f"policy.max_amount_type_reason lookup failed: {exc}")
        db_policy = {}

    reason = str(db_policy.get("max_amount_type_reason") or "").strip()
    if reason:
        policy["max_amount_type_reason"] = reason
    return policy


def _budget_note_by_max_amount_type(policy: dict[str, Any], summary: dict[str, Any]) -> str:
    """표 중심 리포트의 자기부담금 설명을 max_amount_type_ko 기준으로 분기합니다."""
    type_text = _policy_max_amount_type(policy)
    max_amount = policy.get("max_amount")
    investment = _number(summary.get("investment_manwon"))
    subsidy = _number(summary.get("subsidy_manwon"))
    self_funding = _number(summary.get("self_funding_manwon"))
    max_amount_text = _manwon(max_amount) if max_amount else "한도 미확인"

    if not type_text or any(token in type_text for token in ("미확인", "확인 필요", "unknown")):
        return (
            f"지원한도 유형이 명확하지 않아 현재 자기부담금은 {_manwon(self_funding)}으로 표시됩니다. "
            "공고 원문에서 지원비율, 최대 지원한도, 제외 비목을 먼저 확인해야 합니다."
        )
    if any(token in type_text for token in ("비율", "%", "이내", "정률")):
        return (
            f"이 공고는 '{type_text}' 기준으로 지원금이 산정되는 유형입니다. "
            f"현재 예상 지원금은 {_manwon(subsidy)}이며, 최종 자기부담금은 실제 지원비율과 인정 사업비 확정 후 달라집니다."
        )
    if any(token in type_text for token in ("최대", "한도", "상한")):
        return (
            f"이 공고는 '{type_text}' 기준의 한도형 지원으로 해석됩니다. "
            f"정책 지원 한도는 {max_amount_text}이며, 총 사업비 {_manwon(investment)}와 비교해 자기부담금을 재확인해야 합니다."
        )
    if any(token in type_text for token in ("정액", "고정")):
        return (
            f"이 공고는 '{type_text}' 기준의 정액 지원 가능성이 있습니다. "
            f"현재 자기부담금은 {_manwon(self_funding)}이며, 정액 지원금 적용 가능 여부를 공고문과 담당기관에서 확인해야 합니다."
        )
    if any(token in type_text for token in ("없음", "해당없음", "비지원")):
        return (
            f"지원금 유형이 '{type_text}'로 표시되어 현재 기준 자기부담금은 {_manwon(self_funding)}입니다. "
            "실제 지원 가능 비목이 있는지 공고 원문을 재확인해야 합니다."
        )
    return (
        f"DB의 max_amount_type_ko 값은 '{type_text}'입니다. "
        f"현재 예상 지원금 {_manwon(subsidy)}, 자기부담금 {_manwon(self_funding)} 기준으로 표시되며, 실제 지원비율과 지원한도 확인이 필요합니다."
    )


def get_evidence_label(evidence: Any) -> str:
    if isinstance(evidence, str):
        return evidence.strip() or "준비자료 확인 필요"
    if isinstance(evidence, dict):
        return str(
            evidence.get("label")
            or evidence.get("base_label")
            or evidence.get("evidence_label")
            or evidence.get("title")
            or evidence.get("evidence_type")
            or "준비자료 확인 필요"
        ).strip()
    return "준비자료 확인 필요"


def format_manwon(value: Any) -> str:
    return f"{round(_number(value)):,}만원"


def format_score(value: Any) -> str:
    if value is None or value == "":
        return "-"
    return f"{_number(value):,.1f}점"


def format_months(value: Any) -> str:
    if value is None or value == "":
        return "-"
    return f"{_number(value):,.1f}개월"


def format_percent(value: Any) -> str:
    if value is None or value == "":
        return "-"
    return f"{_number(value):,.1f}%"


def _first_number(*values: Any, default: float = 0) -> float:
    for value in values:
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return default




def _sanitize_submission_text(text: Any) -> str:
    """
    PDF 생성이 비단정 표현 검증 때문에 실패하지 않도록 보고서 문장을 정리합니다.
    특히 DB 원문/매칭 사유에 섞여 들어오는 '수 있습니다' 계열 문장을
    제출 참고자료에 맞는 단정형/검토형 문장으로 치환합니다.
    """
    value = "" if text is None else str(text)
    replacements = (
        ("받을 수 있습니다", "받는 방향으로 검토합니다"),
        ("활용할 수 있습니다", "활용 방향으로 검토합니다"),
        ("연계할 수 있습니다", "연계 방향으로 검토합니다"),
        ("사용할 수 있습니다", "사용 방향으로 검토합니다"),
        ("확인할 수 있습니다", "확인합니다"),
        ("구성할 수 있습니다", "구성합니다"),
        ("확보할 수 있습니다", "확보합니다"),
        ("개선할 수 있습니다", "개선합니다"),
        ("지원할 수 있습니다", "지원 방향으로 검토합니다"),
        ("할 수 있습니다", "하는 방향으로 검토합니다"),
        ("수 있습니다", "가능성이 있습니다"),
        ("예상됩니다", "예상합니다"),
        ("추정됩니다", "추정합니다"),
        ("판단됩니다", "판단합니다"),
        ("기대됩니다", "기대합니다"),
        ("바랍니다", "확인합니다"),
        ("고자 합니다", "합니다"),
        ("겠습니다", "합니다"),
    )
    for source, target in replacements:
        value = value.replace(source, target)
    return value


def _sanitize_submission_narratives(narratives: dict[str, str]) -> dict[str, str]:
    return {key: _sanitize_submission_text(value) for key, value in narratives.items()}

def _validate_submission_narratives(narratives: dict[str, str]) -> None:
    """
    과거에는 비단정 표현이 있으면 PDF 생성을 중단했습니다.
    실제 운영에서는 DB 원문/정책 매칭 사유에 '수 있습니다' 같은 표현이 들어올 수 있으므로,
    다운로드 실패를 발생시키지 않고 생성 전 정리 함수에서 보정하는 방식으로 변경합니다.
    """
    return None


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




class RevenueLineChartFlowable(Flowable):
    """최근 3개년 매출 추이를 PDF 내부 벡터 라인 그래프로 표현합니다."""

    def __init__(
        self,
        values: list[tuple[str, float, str]],
        *,
        regular_font: str,
        bold_font: str,
        width: float = 82 * mm,
        height: float = 45 * mm,
    ):
        super().__init__()
        self.values = values
        self.regular_font = regular_font
        self.bold_font = bold_font
        self.width = width
        self.height = height

    def draw(self):
        if not self.values:
            return

        left = 13 * mm
        right = self.width - 6 * mm
        bottom = 10 * mm
        top = self.height - 9 * mm
        nums = [float(v or 0) for _, v, _ in self.values]
        min_v = min(nums)
        max_v = max(nums)
        if max_v == min_v:
            min_v = max(0, min_v * 0.9)
            max_v = max_v * 1.1 if max_v else 1

        self.canv.setFillColor(colors.white)
        self.canv.setStrokeColor(COLOR_BORDER)
        self.canv.roundRect(0, 0, self.width, self.height, 2.5 * mm, fill=True, stroke=True)

        self.canv.setStrokeColor(COLOR_BORDER)
        self.canv.setLineWidth(0.25)
        for i in range(3):
            y = bottom + (top - bottom) * i / 2
            self.canv.line(left, y, right, y)

        points: list[tuple[float, float, str, str]] = []
        for idx, (label, value, display) in enumerate(self.values):
            x = left + (right - left) * idx / max(1, len(self.values) - 1)
            y = bottom + (top - bottom) * (float(value or 0) - min_v) / (max_v - min_v)
            points.append((x, y, label, display))

        self.canv.setStrokeColor(COLOR_BLUE)
        self.canv.setLineWidth(1.4)
        for i in range(len(points) - 1):
            self.canv.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])

        for x, y, label, display in points:
            self.canv.setFillColor(COLOR_BLUE)
            self.canv.circle(x, y, 2.0, fill=True, stroke=False)
            self.canv.setFont(self.bold_font, 6.3)
            self.canv.setFillColor(COLOR_NAVY)
            self.canv.drawCentredString(x, y + 4.5 * mm, display)
            self.canv.setFont(self.regular_font, 6.3)
            self.canv.setFillColor(COLOR_MUTED)
            self.canv.drawCentredString(x, 3 * mm, label)


class HorizontalBarChartFlowable(Flowable):
    """기대효과/비용 구성처럼 항목별 금액을 간결한 가로 막대로 표현합니다."""

    def __init__(
        self,
        items: list[tuple[str, float, str]],
        *,
        regular_font: str,
        bold_font: str,
        width: float = 82 * mm,
        height: float = 45 * mm,
        bar_color: colors.Color = COLOR_BLUE,
    ):
        super().__init__()
        self.items = items
        self.regular_font = regular_font
        self.bold_font = bold_font
        self.width = width
        self.height = height
        self.bar_color = bar_color

    def draw(self):
        if not self.items:
            return

        label_w = 30 * mm
        value_w = 16 * mm
        bar_w = self.width - label_w - value_w - 4 * mm
        max_value = max((float(v or 0) for _, v, _ in self.items), default=1) or 1
        row_h = self.height / max(1, len(self.items))

        for idx, (label, value, display) in enumerate(self.items):
            y = self.height - ((idx + 1) * row_h) + 6 * mm
            self.canv.setFont(self.regular_font, 7)
            self.canv.setFillColor(COLOR_MUTED)
            self.canv.drawString(0, y, label)

            self.canv.setFillColor(COLOR_GRAY_BAR)
            self.canv.roundRect(label_w, y - 1.5 * mm, bar_w, 4.5 * mm, 1.6 * mm, fill=True, stroke=False)

            actual_w = max(1.2 * mm, bar_w * max(0, float(value or 0)) / max_value)
            self.canv.setFillColor(self.bar_color)
            self.canv.roundRect(label_w, y - 1.5 * mm, actual_w, 4.5 * mm, 1.6 * mm, fill=True, stroke=False)

            self.canv.setFont(self.bold_font, 7)
            self.canv.setFillColor(COLOR_NAVY)
            self.canv.drawRightString(self.width, y, display)


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


def _normalize_safety_improvement_for_report(value: Any) -> dict:
    if not isinstance(value, dict):
        return {"source": "none", "items": []}

    items: list[dict] = []
    for raw_item in value.get("items") or []:
        if not isinstance(raw_item, dict):
            continue
        evidences = raw_item.get("required_evidences") or []
        if not isinstance(evidences, list):
            evidences = []
        rules = raw_item.get("matched_rules") or []
        if not isinstance(rules, list):
            rules = []
        normalized_evidences: list[Any] = []
        for evidence in evidences:
            if isinstance(evidence, dict):
                normalized_evidences.append(evidence)
            elif evidence:
                normalized_evidences.append(str(evidence))

        items.append(
            {
                "no": raw_item.get("no"),
                "viewpoint_key": raw_item.get("viewpoint_key") or "",
                "viewpoint_title": raw_item.get("viewpoint_title") or raw_item.get("title") or "",
                "current_judgement": raw_item.get("current_judgement") or raw_item.get("status") or "",
                "description": raw_item.get("description") or raw_item.get("reason") or "",
                "required_evidences": normalized_evidences,
                "matched_rules": [rule for rule in rules if isinstance(rule, dict)],
            }
        )

    return {
        "source": value.get("source") or "draft_result",
        "safety_viewer_policy_id": value.get("safety_viewer_policy_id"),
        "can_run_safety_logic": bool(value.get("can_run_safety_logic")),
        "items": items,
    }


def _load_safety_improvement_fallback(
    db: Any,
    *,
    policy_id: str,
    equipment_id: str,
    analysis_id: str | None = None,
) -> dict:
    """
    PDF 생성 시 draft_result 안에 safety_improvement가 없을 때
    safety_viewer_policy 테이블에서 안전점검/안전개선 Preview를 불러옵니다.

    analysis_id가 있으면 현재 분석 이력에 연결된 Preview를 우선 조회합니다.
    같은 policy_id/equipment_id로 여러 번 분석한 경우 과거 Preview가 섞이는 것을 막기 위함입니다.
    """
    if not policy_id or not equipment_id:
        return {"source": "none", "items": []}

    try:
        query = (
            db.table("safety_viewer_policy")
            .select("*")
            .eq("policy_id", policy_id)
            .eq("equipment_id", equipment_id)
        )
        if analysis_id:
            query = query.eq("analysis_id", analysis_id)

        preview = _first(
            query.order("updated_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
    except Exception as exc:
        print(f"safety_viewer_policy fallback lookup failed: {exc}")
        preview = {}

    if not preview:
        return {"source": "none", "items": []}

    return _normalize_safety_improvement_for_report(
        {
            "source": "safety_viewer_policy",
            "safety_viewer_policy_id": preview.get("id"),
            "can_run_safety_logic": preview.get("can_run_safety_logic"),
            "items": preview.get("safety_preview_items") or [],
        }
    )


def _auto_generate_safety_improvement_for_report(
    *,
    analysis_id: str | None,
    policy_id: str,
    equipment_id: str,
    policy: dict[str, Any],
    equipment: dict[str, Any],
    roi_data: dict[str, Any],
) -> dict:
    """
    safety_viewer_policy에 안전개선 Preview가 아직 없을 때
    PDF 생성 과정에서 safety_preview.create_safety_preview()를 한 번 실행해
    안전점검/안전개선 항목을 자동 생성합니다.

    생성 실패 또는 정책이 안전 로직 대상이 아닌 경우에는 PDF 생성을 막지 않고
    빈 safety_improvement를 반환합니다.
    """
    if not analysis_id or not policy_id or not equipment_id:
        return {"source": "none", "items": []}

    try:
        from app.services.safety_preview import create_safety_preview
    except Exception as exc:
        print(f"safety_preview import failed: {exc}")
        return {"source": "none", "items": []}

    try:
        preview = create_safety_preview(
            analysis_id=str(analysis_id),
            policy_id=str(policy_id),
            equipment_id=str(equipment_id),
            body={
                "policy": policy,
                "equipment": equipment,
                "roi_context": roi_data,
            },
        )
    except Exception as exc:
        print(f"safety preview auto generation failed: {exc}")
        return {"source": "none", "items": []}

    return _normalize_safety_improvement_for_report(
        {
            "source": "safety_viewer_policy_auto_generated",
            "safety_viewer_policy_id": preview.get("id"),
            "can_run_safety_logic": preview.get("can_run_safety_logic"),
            "items": preview.get("safety_preview_items") or [],
        }
    )


def load_application_report_data(
    company_id: str,
    equipment_id: str,
    policy_id: str | None = None,
    *,
    analysis_id: str | None = None,
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

    snapshot_policy: dict[str, Any] | None = None
    if analysis_id:
        roi_output = _first(
            db.table("roi_output")
            .select("*")
            .eq("id", analysis_id)
            .eq("company_id", company_id)
            .eq("equipment_id", equipment_id)
            .limit(1)
            .execute()
            .data
        )
        if not roi_output:
            raise ValueError("분석 이력을 찾을 수 없습니다.")

        snapshot = _as_dict(roi_output.get("policy_snapshot"))
        if _is_empty_policy_snapshot(snapshot):
            raise ValueError("저장된 정책 정보 없음")

        snapshot_policy = _snapshot_policy_by_id(
            snapshot,
            requested_policy_id=policy_id,
        )
        if not snapshot_policy:
            raise ValueError("저장된 정책 정보에서 요청한 정책을 찾을 수 없습니다.")
    else:
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

    if snapshot_policy:
        matched_policy = _matched_policy_from_snapshot(snapshot_policy)
        policy = _policy_from_snapshot(snapshot_policy)
        policy_id = str(snapshot_policy.get("policy_id") or "")
    else:
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

    policy = _enrich_policy_max_amount_type_reason_from_db(
        db,
        policy=policy,
        policy_id=policy_id,
    )

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
    effective_analysis_id = str(roi_output.get("id") or analysis_id or "")
    scenario_key = _scenario_key(matched_policy, roi_data)
    scenario = roi_data.get(scenario_key) or {}
    breakdown = scenario.get("breakdown") or {}
    benchmark = roi_data.get("benchmark") or {}
    draft_sections = _draft_sections(draft.get("draft_content"))

    # 1순위: draft_result.draft_content.safety_improvement에 저장된 안전개선 항목
    safety_improvement = _normalize_safety_improvement_for_report(
        draft_sections.get("safety_improvement")
    )

    # 2순위: safety_viewer_policy에 저장된 안전개선 Preview
    if not safety_improvement.get("items"):
        safety_improvement = _load_safety_improvement_fallback(
            db,
            policy_id=policy_id,
            equipment_id=equipment_id,
            analysis_id=effective_analysis_id or None,
        )

    # 3순위: 저장된 Preview가 없으면 PDF 생성 시점에 자동 생성
    if not safety_improvement.get("items"):
        safety_improvement = _auto_generate_safety_improvement_for_report(
            analysis_id=effective_analysis_id or None,
            policy_id=policy_id,
            equipment_id=equipment_id,
            policy=policy,
            equipment=equipment,
            roi_data=roi_data,
        )

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
            "연결된 구성입니다."
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

        sanitized_narratives = _sanitize_submission_narratives(
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
        company_overview = sanitized_narratives["company_overview"]
        business_necessity = sanitized_narratives["business_necessity"]
        implementation_plan = sanitized_narratives["implementation_plan"]
        expected_effects = sanitized_narratives["expected_effects"]
        financial_assessment = sanitized_narratives["financial_assessment"]
        company_context = sanitized_narratives["company_context"]
        diagnostic_interpretation = sanitized_narratives["diagnostic_interpretation"]
        execution_detail = sanitized_narratives["execution_detail"]
        policy_analysis = sanitized_narratives["policy_analysis"]
        performance_plan = sanitized_narratives["performance_plan"]
        risk_review = sanitized_narratives["risk_review"]
        application_background = sanitized_narratives["application_background"]
        scenario_rationale = sanitized_narratives["scenario_rationale"]
        policy_utilization_strategy = sanitized_narratives["policy_utilization_strategy"]
        submission_readiness = sanitized_narratives["submission_readiness"]
        performance_governance = sanitized_narratives["performance_governance"]
        final_recommendation = sanitized_narratives["final_recommendation"]

        _validate_submission_narratives(sanitized_narratives)

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
        "safety_improvement": safety_improvement,
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

def _load_report_safety_viewer_policy(
    db: Any,
    *,
    data: dict[str, Any],
    analysis_id: str | None = None,
) -> dict[str, Any] | None:
    safety = data.get("safety_improvement") or {}
    safety_viewer_policy_id = safety.get("safety_viewer_policy_id")
    if safety_viewer_policy_id:
        try:
            row = _first(
                db.table("safety_viewer_policy")
                .select("*")
                .eq("id", safety_viewer_policy_id)
                .limit(1)
                .execute()
                .data
            )
            if row:
                return row
        except Exception as exc:
            print(f"safety_viewer_policy lookup by id failed: {exc}")

    summary = data.get("summary") or {}
    policy_id = (
        (data.get("matched_policy") or {}).get("policy_id")
        or (data.get("policy") or {}).get("policy_id")
    )
    equipment_id = (data.get("equipment") or {}).get("equipment_id")
    if not policy_id or not equipment_id:
        return None

    try:
        query = (
            db.table("safety_viewer_policy")
            .select("*")
            .eq("policy_id", policy_id)
            .eq("equipment_id", equipment_id)
        )
        if analysis_id:
            query = query.eq("analysis_id", analysis_id)
        row = _first(query.order("updated_at", desc=True).limit(1).execute().data)
        return row or None
    except Exception as exc:
        print(f"safety_viewer_policy lookup failed: {exc}")
        return None


def _load_report_user_safety_files(
    db: Any,
    *,
    safety_viewer_policy: dict[str, Any] | None,
    data: dict[str, Any],
    analysis_id: str | None = None,
) -> list[dict[str, Any]]:
    try:
        query = db.table("user_safety_files").select("*")
        if safety_viewer_policy and safety_viewer_policy.get("id"):
            query = query.eq("safety_viewer_policy_id", safety_viewer_policy["id"])
        else:
            policy_id = (
                (data.get("matched_policy") or {}).get("policy_id")
                or (data.get("policy") or {}).get("policy_id")
            )
            equipment_id = (data.get("equipment") or {}).get("equipment_id")
            if analysis_id:
                query = query.eq("analysis_id", analysis_id)
            if policy_id:
                query = query.eq("policy_id", policy_id)
            if equipment_id:
                query = query.eq("equipment_id", equipment_id)
        return query.order("uploaded_at", desc=True).execute().data or []
    except Exception as exc:
        print(f"user_safety_files lookup failed: {exc}")
        return []


def build_report_context(
    *,
    analysis_id: str | None = None,
    draft_result_id: str | None = None,
    company_id: str | None = None,
    equipment_id: str | None = None,
    policy_id: str | None = None,
    user_id: str | None = None,
    tone: str = "submission",
) -> ReportContext:
    db = get_db()
    if draft_result_id and (not company_id or not equipment_id):
        draft_row = _first(
            db.table("draft_result")
            .select("*")
            .eq("draft_result_id", draft_result_id)
            .limit(1)
            .execute()
            .data
        )
        company_id = company_id or draft_row.get("company_id")
        equipment_id = equipment_id or draft_row.get("equipment_id")
        policy_id = policy_id or draft_row.get("policy_id")

    if not company_id or not equipment_id:
        raise ValueError("company_id and equipment_id are required for report generation.")

    data = load_application_report_data(
        company_id,
        equipment_id,
        policy_id,
        analysis_id=analysis_id,
        user_id=user_id,
        tone=tone,
    )
    safety_viewer_policy = _load_report_safety_viewer_policy(
        db,
        data=data,
        analysis_id=analysis_id,
    )
    user_safety_files = _load_report_user_safety_files(
        db,
        safety_viewer_policy=safety_viewer_policy,
        data=data,
        analysis_id=analysis_id,
    )
    return ReportContext(
        data=data,
        draft_result=data.get("draft") or None,
        roi_output=data.get("roi_output") or None,
        matched_policy=data.get("matched_policy") or None,
        company=data.get("company") or None,
        equipment=data.get("equipment") or None,
        policy=data.get("policy") or None,
        safety_viewer_policy=safety_viewer_policy,
        user_safety_files=user_safety_files,
    )


def _find_font(paths: tuple[Path, ...]) -> Path:
    env_path = os.getenv("FACTOFIT_REPORT_FONT")
    candidates = ([Path(env_path)] if env_path else []) + list(paths)
    for path in candidates:
        if path.is_file():
            return path
    raise RuntimeError("한글 PDF 폰트를 찾을 수 없습니다.")


def _register_fonts() -> tuple[str, str]:
    # 이름은 내부 등록명이며, 실제 파일은 맑은 고딕을 최우선으로 찾습니다.
    regular_name = "MalgunGothic"
    bold_name = "MalgunGothicBold"
    if regular_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(regular_name, str(_find_font(DEFAULT_FONT_PATHS))))
    if bold_name not in pdfmetrics.getRegisteredFontNames():
        bold_env = os.getenv("FACTOFIT_REPORT_BOLD_FONT")
        bold_paths = ([Path(bold_env)] if bold_env else []) + list(DEFAULT_BOLD_FONT_PATHS)
        pdfmetrics.registerFont(TTFont(bold_name, str(_find_font(tuple(bold_paths)))))
    return regular_name, bold_name


def _paragraph(text: Any, style: ParagraphStyle) -> Paragraph:
    safe = str(text or "-").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(safe.replace("\n", "<br/>"), style)


def _split_text_blocks(text: Any, *, max_chars: int = 260) -> list[str]:
    """긴 신청서 문단을 2~3문장 단위로 나눠 PDF 가독성을 높입니다."""
    raw = str(text or "").strip()
    if not raw:
        return ["-"]

    manual_blocks = [block.strip() for block in re.split(r"\n\s*\n", raw) if block.strip()]
    blocks: list[str] = []
    for manual in manual_blocks:
        sentences = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", manual)
            if sentence.strip()
        ] or [manual]
        current = ""
        for sentence in sentences:
            candidate = f"{current} {sentence}".strip() if current else sentence
            if current and len(candidate) > max_chars:
                blocks.append(current)
                current = sentence
            else:
                current = candidate
        if current:
            blocks.append(current)

    return blocks or [raw]


def _paragraph_blocks(text: Any, style: ParagraphStyle, *, max_chars: int = 260) -> list[Paragraph]:
    return [_paragraph(block, style) for block in _split_text_blocks(text, max_chars=max_chars)]




# ==============================
# PDF Base Helpers
# ==============================
def make_report_table(
    rows: list[list[Any]],
    col_widths: list[float],
    *,
    body_style: ParagraphStyle,
    header_style: ParagraphStyle,
    header: bool = True,
    repeat_rows: int | None = None,
    left_label_columns: tuple[int, ...] = (),
) -> Table:
    """FactoFit 보고서 전용 공통 표 스타일."""
    flow_rows = []
    for r_idx, row in enumerate(rows):
        flow_row = []
        for c_idx, cell in enumerate(row):
            style = header_style if (header and r_idx == 0) or (r_idx > 0 and c_idx in left_label_columns) else body_style
            flow_row.append(_paragraph(cell, style))
        flow_rows.append(flow_row)

    table = Table(
        flow_rows,
        colWidths=[width * mm for width in col_widths],
        repeatRows=(1 if header else 0) if repeat_rows is None else repeat_rows,
    )
    style = [
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_BLUE_LIGHT),
            ("TEXTCOLOR", (0, 0), (-1, 0), COLOR_NAVY),
        ]
    if left_label_columns:
        for col in left_label_columns:
            style.append(("BACKGROUND", (col, 1), (col, -1), COLOR_BG))
    table.setStyle(TableStyle(style))
    return table


def make_card(content: list[Any], width: float, *, padding: float = 7) -> Table:
    """문단, 표, 그래프를 카드처럼 감싸는 공통 컨테이너."""
    card = Table([[content]], colWidths=[width * mm])
    card.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_CARD_BG),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), padding),
        ("BOTTOMPADDING", (0, 0), (-1, -1), padding),
        ("LEFTPADDING", (0, 0), (-1, -1), padding),
        ("RIGHTPADDING", (0, 0), (-1, -1), padding),
    ]))
    return card


def make_kpi_strip(
    items: list[tuple[str, str]],
    *,
    label_style: ParagraphStyle,
    value_style: ParagraphStyle,
    total_width_mm: float = 170,
) -> Table:
    """상단 KPI 요약 카드 스트립."""
    if not items:
        return Table([[]])
    card_w = total_width_mm / len(items)
    cells = []
    for label, value in items:
        inner = Table(
            [[_paragraph(label, label_style)], [_paragraph(value, value_style)]],
            colWidths=[card_w * mm],
        )
        inner.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        cells.append(inner)
    strip = Table([cells], colWidths=[card_w * mm] * len(items))
    strip.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return strip


def make_two_column(left: Any, right: Any, *, left_width: float = 82, right_width: float = 82, gap: float = 6) -> Table:
    layout = Table([[left, right]], colWidths=[left_width * mm, right_width * mm])
    layout.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), gap),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return layout


def to_bullets(text: Any, *, max_items: int = 7) -> str:
    raw = str(text or "").strip()
    if not raw:
        return "-"
    lines = [line.strip("-• ") for line in raw.split("\n") if line.strip()]
    if len(lines) <= 1:
        lines = [p.strip() for p in re.split(r"(?<=[.!?])\s+", raw) if p.strip()]
    return "\n".join(f"- {line}" for line in lines[:max_items])


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


def _breakdown_first_number(breakdown: dict[str, Any], *keys: str) -> float:
    """ROI breakdown 값의 key 이름이 버전별로 달라도 같은 지표로 읽기 위한 헬퍼."""
    return _first_number(*(breakdown.get(key) for key in keys), default=0)


def _energy_saving_value(breakdown: dict[str, Any]) -> float:
    return _breakdown_first_number(
        breakdown,
        "energy_saving_manwon",
        "energy_saving",
        "energy_cost_saving_manwon",
        "energy_cost_saving",
    )


def _maintenance_saving_value(breakdown: dict[str, Any]) -> float:
    return _breakdown_first_number(
        breakdown,
        "maintenance_saving_manwon",
        "maintenance_saving",
        "maintenance_cost_saving_manwon",
        "maintenance_cost_saving",
    )


def _defect_saving_value(breakdown: dict[str, Any]) -> float:
    return _breakdown_first_number(
        breakdown,
        "defect_saving_manwon",
        "defect_saving",
        "defect_reduction_manwon",
        "defect_reduction",
        "defect_cost_saving_manwon",
        "defect_cost_saving",
    )


def _productivity_gain_value(breakdown: dict[str, Any]) -> float:
    return _breakdown_first_number(
        breakdown,
        "productivity_gain_manwon",
        "productivity_gain",
        "productivity_effect_manwon",
        "productivity_effect",
    )


def _format_optional_manwon(value: float, *, empty: str = "별도 산정 없음") -> str:
    return format_manwon(value) if value else empty


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
        [
            _energy_saving_value(breakdown),
            _maintenance_saving_value(breakdown),
            _defect_saving_value(breakdown),
            _productivity_gain_value(breakdown),
        ]
    )


def _consumer_safety_evidence_count(data: dict[str, Any]) -> int:
    """표 중심 리포트에서 안전개선 준비자료 건수를 요약하기 위한 카운터."""
    safety_improvement = data.get("safety_improvement") or {}
    total = 0
    for item in safety_improvement.get("items") or []:
        evidences = item.get("required_evidences") or []
        if evidences:
            total += len(evidences)
        else:
            total += 1
    return total


def _short_join(items: list[str], *, max_items: int = 4, empty: str = "-") -> str:
    values = [str(item).strip() for item in items if str(item).strip()]
    if not values:
        return empty
    shown = values[:max_items]
    suffix = f" 외 {len(values) - max_items}건" if len(values) > max_items else ""
    return ", ".join(shown) + suffix


def _safety_item_has_uploaded_evidence(item: dict[str, Any], user_safety_files: list[dict[str, Any]] | None) -> bool:
    """안전개선 관점별 실제 증빙 보유 여부를 최대한 보수적으로 판단합니다."""
    files = user_safety_files or []
    if not files:
        return False

    viewpoint_key = str(item.get("viewpoint_key") or "").strip().lower()
    viewpoint_title = str(item.get("viewpoint_title") or item.get("title") or "").strip().lower()
    evidence_labels = [get_evidence_label(evidence).lower() for evidence in item.get("required_evidences") or []]

    for file_row in files:
        haystack = " ".join(
            str(file_row.get(key) or "")
            for key in (
                "viewpoint_key",
                "viewpoint_title",
                "evidence_label",
                "evidence_type",
                "document_type",
                "file_name",
                "title",
                "memo",
            )
        ).strip().lower()
        if not haystack:
            continue
        if viewpoint_key and viewpoint_key in haystack:
            return True
        if viewpoint_title and viewpoint_title in haystack:
            return True
        if any(label and label in haystack for label in evidence_labels):
            return True
    return False


def _consumer_safety_rows(
    data: dict[str, Any],
    user_safety_files: list[dict[str, Any]] | None = None,
) -> list[list[str]]:
    """
    표 중심 리포트용 안전관리 요약 표.

    준비자료를 길게 나열하지 않고, 사용자가 요청한 목업처럼
    현재 상태와 증빙 보유 여부를 빠르게 판단할 수 있게 구성합니다.
    """
    rows: list[list[str]] = [["번호", "관점", "현재 상태", "증빙 여부", "설명·근거"]]
    safety_improvement = data.get("safety_improvement") or {}
    safety_items = safety_improvement.get("items") or []

    for index, item in enumerate(safety_items[:3], start=1):
        has_evidence = _safety_item_has_uploaded_evidence(item, user_safety_files)
        rows.append(
            [
                str(index),
                item.get("viewpoint_title") or item.get("viewpoint_key") or "안전개선 관리",
                item.get("current_judgement") or item.get("status") or "개선 필요",
                "보유" if has_evidence else "미보유",
                item.get("description") or item.get("reason") or "안전관리 상태 확인이 필요합니다.",
            ]
        )

    if len(rows) == 1:
        rows.append(
            [
                "1",
                "안전개선 항목",
                "확인 필요",
                "미보유",
                "안전개선 preview가 없거나 생성되지 않아 제출 전 안전관리 자료 확인이 필요합니다.",
            ]
        )
    return rows

def _consumer_evidence_rows(
    data: dict[str, Any],
    *,
    include_safety_details: bool = False,
) -> list[list[str]]:
    rows = [
        ["필수", "공고 원문 및 지원 가능 비목 확인", "지원조건과 지원한도 확인", "공고문 원문 재확인"],
        ["필수", "공급사 견적서 및 설비 사양서", "총 사업비와 지원 가능 비목 입증", "최신 견적서 확보"],
        ["필수", "기존 설비 사진", "교체 필요성 입증", "전/후 사진 정리"],
        ["보완", "고장 이력·비가동 시간·수리 횟수", "사업 필요성 정량화", "최근 1년 기록 정리"],
        ["보완", "전기요금·유지보수비 기준자료", "ROI 산출 근거", "월별 비용자료 확보"],
        ["보완", "공정 흐름도 및 AI 기능 구성도", "도입 범위와 추진내용 설명", "공정도 업데이트"],
    ]

    safety_count = _consumer_safety_evidence_count(data)
    if safety_count and not include_safety_details:
        rows.append(
            [
                "보완",
                f"안전개선 증빙자료 {safety_count}건",
                "안전개선 근거",
                "7. 안전개선 근거 참조",
            ]
        )
        return rows

    if not include_safety_details:
        return rows

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
    evidence_rows = _consumer_evidence_rows(data, include_safety_details=False)
    safety_rows = _consumer_safety_rows(data, ctx.user_safety_files)
    safety_evidence_count = _consumer_safety_evidence_count(data)

    def table(rows: list[list[Any]], widths: list[float], header: bool = True) -> Table:
        return make_report_table(
            rows,
            widths,
            body_style=cell,
            header_style=cell_bold,
            header=header,
        )

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
        [
            "무엇이 부족한가?",
            f"일반 준비자료 {len(evidence_rows)}건"
            + (f" + 안전개선 증빙 {safety_evidence_count}건 확인 필요" if safety_evidence_count else " 확인 필요"),
            "제출 전 증빙 보완",
        ],
    ]
    subsidy_basis = _policy_max_amount_type_reason(policy) or "정책 지원한도 및 시나리오"
    budget_rows = [
        ["항목", "금액/기간", "근거"],
        ["총 사업비", format_manwon(summary.get("investment_manwon")), "ROI 계산 시나리오"],
        ["예상 지원금", format_manwon(summary.get("subsidy_manwon")), subsidy_basis],
        ["자기부담금", format_manwon(summary.get("self_funding_manwon")), "총 사업비 - 예상 지원금"],
        ["연간 순편익", format_manwon(annual_net), "ROI breakdown"],
        ["예상 회수기간", format_months(summary.get("payback_months")), "ROI 계산값"],
    ]
    energy_saving = _energy_saving_value(breakdown)
    maintenance_saving = _maintenance_saving_value(breakdown)
    defect_saving = _defect_saving_value(breakdown)
    productivity_gain = _productivity_gain_value(breakdown)
    benefit_chart_items = [
        ("에너지비", energy_saving, format_manwon(energy_saving)),
        ("유지보수비", maintenance_saving, format_manwon(maintenance_saving)),
        ("불량비용", defect_saving, format_manwon(defect_saving)),
    ]
    if productivity_gain:
        benefit_chart_items.append(("생산성", productivity_gain, format_manwon(productivity_gain)))

    savings_rows = [
        ["절감/개선 항목", "금액", "비고"],
        ["에너지비 절감", format_manwon(energy_saving), "입력 에너지비 기준"],
        ["유지보수비 절감", format_manwon(maintenance_saving), "정비비 기준"],
        ["불량비용 절감", format_manwon(defect_saving), "불량률 기준"],
        ["생산성 개선 효과", _format_optional_manwon(productivity_gain), "생산성 개선값"],
    ]
    evidence_table_rows = [["상태", "항목", "왜 필요한가", "다음 조치"], *evidence_rows[:18]]

    story: list[Any] = [
        _paragraph("FactoFit 표 중심 신청 판단 요약서", title),
        Spacer(1, 4 * mm),
        make_kpi_strip(
            [
                ("신청 판단", judgement),
                ("정책 적합도", format_score(summary.get("match_score"))),
                ("예상 지원금", format_manwon(summary.get("subsidy_manwon"))),
                ("내 부담금", format_manwon(summary.get("self_funding_manwon"))),
                ("회수기간", format_months(summary.get("payback_months"))),
            ],
            label_style=small,
            value_style=metric,
        ),
        _paragraph("1. 핵심 요약", heading),
        table([[boss_rows[0][0], boss_rows[0][1], boss_rows[0][2]]] + [[row[0], to_bullets(row[1]), row[2]] for row in boss_rows[1:]], [42, 91, 37]),
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
            ],
            [35, 135],
        ),
        _paragraph("4. 정책 적합성", heading),
        table(
            [
                ["검토 관점", "내용"],
                ["추천 적합도", f"정책 추천 적합도는 {format_score(summary.get('match_score'))}입니다."],
                ["정책 판단", summary.get("policy_analysis") or "-"],
                ["최종 확인", "공고 원문, 지원 가능 비목, 지원한도, 자부담 조건, 제출서류 확인 이후 신청 가능 여부를 확정합니다."],
            ],
            [35, 135],
        ),
        _paragraph("5. 예산·ROI 판단 - 내 돈 기준", heading),
        make_two_column(
            table(budget_rows, [28, 28, 26]),
            make_card(
                [
                    _paragraph("사업비 구성", cell_bold),
                    StackedBudgetFlowable(
                        _number(summary.get("subsidy_manwon")),
                        _number(summary.get("self_funding_manwon")),
                        regular_font=regular_font,
                        bold_font=bold_font,
                        width=76 * mm,
                    ),
                    _paragraph(_budget_note_by_max_amount_type(policy, summary), body),
                ],
                82,
            ),
            left_width=82,
            right_width=82,
        ),
        Spacer(1, 2 * mm),
        _paragraph("6. 절감/개선 항목 및 기대효과", heading),
        make_two_column(
            table(savings_rows, [31, 23, 28]),
            make_card(
                [
                    _paragraph("연간 순편익 구성", cell_bold),
                    HorizontalBarChartFlowable(
                        benefit_chart_items,
                        regular_font=regular_font,
                        bold_font=bold_font,
                        width=76 * mm,
                    ),
                ],
                82,
            ),
            left_width=82,
            right_width=82,
        ),
        _paragraph("기대효과 및 성과관리", cell_bold),
        table(
            [
                ["구분", "내용"],
                ["기대효과", summary.get("expected_effects") or "-"],
                ["성과관리", summary.get("performance_plan") or "-"],
            ],
            [35, 135],
        ),
        _paragraph("7. 안전개선 근거", heading),
        _paragraph("현재 상태와 증빙 여부 판단", cell_bold),
        _paragraph(
            "각 관점별 현재 상태와 증빙 보유 여부를 가시성 높게 확인할 수 있도록 구성했습니다.",
            body,
        ),
        table(safety_rows, [12, 43, 26, 26, 63]),
        _paragraph("8. 증빙자료·탈락위험 체크", heading),
        table(evidence_table_rows, [21, 52, 58, 39]),
        _paragraph("9. 데이터 보안·신뢰 안내 및 제출 전 확인", heading),
        _paragraph(
            "본 리포트는 저장된 기업·설비·ROI·정책·안전개선 데이터를 기준으로 생성되었습니다. "
            "최종 제출 전 공고 원문, 실제 견적, 지원비율, 제출서류를 반드시 재확인해야 합니다.",
            body,
        ),
    ]
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


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
        textColor=colors.HexColor("#27364A"), spaceAfter=1.2 * mm,
    )
    small = ParagraphStyle(
        "SmallKo", fontName=regular_font, fontSize=8, leading=12,
        textColor=colors.HexColor("#5E6F82"), spaceAfter=0.8 * mm,
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
        _paragraph(summary["policy_title"], title),
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
        *_paragraph_blocks(summary["company_overview"], body),
        _paragraph("기업 현황 해석", subheading),
        *_paragraph_blocks(summary["company_context"], body),
    ]
    if summary.get("application_background"):
        story += [
            _paragraph("신청 배경 및 문제 정의", subheading),
            *_paragraph_blocks(summary["application_background"], body),
        ]

    revenue_3y_value = _company_revenue_value(company, "revenue_3y_ago_manwon")
    revenue_2y_value = _company_revenue_value(company, "revenue_2y_ago_manwon")
    recent_revenue_value = _first_number(company.get("annual_revenue"), _company_revenue_baseline(company), default=0)
    revenue_items = [
        ("3년 전 매출", revenue_3y_value, _manwon(revenue_3y_value)),
        ("2년 전 매출", revenue_2y_value, _manwon(revenue_2y_value)),
        ("최근 연 매출", recent_revenue_value, _manwon(recent_revenue_value)),
    ]
    if sum(1 for _, value, _ in revenue_items if value > 0) >= 2:
        revenue_cards = make_kpi_strip(
            [(label, display) for label, _, display in revenue_items],
            label_style=small,
            value_style=body,
            total_width_mm=82,
        )
        story += [
            Spacer(1, 3 * mm),
            make_card(
                [
                    _paragraph("최근 매출 추이", subheading),
                    revenue_cards,
                    Spacer(1, 2 * mm),
                    _paragraph("연매출 추이 라인 그래프", small),
                    RevenueLineChartFlowable(
                        revenue_items,
                        regular_font=regular_font,
                        bold_font=bold_font,
                        width=82 * mm,
                    ),
                ],
                170,
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
        *_paragraph_blocks(summary["business_necessity"], body),
        _paragraph("추가 진단 의견", subheading),
        *_paragraph_blocks(summary["diagnostic_interpretation"], body),
    ]

    purpose_table = Table(
        [
            [_paragraph("적용 시나리오", small), _paragraph(summary["scenario_label"], metric)],
            [_paragraph("총 투자금", small), _paragraph(_manwon(summary["investment_manwon"]), metric)],
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
        *_paragraph_blocks(summary["implementation_plan"], body),
        _paragraph("세부 실행 및 관리 방향", subheading),
        *_paragraph_blocks(summary["execution_detail"], body),
    ]
    story += purpose_section
    if summary.get("scenario_rationale"):
        story += [
            _paragraph("시나리오 선택 및 AI 적용 근거", subheading),
            *_paragraph_blocks(_remove_ai_spec_sentence(summary["scenario_rationale"]), body),
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

    story += [
        _paragraph("4. 지원내용 및 원문 추출 근거", heading),
        policy_evidence_table,
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
        make_card(
            [
                _paragraph("기대효과 시각화", subheading),
                HorizontalBarChartFlowable(
                    [
                        ("에너지비 절감", _number(breakdown.get("energy_saving_manwon")), _manwon(breakdown.get("energy_saving_manwon"))),
                        ("유지보수비 절감", _number(breakdown.get("maintenance_saving_manwon")), _manwon(breakdown.get("maintenance_saving_manwon"))),
                        ("불량비용 절감", _number(breakdown.get("defect_saving_manwon")), _manwon(breakdown.get("defect_saving_manwon"))),
                    ],
                    regular_font=regular_font,
                    bold_font=bold_font,
                    width=82 * mm,
                    bar_color=COLOR_BLUE,
                ),
            ],
            170,
        ),
        Spacer(1, 2 * mm),
        *_paragraph_blocks(summary["expected_effects"], body),
        _paragraph("성과 측정 및 사후관리", subheading),
        *_paragraph_blocks(summary["performance_plan"], body),
    ]
    if summary.get("performance_governance"):
        story += [
            _paragraph("성과관리 운영체계", subheading),
            *_paragraph_blocks(summary["performance_governance"], body),
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
            _paragraph("6. 안전점검 및 안전개선 기대효과", heading),
            *_paragraph_blocks(
                "선택 설비와 투자안 기준으로 생성된 안전점검·안전개선 항목입니다. 작업자 위험 노출 감소, 설비 운용 안정성 개선, 교체 후 안전관리 체계 구축 관점에서 기대효과와 준비자료를 함께 정리합니다.",
                body,
            ),
            safety_table,
            Spacer(1, 3 * mm),
        ]


    budget_table = Table(
        [
            [_paragraph("항목", small), _paragraph("내용", small)],
            [_paragraph("총 사업비", body), _paragraph(_manwon(summary.get("investment_manwon")), body)],
            [_paragraph("정부 지원금", body), _paragraph(_manwon(summary.get("subsidy_manwon")), body)],
            [_paragraph("자기부담금", body), _paragraph(_manwon(summary.get("self_funding_manwon")), body)],
            [_paragraph("예상 회수기간", body), _paragraph(format_months(summary.get("payback_months")), body)],
            [
                _paragraph("정책 지원 한도", body),
                _paragraph(_manwon(policy.get("max_amount")) if policy.get("max_amount") else "-", body),
            ],
        ],
        colWidths=[48 * mm, 122 * mm],
    )
    budget_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF4")),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F6F7F3")),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTNAME", (0, 1), (0, -1), bold_font),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [
        _paragraph("7. 예산계획", heading),
        StackedBudgetFlowable(
            _number(summary.get("subsidy_manwon")),
            _number(summary.get("self_funding_manwon")),
            regular_font=regular_font,
            bold_font=bold_font,
        ),
        Spacer(1, 2 * mm),
        budget_table,
        *_paragraph_blocks(summary.get("financial_assessment") or _budget_note_by_max_amount_type(policy, summary), body),
    ]
    if summary.get("risk_review"):
        story += [
            _paragraph("주요 위험요인 및 확인사항", subheading),
            *_paragraph_blocks(summary["risk_review"], body),
        ]

    if summary.get("final_recommendation"):
        conclusion_box = Table(
            [[_paragraph("\n".join(_split_text_blocks(summary["final_recommendation"], max_chars=240)), body)]],
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
            _paragraph("8. 종합 결론", heading),
            conclusion_box,
        ]

    # "추출 근거 및 검토 메모" 이하의 내부 검증용 부록은 신청서 초안 PDF에서 제외합니다.

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont(regular_font, 7)
        canvas.setFillColor(colors.HexColor("#78889A"))
        canvas.drawRightString(A4[0] - 17 * mm, 9 * mm, str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


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
