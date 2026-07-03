"""
팩토핏 ROI 시뮬레이션 계산 엔진 (Pure Logic)

중요:
- 이 파일은 LangGraph와 독립적으로 동작합니다.
- 정책 매칭 전에는 지원금 0원 기준의 base ROI를 계산합니다.
- 정책 매칭 후에는 scenario별 실제 적용 지원금을 받아 final ROI를 계산합니다.
- default_subsidy 같은 고정 지원금은 최종 ROI에 사용하지 않습니다.
"""
from __future__ import annotations

from typing import Any, Optional

from app.models.equipment import EquipmentInput
from app.tools.equipment_normalizer import normalize_equipment_category


# ==================== 1. 투자금 추정 테이블 ====================
INVESTMENT_TABLE = {
    "press": [
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
                "scenario_a": {
                    "low": row["a_low"],
                    "high": row["a_high"],
                    "mid": (row["a_low"] + row["a_high"]) // 2,
                },
                "scenario_b": {
                    "low": row["b_low"],
                    "high": row["b_high"],
                    "mid": (row["b_low"] + row["b_high"]) // 2,
                },
                "unit": row["unit"],
                "note": "설비 평균 단가 기반 추정치입니다. 실제 견적과 차이가 있을 수 있습니다.",
                "source": "한국기계산업진흥회 설비가격 동향 2023",
            }

    last = table[-1]
    return {
        "scenario_a": {
            "low": last["a_low"],
            "high": last["a_high"],
            "mid": (last["a_low"] + last["a_high"]) // 2,
        },
        "scenario_b": {
            "low": last["b_low"],
            "high": last["b_high"],
            "mid": (last["b_low"] + last["b_high"]) // 2,
        },
        "unit": last["unit"],
        "note": "설비 평균 단가 기반 추정치입니다. 실제 견적과 차이가 있을 수 있습니다.",
        "source": "한국기계산업진흥회 설비가격 동향 2023",
    }


# ==================== 2. 업종 벤치마크 ====================
BENCHMARKS = {
    "press": {
        "avg_energy_cost_manwon": 3480,
        "avg_defect_rate_pct": 1.8,
        "avg_replacement_cycle_yr": 10,
        "maintenance_ratio": 0.25,
        "defect_unit_cost_manwon_per_pct": 400,
        "scenario_a": {
            "energy_reduction_rate": 0.30,
            "maintenance_reduction_rate": 0.55,
            "target_defect_rate_pct": 1.8,
            "label": "고효율 프레스 전체 교체",
            # 정책 미매칭 시 추정 지원율/한도 (실제 정책 적용 전 화면 표시용)
            "est_support_rate": 0.55,
            "est_max_support_manwon": 12400,
        },
        "scenario_b": {
            "energy_reduction_rate": 0.10,
            "maintenance_reduction_rate": 0.25,
            "target_defect_rate_pct": 2.5,
            "label": "핵심 부품 교체 + 스마트 모니터링",
            "est_support_rate": 0.50,
            "est_max_support_manwon": 1500,
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
            "energy_reduction_rate": 0.25,
            "maintenance_reduction_rate": 0.50,
            "target_defect_rate_pct": 1.2,
            "label": "5축 고정밀 CNC 신기종 교체",
            "est_support_rate": 0.50,
            "est_max_support_manwon": 8000,
        },
        "scenario_b": {
            "energy_reduction_rate": 0.08,
            "maintenance_reduction_rate": 0.20,
            "target_defect_rate_pct": 1.8,
            "label": "주요 부품 교체",
            "est_support_rate": 0.50,
            "est_max_support_manwon": 1500,
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
            "energy_reduction_rate": 0.35,
            "maintenance_reduction_rate": 0.60,
            "target_defect_rate_pct": 2.1,
            "label": "전동식 사출성형기 교체",
            "est_support_rate": 0.50,
            "est_max_support_manwon": 10000,
        },
        "scenario_b": {
            "energy_reduction_rate": 0.12,
            "maintenance_reduction_rate": 0.30,
            "target_defect_rate_pct": 2.8,
            "label": "유압 실린더·클램프 부분 교체",
            "est_support_rate": 0.50,
            "est_max_support_manwon": 2000,
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


def _to_nonnegative_number(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, number)


def _clean_policy_application(policy_application: Optional[dict]) -> dict:
    """
    policy.py가 만든 scenario별 지원금 적용 결과를 ROI 결과에 그대로 남긴다.
    지원금은 applied_support_manwon만 신뢰하고, 투자금 초과 여부는 시나리오에서 다시 막는다.
    """
    if not isinstance(policy_application, dict):
        return {
            "status": "not_applied",
            "applied_support_manwon": 0,
            "message": "정책 매칭 전 기준으로 계산했습니다.",
        }

    cleaned = dict(policy_application)
    cleaned["applied_support_manwon"] = _to_nonnegative_number(
        cleaned.get("applied_support_manwon")
    )
    cleaned.setdefault("status", "not_applied")
    return cleaned


# ==================== 3. 시나리오 기초/최종 계산 ====================
def _build_scenario(
    equipment: EquipmentInput,
    bench: dict,
    scenario_key: str,
    investment_override: Optional[int],
    policy_application: Optional[dict] = None,
    energy_provided: bool = True,
) -> dict:
    category = normalize_equipment_category(
        equipment.category,
        equipment.name,
        equipment.process,
    )
    scenario = bench[scenario_key]

    # 에너지 절감: 실제 입력 우선, 미입력 시 업종 평균 (단위: 만원)
    if not energy_provided:
        energy_cost = bench["avg_energy_cost_manwon"]
        energy_cost_source = "industry_benchmark"
        energy_method = "업종 평균 기준 추정"
    else:
        energy_cost = _to_nonnegative_number(equipment.energy_cost_annual)
        energy_cost_source = "user_input"
        energy_method = "비용 기반 계산"
        if 0 < energy_cost < 1:
            print(
                "[ROI_UNIT_WARNING] energy_cost_annual appears too small for manwon unit:",
                energy_cost,
            )

    energy_saving = int(energy_cost * scenario["energy_reduction_rate"])

    # 유지보수 절감: 실입력 우선, 없으면 에너지비 비율로 추정 (단위: 만원)
    if equipment.maintenance_cost_annual is not None:
        maintenance_saving = int(
            _to_nonnegative_number(equipment.maintenance_cost_annual)
            * scenario["maintenance_reduction_rate"]
        )
    else:
        estimated_maintenance = int(
            _to_nonnegative_number(energy_cost) * bench["maintenance_ratio"]
        )
        maintenance_saving = int(
            estimated_maintenance * scenario["maintenance_reduction_rate"]
        )

    # 불량비용 절감
    defect_saving = 0
    defect_method = "절감 없음"
    if equipment.defect_rate is not None:
        rate_diff = _to_nonnegative_number(equipment.defect_rate) - scenario["target_defect_rate_pct"]
        if rate_diff > 0:
            if equipment.production_qty and equipment.contribution_margin_won:
                defect_saving = int(
                    _to_nonnegative_number(equipment.production_qty)
                    * (_to_nonnegative_number(equipment.contribution_margin_won) / 10000)
                    * (rate_diff / 100)
                )
                defect_method = "생산량 기반"
            else:
                defect_saving = int(
                    rate_diff * bench["defect_unit_cost_manwon_per_pct"]
                )
                defect_method = "업종 평균 기반"

    annual_net_benefit = energy_saving + maintenance_saving + defect_saving

    # 투자금: 직접 입력 → 용량 기반 추정 → 업종 평균 폴백
    investment_estimation = None
    if investment_override is not None:
        investment = int(_to_nonnegative_number(investment_override))
    else:
        estimation = estimate_investment(category, equipment.current_capacity_value)
        if estimation:
            investment = estimation[scenario_key]["mid"]
            investment_estimation = estimation
        else:
            table = INVESTMENT_TABLE.get(category, [])
            if table:
                middle_row = table[len(table) // 2]
                if scenario_key == "scenario_a":
                    investment = (middle_row["a_low"] + middle_row["a_high"]) // 2
                else:
                    investment = (middle_row["b_low"] + middle_row["b_high"]) // 2
            else:
                investment = None

    # 지원금 산정
    # - policy_application 있음: 정책 매칭 결과의 실제 적용 지원금 사용
    # - policy_application 없음: 업종 벤치마크 지원율로 추정 (화면 표시용 추정치)
    if policy_application is not None:
        support = _clean_policy_application(policy_application)
    else:
        est_rate = scenario.get("est_support_rate", 0.0)
        est_max = scenario.get("est_max_support_manwon", 0)
        eligible = 0
        if investment is not None and est_rate > 0:
            eligible = round(investment * est_rate)
            estimated = int(min(eligible, est_max, investment))
        else:
            estimated = 0
        support = {
            "status": "estimated",
            "applied_support_manwon": float(estimated),
            "message": "정책 매칭 전 업종 평균 지원율 기반 추정치입니다.",
        }
        print(f"[ROI DEBUG] {scenario_key} 추정 지원금: investment={investment}, "
              f"rate={est_rate}, max={est_max}, eligible={eligible}, estimated={estimated}")

    requested_support = support["applied_support_manwon"]
    support_capped = False

    if investment is not None:
        if requested_support > investment:
            # 데이터 오류를 숨기지 않고 결과에 남기되, 실투자금 음수는 방지한다.
            requested_support = float(investment)
            support_capped = True
            support["applied_support_manwon"] = requested_support
            support["status"] = "capped_to_investment"
            support["message"] = (
                "정책 지원금이 투자금을 초과해 투자금 한도로 제한했습니다. "
                "정책 조건을 다시 확인하세요."
            )

        net_investment = int(max(0, investment - requested_support))
        if net_investment > 0 and annual_net_benefit > 0:
            payback_years = round(net_investment / annual_net_benefit, 1)
            roi_pct = round(annual_net_benefit / net_investment * 100, 1)
        else:
            payback_years = None
            roi_pct = None
    else:
        net_investment = None
        payback_years = None
        roi_pct = None

    result = {
        "label": scenario["label"],
        "investment_manwon": investment,
        "subsidy_manwon": int(requested_support),
        "net_investment_manwon": net_investment,
        "breakdown": {
            "energy_saving_manwon": energy_saving,
            "energy_saving_method": energy_method,
            "maintenance_saving_manwon": maintenance_saving,
            "defect_saving_manwon": defect_saving,
            "defect_saving_method": defect_method,
        },
        "annual_net_benefit_manwon": annual_net_benefit,
        "payback_years": payback_years,
        "roi_pct": roi_pct,
        "policy_application": support,
        "assumptions": {
            "energy_cost_annual_used": energy_cost,
            "energy_cost_source": energy_cost_source,
            "support_capped_to_investment": support_capped,
        },
    }
    if investment_estimation:
        result["investment_estimation"] = investment_estimation
    return result


def _calc_data_quality(equipment: EquipmentInput) -> dict:
    optional_fields = [
        "defect_rate",
        "maintenance_cost_annual",
        "current_capacity_value",
        "production_qty",
        "contribution_margin_won",
    ]
    missing = [field for field in optional_fields if getattr(equipment, field) is None]
    score = round((len(optional_fields) - len(missing)) / len(optional_fields), 2)

    if score < 0.4:
        level, message = "low", "핵심 데이터가 부족합니다."
    elif score < 0.7:
        level, message = "medium", "일부 핵심 데이터가 부족합니다."
    else:
        level, message = "high", "충분한 데이터가 입력되었습니다."

    return {
        "score": score,
        "level": level,
        "missing_fields": missing,
        "message": message,
    }


def _is_financially_valid(scenario: dict) -> bool:
    return bool(
        _to_nonnegative_number(scenario.get("investment_manwon")) > 0
        and _to_nonnegative_number(scenario.get("net_investment_manwon")) > 0
        and _to_nonnegative_number(scenario.get("annual_net_benefit_manwon")) > 0
        and scenario.get("roi_pct") is not None
        and scenario.get("payback_years") is not None
    )


def _calc_ai_recommendation(
    scenario_a: dict,
    scenario_b: dict,
    equipment: EquipmentInput,
    bench: dict,
    equipment_status: dict,
    data_quality: dict,
) -> dict:
    valid_a = _is_financially_valid(scenario_a)
    valid_b = _is_financially_valid(scenario_b)

    if not valid_a and not valid_b:
        return {
            "decision": None,
            "status": "insufficient_financial_data",
            "score_total": None,
            "scores": {},
            "reason_bullets": [
                "A/B안의 투자금·실투자금·연간 순편익 조건을 모두 확인한 뒤 추천할 수 있습니다."
            ],
            "confidence_score": 0,
            "summary": "정책 지원금 또는 투자 조건을 확인한 뒤 최종 추천안을 산정할 수 있습니다.",
            "top_reasons": [],
            "risks": [
                {
                    "type": "financial_calculation_risk",
                    "level": "high",
                    "message": "실투자금 또는 연간 순편익이 유효하지 않아 ROI 비교가 불가능합니다.",
                }
            ],
            "switching_conditions": [],
            "next_questions": [
                "정책 지원율과 지원 한도를 확인하면 최종 ROI를 계산할 수 있습니다."
            ],
        }

    if valid_a and not valid_b:
        decision = "A"
    elif valid_b and not valid_a:
        decision = "B"
    else:
        a_payback = scenario_a["payback_years"]
        b_payback = scenario_b["payback_years"]
        a_net = scenario_a["annual_net_benefit_manwon"]
        b_net = scenario_b["annual_net_benefit_manwon"]

        score_a = 0
        score_b = 0
        score_a += 1 if a_payback <= b_payback else 0
        score_b += 1 if b_payback < a_payback else 0
        score_a += 2 if a_net >= b_net else 0
        score_b += 1 if b_net > a_net else 0
        if equipment_status["is_overdue"]:
            score_a += 1
        decision = "A" if score_a >= score_b else "B"

    chosen = scenario_a if decision == "A" else scenario_b
    other = scenario_b if decision == "A" else scenario_a
    other_label = "B" if decision == "A" else "A"

    def clamp_score(value: float, minimum: int = 0, maximum: int = 100) -> int:
        return max(minimum, min(maximum, round(value)))

    def safe_ratio(numerator: Any, denominator: Any) -> float:
        denominator_number = _to_nonnegative_number(denominator)
        if denominator_number <= 0:
            return 0.0
        return _to_nonnegative_number(numerator) / denominator_number

    subsidy_fit = clamp_score(
        safe_ratio(chosen.get("subsidy_manwon"), chosen.get("investment_manwon")) * 150,
        0,
        96,
    )
    saving_effect = clamp_score(
        safe_ratio(
            chosen.get("annual_net_benefit_manwon"),
            chosen.get("net_investment_manwon"),
        ) * 190,
        0,
        96,
    )
    equipment_aging = clamp_score(
        safe_ratio(equipment.age_years, bench["avg_replacement_cycle_yr"]) * 82,
        35,
        96,
    )
    safety_risk = clamp_score(
        _to_nonnegative_number(equipment.age_years) * 4.8
        + _to_nonnegative_number(equipment.defect_rate) * 3.5,
        35,
        96,
    )
    score_total = clamp_score(
        subsidy_fit * 0.35
        + saving_effect * 0.25
        + equipment_aging * 0.20
        + safety_risk * 0.20
    )

    reason_bullets = []
    if chosen.get("policy_application", {}).get("status") in {"applied", "estimated"}:
        policy_title = chosen["policy_application"].get("policy_title", "매칭 정책")
        reason_bullets.append(
            f"{decision}안은 {policy_title} 조건을 반영해 초기 실투자금 부담을 낮췄습니다."
        )

    if (
        _to_nonnegative_number(scenario_a.get("annual_net_benefit_manwon"))
        > _to_nonnegative_number(scenario_b.get("annual_net_benefit_manwon"))
    ):
        reason_bullets.append("A안은 B안보다 연간 총 절감액이 커서 전체 개선 효과가 큽니다.")
    elif (
        _to_nonnegative_number(scenario_b.get("annual_net_benefit_manwon"))
        > _to_nonnegative_number(scenario_a.get("annual_net_benefit_manwon"))
    ):
        reason_bullets.append("B안은 초기 투자 부담과 회수 효율 측면에서 유리할 수 있습니다.")

    if equipment_status["is_overdue"]:
        reason_bullets.append("설비 사용연수가 업종 평균 교체주기를 초과해 전체 교체 필요성이 높습니다.")

    if not reason_bullets:
        reason_bullets.append(
            f"{decision}안이 실투자금, 연간 순편익, 회수기간, 설비 상태를 종합해 우선 검토 대상으로 산정되었습니다."
        )

    summary = (
        f"{decision}안은 정책 반영 실투자금, 연간 절감 효과, 설비 노후도를 종합한 "
        "A/B 투자안 비교에서 우선 검토 대상으로 산정되었습니다."
    )

    base_confidence = 0.4 + data_quality["score"] * 0.4
    confidence = round(min(0.95, base_confidence), 2)

    top_reasons = []
    if equipment_status["is_overdue"]:
        top_reasons.append(
            {
                "factor": "설비 노후도",
                "impact": "high",
                "message": (
                    f"설비 연령이 업종 평균 교체주기({bench['avg_replacement_cycle_yr']}년)를 "
                    f"{equipment_status['age_vs_cycle']}년 초과했습니다."
                ),
                "source": "법인세법 시행규칙 별표6",
            }
        )

    energy_cost_manwon = _to_nonnegative_number(equipment.energy_cost_annual)
    if energy_cost_manwon > bench["avg_energy_cost_manwon"]:
        ratio = round(
            energy_cost_manwon / bench["avg_energy_cost_manwon"],
            2,
        )
        top_reasons.append(
            {
                "factor": "에너지 비용",
                "impact": "medium",
                "message": (
                    f"현재 에너지비용이 업종 평균({bench['avg_energy_cost_manwon']}만원) "
                    f"대비 {ratio}배 수준입니다."
                ),
                "source": bench["sources"]["avg_energy_cost"],
            }
        )

    if not top_reasons:
        top_reasons.append(
            {
                "factor": "ROI",
                "impact": "medium",
                "message": f"시나리오 {decision}의 정책 반영 투자 효율이 더 높습니다.",
                "source": "",
            }
        )

    risks = []
    if _to_nonnegative_number(chosen.get("net_investment_manwon")) > 5000:
        risks.append(
            {
                "type": "cashflow_risk",
                "level": "medium",
                "message": "초기 실투자금이 커서 현금흐름 부담이 있을 수 있습니다.",
            }
        )
    if data_quality["level"] == "low":
        risks.append(
            {
                "type": "data_quality_risk",
                "level": "high",
                "message": "입력 데이터 부족으로 계산 정확도가 낮습니다.",
            }
        )

    switching_conditions = []
    if (
        _is_financially_valid(chosen)
        and _is_financially_valid(other)
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
            switching_conditions.append(
                {
                    "condition": f"지원금이 {threshold:,}만원 이하로 낮아질 경우",
                    "effect": f"시나리오 {other_label}가 더 유리해질 수 있습니다.",
                }
            )

    next_questions = []
    missing = data_quality["missing_fields"]
    if "maintenance_cost_annual" in missing:
        next_questions.append("연간 유지보수비를 입력하면 절감 효과 계산이 더 정확해집니다.")
    if "production_qty" in missing or "contribution_margin_won" in missing:
        next_questions.append("연간 생산량과 제품당 기여이익을 입력하면 불량비용 계산이 더 정확해집니다.")
    if "current_capacity_value" in missing:
        next_questions.append("설비 용량을 입력하면 투자금 추정이 더 정확해집니다.")

    return {
        "decision": decision,
        "status": "recommended",
        "score_total": score_total,
        "scores": {
            "subsidy_fit": subsidy_fit,
            "saving_effect": saving_effect,
            "equipment_aging": equipment_aging,
            "safety_risk": safety_risk,
        },
        "reason_bullets": reason_bullets[:3],
        "confidence_score": confidence,
        "summary": summary,
        "top_reasons": top_reasons,
        "risks": risks,
        "switching_conditions": switching_conditions,
        "next_questions": next_questions,
    }


# ==================== 4. 메인 계산 ====================
def calculate_roi(
    equipment: EquipmentInput,
    energy_provided: bool = True,
    policy_applications: Optional[dict[str, dict]] = None,
) -> dict:
    """
    정책 매칭 전/후 공통 ROI 계산 진입점.

    - policy_applications=None:
      지원금 0원 기준 base ROI. 정책 검색용으로 사용.
    - policy_applications={"scenario_a": {...}, "scenario_b": {...}}:
      정책별 실제 적용 지원금을 반영한 final ROI.
    """
    category = normalize_equipment_category(
        equipment.category,
        equipment.name,
        equipment.process,
    )
    bench = BENCHMARKS.get(category)
    if bench is None:
        raise ValueError(f"지원하지 않는 설비 카테고리입니다: {equipment.category}")

    applications = policy_applications or {}
    scenario_a_application = applications.get("scenario_a")
    scenario_b_application = applications.get("scenario_b")

    scenario_a = _build_scenario(
        equipment,
        bench,
        "scenario_a",
        equipment.scenario_a_investment_manwon,
        policy_application=scenario_a_application,
        energy_provided=energy_provided,
    )
    scenario_b = _build_scenario(
        equipment,
        bench,
        "scenario_b",
        equipment.scenario_b_investment_manwon,
        policy_application=scenario_b_application,
        energy_provided=energy_provided,
    )

    equipment_status = {
        "age_vs_cycle": equipment.age_years - bench["avg_replacement_cycle_yr"],
        "is_overdue": equipment.age_years > bench["avg_replacement_cycle_yr"],
    }
    data_quality = _calc_data_quality(equipment)

    energy_for_stats = (
        bench["avg_energy_cost_manwon"]
        if not energy_provided
        else _to_nonnegative_number(equipment.energy_cost_annual)
    )
    benchmark = {
        "avg_energy_cost_manwon": bench["avg_energy_cost_manwon"],
        "avg_defect_rate_pct": bench["avg_defect_rate_pct"],
        "avg_replacement_cycle_yr": bench["avg_replacement_cycle_yr"],
        "energy_vs_avg": round(
            _to_nonnegative_number(energy_for_stats)
            / bench["avg_energy_cost_manwon"],
            2,
        )
        if bench["avg_energy_cost_manwon"]
        else 0,
        "sources": bench["sources"],
    }

    ai_recommendation = _calc_ai_recommendation(
        scenario_a,
        scenario_b,
        equipment,
        bench,
        equipment_status,
        data_quality,
    )

    return {
        "analysis_stage": "final" if policy_applications is not None else "base",
        "scenario_a": scenario_a,
        "scenario_b": scenario_b,
        "policy_applications": {
            "scenario_a": scenario_a["policy_application"],
            "scenario_b": scenario_b["policy_application"],
        },
        "recommended": ai_recommendation["decision"],
        "ai_recommendation": ai_recommendation,
        "data_quality": data_quality,
        "benchmark": benchmark,
        "equipment_status": equipment_status,
    }
