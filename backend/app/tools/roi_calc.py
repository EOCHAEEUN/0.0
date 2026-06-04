<<<<<<< HEAD
"""
팩토핏 ROI 시뮬레이션 엔진 
- 계산 엔진 + AI 판단 레이어
- AI 추천, 신뢰도, 이유, 리스크, 데이터 품질, 전환 조건 포함
"""

=======

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

>>>>>>> origin/feat/eochaeeun-prompt
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
<<<<<<< HEAD
        {"min": 0, "max": 200, "unit": "ton", "a_low": 8000, "a_high": 12000, "b_low": 1500, "b_high": 2500},
        {"min": 200, "max": 400, "unit": "ton", "a_low": 12000, "a_high": 18000, "b_low": 2500, "b_high": 4000},
        {"min": 400, "max": 9999, "unit": "ton", "a_low": 18000, "a_high": 25000, "b_low": 4000, "b_high": 6000},
    ],
    "cnc": [
        {"min": 0, "max": 20, "unit": "kW", "a_low": 8000, "a_high": 13000, "b_low": 1500, "b_high": 2500},
        {"min": 20, "max": 40, "unit": "kW", "a_low": 13000, "a_high": 20000, "b_low": 2500, "b_high": 4000},
        {"min": 40, "max": 9999, "unit": "kW", "a_low": 20000, "a_high": 30000, "b_low": 4000, "b_high": 7000},
    ],
    "injection": [
        {"min": 0, "max": 300, "unit": "ton", "a_low": 10000, "a_high": 15000, "b_low": 2000, "b_high": 3500},
        {"min": 300, "max": 500, "unit": "ton", "a_low": 15000, "a_high": 22000, "b_low": 3500, "b_high": 5500},
=======
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
>>>>>>> origin/feat/eochaeeun-prompt
        {"min": 500, "max": 9999, "unit": "ton", "a_low": 22000, "a_high": 35000, "b_low": 5500, "b_high": 9000},
    ],
}


def estimate_investment(category: str, capacity: Optional[float]) -> Optional[dict]:
    table = INVESTMENT_TABLE.get(category)
    if not table or capacity is None:
        return None
<<<<<<< HEAD

    for row in table:
        if row["min"] <= capacity < row["max"]:
            return {
                "scenario_a": {
                    "low": row["a_low"], "high": row["a_high"],
                    "mid": (row["a_low"] + row["a_high"]) // 2
                },
                "scenario_b": {
                    "low": row["b_low"], "high": row["b_high"],
                    "mid": (row["b_low"] + row["b_high"]) // 2
                },
                "unit": row["unit"],
                "note": "설비 평균 단가 기반 추정치입니다.",
            }

    last = table[-1]
    return {
        "scenario_a": {
            "low": last["a_low"], "high": last["a_high"],
            "mid": (last["a_low"] + last["a_high"]) // 2
        },
        "scenario_b": {
            "low": last["b_low"], "high": last["b_high"],
            "mid": (last["b_low"] + last["b_high"]) // 2
        },
        "unit": last["unit"],
        "note": "설비 평균 단가 기반 추정치입니다.",
=======
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
>>>>>>> origin/feat/eochaeeun-prompt
    }


