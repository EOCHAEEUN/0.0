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

function normalizeEquipmentCategory(category: string) {
  const normalized = category.trim().toLowerCase()

  if (normalized.includes("press") || normalized.includes("프레스")) return "press"
  if (normalized.includes("cnc") || normalized.includes("공작") || normalized.includes("가공")) return "cnc"
  if (normalized.includes("injection") || normalized.includes("사출")) return "injection"

  return "etc"
}

type EquipmentPayloadFallback = {
  process: string | null
  defect_rate: number
  maintenance_cost_annual: number
  current_capacity_value: number
  production_qty: number
  contribution_margin_won: number
  scenario_a_investment_manwon: number
  scenario_b_investment_manwon: number
}

function getEquipmentPayloadFallback(
  equipment: EquipmentInfo,
  energyCostAnnual: number,
): EquipmentPayloadFallback {
  const category = normalizeEquipmentCategory(equipment.category)
  const energyBasedMaintenance =
    energyCostAnnual > 0 ? Math.round(energyCostAnnual * 0.018) : null

  if (category === "press") {
    return {
      process: "프레스공정",
      defect_rate: 3.4,
      maintenance_cost_annual: energyBasedMaintenance ?? 900,
      current_capacity_value: 250,
      production_qty: 120000,
      contribution_margin_won: 18000,
      scenario_a_investment_manwon: 20000,
      scenario_b_investment_manwon: 4000,
    }
  }

  if (category === "cnc") {
    return {
      process: "cnc",
      defect_rate: 1.6,
      maintenance_cost_annual: energyBasedMaintenance ?? 420,
      current_capacity_value: 35,
      production_qty: 85000,
      contribution_margin_won: 22000,
      scenario_a_investment_manwon: 10000,
      scenario_b_investment_manwon: 3000,
    }
  }

  if (category === "injection") {
    return {
      process: "사출공정",
      defect_rate: 2.8,
      maintenance_cost_annual: energyBasedMaintenance ?? 780,
      current_capacity_value: 450,
      production_qty: 100000,
      contribution_margin_won: 16000,
      scenario_a_investment_manwon: 18000,
      scenario_b_investment_manwon: 5000,
    }
  }

  return {
    process: equipment.process.trim() || null,
    defect_rate: 3,
    maintenance_cost_annual: energyBasedMaintenance ?? 500,
    current_capacity_value: 100,
    production_qty: 50000,
    contribution_margin_won: 12000,
    scenario_a_investment_manwon: 12000,
    scenario_b_investment_manwon: 4000,
  }
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
  }
}

export function buildEquipmentPayload(equipment: EquipmentInfo): EquipmentPayload {
  const energyCostAnnual =
    toPositiveNumber(normalizeCommaNumber(equipment.annualEnergyCost)) ?? 0
  const fallback = getEquipmentPayloadFallback(equipment, energyCostAnnual)

  return {
    equipment_id: equipment.equipmentId ?? null,
    name: equipment.name.trim(),
    category: equipment.category === "선택 필요" ? "etc" : equipment.category,
    process: equipment.process.trim() || fallback.process,
    age_years: toPositiveNumber(equipment.years) ?? 0,
    energy_cost_annual: energyCostAnnual,
    defect_rate: toNumberOrNull(equipment.defectRate) ?? fallback.defect_rate,
    maintenance_cost_annual:
      toNumberOrNull(normalizeCommaNumber(equipment.maintenanceCostAnnual)) ??
      fallback.maintenance_cost_annual,
    current_capacity_value:
      toNumberOrNull(equipment.currentCapacityValue) ?? fallback.current_capacity_value,
    production_qty: toNumberOrNull(equipment.productionQty) ?? fallback.production_qty,
    contribution_margin_won:
      toNumberOrNull(normalizeCommaNumber(equipment.contributionMarginWon)) ??
      fallback.contribution_margin_won,
    scenario_a_investment_manwon:
      toNumberOrNull(normalizeCommaNumber(equipment.scenarioAInvestment)) ??
      fallback.scenario_a_investment_manwon,
    scenario_b_investment_manwon:
      toNumberOrNull(normalizeCommaNumber(equipment.scenarioBInvestment)) ??
      fallback.scenario_b_investment_manwon,
  }
}

export function getCategoryLabel(category: string) {
  if (category === "press") return "press"
  if (category === "cnc") return "cnc"
  if (category === "injection") return "injection"
  if (category === "etc") return "기타"
  return category || "-"
}
