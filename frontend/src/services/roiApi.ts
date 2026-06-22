import { apiFetch } from "./apiClient"

type NullableNumber = number | null

export type RoiEquipmentInput = {
  equipment_id?: string
  equipmentId?: string

  name?: string
  equipment_name?: string

  category?: string
  equipment_category?: string

  age_years?: number | string | null
  ageYears?: number | string | null

  energy_cost_annual?: number | string | null
  energyCostAnnual?: number | string | null

  maintenance_cost_annual?: number | string | null
  maintenanceCostAnnual?: number | string | null

  defect_rate?: number | string | null
  defectRate?: number | string | null

  current_capacity_value?: number | string | null
  currentCapacityValue?: number | string | null

  production_qty?: number | string | null
  productionQty?: number | string | null

  contribution_margin_won?: number | string | null
  contributionMarginWon?: number | string | null

  scenario_a_investment_manwon?: number | string | null
  scenarioAInvestmentManwon?: number | string | null

  scenario_b_investment_manwon?: number | string | null
  scenarioBInvestmentManwon?: number | string | null
}

/**
 * RoiSimulateInput이 RoiEquipmentInput을 포함하게 만든다.
 * 그래서 simulateRoi({ name, category, ... })도 되고,
 * simulateRoi({ equipment: {...} })도 되고,
 * simulateRoi({ equipment_id })도 된다.
 */
export type RoiSimulateInput = RoiEquipmentInput & {
  equipment?: RoiEquipmentInput

  scenario_a_subsidy_manwon?: number | string | null
  scenarioASubsidyManwon?: number | string | null

  scenario_b_subsidy_manwon?: number | string | null
  scenarioBSubsidyManwon?: number | string | null
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === "") return fallback

  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? fallback : numberValue
}

const toOptionalNumber = (value: unknown): NullableNumber => {
  if (value === null || value === undefined || value === "") return null

  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? null : numberValue
}

export async function simulateRoi(input: RoiSimulateInput) {
  console.log("ROI API 요청 input:", input)

  const equipment: RoiEquipmentInput = input.equipment ?? input

  const equipmentId =
    input.equipment_id ??
    input.equipmentId ??
    equipment.equipment_id ??
    equipment.equipmentId

  /**
   * 최종 명세 기준 추천 방식:
   * 저장된 equipment_id만 보내고,
   * 백엔드가 equipment/company를 조회해서 ROI 계산.
   */
  const payload = equipmentId
    ? {
        equipment_id: equipmentId,
      }
    : {
        /**
         * direct input 방식:
         * 데모/임시용 fallback.
         */
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
          input.scenario_a_investment_manwon ??
            equipment.scenario_a_investment_manwon ??
            equipment.scenarioAInvestmentManwon,
        ),

        scenario_a_subsidy_manwon: toOptionalNumber(
          input.scenario_a_subsidy_manwon ??
            input.scenarioASubsidyManwon,
        ),

        scenario_b_investment_manwon: toOptionalNumber(
          input.scenario_b_investment_manwon ??
            equipment.scenario_b_investment_manwon ??
            equipment.scenarioBInvestmentManwon,
        ),

        scenario_b_subsidy_manwon: toOptionalNumber(
          input.scenario_b_subsidy_manwon ??
            input.scenarioBSubsidyManwon,
        ),
      }

  const response = await apiFetch("/roi/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    console.error("ROI API 요청 실패:", response.status)

    const message =
      json?.message ??
      json?.detail ??
      json?.error ??
      `ROI API 호출 실패: ${response.status}`

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    )
  }

  return json?.data ?? json
}
