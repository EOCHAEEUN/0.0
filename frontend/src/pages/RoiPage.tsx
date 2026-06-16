import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useRef,
  useState,
} from "react"
import { useNavigate } from "react-router-dom"
import { simulateRoi } from "../services/api"

type ApiStatus = "idle" | "loading" | "success" | "empty" | "error"

type RoiFormState = {
  equipmentType: string
  industryCode: string
  industryName: string
  region: string
  equipmentName: string
  equipmentAge: string
  annualEnergyCostManwon: string
  employees: string
  annualRevenueManwon: string
  scenarioAInvestmentManwon: string
  scenarioBInvestmentManwon: string
  defectRate: string
  annualMaintenanceCostManwon: string
}

type RoiApiScenario = {
  label?: string
  investment_manwon?: number
  subsidy_manwon?: number
  net_investment_manwon?: number
  annual_net_benefit_manwon?: number
  payback_years?: number
  roi_pct?: number
}

type RoiApiData = {
  scenario_a?: RoiApiScenario
  scenario_b?: RoiApiScenario
  recommended?: string
}

type RoiApiResponse = {
  success?: boolean
  data?: RoiApiData | null
  scenario_a?: RoiApiScenario
  scenario_b?: RoiApiScenario
  recommended?: string
}

type ScenarioCard = {
  id: "A" | "B"
  badge: string
  title: string
  subtitle: string
  investmentManwon: number
  subsidyManwon: number
  netInvestmentManwon: number
  energySavingManwon: number
  maintenanceSavingManwon: number
  defectSavingManwon: number
  annualNetBenefitManwon: number
  paybackYears: number | null
  roiPct: number
  estimateRangeText: string
  estimateBasisText: string
}

type ScoreSummary = {
  supportFit: number
  savingEffect: number
  aging: number
  safetyRisk: number
  total: number
}

const INDUSTRY_CODE_TO_NAME: Record<string, string> = {
  C24: "1차 금속 제조업",
  C25: "금속가공제품 제조업",
  C26: "전자부품 · 컴퓨터 · 영상 · 음향 및 통신장비 제조업",
  C27: "전기장비 제조업",
  C28: "기타 기계 및 장비 제조업",
  C29: "자동차 및 트레일러 제조업",
  C30: "기타 운송장비 제조업",
}

const MY_PAGE_STORAGE_KEY = "factofit_mypage_profile"

const EQUIPMENT_TYPE_OPTIONS = [
  {
    value: "press / 프레스",
    key: "press",
    labelKo: "프레스",
    defaultName: "1600톤 프레스 #1",
    keywords: ["press", "프레스"],
  },
  {
    value: "cnc / CNC",
    key: "cnc",
    labelKo: "CNC",
    defaultName: "CNC 가공기 #1",
    keywords: ["cnc"],
  },
  {
    value: "injection / 사출",
    key: "injection",
    labelKo: "사출",
    defaultName: "사출성형기 #1",
    keywords: ["injection", "사출"],
  },
] as const

const initialForm: RoiFormState = {
  equipmentType: "press / 프레스",
  industryCode: "",
  industryName: "",
  region: "",
  equipmentName: "",
  equipmentAge: "",
  annualEnergyCostManwon: "",
  employees: "",
  annualRevenueManwon: "",
  scenarioAInvestmentManwon: "",
  scenarioBInvestmentManwon: "",
  defectRate: "",
  annualMaintenanceCostManwon: "",
}

const colors = {
  navy: "#061B34",
  blue: "#344BA0",
  blue2: "#5860D3",
  green: "#5A8D5E",
  greenSoft: "#EEF5ED",
  text: "#061B34",
  muted: "#667085",
  line: "#D8DEEA",
  lineSoft: "#E4EAF3",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  soft: "#F7F9FC",
  grayButton: "#AAB2C4",
  gold: "#B08B4B",
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: "68px",
  borderRadius: "22px",
  border: `1px solid ${colors.line}`,
  background: "#FFFFFF",
  color: colors.text,
  fontSize: "18px",
  lineHeight: 1,
  fontWeight: 900,
  padding: "0 20px",
  outline: "none",
  boxSizing: "border-box",
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "auto",
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function roundTo(value: number, digits = 1) {
  const unit = 10 ** digits
  return Math.round(value * unit) / unit
}

function normalizeNumberString(value: string | number | undefined | null) {
  return String(value ?? "").replace(/,/g, "").trim()
}

function toNumber(value: string | number | undefined | null, fallback = 0) {
  const num = Number(normalizeNumberString(value))
  return Number.isFinite(num) ? num : fallback
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

function formatCommaNumber(value: string | number | undefined | null) {
  const normalized = onlyDigits(String(value ?? ""))

  if (!normalized) return ""

  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value))
}

function formatMoneyFromManwon(value: number) {
  const normalized = Number.isFinite(value) ? value : 0

  if (Math.abs(normalized) >= 10000) {
    const eok = normalized / 10000
    return `${roundTo(eok, 1)}억`
  }

  return `${formatNumber(normalized)}만원`
}

function formatAnnualMoneyFromManwon(value: number) {
  return `${formatMoneyFromManwon(value)}/년`
}

function formatPaybackYears(value: number | null) {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return "-"
  }

  if (value < 1) {
    return `${Math.max(Math.round(value * 12), 1)}개월`
  }

  const rounded = roundTo(value, 1)

  if (Number.isInteger(rounded)) {
    return `${rounded}년`
  }

  return `${rounded}년`
}

function getEquipmentTypeOptionByKey(key: string) {
  return (
    EQUIPMENT_TYPE_OPTIONS.find((item) => item.key === key) ??
    EQUIPMENT_TYPE_OPTIONS[0]
  )
}

function normalizeEquipmentTypeValue(value: string | undefined | null) {
  const normalized = String(value ?? "").toLowerCase()

  if (normalized.includes("cnc")) return getEquipmentTypeOptionByKey("cnc").value
  if (normalized.includes("injection") || normalized.includes("사출")) {
    return getEquipmentTypeOptionByKey("injection").value
  }
  if (normalized.includes("press") || normalized.includes("프레스")) {
    return getEquipmentTypeOptionByKey("press").value
  }

  return getEquipmentTypeOptionByKey("press").value
}

function getDefaultEquipmentName(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)
  return getEquipmentTypeOptionByKey(key).defaultName
}

function detectEquipmentTypeFromName(name: string) {
  const normalized = name.toLowerCase()

  return EQUIPMENT_TYPE_OPTIONS.find((option) =>
    option.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  )?.value
}

function hasConflictingEquipmentName(name: string, equipmentType: string) {
  const detectedType = detectEquipmentTypeFromName(name)

  if (!detectedType) return false

  return getEquipmentCategoryKey(detectedType) !== getEquipmentCategoryKey(equipmentType)
}

function isDefaultEquipmentName(name: string) {
  return EQUIPMENT_TYPE_OPTIONS.some((option) => option.defaultName === name)
}

function getFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function getFirstNumberString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue

    const normalized = normalizeNumberString(String(value))

    if (normalized) return normalized
  }

  return ""
}

function getPrimaryIndustryCode(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim()
  }

  return String(value ?? "").split(",")[0]?.trim() ?? ""
}