# ==================== 3. 벤치마크 ====================
BENCHMARKS = {
    "press": {
        "avg_energy_cost_manwon": 3480,
        "avg_defect_rate_pct": 1.8,
        "avg_replacement_cycle_yr": 12,
        "maintenance_ratio": 0.25,
        "defect_unit_cost_manwon_per_pct": 400,
        "scenario_a": {
            "energy_reduction_rate": 0.30, "maintenance_reduction_rate": 0.55,
<<<<<<< HEAD
            "target_defect_rate_pct": 1.8, "label": "고효율 프레스 전체 교체", "default_subsidy": 12400
        },
        "scenario_b": {
            "energy_reduction_rate": 0.10, "maintenance_reduction_rate": 0.25,
            "target_defect_rate_pct": 2.5, "label": "핵심 부품 교체 + 스마트 모니터링", "default_subsidy": 1500
=======
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
>>>>>>> origin/feat/eochaeeun-prompt
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
<<<<<<< HEAD
            "target_defect_rate_pct": 1.2, "label": "5축 고정밀 CNC 신기종 교체", "default_subsidy": 8000
        },
        "scenario_b": {
            "energy_reduction_rate": 0.08, "maintenance_reduction_rate": 0.20,
            "target_defect_rate_pct": 1.8, "label": "주요 부품 교체", "default_subsidy": 1500
=======
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
>>>>>>> origin/feat/eochaeeun-prompt
        },
    },
    "injection": {
        "avg_energy_cost_manwon": 3900,
        "avg_defect_rate_pct": 2.1,
        "avg_replacement_cycle_yr": 13,
        "maintenance_ratio": 0.20,
        "defect_unit_cost_manwon_per_pct": 250,
        "scenario_a": {
            "energy_reduction_rate": 0.35, "maintenance_reduction_rate": 0.60,
<<<<<<< HEAD
            "target_defect_rate_pct": 2.1, "label": "전동식 사출성형기 교체", "default_subsidy": 10000
        },
        "scenario_b": {
            "energy_reduction_rate": 0.12, "maintenance_reduction_rate": 0.30,
            "target_defect_rate_pct": 2.8, "label": "유압 실린더·클램프 부분 교체", "default_subsidy": 2000
=======
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
>>>>>>> origin/feat/eochaeeun-prompt
        },
    },
    "default": {
        "avg_energy_cost_manwon": 3000,
        "avg_defect_rate_pct": 2.0,
        "avg_replacement_cycle_yr": 10,
        "maintenance_ratio": 0.20,
        "defect_unit_cost_manwon_per_pct": 300,
        "scenario_a": {
            "energy_reduction_rate": 0.25, "maintenance_reduction_rate": 0.50,
<<<<<<< HEAD
            "target_defect_rate_pct": 2.0, "label": "고효율 신설비 교체", "default_subsidy": 8000
        },
        "scenario_b": {
            "energy_reduction_rate": 0.08, "maintenance_reduction_rate": 0.20,
            "target_defect_rate_pct": 2.5, "label": "핵심 부품 부분 교체", "default_subsidy": 1500
=======
            "target_defect_rate_pct": 2.0, "label": "고효율 신설비 교체", "default_subsidy": 8000,
        },
        "scenario_b": {
            "energy_reduction_rate": 0.08, "maintenance_reduction_rate": 0.20,
            "target_defect_rate_pct": 2.5, "label": "핵심 부품 부분 교체", "default_subsidy": 1500,
        },
        "sources": {
            "avg_energy_cost": "에너지공단 2023 업종별 에너지소비통계 — 제조업 평균",
            "avg_defect_rate": "KICOX 2023 산업단지 제조업 품질 KPI 통계 — 제조업 평균",
            "replacement_cycle": "한국설비관리학회 설비수명 가이드라인 — 제조업 평균",
            "reduction_rates": "에너지공단 설비효율화 지원사업 효과 분석",
            "investment_cost": "한국기계산업진흥회 설비가격 동향 2023",
>>>>>>> origin/feat/eochaeeun-prompt
        },
    },
}


# ==================== 4. 계산 함수 ====================
def _calc_energy_saving(equipment: EquipmentInput, reduction_rate: float) -> dict:
    if equipment.capacity_value and equipment.category == "cnc":
        hours = equipment.annual_operating_hours or 2500
        load = equipment.load_factor or 0.75
        price = equipment.electricity_price_won or 140
        current_kwh = equipment.capacity_value * hours * load
        saving_kwh = current_kwh * reduction_rate
        return {
            "amount_manwon": int(saving_kwh * price / 10000),
<<<<<<< HEAD
            "method": "kWh 기반 정밀 계산"
        }
    return {
        "amount_manwon": int(equipment.energy_cost_annual * reduction_rate),
        "method": "비용 기반 폴백"
=======
            "method": "kWh 기반 정밀 계산",
        }
    return {
        "amount_manwon": int(equipment.energy_cost_annual * reduction_rate),
        "method": "비용 기반 폴백",
>>>>>>> origin/feat/eochaeeun-prompt
    }


def _calc_defect_saving(equipment: EquipmentInput, bench: dict, target_rate: float) -> dict:
    current_rate = equipment.defect_rate or bench["avg_defect_rate_pct"]
    if equipment.production_qty and equipment.contribution_margin_won:
        old_cost = int(equipment.production_qty * (current_rate / 100) * equipment.contribution_margin_won / 10000)
        new_cost = int(equipment.production_qty * (target_rate / 100) * equipment.contribution_margin_won / 10000)
        return {"amount_manwon": max(0, old_cost - new_cost), "method": "정밀 계산"}
