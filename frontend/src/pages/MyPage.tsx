import { useEffect, useMemo, useState } from "react"
import AppHeader from "../components/AppHeader"

type BasicInfo = {
  name: string
  email: string
  manager: string
  phone: string
}

type PasswordInfo = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type IndustryItem = {
  id: number
  industry: string
  industryCode: string
}

type CompanyInfo = {
  companyName: string
  businessNumber: string
  assetTotalManwon: string
  /** 기존 단일 업종 필드: 기존 localStorage 호환용으로 유지 */
  industry: string
  industryCode: string
  /** 주업종/부업종 다중 입력용 */
  industries: IndustryItem[]
  region: string
  employees: string
  /** 직전년도 연매출액: 현재 2026년 기준 2025년 매출액, 단위 만원 */
  annualRevenue: string
  /** 최근 3개년 평균 매출 계산용 선택값, 단위 만원 */
  revenue2YearsAgo: string
  revenue3YearsAgo: string
  companySize: string
  affiliateStatus: string
  purpose: string
  foundedYear: string
  businessSiteType: string
}

type EquipmentInfo = {
  id: number
  name: string
  category: string
  process: string
  years: string
  annualEnergyCost: string
  defectRate: string
  maintenanceCostAnnual: string
  currentCapacityValue: string
  productionQty: string
  contributionMarginWon: string
  scenarioAInvestment: string
  scenarioBInvestment: string
  status: string
}

type SavedPolicy = {
  id: number
  title: string
  organization: string
  amount: string
  fit: string
  dday: string
}

type AnalysisHistory = {
  id: number
  title: string
  date: string
  result: string
  status: "완료" | "확인 필요"
}

type MyPageStorageData = {
  basicInfo: BasicInfo
  companyInfo: CompanyInfo
  equipmentList: EquipmentInfo[]
  profileCompleted: boolean
  savedAt: string
}

type UserOnboardingPayload = {
  user_id: string
  name: string
  phone: string
}

type CompanyOnboardingPayload = {
  user_id: string
  company_name: string
  industry_name: string
  industry_code: string[]
  region: string
  business_registration_no: string | null
  company_type: string
  primary_purpose: string | null
  employee_count: number | null
  annual_revenue: number | null
  revenue_2y_ago_manwon: number | null
  revenue_3y_ago_manwon: number | null
  established_year: number | null
  workplace_type: string | null
}

type EquipmentPayload = {
  name: string
  category: string
  age_years: number
  energy_cost_annual: number
  defect_rate: number | null
  maintenance_cost_annual: number | null
  current_capacity_value: number | null
  production_qty: number | null
  contribution_margin_won: number | null
  scenario_a_investment_manwon: number | null
  scenario_b_investment_manwon: number | null
}

const STORAGE_KEY = "factofit_mypage_profile"
const USER_ID_STORAGE_KEY = "factofit_user_id"
const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
const CURRENT_YEAR = new Date().getFullYear()
const PREVIOUS_YEAR = CURRENT_YEAR - 1
const TWO_YEARS_AGO = CURRENT_YEAR - 2
const THREE_YEARS_AGO = CURRENT_YEAR - 3

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}
const emptyBasicInfo: BasicInfo = {
  name: "",
  email: "",
  manager: "",
  phone: "",
}

const emptyPasswordInfo: PasswordInfo = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
}

const createEmptyIndustry = (id: number): IndustryItem => ({
  id,
  industry: "",
  industryCode: "",
})

const emptyCompanyInfo: CompanyInfo = {
  companyName: "",
  businessNumber: "",
  assetTotalManwon: "",
  industry: "",
  industryCode: "",
  industries: [createEmptyIndustry(1)],
  region: "",
  employees: "",
  annualRevenue: "",
  revenue2YearsAgo: "",
  revenue3YearsAgo: "",
  companySize: "선택 필요",
  affiliateStatus: "선택 필요",
  purpose: "선택 필요",
  foundedYear: "",
  businessSiteType: "선택 필요",
}

const createEmptyEquipment = (id: number): EquipmentInfo => ({
  id,
  name: "",
  category: "선택 필요",
  process: "",
  years: "",
  annualEnergyCost: "",
  defectRate: "",
  maintenanceCostAnnual: "",
  currentCapacityValue: "",
  productionQty: "",
  contributionMarginWon: "",
  scenarioAInvestment: "",
  scenarioBInvestment: "",
  status: "정보 입력 필요",
})

const savedPolicies: SavedPolicy[] = []
const analysisHistories: AnalysisHistory[] = []

const INDUSTRY_CODE_MAP: Record<string, string[]> = {
  제조업: ["C"],
  스마트공장: ["C"],
  스마트제조: ["C"],

  식품: ["C10"],
  섬유: ["C13"],
  화학: ["C20"],
  바이오: ["C21"],
  의약: ["C21"],
  의료기기: ["C27"],

  고무: ["C22"],
  플라스틱: ["C22"],

  금속: ["C24", "C25"],
  금속가공: ["C25"],

  전자: ["C26"],
  반도체: ["C26"],

  전기: ["C28"],
  기계: ["C29"],
  장비: ["C29"],
  로봇: ["C29"],

  자동차: ["C30"],
  부품: ["C30"],

  소부장: ["C20", "C24", "C25", "C26", "C28", "C29"],
  뿌리: ["C24", "C25", "C28", "C29"],
  기타제조업: ["C"],
}

const INDUSTRY_CODE_LABELS: Record<string, string> = {
  C: "기타 제조업",
  C10: "식품 제조업",
  C13: "섬유 제조업",
  C20: "화학 관련 제조업",
  C21: "바이오·의약 제조업",
  C22: "고무·플라스틱 제조업",
  C24: "1차 금속 제조업",
  C25: "금속가공 제조업",
  C26: "전자·반도체 제조업",
  C27: "의료기기 제조업",
  C28: "전기장비 제조업",
  C29: "기계·장비 제조업",
  C30: "자동차·부품 제조업",
}

function loadStoredMyPageData(): MyPageStorageData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as MyPageStorageData

    if (!parsed.basicInfo || !parsed.companyInfo || !parsed.equipmentList) {
      return null
    }

    return {
      basicInfo: {
        ...emptyBasicInfo,
        ...parsed.basicInfo,
      },
      companyInfo: (() => {
        const parsedCompanyInfo = {
          ...emptyCompanyInfo,
          ...parsed.companyInfo,
        }

        const storedIndustries = Array.isArray(parsedCompanyInfo.industries)
          ? parsedCompanyInfo.industries.filter(
              (item): item is IndustryItem =>
                Boolean(item) &&
                typeof item.id === "number" &&
                typeof item.industry === "string" &&
                typeof item.industryCode === "string",
            )
          : []

        const fallbackIndustries = [
          {
            ...createEmptyIndustry(1),
            industry: parsedCompanyInfo.industry ?? "",
            industryCode: parsedCompanyInfo.industryCode ?? "",
          },
        ]

        const activeStoredIndustries = storedIndustries.filter(
          (item) => item.industry.trim() || item.industryCode.trim(),
        )

        const industries =
          activeStoredIndustries.length > 0
            ? activeStoredIndustries
            : fallbackIndustries

        return {
          ...parsedCompanyInfo,
          industries,
          industry: industries[0]?.industry ?? parsedCompanyInfo.industry ?? "",
          industryCode:
            industries[0]?.industryCode ?? parsedCompanyInfo.industryCode ?? "",
        }
      })(),
      equipmentList: parsed.equipmentList.map((equipment, index) => ({
        ...createEmptyEquipment(equipment.id ?? index + 1),
        ...equipment,
      })),
      profileCompleted: parsed.profileCompleted ?? false,
      savedAt: parsed.savedAt ?? "",
    }
  } catch {
    return null
  }
}

function parseIndustryCodes(value: string) {
  return value
    .toUpperCase()
    .split(/[\s,，/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatIndustryCodes(codes: string[]) {
  return codes.join(", ")
}

function getIndustryCodeCandidates(industryName: string) {
  const normalized = industryName.replace(/\s/g, "")
  if (!normalized) return []

  const keys = Object.keys(INDUSTRY_CODE_MAP).sort((a, b) => b.length - a.length)
  const matchedKey = keys.find((key) => normalized.includes(key))

  if (!matchedKey) return []

  return INDUSTRY_CODE_MAP[matchedKey]
}

function getIndustryNameByCode(codeValue: string) {
  const codes = parseIndustryCodes(codeValue)
  const firstCode = codes[0]

  if (!firstCode) return ""

  return INDUSTRY_CODE_LABELS[firstCode] ?? ""
}

function findCompanyId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findCompanyId(item)
      if (found) return found
    }

    return null
  }

  const record = data as Record<string, unknown>
  const directValue = record.company_id ?? record.companyId ?? record.id

  if (typeof directValue === "string" && directValue.trim()) {
    return directValue.trim()
  }

  if (typeof directValue === "number" && Number.isFinite(directValue)) {
    return String(directValue)
  }

  for (const value of Object.values(record)) {
    const found = findCompanyId(value)
    if (found) return found
  }

  return null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "알 수 없는 오류가 발생했습니다."
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function getApiErrorMessage(data: unknown, status: number) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    const message = record.message ?? record.error ?? record.detail

    if (typeof message === "string" && message.trim()) {
      return message.trim()
    }

    if (Array.isArray(message)) {
      const validationMessages = message
        .map((item) => {
          if (typeof item === "string") return item

          if (item && typeof item === "object") {
            const itemRecord = item as Record<string, unknown>
            const msg = String(itemRecord.msg ?? itemRecord.message ?? "").trim()
            const loc = Array.isArray(itemRecord.loc)
              ? itemRecord.loc.map(String).join(".")
              : ""

            if (loc && msg) return `${loc}: ${msg}`
            return msg
          }

          return ""
        })
        .filter(Boolean)

      if (validationMessages.length > 0) {
        return validationMessages.join("\n")
      }
    }
  }

  return `요청 처리에 실패했습니다. (${status})`
}