function getInitialFormFromMyPage(): RoiFormState {
  if (typeof window === "undefined") {
    return initialForm
  }

  try {
    const raw = window.localStorage.getItem(MY_PAGE_STORAGE_KEY)
    if (!raw) return initialForm

    const saved = JSON.parse(raw)
    const companyInfo = saved?.companyInfo ?? {}
    const equipment = Array.isArray(saved?.equipmentList)
      ? saved.equipmentList[0] ?? {}
      : {}

    const equipmentType = normalizeEquipmentTypeValue(
      getFirstString(equipment.category, equipment.equipmentType, equipment.name),
    )
    const equipmentName = getFirstString(equipment.name) || getDefaultEquipmentName(equipmentType)
    const industryCode = getPrimaryIndustryCode(
      companyInfo.industryCode ?? companyInfo.industry_code,
    )

    return {
      equipmentType,
      industryCode,
      industryName:
        getFirstString(companyInfo.industry, companyInfo.industryName) ||
        findIndustryNameByCode(industryCode) ||
        initialForm.industryName,
      region: getFirstString(companyInfo.region) || initialForm.region,
      equipmentName,
      equipmentAge: getFirstNumberString(equipment.years, equipment.age_years),
      annualEnergyCostManwon: formatCommaNumber(
        getFirstNumberString(equipment.annualEnergyCost, equipment.energy_cost_annual),
      ),
      employees: formatCommaNumber(
        getFirstNumberString(companyInfo.employees, companyInfo.employee_count),
      ),
      annualRevenueManwon: formatCommaNumber(
        getFirstNumberString(companyInfo.annualRevenue, companyInfo.annual_revenue),
      ),
      scenarioAInvestmentManwon: formatCommaNumber(
        getFirstNumberString(
          equipment.scenarioAInvestment,
          equipment.scenario_a_investment_manwon,
        ),
      ),
      scenarioBInvestmentManwon: formatCommaNumber(
        getFirstNumberString(
          equipment.scenarioBInvestment,
          equipment.scenario_b_investment_manwon,
        ),
      ),
      defectRate: getFirstNumberString(equipment.defectRate, equipment.defect_rate),
      annualMaintenanceCostManwon: formatCommaNumber(
        getFirstNumberString(
          equipment.maintenanceCostAnnual,
          equipment.maintenance_cost_annual,
        ),
      ),
    }
  } catch (error) {
    console.warn("마이페이지 저장 정보를 ROI 입력값으로 불러오지 못했습니다.", error)
    return initialForm
  }
}

function normalizeIndustryCode(code: string) {
  return code.trim().toUpperCase()
}

function findIndustryNameByCode(code: string) {
  const primaryCode =
    normalizeIndustryCode(code)
      .split(/[,.\s/]+/)
      .map((item) => item.trim())
      .filter(Boolean)[0] ?? ""

  return INDUSTRY_CODE_TO_NAME[primaryCode] ?? ""
}

function findIndustryCodeByName(name: string) {
  const normalized = name.trim()

  if (!normalized) return ""

  const exact = Object.entries(INDUSTRY_CODE_TO_NAME).find(
    ([, industryName]) => industryName === normalized,
  )

  if (exact) return exact[0]

  const partial = Object.entries(INDUSTRY_CODE_TO_NAME).find(
    ([, industryName]) =>
      industryName.includes(normalized) || normalized.includes(industryName),
  )

  if (partial) return partial[0]

  if (normalized.includes("1차") || normalized.includes("금속 제조")) return "C24"
  if (normalized.includes("금속가공") || normalized.includes("금속 가공")) return "C25"
  if (normalized.includes("전자") || normalized.includes("반도체")) return "C26"
  if (normalized.includes("전기")) return "C27"
  if (normalized.includes("기계") || normalized.includes("장비")) return "C28"
  if (normalized.includes("자동차")) return "C29"
  if (normalized.includes("운송")) return "C30"

  return ""
}

function getEquipmentCategoryKey(equipmentType: string) {
  const normalized = equipmentType.toLowerCase()

  if (normalized.includes("press") || normalized.includes("프레스")) return "press"
  if (normalized.includes("cnc")) return "cnc"
  if (normalized.includes("injection") || normalized.includes("사출")) return "injection"

  return "press"
}

function getDefaultInvestmentManwon(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)

  if (key === "cnc") return 18000
  if (key === "injection") return 15000

  return 22000
}

function getDefaultEstimateRangeTextA(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)

  if (key === "cnc") return "1.5억 ~ 2.0억"
  if (key === "injection") return "1.2억 ~ 1.8억"

  return "1.8억 ~ 2.5억"
}

function getDefaultEstimateRangeTextB(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)

  if (key === "cnc") return "3,000만원 ~ 5,000만원"
  if (key === "injection") return "3,000만원 ~ 4,500만원"

  return "4,000만원 ~ 6,000만원"
}

function buildLocalScenarios(form: RoiFormState): ScenarioCard[] {
  const annualEnergyCost = toNumber(form.annualEnergyCostManwon, 4500)
  const annualMaintenanceCost = toNumber(form.annualMaintenanceCostManwon, 1200)
  const annualRevenue = toNumber(form.annualRevenueManwon, 320000)
  const defectRate = toNumber(form.defectRate, 5.8)

  const defaultScenarioAInvestment = getDefaultInvestmentManwon(form.equipmentType)
  const scenarioAInvestment =
    toNumber(form.scenarioAInvestmentManwon, 0) || defaultScenarioAInvestment
  const scenarioBInvestment =
    toNumber(form.scenarioBInvestmentManwon, 0) ||
    Math.round(defaultScenarioAInvestment * 0.227)

  const scenarioASubsidy = Math.min(Math.round(scenarioAInvestment * 0.545), 12000)
  const scenarioANetInvestment = Math.max(scenarioAInvestment - scenarioASubsidy, 0)

  const scenarioBSubsidy = Math.round(scenarioBInvestment * 0.3)
  const scenarioBNetInvestment = Math.max(scenarioBInvestment - scenarioBSubsidy, 0)

  const scenarioAEnergySaving = Math.round(annualEnergyCost * 0.3)
  const scenarioBEnergySaving = Math.round(annualEnergyCost * 0.1)

  const scenarioAMaintenanceSaving = Math.round(annualMaintenanceCost * 0.55)
  const scenarioBMaintenanceSaving = Math.round(annualMaintenanceCost * 0.25)

  const scenarioADefectSaving = Math.round(annualRevenue * (defectRate / 100) * 0.071)
  const scenarioBDefectSaving = Math.round(annualRevenue * (defectRate / 100) * 0.032)

  const scenarioABenefit =
    scenarioAEnergySaving + scenarioAMaintenanceSaving + scenarioADefectSaving

  const scenarioBBenefit =
    scenarioBEnergySaving + scenarioBMaintenanceSaving + scenarioBDefectSaving

  const scenarioAPayback =
    scenarioABenefit > 0 ? roundTo(scenarioANetInvestment / scenarioABenefit, 1) : null

  const scenarioBPayback =
    scenarioBBenefit > 0 ? roundTo(scenarioBNetInvestment / scenarioBBenefit, 1) : null

  const scenarioARoi =
    scenarioANetInvestment > 0
      ? roundTo((scenarioABenefit / scenarioANetInvestment) * 100, 1)
      : 0

  const scenarioBRoi =
    scenarioBNetInvestment > 0
      ? roundTo((scenarioBBenefit / scenarioBNetInvestment) * 100, 1)
      : 0

  return [
    {
      id: "A",
      badge: "시나리오 A",
      title:
        getEquipmentCategoryKey(form.equipmentType) === "injection"
          ? "고효율 사출 전체 교체"
          : getEquipmentCategoryKey(form.equipmentType) === "cnc"
            ? "고효율 CNC 전체 교체"
            : "고효율 프레스 전체 교체",
      subtitle: "노후 설비를 고효율 신규 설비로 전면 교체",
      investmentManwon: scenarioAInvestment,
      subsidyManwon: scenarioASubsidy,
      netInvestmentManwon: scenarioANetInvestment,
      energySavingManwon: scenarioAEnergySaving,
      maintenanceSavingManwon: scenarioAMaintenanceSaving,
      defectSavingManwon: scenarioADefectSaving,
      annualNetBenefitManwon: scenarioABenefit,
      paybackYears: scenarioAPayback,
      roiPct: scenarioARoi,
      estimateRangeText: getDefaultEstimateRangeTextA(form.equipmentType),
      estimateBasisText: "설비 용량 기준",
    },
    {
      id: "B",
      badge: "시나리오 B",
      title: "핵심 부품 교체 + 스마트 모니터링",
      subtitle: "필수 부품 교체와 모니터링 중심의 점진 투자",
      investmentManwon: scenarioBInvestment,
      subsidyManwon: scenarioBSubsidy,
      netInvestmentManwon: scenarioBNetInvestment,
      energySavingManwon: scenarioBEnergySaving,
      maintenanceSavingManwon: scenarioBMaintenanceSaving,
      defectSavingManwon: scenarioBDefectSaving,
      annualNetBenefitManwon: scenarioBBenefit,
      paybackYears: scenarioBPayback,
      roiPct: scenarioBRoi,
      estimateRangeText: getDefaultEstimateRangeTextB(form.equipmentType),
      estimateBasisText: "핵심 부품 기준",
    },
  ]
}

