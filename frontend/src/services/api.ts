export async function simulateRoi(input: any) {
  console.log("ROI API 요청 input:", input)

  const equipment = input?.equipment ?? input ?? {}

  const toNumber = (value: any, fallback = 0) => {
    if (value === null || value === undefined || value === "") return fallback
    const numberValue = Number(value)
    return Number.isNaN(numberValue) ? fallback : numberValue
  }

  const toOptionalNumber = (value: any) => {
    if (value === null || value === undefined || value === "") return null
    const numberValue = Number(value)
    return Number.isNaN(numberValue) ? null : numberValue
  }

  const payload = {
    name: equipment.name ?? equipment.equipment_name ?? "",
    category: equipment.category ?? equipment.equipment_category ?? "press",
    age_years: toNumber(equipment.age_years ?? equipment.ageYears, 0),
    energy_cost_annual: toNumber(
      equipment.energy_cost_annual ?? equipment.energyCostAnnual,
      0,
    ),

    maintenance_cost_annual: toOptionalNumber(
      equipment.maintenance_cost_annual ?? equipment.maintenanceCostAnnual,
    ),
    defect_rate: toOptionalNumber(
      equipment.defect_rate ?? equipment.defectRate,
    ),
    current_capacity_value: toOptionalNumber(
      equipment.current_capacity_value ?? equipment.currentCapacityValue,
    ),
    production_qty: toOptionalNumber(
      equipment.production_qty ?? equipment.productionQty,
    ),
    contribution_margin_won: toOptionalNumber(
      equipment.contribution_margin_won ?? equipment.contributionMarginWon,
    ),

    scenario_a_investment_manwon: toOptionalNumber(
      input?.scenario_a_investment_manwon ??
        equipment.scenario_a_investment_manwon ??
        equipment.scenarioAInvestmentManwon,
    ),
    scenario_a_subsidy_manwon: toOptionalNumber(
      input?.scenario_a_subsidy_manwon ??
        equipment.scenario_a_subsidy_manwon ??
        equipment.scenarioASubsidyManwon,
    ),
    scenario_b_investment_manwon: toOptionalNumber(
      input?.scenario_b_investment_manwon ??
        equipment.scenario_b_investment_manwon ??
        equipment.scenarioBInvestmentManwon,
    ),
    scenario_b_subsidy_manwon: toOptionalNumber(
      input?.scenario_b_subsidy_manwon ??
        equipment.scenario_b_subsidy_manwon ??
        equipment.scenarioBSubsidyManwon,
    ),
  }

  console.log("ROI API 최종 payload:", payload)

  const response = await fetch("http://127.0.0.1:8000/api/roi/simulate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("ROI API 오류 응답:", errorText)
    throw new Error(`ROI API 호출 실패: ${response.status}`)
  }

  const json = await response.json()
  console.log("ROI API 응답:", json)

  return json.data
}