function toPositiveNumber(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "")
  const numberValue = Number(normalized)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null
  }

  return numberValue
}

function toNumberOrNull(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "")
  if (!normalized) return null

  const numberValue = Number(normalized)

  if (!Number.isFinite(numberValue)) {
    return null
  }

  return numberValue
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

function formatPhoneNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 3) return digits
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function formatBusinessNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 10)

  if (digits.length <= 3) return digits
  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

function normalizePhoneNumber(value: string) {
  return onlyDigits(value)
}

function normalizeBusinessNumber(value: string) {
  return onlyDigits(value)
}

function formatCommaNumber(value: string) {
  const digits = onlyDigits(value)

  if (!digits) return ""

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function normalizeCommaNumber(value: string) {
  return onlyDigits(value)
}

function getPasswordStrength(password: string) {
  let score = 0

  if (password.length >= 8) score += 1
  if (/[A-Za-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (!password) {
    return {
      label: "입력 전",
      percent: 0,
      color: "#94A3B8",
      bg: "#F8FAFC",
      description: "새 비밀번호를 입력하면 보안 강도를 확인할 수 있습니다.",
    }
  }

  if (score <= 1) {
    return {
      label: "낮음",
      percent: 33,
      color: "#CD2E3A",
      bg: "#FFF1F2",
      description: "영문, 숫자, 특수문자를 조합하면 더 안전합니다.",
    }
  }

  if (score <= 3) {
    return {
      label: "보통",
      percent: 67,
      color: "#E65F00",
      bg: "#FFF7ED",
      description: "사용 가능한 수준입니다. 8자 이상과 특수문자를 권장합니다.",
    }
  }

  return {
    label: "안전",
    percent: 100,
    color: "#0B7A53",
    bg: "#E6F6EF",
    description: "안전한 비밀번호 형식입니다.",
  }
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value?.trim().match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  )
}

function findUuidInSupabaseAuthData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findUuidInSupabaseAuthData(item)
      if (found) return found
    }

    return null
  }

  const record = data as Record<string, unknown>
  const user = record.user

  if (user && typeof user === "object") {
    const userRecord = user as Record<string, unknown>
    const userId = userRecord.id

    if (typeof userId === "string" && isUuid(userId)) {
      return userId
    }
  }

  for (const value of Object.values(record)) {
    const found = findUuidInSupabaseAuthData(value)
    if (found) return found
  }

  return null
}

function getSupabaseAuthUserIdFromStorage() {
  if (typeof window === "undefined") return null

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) {
      continue
    }

    const raw = window.localStorage.getItem(key)
    if (!raw) continue

    const parsed = safeJsonParse(raw)
    const found = findUuidInSupabaseAuthData(parsed)

    if (found) return found
  }

  return null
}

function getCurrentUserId() {
  if (typeof window === "undefined") return null

  const supabaseUserId = getSupabaseAuthUserIdFromStorage()
  if (supabaseUserId) {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, supabaseUserId)
    return supabaseUserId
  }

  const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY)
  if (isUuid(storedUserId)) {
    return storedUserId?.trim() ?? null
  }

  return null
}

function isDuplicateInsertError(data: unknown, text: string) {
  const serialized =
    typeof data === "string" ? data : JSON.stringify(data ?? text)

  return (
    serialized.includes("23505") ||
    serialized.toLowerCase().includes("duplicate key")
  )
}

async function requestJson(
  path: string,
  options: RequestInit,
  debugLabel: string,
) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
  })

  const responseText = await response.text()
  const responseData = safeJsonParse(responseText)

  if (response.ok) {
    console.log(`${debugLabel} 성공:`, responseData)
    return responseData
  }

  console.error(`${debugLabel} 오류:`, {
    status: response.status,
    response: responseData ?? responseText,
  })
  console.error(
    `${debugLabel} 오류 상세:`,
    JSON.stringify(responseData ?? responseText, null, 2),
  )

  throw new Error(getApiErrorMessage(responseData, response.status))
}

async function submitUserPayload(payload: UserOnboardingPayload) {
  try {
    return await requestJson(
      "/api/onboarding/user",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      "온보딩 user API",
    )
  } catch (error) {
    const message = getErrorMessage(error)

    if (isDuplicateInsertError(message, message)) {
      console.warn(
        "이미 저장된 user_id로 판단되어 user 저장 단계를 통과합니다:",
        payload.user_id,
      )
      return {
        success: true,
        data: {
          user_id: payload.user_id,
          duplicate: true,
        },
      }
    }

    throw error
  }
}

async function submitCompanyPayload(payload: CompanyOnboardingPayload) {
  const responseData = await requestJson(
    "/api/onboarding",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "온보딩 company API",
  )

  const companyId = findCompanyId(responseData)

  if (!companyId) {
    console.error("company_id 추출 실패:", responseData)
    throw new Error(
      "company는 저장되었지만 응답에서 company_id를 찾지 못했습니다. 백엔드 응답에 company_id를 포함해주세요.",
    )
  }

  return {
    responseData,
    companyId,
  }
}

async function submitEquipmentPayload(
  companyId: string,
  payload: EquipmentPayload,
) {
  return requestJson(
    `/api/onboarding/${encodeURIComponent(companyId)}/equipment`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "온보딩 equipment API",
  )
}

async function fetchSavedOnboarding(companyId: string) {
  return requestJson(
    `/api/onboarding/${encodeURIComponent(companyId)}`,
    {
      method: "GET",
    },
    "온보딩 조회 API",
  )
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  helperText,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  helperText?: string
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: "9px",
      }}
    >
      <span
        style={{
          color: "#667085",
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        {label}
        {required && (
          <span
            style={{
              color: "#CD2E3A",
              marginLeft: "4px",
            }}
          >
            *
          </span>
        )}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: "52px",
          borderRadius: "18px",
          border: "1px solid #E2E8F0",
          background: "#FFFFFF",
          color: "#061B34",
          padding: "0 16px",
          fontSize: "15px",
          fontWeight: 800,
          outline: "none",
          boxSizing: "border-box",
          width: "100%",
        }}
      />

      {helperText && (
        <p
          style={{
            color: "#94A3B8",
            fontSize: "12px",
            fontWeight: 800,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {helperText}
        </p>
      )}
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  helperText,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  required?: boolean
  helperText?: string
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: "9px",
      }}
    >
      <span
        style={{
          color: "#667085",
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        {label}
        {required && (
          <span
            style={{
              color: "#CD2E3A",
              marginLeft: "4px",
            }}
          >
            *
          </span>
        )}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: "52px",
          borderRadius: "18px",
          border: "1px solid #E2E8F0",
          background: "#FFFFFF",
          color: "#061B34",
          padding: "0 16px",
          fontSize: "15px",
          fontWeight: 800,
          outline: "none",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {helperText && (
        <p
          style={{
            color: "#94A3B8",
            fontSize: "12px",
            fontWeight: 800,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {helperText}
        </p>
      )}
    </label>
  )
}

function ChecklistItem({
  done,
  label,
}: {
  done: boolean
  label: string
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        color: done ? "#0B7A53" : "#667085",
        fontSize: "13px",
        fontWeight: 900,
      }}
    >
      <span
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "999px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: done ? "#E6F6EF" : "#F1F5F9",
          color: done ? "#0B7A53" : "#94A3B8",
          fontSize: "12px",
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {done ? "✓" : "!"}
      </span>
      {label}
    </div>
  )
}

