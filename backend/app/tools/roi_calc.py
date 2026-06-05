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


#==================== 1. 입력 모델 ====================
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
    "default": {
        "avg_energy_cost": 3000,
        "avg_defect_rate": 2.0,
        "avg_replacement_cycle": 10,
        "energy_reduction_rate": 0.25,
    },
}

def calculate_roi(equipment: EquipmentInput) -> dict:
    """설비 교체 ROI 계산 — 시나리오 A/B 기반"""
    bench = BENCHMARKS.get(equipment.category, BENCHMARKS["default"])
    energy_saving = int(equipment.energy_cost_annual * bench["energy_reduction_rate"])
    defect_saving = 0
    if equipment.defect_rate:
        defect_saving = int(max(0, equipment.defect_rate - bench["avg_defect_rate"]) * 300)
    return {
        "annual_energy_saving": energy_saving,
        "annual_defect_saving": defect_saving,
        "total_annual_saving": energy_saving + defect_saving,
        "age_vs_cycle": equipment.age_years - bench["avg_replacement_cycle"],
        "benchmark": bench,
    }