function normalizeApiData(response: unknown): RoiApiData | null {
  if (!response || typeof response !== "object") return null

  const target = response as RoiApiResponse

  if (
    target.data &&
    typeof target.data === "object" &&
    (target.data.scenario_a || target.data.scenario_b)
  ) {
    return target.data
  }

  if (target.scenario_a || target.scenario_b) {
    return {
      scenario_a: target.scenario_a,
      scenario_b: target.scenario_b,
      recommended: target.recommended,
    }
  }

  return null
}

function mergeApiScenarios(localScenarios: ScenarioCard[], apiData: RoiApiData | null) {
  if (!apiData) {
    return {
      scenarios: localScenarios,
      apiRecommended: "",
    }
  }

  const mapApiScenario = (local: ScenarioCard, api?: RoiApiScenario) => {
    if (!api) return local

    const investment = toNumber(api.investment_manwon, local.investmentManwon)
    const subsidy = toNumber(api.subsidy_manwon, local.subsidyManwon)
    const netInvestment = toNumber(api.net_investment_manwon, investment - subsidy)
    const annualNetBenefit = toNumber(
      api.annual_net_benefit_manwon,
      local.annualNetBenefitManwon,
    )
    const paybackYears = toNumber(api.payback_years, 0)
    const roiPct = toNumber(api.roi_pct, local.roiPct)

    return {
      ...local,
      investmentManwon: investment,
      subsidyManwon: subsidy,
      netInvestmentManwon: Math.max(netInvestment, 0),
      annualNetBenefitManwon: annualNetBenefit,
      paybackYears: paybackYears > 0 ? roundTo(paybackYears, 1) : local.paybackYears,
      roiPct: roiPct > 0 && roiPct < 10000 ? roundTo(roiPct, 1) : local.roiPct,
    }
  }

  const merged = localScenarios.map((scenario) => {
    if (scenario.id === "A") {
      return mapApiScenario(scenario, apiData.scenario_a)
    }

    return mapApiScenario(scenario, apiData.scenario_b)
  })

  return {
    scenarios: merged,
    apiRecommended: String(apiData.recommended || "").toUpperCase(),
  }
}

function buildPayload(form: RoiFormState) {
  const localScenarios = buildLocalScenarios(form)
  const scenarioA = localScenarios.find((item) => item.id === "A")!
  const scenarioB = localScenarios.find((item) => item.id === "B")!

  return {
    equipment: {
      name: form.equipmentName,
      category: getEquipmentCategoryKey(form.equipmentType),
      age_years: toNumber(form.equipmentAge, 0),
      energy_cost_annual: Math.round(toNumber(form.annualEnergyCostManwon, 4500) * 10000),
      maintenance_cost_annual: Math.round(
        toNumber(form.annualMaintenanceCostManwon, 1200) * 10000,
      ),
      defect_rate: toNumber(form.defectRate, 0),
      employee_count: toNumber(form.employees, 0),
      annual_revenue_manwon: toNumber(form.annualRevenueManwon, 0),
      scenario_a_investment_manwon: scenarioA.investmentManwon,
      scenario_b_investment_manwon: scenarioB.investmentManwon,
    },
    company_context: {
      industry_code: form.industryCode,
      industry_name: form.industryName,
      region: form.region,
    },
    scenario_a_investment_manwon: scenarioA.investmentManwon,
    scenario_a_subsidy_manwon: scenarioA.subsidyManwon,
    scenario_b_investment_manwon: scenarioB.investmentManwon,
    scenario_b_subsidy_manwon: scenarioB.subsidyManwon,
  }
}

function buildScores(form: RoiFormState, scenario: ScenarioCard): ScoreSummary {
  const age = toNumber(form.equipmentAge, 15)

  const supportFit = clamp(
    Math.round((scenario.subsidyManwon / Math.max(scenario.investmentManwon, 1)) * 150),
    35,
    96,
  )

  const savingEffect = clamp(
    Math.round((scenario.annualNetBenefitManwon / Math.max(scenario.netInvestmentManwon, 1)) * 190),
    25,
    96,
  )

  const aging = clamp(Math.round((age / 16) * 100), 45, 96)

  const safetyRisk = clamp(
    Math.round(age * 4.8 + toNumber(form.defectRate, 5.8) * 3.5),
    35,
    96,
  )

  const total = Math.round(
    supportFit * 0.35 + savingEffect * 0.25 + aging * 0.2 + safetyRisk * 0.2,
  )

  return {
    supportFit,
    savingEffect,
    aging,
    safetyRisk,
    total,
  }
}

function getRecommendedScenarioId(
  form: RoiFormState,
  scenarios: ScenarioCard[],
  apiRecommended: string,
): "A" | "B" {
  if (apiRecommended === "A" || apiRecommended === "B") {
    return apiRecommended
  }

  const scenarioA = scenarios.find((item) => item.id === "A")!
  const scenarioB = scenarios.find((item) => item.id === "B")!

  const scoreA = buildScores(form, scenarioA).total
  const scoreB = buildScores(form, scenarioB).total

  return scoreA >= scoreB ? "A" : "B"
}

function getStatusLabel(scores: ScoreSummary) {
  if (scores.total >= 80) return "투자 적합"
  if (scores.total >= 65) return "조건부 적합"
  return "재검토 필요"
}

function getDescription(form: RoiFormState, scenario: ScenarioCard, scores: ScoreSummary) {
  const equipmentName = form.equipmentName || "현재 설비"

  if (scenario.id === "A") {
    return `${equipmentName} 기준 전체 교체 시나리오는 지원금과 절감 효과를 함께 고려할 때 중장기 투자안으로 검토할 수 있습니다. 현재 추정 회수기간은 약 ${formatPaybackYears(
      scenario.paybackYears,
    )}입니다.`
  }

  if (scores.total >= 75) {
    return `${equipmentName} 기준 부분 교체 시나리오는 초기 실부담금을 낮추는 장점이 있습니다. 다만 전체 교체 대비 절감 효과 규모는 작을 수 있으며, 현재 추정 회수기간은 약 ${formatPaybackYears(
      scenario.paybackYears,
    )}입니다.`
  }

  return `${equipmentName} 기준 부분 교체 시나리오는 예산 부담은 낮지만 절감 효과와 지원금 규모를 함께 확인하면서 신중하게 검토하는 것이 좋습니다.`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "백엔드 서버에 연결할 수 없습니다. FastAPI 서버가 켜져 있는지 확인해주세요."
    }

    if (error.message.includes("400")) {
      return "입력값을 확인해주세요. 현재 설비 카테고리 또는 투자금 형식이 백엔드 조건과 다를 수 있습니다."
    }

    if (error.message.includes("500")) {
      return "백엔드 내부 오류가 발생했습니다. 서버 로그를 확인해주세요."
    }

    return error.message
  }

  return "알 수 없는 오류가 발생했습니다."
}

