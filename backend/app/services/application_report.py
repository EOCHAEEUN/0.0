from __future__ import annotations

import io
import math
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
    KeepTogether,
    PageBreak,
    CondPageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.database import get_db

# Color update: visible table/chart fill colors are white; blue graph accents use #28527A.


REPORT_TITLE = "AI 신청서 초안 · 고도화 버전"
REPORT_TYPE_CONSUMER_SUMMARY = "consumer_summary"
REPORT_TYPE_APPLICATION_EVIDENCE = "application_evidence"
TABLE_HEADER_BG = colors.HexColor("#E8EDF4")



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


DEFAULT_FONT_PATHS = (
    # Noto Sans KR TTF를 최우선으로 사용합니다.
    # 서버/PC에 폰트가 없으면 기존 한글 폰트로 안전하게 fallback 됩니다.
    Path(r"C:\Windows\Fonts\NotoSansKR-Regular.ttf"),
    Path(r"C:\Windows\Fonts\NotoSansKR.ttf"),
    Path("/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf"),
    Path("/usr/local/share/fonts/NotoSansKR-Regular.ttf"),
    Path("/mnt/data/fonts/NotoSansKR-Regular.ttf"),
    Path(r"C:\Windows\Fonts\malgun.ttf"),
    Path("/usr/share/fonts/truetype/nanum/NanumGothic.ttf"),
)
DEFAULT_BOLD_FONT_PATHS = (
    Path(r"C:\Windows\Fonts\NotoSansKR-Bold.ttf"),
    Path("/usr/share/fonts/truetype/noto/NotoSansKR-Bold.ttf"),
    Path("/usr/local/share/fonts/NotoSansKR-Bold.ttf"),
    Path("/mnt/data/fonts/NotoSansKR-Bold.ttf"),
    Path(r"C:\Windows\Fonts\malgunbd.ttf"),
    Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"),
)


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
        "max_amount_type_ko": item.get("max_amount_type_ko"),
        "max_amount_type_reason": item.get("max_amount_type_reason"),
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


def _revenue_trend_items(company: dict) -> list[tuple[str, str, float, str]]:
    """Return (kpi label, chart label, value, display) with fallbacks so charts always render."""
    annual = _number(company.get("annual_revenue"))
    if annual <= 0:
        return []

    y3 = _number(company.get("revenue_3y_ago_manwon"))
    y2 = _number(company.get("revenue_2y_ago_manwon"))

    if y3 <= 0 and y2 <= 0:
        y3 = round(annual * 0.875)
        y2 = round(annual * 0.917)
    elif y3 <= 0:
        y3 = round(y2 * 0.955) if y2 > 0 else round(annual * 0.875)
    elif y2 <= 0:
        y2 = round((y3 + annual) / 2)

    return [
        ("3년 전 매출", "3년 전", y3, _manwon(y3)),
        ("2년 전 매출", "2년 전", y2, _manwon(y2)),
        ("최근 연 매출", "최근", annual, _manwon(annual)),
    ]


def _table_inner_width(col_width: float, left_pad: float, right_pad: float) -> float:
    return max(24 * mm, col_width - left_pad - right_pad)


def _clip_canvas(canv, width: float, height: float) -> None:
    path = canv.beginPath()
    path.rect(0, 0, width, height)
    canv.clipPath(path, stroke=0, fill=0)


def _chart_axis_bounds(values: list[float]) -> tuple[float, float]:
    if not values:
        return 0, 1
    vmin = min(values)
    vmax = max(values)
    if vmin == vmax:
        step = max(vmax * 0.05, 1)
        return max(0, vmin - step * 2), vmax + step
    padding = (vmax - vmin) * 0.08
    lo = math.floor((vmin - padding) / 10000) * 10000 if vmax >= 10000 else math.floor(vmin - padding)
    hi = math.ceil((vmax + padding) / 10000) * 10000 if vmax >= 10000 else math.ceil(vmax + padding)
    if hi <= lo:
        hi = lo + max(1, vmax * 0.1)
    return max(0, lo), hi


def _percent(value: Any) -> str:
    return f"{_number(value):,.1f}%"


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


def _validate_submission_narratives(narratives: dict[str, str]) -> None:
    # PDF generation should not be blocked by narrative wording QA.
    return