<<<<<<< HEAD

    if current_rate > bench["avg_defect_rate_pct"]:
        unit = bench["defect_unit_cost_manwon_per_pct"]
        improvement = max(0, current_rate - target_rate)
=======
    if current_rate > bench["avg_defect_rate_pct"]:
        unit = bench["defect_unit_cost_manwon_per_pct"]
        improvement = max(0.0, current_rate - target_rate)
>>>>>>> origin/feat/eochaeeun-prompt
        return {"amount_manwon": int(improvement * unit), "method": "업종 평균 기반"}
    return {"amount_manwon": 0, "method": "절감 없음"}


<<<<<<< HEAD
def _calc_scenario(bench, key, equipment, investment, subsidy, maintenance_cost):
=======
def _calc_scenario(bench: dict, key: str, equipment: EquipmentInput,
                   investment: int, subsidy: int, maintenance_cost: int) -> dict:
>>>>>>> origin/feat/eochaeeun-prompt
    s = bench[key]
    net_investment = max(1, investment - subsidy)

    energy = _calc_energy_saving(equipment, s["energy_reduction_rate"])
    maint = int(maintenance_cost * s["maintenance_reduction_rate"])
    defect = _calc_defect_saving(equipment, bench, s["target_defect_rate_pct"])

    annual_benefit = energy["amount_manwon"] + maint + defect["amount_manwon"]
    payback = round(net_investment / annual_benefit, 1) if annual_benefit > 0 else None
    roi = round(annual_benefit / net_investment * 100, 1) if net_investment > 0 else None

    return {
        "label": s["label"],
        "investment_manwon": investment,
        "subsidy_manwon": subsidy,
        "net_investment_manwon": net_investment,
        "breakdown": {
            "energy_saving_manwon": energy["amount_manwon"],
<<<<<<< HEAD
            "maintenance_saving_manwon": maint,
            "defect_saving_manwon": defect["amount_manwon"],
=======
            "energy_saving_method": energy["method"],
            "maintenance_saving_manwon": maint,
            "defect_saving_manwon": defect["amount_manwon"],
            "defect_saving_method": defect["method"],
>>>>>>> origin/feat/eochaeeun-prompt
        },
        "annual_net_benefit_manwon": annual_benefit,
        "payback_years": payback,
        "roi_pct": roi,
    }


# ==================== 5. AI 레이어 ====================
def _assess_data_quality(equipment: EquipmentInput) -> dict:
    fields = {
        "energy_cost_annual": equipment.energy_cost_annual is not None,
        "defect_rate": equipment.defect_rate is not None,
        "maintenance_cost_annual": equipment.maintenance_cost_annual is not None,
        "capacity_value": equipment.capacity_value is not None,
        "production_qty": equipment.production_qty is not None,
        "contribution_margin_won": equipment.contribution_margin_won is not None,
    }
<<<<<<< HEAD
    score = sum(0.16 for v in fields.values() if v)
    missing = [k for k, v in fields.items() if not v]
    level = "high" if score >= 0.75 else "medium" if score >= 0.5 else "low"
    return {
        "score": round(score, 2),
        "level": level,
        "missing_fields": missing,
        "message": "데이터가 충분합니다." if level == "high" else "일부 핵심 데이터가 부족합니다."
    }


def _score_scenario(scenario, equipment_status, data_quality):
    roi_score = min((scenario["roi_pct"] or 0) / 50, 1.0)
    payback_score = 0 if scenario["payback_years"] is None else max(0, min(1, 1 - scenario["payback_years"] / 8))
    age_score = 1.0 if equipment_status.get("is_overdue") else 0.6
    total = roi_score * 0.35 + payback_score * 0.30 + age_score * 0.20 + data_quality["score"] * 0.15
    return {"score": round(total, 3)}


def _build_ai_recommendation(equipment, scenario_a, scenario_b, equipment_status, data_quality):
=======
    filled = sum(1 for v in fields.values() if v)
    total = len(fields)
    score = round(filled / total, 2)
    level = "high" if score >= 0.75 else "medium" if score >= 0.5 else "low"
    missing = [k for k, v in fields.items() if not v]
    return {
        "score": score,
        "level": level,
        "missing_fields": missing,
        "message": "데이터가 충분합니다." if level == "high" else "일부 핵심 데이터가 부족합니다.",
    }


