from app.models.equipment import RoiInput
from app.models.roi_output import RoiOutput

# 업종별 평균 기준값 (KICOX / 에너지공단 통계 기반)
BENCHMARKS = {
    "press": {
        "avg_energy_cost": 3480,
        "avg_defect_rate": 1.8,
        "avg_replacement_cycle": 12,
        "energy_reduction_rate": 0.30,
        "avg_investment_full": 9000,     # 전체 교체 평균 투자금 (만원) - 임시값
        "avg_investment_partial": 3000,  # 부분 정비 평균 투자금 (만원) - 임시값
    },
    "cnc": {
        "avg_energy_cost": 2800,
        "avg_defect_rate": 1.5,
        "avg_replacement_cycle": 8,
        "energy_reduction_rate": 0.28,
        "avg_investment_full": 12000,
        "avg_investment_partial": 4000,
    },
    "compressor": {
        "avg_energy_cost": 2400,
        "avg_defect_rate": 1.2,
        "avg_replacement_cycle": 10,
        "energy_reduction_rate": 0.25,
        "avg_investment_full": 5000,
        "avg_investment_partial": 1500,
    },
    "default": {
        "avg_energy_cost": 3000,
        "avg_defect_rate": 2.0,
        "avg_replacement_cycle": 10,
        "energy_reduction_rate": 0.25,
        "avg_investment_full": 8000,
        "avg_investment_partial": 2500,
    },
}

def calculate_roi(roi_input: RoiInput) -> dict:
    """설비 교체 ROI 계산 — 시나리오 A/B 기반"""
    equipment = roi_input.equipment

    # category 정규화
    category = equipment.category.lower()
    if "프레스" in category or "press" in category:
        category = "press"
    elif "cnc" in category:
        category = "cnc"
    elif "컴프레셔" in category or "compressor" in category:
        category = "compressor"
    else:
        category = "default"

    bench = BENCHMARKS.get(category, BENCHMARKS["default"])

    # 에너지 절감액 계산
    if equipment.new_energy_cost_annual:
        energy_saving = equipment.energy_cost_annual - equipment.new_energy_cost_annual
    else:
        energy_saving = int(equipment.energy_cost_annual * bench["energy_reduction_rate"])

    # 불량 절감액 계산
    defect_saving = 0
    if equipment.defect_rate:
        defect_saving = int(max(0, equipment.defect_rate - bench["avg_defect_rate"]) * 300)

    # 투자금 계산
    scenario_a_investment = roi_input.scenario_a_investment_manwon or bench["avg_investment_full"]
    scenario_b_investment = roi_input.scenario_b_investment_manwon or bench["avg_investment_partial"]
    
    cycle = bench["avg_replacement_cycle"]
    total_saving = energy_saving + defect_saving

    from app.models.roi_output import RoiOutput  # ← 추가

    return RoiOutput(
        annual_energy_saving=energy_saving,
        annual_defect_saving=defect_saving,
        total_annual_saving=total_saving,
        scenario_a_investment=scenario_a_investment,
        scenario_b_investment=scenario_b_investment,
        scenario_a_payback_years=round(scenario_a_investment / total_saving, 1) if total_saving > 0 else 0,
        scenario_b_payback_years=round(scenario_b_investment / total_saving, 1) if total_saving > 0 else 0,
        scenario_a_roi_pct=round((total_saving * cycle - scenario_a_investment) / scenario_a_investment * 100, 1) if scenario_a_investment > 0 else 0,
        scenario_b_roi_pct=round((total_saving * cycle - scenario_b_investment) / scenario_b_investment * 100, 1) if scenario_b_investment > 0 else 0,
        recommendation="투자 권장" if round(scenario_b_investment / total_saving, 1) <= cycle / 2 else "재검토 필요",
    )
