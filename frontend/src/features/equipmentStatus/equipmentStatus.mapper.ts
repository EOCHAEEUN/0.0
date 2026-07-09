import type { EquipmentInfo, EquipmentPayload } from "../mypage/myPage.parts"
import {
  createEmptyEquipment,
  formatCommaNumber,
  normalizeCommaNumber,
  toNumberOrNull,
  toPositiveNumber,
} from "../mypage/myPage.parts"

function getStringValue(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function mapRemoteEquipment(item: unknown, index: number): EquipmentInfo {
  const equipment = getObject(item) ?? {}
  const category = getStringValue(equipment.category)

  return {
    ...createEmptyEquipment(index + 1),
    equipmentId:
      getStringValue(equipment.equipment_id) ||
      getStringValue(equipment.equipmentId) ||
      undefined,
    name: getStringValue(equipment.name),
    category: category || "선택 필요",
    process: getStringValue(equipment.process),
    years: getStringValue(equipment.age_years),
    annualEnergyCost: formatCommaNumber(getStringValue(equipment.energy_cost_annual)),
    defectRate: getStringValue(equipment.defect_rate),
    maintenanceCostAnnual: formatCommaNumber(
      getStringValue(equipment.maintenance_cost_annual),
    ),
    currentCapacityValue: getStringValue(equipment.current_capacity_value),
    productionQty: getStringValue(equipment.production_qty),
    contributionMarginWon: formatCommaNumber(
      getStringValue(equipment.contribution_margin_won),
    ),
    scenarioAInvestment: formatCommaNumber(
      getStringValue(equipment.scenario_a_investment_manwon),
    ),
    scenarioBInvestment: formatCommaNumber(
      getStringValue(equipment.scenario_b_investment_manwon),
    ),
    status: "저장된 설비",
    createdAt: getStringValue(equipment.created_at) || undefined,
  }
}

export function buildEquipmentPayload(equipment: EquipmentInfo): EquipmentPayload {
  const energyCostAnnual =
    toPositiveNumber(normalizeCommaNumber(equipment.annualEnergyCost)) ?? 0

  return {
    equipment_id: equipment.equipmentId ?? null,
    name: equipment.name.trim(),
    category: equipment.category === "선택 필요" ? "etc" : equipment.category,
    process: equipment.process.trim() || null,
    age_years: toPositiveNumber(equipment.years) ?? 0,
    energy_cost_annual: energyCostAnnual,
    defect_rate: toNumberOrNull(equipment.defectRate),
    maintenance_cost_annual:
      toNumberOrNull(normalizeCommaNumber(equipment.maintenanceCostAnnual)),
    current_capacity_value:
      toNumberOrNull(equipment.currentCapacityValue),
    production_qty: toNumberOrNull(equipment.productionQty),
    contribution_margin_won:
      toNumberOrNull(normalizeCommaNumber(equipment.contributionMarginWon)),
    scenario_a_investment_manwon:
      toNumberOrNull(normalizeCommaNumber(equipment.scenarioAInvestment)),
    scenario_b_investment_manwon:
      toNumberOrNull(normalizeCommaNumber(equipment.scenarioBInvestment)),
  }
}

export function getCategoryLabel(category: string) {
  if (category === "press") return "프레스"
  if (category === "cnc") return "CNC"
  if (category === "injection") return "사출"
  if (category === "welding") return "용접"
  if (category === "compressor") return "컴프레서"
  if (category === "etc") return "기타"
  if (category === "선택 필요") return "-"
  return category || "-"
}