def _score_scenario(scenario: dict, equipment_status: dict, data_quality: dict) -> dict:
    roi_score = min((scenario["roi_pct"] or 0) / 50, 1.0)
    payback_score = (
        0.0 if scenario["payback_years"] is None
        else max(0.0, min(1.0, 1 - scenario["payback_years"] / 8))
    )
    age_score = 1.0 if equipment_status.get("is_overdue") else 0.6
    total = (
        roi_score * 0.35
        + payback_score * 0.30
        + age_score * 0.20
        + data_quality["score"] * 0.15
    )
    return {"score": round(total, 3)}


def _build_ai_recommendation(
    equipment: EquipmentInput,
    scenario_a: dict,
    scenario_b: dict,
    equipment_status: dict,
    data_quality: dict,
    bench: dict,
) -> dict:
>>>>>>> origin/feat/eochaeeun-prompt
    score_a = _score_scenario(scenario_a, equipment_status, data_quality)
    score_b = _score_scenario(scenario_b, equipment_status, data_quality)

    decision = "A" if score_a["score"] >= score_b["score"] else "B"
    selected = scenario_a if decision == "A" else scenario_b
    other = scenario_b if decision == "A" else scenario_a

    reasons = []
    if equipment_status.get("is_overdue"):
<<<<<<< HEAD
        reasons.append({"factor": "설비 노후도", "impact": "high", "message": "설비 연령이 평균 교체주기를 초과했습니다."})
    if selected["annual_net_benefit_manwon"] > other["annual_net_benefit_manwon"] * 1.3:
        reasons.append({"factor": "연간 순편익", "impact": "high", "message": "연간 절감 효과가 더 큽니다."})

    risks = []
    if selected["net_investment_manwon"] > 12000:
        risks.append({"type": "cashflow_risk", "level": "medium", "message": "초기 실투자금이 커서 현금흐름 부담이 있을 수 있습니다."})

    switching = []
    if decision == "A":
        switching.append({"condition": "A 지원금이 6500만원 이하로 낮아질 경우", "effect": "B가 더 유리해질 수 있습니다."})

    confidence = min(0.92, 0.55 + (score_a["score"] - score_b["score"]) * 1.2 + data_quality["score"] * 0.25)
=======
        reasons.append({
            "factor": "설비 노후도",
            "impact": "high",
            "message": f"설비 연령이 업종 평균 교체주기({bench['avg_replacement_cycle_yr']}년)를 초과했습니다.",
            "source": bench["sources"]["replacement_cycle"],
        })
    if selected["annual_net_benefit_manwon"] > other["annual_net_benefit_manwon"] * 1.3:
        reasons.append({
            "factor": "연간 순편익",
            "impact": "high",
            "message": f"연간 절감 효과가 시나리오 {'B' if decision == 'A' else 'A'} 대비 30% 이상 큽니다.",
        })
    if selected["payback_years"] and other["payback_years"]:
        if selected["payback_years"] < other["payback_years"]:
            reasons.append({
                "factor": "투자 회수기간",
                "impact": "medium",
                "message": f"회수기간이 {round(other['payback_years'] - selected['payback_years'], 1)}년 더 짧습니다.",
            })

    risks = []
    if selected["net_investment_manwon"] > 12000:
        risks.append({
            "type": "cashflow_risk",
            "level": "medium",
            "message": "초기 실투자금이 커서 현금흐름 부담이 있을 수 있습니다.",
        })
    if data_quality["level"] == "low":
        risks.append({
            "type": "data_risk",
            "level": "low",
            "message": "입력 데이터가 부족해 계산 정확도가 낮을 수 있습니다.",
        })

    switching = []
    if decision == "A":
        switching.append({
            "condition": f"지원금이 {bench['scenario_a']['default_subsidy'] * 0.5:.0f}만원 이하로 낮아질 경우",
            "effect": "시나리오 B가 더 유리해질 수 있습니다.",
        })

    score_gap = abs(score_a["score"] - score_b["score"])
    confidence = min(0.92, 0.55 + score_gap * 1.2 + data_quality["score"] * 0.25)