export default function MyPage() {
  const storedData = useMemo(() => {
    if (typeof window === "undefined") return null
    return loadStoredMyPageData()
  }, [])

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [passwordTooltipOpen, setPasswordTooltipOpen] = useState(false)
  const [industryTooltipOpen, setIndustryTooltipOpen] = useState(false)
  const [annualRevenueTooltipOpen, setAnnualRevenueTooltipOpen] = useState(false)
  const [companyInfoTooltipOpen, setCompanyInfoTooltipOpen] = useState(false)
  const [revenueDetailsOpen, setRevenueDetailsOpen] = useState(false)
  const [companyOptionalDetailsOpen, setCompanyOptionalDetailsOpen] =
    useState(false)
  const [profileCompleted, setProfileCompleted] = useState(
    storedData?.profileCompleted ?? false,
  )

  const [basicInfo, setBasicInfo] = useState<BasicInfo>(
    storedData?.basicInfo ?? emptyBasicInfo,
  )

  const [passwordInfo, setPasswordInfo] =
    useState<PasswordInfo>(emptyPasswordInfo)

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(
    storedData?.companyInfo ?? emptyCompanyInfo,
  )

  const [equipmentList, setEquipmentList] = useState<EquipmentInfo[]>(
    storedData?.equipmentList && storedData.equipmentList.length > 0
      ? storedData.equipmentList
      : [createEmptyEquipment(1)],
  )

  const companyDetailsOpen = revenueDetailsOpen || companyOptionalDetailsOpen

  useEffect(() => {
    setBasicInfo((prev) => {
      const formattedPhone = formatPhoneNumber(prev.phone)
      if (formattedPhone === prev.phone) return prev

      return {
        ...prev,
        phone: formattedPhone,
      }
    })

    setCompanyInfo((prev) => {
      const formattedBusinessNumber = formatBusinessNumber(prev.businessNumber)
      const formattedCompanyInfo = {
        ...prev,
        businessNumber: formattedBusinessNumber,
        assetTotalManwon: formatCommaNumber(prev.assetTotalManwon),
        annualRevenue: formatCommaNumber(prev.annualRevenue),
        revenue2YearsAgo: formatCommaNumber(prev.revenue2YearsAgo),
        revenue3YearsAgo: formatCommaNumber(prev.revenue3YearsAgo),
      }

      if (JSON.stringify(formattedCompanyInfo) === JSON.stringify(prev)) {
        return prev
      }

      return formattedCompanyInfo
    })

    setEquipmentList((prev) => {
      const formattedEquipmentList = prev.map((equipment) => ({
        ...equipment,
        annualEnergyCost: formatCommaNumber(equipment.annualEnergyCost),
        maintenanceCostAnnual: formatCommaNumber(equipment.maintenanceCostAnnual),
        contributionMarginWon: formatCommaNumber(equipment.contributionMarginWon),
        scenarioAInvestment: formatCommaNumber(equipment.scenarioAInvestment),
        scenarioBInvestment: formatCommaNumber(equipment.scenarioBInvestment),
      }))

      if (JSON.stringify(formattedEquipmentList) === JSON.stringify(prev)) {
        return prev
      }

      return formattedEquipmentList
    })
  }, [])

  const passwordStrength = useMemo(() => {
    return getPasswordStrength(passwordInfo.newPassword)
  }, [passwordInfo.newPassword])

  const passwordMatched =
    !passwordInfo.confirmPassword ||
    passwordInfo.newPassword === passwordInfo.confirmPassword

  const passwordChecks: [string, boolean][] = [
    ["8자 이상", passwordInfo.newPassword.length >= 8],
    ["영문 포함", /[A-Za-z]/.test(passwordInfo.newPassword)],
    ["숫자 포함", /[0-9]/.test(passwordInfo.newPassword)],
    ["특수문자 포함", /[^A-Za-z0-9]/.test(passwordInfo.newPassword)],
  ]

  const basicInfoDone = useMemo(() => {
    return Boolean(basicInfo.name.trim() && basicInfo.phone.trim())
  }, [basicInfo])

  const industryInfoDone = useMemo(() => {
    return companyInfo.industries.some(
      (item) => item.industry.trim() && item.industryCode.trim(),
    )
  }, [companyInfo.industries])

  const companyInfoDone = useMemo(() => {
    return Boolean(
      companyInfo.companyName.trim() &&
        industryInfoDone &&
        companyInfo.region.trim() &&
        companyInfo.employees.trim() &&
        companyInfo.annualRevenue.trim() &&
        companyInfo.companySize !== "선택 필요",
    )
  }, [companyInfo, industryInfoDone])

  const completedEquipmentCount = useMemo(() => {
    return equipmentList.filter((equipment) => {
      return (
        equipment.name.trim() &&
        equipment.category !== "선택 필요" &&
        equipment.years.trim() &&
        equipment.annualEnergyCost.trim()
      )
    }).length
  }, [equipmentList])

  const equipmentInfoDone = completedEquipmentCount > 0

  const needsInputGuide = useMemo(() => {
    return !companyInfoDone || !equipmentInfoDone
  }, [companyInfoDone, equipmentInfoDone])

  const completionScore = useMemo(() => {
    const basicRequiredValues = [basicInfo.name, basicInfo.phone]

    const companyRequiredValues = [
      companyInfo.companyName,
      ...companyInfo.industries.slice(0, 1).flatMap((item) => [
        item.industry,
        item.industryCode,
      ]),
      companyInfo.region,
      companyInfo.employees,
      companyInfo.annualRevenue,
      companyInfo.companySize !== "선택 필요" ? companyInfo.companySize : "",
    ]

    const companyOptionalValues = [
      companyInfo.revenue2YearsAgo,
      companyInfo.revenue3YearsAgo,
      companyInfo.businessNumber,
      companyInfo.assetTotalManwon,
      companyInfo.affiliateStatus !== "선택 필요"
        ? companyInfo.affiliateStatus
        : "",
      companyInfo.purpose !== "선택 필요" ? companyInfo.purpose : "",
      companyInfo.foundedYear,
      companyInfo.businessSiteType !== "선택 필요"
        ? companyInfo.businessSiteType
        : "",
    ]

    const equipmentRequiredValues = equipmentList.flatMap((equipment) => [
      equipment.name,
      equipment.category !== "선택 필요" ? equipment.category : "",
      equipment.years,
      equipment.annualEnergyCost,
    ])

    const equipmentOptionalValues = equipmentList.flatMap((equipment) => [
      equipment.process,
      equipment.defectRate,
      equipment.maintenanceCostAnnual,
      equipment.currentCapacityValue,
      equipment.productionQty,
      equipment.contributionMarginWon,
      equipment.scenarioAInvestment,
      equipment.scenarioBInvestment,
    ])

    const basicScore = Math.round(
      (basicRequiredValues.filter(Boolean).length / basicRequiredValues.length) *
        15,
    )

    const companyRequiredScore = Math.round(
      (companyRequiredValues.filter(Boolean).length /
        companyRequiredValues.length) *
        40,
    )

    const companyOptionalScore = Math.round(
      (companyOptionalValues.filter(Boolean).length /
        companyOptionalValues.length) *
        10,
    )

    const equipmentRequiredScore =
      equipmentRequiredValues.length > 0
        ? Math.round(
            (equipmentRequiredValues.filter(Boolean).length /
              equipmentRequiredValues.length) *
              25,
          )
        : 0

    const equipmentOptionalScore =
      equipmentOptionalValues.length > 0
        ? Math.round(
            (equipmentOptionalValues.filter(Boolean).length /
              equipmentOptionalValues.length) *
              10,
          )
        : 0

    return Math.min(
      basicScore +
        companyRequiredScore +
        companyOptionalScore +
        equipmentRequiredScore +
        equipmentOptionalScore,
      100,
    )
  }, [basicInfo, companyInfo, equipmentList])

  const missingCoreCount = useMemo(() => {
    let count = 0

    if (!basicInfo.name.trim()) count += 1
    if (!basicInfo.phone.trim()) count += 1
    if (!companyInfo.companyName.trim()) count += 1
    if (!industryInfoDone) count += 1
    if (!companyInfo.region.trim()) count += 1
    if (!companyInfo.employees.trim()) count += 1
    if (!companyInfo.annualRevenue.trim()) count += 1
    if (companyInfo.companySize === "선택 필요") count += 1
    if (!equipmentInfoDone) count += 1

    return count
  }, [basicInfo, companyInfo, equipmentInfoDone, industryInfoDone])

  const updateIndustry = (
    id: number,
    key: keyof Omit<IndustryItem, "id">,
    value: string,
  ) => {
    setCompanyInfo((prev) => {
      const nextIndustries = prev.industries.map((item) => {
        if (item.id !== id) return item

        if (key === "industry") {
          const codes = getIndustryCodeCandidates(value)

          return {
            ...item,
            industry: value,
            industryCode:
              codes.length > 0 ? formatIndustryCodes(codes) : item.industryCode,
          }
        }

        const upperValue = value.toUpperCase()
        const inferredIndustry = getIndustryNameByCode(upperValue)

        return {
          ...item,
          industryCode: upperValue,
          industry: inferredIndustry || item.industry,
        }
      })

      const primaryIndustry = nextIndustries[0] ?? createEmptyIndustry(1)

      return {
        ...prev,
        industries: nextIndustries,
        industry: primaryIndustry.industry,
        industryCode: primaryIndustry.industryCode,
      }
    })
  }

  const addIndustry = () => {
    const nextId =
      companyInfo.industries.length > 0
        ? Math.max(...companyInfo.industries.map((item) => item.id)) + 1
        : 1

    setCompanyInfo((prev) => ({
      ...prev,
      industries: [...prev.industries, createEmptyIndustry(nextId)],
    }))
  }

  const removeIndustry = (id: number) => {
    if (companyInfo.industries.length <= 1) {
      window.alert("업종 정보는 최소 1개 이상 필요합니다.")
      return
    }

    setCompanyInfo((prev) => {
      const nextIndustries = prev.industries.filter((item) => item.id !== id)
      const primaryIndustry = nextIndustries[0] ?? createEmptyIndustry(1)

      return {
        ...prev,
        industries: nextIndustries,
        industry: primaryIndustry.industry,
        industryCode: primaryIndustry.industryCode,
      }
    })
  }

  const updateEquipment = (
    id: number,
    key: keyof EquipmentInfo,
    value: string,
  ) => {
    setEquipmentList((prev) =>
      prev.map((equipment) =>
        equipment.id === id
          ? {
              ...equipment,
              [key]: value,
            }
          : equipment,
      ),
    )
  }

  const addEquipment = () => {
    const nextId =
      equipmentList.length > 0
        ? Math.max(...equipmentList.map((equipment) => equipment.id)) + 1
        : 1

    setEquipmentList((prev) => [...prev, createEmptyEquipment(nextId)])
  }

  const removeEquipment = (id: number) => {
    if (equipmentList.length <= 1) {
      window.alert("설비 정보는 최소 1개 이상 필요합니다.")
      return
    }

    setEquipmentList((prev) =>
      prev.filter((equipment) => equipment.id !== id),
    )
  }

  const handleSave = async () => {
    if (saving) return

    if (
      passwordInfo.newPassword &&
      passwordInfo.confirmPassword &&
      passwordInfo.newPassword !== passwordInfo.confirmPassword
    ) {
      window.alert("새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.")
      return
    }

    const userId = getCurrentUserId()

    if (!userId) {
      window.alert(
        "Supabase Auth 로그인 정보에서 user.id를 찾지 못했습니다. 로그인 상태를 확인한 뒤 다시 저장해주세요.",
      )
      return
    }
    const activeIndustries = companyInfo.industries.filter((item) => {
      return item.industry.trim() || item.industryCode.trim()
    })
    const industryCodes = activeIndustries.flatMap((item) =>
      parseIndustryCodes(item.industryCode),
    )
    const uniqueIndustryCodes: string[] = Array.from(new Set(industryCodes))
    const primaryIndustryCode = uniqueIndustryCodes[0] ?? "C"
    const industryName =
      activeIndustries
        .map((item) => item.industry.trim())
        .filter(Boolean)
        .join(", ") ||
      getIndustryNameByCode(primaryIndustryCode) ||
      companyInfo.industry.trim() ||
      "제조업"

    const employeeCount = toPositiveNumber(companyInfo.employees)
    const annualRevenue = toPositiveNumber(normalizeCommaNumber(companyInfo.annualRevenue))
    const revenue2YearsAgo = toNumberOrNull(normalizeCommaNumber(companyInfo.revenue2YearsAgo))
    const revenue3YearsAgo = toNumberOrNull(normalizeCommaNumber(companyInfo.revenue3YearsAgo))
    const establishedYear = toNumberOrNull(companyInfo.foundedYear)

    const completedEquipments = equipmentList.filter((equipment) => {
      const equipmentCategory =
        equipment.category === "선택 필요" ? "" : equipment.category
      const equipmentAgeYears = toPositiveNumber(equipment.years)
      const equipmentEnergyCostAnnual = toPositiveNumber(
        equipment.annualEnergyCost,
      )

      return Boolean(
        equipment.name.trim() &&
          equipmentCategory &&
          equipmentAgeYears &&
          equipmentEnergyCostAnnual,
      )
    })

    const missingFields: string[] = []

    if (!basicInfo.name.trim()) missingFields.push("이름")
    if (!basicInfo.phone.trim()) missingFields.push("연락처")
    if (!companyInfo.companyName.trim()) missingFields.push("기업명")
    if (uniqueIndustryCodes.length === 0) missingFields.push("업종코드")
    if (!companyInfo.region.trim()) missingFields.push("지역")
    if (!employeeCount) missingFields.push("직원 수")
    if (!annualRevenue) missingFields.push("직전년도 연매출액")
    if (companyInfo.companySize === "선택 필요") missingFields.push("기업규모")
    if (completedEquipments.length === 0) {
      missingFields.push("설비 정보 1개 이상")
    }

    if (missingFields.length > 0) {
      window.alert(`프로필 저장 전 필수값을 확인해주세요.\n- ${missingFields.join("\n- ")}`)
      return
    }

    const userPayload: UserOnboardingPayload = {
      user_id: userId,
      name: basicInfo.name.trim(),
      phone: normalizePhoneNumber(basicInfo.phone),
    }

    const companyPayload: CompanyOnboardingPayload = {
      user_id: userId,
      company_name: companyInfo.companyName.trim(),
      industry_name: industryName,
      industry_code: uniqueIndustryCodes.length > 0 ? uniqueIndustryCodes : ["C"],
      region: companyInfo.region.trim(),
      business_registration_no:
        normalizeBusinessNumber(companyInfo.businessNumber) || null,
      company_type: companyInfo.companySize,
      primary_purpose:
        companyInfo.purpose === "선택 필요" ? null : companyInfo.purpose,
      employee_count: employeeCount,
      annual_revenue: annualRevenue,
      revenue_2y_ago_manwon: revenue2YearsAgo,
      revenue_3y_ago_manwon: revenue3YearsAgo,
      established_year: establishedYear,
      workplace_type:
        companyInfo.businessSiteType === "선택 필요"
          ? null
          : companyInfo.businessSiteType,
    }

    const equipmentPayloads: EquipmentPayload[] = completedEquipments.map(
      (equipment) => ({
        name: equipment.name.trim(),
        category: equipment.category === "선택 필요" ? "etc" : equipment.category,
        age_years: toPositiveNumber(equipment.years) ?? 0,
        energy_cost_annual: toPositiveNumber(normalizeCommaNumber(equipment.annualEnergyCost)) ?? 0,
        defect_rate: toNumberOrNull(equipment.defectRate),
        maintenance_cost_annual: toNumberOrNull(normalizeCommaNumber(equipment.maintenanceCostAnnual)),
        current_capacity_value: toNumberOrNull(equipment.currentCapacityValue),
        production_qty: toNumberOrNull(equipment.productionQty),
        contribution_margin_won: toNumberOrNull(normalizeCommaNumber(equipment.contributionMarginWon)),
        scenario_a_investment_manwon: toNumberOrNull(
          normalizeCommaNumber(equipment.scenarioAInvestment),
        ),
        scenario_b_investment_manwon: toNumberOrNull(
          normalizeCommaNumber(equipment.scenarioBInvestment),
        ),
      }),
    )

    const savedProfileCompleted = basicInfoDone && companyInfoDone && equipmentInfoDone

    const storageData: MyPageStorageData = {
      basicInfo,
      companyInfo: {
        ...companyInfo,
        industry: activeIndustries[0]?.industry ?? companyInfo.industry,
        industryCode:
          activeIndustries[0]?.industryCode ?? companyInfo.industryCode,
      },
      equipmentList,
      profileCompleted: savedProfileCompleted,
      savedAt: new Date().toISOString(),
    }

    try {
      setSaving(true)

      console.log("온보딩 user 요청 payload:", userPayload)
      await submitUserPayload(userPayload)

      console.log("온보딩 company 요청 payload:", companyPayload)
      const { responseData: companyResponseData, companyId } =
        await submitCompanyPayload(companyPayload)

      const equipmentResponses = []
      for (const equipmentPayload of equipmentPayloads) {
        console.log("온보딩 equipment 요청 payload:", {
          companyId,
          equipmentPayload,
        })
        const equipmentResponse = await submitEquipmentPayload(
          companyId,
          equipmentPayload,
        )
        equipmentResponses.push(equipmentResponse)
      }

      const savedOnboarding = await fetchSavedOnboarding(companyId)

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData))
      window.localStorage.setItem(USER_ID_STORAGE_KEY, userId)
      window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, companyId)
      console.log("저장된 user_id:", userId)
      console.log("저장된 company_id:", companyId)
      console.log("company 저장 응답:", companyResponseData)
      console.log("equipment 저장 응답:", equipmentResponses)
      console.log("온보딩 조회 응답:", savedOnboarding)

      setSaved(true)
      setProfileCompleted(savedProfileCompleted)

      window.setTimeout(() => {
        setSaved(false)
      }, 2400)
    } catch (error) {
      window.alert(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }
  const handleReset = () => {
    const confirmed = window.confirm("입력한 마이페이지 정보를 초기화할까요?")
    if (!confirmed) return

    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    window.localStorage.removeItem(ANALYSIS_RESULT_STORAGE_KEY)
    setBasicInfo(emptyBasicInfo)
    setPasswordInfo(emptyPasswordInfo)
    setCompanyInfo({
      ...emptyCompanyInfo,
      industries: [createEmptyIndustry(1)],
    })
    setEquipmentList([createEmptyEquipment(1)])
    setProfileCompleted(false)
  }
  const goToAnalysis = async () => {
    if (analyzing) return;

    const companyId = window.localStorage.getItem(COMPANY_ID_STORAGE_KEY);

    if (!companyId) {
      window.alert(
        "company_id가 없습니다. 먼저 프로필 저장하기를 눌러 온보딩 정보를 저장해주세요.",
      );
      return;
    }

    try {
      setAnalyzing(true);

      const response = await fetch(
        buildApiUrl(
          `/api/analyze?company_id=${encodeURIComponent(companyId)}`,
        ),
        {
          method: "POST",
          credentials: "include",
        },
      );

      const responseText = await response.text();
      const analysisResult = safeJsonParse(responseText);

      if (!response.ok) {
        console.error("분석 API 오류:", {
          status: response.status,
          companyId,
          response: analysisResult ?? responseText,
        });

        throw new Error(getApiErrorMessage(analysisResult, response.status));
      }

      window.localStorage.setItem(
        ANALYSIS_RESULT_STORAGE_KEY,
        JSON.stringify(analysisResult),
      );
      console.log("분석 결과:", analysisResult);

      // 분석 결과 저장 후 로그인 이후 대시보드로 이동합니다.
      window.location.assign("/dashboard");
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="page">
      <AppHeader />

      <section
        style={{
          background: "#F8FAFC",
          padding: "56px clamp(22px,5vw,80px) 90px",
        }}
      >
        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.85fr",
              gap: "40px",
              alignItems: "end",
              marginBottom: "34px",
            }}
          >
            <div>
              <div
                style={{
                  width: "122px",
                  height: "4px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, #C68B3C 50%, rgba(255,255,255,0) 100%)",
                  marginBottom: "18px",
                }}
              />

              <div className="screen-tag">FACTOFIT MY PAGE</div>

              <div
                className="label"
                style={{
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                ACCOUNT & COMPANY PROFILE
              </div>

              <h1
                style={{
                  color: "#061B34",
                  fontSize: "56px",
                  lineHeight: 1.12,
                  fontWeight: 900,
                  letterSpacing: "-2px",
                  margin: 0,
                }}
              >
                내 정보와 기업 정보를 <br />
                한곳에서 관리합니다.
              </h1>

              <div
                style={{
                  width: "130px",
                  height: "3px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, rgba(52,75,160,0) 100%)",
                  marginTop: "24px",
                }}
              />
            </div>

            <p
              style={{
                color: "#667085",
                fontSize: "16px",
                lineHeight: 1.8,
                fontWeight: 900,
                margin: 0,
              }}
            >
              회원가입 이후 기업·설비 정보를 입력하면 FactoFit이 ROI 분석,
              지원사업 추천, 신청 준비도를 더 정확하게 계산할 수 있습니다.
            </p>
          </div>

          {needsInputGuide && (
            <section
              style={{
                position: "relative",
                overflow: "hidden",
                background: "#0F1B30",
                borderRadius: "34px",
                padding: "42px",
                color: "#FFFFFF",
                marginBottom: "28px",
                border: "1px solid rgba(255,255,255,.08)",
                boxShadow: "0 18px 44px rgba(15,27,51,.16)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 80% 20%, rgba(52,75,160,.22), rgba(15,27,48,0) 42%)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "grid",
                  gap: "30px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 360px)",
                    gap: "42px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "#AFC4FF",
                        fontSize: "13px",
                        fontWeight: 950,
                        letterSpacing: "5px",
                        marginBottom: "22px",
                      }}
                    >
                      FACTOFIT INTELLIGENCE
                    </div>

                    <h2
                      style={{
                        color: "#FFFFFF",
                        fontSize: "44px",
                        lineHeight: 1.18,
                        fontWeight: 950,
                        letterSpacing: "-1.8px",
                        margin: 0,
                      }}
                    >
                      분석 전 핵심 정보를
                      <br />
                      먼저 채워주세요.
                    </h2>

                    <p
                      style={{
                        color: "rgba(255,255,255,.78)",
                        fontSize: "16px",
                        lineHeight: 1.85,
                        fontWeight: 850,
                        margin: "22px 0 0",
                        maxWidth: "720px",
                      }}
                    >
                      업종·설비 정보를 입력하면 맞춤 ROI 분석과 정책 추천을 받을 수 있어요.
                      입력하지 않은 선택값은 분석 단계에서 업계 평균값으로 보완합니다.
                    </p>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      maxWidth: "360px",
                      minHeight: "220px",
                      justifySelf: "end",
                      borderRadius: "28px",
                      border: "1px solid rgba(255,255,255,.12)",
                      background: "rgba(255,255,255,.07)",
                      padding: "30px",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        color: "rgba(255,255,255,.68)",
                        fontSize: "14px",
                        fontWeight: 950,
                        marginBottom: "18px",
                      }}
                    >
                      입력 완성도
                    </span>

                    <strong
                      style={{
                        display: "block",
                        color: "#FFFFFF",
                        fontFamily: "DM Mono, monospace",
                        fontSize: "64px",
                        fontWeight: 500,
                        lineHeight: 1,
                        marginBottom: "26px",
                      }}
                    >
                      {completionScore}%
                    </strong>

                    <div
                      style={{
                        height: "12px",
                        borderRadius: "999px",
                        background: "rgba(255,255,255,.14)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${completionScore}%`,
                          height: "100%",
                          borderRadius: "999px",
                          background: "#E8CC79",
                        }}
                      />
                    </div>

                    <span
                      style={{
                        display: "block",
                        color: "#E8CC79",
                        fontSize: "15px",
                        fontWeight: 950,
                        marginTop: "18px",
                      }}
                    >
                      필수 항목 {missingCoreCount}개 남음
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "18px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const target = document.getElementById("company-profile-form")
                      target?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }}
                    style={{
                      minHeight: "76px",
                      borderRadius: "24px",
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.08)",
                      color: "#FFFFFF",
                      padding: "0 26px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      cursor: "pointer",
                      fontSize: "18px",
                      fontWeight: 950,
                      textAlign: "left",
                    }}
                  >
                    <span>🏢 기업정보 입력하기</span>
                    <span>+</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const target = document.getElementById("equipment-profile-form")
                      target?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }}
                    style={{
                      minHeight: "76px",
                      borderRadius: "24px",
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.08)",
                      color: "#FFFFFF",
                      padding: "0 26px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      cursor: "pointer",
                      fontSize: "18px",
                      fontWeight: 950,
                      textAlign: "left",
                    }}
                  >
                    <span>⚙️ 설비현황 입력하기</span>
                    <span>+</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "18px",
              marginBottom: "28px",
            }}
          >
            {[
              ["저장 지원사업", `${savedPolicies.length}건`, "#0B7A53"],
              ["등록 설비", `${completedEquipmentCount}대`, "#344BA0"],
              ["최근 분석", `${analysisHistories.length}건`, "#E65F00"],
              ["입력 완성도", `${completionScore}%`, "#CD2E3A"],
            ].map(([label, value, color]) => (
              <div
                key={label}
                className="card"
                style={{
                  padding: "26px",
                  borderRadius: "26px",
                  borderLeft: `7px solid ${color}`,
                }}
              >
                <span
                  style={{
                    display: "block",
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                    marginBottom: "12px",
                  }}
                >
                  {label}
                </span>

                <b
                  style={{
                    display: "block",
                    color,
                    fontFamily: "DM Mono, monospace",
                    fontSize: "34px",
                    fontWeight: 500,
                    letterSpacing: "-1px",
                  }}
                >
                  {value}
                </b>
              </div>
            ))}
          </div>

          <div
            id="company-profile-form"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              alignItems: companyDetailsOpen ? "start" : "stretch",
              scrollMarginTop: "120px",
            }}
          >
            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "visible",
                ...(companyDetailsOpen ? {} : { minHeight: "960px" }),
                display: "flex",
                flexDirection: "column",
                alignSelf: companyDetailsOpen ? "start" : "stretch",
                position: "relative",
              }}
            >
              <div
                style={{
                  padding: "30px 34px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  minHeight: "126px",
                }}
              >
                <div>
                  <h2
                    style={{
                      color: "#061B34",
                      fontSize: "28px",
                      fontWeight: 900,
                      letterSpacing: "-0.6px",
                      margin: 0,
                    }}
                  >
                    기본 정보
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    회원가입한 사용자 정보를 관리합니다.
                  </p>
                </div>

                <span className="badge blue">실사용자 입력</span>
              </div>

              <div
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "34px 38px",
                  display: "grid",
                  gap: "18px",
                  alignContent: "start",
                }}
              >
                <Field
                  label="이름"
                  value={basicInfo.name}
                  placeholder="예: 홍길동"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      name: value,
                    }))
                  }
                />

                <Field
                  label="이메일"
                  value={basicInfo.email}
                  placeholder="예: user@example.com"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      email: value,
                    }))
                  }
                />

                <div
                  style={{
                    display: "grid",
                    gap: "22px",
                  }}
                >
                  <label style={{ display: "grid", gap: "9px" }}>
                    <span
                      style={{
                        color: "#667085",
                        fontSize: "13px",
                        fontWeight: 900,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                      }}
                    >
                      현재 비밀번호
                      <span
                        style={{
                          position: "relative",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                        onMouseEnter={() => setPasswordTooltipOpen(true)}
                        onMouseLeave={() => setPasswordTooltipOpen(false)}
                        onFocus={() => setPasswordTooltipOpen(true)}
                        onBlur={() => setPasswordTooltipOpen(false)}
                      >
                        <button
                          type="button"
                          aria-label="비밀번호 변경 안내"
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "999px",
                            border: "0",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#F1F5F9",
                            color: "#64748B",
                            fontSize: "11px",
                            fontWeight: 800,
                            cursor: "help",
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          i
                        </button>

                        {passwordTooltipOpen && (
                          <span
                            style={{
                              position: "absolute",
                              left: "0",
                              bottom: "calc(100% + 10px)",
                              transform: "none",
                              width: "360px",
                              maxWidth: "min(360px, calc(100vw - 80px))",
                              borderRadius: "16px",
                              background: "#061B34",
                              color: "#FFFFFF",
                              padding: "13px 15px",
                              fontSize: "12px",
                              fontWeight: 800,
                              lineHeight: 1.55,
                              boxShadow: "0 14px 34px rgba(6,27,52,.2)",
                              zIndex: 30,
                              whiteSpace: "normal",
                            }}
                          >
                            비밀번호를 변경한 뒤에는 맨 아래의 프로필 저장하기
                            버튼을 눌러야 최종 적용됩니다.
                          </span>
                        )}
                      </span>
                    </span>

                    <input
                      type="password"
                      value={passwordInfo.currentPassword}
                      placeholder="현재 비밀번호"
                      onChange={(event) =>
                        setPasswordInfo((prev) => ({
                          ...prev,
                          currentPassword: event.target.value,
                        }))
                      }
                      style={{
                        height: "52px",
                        borderRadius: "18px",
                        border: "1px solid #E2E8F0",
                        background: "#FFFFFF",
                        color: "#061B34",
                        padding: "0 16px",
                        fontSize: "15px",
                        fontWeight: 800,
                        outline: "none",
                        boxSizing: "border-box",
                        width: "100%",
                      }}
                    />
                  </label>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "14px",
                    }}
                  >
                    <Field
                      label="새 비밀번호"
                      type="password"
                      value={passwordInfo.newPassword}
                      placeholder="새 비밀번호"
                      onChange={(value) =>
                        setPasswordInfo((prev) => ({
                          ...prev,
                          newPassword: value,
                        }))
                      }
                    />

                    <Field
                      label="새 비밀번호 확인"
                      type="password"
                      value={passwordInfo.confirmPassword}
                      placeholder="새 비밀번호 확인"
                      onChange={(value) =>
                        setPasswordInfo((prev) => ({
                          ...prev,
                          confirmPassword: value,
                        }))
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "8px",
                      }}
                    >
                      {[0, 1, 2].map((bar) => (
                        <span
                          key={bar}
                          style={{
                            height: "7px",
                            borderRadius: "999px",
                            background:
                              passwordStrength.percent >= (bar + 1) * 34
                                ? passwordStrength.color
                                : "#E5E7EB",
                          }}
                        />
                      ))}
                    </div>

                    <span
                      style={{
                        color: "#667085",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      비밀번호 보안 수준: {passwordStrength.label}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {passwordChecks.map(([label, active]) => (
                        <span
                          key={label}
                          style={{
                            height: "28px",
                            padding: "0 11px",
                            borderRadius: "999px",
                            display: "inline-flex",
                            alignItems: "center",
                            border: "1px solid #E2E8F0",
                            background: active ? passwordStrength.bg : "#F8FAFC",
                            color: active ? passwordStrength.color : "#94A3B8",
                            fontSize: "12px",
                            fontWeight: 900,
                          }}
                        >
                          · {label}
                        </span>
                      ))}
                    </div>

                    <p
                      style={{
                        color:
                          passwordInfo.confirmPassword && !passwordMatched
                            ? "#CD2E3A"
                            : "#667085",
                        fontSize: "12px",
                        fontWeight: 800,
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {passwordMatched
                        ? "새 비밀번호가 일치합니다."
                        : passwordInfo.confirmPassword
                          ? "새 비밀번호 확인이 일치하지 않습니다."
                          : passwordStrength.description}
                    </p>
                  </div>
                </div>

                <Field
                  label="담당자명"
                  value={basicInfo.manager}
                  placeholder="예: 홍길동"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      manager: value,
                    }))
                  }
                />

                <Field
                  label="연락처"
                  value={basicInfo.phone}
                  placeholder="예: 010-1234-5678"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      phone: formatPhoneNumber(value),
                    }))
                  }
                />

                <div
                  style={{
                    marginTop: "2px",
                    border: "1px solid #E2E8F0",
                    borderRadius: "24px",
                    background:
                      "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)",
                    padding: "22px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          color: "#061B34",
                          fontSize: "18px",
                          fontWeight: 900,
                          letterSpacing: "-0.3px",
                          margin: 0,
                        }}
                      >
                        프로필 저장 상태
                      </h3>

                      <p
                        style={{
                          color: "#667085",
                          fontSize: "13px",
                          fontWeight: 800,
                          lineHeight: 1.6,
                          margin: "7px 0 0",
                        }}
                      >
                        저장 후 기업·설비 정보가 맞춤 분석 기준으로 사용됩니다.
                      </p>
                    </div>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: "32px",
                        padding: "0 13px",
                        borderRadius: "999px",
                        background: profileCompleted ? "#E6F6EF" : "#FFF4E5",
                        color: profileCompleted ? "#0B7A53" : "#B45309",
                        fontSize: "12px",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {profileCompleted ? "저장 완료" : "저장 필요"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <ChecklistItem done={basicInfoDone} label="기본정보 입력" />
                    <ChecklistItem done={companyInfoDone} label="기업정보 입력" />
                    <ChecklistItem done={equipmentInfoDone} label="설비 1개 이상 등록" />
                  </div>
                </div>
              </div>
            </section>

            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "visible",
                ...(companyDetailsOpen ? {} : { minHeight: "960px" }),
                display: "flex",
                flexDirection: "column",
                alignSelf: companyDetailsOpen ? "start" : "stretch",
                position: "relative",
              }}
            >
              <div
                style={{
                  padding: "30px 34px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  minHeight: "126px",
                }}
              >
                <div>
                  <h2
                    style={{
                      color: "#061B34",
                      fontSize: "28px",
                      fontWeight: 900,
                      letterSpacing: "-0.6px",
                      margin: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    기업정보

                    <span
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        zIndex: 1000,
                      }}
                      onMouseEnter={() => setCompanyInfoTooltipOpen(true)}
                      onMouseLeave={() => setCompanyInfoTooltipOpen(false)}
                      onFocus={() => setCompanyInfoTooltipOpen(true)}
                      onBlur={() => setCompanyInfoTooltipOpen(false)}
                    >
                      <button
                        type="button"
                        aria-label="기업정보 활용 기준 안내"
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "999px",
                          border: "0",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#F1F5F9",
                          color: "#64748B",
                          fontSize: "13px",
                          fontWeight: 900,
                          cursor: "help",
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        i
                      </button>

                      {companyInfoTooltipOpen && (
                        <span
                          style={{
                            position: "absolute",
                            left: "0",
                            bottom: "calc(100% + 12px)",
                            width: "430px",
                            maxWidth: "min(430px, calc(100vw - 80px))",
                            borderRadius: "18px",
                            background: "#061B34",
                            color: "#FFFFFF",
                            padding: "16px 18px",
                            fontSize: "13px",
                            fontWeight: 850,
                            lineHeight: 1.65,
                            boxShadow: "0 16px 38px rgba(6,27,52,.24)",
                            zIndex: 999,
                            whiteSpace: "normal",
                            letterSpacing: "-0.2px",
                          }}
                        >
                          업종코드, 지역, 직원 수, 연 매출액은 지원사업 매칭과 기업규모 판정에 사용됩니다.
                          2년 전·3년 전 매출액이 없으면 연 매출액으로 평균값을 계산합니다.
                        </span>
                      )}
                    </span>
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    지원사업 추천 기준으로 사용되는 정보입니다.
                  </p>
                </div>

                <span className="badge green">매칭 기준</span>
              </div>

              <div
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "34px 38px",
                  display: "grid",
                  gap: "18px",
                  alignContent: "start",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                    alignItems: "start",
                  }}
                >
                  <Field
                    label="기업명"
                    required
                    value={companyInfo.companyName}
                    placeholder="예: 평우제조"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        companyName: value,
                      }))
                    }
                  />

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <SelectField
                      label="기업규모"
                      required
                      value={companyInfo.companySize}
                      onChange={(value) =>
                        setCompanyInfo((prev) => ({
                          ...prev,
                          companySize: value,
                        }))
                      }
                      options={[
                        "선택 필요",
                        "소상공인",
                        "소기업",
                        "중소기업",
                        "중견기업",
                        "대기업",
                        "확인 필요",
                      ]}
                    />

                    <p
                      style={{
                        color: "#94A3B8",
                        fontSize: "12px",
                        fontWeight: 800,
                        lineHeight: 1.5,
                        margin: 0,
                        paddingLeft: "2px",
                      }}
                    >
                      백엔드 company_type 필수값입니다.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  {companyInfo.industries.map((industryItem, index) => {

                    return (
                      <div
                        key={industryItem.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 0.72fr",
                          gap: "14px",
                          alignItems: "start",
                        }}
                      >
                        <label style={{ display: "grid", gap: "9px" }}>
                          <span
                            style={{
                              color: "#667085",
                              fontSize: "13px",
                              fontWeight: 900,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "7px",
                              minHeight: "26px",
                            }}
                          >
                            업종명
                            {index === 0 && (
                              <span
                                style={{
                                  color: "#CD2E3A",
                                  marginLeft: "-3px",
                                }}
                              >
                                *
                              </span>
                            )}
                            {index === 0 && (
                              <span
                                style={{
                                  position: "relative",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                                onMouseEnter={() => setIndustryTooltipOpen(true)}
                                onMouseLeave={() => setIndustryTooltipOpen(false)}
                                onFocus={() => setIndustryTooltipOpen(true)}
                                onBlur={() => setIndustryTooltipOpen(false)}
                              >
                                <button
                                  type="button"
                                  aria-label="업종 입력 안내"
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "999px",
                                    border: "0",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "#F1F5F9",
                                    color: "#64748B",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    cursor: "help",
                                    lineHeight: 1,
                                    padding: 0,
                                  }}
                                >
                                  i
                                </button>

                                {industryTooltipOpen && (
                                  <span
                                    style={{
                                      position: "absolute",
                                      left: "0",
                                      bottom: "calc(100% + 10px)",
                                      transform: "none",
                                      width: "310px",
                                      maxWidth: "min(310px, calc(100vw - 80px))",
                                      borderRadius: "16px",
                                      background: "#061B34",
                                      color: "#FFFFFF",
                                      padding: "13px 15px",
                                      fontSize: "12px",
                                      fontWeight: 800,
                                      lineHeight: 1.55,
                                      boxShadow: "0 14px 34px rgba(6,27,52,.2)",
                                      zIndex: 30,
                                      whiteSpace: "normal",
                                    }}
                                  >
                                    첫 번째 업종은 주업종, 추가한 업종은 부업종으로
                                    저장됩니다. 업종명을 입력하면 가능한 업종코드를
                                    자동으로 추천합니다.
                                  </span>
                                )}
                              </span>
                            )}
                          </span>

                          <input
                            type="text"
                            value={industryItem.industry}
                            placeholder="예: 금속 가공업"
                            onChange={(event) =>
                              updateIndustry(
                                industryItem.id,
                                "industry",
                                event.target.value,
                              )
                            }
                            style={{
                              height: "52px",
                              borderRadius: "18px",
                              border: "1px solid #E2E8F0",
                              background: "#FFFFFF",
                              color: "#061B34",
                              padding: "0 16px",
                              fontSize: "15px",
                              fontWeight: 800,
                              outline: "none",
                              boxSizing: "border-box",
                              width: "100%",
                            }}
                          />
                        </label>

                        <div
                          style={{
                            display: "grid",
                            gap: "9px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "10px",
                              minHeight: "26px",
                            }}
                          >
                            <span
                              style={{
                                color: "#667085",
                                fontSize: "13px",
                                fontWeight: 900,
                              }}
                            >
                              업종코드
                              {index === 0 && (
                                <span
                                  style={{
                                    color: "#CD2E3A",
                                    marginLeft: "4px",
                                  }}
                                >
                                  *
                                </span>
                              )}
                            </span>

                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => removeIndustry(industryItem.id)}
                                style={{
                                  height: "26px",
                                  padding: "0 10px",
                                  borderRadius: "999px",
                                  border: "1px solid #F3D6D9",
                                  background: "#FFFFFF",
                                  color: "#CD2E3A",
                                  fontSize: "11px",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                삭제
                              </button>
                            )}
                          </div>

                          <input
                            type="text"
                            value={industryItem.industryCode}
                            placeholder="예: C25"
                            onChange={(event) =>
                              updateIndustry(
                                industryItem.id,
                                "industryCode",
                                event.target.value,
                              )
                            }
                            style={{
                              height: "52px",
                              borderRadius: "18px",
                              border: "1px solid #E2E8F0",
                              background: "#FFFFFF",
                              color: "#061B34",
                              padding: "0 16px",
                              fontSize: "15px",
                              fontWeight: 800,
                              outline: "none",
                              boxSizing: "border-box",
                              width: "100%",
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    onClick={addIndustry}
                    style={{
                      width: "100%",
                      minHeight: "58px",
                      padding: "0 16px",
                      borderRadius: "22px",
                      border: "1px dashed #AAB7D9",
                      background: "#F8FAFC",
                      color: "#344BA0",
                      fontSize: "15px",
                      fontWeight: 950,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + 업종 추가하기
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 0.72fr",
                    gap: "14px",
                  }}
                >
                  <Field
                    label="지역"
                    required
                    value={companyInfo.region}
                    placeholder="예: 경기 안산시"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        region: value,
                      }))
                    }
                  />

                  <Field
                    label="직원 수"
                    required
                    value={companyInfo.employees}
                    placeholder="예: 45"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        employees: value,
                      }))
                    }
                  />
                </div>

                <label
                  style={{
                    display: "grid",
                    gap: "9px",
                  }}
                >
                  <span
                    style={{
                      color: "#667085",
                      fontSize: "13px",
                      fontWeight: 900,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                    }}
                  >
                    연 매출액
                    <span
                      style={{
                        color: "#CD2E3A",
                        marginLeft: "4px",
                      }}
                    >
                      *
                    </span>
                    <span
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      onMouseEnter={() => setAnnualRevenueTooltipOpen(true)}
                      onMouseLeave={() => setAnnualRevenueTooltipOpen(false)}
                      onFocus={() => setAnnualRevenueTooltipOpen(true)}
                      onBlur={() => setAnnualRevenueTooltipOpen(false)}
                    >
                      <button
                        type="button"
                        aria-label="연 매출액 입력 안내"
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "999px",
                          border: "0",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#F1F5F9",
                          color: "#64748B",
                          fontSize: "11px",
                          fontWeight: 800,
                          cursor: "help",
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        i
                      </button>

                      {annualRevenueTooltipOpen && (
                        <span
                          style={{
                            position: "absolute",
                            left: "0",
                            bottom: "calc(100% + 10px)",
                            width: "280px",
                            maxWidth: "min(280px, calc(100vw - 80px))",
                            borderRadius: "16px",
                            background: "#061B34",
                            color: "#FFFFFF",
                            padding: "13px 15px",
                            fontSize: "12px",
                            fontWeight: 800,
                            lineHeight: 1.55,
                            boxShadow: "0 14px 34px rgba(6,27,52,.2)",
                            zIndex: 30,
                            whiteSpace: "normal",
                          }}
                        >
                          직전년도 연 매출액을 입력하시면 됩니다.
                        </span>
                      )}
                    </span>
                  </span>

                  <input
                    type="text"
                    value={companyInfo.annualRevenue}
                    placeholder="예: 100,000"
                    onChange={(event) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        annualRevenue: formatCommaNumber(event.target.value),
                      }))
                    }
                    style={{
                      height: "52px",
                      borderRadius: "18px",
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                      color: "#061B34",
                      padding: "0 16px",
                      fontSize: "15px",
                      fontWeight: 800,
                      outline: "none",
                      boxSizing: "border-box",
                      width: "100%",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      alignItems: "center",
                      paddingTop: "2px",
                      marginBottom: "14px",
                    }}
                  >
                    {[
                      "단위: 만원",
                      "예: 10억 원 = 100000",
                      `${CURRENT_YEAR}년 기준 ${PREVIOUS_YEAR}년 매출액`,
                    ].map((item) => (
                      <span
                        key={item}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: "28px",
                          padding: "0 12px",
                          borderRadius: "999px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          color: "#667085",
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </label>

                <details
                  open={revenueDetailsOpen}
                  onToggle={(event) =>
                    setRevenueDetailsOpen(event.currentTarget.open)
                  }
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "24px",
                    background: "#FFFFFF",
                    padding: "18px 20px",
                    minHeight: "84px",
                  }}
                >
                  <summary
                    style={{
                      color: "#061B34",
                      fontSize: "15px",
                      fontWeight: 950,
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <span>최근 3개년 매출 입력하기</span>

                    <span
                      style={{
                        color: "#94A3B8",
                        fontSize: "12px",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {revenueDetailsOpen ? "닫기" : "열기"}
                    </span>
                  </summary>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "14px",
                      marginTop: "18px",
                    }}
                  >
                    <Field
                      label={`${TWO_YEARS_AGO}년 매출액`}
                      value={companyInfo.revenue2YearsAgo}
                      placeholder="예: 95,000"
                      helperText="단위: 만원"
                      onChange={(value) =>
                        setCompanyInfo((prev) => ({
                          ...prev,
                          revenue2YearsAgo: formatCommaNumber(value),
                        }))
                      }
                    />

                    <Field
                      label={`${THREE_YEARS_AGO}년 매출액`}
                      value={companyInfo.revenue3YearsAgo}
                      placeholder="예: 90,000"
                      helperText="단위: 만원"
                      onChange={(value) =>
                        setCompanyInfo((prev) => ({
                          ...prev,
                          revenue3YearsAgo: formatCommaNumber(value),
                        }))
                      }
                    />
                  </div>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "12px",
                      fontWeight: 800,
                      lineHeight: 1.6,
                      margin: "14px 0 0",
                    }}
                  >
                    입력하지 않으면 직전년도 매출액을 기준으로 3년 평균값을 계산합니다.
                  </p>
                </details>

                <details
                  open={companyOptionalDetailsOpen}
                  onToggle={(event) =>
                    setCompanyOptionalDetailsOpen(event.currentTarget.open)
                  }
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "24px",
                    background: "#FFFFFF",
                    padding: "18px 20px",
                    minHeight: "84px",
                  }}
                >
                  <summary
                    style={{
                      color: "#061B34",
                      fontSize: "15px",
                      fontWeight: 950,
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <span>선택정보 더 입력하기</span>

                    <span
                      style={{
                        color: "#94A3B8",
                        fontSize: "12px",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {companyOptionalDetailsOpen ? "닫기" : "열기"}
                    </span>
                  </summary>

                  <div
                    style={{
                      display: "grid",
                      gap: "14px",
                      marginTop: "18px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "14px",
                        alignItems: "start",
                      }}
                    >
                      <Field
                        label="사업자등록번호"
                        value={companyInfo.businessNumber}
                        placeholder="예: 123-45-67890"
                        onChange={(value) =>
                          setCompanyInfo((prev) => ({
                            ...prev,
                            businessNumber: formatBusinessNumber(value),
                          }))
                        }
                      />

                      <Field
                        label="기업자산 총액"
                        value={companyInfo.assetTotalManwon}
                        placeholder="예: 500,000"
                        helperText="단위: 만원"
                        onChange={(value) =>
                          setCompanyInfo((prev) => ({
                            ...prev,
                            assetTotalManwon: formatCommaNumber(value),
                          }))
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "14px",
                      }}
                    >
                      <SelectField
                        label="대기업 계열사 여부"
                        value={companyInfo.affiliateStatus}
                        onChange={(value) =>
                          setCompanyInfo((prev) => ({
                            ...prev,
                            affiliateStatus: value,
                          }))
                        }
                        options={[
                          "선택 필요",
                          "무소속",
                          "대기업 계열사 소속",
                          "확인 필요",
                        ]}
                      />

                      <Field
                        label="설립연도"
                        value={companyInfo.foundedYear}
                        placeholder="예: 2024"
                        onChange={(value) =>
                          setCompanyInfo((prev) => ({
                            ...prev,
                            foundedYear: value,
                          }))
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "14px",
                      }}
                    >
                      <SelectField
                        label="사업장 유형"
                        value={companyInfo.businessSiteType}
                        onChange={(value) =>
                          setCompanyInfo((prev) => ({
                            ...prev,
                            businessSiteType: value,
                          }))
                        }
                        options={[
                          "선택 필요",
                          "본사",
                          "공장",
                          "연구소",
                          "지점",
                          "본사+공장",
                          "기타",
                        ]}
                      />

                      <SelectField
                        label="주요 목적"
                        value={companyInfo.purpose}
                        onChange={(value) =>
                          setCompanyInfo((prev) => ({
                            ...prev,
                            purpose: value,
                          }))
                        }
                        options={[
                          "선택 필요",
                          "지원사업 추천",
                          "ROI 분석",
                          "설비 교체",
                          "에너지 절감",
                          "안전점검",
                          "신청서 생성",
                        ]}
                      />
                    </div>
                  </div>
                </details>

              </div>
            </section>
          </div>

          <section
            id="equipment-profile-form"
            className="card"
            style={{
              borderRadius: "32px",
              overflow: "hidden",
              marginTop: "24px",
              scrollMarginTop: "120px",
            }}
          >
            <div
              style={{
                padding: "30px 34px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    color: "#061B34",
                    fontSize: "28px",
                    fontWeight: 900,
                    letterSpacing: "-0.6px",
                    margin: 0,
                  }}
                >
                  설비현황
                </h2>

                <p
                  style={{
                    color: "#667085",
                    fontSize: "14px",
                    fontWeight: 800,
                    marginTop: "8px",
                  }}
                >
                  ROI 분석과 안전점검에 사용할 설비 정보를 관리합니다.
                </p>
              </div>

              <button
                type="button"
                className="btn blue"
                onClick={addEquipment}
                style={{
                  minWidth: "142px",
                }}
              >
                설비 추가
              </button>
            </div>

            <div
              style={{
                padding: "34px",
                display: "grid",
                gap: "18px",
              }}
            >
              {equipmentList.map((equipment, index) => {
                return (
                  <div
                    key={equipment.id}
                    style={{
                      display: "grid",
                      gap: "18px",
                      padding: "22px",
                      border: "1px solid #E2E8F0",
                      borderRadius: "26px",
                      background: "#F8FAFC",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span className="badge orange">
                          설비 {index + 1}
                        </span>

                        <h3
                          style={{
                            color: "#061B34",
                            fontSize: "22px",
                            fontWeight: 900,
                            letterSpacing: "-0.4px",
                            margin: "12px 0 0",
                          }}
                        >
                          {equipment.name || "새 설비 정보 입력"}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeEquipment(equipment.id)}
                        style={{
                          height: "42px",
                          padding: "0 16px",
                          borderRadius: "999px",
                          border: "1px solid #E2E8F0",
                          background: "#FFFFFF",
                          color: "#CD2E3A",
                          fontSize: "13px",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "14px",
                        border: "1px solid #E2E8F0",
                        borderRadius: "22px",
                        background: "#FFFFFF",
                        padding: "20px",
                      }}
                    >
                      <h4
                        style={{
                          color: "#061B34",
                          fontSize: "16px",
                          fontWeight: 950,
                          letterSpacing: "-0.2px",
                          margin: 0,
                        }}
                      >
                        설비 기본정보
                      </h4>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.2fr 0.85fr 1fr",
                          gap: "14px",
                          alignItems: "start",
                        }}
                      >
                        <Field
                          label="설비명"
                          required
                          value={equipment.name}
                          placeholder="예: 프레스 설비"
                          onChange={(value) =>
                            updateEquipment(equipment.id, "name", value)
                          }
                        />

                        <SelectField
                          label="설비 카테고리"
                          required
                          value={equipment.category}
                          onChange={(value) =>
                            updateEquipment(equipment.id, "category", value)
                          }
                          options={[
                            "선택 필요",
                            "press",
                            "cnc",
                            "injection",
                            "welding",
                            "compressor",
                            "etc",
                          ]}
                        />

                        <Field
                          label="공정"
                          value={equipment.process}
                          placeholder="예: 프레스 성형"
                          onChange={(value) =>
                            updateEquipment(equipment.id, "process", value)
                          }
                        />
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "0.75fr 1fr 0.85fr",
                          gap: "14px",
                          alignItems: "start",
                        }}
                      >
                        <Field
                          label="설비 사용연수"
                          required
                          value={equipment.years}
                          placeholder="예: 15"
                          onChange={(value) =>
                            updateEquipment(equipment.id, "years", value)
                          }
                        />

                        <Field
                          label="연간 에너지 비용"
                          required
                          value={equipment.annualEnergyCost}
                          placeholder="예: 4,500"
                          helperText="단위: 만원"
                          onChange={(value) =>
                            updateEquipment(
                              equipment.id,
                              "annualEnergyCost",
                              formatCommaNumber(value),
                            )
                          }
                        />

                        <Field
                          label="불량률"
                          value={equipment.defectRate}
                          placeholder="예: 3.2"
                          helperText="% 단위"
                          onChange={(value) =>
                            updateEquipment(equipment.id, "defectRate", value)
                          }
                        />

                      </div>
                    </div>

                    <details
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "22px",
                        background: "#FFFFFF",
                        padding: "18px 20px",
                      }}
                    >
                      <summary
                        style={{
                          color: "#061B34",
                          fontSize: "15px",
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
                            fontSize: "12px",
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
                          gap: "14px",
                          alignItems: "start",
                          marginTop: "18px",
                        }}
                      >
                        <Field
                          label="전체교체 예상 투자금"
                          value={equipment.scenarioAInvestment}
                          placeholder="예: 22,000"
                          helperText="단위: 만원 · scenario_a_investment_manwon"
                          onChange={(value) =>
                            updateEquipment(
                              equipment.id,
                              "scenarioAInvestment",
                              formatCommaNumber(value),
                            )
                          }
                        />

                        <Field
                          label="부분교체 예상 투자금"
                          value={equipment.scenarioBInvestment}
                          placeholder="예: 4,994"
                          helperText="단위: 만원 · scenario_b_investment_manwon"
                          onChange={(value) =>
                            updateEquipment(
                              equipment.id,
                              "scenarioBInvestment",
                              formatCommaNumber(value),
                            )
                          }
                        />
                      </div>

                      <p
                        style={{
                          color: "#667085",
                          fontSize: "12px",
                          fontWeight: 800,
                          lineHeight: 1.6,
                          margin: "14px 0 0",
                        }}
                      >
                        입력하지 않으면 업계 평균 투자금으로 ROI를 추정합니다.
                        입력하면 실제 투자 계획에 가까운 ROI 분석이 가능합니다.
                      </p>
                    </details>

                    <details
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "22px",
                        background: "#FFFFFF",
                        padding: "18px 20px",
                      }}
                    >
                      <summary
                        style={{
                          color: "#061B34",
                          fontSize: "15px",
                          fontWeight: 950,
                          cursor: "pointer",
                          listStyle: "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "14px",
                        }}
                      >
                        <span>추가 운영지표 입력하기</span>

                        <span
                          style={{
                            color: "#94A3B8",
                            fontSize: "12px",
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                          }}
                        >
                          선택
                        </span>
                      </summary>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: "14px",
                          alignItems: "start",
                          marginTop: "18px",
                        }}
                      >
                        <Field
                          label="유지보수비"
                          value={equipment.maintenanceCostAnnual}
                          placeholder="예: 1,200"
                          helperText="만원/년"
                          onChange={(value) =>
                            updateEquipment(
                              equipment.id,
                              "maintenanceCostAnnual",
                              formatCommaNumber(value),
                            )
                          }
                        />

                        <Field
                          label="현재 생산능력"
                          value={equipment.currentCapacityValue}
                          placeholder="예: 100"
                          onChange={(value) =>
                            updateEquipment(
                              equipment.id,
                              "currentCapacityValue",
                              value,
                            )
                          }
                        />

                        <Field
                          label="연간 생산량"
                          value={equipment.productionQty}
                          placeholder="예: 50000"
                          onChange={(value) =>
                            updateEquipment(equipment.id, "productionQty", value)
                          }
                        />

                        <Field
                          label="제품 개당 예상이익"
                          value={equipment.contributionMarginWon}
                          placeholder="예: 12,000"
                          helperText="원 단위"
                          onChange={(value) =>
                            updateEquipment(
                              equipment.id,
                              "contributionMarginWon",
                              formatCommaNumber(value),
                            )
                          }
                        />
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          </section>

          <section
            style={{
              marginTop: "28px",
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "30px",
              padding: "26px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "20px",
              alignItems: "center",
              boxShadow: "0 16px 48px rgba(15,23,42,.06)",
            }}
          >
            <div>
              <h2
                style={{
                  color: "#061B34",
                  fontSize: "24px",
                  fontWeight: 900,
                  letterSpacing: "-0.4px",
                  margin: 0,
                }}
              >
                분석 준비
              </h2>

              <p
                style={{
                  color: "#667085",
                  fontSize: "14px",
                  fontWeight: 800,
                  lineHeight: 1.7,
                  margin: "8px 0 0",
                }}
              >
                저장된 기업·설비 정보를 기준으로 ROI 분석과 지원사업 추천을
                시작할 수 있습니다. 프로필 저장 후 발급된 company_id를 기준으로
                분석 API를 호출합니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn blue"
                onClick={handleSave}
                disabled={saving}
                style={{
                  minWidth: "180px",
                  opacity: saving ? 0.72 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "저장 중..." : "프로필 저장하기"}
              </button>

              <button
                type="button"
                className="btn dark"
                onClick={goToAnalysis}
                disabled={analyzing}
                style={{
                  minWidth: "180px",
                  opacity: analyzing ? 0.72 : 1,
                  cursor: analyzing ? "not-allowed" : "pointer",
                }}
              >
                {analyzing ? "분석 중..." : "분석 시작하기"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                style={{
                  minWidth: "120px",
                  height: "52px",
                  borderRadius: "999px",
                  border: "1px solid #E2E8F0",
                  background: "#FFFFFF",
                  color: "#667085",
                  fontSize: "14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                초기화
              </button>
            </div>
          </section>

          {saved && (
            <div
              style={{
                position: "fixed",
                right: "32px",
                bottom: "32px",
                zIndex: 100,
                background: "#061B34",
                color: "#FFFFFF",
                borderRadius: "22px",
                padding: "18px 22px",
                minWidth: "292px",
                boxShadow: "0 18px 42px rgba(6,27,52,.24)",
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "999px",
                    background: "#E6F6EF",
                    color: "#0B7A53",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>

                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "15px",
                      fontWeight: 900,
                      marginBottom: "4px",
                    }}
                  >
                    프로필 저장 완료
                  </strong>

                  <p
                    style={{
                      color: "rgba(255,255,255,.72)",
                      fontSize: "13px",
                      fontWeight: 800,
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    입력한 기업·설비 정보가 저장되었습니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