export default function RoiPage() {
  const navigate = useNavigate()

  const inputSectionRef = useRef<HTMLDivElement | null>(null)
  const resultSectionRef = useRef<HTMLDivElement | null>(null)

  const initialLoadedForm = useRef<RoiFormState>(getInitialFormFromMyPage()).current
  const [form, setForm] = useState<RoiFormState>(initialLoadedForm)
  const [scenarios, setScenarios] = useState<ScenarioCard[]>(() =>
    buildLocalScenarios(initialLoadedForm),
  )
  const [selectedScenarioId, setSelectedScenarioId] = useState<"A" | "B">("A")
  const [recommendedScenarioId, setRecommendedScenarioId] = useState<"A" | "B">("A")
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [costOpen, setCostOpen] = useState(false)
  const [benchmarkOpen, setBenchmarkOpen] = useState(false)

  const handleFieldChange = (key: keyof RoiFormState, value: string) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [key]: value,
      }

      if (key === "equipmentType") {
        const nextEquipmentType = normalizeEquipmentTypeValue(value)
        next.equipmentType = nextEquipmentType

        if (
          !prev.equipmentName.trim() ||
          isDefaultEquipmentName(prev.equipmentName) ||
          hasConflictingEquipmentName(prev.equipmentName, nextEquipmentType)
        ) {
          next.equipmentName = getDefaultEquipmentName(nextEquipmentType)
        }
      }

      if (key === "equipmentName") {
        const detectedEquipmentType = detectEquipmentTypeFromName(value)

        if (detectedEquipmentType) {
          next.equipmentType = detectedEquipmentType
        }
      }

      if (key === "industryCode") {
        const nextIndustryCode = value.toUpperCase().replace(/\s/g, "")
        next.industryCode = nextIndustryCode

        const matchedIndustryName = findIndustryNameByCode(nextIndustryCode)

        if (matchedIndustryName) {
          next.industryName = matchedIndustryName
        }
      }

      if (key === "industryName") {
        const matchedIndustryCode = findIndustryCodeByName(value)

        if (matchedIndustryCode) {
          next.industryCode = matchedIndustryCode
        }
      }

      return next
    })
  }

  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0]

  const recommendedScenario =
    scenarios.find((scenario) => scenario.id === recommendedScenarioId) ?? scenarios[0]

  const selectedScores = buildScores(form, selectedScenario)
  const selectedStatusLabel = getStatusLabel(selectedScores)
  const selectedDescription = getDescription(form, selectedScenario, selectedScores)

  const summaryAccent = selectedScenario.id === "A" ? colors.green : colors.blue2
  const summarySoft = selectedScenario.id === "A" ? colors.greenSoft : "#EEF0FF"

  const currentEnergyCost = toNumber(form.annualEnergyCostManwon, 4500)
  const currentMaintenanceCost = toNumber(form.annualMaintenanceCostManwon, 1200)
  const currentDefectLoss = Math.round(
    toNumber(form.annualRevenueManwon, 320000) * (toNumber(form.defectRate, 5.8) / 100) * 0.12,
  )

  const selectedEnergyAfter = Math.max(
    currentEnergyCost - selectedScenario.energySavingManwon,
    0,
  )

  const selectedMaintenanceAfter = Math.max(
    currentMaintenanceCost - selectedScenario.maintenanceSavingManwon,
    0,
  )

  const selectedDefectAfter = Math.max(
    currentDefectLoss - selectedScenario.defectSavingManwon,
    0,
  )

  const costMax = Math.max(
    currentEnergyCost,
    currentMaintenanceCost,
    currentDefectLoss,
    selectedEnergyAfter,
    selectedMaintenanceAfter,
    selectedDefectAfter,
    1,
  )

  const toBarWidth = (value: number) => `${Math.max((value / costMax) * 100, 4)}%`

  const benchmarkIndustryName =
    form.industryName || findIndustryNameByCode(form.industryCode) || "업종명 미확인"

  const handleCalculate = async () => {
    setApiStatus("loading")
    setErrorMessage("")

    const localScenarios = buildLocalScenarios(form)

    try {
      const payload = buildPayload(form)
      const apiResponse = await simulateRoi(payload)
      const apiData = normalizeApiData(apiResponse)
      const merged = mergeApiScenarios(localScenarios, apiData)

      const nextRecommendedId = getRecommendedScenarioId(
        form,
        merged.scenarios,
        merged.apiRecommended,
      )

      setScenarios(merged.scenarios)
      setRecommendedScenarioId(nextRecommendedId)
      setSelectedScenarioId(nextRecommendedId)
      setApiStatus(apiData ? "success" : "empty")

      window.requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      })
    } catch (error) {
      const nextRecommendedId = getRecommendedScenarioId(form, localScenarios, "")

      setScenarios(localScenarios)
      setRecommendedScenarioId(nextRecommendedId)
      setSelectedScenarioId(nextRecommendedId)
      setApiStatus("error")
      setErrorMessage(getErrorMessage(error))

      window.requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      })
    }
  }

  const handleReset = () => {
    const resetForm = getInitialFormFromMyPage()
    const initialScenarios = buildLocalScenarios(resetForm)

    setForm(resetForm)
    setScenarios(initialScenarios)
    setRecommendedScenarioId("A")
    setSelectedScenarioId("A")
    setApiStatus("idle")
    setErrorMessage("")
    setCostOpen(false)
    setBenchmarkOpen(false)

    window.requestAnimationFrame(() => {
      inputSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  return (
    <main className="page">
      <section className="section white">
        <div
          className="container"
          style={{
            width: "min(1280px, calc(100% - 40px))",
            margin: "0 auto",
            paddingBottom: "56px",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              marginBottom: "28px",
              height: "44px",
              padding: "0 18px",
              borderRadius: "999px",
              border: `1px solid ${colors.line}`,
              background: colors.card,
              color: colors.navy,
              fontSize: "14px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 8px 22px rgba(6,27,52,.06)",
            }}
          >
            ← 대시보드로 돌아가기
          </button>

          <PageHero />

          <InputPanel
            inputSectionRef={inputSectionRef}
            form={form}
            apiStatus={apiStatus}
            errorMessage={errorMessage}
            onChange={handleFieldChange}
            onCalculate={handleCalculate}
          />

          <section
            ref={resultSectionRef}
            style={{
              marginTop: "34px",
            }}
          >
            <ResultAndAiSection
              form={form}
              selectedScenario={selectedScenario}
              recommendedScenario={recommendedScenario}
              recommendedScenarioId={recommendedScenarioId}
              selectedScenarioId={selectedScenarioId}
              selectedScores={selectedScores}
              selectedStatusLabel={selectedStatusLabel}
              selectedDescription={selectedDescription}
              summaryAccent={summaryAccent}
              summarySoft={summarySoft}
              onReset={handleReset}
              onNavigateDraft={() => navigate("/application-draft")}
              onNavigateSupport={() => navigate("/support-projects")}
            />

            <ScenarioCompareSection
              scenarios={scenarios}
              recommendedScenarioId={recommendedScenarioId}
              selectedScenarioId={selectedScenarioId}
              onSelect={setSelectedScenarioId}
            />

            <InvestmentEstimateSection
              scenarios={scenarios}
              selectedScenarioId={selectedScenarioId}
            />

            <EvidenceSection
              costOpen={costOpen}
              benchmarkOpen={benchmarkOpen}
              onToggleCost={() => setCostOpen((prev) => !prev)}
              onToggleBenchmark={() => setBenchmarkOpen((prev) => !prev)}
              currentEnergyCost={currentEnergyCost}
              currentMaintenanceCost={currentMaintenanceCost}
              currentDefectLoss={currentDefectLoss}
              selectedEnergyAfter={selectedEnergyAfter}
              selectedMaintenanceAfter={selectedMaintenanceAfter}
              selectedDefectAfter={selectedDefectAfter}
              costMax={costMax}
              toBarWidth={toBarWidth}
              benchmarkIndustryName={benchmarkIndustryName}
              form={form}
              selectedScores={selectedScores}
            />
          </section>
        </div>
      </section>
    </main>
  )
}

function PageHero() {
  return (
    <div
      style={{
        marginBottom: "28px",
      }}
    >
      <div
        style={{
          width: "60px",
          height: "4px",
          borderRadius: "999px",
          background:
            "linear-gradient(90deg, #4B5CB0 0%, #C8A15B 55%, rgba(200,161,91,0) 100%)",
          marginBottom: "14px",
        }}
      />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: "40px",
          padding: "0 22px",
          borderRadius: "999px",
          background: colors.blue,
          color: "#FFFFFF",
          fontSize: "14px",
          fontWeight: 900,
          letterSpacing: "0.04em",
          marginBottom: "18px",
        }}
      >
        FACTOFIT SIMULATION
      </div>

      <div
        style={{
          color: colors.blue,
          fontSize: "15px",
          fontWeight: 900,
          letterSpacing: "0.22em",
          marginBottom: "18px",
        }}
      >
        ANALYSIS
      </div>

      <h1
        style={{
          color: colors.navy,
          fontSize: "clamp(40px, 4.8vw, 70px)",
          lineHeight: 1.08,
          letterSpacing: "-0.045em",
          fontWeight: 900,
          margin: 0,
          marginBottom: "18px",
        }}
      >
        설비투자 전, 회수기간과 실부담금보다 먼저{" "}
        <span style={{ color: colors.blue2 }}>ROI</span>를 계산합니다.
      </h1>

      <p
        style={{
          color: colors.muted,
          fontSize: "16px",
          lineHeight: 1.8,
          fontWeight: 800,
          margin: 0,
          maxWidth: "1080px",
        }}
      >
        필수 정보는 지원사업 매칭 기준으로 사용되고, 선택 정보는 계산 정확도를 높이는 데
        활용됩니다. 입력값이 비어 있으면 일부 항목은 fallback 평균값으로 계산됩니다.
      </p>
    </div>
  )
}

