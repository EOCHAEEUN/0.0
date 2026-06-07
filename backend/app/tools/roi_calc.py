"""
팩토핏 ROI 시뮬레이션 계산 엔진 (Pure Logic)

이 파일은 ROI 계산에 필요한 **순수 비즈니스 로직**만을 담고 있습니다.
LangChain, Tool, Agent와는 완전히 독립적이며,
단순한 함수 호출만으로도 사용할 수 있습니다.

주요 기능:
- 설비 교체 시나리오 A/B ROI 계산
- 에너지 절감, 유지보수비 절감, 불량비용 절감 계산
- 투자금 자동 추정
- 데이터 품질 평가 및 AI 추천 로직

이 파일은 tools/roi_calculator_tool.py에서 import되어 Tool 형태로 사용됩니다.
"""

# TODO: Policy Matching 에이전트 연동 후 실제 매칭 지원금으로 대체
# 현재는 BENCHMARKS default_subsidy 기반 추정치 사용

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


# ==================== 1. 입력 모델 ====================
class EquipmentInput(BaseModel):
    name: str
    category: str
    age_years: int
    energy_cost_annual: int
    defect_rate: Optional[float] = None
    maintenance_cost_annual: Optional[int] = None
    capacity_value: Optional[float] = None
    annual_operating_hours: Optional[int] = None
    load_factor: Optional[float] = None
    electricity_price_won: Optional[int] = None
    production_qty: Optional[int] = None
    contribution_margin_won: Optional[int] = None


class RoiInput(BaseModel):
    equipment: EquipmentInput
    scenario_a_investment_manwon: Optional[int] = None
    scenario_a_subsidy_manwon: Optional[int] = None
    scenario_b_investment_manwon: Optional[int] = None
    scenario_b_subsidy_manwon: Optional[int] = None


# ==================== 2. 투자금 추정 테이블 ====================
INVESTMENT_TABLE = {
    "press": [
        {"min": 0,   "max": 200,  "unit": "ton", "a_low": 8000,  "a_high": 12000, "b_low": 1500, "b_high": 2500},
        {"min": 200, "max": 400,  "unit": "ton", "a_low": 12000, "a_high": 18000, "b_low": 2500, "b_high": 4000},
        {"min": 400, "max": 9999, "unit": "ton", "a_low": 18000, "a_high": 25000, "b_low": 4000, "b_high": 6000},
    ],
    "cnc": [
        {"min": 0,  "max": 20,   "unit": "kW", "a_low": 8000,  "a_high": 13000, "b_low": 1500, "b_high": 2500},
        {"min": 20, "max": 40,   "unit": "kW", "a_low": 13000, "a_high": 20000, "b_low": 2500, "b_high": 4000},
        {"min": 40, "max": 9999, "unit": "kW", "a_low": 20000, "a_high": 30000, "b_low": 4000, "b_high": 7000},
    ],
    "injection": [
        {"min": 0,   "max": 300,  "unit": "ton", "a_low": 10000, "a_high": 15000, "b_low": 2000, "b_high": 3500},
        {"min": 300, "max": 500,  "unit": "ton", "a_low": 15000, "a_high": 22000, "b_low": 3500, "b_high": 5500},
        {"min": 500, "max": 9999, "unit": "ton", "a_low": 22000, "a_high": 35000, "b_low": 5500, "b_high": 9000},
    ],
}