>>>>>>> origin/feat/eochaeeun-prompt

    return {
        "decision": decision,
        "confidence_score": round(confidence, 2),
<<<<<<< HEAD
        "summary": f"AI는 시나리오 {decision}를 우선 추천합니다.",
=======
        "summary": (
            f"AI는 시나리오 {decision}를 추천합니다. "
            f"(신뢰도 {round(confidence * 100)}%, 데이터 품질 {data_quality['level']})"
        ),
>>>>>>> origin/feat/eochaeeun-prompt
        "top_reasons": reasons[:3],
        "risks": risks,
        "switching_conditions": switching,
        "next_questions": [
<<<<<<< HEAD
            "연간 생산량과 제품당 기여이익을 입력하면 불량비용 계산이 더 정확해집니다.",
            "최근 유지보수비 추이를 알려주시면 노후 리스크 판단이 더 정확해집니다."
        ]
=======
            q for q in [
                "연간 생산량과 제품당 기여이익을 입력하면 불량비용 계산이 더 정확해집니다." if "production_qty" in data_quality["missing_fields"] else None,
                "최근 유지보수비를 입력하면 노후 리스크 판단이 더 정확해집니다." if "maintenance_cost_annual" in data_quality["missing_fields"] else None,
                "설비 용량을 입력하면 투자금 추정이 더 정확해집니다." if "capacity_value" in data_quality["missing_fields"] else None,
            ] if q
        ],
>>>>>>> origin/feat/eochaeeun-prompt
    }


# ==================== 6. 메인 함수 ====================
def calculate_roi(roi_input: RoiInput) -> dict:
    equipment = roi_input.equipment
    bench = BENCHMARKS.get(equipment.category, BENCHMARKS["default"])

    maintenance_cost = equipment.maintenance_cost_annual or int(
        equipment.energy_cost_annual * bench["maintenance_ratio"]
    )
<<<<<<< HEAD

    estimated = estimate_investment(equipment.category, equipment.capacity_value)

    a_inv = roi_input.scenario_a_investment_manwon if roi_input.scenario_a_investment_manwon is not None else (estimated["scenario_a"]["mid"] if estimated else 18000)
    a_sub = roi_input.scenario_a_subsidy_manwon if roi_input.scenario_a_subsidy_manwon is not None else bench["scenario_a"]["default_subsidy"]
    b_inv = roi_input.scenario_b_investment_manwon if roi_input.scenario_b_investment_manwon is not None else (estimated["scenario_b"]["mid"] if estimated else 3000)
    b_sub = roi_input.scenario_b_subsidy_manwon if roi_input.scenario_b_subsidy_manwon is not None else bench["scenario_b"]["default_subsidy"]
=======
    estimated = estimate_investment(equipment.category, equipment.capacity_value)

    a_inv = roi_input.scenario_a_investment_manwon or (estimated["scenario_a"]["mid"] if estimated else 18000)
    a_sub = roi_input.scenario_a_subsidy_manwon or bench["scenario_a"]["default_subsidy"]
    b_inv = roi_input.scenario_b_investment_manwon or (estimated["scenario_b"]["mid"] if estimated else 3000)
    b_sub = roi_input.scenario_b_subsidy_manwon or bench["scenario_b"]["default_subsidy"]
>>>>>>> origin/feat/eochaeeun-prompt

    scenario_a = _calc_scenario(bench, "scenario_a", equipment, a_inv, a_sub, maintenance_cost)
    scenario_b = _calc_scenario(bench, "scenario_b", equipment, b_inv, b_sub, maintenance_cost)

    data_quality = _assess_data_quality(equipment)
    equipment_status = {
        "age_vs_cycle": equipment.age_years - bench["avg_replacement_cycle_yr"],
        "is_overdue": equipment.age_years > bench["avg_replacement_cycle_yr"],
    }

<<<<<<< HEAD
    ai = _build_ai_recommendation(equipment, scenario_a, scenario_b, equipment_status, data_quality)
=======
    ai = _build_ai_recommendation(
        equipment, scenario_a, scenario_b, equipment_status, data_quality, bench
    )
>>>>>>> origin/feat/eochaeeun-prompt

    return {
        "scenario_a": scenario_a,
        "scenario_b": scenario_b,
        "recommended": ai["decision"],
        "ai_recommendation": ai,
        "data_quality": data_quality,
        "investment_estimation": estimated,
        "benchmark": {
            "avg_energy_cost_manwon": bench["avg_energy_cost_manwon"],
            "avg_defect_rate_pct": bench["avg_defect_rate_pct"],
<<<<<<< HEAD
=======
            "avg_replacement_cycle_yr": bench["avg_replacement_cycle_yr"],
            "energy_vs_avg": round(equipment.energy_cost_annual / bench["avg_energy_cost_manwon"], 2),
            "sources": bench["sources"],
>>>>>>> origin/feat/eochaeeun-prompt
        },
        "equipment_status": equipment_status,
    }