function InputPanel({
  inputSectionRef,
  form,
  apiStatus,
  errorMessage,
  onChange,
  onCalculate,
}: {
  inputSectionRef: RefObject<HTMLDivElement | null>
  form: RoiFormState
  apiStatus: ApiStatus
  errorMessage: string
  onChange: (key: keyof RoiFormState, value: string) => void
  onCalculate: () => void
}) {
  return (
    <div
      ref={inputSectionRef}
      style={{
        background: colors.card,
        border: `1px solid ${colors.line}`,
        borderRadius: "30px",
        overflow: "hidden",
        boxShadow: "0 18px 40px rgba(15,23,42,.04)",
        marginBottom: "34px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr)",
        }}
      >
        <aside
          style={{
            padding: "32px 24px 28px",
            background: colors.soft,
            borderRight: `1px solid ${colors.lineSoft}`,
          }}
        >
          <div
            style={{
              color: colors.blue2,
              fontSize: "14px",
              letterSpacing: "0.18em",
              fontWeight: 900,
              marginBottom: "18px",
            }}
          >
            STEP 01
          </div>

          <h2
            style={{
              color: colors.navy,
              fontSize: "28px",
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              fontWeight: 900,
              margin: 0,
              marginBottom: "14px",
            }}
          >
            입력 정보
          </h2>

          <p
            style={{
              color: colors.muted,
              fontSize: "15px",
              lineHeight: 1.7,
              fontWeight: 800,
              margin: 0,
              marginBottom: "28px",
            }}
          >
            필수값은 지원사업 매칭 기준으로 사용되고, 선택값은 계산 정확도를 높이는 데
            활용됩니다.
          </p>

          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.lineSoft}`,
              borderRadius: "24px",
              padding: "22px 18px",
            }}
          >
            <div
              style={{
                color: colors.navy,
                fontSize: "18px",
                lineHeight: 1.3,
                fontWeight: 900,
                marginBottom: "14px",
              }}
            >
              필수 수집 항목
            </div>

            <p
              style={{
                color: colors.muted,
                fontSize: "14px",
                lineHeight: 1.7,
                fontWeight: 800,
                margin: 0,
              }}
            >
              설비 종류, 업종 코드, 업종명, 지역은 반드시 필요합니다.
            </p>
          </div>
        </aside>

        <div
          style={{
            padding: "32px 28px 28px",
          }}
        >
          <SectionTitle tooltip="마이페이지에 저장된 입력값이 기본으로 채워지며, 이 화면에서 자유롭게 수정할 수 있습니다. 수정한 값은 ROI 계산에만 사용됩니다.">
            공통 필수 정보
          </SectionTitle>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "18px 20px",
              marginBottom: "30px",
            }}
          >
            <FieldBox label="설비 종류 *">
              <select
                value={form.equipmentType}
                onChange={(event) => onChange("equipmentType", event.target.value)}
                style={selectStyle}
              >
                {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
            </FieldBox>

            <FieldBox label="지역 *">
              <input
                value={form.region}
                onChange={(event) => onChange("region", event.target.value)}
                placeholder="예: 경기도 안산시"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="업종명 *">
              <input
                value={form.industryName}
                onChange={(event) => onChange("industryName", event.target.value)}
                placeholder="예: 금속가공"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="업종 코드 *">
              <input
                value={form.industryCode}
                onChange={(event) => onChange("industryCode", event.target.value)}
                placeholder="예: C25"
                style={inputStyle}
              />
            </FieldBox>
          </div>

          <SectionTitle>계산 선택 정보</SectionTitle>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "28px 26px",
              alignItems: "start",
            }}
          >
            <FieldBox label="설비명">
              <input
                value={form.equipmentName}
                onChange={(event) => onChange("equipmentName", event.target.value)}
                placeholder="예: 1600톤 프레스 #1"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="설비 연식">
              <input
                value={form.equipmentAge}
                onChange={(event) => onChange("equipmentAge", event.target.value)}
                placeholder="예: 15"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="연간 에너지 비용 (만원/년)">
              <input
                value={form.annualEnergyCostManwon}
                onChange={(event) =>
                  onChange("annualEnergyCostManwon", formatCommaNumber(event.target.value))
                }
                placeholder="예: 4,500"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="직원 수 (명)">
              <input
                value={form.employees}
                onChange={(event) => onChange("employees", formatCommaNumber(event.target.value))}
                placeholder="예: 45"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="연매출 (만원/년)">
              <input
                value={form.annualRevenueManwon}
                onChange={(event) =>
                  onChange("annualRevenueManwon", formatCommaNumber(event.target.value))
                }
                placeholder="예: 320,000"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="연간 유지보수 비용 (만원/년)">
              <input
                value={form.annualMaintenanceCostManwon}
                onChange={(event) =>
                  onChange(
                    "annualMaintenanceCostManwon",
                    formatCommaNumber(event.target.value),
                  )
                }
                placeholder="예: 1,200"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="불량률 (%)">
              <input
                value={form.defectRate}
                onChange={(event) => onChange("defectRate", event.target.value)}
                placeholder="예: 5.8"
                style={inputStyle}
              />
            </FieldBox>

            <div />
          </div>

          <details
            style={{
              marginTop: "18px",
              marginBottom: "18px",
              border: `1px solid ${colors.lineSoft}`,
              borderRadius: "24px",
              background: "#FFFFFF",
              padding: "22px 24px",
            }}
          >
            <summary
              style={{
                color: colors.navy,
                fontSize: "18px",
                fontWeight: 950,
                cursor: "pointer",
                listStyle: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <span>예상 투자비용 입력하기</span>
              <span
                style={{
                  color: "#94A3B8",
                  fontSize: "13px",
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                선택 · ROI 정확도 향상
              </span>
            </summary>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "18px 20px",
                marginTop: "20px",
              }}
            >
              <FieldBox label="전체교체 예상 투자금">
                <input
                  value={form.scenarioAInvestmentManwon}
                  onChange={(event) =>
                    onChange(
                      "scenarioAInvestmentManwon",
                      formatCommaNumber(event.target.value),
                    )
                  }
                  placeholder="예: 22,000"
                  style={inputStyle}
                />
                <HelperText>단위: 만원 · scenario_a_investment_manwon</HelperText>
              </FieldBox>

              <FieldBox label="부분교체 예상 투자금">
                <input
                  value={form.scenarioBInvestmentManwon}
                  onChange={(event) =>
                    onChange(
                      "scenarioBInvestmentManwon",
                      formatCommaNumber(event.target.value),
                    )
                  }
                  placeholder="예: 4,994"
                  style={inputStyle}
                />
                <HelperText>단위: 만원 · scenario_b_investment_manwon</HelperText>
              </FieldBox>
            </div>

            <p
              style={{
                color: colors.muted,
                fontSize: "13px",
                lineHeight: 1.7,
                fontWeight: 800,
                margin: 0,
                marginTop: "18px",
              }}
            >
              마이페이지에 입력한 값이 있으면 자동으로 채워집니다. 이 페이지에서 수정한
              값은 ROI 계산에만 사용되며 마이페이지 정보로 저장되지는 않습니다.
            </p>
          </details>

          <div
            style={{
              marginTop: "26px",
              background: "#F8FAFD",
              border: `1px solid ${colors.lineSoft}`,
              borderRadius: "24px",
              padding: "24px",
            }}
          >
            <div
              style={{
                color: colors.navy,
                fontSize: "18px",
                lineHeight: 1.35,
                fontWeight: 900,
                marginBottom: "10px",
              }}
            >
              입력값 기준으로 시뮬레이션을 실행합니다.
            </div>

            <p
              style={{
                color: colors.muted,
                fontSize: "14px",
                lineHeight: 1.7,
                fontWeight: 800,
                margin: 0,
                marginBottom: "18px",
              }}
            >
              실행 시 백엔드 <b>/api/roi/simulate</b> API를 호출하고, 응답이 있으면
              추천 결과와 시나리오 카드에 반영합니다.
            </p>

            <button
              type="button"
              onClick={onCalculate}
              disabled={apiStatus === "loading"}
              style={{
                height: "52px",
                padding: "0 28px",
                borderRadius: "16px",
                border: "0",
                background: colors.blue2,
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 900,
                cursor: apiStatus === "loading" ? "not-allowed" : "pointer",
                opacity: apiStatus === "loading" ? 0.7 : 1,
              }}
            >
              {apiStatus === "loading" ? "시뮬레이션 실행 중..." : "시뮬레이션 실행"}
            </button>
          </div>

          {apiStatus !== "idle" && (
            <StatusMessage apiStatus={apiStatus} errorMessage={errorMessage} />
          )}
        </div>
      </div>
    </div>
  )
}

function ResultAndAiSection({
  form,
  selectedScenario,
  recommendedScenario,
  recommendedScenarioId,
  selectedScenarioId,
  selectedScores,
  selectedStatusLabel,
  selectedDescription,
  summaryAccent,
  summarySoft,
  onReset,
  onNavigateDraft,
  onNavigateSupport,
}: {
  form: RoiFormState
  selectedScenario: ScenarioCard
  recommendedScenario: ScenarioCard
  recommendedScenarioId: "A" | "B"
  selectedScenarioId: "A" | "B"
  selectedScores: ScoreSummary
  selectedStatusLabel: string
  selectedDescription: string
  summaryAccent: string
  summarySoft: string
  onReset: () => void
  onNavigateDraft: () => void
  onNavigateSupport: () => void
}) {
  const resultMetrics = [
    {
      label: "총 투자금",
      value: formatMoneyFromManwon(selectedScenario.investmentManwon),
    },
    {
      label: "예상 지원금",
      value: formatMoneyFromManwon(selectedScenario.subsidyManwon),
    },
    {
      label: "실부담금",
      value: formatMoneyFromManwon(selectedScenario.netInvestmentManwon),
    },
    {
      label: "회수기간",
      value: formatPaybackYears(selectedScenario.paybackYears),
    },
  ]

  return (
    <div
      style={{
        borderRadius: "34px",
        border: `1px solid ${colors.lineSoft}`,
        background: colors.card,
        boxShadow: "0 22px 48px rgba(15,23,42,.06)",
        overflow: "hidden",
        marginBottom: "34px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 410px",
          alignItems: "stretch",
        }}
      >
        <section
          style={{
            padding: "42px 42px 36px",
            minHeight: "430px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 58%, #F8FAFD 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                width: "fit-content",
                height: "42px",
                padding: "0 18px",
                borderRadius: "999px",
                background: summarySoft,
                color: summaryAccent,
                fontSize: "14px",
                fontWeight: 900,
              }}
            >
              {selectedStatusLabel}
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "42px",
                padding: "0 16px",
                borderRadius: "999px",
                background: "#F7F8FC",
                color: colors.muted,
                fontSize: "13px",
                fontWeight: 900,
                border: `1px solid ${colors.lineSoft}`,
              }}
            >
              현재 선택 시나리오 {selectedScenario.id}
            </span>
          </div>

          <h2
            style={{
              color: colors.navy,
              fontSize: "clamp(38px, 4.2vw, 64px)",
              lineHeight: 1.08,
              letterSpacing: "-0.055em",
              fontWeight: 900,
              margin: 0,
              marginBottom: "22px",
              maxWidth: "820px",
            }}
          >
            {form.equipmentName} 투자 시 추천{" "}
            <span style={{ color: colors.blue2 }}>ROI</span>는{" "}
            <span style={{ color: summaryAccent }}>{selectedScenario.roiPct}%</span>,{" "}
            <span style={{ color: summaryAccent }}>{selectedScenario.id} 시나리오</span>
            입니다.
          </h2>

          <p
            style={{
              color: colors.muted,
              fontSize: "16px",
              lineHeight: 1.75,
              fontWeight: 800,
              margin: 0,
              marginBottom: "30px",
              maxWidth: "900px",
            }}
          >
            {selectedDescription}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              borderTop: `1px solid ${colors.lineSoft}`,
              borderBottom: `1px solid ${colors.lineSoft}`,
              background: "#FBFCFF",
            }}
          >
            {resultMetrics.map((metric) => (
              <SummaryNumberCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>
        </section>

        <aside
          style={{
            background: colors.navy,
            borderLeft: "1px solid rgba(255,255,255,.08)",
            borderTop: `4px solid ${colors.gold}`,
            padding: "36px 32px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                color: "#FFFFFF",
                fontSize: "30px",
                lineHeight: 1.15,
                letterSpacing: "-0.035em",
                fontWeight: 900,
              }}
            >
              AI 판단 근거
            </div>

            <div
              style={{
                width: "58px",
                height: "58px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.18)",
                color: "#FFFFFF",
                fontSize: "20px",
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {selectedScores.total}
            </div>
          </div>

          <p
            style={{
              color: "#DDE7F7",
              fontSize: "14px",
              lineHeight: 1.75,
              fontWeight: 800,
              margin: 0,
              marginBottom: "26px",
            }}
          >
            AI는 현재 <b>{recommendedScenarioId} 시나리오</b>를 추천합니다. 추천 기준은
            지원금 적합도, 비용 절감 효과, 설비 노후도, 안전 리스크를 종합한 점수입니다.
            {selectedScenarioId !== recommendedScenarioId
              ? ` 현재 화면에서는 ${selectedScenarioId} 시나리오를 확인 중입니다.`
              : ""}
          </p>

          <ReasonRow label="지원금 적합도" value={selectedScores.supportFit} />
          <ReasonRow label="비용 절감 효과" value={selectedScores.savingEffect} />
          <ReasonRow label="설비 노후도" value={selectedScores.aging} />
          <ReasonRow label="안전 리스크" value={selectedScores.safetyRisk} />
        </aside>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: "22px",
          alignItems: "center",
          padding: "26px 32px",
          borderTop: `1px solid ${colors.lineSoft}`,
          background: "#F8FAFD",
        }}
      >
        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "34px",
              padding: "0 14px",
              borderRadius: "999px",
              background: "#EEF0FF",
              color: colors.blue2,
              fontSize: "12px",
              letterSpacing: "0.04em",
              fontWeight: 900,
              marginBottom: "12px",
            }}
          >
            NEXT ACTION
          </span>

          <div
            style={{
              color: colors.navy,
              fontSize: "24px",
              lineHeight: 1.25,
              fontWeight: 900,
              letterSpacing: "-0.035em",
              marginBottom: "8px",
            }}
          >
            다음 추천 액션
          </div>

          <p
            style={{
              color: colors.muted,
              fontSize: "15px",
              lineHeight: 1.7,
              fontWeight: 800,
              margin: 0,
            }}
          >
            추천된 {recommendedScenario.id} 시나리오 기준으로 신청서 초안과 지원사업 상세
            검토를 이어서 진행하세요.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button type="button" onClick={onNavigateDraft} style={primaryButtonStyle}>
            신청서 초안 생성하기
          </button>

          <button
            type="button"
            onClick={onNavigateSupport}
            style={{
              ...secondaryButtonStyle,
              background: "#FFFFFF",
              color: colors.blue2,
              border: `1px solid ${colors.lineSoft}`,
            }}
          >
            지원사업 상세보기
          </button>

          <button type="button" onClick={onReset} style={secondaryButtonStyle}>
            다시 계산하기
          </button>
        </div>
      </div>
    </div>
  )
}

function ScenarioCompareSection({
  scenarios,
  recommendedScenarioId,
  selectedScenarioId,
  onSelect,
}: {
  scenarios: ScenarioCard[]
  recommendedScenarioId: "A" | "B"
  selectedScenarioId: "A" | "B"
  onSelect: (id: "A" | "B") => void
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "22px",
        marginBottom: "34px",
      }}
    >
      {scenarios.map((scenario) => {
        const isSelected = selectedScenarioId === scenario.id
        const isRecommended = recommendedScenarioId === scenario.id
        const isA = scenario.id === "A"
        const accent = isA ? colors.green : colors.blue2

        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => onSelect(scenario.id)}
            style={{
              textAlign: "left",
              borderRadius: "28px",
              border: isSelected ? `2px solid ${accent}` : `1px solid ${colors.lineSoft}`,
              background: colors.card,
              padding: "26px",
              cursor: "pointer",
              boxShadow: isSelected ? "0 16px 34px rgba(15,23,42,.08)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: "40px",
                    padding: "0 16px",
                    borderRadius: "999px",
                    background: isRecommended ? colors.greenSoft : "#EEF0FF",
                    color: isRecommended ? colors.green : colors.blue2,
                    fontSize: "14px",
                    fontWeight: 900,
                    marginBottom: "18px",
                  }}
                >
                  {isRecommended ? `${scenario.badge} 추천` : scenario.badge}
                </span>

                <div
                  style={{
                    color: colors.navy,
                    fontSize: "24px",
                    lineHeight: 1.25,
                    letterSpacing: "-0.03em",
                    fontWeight: 900,
                    marginBottom: "10px",
                  }}
                >
                  {scenario.title}
                </div>

                <p
                  style={{
                    color: colors.muted,
                    fontSize: "14px",
                    lineHeight: 1.65,
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  {scenario.subtitle}
                </p>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: accent,
                  color: "#FFFFFF",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "28px",
                  fontWeight: 900,
                }}
              >
                {scenario.id}
              </div>
            </div>

            <MetricGrid>
              <MetricCell label="투자금액" value={formatMoneyFromManwon(scenario.investmentManwon)} />
              <MetricCell label="보조금" value={formatMoneyFromManwon(scenario.subsidyManwon)} />
              <MetricCell
                label="실투자금액"
                value={formatMoneyFromManwon(scenario.netInvestmentManwon)}
                valueColor={accent}
              />
            </MetricGrid>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "14px",
                margin: "16px 0",
              }}
            >
              <SmallSavingCard
                icon="⚡"
                label="에너지 절감액"
                value={formatAnnualMoneyFromManwon(scenario.energySavingManwon)}
              />
              <SmallSavingCard
                icon="🔧"
                label="유지보수 절감액"
                value={formatAnnualMoneyFromManwon(scenario.maintenanceSavingManwon)}
              />
              <SmallSavingCard
                icon="◎"
                label="불량비용 절감액"
                value={formatAnnualMoneyFromManwon(scenario.defectSavingManwon)}
              />
            </div>

            <MetricGrid>
              <MetricCell
                label="연간 순편익"
                value={formatAnnualMoneyFromManwon(scenario.annualNetBenefitManwon)}
                valueColor={accent}
              />
              <MetricCell label="회수기간" value={formatPaybackYears(scenario.paybackYears)} />
              <MetricCell label="ROI" value={`${scenario.roiPct}%`} valueColor={accent} />
            </MetricGrid>
          </button>
        )
      })}
    </div>
  )
}

function InvestmentEstimateSection({
  scenarios,
  selectedScenarioId,
}: {
  scenarios: ScenarioCard[]
  selectedScenarioId: "A" | "B"
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "22px",
        marginBottom: "34px",
      }}
    >
      {scenarios.map((scenario) => {
        const isA = scenario.id === "A"
        const isSelected = selectedScenarioId === scenario.id
        const accent = isA ? colors.green : colors.blue2
        const softBackground = isA ? colors.greenSoft : "#EEF0FF"

        return (
          <div
            key={`estimate-${scenario.id}`}
            style={{
              borderRadius: "26px",
              border: isSelected
                ? `2px solid ${accent}`
                : `1px solid ${colors.lineSoft}`,
              background: isSelected
                ? "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 62%, #F8FAFD 100%)"
                : colors.card,
              padding: isSelected ? "23px" : "24px",
              boxShadow: isSelected
                ? "0 18px 38px rgba(15,23,42,.07)"
                : "none",
              transition: "border .18s ease, box-shadow .18s ease, background .18s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  color: colors.navy,
                  fontSize: "24px",
                  lineHeight: 1.2,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                }}
              >
                투자금 추정 정보
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "34px",
                  padding: "0 14px",
                  borderRadius: "999px",
                  background: isSelected ? softBackground : "transparent",
                  color: accent,
                  fontSize: "13px",
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {scenario.id === "A" ? "시나리오 A - 전체 교체" : "시나리오 B - 부분 교체"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "14px",
              }}
            >
              <EstimateCard label="투자 범위" value={scenario.estimateRangeText} />
              <EstimateCard
                label="권장 투자액"
                value={formatMoneyFromManwon(scenario.investmentManwon)}
                valueColor={accent}
              />
              <EstimateCard label="산정 기준" value={scenario.estimateBasisText} />
            </div>

            <p
              style={{
                color: colors.muted,
                fontSize: "13px",
                lineHeight: 1.7,
                fontWeight: 800,
                margin: 0,
                marginTop: "16px",
              }}
            >
              실제 서비스에서는 설비 카테고리, 업종 코드, 지역, 설비 용량을 기준으로 DB
              평균 단가를 조회해 이 값을 대체하는 구조가 적합합니다.
            </p>
          </div>
        )
      })}
    </div>
  )
}

function EvidenceSection({
  costOpen,
  benchmarkOpen,
  onToggleCost,
  onToggleBenchmark,
  currentEnergyCost,
  currentMaintenanceCost,
  currentDefectLoss,
  selectedEnergyAfter,
  selectedMaintenanceAfter,
  selectedDefectAfter,
  costMax,
  toBarWidth,
  benchmarkIndustryName,
  form,
  selectedScores,
}: {
  costOpen: boolean
  benchmarkOpen: boolean
  onToggleCost: () => void
  onToggleBenchmark: () => void
  currentEnergyCost: number
  currentMaintenanceCost: number
  currentDefectLoss: number
  selectedEnergyAfter: number
  selectedMaintenanceAfter: number
  selectedDefectAfter: number
  costMax: number
  toBarWidth: (value: number) => string
  benchmarkIndustryName: string
  form: RoiFormState
  selectedScores: ScoreSummary
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "22px",
      }}
    >
      <AccordionCard
        title="비용 비교"
        subtitle="기본 닫힘 · 클릭 시 상세 표시"
        open={costOpen}
        onToggle={onToggleCost}
      >
        <div
          style={{
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <LegendChip color={colors.blue} label="기존 설비 유지" />
          <LegendChip color={colors.blue2} label="선택 시나리오 기준" />
        </div>

        <CostCompareRow
          label="연간 전기요금"
          oldValue={currentEnergyCost}
          newValue={selectedEnergyAfter}
          oldBarWidth={toBarWidth(currentEnergyCost)}
          newBarWidth={toBarWidth(selectedEnergyAfter)}
        />

        <CostCompareRow
          label="불량 손실"
          oldValue={currentDefectLoss}
          newValue={selectedDefectAfter}
          oldBarWidth={toBarWidth(currentDefectLoss)}
          newBarWidth={toBarWidth(selectedDefectAfter)}
        />

        <CostCompareRow
          label="유지보수비"
          oldValue={currentMaintenanceCost}
          newValue={selectedMaintenanceAfter}
          oldBarWidth={toBarWidth(currentMaintenanceCost)}
          newBarWidth={toBarWidth(selectedMaintenanceAfter)}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#98A2B3",
            fontSize: "12px",
            fontWeight: 900,
            marginTop: "12px",
            paddingLeft: "150px",
          }}
        >
          <span>0</span>
          <span>{formatNumber(Math.round(costMax * 0.33))}</span>
          <span>{formatNumber(Math.round(costMax * 0.66))}</span>
          <span>{formatNumber(costMax)}</span>
        </div>
      </AccordionCard>

      <AccordionCard
        title="벤치마크 근거"
        subtitle="AI 분석 요약 · 기본 닫힘"
        open={benchmarkOpen}
        onToggle={onToggleBenchmark}
      >
        <div
          style={{
            border: `1px solid ${colors.lineSoft}`,
            borderRadius: "22px",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          <BenchmarkRow label="업종" value={benchmarkIndustryName} />
          <BenchmarkRow label="설비 유형" value={form.equipmentType} bordered />
          <BenchmarkRow
            label="노후도"
            value={`${form.equipmentAge || "-"}년`}
            chip={{ label: "주의", color: "#A35B16", background: "#FFF5E8" }}
            bordered
          />
          <BenchmarkRow
            label="불량률"
            value={`${form.defectRate || "-"}%`}
            chip={{
              label: "개선 필요",
              color: "#B84646",
              background: "#FFF1F1",
            }}
            bordered
          />
          <BenchmarkRow
            label="지원사업 적합도"
            value={`${selectedScores.supportFit}%`}
            chip={{
              label: "높음",
              color: colors.green,
              background: colors.greenSoft,
            }}
            bordered
          />
        </div>

        <p
          style={{
            color: colors.muted,
            fontSize: "14px",
            lineHeight: 1.75,
            fontWeight: 800,
            margin: 0,
          }}
        >
          현재 설비는 에너지 비용, 유지보수비, 불량 손실, 노후도 측면에서 교체 또는
          부분 개선 검토 우선순위가 높습니다.
        </p>
      </AccordionCard>
    </div>
  )
}

function SectionTitle({
  children,
  tooltip,
}: {
  children: ReactNode
  tooltip?: string
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <div
      style={{
        color: colors.navy,
        fontSize: "26px",
        lineHeight: 1.2,
        letterSpacing: "-0.03em",
        fontWeight: 900,
        marginBottom: "18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        position: "relative",
        width: "fit-content",
      }}
    >
      <span>{children}</span>

      {tooltip && (
        <span
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "#EEF2F7",
            color: colors.muted,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 950,
            cursor: "help",
            flexShrink: 0,
          }}
        >
          i
        </span>
      )}

      {tooltip && tooltipOpen && (
        <div
          style={{
            position: "absolute",
            left: "calc(100% + 10px)",
            top: "-4px",
            width: "320px",
            padding: "14px 16px",
            borderRadius: "16px",
            border: `1px solid ${colors.lineSoft}`,
            background: "#FFFFFF",
            boxShadow: "0 18px 42px rgba(15,23,42,.12)",
            color: colors.muted,
            fontSize: "13px",
            lineHeight: 1.65,
            fontWeight: 850,
            letterSpacing: "-0.01em",
            zIndex: 20,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}

function FieldBox({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const isRequired = label.trim().endsWith("*")
  const displayLabel = isRequired ? label.replace(/\s*\*$/, "") : label

  return (
    <div>
      <label
        style={{
          display: "block",
          color: colors.muted,
          fontSize: "14px",
          lineHeight: 1.2,
          fontWeight: 900,
          marginBottom: "10px",
        }}
      >
        {displayLabel}
        {isRequired && (
          <span
            style={{
              color: "#D94E41",
              marginLeft: "4px",
            }}
          >
            *
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function HelperText({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        color: "#94A3B8",
        fontSize: "13px",
        lineHeight: 1.55,
        fontWeight: 900,
        margin: 0,
        marginTop: "10px",
      }}
    >
      {children}
    </p>
  )
}

function StatusMessage({
  apiStatus,
  errorMessage,
}: {
  apiStatus: ApiStatus
  errorMessage: string
}) {
  const styleMap: Record<ApiStatus, { border: string; background: string; color: string; text: string }> = {
    idle: {
      border: `1px solid ${colors.line}`,
      background: colors.card,
      color: colors.muted,
      text: "",
    },
    loading: {
      border: "1px solid #C2D7FF",
      background: "#F3F7FF",
      color: "#2E4AA7",
      text: "API 응답을 기다리는 중입니다.",
    },
    success: {
      border: "1px solid #C2D7FF",
      background: "#F3F7FF",
      color: "#2E4AA7",
      text: "백엔드 응답을 화면에 반영했습니다. 추천 결과와 시나리오 카드를 확인하세요.",
    },
    empty: {
      border: "1px solid #F3C58C",
      background: "#FFF9F0",
      color: "#A35B16",
      text: "API 응답은 왔지만 결과 데이터가 비어 있어 프론트 기본 계산값으로 표시합니다.",
    },
    error: {
      border: "1px solid #F5B1B1",
      background: "#FFF6F6",
      color: "#A03434",
      text: `API 호출에 실패했습니다. ${errorMessage} 프론트 기본 계산값으로 계속 표시합니다.`,
    },
  }

  const current = styleMap[apiStatus]

  return (
    <div
      style={{
        marginTop: "14px",
        padding: "14px 16px",
        borderRadius: "16px",
        border: current.border,
        background: current.background,
        color: current.color,
        fontSize: "13px",
        lineHeight: 1.7,
        fontWeight: 900,
      }}
    >
      {current.text}
    </div>
  )
}

function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        border: `1px solid ${colors.lineSoft}`,
        borderRadius: "22px",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  )
}

function MetricCell({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        padding: "18px",
        borderRight: `1px solid ${colors.lineSoft}`,
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.2,
          fontWeight: 900,
          marginBottom: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: valueColor || colors.navy,
          fontSize: "22px",
          lineHeight: 1.2,
          letterSpacing: "-0.03em",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SmallSavingCard({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div
      style={{
        border: `1px solid ${colors.lineSoft}`,
        background: colors.card,
        borderRadius: "20px",
        padding: "18px 14px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "22px",
          lineHeight: 1,
          marginBottom: "12px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.35,
          fontWeight: 900,
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: colors.navy,
          fontSize: "17px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SummaryNumberCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        padding: "20px 22px",
        background: "transparent",
        boxShadow: `inset -1px 0 0 ${colors.lineSoft}`,
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.2,
          fontWeight: 900,
          marginBottom: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: colors.navy,
          fontSize: "24px",
          lineHeight: 1.15,
          letterSpacing: "-0.035em",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function EstimateCard({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        border: `1px solid ${colors.lineSoft}`,
        borderRadius: "20px",
        padding: "18px 16px",
        background: "#FDFEFF",
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.2,
          fontWeight: 900,
          marginBottom: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: valueColor || colors.navy,
          fontSize: "20px",
          lineHeight: 1.3,
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ReasonRow({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 34px",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          color: "#FFFFFF",
          fontSize: "15px",
          lineHeight: 1.2,
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <div
        style={{
          width: "100%",
          height: "15px",
          borderRadius: "999px",
          background: "rgba(255,255,255,.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            maxWidth: "100%",
            height: "100%",
            borderRadius: "999px",
            background: "#B7D8B9",
          }}
        />
      </div>

      <div
        style={{
          color: "#FFFFFF",
          fontSize: "15px",
          lineHeight: 1,
          fontWeight: 900,
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function AccordionCard({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div
      style={{
        borderRadius: "28px",
        border: `1px solid ${colors.lineSoft}`,
        background: colors.card,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "0",
          background: "transparent",
          padding: "22px 24px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: colors.navy,
              fontSize: "24px",
              lineHeight: 1.2,
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </span>

          <span
            style={{
              color: colors.muted,
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            {subtitle}
          </span>
        </div>

        <span
          style={{
            color: colors.blue2,
            fontSize: "42px",
            lineHeight: 1,
            fontWeight: 300,
          }}
        >
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "0 24px 24px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function LegendChip({
  color,
  label,
}: {
  color: string
  label: string
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        color: colors.muted,
        fontSize: "14px",
        fontWeight: 900,
      }}
    >
      <i
        style={{
          width: "22px",
          height: "10px",
          borderRadius: "999px",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  )
}

function CostCompareRow({
  label,
  oldValue,
  newValue,
  oldBarWidth,
  newBarWidth,
}: {
  label: string
  oldValue: number
  newValue: number
  oldBarWidth: string
  newBarWidth: string
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: "16px",
        alignItems: "center",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          color: colors.navy,
          fontSize: "16px",
          lineHeight: 1.3,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div>
        <div
          style={{
            width: "100%",
            height: "24px",
            borderRadius: "999px",
            background: "#E9EDF5",
            overflow: "hidden",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: oldBarWidth,
              height: "100%",
              background: colors.blue,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "10px",
              fontSize: "13px",
              fontWeight: 900,
              borderRadius: "999px",
            }}
          >
            {formatNumber(oldValue)}
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "24px",
            borderRadius: "999px",
            background: "#E9EDF5",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: newBarWidth,
              height: "100%",
              background: colors.blue2,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "10px",
              fontSize: "13px",
              fontWeight: 900,
              borderRadius: "999px",
            }}
          >
            {formatNumber(newValue)}
          </div>
        </div>
      </div>
    </div>
  )
}

function BenchmarkRow({
  label,
  value,
  chip,
  bordered,
}: {
  label: string
  value: string
  chip?: {
    label: string
    color: string
    background: string
  }
  bordered?: boolean
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "18px",
        alignItems: "center",
        padding: "16px 18px",
        borderTop: bordered ? `1px solid ${colors.lineSoft}` : "0",
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "14px",
          lineHeight: 1.2,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          color: colors.navy,
          fontSize: "16px",
          lineHeight: 1.4,
          fontWeight: 900,
        }}
      >
        <span>{value}</span>

        {chip && (
          <span
            style={{
              height: "28px",
              padding: "0 12px",
              borderRadius: "999px",
              background: chip.background,
              color: chip.color,
              fontSize: "12px",
              fontWeight: 900,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {chip.label}
          </span>
        )}
      </div>
    </div>
  )
}

const primaryButtonStyle: CSSProperties = {
  height: "58px",
  padding: "0 34px",
  borderRadius: "18px",
  border: "0",
  background: colors.blue2,
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
}

const secondaryButtonStyle: CSSProperties = {
  height: "58px",
  padding: "0 34px",
  borderRadius: "18px",
  border: "0",
  background: colors.grayButton,
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
}