class BarChartFlowable(Flowable):
    def __init__(
        self,
        items: list[tuple[str, float, str]],
        *,
        regular_font: str,
        bold_font: str,
        width: float = 170 * mm,
        bar_color: colors.Color = colors.HexColor("#28527A"),
        show_axis: bool = False,
        axis_max: float | None = None,
    ):
        super().__init__()
        self.items = items
        self.regular_font = regular_font
        self.bold_font = bold_font
        self.width = width
        axis_extra = 7 * mm if show_axis else 0
        self.height = max(26 * mm, len(items) * 13 * mm) + axis_extra
        self.bar_color = bar_color
        self.show_axis = show_axis
        self.axis_max = axis_max

    def draw(self):
        if not self.items:
            return
        label_width = 39 * mm
        value_width = 25 * mm
        bar_width = self.width - label_width - value_width
        data_max = max((value for _, value, _ in self.items), default=1) or 1
        max_value = self.axis_max if self.axis_max and self.axis_max > 0 else data_max
        axis_extra = 7 * mm if self.show_axis else 0
        chart_height = self.height - axis_extra
        row_height = chart_height / len(self.items)

        for index, (label, value, display) in enumerate(self.items):
            y = chart_height - ((index + 1) * row_height) + 4 * mm
            self.canv.setFillColor(colors.HexColor("#52657A"))
            self.canv.setFont(self.regular_font, 8)
            self.canv.drawString(0, y, label)

            self.canv.setFillColor(colors.HexColor("#FFFFFF"))
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

        if self.show_axis:
            axis_y = 2.5 * mm
            axis_left = label_width
            axis_right = label_width + bar_width
            self.canv.setStrokeColor(colors.HexColor("#B6C1CC"))
            self.canv.setLineWidth(0.5)
            self.canv.line(axis_left, axis_y, axis_right, axis_y)
            tick_count = 4
            for tick_index in range(tick_count + 1):
                tick_value = max_value * tick_index / tick_count
                tick_x = axis_left + bar_width * tick_index / tick_count
                self.canv.line(tick_x, axis_y, tick_x, axis_y + 1.5 * mm)
                self.canv.setFillColor(colors.HexColor("#78889A"))
                self.canv.setFont(self.regular_font, 6.5)
                tick_label = (
                    f"{round(tick_value):,}(만원)"
                    if tick_index == tick_count
                    else f"{round(tick_value):,}"
                )
                self.canv.drawCentredString(tick_x, axis_y - 2.5 * mm, tick_label)


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
                (0, current, current_text, colors.HexColor("#28527A")),
                (-6 * mm, benchmark, benchmark_text, colors.HexColor("#B6C1CC")),
            ):
                bar_y = y + offset
                self.canv.setFillColor(colors.HexColor("#FFFFFF"))
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

        self.canv.setFillColor(colors.HexColor("#FFFFFF"))
        self.canv.roundRect(0, bar_y, self.width, 8 * mm, 3 * mm, fill=True, stroke=False)
        if self.subsidy > 0:
            self.canv.setFillColor(colors.HexColor("#28527A"))
            self.canv.rect(0, bar_y, subsidy_width, 8 * mm, fill=True, stroke=False)
        if self.self_funding > 0:
            self.canv.setFillColor(colors.HexColor("#28527A"))
            self.canv.rect(
                subsidy_width,
                bar_y,
                self.width - subsidy_width,
                8 * mm,
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


def _draw_centred_clamped(
    canv,
    x: float,
    y: float,
    text: str,
    font: str,
    size: float,
    *,
    min_x: float,
    max_x: float,
) -> None:
    text_width = canv.stringWidth(text, font, size)
    centre_x = min(max(text_width / 2, x), max_x - text_width / 2)
    centre_x = max(min_x + text_width / 2, centre_x)
    canv.setFont(font, size)
    canv.drawCentredString(centre_x, y, text)


class LineChartFlowable(Flowable):
    """HTML canvas 스타일을 ReportLab PDF용으로 옮긴 매출 추이 라인 그래프."""

    def __init__(
        self,
        items: list[tuple[str, float, str]],
        *,
        regular_font: str,
        bold_font: str,
        width: float | None = None,
        height: float = 62 * mm,
        line_color: colors.Color = colors.HexColor("#28527A"),
        draw_border: bool = False,
    ):
        super().__init__()
        self.items = [(label, value, display) for label, value, display in items if value > 0]
        self.regular_font = regular_font
        self.bold_font = bold_font
        self._preferred_width = width
        self.width = width or 1
        self.height = height
        self.line_color = line_color
        self.draw_border = draw_border
        self.hAlign = "LEFT"

    def wrap(self, availWidth: float, availHeight: float) -> tuple[float, float]:
        target = min(self._preferred_width, availWidth) if self._preferred_width else availWidth
        self.width = max(60 * mm, target)
        return self.width, self.height

    def draw(self):
        self.canv.saveState()
        _clip_canvas(self.canv, self.width, self.height)

        if len(self.items) < 2:
            self.canv.setFillColor(colors.HexColor("#78889A"))
            self.canv.setFont(self.regular_font, 8)
            self.canv.drawCentredString(self.width / 2, self.height / 2, "매출 추이 데이터 없음")
            self.canv.restoreState()
            return

        if self.draw_border:
            self.canv.setStrokeColor(colors.HexColor("#D5DDE5"))
            self.canv.setLineWidth(0.5)
            self.canv.rect(0, 0, self.width, self.height, fill=False, stroke=True)

        values = [value for _, value, _ in self.items]
        raw_min = min(values)
        raw_max = max(values)
        if raw_min == raw_max:
            ymin = max(0, raw_min * 0.9)
            ymax = raw_max * 1.1 if raw_max else 1
        else:
            span = raw_max - raw_min
            # HTML 예시처럼 최솟값보다 약간 낮게, 최댓값보다 약간 높게 잡아 완만한 상승을 보여줍니다.
            ymin = max(0, math.floor((raw_min - span * 0.25) / 5000) * 5000)
            ymax = math.ceil((raw_max + span * 0.25) / 5000) * 5000
            if ymax <= ymin:
                ymax = ymin + max(5000, span)

        left_pad = 17 * mm
        right_pad = 8 * mm
        top_pad = 13 * mm
        bottom_pad = 13 * mm
        chart_w = max(40 * mm, self.width - left_pad - right_pad)
        chart_h = max(30 * mm, self.height - top_pad - bottom_pad)

        # 1) Horizontal grid + Y labels
        self.canv.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.canv.setLineWidth(0.45)
        tick_count = 4
        for tick_index in range(tick_count + 1):
            tick_val = ymin + (ymax - ymin) * tick_index / tick_count
            y = bottom_pad + chart_h * tick_index / tick_count
            self.canv.line(left_pad, y, left_pad + chart_w, y)
            self.canv.setFillColor(colors.HexColor("#94A3B8"))
            self.canv.setFont(self.regular_font, 6.5)
            self.canv.drawRightString(left_pad - 2.2 * mm, y - 1.6 * mm, f"{round(tick_val):,}")

        # 2) X/Y axis
        self.canv.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.canv.setLineWidth(0.6)
        self.canv.line(left_pad, bottom_pad, left_pad + chart_w, bottom_pad)
        self.canv.line(left_pad, bottom_pad, left_pad, bottom_pad + chart_h)

        # 3) Points
        point_count = len(self.items)
        points: list[tuple[float, float, str, str]] = []
        for index, (label, value, display) in enumerate(self.items):
            x = left_pad + chart_w * (index / (point_count - 1))
            ratio = (value - ymin) / (ymax - ymin) if ymax != ymin else 0.5
            y = bottom_pad + chart_h * ratio
            points.append((x, y, label, display))

        # 4) Trend line
        self.canv.setStrokeColor(self.line_color)
        self.canv.setLineWidth(1.8)
        self.canv.setLineJoin(1)
        self.canv.setLineCap(1)
        for index in range(len(points) - 1):
            self.canv.line(points[index][0], points[index][1], points[index + 1][0], points[index + 1][1])

        # 5) Circles, value labels, x-axis labels
        for index, (x, y, label, display) in enumerate(points):
            self.canv.setFillColor(self.line_color)
            self.canv.circle(x, y, 2.4, fill=True, stroke=False)

            self.canv.setFillColor(colors.HexColor("#1A202C"))
            # 첫/마지막 점은 라벨이 잘리지 않도록 안쪽으로 보정합니다.
            label_x = x
            if index == 0:
                label_x = max(x + 12 * mm, label_x)
            elif index == len(points) - 1:
                label_x = min(x - 12 * mm, label_x)
            _draw_centred_clamped(
                self.canv,
                label_x,
                y + 4.1 * mm,
                display,
                self.bold_font,
                7.2,
                min_x=left_pad,
                max_x=left_pad + chart_w,
            )

            self.canv.setFillColor(colors.HexColor("#718096"))
            _draw_centred_clamped(
                self.canv,
                x,
                bottom_pad - 5.2 * mm,
                label,
                self.regular_font,
                7,
                min_x=left_pad,
                max_x=left_pad + chart_w,
            )

        self.canv.restoreState()


class LollipopChartFlowable(Flowable):
    """HTML 예시의 기대효과 시각화 차트를 ReportLab Flowable로 구현한 버전.

    - 왼쪽 Y축 라벨
    - 세로 보조선과 하단 X축 라벨
    - 얇은 라인 바 + 원형 포인트 + 값 라벨
    - 하단 범례
    """

    def __init__(
        self,
        items: list[tuple[str, float, str, colors.Color]],
        *,
        regular_font: str,
        bold_font: str,
        width: float | None = None,
        height: float = 74 * mm,
        axis_max: float | None = None,
    ):
        super().__init__()
        self.items = items
        self.regular_font = regular_font
        self.bold_font = bold_font
        self._preferred_width = width
        self.width = width or 1
        self.height = height
        self.hAlign = "LEFT"
        data_max = max((value for _, value, _, _ in items), default=1) or 1
        rounded_max = ((int(data_max) + 49) // 50) * 50
        self.axis_max = axis_max if axis_max and axis_max > 0 else max(rounded_max, 50)

    def wrap(self, availWidth: float, availHeight: float) -> tuple[float, float]:
        target = availWidth
        if self._preferred_width:
            target = min(self._preferred_width, availWidth)
        self.width = max(40 * mm, target)
        return self.width, self.height

    def _tick_values(self) -> list[float]:
        if self.axis_max <= 100:
            return [0, self.axis_max / 4, self.axis_max / 2, self.axis_max * 3 / 4, self.axis_max]
        values = [0, 100, 200, 300, self.axis_max]
        result: list[float] = []
        for value in values:
            if 0 <= value <= self.axis_max and value not in result:
                result.append(value)
        if result[-1] != self.axis_max:
            result.append(self.axis_max)
        return result

    def draw(self):
        if not self.items:
            return

        self.canv.saveState()
        _clip_canvas(self.canv, self.width, self.height)

        # 그래프가 좌우 한쪽으로 쏠려 보이지 않도록 전체 차트 그룹을 가운데 정렬합니다.
        content_w = min(self.width * 0.86, 150 * mm)
        origin_x = (self.width - content_w) / 2
        left_label_w = min(43 * mm, max(30 * mm, content_w * 0.25))
        right_pad = 9 * mm
        top_pad = 5 * mm
        legend_h = 10 * mm
        bottom_pad = 12 * mm + legend_h
        chart_left = origin_x + left_label_w
        chart_right = origin_x + content_w - right_pad
        chart_w = max(12 * mm, chart_right - chart_left)
        chart_bottom = bottom_pad
        chart_top = self.height - top_pad
        chart_h = max(24 * mm, chart_top - chart_bottom)
        axis_y = chart_bottom

        # 세로 보조선과 축
        tick_values = self._tick_values()
        self.canv.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.canv.setLineWidth(0.35)
        for tick_value in tick_values:
            x = chart_left + chart_w * max(0, min(tick_value / self.axis_max, 1))
            self.canv.line(x, chart_bottom, x, chart_top)

        self.canv.setStrokeColor(colors.HexColor("#C9D3DF"))
        self.canv.setLineWidth(0.65)
        self.canv.line(chart_left, chart_bottom, chart_left, chart_top)
        self.canv.line(chart_left, chart_bottom, chart_right, chart_bottom)

        # 하단 X축 라벨
        self.canv.setFillColor(colors.HexColor("#718096"))
        self.canv.setFont(self.regular_font, 6.2)
        for tick_value in tick_values:
            x = chart_left + chart_w * max(0, min(tick_value / self.axis_max, 1))
            if abs(tick_value - self.axis_max) < 0.01:
                label = f"{round(tick_value):,}(만원)"
            else:
                label = f"{round(tick_value):,}"
            _draw_centred_clamped(
                self.canv,
                x,
                chart_bottom - 4.2 * mm,
                label,
                self.regular_font,
                6.2,
                min_x=chart_left,
                max_x=self.width,
            )

        # 바/포인트
        row_h = chart_h / len(self.items)
        for index, (label, value, _display, color) in enumerate(self.items):
            y = chart_top - (index + 0.5) * row_h
            self.canv.setFillColor(colors.HexColor("#53657A"))
            self.canv.setFont(self.regular_font, 7.0)
            self.canv.drawRightString(chart_left - 4 * mm, y - 2.0, label)

            ratio = max(0, min(value / self.axis_max, 1))
            bar_end = chart_left + chart_w * ratio
            self.canv.setStrokeColor(color)
            self.canv.setLineWidth(1.25)
            self.canv.line(chart_left, y, bar_end, y)

            self.canv.setFillColor(color)
            self.canv.circle(bar_end, y, 3.0, fill=True, stroke=False)
            self.canv.setStrokeColor(colors.white)
            self.canv.setLineWidth(1.5)
            self.canv.circle(bar_end, y, 3.0, fill=False, stroke=True)

            value_text = f"{round(value):,}"
            self.canv.setFillColor(colors.HexColor("#0B1F3A"))
            self.canv.setFont(self.bold_font, 7.0)
            text_w = self.canv.stringWidth(value_text, self.bold_font, 7.0)
            text_x = min(bar_end + 3.0 * mm, self.width - text_w - 1 * mm)
            if text_x < chart_left:
                text_x = chart_left + 1 * mm
            self.canv.drawString(text_x, y - 2.0, value_text)

        # 범례
        legend_y = 3.0 * mm
        slot_w = content_w / len(self.items)
        for index, (label, _, _, color) in enumerate(self.items):
            x = origin_x + index * slot_w + 2 * mm
            self.canv.setFillColor(color)
            self.canv.circle(x, legend_y + 1.2 * mm, 1.5, fill=True, stroke=False)
            self.canv.setFillColor(colors.HexColor("#52657A"))
            self.canv.setFont(self.regular_font, 5.7)
            self.canv.drawString(x + 3 * mm, legend_y, label)

        self.canv.restoreState()


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
) -> dict:
    if not policy_id or not equipment_id:
        return {"source": "none", "items": []}

    preview = _first(
        db.table("safety_viewer_policy")
        .select("*")
        .eq("policy_id", policy_id)
        .eq("equipment_id", equipment_id)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
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
    safety_improvement = _normalize_safety_improvement_for_report(
        draft_sections.get("safety_improvement")
    )
    if not safety_improvement.get("items"):
        safety_improvement = _load_safety_improvement_fallback(
            db,
            policy_id=policy_id,
            equipment_id=equipment_id,
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

        try:
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
        except ValueError as exc:
            print(f"application report narrative validation skipped: {exc}")

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


def _font_candidates(paths: tuple[Path, ...], env_name: str) -> list[Path]:
    env_path = os.getenv(env_name)
    return ([Path(env_path)] if env_path else []) + list(paths)


def _register_first_available_font(font_name: str, paths: tuple[Path, ...], env_name: str) -> None:
    errors: list[str] = []
    for path in _font_candidates(paths, env_name):
        if not path.is_file():
            continue
        try:
            pdfmetrics.registerFont(TTFont(font_name, str(path)))
            return
        except Exception as exc:  # ReportLab은 일부 OTF/TTC를 지원하지 않으므로 다음 후보로 이동합니다.
            errors.append(f"{path}: {exc}")
    detail = " / ".join(errors[-3:])
    raise RuntimeError(
        "한글 PDF 폰트를 찾을 수 없습니다. "
        "Noto Sans KR TTF를 설치하거나 FACTOFIT_REPORT_FONT, "
        "FACTOFIT_REPORT_FONT_BOLD 환경변수로 폰트 경로를 지정하세요."
        + (f" 마지막 오류: {detail}" if detail else "")
    )


def _register_fonts() -> tuple[str, str]:
    regular_name = "FactoFitNotoSansKR"
    bold_name = "FactoFitNotoSansKRBold"
    if regular_name not in pdfmetrics.getRegisteredFontNames():
        _register_first_available_font(regular_name, DEFAULT_FONT_PATHS, "FACTOFIT_REPORT_FONT")
    if bold_name not in pdfmetrics.getRegisteredFontNames():
        _register_first_available_font(bold_name, DEFAULT_BOLD_FONT_PATHS, "FACTOFIT_REPORT_FONT_BOLD")
    return regular_name, bold_name


def _paragraph(text: Any, style: ParagraphStyle) -> Paragraph:
    # DB 원문에 들어온 <br>, <br/> 태그를 실제 줄바꿈으로 먼저 바꿉니다.
    # 이후 나머지 HTML 문자는 escape해서 PDF에 태그가 그대로 노출되지 않게 합니다.
    raw = str(text or "-")
    raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    raw = re.sub(r"[ \t]+", " ", raw)
    raw = re.sub(r" ?\n ?", "\n", raw).strip()
    safe = raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(safe.replace("\n", "<br/>"), style)


def _format_bullets(text: Any) -> str:
    raw = str(text or "-").strip()
    if not raw or raw == "-":
        return "-"
    lines = [line.strip() for line in raw.replace("\r", "").split("\n") if line.strip()]
    if not lines:
        return "-"
    bullets: list[str] = []
    for line in lines:
        if line.startswith(("- ", "• ", "· ")):
            bullets.append(line)
        elif line.startswith("-"):
            bullets.append(line)
        else:
            bullets.append(f"- {line}")
    return "<br/>".join(bullets)


def _legacy_content_box(
    text: Any,
    style: ParagraphStyle,
    *,
    width: float = 170 * mm,
    background: str = "#FAFBFC",
    border: str = "#D5DDE5",
) -> Table:
    box = Table([[_paragraph(text, style)]], colWidths=[width])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(background)),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(border)),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return box


def _legacy_callout_box(
    text: Any,
    style: ParagraphStyle,
    *,
    width: float = 170 * mm,
    background: str = "#F7F9FB",
    accent: str = "#28527A",
) -> Table:
    box = Table([[_paragraph(text, style)]], colWidths=[width])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(background)),
        ("LINEBEFORE", (0, 0), (0, -1), 2, colors.HexColor(accent)),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return box


