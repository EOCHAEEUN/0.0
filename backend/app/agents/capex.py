"""CAPEX Advisor Agent — 설비 교체 시나리오 A/B + ROI + 지원금 매칭"""
from app.tools.roi_calc import calculate_roi
from app.models.equipment import EquipmentInput

def build_scenarios(equipment: EquipmentInput, policies: list[dict]) -> dict:
    roi = calculate_roi(equipment)
    # TODO: 지원금 적용 후 실부담 + 회수기간 계산
    return {
        "scenario_a": {"type": "full_replacement", "roi": roi, "policies": policies},
        "scenario_b": {"type": "partial_maintenance", "roi": {}, "policies": []},
    }