def estimate_investment(category: str, capacity: Optional[float]) -> Optional[dict]:
    table = INVESTMENT_TABLE.get(category)
    if not table or capacity is None:
        return None
    for row in table:
        if row["min"] <= capacity < row["max"]:
            return {
                "scenario_a": {"low": row["a_low"], "high": row["a_high"], "mid": (row["a_low"] + row["a_high"]) // 2},
                "scenario_b": {"low": row["b_low"], "high": row["b_high"], "mid": (row["b_low"] + row["b_high"]) // 2},
                "unit": row["unit"],
                "note": "설비 평균 단가 기반 추정치입니다. 실제 견적과 차이가 있을 수 있습니다.",
                "source": "한국기계산업진흥회 설비가격 동향 2023",
            }
    last = table[-1]
    return {
        "scenario_a": {"low": last["a_low"], "high": last["a_high"], "mid": (last["a_low"] + last["a_high"]) // 2},
        "scenario_b": {"low": last["b_low"], "high": last["b_high"], "mid": (last["b_low"] + last["b_high"]) // 2},
        "unit": last["unit"],
        "note": "설비 평균 단가 기반 추정치입니다. 실제 견적과 차이가 있을 수 있습니다.",
        "source": "한국기계산업진흥회 설비가격 동향 2023",
    }


# ==================== 3. 벤치마크 ====================
BENCHMARKS = {
    "press": {
        "avg_energy_cost_manwon": 3480,
        "avg_defect_rate_pct": 1.8,
        "avg_replacement_cycle_yr": 10,
        "maintenance_ratio": 0.25,
        "defect_unit_cost_manwon_per_pct": 400,
        "scenario_a": {
            "energy_reduction_rate": 0.30, "maintenance_reduction_rate": 0.55,
            "target_defect_rate_pct": 1.8, "label": "고효율 프레스 전체 교체", "default_subsidy": 12400,
        },
        "scenario_b": {
            "energy_reduction_rate": 0.10, "maintenance_reduction_rate": 0.25,
            "target_defect_rate_pct": 2.5, "label": "핵심 부품 교체 + 스마트 모니터링", "default_subsidy": 1500,
        },
        "sources": {
            "avg_energy_cost": "에너지공단 2023 업종별 에너지소비통계 — 금속가공업(C24) 중소기업 평균",
            "avg_defect_rate": "KICOX 2023 산업단지 제조업 품질 KPI 통계 — C24 업종 평균 불량률",
            "replacement_cycle": "한국설비관리학회 설비수명 가이드라인 — 유압 프레스 표준 교체주기",
            "reduction_rates": "에너지공단 고효율기자재 도입 효과 보고서 2023",
            "investment_cost": "한국기계산업진흥회 설비가격 동향 2023",
        },
    },
    "cnc": {
        "avg_energy_cost_manwon": 2100,
        "avg_defect_rate_pct": 1.2,
        "avg_replacement_cycle_yr": 10,
        "maintenance_ratio": 0.15,
        "defect_unit_cost_manwon_per_pct": 350,
        "scenario_a": {
            "energy_reduction_rate": 0.25, "maintenance_reduction_rate": 0.50,
            "target_defect_rate_pct": 1.2, "label": "5축 고정밀 CNC 신기종 교체", "default_subsidy": 8000,
        },
        "scenario_b": {
            "energy_reduction_rate": 0.08, "maintenance_reduction_rate": 0.20,
            "target_defect_rate_pct": 1.8, "label": "주요 부품 교체", "default_subsidy": 1500,
        },
        "sources": {
            "avg_energy_cost": "에너지공단 2023 업종별 에너지소비통계 — 금속가공업(C24)",
            "avg_defect_rate": "KICOX 2023 산업단지 제조업 품질 KPI 통계",
            "replacement_cycle": "한국설비관리학회 설비수명 가이드라인 — CNC 공작기계",
            "reduction_rates": "에너지공단 제조설비 에너지효율화 사업 효과 분석 2022",
            "investment_cost": "한국기계산업진흥회 설비가격 동향 2023",
        },
    },
    "injection": {
        "avg_energy_cost_manwon": 3900,
        "avg_defect_rate_pct": 2.1,
        "avg_replacement_cycle_yr": 10,
        "maintenance_ratio": 0.20,
        "defect_unit_cost_manwon_per_pct": 250,
        "scenario_a": {
            "energy_reduction_rate": 0.35, "maintenance_reduction_rate": 0.60,
            "target_defect_rate_pct": 2.1, "label": "전동식 사출성형기 교체", "default_subsidy": 10000,
        },
        "scenario_b": {
            "energy_reduction_rate": 0.12, "maintenance_reduction_rate": 0.30,
            "target_defect_rate_pct": 2.8, "label": "유압 실린더·클램프 부분 교체", "default_subsidy": 2000,
        },
        "sources": {
            "avg_energy_cost": "에너지공단 2023 업종별 에너지소비통계 — 플라스틱·고무업(C22)",
            "avg_defect_rate": "KICOX 2023 산업단지 제조업 품질 KPI 통계 — C22 업종",
            "replacement_cycle": "한국플라스틱산업협동조합 설비관리 가이드 — 사출성형기 표준수명",
            "reduction_rates": "에너지공단 전동식 사출성형기 도입효과 조사 2023",
            "investment_cost": "한국기계산업진흥회 설비가격 동향 2023",
        },
    },
}


# ==================== 4. 시나리오 계산 헬퍼 ====================
def _build_scenario(
    equipment: EquipmentInput,
    bench: dict,
    scenario_key: str,
    investment_override: Optional[int],
    subsidy_override: Optional[int],
) -> dict:
    s = bench[scenario_key]

    # 에너지 절감
    energy_saving = int(equipment.energy_cost_annual * s["energy_reduction_rate"])
    energy_method = "비용 기반 폴백"

    # 유지보수비 절감 (실입력 우선, 없으면 에너지비 비율로 추정)
    if equipment.maintenance_cost_annual is not None:
        maint_saving = int(equipment.maintenance_cost_annual * s["maintenance_reduction_rate"])
    else:
        est_maint = int(equipment.energy_cost_annual * bench["maintenance_ratio"])
        maint_saving = int(est_maint * s["maintenance_reduction_rate"])

    # 불량비용 절감
    defect_saving = 0
    defect_method = "절감 없음"
    if equipment.defect_rate is not None:
        rate_diff = equipment.defect_rate - s["target_defect_rate_pct"]
        if rate_diff > 0:
            if equipment.production_qty and equipment.contribution_margin_won:
                defect_saving = int(
                    equipment.production_qty
                    * (equipment.contribution_margin_won / 10000)
                    * (rate_diff / 100)
                )
                defect_method = "생산량 기반"
            else:
                defect_saving = int(rate_diff * bench["defect_unit_cost_manwon_per_pct"])
                defect_method = "업종 평균 기반"

    annual_net = energy_saving + maint_saving + defect_saving

    # 투자금 (직접 입력 → 용량 기반 추정 순)
    inv_estimation = None
    if investment_override is not None:
        investment = investment_override
    else:
        est = estimate_investment(equipment.category, equipment.capacity_value)
        if est:
            investment = est[scenario_key]["mid"]
            inv_estimation = est
        else:
            investment = None

    # 지원금
    subsidy = subsidy_override if subsidy_override is not None else s["default_subsidy"]

    # 실부담, 회수기간, ROI
    if investment is not None:
        net_inv = max(0, investment - subsidy)
        payback = round(net_inv / annual_net, 1) if annual_net > 0 else None
        roi_pct = round(annual_net / net_inv * 100, 1) if net_inv > 0 else None
    else:
        net_inv = None
        payback = None
        roi_pct = None

    result = {
        "label": s["label"],
        "investment_manwon": investment,
        "subsidy_manwon": subsidy,
        "net_investment_manwon": net_inv,
        "breakdown": {
            "energy_saving_manwon": energy_saving,
            "energy_saving_method": energy_method,
            "maintenance_saving_manwon": maint_saving,
            "defect_saving_manwon": defect_saving,
            "defect_saving_method": defect_method,
        },
        "annual_net_benefit_manwon": annual_net,
        "payback_years": payback,
        "roi_pct": roi_pct,
    }
    if inv_estimation:
        result["investment_estimation"] = inv_estimation
    return result


def _calc_data_quality(equipment: EquipmentInput) -> dict:
    optional_fields = [
        "defect_rate",
        "maintenance_cost_annual",
        "capacity_value",
        "production_qty",
        "contribution_margin_won",
    ]
    missing = [f for f in optional_fields if getattr(equipment, f) is None]
    score = round((len(optional_fields) - len(missing)) / len(optional_fields), 2)

    if score < 0.4:
        level, message = "low", "핵심 데이터가 부족합니다."
    elif score < 0.7:
        level, message = "medium", "일부 핵심 데이터가 부족합니다."
    else:
        level, message = "high", "충분한 데이터가 입력되었습니다."

    return {"score": score, "level": level, "missing_fields": missing, "message": message}


def _calc_ai_recommendation(
    scenario_a: dict,
    scenario_b: dict,
    equipment: EquipmentInput,
    bench: dict,
    equipment_status: dict,
    data_quality: dict,
) -> dict:
    a_payback = scenario_a["payback_years"]
    b_payback = scenario_b["payback_years"]
    a_net = scenario_a["annual_net_benefit_manwon"]
    b_net = scenario_b["annual_net_benefit_manwon"]
    is_overdue = equipment_status["is_overdue"]

    # 추천 결정 (연간 순효과 2배 가중, 노후 설비는 전체 교체 우선)
    score_a = score_b = 0
    if a_payback is not None and b_payback is not None:
        score_a += 1 if a_payback <= b_payback else 0
        score_b += 1 if b_payback < a_payback else 0
    score_a += 2 if a_net >= b_net else 0
    score_b += 1 if b_net > a_net else 0
    if is_overdue:
        score_a += 1

    decision = "A" if score_a >= score_b else "B"

    # 신뢰도
    base = 0.4 + data_quality["score"] * 0.4
    confidence = round(min(0.95, base + (0.1 if abs(score_a - score_b) >= 2 else 0.0)), 2)

    # 추천 근거
    top_reasons = []
    if is_overdue:
        top_reasons.append({
            "factor": "설비 노후도",
            "impact": "high",
            "message": (
                f"설비 연령이 업종 평균 교체주기({bench['avg_replacement_cycle_yr']}년)를 "
                f"{equipment_status['age_vs_cycle']}년 초과했습니다."
            ),
            "source": "법인세법 시행규칙 별표6",
        })
    if equipment.energy_cost_annual > bench["avg_energy_cost_manwon"]:
        ratio = round(equipment.energy_cost_annual / bench["avg_energy_cost_manwon"], 2)
        top_reasons.append({
            "factor": "에너지 비용",
            "impact": "medium",
            "message": f"현재 에너지비용이 업종 평균({bench['avg_energy_cost_manwon']}만원) 대비 {ratio}배 수준입니다.",
            "source": bench["sources"]["avg_energy_cost"],
        })
    if not top_reasons:
        top_reasons.append({
            "factor": "ROI",
            "impact": "medium",
            "message": f"시나리오 {decision}의 연간 순효과가 더 높습니다.",
            "source": "",
        })

    # 리스크
    risks = []
    chosen = scenario_a if decision == "A" else scenario_b
    if chosen["net_investment_manwon"] is not None and chosen["net_investment_manwon"] > 5000:
        risks.append({
            "type": "cashflow_risk",
            "level": "medium",
            "message": "초기 실투자금이 커서 현금흐름 부담이 있을 수 있습니다.",
        })
    if data_quality["level"] == "low":
        risks.append({
            "type": "data_quality_risk",
            "level": "high",
            "message": "입력 데이터 부족으로 계산 정확도가 낮습니다.",
        })

    # 전환 조건 (두 시나리오 회수기간이 같아지는 지원금 임계점)
    switching_conditions = []
    other_label = "B" if decision == "A" else "A"
    other = scenario_b if decision == "A" else scenario_a
    if (
        chosen["investment_manwon"] is not None
        and other["net_investment_manwon"] is not None
        and chosen["annual_net_benefit_manwon"] > 0
        and other["annual_net_benefit_manwon"] > 0
    ):
        threshold = int(
            chosen["investment_manwon"]
            - other["net_investment_manwon"]
            * chosen["annual_net_benefit_manwon"]
            / other["annual_net_benefit_manwon"]
        )
        if threshold > 0:
            switching_conditions.append({
                "condition": f"지원금이 {threshold:,}만원 이하로 낮아질 경우",
                "effect": f"시나리오 {other_label}가 더 유리해질 수 있습니다.",
            })

    # 다음 질문
    next_questions = []
    missing = data_quality["missing_fields"]
    if "maintenance_cost_annual" in missing:
        next_questions.append("연간 유지보수비를 입력하면 절감 효과 계산이 더 정확해집니다.")
    if "production_qty" in missing or "contribution_margin_won" in missing:
        next_questions.append("연간 생산량과 제품당 기여이익을 입력하면 불량비용 계산이 더 정확해집니다.")
    if "capacity_value" in missing:
        next_questions.append("설비 용량을 입력하면 투자금 추정이 더 정확해집니다.")

    return {
        "decision": decision,
        "confidence_score": confidence,
        "summary": f"AI는 시나리오 {decision}를 추천합니다. (신뢰도 {int(confidence * 100)}%, 데이터 품질 {data_quality['level']})",
        "top_reasons": top_reasons,
        "risks": risks,
        "switching_conditions": switching_conditions,
        "next_questions": next_questions,
    }


# ==================== 5. 메인 계산 ====================
def calculate_roi(roi_input: RoiInput) -> dict:
    equipment = roi_input.equipment
    bench = BENCHMARKS.get(equipment.category)
    if bench is None:
        raise ValueError(f"지원하지 않는 설비 카테고리입니다: {equipment.category}")

    scenario_a = _build_scenario(
        equipment, bench, "scenario_a",
        roi_input.scenario_a_investment_manwon,
        roi_input.scenario_a_subsidy_manwon,
    )
    scenario_b = _build_scenario(
        equipment, bench, "scenario_b",
        roi_input.scenario_b_investment_manwon,
        roi_input.scenario_b_subsidy_manwon,
    )

    equipment_status = {
        "age_vs_cycle": equipment.age_years - bench["avg_replacement_cycle_yr"],
        "is_overdue": equipment.age_years > bench["avg_replacement_cycle_yr"],
    }

    data_quality = _calc_data_quality(equipment)

    benchmark = {
        "avg_energy_cost_manwon": bench["avg_energy_cost_manwon"],
        "avg_defect_rate_pct": bench["avg_defect_rate_pct"],
        "avg_replacement_cycle_yr": bench["avg_replacement_cycle_yr"],
        "energy_vs_avg": round(equipment.energy_cost_annual / bench["avg_energy_cost_manwon"], 2),
        "sources": bench["sources"],
    }

    ai_recommendation = _calc_ai_recommendation(
        scenario_a, scenario_b, equipment, bench, equipment_status, data_quality
    )

    return {
        "scenario_a": scenario_a,
        "scenario_b": scenario_b,
        "recommended": ai_recommendation["decision"],
        "ai_recommendation": ai_recommendation,
        "data_quality": data_quality,
        "benchmark": benchmark,
        "equipment_status": equipment_status,
    }
