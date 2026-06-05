from app.models.equipment import EquipmentInput

# 업종별 평균 기준값 (KICOX / 에너지공단 통계 기반)
BENCHMARKS = {
    "press": {
        "avg_energy_cost": 3480,
        "avg_defect_rate": 1.8,
        "avg_replacement_cycle": 12,
        "energy_reduction_rate": 0.30,
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