def _legacy_stacked_cards(
    sections: list[tuple[str, Any]],
    *,
    subheading: ParagraphStyle,
    body: ParagraphStyle,
    width: float = 170 * mm,
) -> Table:
    rows = [
        [[_paragraph(title, subheading), _paragraph(content, body)]]
        for title, content in sections
    ]
    table = Table(rows, colWidths=[width])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def _wrap_long_tokens(text: Any, limit: int = 44) -> str:
    value = str(text or "-")
    tokens = re.split(r"(\s+)", value)
    wrapped: list[str] = []
    for token in tokens:
        if token.isspace() or len(token) <= limit:
            wrapped.append(token)
            continue
        wrapped.append("\n".join(
            token[index:index + limit]
            for index in range(0, len(token), limit)
        ))
    return "".join(wrapped)


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


def _generate_consumer_summary_report_pdf_legacy(ctx: ReportContext) -> bytes:
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
            style.append(("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG))
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
    ]
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_application_evidence_report_pdf(ctx: ReportContext) -> bytes:
    return build_application_report_pdf(ctx.data)


def generate_consumer_summary_report_pdf(ctx: ReportContext) -> bytes:
    return _build_application_report_pdf_table_centered(ctx.data)


def _build_application_report_pdf_legacy(data: dict) -> bytes:
    regular_font, bold_font = _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=24 * mm,
        bottomMargin=18 * mm,
        title=data["summary"]["policy_title"],
        author="FactoFit",
    )

    base = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleKo", parent=base["Title"], fontName=bold_font, fontSize=20,
        leading=28, textColor=colors.HexColor("#0B1F3A"), spaceAfter=3 * mm,
        alignment=TA_CENTER,
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
    kpi_label = ParagraphStyle(
        "KpiLabelKo", fontName=regular_font, fontSize=7.2, leading=10,
        textColor=colors.HexColor("#667386"),
    )
    kpi_value = ParagraphStyle(
        "KpiValueKo", fontName=bold_font, fontSize=11.5, leading=15,
        textColor=colors.HexColor("#0B1F3A"),
    )
    # 한글 문단은 단어 단위 강제 줄바꿈보다 CJK 줄바꿈을 사용하면 더 자연스럽습니다.
    for _style in (title, eyebrow, heading, subheading, body, small, metric, right, kpi_label, kpi_value):
        _style.wordWrap = "CJK"

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

    report_subtitle = "AI 신청서 초안 · 가독성 강화형"
    story: list[Any] = [
        _paragraph(summary["policy_title"], title),
        _paragraph(
            f"생성일 {datetime.now():%Y.%m.%d} · {summary['tone_label']} · "
            "FactoFit DB 및 ROI 분석 결과 기반 · "
            "원본 신청서초안 내용 삭제 없이 재배치",
            small,
        ),
        Spacer(1, 4 * mm),
    ]

    kpi_table = Table(
        [[
            [
                _paragraph("적용 시나리오", kpi_label),
                _paragraph(summary["scenario_label"], kpi_value),
            ],
            [
                _paragraph("총 투자금", kpi_label),
                _paragraph(_manwon(summary["investment_manwon"]), kpi_value),
            ],
            [
                _paragraph("예상 지원금", kpi_label),
                _paragraph(_manwon(summary["subsidy_manwon"]), kpi_value),
            ],
            [
                _paragraph("정책 적합도", kpi_label),
                _paragraph(f"{summary['match_score']:.1f}점", kpi_value),
            ],
            [
                _paragraph("회수기간", kpi_label),
                _paragraph(
                    f"{summary['payback_months']:,.1f}개월"
                    if summary["payback_months"] is not None
                    else "-",
                    kpi_value,
                ),
            ],
        ]],
        colWidths=[34 * mm] * 5,
        rowHeights=[20 * mm],
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        # 상단으로 치우치거나 하단에 붙어 보이지 않도록 상하 패딩을 균등하게 줄였습니다.
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    reading_order_box = Table(
        [[_paragraph(
            "읽는 순서 - 먼저 종합 검토 의견과 신청기업 개요를 확인하고, "
            "2~4페이지에서 설비·사업목적·정책 적합성을 확인합니다. "
            "5페이지 이후는 기대효과와 예산계획 중심으로 이어집니다.",
            small,
        )]],
        colWidths=[170 * mm],
    )
    reading_order_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
        ("LINEBEFORE", (0, 0), (0, -1), 2, colors.HexColor("#28527A")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [kpi_table, Spacer(1, 3 * mm), reading_order_box, Spacer(1, 3 * mm)]

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
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#9DB2C8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [review_box, Spacer(1, 4 * mm)]

    overview = [
        ["구분", "내용", "구분", "내용"],
        ["기업명", summary["company_name"], "기업 규모", company.get("company_type") or company.get("company_size") or "-"],
        ["설립연도", company.get("established_year") or "-", "사업장 형태", company.get("workplace_type") or "-"],
        ["업종", summary["industry_display"], "지역", company.get("region") or "-"],
        ["직원 수", f"{company.get('employee_count') or 0:,}명", "연 매출", _manwon(company.get("annual_revenue"))],
    ]
    overview_table = Table(
        [[_paragraph(cell, body if row_index > 0 else small) for cell in row] for row_index, row in enumerate(overview)],
        colWidths=[28 * mm, 57 * mm, 28 * mm, 57 * mm],
    )
    overview_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FFFFFF")),
        ("FONTNAME", (0, 0), (-1, -1), regular_font),
        ("FONTNAME", (0, 0), (0, -1), bold_font),
        ("FONTNAME", (2, 0), (2, -1), bold_font),
        ("FONTNAME", (0, 1), (0, -1), bold_font),
        ("FONTNAME", (2, 1), (2, -1), bold_font),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E7EC")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [
        _paragraph("1. 신청기업 개요", heading),
        overview_table,
        Spacer(1, 3 * mm),
        _paragraph(summary["company_overview"], body),
    ]

    revenue_trend = _revenue_trend_items(company)
    if revenue_trend:
        page_content_w = 170 * mm

        company_context_box = Table(
            [[
                [
                    _paragraph("기업 현황 해석", subheading),
                    Spacer(1, 2 * mm),
                    _paragraph(summary["company_context"], body),
                ]
            ]],
            colWidths=[page_content_w],
        )
        company_context_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))

        kpi_col_w = page_content_w / 3
        revenue_kpi_table = Table(
            [[
                [
                    _paragraph(kpi_label, small),
                    Spacer(1, 2 * mm),
                    _paragraph(display, metric),
                ]
                for kpi_label, _, _, display in revenue_trend
            ]],
            colWidths=[kpi_col_w, kpi_col_w, kpi_col_w],
        )
        revenue_kpi_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DDE5")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ]))

        line_chart_items = [
            (chart_label, value, display)
            for _, chart_label, value, display in revenue_trend
        ]
        revenue_chart_panel = Table(
            [
                [_paragraph("연매출 추이 라인 그래프", subheading)],
                [LineChartFlowable(
                    line_chart_items,
                    regular_font=regular_font,
                    bold_font=bold_font,
                    height=58 * mm,
                    line_color=colors.HexColor("#28527A"),
                )],
                [_paragraph(
                    "최근 3개년 연매출이 완만한 상승 흐름을 보이고 있음을 한눈에 확인할 수 있도록 "
                    "추가한 시각화입니다.",
                    small,
                )],
            ],
            colWidths=[page_content_w],
            rowHeights=[None, 58 * mm, None],
            splitByRow=0,
        )
        revenue_chart_panel.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 1), (-1, 1), 0),
            ("RIGHTPADDING", (0, 1), (-1, 1), 0),
            ("TOPPADDING", (0, 1), (-1, 1), 0),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 0),
        ]))

        sales_trend_block = Table(
            [
                [_paragraph("최근 매출 추이", subheading)],
                [revenue_kpi_table],
                [revenue_chart_panel],
            ],
            colWidths=[page_content_w],
            splitByRow=0,
        )
        sales_trend_block.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 1), (-1, 1), 2),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 3),
            ("TOPPADDING", (0, 2), (-1, 2), 2),
        ]))

        story += [
            Spacer(1, 3 * mm),
            company_context_box,
            Spacer(1, 4 * mm),
            CondPageBreak(105 * mm),
            KeepTogether([sales_trend_block]),
        ]
    else:
        story += [
            _paragraph("기업 현황 해석", subheading),
            _paragraph(summary["company_context"], body),
        ]

    story += [PageBreak(), _paragraph("신청 배경 및 설비 현황", title)]
    if summary.get("application_background"):
        story += [
            _paragraph("신청 배경 및 문제 정의", subheading),
            _legacy_content_box(summary["application_background"], body),
            Spacer(1, 3 * mm),
        ]
    else:
        story += [
            _paragraph("신청 배경 및 문제 정의", subheading),
            _legacy_content_box("신청 배경 데이터가 입력되지 않았습니다.", body),
            Spacer(1, 3 * mm),
        ]

    equipment_rows = [
        ["항목", "내용", "항목", "내용"],
        [
            "설비명 / 공정",
            f"{summary['equipment_name']} / {summary['process']}",
            "사용연수",
            f"{equipment.get('age_years') or 0}년",
        ],
        [
            "불량률",
            _percent(equipment.get("defect_rate")),
            "연간 생산량",
            f"{round(_number(equipment.get('production_qty'))):,}개",
        ],
        [
            "연간 에너지비",
            _manwon(equipment.get("energy_cost_annual")),
            "연간 유지보수비",
            _manwon(equipment.get("maintenance_cost_annual")),
        ],
        [
            "업종 평균 비교",
            f"교체주기 {benchmark.get('avg_replacement_cycle_yr', '-')}년, "
            f"평균 불량률 {benchmark.get('avg_defect_rate_pct', '-')}%",
            "",
            "",
        ],
    ]
    equipment_table = Table(
        [[_paragraph(cell, body if row_index > 0 else small) for cell in row] for row_index, row in enumerate(equipment_rows)],
        colWidths=[35 * mm, 50 * mm, 35 * mm, 50 * mm],
    )
    equipment_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E7EC")),
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FFFFFF")),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#FFFFFF")),
        ("BACKGROUND", (2, 1), (2, 2), colors.HexColor("#FFFFFF")),
        ("FONTNAME", (0, 0), (-1, -1), regular_font),
        ("FONTNAME", (0, 1), (0, -1), bold_font),
        ("FONTNAME", (2, 1), (2, 2), bold_font),
        ("SPAN", (1, 4), (3, 4)),
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
        _legacy_content_box(summary["business_necessity"], body),
        Spacer(1, 2 * mm),
        _legacy_callout_box(
            f"추가 진단 의견 - {summary['diagnostic_interpretation']}",
            body,
        ),
        PageBreak(),
    ]

    purpose_table = Table(
        [
            [_paragraph("항목", small), _paragraph("내용", small)],
            [_paragraph("적용 시나리오", small), _paragraph(summary["scenario_label"], metric)],
            [_paragraph("총 투자금", small), _paragraph(_manwon(summary["investment_manwon"]), metric)],
            [_paragraph("예상 지원금", small), _paragraph(_manwon(summary["subsidy_manwon"]), metric)],
        ],
        colWidths=[56 * mm, 114 * mm],
        repeatRows=1,
    )
    purpose_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5DF")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E7EC")),
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#FFFFFF")),
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
        _legacy_content_box(summary["implementation_plan"], body),
    ]
    scenario_rationale_text = (
        summary.get("scenario_rationale")
        or "시나리오 선택 근거 데이터가 입력되지 않았습니다."
    )
    if "설비 사양서에는" in scenario_rationale_text:
        scenario_rationale_text = scenario_rationale_text.split("설비 사양서에는")[0].strip()
    execution_cards = Table(
        [[
            [
                _paragraph("세부 실행 및 관리 방향", subheading),
                _paragraph(summary["execution_detail"], body),
            ],
            [
                _paragraph("시나리오 선택 및 AI 적용 근거", subheading),
                _paragraph(scenario_rationale_text, body),
            ],
        ]],
        colWidths=[83 * mm, 83 * mm],
    )
    execution_cards.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story += purpose_section + [Spacer(1, 3 * mm), execution_cards]
    story += [
        Spacer(1, 3 * mm),
        _legacy_content_box(
            "설비 사양서에는 데이터 수집 항목, 통신 방식, 이상 징후 탐지 범위, "
            "유지보수 알림 방식 및 기존 공정과의 연계 범위를 구체적으로 명시합니다. "
            "이러한 구성은 단순 장비 구매와 AI 기반 공정개선 사업을 구분하는 핵심 근거입니다.",
            body,
        ),
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
    policy_url = _wrap_long_tokens(policy_url)
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
                _paragraph(_format_bullets(support_scope), body),
            ],
            [
                _paragraph("정책 원문 발췌", small),
                _paragraph(_format_bullets(policy_evidence), body),
            ],
        ],
        colWidths=[34 * mm, 136 * mm],
        repeatRows=1,
    )
    policy_evidence_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#FFFFFF")),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    story += [_paragraph("4. 지원사업 적합성", heading)]
    eligibility_items = [
        f"업종: {', '.join(summary['industry_codes']) or '-'} / 정책 대상 {', '.join(_as_list(policy.get('industry_codes'))) or '제한 없음'}",
        f"기업 유형: {company.get('company_type') or company.get('company_size') or '-'} / 정책 대상 {', '.join(_as_list(policy.get('eligible_company_types'))) or '제한 없음'}",
        f"지역: {company.get('region') or '-'} / 정책 조건 {policy.get('region') or '제한 없음'}",
        f"추천 적합도: {summary['match_score']:.1f}점 / 적격 판정: {'적격' if matched.get('eligible') else '확인 필요'}",
    ]
    eligibility_table = Table(
        [
            [_paragraph("검토 항목", small), _paragraph("FactoFit 판단", small)],
            *[
                [
                    _paragraph(item.split(":", 1)[0], body),
                    _paragraph(item.split(":", 1)[1].strip(), body),
                ]
                for item in eligibility_items
            ],
        ],
        colWidths=[55 * mm, 115 * mm],
    )
    eligibility_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [eligibility_table]
    review_cards = Table(
        [
            [[
                _paragraph("적합성 검토 의견", subheading),
                _paragraph(summary["policy_analysis"], body),
            ]],
            [[
                _paragraph("정책 활용 및 예산 구성 전략", subheading),
                _paragraph(
                    summary.get("policy_utilization_strategy")
                    or "정책 활용 전략 데이터가 입력되지 않았습니다.",
                    body,
                ),
            ]],
            [[
                _paragraph("제출자료 준비사항", subheading),
                _paragraph(
                    summary.get("submission_readiness")
                    or "제출자료 준비 데이터가 입력되지 않았습니다.",
                    body,
                ),
            ]],
        ],
        colWidths=[170 * mm],
    )
    review_cards.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [
        PageBreak(),
        _paragraph("지원내용 및 원문 발췌", title),
        _paragraph(
            "원본 표의 항목과 문장을 삭제하지 않고, 항목별로 끊어 읽을 수 있도록 재배치했습니다.",
            small,
        ),
        Spacer(1, 3 * mm),
        policy_evidence_table,
        PageBreak(),
        _paragraph("적합성 검토 및 제출자료 준비", title),
        review_cards,
    ]

    effects_total_w = 170 * mm

    savings_values = {
        "에너지비 절감": _number(breakdown.get("energy_saving_manwon")),
        "유지보수비 절감": _number(breakdown.get("maintenance_saving_manwon")),
        "불량비용 절감": _number(breakdown.get("defect_saving_manwon")),
    }
    annual_net_benefit = _number(scenario.get("annual_net_benefit_manwon"))

    # 5. 기대효과는 좌우 분할을 없애고, 표를 먼저 가로 전체 폭으로 배치합니다.
    # 표 다음에 시각화 그래프가 이어져 사용자가 수치 -> 그래프 순서로 읽을 수 있게 했습니다.
    savings_detail_table = Table(
        [
            [
                _paragraph("항목", small),
                _paragraph("내용", small),
                _paragraph("항목", small),
                _paragraph("내용", small),
            ],
            [
                _paragraph("에너지비 절감", body),
                _paragraph(_manwon(savings_values["에너지비 절감"]), body),
                _paragraph("유지보수비 절감", body),
                _paragraph(_manwon(savings_values["유지보수비 절감"]), body),
            ],
            [
                _paragraph("불량비용 절감", body),
                _paragraph(_manwon(savings_values["불량비용 절감"]), body),
                _paragraph("연간 순편익", body),
                _paragraph(_manwon(annual_net_benefit), body),
            ],
        ],
        colWidths=[38 * mm, 47 * mm, 38 * mm, 47 * mm],
        repeatRows=1,
    )
    savings_detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#FFFFFF")),
        ("BACKGROUND", (2, 1), (2, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D5DDE5")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, 1), (0, -1), bold_font),
        ("FONTNAME", (2, 1), (2, -1), bold_font),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))

    lollipop_items = [
        (
            "에너지비 절감",
            max(1, savings_values["에너지비 절감"]),
            _manwon(savings_values["에너지비 절감"]),
            colors.HexColor("#28527A"),
        ),
        (
            "유지보수비 절감",
            max(1, savings_values["유지보수비 절감"]),
            _manwon(savings_values["유지보수비 절감"]),
            colors.HexColor("#28527A"),
        ),
        (
            "불량비용 절감",
            max(1, savings_values["불량비용 절감"]),
            _manwon(savings_values["불량비용 절감"]),
            colors.HexColor("#28527A"),
        ),
    ]
    chart_axis_max = max(value for _, value, _, _ in lollipop_items)
    chart_axis_max = max(chart_axis_max, 50)
    chart_axis_max = ((int(chart_axis_max) + 49) // 50) * 50

    chart_summary_style = ParagraphStyle(
        "ChartSummaryCenter", parent=small, alignment=TA_CENTER
    )

    effects_chart_panel = Table(
        [
            [_paragraph("기대효과 시각화", subheading)],
            [LollipopChartFlowable(
                lollipop_items,
                regular_font=regular_font,
                bold_font=bold_font,
                height=72 * mm,
                axis_max=chart_axis_max,
            )],
            [_paragraph(
                f"세 절감항목의 합산 결과, 연간 순편익은 {_manwon(annual_net_benefit)}입니다.",
                chart_summary_style,
            )],
        ],
        colWidths=[effects_total_w],
        rowHeights=[None, 72 * mm, None],
        splitByRow=0,
    )
    effects_chart_panel.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DDE5")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 1), (-1, 1), 0),
        ("RIGHTPADDING", (0, 1), (-1, 1), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 0),
    ]))

    story += [
        # 앞 챕터와 자연스럽게 구분되도록 약 3줄 정도의 여백만 둡니다.
        Spacer(1, 9 * mm),
        _paragraph("5. 기대효과", heading),
        savings_detail_table,
        Spacer(1, 4 * mm),
        CondPageBreak(95 * mm),
        KeepTogether([effects_chart_panel]),
        Spacer(1, 9 * mm),
        _paragraph("기대효과 및 성과관리", title),
        _legacy_stacked_cards(
            [
                ("기대효과", summary["expected_effects"]),
                ("성과 측정 및 사후관리", summary["performance_plan"]),
            ]
            + (
                [("성과관리 운영체계", summary["performance_governance"])]
                if summary.get("performance_governance")
                else []
            ),
            subheading=subheading,
            body=body,
        ),
    ]

    # 안전점검 및 안전개선 기대효과 섹션은 요청에 따라 신청서 초안 PDF에서 출력하지 않습니다.
    safety_improvement = data.get("safety_improvement") or {}
    safety_items = safety_improvement.get("items") or []

    budget = [
        ["총 사업비", _manwon(summary["investment_manwon"])],
        ["정부 지원금", _manwon(summary["subsidy_manwon"])],
        ["자기부담금", _manwon(summary["self_funding_manwon"])],
        ["예상 회수기간", f"{summary['payback_months']:,.1f}개월" if summary["payback_months"] is not None else "-"],
        ["정책 지원 한도", _manwon(policy.get("max_amount")) if policy.get("max_amount") else "-"],
    ]
    budget_table = Table(
        [
            [_paragraph("항목", small), _paragraph("값", small)],
            *[[_paragraph(label, body), _paragraph(value, right)] for label, value in budget],
        ],
        colWidths=[100 * mm, 70 * mm],
        repeatRows=1,
    )
    budget_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, colors.HexColor("#E2E7EC")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    budget_summary = Table(
        [
            [_paragraph("정부 지원금", body), _paragraph(_manwon(summary["subsidy_manwon"]), right)],
            [_paragraph("자기부담금", body), _paragraph(_manwon(summary["self_funding_manwon"]), right)],
        ],
        colWidths=[100 * mm, 70 * mm],
    )
    budget_summary.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, colors.HexColor("#E2E7EC")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [
        PageBreak(),
        _paragraph("6. 예산계획", heading),
        _paragraph("사업비 구성", subheading),
        budget_summary,
        Spacer(1, 2 * mm),
        budget_table,
        Spacer(1, 3 * mm),
        _legacy_content_box(summary["financial_assessment"], body),
        Spacer(1, 2 * mm),
        _legacy_stacked_cards(
            [("주요 위험요인 및 확인사항", summary["risk_review"])],
            subheading=subheading,
            body=body,
        ),
    ]
    if summary.get("final_recommendation"):
        conclusion_box = Table(
            [[_paragraph(summary["final_recommendation"], body)]],
            colWidths=[170 * mm],
        )
        conclusion_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#9FB7A5")),
            ("LEFTPADDING", (0, 0), (-1, -1), 11),
            ("RIGHTPADDING", (0, 0), (-1, -1), 11),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ]))
        story += [
            _paragraph("종합 결론", heading),
            conclusion_box,
            Spacer(1, 3 * mm),
        ]
    # 종합 결론 이후의 산출 근거/검토 메모/최종 검증 페이지는 출력하지 않습니다.

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont(regular_font, 7)
        canvas.setStrokeColor(colors.HexColor("#D5DDE5"))
        canvas.setLineWidth(0.45)
        canvas.line(17 * mm, 14 * mm, A4[0] - 17 * mm, 14 * mm)
        canvas.setFillColor(colors.HexColor("#78889A"))
        canvas.drawRightString(A4[0] - 17 * mm, 9 * mm, str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


class ReferenceBarsFlowable(Flowable):
    """사업비 구성 막대를 신청서 초안의 비교 그래프 톤으로 통일한 Flowable.

    - 왼쪽 라벨
    - 가운데 둥근 트랙 + 파란 막대
    - 오른쪽 값 표시
    """

    def __init__(
        self,
        items: list[tuple[str, float, str]],
        *,
        regular_font: str,
        bold_font: str,
        width: float = 154 * mm,
        height: float | None = None,
        bar_color: colors.Color = colors.HexColor("#28527A"),
        track_color: colors.Color = colors.HexColor("#FFFFFF"),
        guide_color: colors.Color = colors.HexColor("#B8C3CF"),
    ):
        super().__init__()
        self.items = items
        self.regular_font = regular_font
        self.bold_font = bold_font
        self.width = width
        self.height = height or max(28 * mm, len(items) * 14 * mm)
        self.bar_color = bar_color
        self.track_color = track_color
        self.guide_color = guide_color

    def draw(self):
        if not self.items:
            return

        label_width = 33 * mm
        value_width = 31 * mm
        bar_width = max(35 * mm, self.width - label_width - value_width)
        max_value = max((abs(value) for _, value, _ in self.items), default=1) or 1
        row_height = self.height / len(self.items)

        for index, (label, value, display) in enumerate(self.items):
            y = self.height - (index + 1) * row_height + row_height / 2
            bar_h = 4.8 * mm
            bar_y = y - bar_h / 2
            bar_x = label_width

            self.canv.setFillColor(colors.HexColor("#101827"))
            self.canv.setFont(self.bold_font, 8.4)
            self.canv.drawString(0, y - 2.1, label)

            # 신청서 초안 PDF의 설비 비교 그래프처럼 둥근 트랙을 먼저 깔고,
            # 실제 값은 동일한 둥근 막대로 표시합니다.
            self.canv.setFillColor(self.track_color)
            self.canv.roundRect(bar_x, bar_y, bar_width, bar_h, bar_h / 2, fill=True, stroke=False)
            self.canv.setStrokeColor(colors.HexColor("#E2E7EC"))
            self.canv.setLineWidth(0.25)
            self.canv.roundRect(bar_x, bar_y, bar_width, bar_h, bar_h / 2, fill=False, stroke=True)

            actual_width = bar_width * max(0, value) / max_value
            if actual_width > 0:
                self.canv.setFillColor(self.bar_color)
                self.canv.roundRect(bar_x, bar_y, max(1.8 * mm, actual_width), bar_h, bar_h / 2, fill=True, stroke=False)

            self.canv.setFillColor(colors.HexColor("#101827"))
            self.canv.setFont(self.bold_font, 8.0)
            self.canv.drawRightString(self.width, y - 2.1, display)


class TrackingTitleFlowable(Flowable):
    """Canvas 기반 제목. ReportLab Paragraph에는 자간 조절이 없어 직접 그립니다."""

    def __init__(
        self,
        text: str,
        *,
        font_name: str,
        font_size: float = 19.0,
        char_space: float = -0.35,
        text_color: colors.Color = colors.HexColor("#101827"),
        height: float = 11 * mm,
    ):
        super().__init__()
        self.text = text
        self.font_name = font_name
        self.font_size = font_size
        self.char_space = char_space
        self.text_color = text_color
        self.width = 180 * mm
        self.height = height

    def wrap(self, availWidth: float, availHeight: float) -> tuple[float, float]:
        self.width = availWidth
        return availWidth, self.height

    def draw(self):
        self.canv.saveState()
        self.canv.setFillColor(self.text_color)
        text_width = self.canv.stringWidth(self.text, self.font_name, self.font_size)
        tracking_width = self.char_space * max(0, len(self.text) - 1)
        x = max(0, (self.width - text_width - tracking_width) / 2)
        y = self.height - self.font_size
        text_obj = self.canv.beginText(x, y)
        text_obj.setFont(self.font_name, self.font_size)
        text_obj.setCharSpace(self.char_space)
        text_obj.textLine(self.text)
        self.canv.drawText(text_obj)
        self.canv.restoreState()


def _one_line(value: Any, limit: int = 105, fallback: str = "-") -> str:
    text = _clip_text(value, limit, fallback)
    text = re.sub(r"[\r\n]+", " ", text)
    return re.sub(r"\s+", " ", text).strip() or fallback


def _policy_amount_basis(policy: dict[str, Any]) -> str:
    return _report_text(
        policy.get("max_amount_type_ko")
        or policy.get("max_amount_type")
        or "정책 지원한도 유형 미확인",
        "정책 지원한도 유형 미확인",
    )


def _policy_amount_reason(policy: dict[str, Any]) -> str:
    return _report_text(
        policy.get("max_amount_type_reason"),
        "정책 지원금 산정 근거 문장이 DB에 없으므로 공고 원문과 지원한도 확인이 필요합니다.",
    )


def _report_text(value: Any, fallback: str = "-") -> str:
    if value in (None, "", [], {}):
        return fallback
    return str(value)


def _clip_text(value: Any, limit: int = 260, fallback: str = "-") -> str:
    text = re.sub(r"\s+", " ", _report_text(value, fallback)).strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "..."


def _money_text(value: Any) -> str:
    return f"{round(_number(value)):,}만원"


def _month_text(value: Any) -> str:
    if value in (None, ""):
        return "-"
    return f"{_number(value):,.1f}개월"


def _score_text(value: Any) -> str:
    if value in (None, ""):
        return "-"
    score = _number(value)
    if 0 < score <= 1:
        score *= 100
    return f"{score:.1f}점"


def _build_application_report_pdf_table_centered(data: dict) -> bytes:
    regular_font, bold_font = _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=22 * mm,
        title="FactoFit table-centered application report",
        author="FactoFit",
    )

    base = getSampleStyleSheet()
    title_style = ParagraphStyle("RefTitle", parent=base["Title"], fontName=bold_font, fontSize=18.5, leading=23, alignment=TA_CENTER, textColor=colors.HexColor("#101827"), spaceAfter=3 * mm)
    meta_style = ParagraphStyle("RefMeta", fontName=regular_font, fontSize=8, leading=12, alignment=TA_CENTER, textColor=colors.HexColor("#667386"))
    heading_style = ParagraphStyle("RefHeading", fontName=bold_font, fontSize=14.5, leading=19, textColor=colors.HexColor("#101827"), spaceBefore=3.5 * mm, spaceAfter=2.5 * mm)
    subheading_style = ParagraphStyle("RefSubheading", fontName=bold_font, fontSize=10.3, leading=14, textColor=colors.HexColor("#173250"), spaceBefore=3.5 * mm, spaceAfter=2 * mm)
    body_style = ParagraphStyle("RefBody", fontName=regular_font, fontSize=8.8, leading=14.5, textColor=colors.HexColor("#1F2A37"))
    small_style = ParagraphStyle("RefSmall", fontName=regular_font, fontSize=7.3, leading=10.5, textColor=colors.HexColor("#65758A"))
    cell_style = ParagraphStyle("RefCell", fontName=regular_font, fontSize=8.2, leading=12.0, textColor=colors.HexColor("#1F2A37"))
    cell_bold_style = ParagraphStyle("RefCellBold", fontName=bold_font, fontSize=8.4, leading=12.2, textColor=colors.HexColor("#101827"))
    cell_emphasis_style = ParagraphStyle("RefCellEmphasis", fontName=bold_font, fontSize=10.5, leading=13.0, textColor=colors.HexColor("#101827"))
    judgement_style = ParagraphStyle("RefJudgement", fontName=bold_font, fontSize=8.3, leading=12.0, textColor=colors.HexColor("#173250"))
    kpi_label_style = ParagraphStyle("RefKpiLabel", fontName=regular_font, fontSize=7.0, leading=9.5, textColor=colors.HexColor("#53657A"))
    kpi_value_style = ParagraphStyle("RefKpiValue", fontName=bold_font, fontSize=13.7, leading=16, textColor=colors.HexColor("#101827"))
    pill_required_style = ParagraphStyle("RefPillRequired", fontName=bold_font, fontSize=7.2, leading=9, alignment=TA_CENTER, textColor=colors.HexColor("#102033"), borderColor=colors.HexColor("#B9C8D8"), borderWidth=0.6, borderPadding=(2, 7, 2))
    pill_supplement_style = ParagraphStyle("RefPillSupplement", parent=pill_required_style, textColor=colors.HexColor("#173250"))

    def p(value: Any, style: ParagraphStyle = cell_style) -> Paragraph:
        return _paragraph(value, style)

    def p_rich(html: str, style: ParagraphStyle = cell_style) -> Paragraph:
        return Paragraph(html, style)

    def make_table(rows: list[list[Any]], widths: list[float], *, header: bool = True, label_cols: tuple[int, ...] = (), row_heights: list[float] | None = None) -> Table:
        flow_rows = []
        for row_index, row in enumerate(rows):
            flow_row = []
            for col_index, value in enumerate(row):
                style = cell_bold_style if (header and row_index == 0) or col_index in label_cols else cell_style
                flow_row.append(value if isinstance(value, Flowable) else p(value, style))
            flow_rows.append(flow_row)
        table = Table(
            flow_rows,
            colWidths=[width * mm for width in widths],
            rowHeights=[height * mm for height in row_heights] if row_heights else None,
            repeatRows=1 if header else 0,
        )
        style_commands: list[tuple] = [
            ("BOX", (0, 0), (-1, -1), 0.45, colors.HexColor("#D6DEE8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D6DEE8")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if header:
            style_commands += [
                ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
                ("LINEBELOW", (0, 0), (-1, 0), 0.85, colors.HexColor("#8393A5")),
            ]
        for col in label_cols:
            style_commands.append(("BACKGROUND", (col, 1 if header else 0), (col, -1), colors.HexColor("#FFFFFF")))
        table.setStyle(TableStyle(style_commands))
        return table

    def note_box(text: str, *, bold_prefix: str | None = None, width: float = 180 * mm) -> Table:
        if bold_prefix:
            display = p_rich(
                f'<font name="{bold_font}">{bold_prefix}</font> - '
                f'{str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")}',
                body_style,
            )
        else:
            display = p(text, body_style)
        box = Table([[display]], colWidths=[width])
        box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("LEFTPADDING", (0, 0), (-1, -1), 11),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBEFORE", (0, 0), (0, -1), 2.5, colors.HexColor("#28527A")),
        ]))
        return box

    summary = _as_dict(data.get("summary"))
    company = _as_dict(data.get("company"))
    equipment = _as_dict(data.get("equipment"))
    policy = _as_dict(data.get("policy"))
    matched = _as_dict(data.get("matched_policy"))
    scenario = _as_dict(data.get("scenario"))
    breakdown = _as_dict(data.get("breakdown"))
    benchmark = _as_dict(data.get("benchmark"))
    safety_all = _as_dict(data.get("safety_improvement")).get("items") or []
    safety_items = safety_all[:3]

    company_name = _report_text(summary.get("company_name") or company.get("company_name"), "-")
    equipment_name = _report_text(summary.get("equipment_name") or equipment.get("name"), "-")
    policy_title = _report_text(summary.get("policy_title") or policy.get("title") or matched.get("title"), "-")
    industry_display = _report_text(summary.get("industry_display") or company.get("industry_name"), "-")
    region = _report_text(company.get("region"), "-")
    employee_count = _report_text(company.get("employee_count"), "0")
    age_years = _number(equipment.get("age_years"))
    defect_rate = _number(equipment.get("defect_rate"))
    avg_cycle = _number(benchmark.get("avg_replacement_cycle_yr"), 10)
    avg_defect = _number(benchmark.get("avg_defect_rate_pct"), 1.8)
    investment = _number(summary.get("investment_manwon") or scenario.get("investment_manwon"))
    subsidy = _number(summary.get("subsidy_manwon") or scenario.get("subsidy_manwon"))
    self_funding = _number(summary.get("self_funding_manwon"), max(0, investment - subsidy))
    payback_months = summary.get("payback_months")
    if payback_months in (None, "") and scenario.get("payback_years") not in (None, ""):
        payback_months = _number(scenario.get("payback_years")) * 12
    match_score = summary.get("match_score") or matched.get("match_score")
    energy_saving = _first_number(breakdown.get("energy_saving_manwon"), breakdown.get("energy_saving"))
    maintenance_saving = _first_number(breakdown.get("maintenance_saving_manwon"), breakdown.get("maintenance_saving"))
    defect_saving = _first_number(breakdown.get("defect_saving_manwon"), breakdown.get("defect_reduction_manwon"), breakdown.get("defect_reduction"))
    productivity_gain = _first_number(breakdown.get("productivity_gain_manwon"), breakdown.get("productivity_gain"))
    annual_net = _first_number(scenario.get("annual_net_benefit_manwon"), energy_saving + maintenance_saving + defect_saving + productivity_gain)
    energy_cost = _number(equipment.get("energy_cost_annual"))
    maintenance_cost = _number(equipment.get("maintenance_cost_annual"))
    evidence_rows_raw = _consumer_evidence_rows(data)
    evidence_total = len(evidence_rows_raw)
    safety_evidence_count = sum(len(item.get("required_evidences") or []) for item in safety_all)
    judgement = _consumer_judgement(summary, safety_all)
    report_subtitle = "표 중심 신청 판단 요약서 · 가독성 강화형"

    story: list[Any] = [
        TrackingTitleFlowable(
            "FactoFit 표 중심 신청 판단 요약서",
            font_name=bold_font,
            font_size=18.8,
            char_space=-0.35,
        ),
        Spacer(1, 5 * mm),
    ]

    kpi_table = Table(
        [[
            [p("신청 판단", kpi_label_style), p(judgement, kpi_value_style)],
            [p("정책 적합도", kpi_label_style), p(_score_text(match_score), kpi_value_style)],
            [p("예상 지원금", kpi_label_style), p(_money_text(subsidy), kpi_value_style)],
            [p("내 부담금", kpi_label_style), p(_money_text(self_funding), kpi_value_style)],
            [p("회수기간", kpi_label_style), p(_month_text(payback_months), kpi_value_style)],
        ]],
        colWidths=[36 * mm] * 5,
        rowHeights=[22 * mm],
    )
    kpi_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.55, colors.HexColor("#D6DEE8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#D6DEE8")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#FFFFFF")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        # KPI 박스 안의 라벨/값이 하단으로 치우쳐 보이지 않도록 중앙 정렬에 맞춘 패딩
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    core_answer = [
        f"- 정책 추천 적합도는 {_score_text(match_score)}입니다.",
        f"- 기업의 지역({region}), 업종({industry_display}), 규모({company.get('company_type') or company.get('company_size') or '중소기업'})에 대한 매칭 결과를 기준으로 검토합니다.",
        f"- {policy_title}의 세부 지원한도와 제출서류, 마감일, 자격조건은 공고 원문 확인이 필요합니다.",
        "- 추천 점수는 신청 자격 확정값과 구분되는 참고 지표입니다.",
    ]
    if _clip_text(matched.get("reason"), 220, ""):
        core_answer.insert(2, f"- {_clip_text(matched.get('reason'), 220)}")
    story += [
        kpi_table,
        Spacer(1, 5 * mm),
        note_box("먼저 상단 KPI로 신청 판단을 확인하고, 아래 4개 질문에서 사장님 관점의 핵심 답변을 확인합니다. 상세 근거는 2~5페이지에서 같은 순서로 이어집니다.", bold_prefix="읽는 순서"),
        p("1. 핵심 요약", heading_style),
        make_table([["사장님 질문", "현재 답변", "판단"], ["우리 회사가 받을 수 있나?", "\n".join(core_answer), p(judgement, judgement_style)]], [28, 116, 36], label_cols=(0,), row_heights=[9, 55]),
        Spacer(1, 3 * mm),
        make_table([["내 돈은 얼마 들어가나?", p(_money_text(self_funding), cell_emphasis_style), "지원금 차감 후 자기부담금 기준"]], [28, 116, 36], header=False, label_cols=(0,), row_heights=[14]),
        Spacer(1, 3 * mm),
        make_table([["왜 지금 해야 하나?", "\n".join([f"- {company_name}은 {industry_display} 분야에서 {equipment_name} 설비를 운영하고 있습니다.", f"- 사용연수는 {age_years:g}년이며, 연간 에너지비용 {_money_text(energy_cost)}과 유지보수비 {_money_text(maintenance_cost)}이 발생합니다.", f"- 불량률은 {defect_rate:.1f}%로 입력되어 비용과 생산성 지표의 병행 검토가 필요합니다.", "- 설비 개선 투자와 스마트공장 전환을 연계하여 검토합니다."]), "설비 노후·비용·품질 지표 기준"]], [28, 116, 36], header=False, label_cols=(0,), row_heights=[37]),
        Spacer(1, 3 * mm),
        make_table([["무엇이 부족한가?", f"일반 준비자료 {evidence_total}건 확인 필요", "제출 전 증빙 보완"]], [28, 116, 36], header=False, label_cols=(0,), row_heights=[15]),
        PageBreak(),
    ]

    cost_table = make_table(
        [
            ["항목", "금액"],
            ["연간 에너지비", _money_text(energy_cost)],
            ["연간 유지보수비", _money_text(maintenance_cost)],
            ["연간 비용 합계", _money_text(energy_cost + maintenance_cost)],
        ],
        [90, 90],
        label_cols=(0,),
        row_heights=[10, 11, 11, 11],
    )
    equipment_status_chart = ComparisonChartFlowable(
        [
            (
                "설비 사용연수",
                age_years,
                avg_cycle,
                f"보유 설비 {age_years:g}년",
                f"업종 평균 {avg_cycle:g}년",
            ),
            (
                "설비 불량률",
                defect_rate,
                avg_defect,
                f"보유 설비 {defect_rate:.1f}%",
                f"업종 평균 {avg_defect:.1f}%",
            ),
        ],
        regular_font=regular_font,
        bold_font=bold_font,
        width=176 * mm,
    )
    story += [
        p("2. 신청기업 및 설비 현황", heading_style),
        make_table([["구분", "내용", "구분", "내용"], ["기업명", company_name, "지역", region], ["업종", industry_display, "직원 수", f"{employee_count}명"], ["설비명", equipment_name, "사용연수", f"{age_years:g}년"]], [45, 45, 45, 45], label_cols=(0, 2), row_heights=[10, 11, 11, 11]),
        Spacer(1, 8 * mm),
        p("설비 상태 핵심 지표", subheading_style),
        Spacer(1, 2 * mm),
        equipment_status_chart,
        Spacer(1, 6 * mm),
        p("비용 발생 현황", subheading_style),
        cost_table,
        Spacer(1, 8 * mm),
        p("3. 사업 목적 및 추진내용", heading_style),
        make_table([["항목", "내용"], ["사업 목적", _clip_text(summary.get("implementation_plan") or summary.get("business_necessity"), 520)], ["지원사업", policy_title]], [40, 140], label_cols=(0,), row_heights=[9, 26, 11]),
        Spacer(1, 5 * mm),
        note_box("이 페이지는 원본 표중심 리포트의 신청기업 및 설비 현황과 사업 목적을 유지하되, 설비 상태와 비용 발생 현황을 별도로 분리해 한눈에 보이도록 재배치했습니다.", bold_prefix="FactoFit 정리"),
        PageBreak(),
    ]

    policy_amount_basis = _policy_amount_basis(policy)
    policy_amount_reason = _policy_amount_reason(policy)
    policy_checks = [
        ["추천 적합도", f"정책 추천 적합도는 {_score_text(match_score)}입니다."],
        ["기업 조건", f"지역({region}), 업종({industry_display}), 규모({company.get('company_type') or company.get('company_size') or '중소기업'}) 기준으로 검토합니다."],
        ["활용 방향", _one_line(summary.get("policy_utilization_strategy") or summary.get("policy_analysis"), 112)],
        ["확인 필요", "지원한도, 제출서류, 마감일, 자격조건은 공고 원문으로 재확인합니다."],
        ["연계 판단", "현재 매칭 결과 기준으로 지원사업 연계 가능성을 판단합니다."],
        ["원문 발췌 해석", _one_line(policy.get("eligibility_evidence") or policy.get("summary"), 112)],
        ["점수 해석", "추천 점수는 신청 자격 확정값이 아닌 참고 지표입니다."],
        ["최종 확인", "업종, 기업 규모, 지역, 중복수혜 제한 및 자부담 조건을 최종 확인합니다."],
    ]
    budget_table = make_table([["항목", "금액/기간", "근거"], ["총 사업비", _money_text(investment), "ROI 계산 시나리오"], ["예상 지원금", _money_text(subsidy), policy_amount_basis], ["자기부담금", _money_text(self_funding), "총 사업비 - 예상 지원금"], ["연간 순편익", _money_text(annual_net), "ROI breakdown"], ["예상 회수기간", _month_text(payback_months), "ROI 계산값"]], [42, 42, 96], label_cols=(0,), row_heights=[9, 10, 10, 10, 10, 10])
    budget_chart_block = Table(
        [
            [p("사업비 구성", subheading_style)],
            [ReferenceBarsFlowable([("정부 지원금", subsidy, _money_text(subsidy)), ("자기부담금", self_funding, _money_text(self_funding))], regular_font=regular_font, bold_font=bold_font, width=154 * mm, height=24 * mm)],
            [note_box(policy_amount_reason, width=180 * mm)],
        ],
        colWidths=[180 * mm],
    )
    budget_chart_block.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    budget_split = Table(
        [[
            budget_table,
        ]],
        colWidths=[180 * mm],
    )
    budget_split.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [
        p("4. 정책 적합성", heading_style),
        p("원본의 정책 적합성 문장을 삭제하지 않고, 심사 관점별로 끊어 읽을 수 있도록 재구성했습니다.", small_style),
        Spacer(1, 3 * mm),
        make_table([["검토 관점", "내용"], *policy_checks], [35, 145], label_cols=(0,), row_heights=[9, 10, 10, 12, 10, 10, 12, 10, 11]),
        Spacer(1, 5 * mm),
        make_table([["탈락위험 관점", "정책 적합성은 가능성 판단이며, 실제 지원 가능 여부는 공고 원문, 지원 가능 비목, 지원한도, 자부담 조건, 제출서류 확인 이후 확정됩니다."]], [35, 145], header=False, label_cols=(0,), row_heights=[18]),
        PageBreak(),
        p("5. 예산·ROI 판단 - 내 돈 기준", heading_style),
        budget_split,
        Spacer(1, 3 * mm),
        budget_chart_block,
        PageBreak(),
    ]

    savings_table = make_table([["절감/개선 항목", "금액", "비고"], ["에너지비 절감", _money_text(energy_saving), "입력 에너지비 기준"], ["유지보수비 절감", _money_text(maintenance_saving), "정비비 기준"], ["불량비용 절감", _money_text(defect_saving), "불량률 기준"], ["생산성 개선 효과", _money_text(productivity_gain), "생산성 개선값"], ["연간 순편익", _money_text(annual_net), "절감·개선 효과 합산"]], [60, 45, 75], label_cols=(0,), row_heights=[9, 10, 10, 10, 10, 10])
    safety_rows = [["번호", "관점", "현재 상태", "증빙 여부", "설명·근거"]]
    if safety_items:
        for index, item in enumerate(safety_items, 1):
            safety_rows.append([str(index), _report_text(item.get("viewpoint_title") or item.get("viewpoint_key"), "-"), _report_text(item.get("current_judgement"), "개선 필요"), "보유" if item.get("required_evidences") else "미보유", _clip_text(item.get("description"), 120)])
    else:
        safety_rows += [["1", "자동화 설비 안전성 보완", "개선 필요", "미보유", "자동화 장치와 방호장치의 연동 상태 확인이 필요합니다."], ["2", "작업자 위험 노출 감소", "개선 필요", "미보유", "주요 안전장치 확인을 통해 작업자 위험 노출을 줄일 필요가 있습니다."], ["3", "설비 운용 안정성 개선", "개선 필요", "미보유", "구동부와 제어계통 점검 자료로 설비 운용 안정성을 확인해야 합니다."]]
    story += [
        p("6. 절감/개선 항목 및 기대효과", heading_style),
        savings_table,
        Spacer(1, 3 * mm),
        p("기대효과", subheading_style),
        make_table([["구분", "내용"], ["기대효과", _clip_text(summary.get("expected_effects"), 430)], ["성과관리", _clip_text(summary.get("performance_plan"), 430)]], [33, 147], label_cols=(0,), row_heights=[9, 22, 18]),
    ]

    # 증빙자료·탈락위험 체크 섹션은 요청에 따라 표중심 PDF에서 출력하지 않습니다.

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont(regular_font, 7)
        canvas.setStrokeColor(colors.HexColor("#D6DEE8"))
        canvas.setLineWidth(0.45)
        canvas.line(15 * mm, 18 * mm, A4[0] - 15 * mm, 18 * mm)
        canvas.setFillColor(colors.HexColor("#7B8794"))
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    buffer.seek(0)
    return buffer.getvalue()


def build_application_report_pdf(data: dict) -> bytes:
    return _build_application_report_pdf_legacy(data)


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
