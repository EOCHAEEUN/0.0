import { useMemo, useState } from "react"
import AppHeader from "../components/AppHeader"

type BasicInfo = {
  name: string
  email: string
  manager: string
  phone: string
}

type CompanyInfo = {
  companyName: string
  businessNumber: string
  industry: string
  industryCode: string
  region: string
  employees: string
  annualRevenue: string
  affiliateStatus: string
  purpose: string
}

type EquipmentInfo = {
  id: number
  name: string
  category: string
  process: string
  years: string
  annualEnergyCost: string
  defectRate: string
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

const STORAGE_KEY = "factofit_mypage_profile"

const emptyBasicInfo: BasicInfo = {
  name: "",
  email: "",
  manager: "",
  phone: "",
}

const emptyCompanyInfo: CompanyInfo = {
  companyName: "",
  businessNumber: "",
  industry: "",
  industryCode: "",
  region: "",
  employees: "",
  annualRevenue: "",
  affiliateStatus: "선택 필요",
  purpose: "선택 필요",
}

const createEmptyEquipment = (id: number): EquipmentInfo => ({
  id,
  name: "",
  category: "선택 필요",
  process: "",
  years: "",
  annualEnergyCost: "",
  defectRate: "",
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

const MANUFACTURING_SME_REVENUE_LIMIT_BY_CODE: Record<string, number> = {
  C: 1500,
  C10: 1000,
  C13: 1000,
  C20: 1500,
  C21: 1500,
  C22: 1500,
  C24: 1500,
  C25: 1500,
  C26: 1500,
  C27: 1000,
  C28: 1500,
  C29: 1500,
  C30: 1500,
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
      companyInfo: {
        ...emptyCompanyInfo,
        ...parsed.companyInfo,
      },
      equipmentList: parsed.equipmentList,
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

function inferCompanySize({
  industryCode,
  employees,
  annualRevenue,
  affiliateStatus,
}: {
  industryCode: string
  employees: string
  annualRevenue: string
  affiliateStatus: string
}) {
  if (affiliateStatus === "대기업 계열사 소속") {
    return "대기업 계열사 검토"
  }

  const employeeCount = Number(employees.replace(/[^0-9]/g, "")) || 0
  const revenue = Number(annualRevenue.replace(/[^0-9.]/g, "")) || 0
  const codes = parseIndustryCodes(industryCode)
  const baseCode = codes[0] ?? "C"
  const revenueLimit = MANUFACTURING_SME_REVENUE_LIMIT_BY_CODE[baseCode] ?? 1500

  if (!employeeCount && !revenue) return "판정 대기"
  if (employeeCount <= 10 && revenue <= 120) return "소상공인 가능"
  if (revenue > revenueLimit) return "중견·대기업 검토"
  if (employeeCount > 300 || revenue >= 400) return "중소기업 가능"

  return "소기업·중소기업 가능"
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
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
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
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
    </label>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      style={{
        border: "1px dashed #CBD5E1",
        borderRadius: "24px",
        padding: "28px",
        background: "#F8FAFC",
        textAlign: "center",
      }}
    >
      <strong
        style={{
          display: "block",
          color: "#061B34",
          fontSize: "18px",
          fontWeight: 900,
          marginBottom: "8px",
        }}
      >
        {title}
      </strong>

      <p
        style={{
          color: "#667085",
          fontSize: "14px",
          fontWeight: 800,
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
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
  const [profileCompleted, setProfileCompleted] = useState(
    storedData?.profileCompleted ?? false,
  )

  const [basicInfo, setBasicInfo] = useState<BasicInfo>(
    storedData?.basicInfo ?? emptyBasicInfo,
  )

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(
    storedData?.companyInfo ?? emptyCompanyInfo,
  )

  const [equipmentList, setEquipmentList] = useState<EquipmentInfo[]>(
    storedData?.equipmentList && storedData.equipmentList.length > 0
      ? storedData.equipmentList
      : [createEmptyEquipment(1)],
  )

  const inferredCompanySize = useMemo(() => {
    return inferCompanySize({
      industryCode: companyInfo.industryCode,
      employees: companyInfo.employees,
      annualRevenue: companyInfo.annualRevenue,
      affiliateStatus: companyInfo.affiliateStatus,
    })
  }, [
    companyInfo.industryCode,
    companyInfo.employees,
    companyInfo.annualRevenue,
    companyInfo.affiliateStatus,
  ])

  const basicInfoDone = useMemo(() => {
    return Boolean(
      basicInfo.name.trim() &&
        basicInfo.email.trim() &&
        basicInfo.manager.trim() &&
        basicInfo.phone.trim(),
    )
  }, [basicInfo])

  const companyInfoDone = useMemo(() => {
    return Boolean(
      companyInfo.companyName.trim() &&
        companyInfo.industry.trim() &&
        companyInfo.industryCode.trim() &&
        companyInfo.region.trim() &&
        companyInfo.employees.trim() &&
        companyInfo.annualRevenue.trim() &&
        companyInfo.affiliateStatus !== "선택 필요" &&
        companyInfo.purpose !== "선택 필요",
    )
  }, [companyInfo])

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

  const completionScore = useMemo(() => {
    const basicRequiredValues = [
      basicInfo.name,
      basicInfo.email,
      basicInfo.manager,
      basicInfo.phone,
    ]

    const companyRequiredValues = [
      companyInfo.companyName,
      companyInfo.industry,
      companyInfo.industryCode,
      companyInfo.region,
      companyInfo.employees,
      companyInfo.annualRevenue,
      companyInfo.affiliateStatus !== "선택 필요"
        ? companyInfo.affiliateStatus
        : "",
      companyInfo.purpose !== "선택 필요" ? companyInfo.purpose : "",
    ]

    const equipmentRequiredValues = equipmentList.flatMap((equipment) => [
      equipment.name,
      equipment.category !== "선택 필요" ? equipment.category : "",
      equipment.process,
      equipment.years,
      equipment.annualEnergyCost,
      equipment.defectRate,
      equipment.status !== "정보 입력 필요" ? equipment.status : "",
    ])

    const basicScore = Math.round(
      (basicRequiredValues.filter(Boolean).length / basicRequiredValues.length) *
        20,
    )

    const companyScore = Math.round(
      (companyRequiredValues.filter(Boolean).length /
        companyRequiredValues.length) *
        45,
    )

    const equipmentScore =
      equipmentRequiredValues.length > 0
        ? Math.round(
            (equipmentRequiredValues.filter(Boolean).length /
              equipmentRequiredValues.length) *
              35,
          )
        : 0

    return Math.min(basicScore + companyScore + equipmentScore, 100)
  }, [basicInfo, companyInfo, equipmentList])

  const missingCoreCount = useMemo(() => {
    let count = 0

    if (!basicInfoDone) count += 1
    if (!companyInfo.companyName.trim()) count += 1
    if (!companyInfo.industryCode.trim()) count += 1
    if (!companyInfo.region.trim()) count += 1
    if (!companyInfo.employees.trim()) count += 1
    if (!companyInfo.annualRevenue.trim()) count += 1
    if (companyInfo.affiliateStatus === "선택 필요") count += 1
    if (!equipmentInfoDone) count += 1

    return count
  }, [basicInfoDone, companyInfo, equipmentInfoDone])

  const handleIndustryChange = (value: string) => {
    const codes = getIndustryCodeCandidates(value)

    setCompanyInfo((prev) => ({
      ...prev,
      industry: value,
      industryCode:
        codes.length > 0 ? formatIndustryCodes(codes) : prev.industryCode,
    }))
  }

  const handleIndustryCodeChange = (value: string) => {
    const upperValue = value.toUpperCase()
    const inferredIndustry = getIndustryNameByCode(upperValue)

    setCompanyInfo((prev) => ({
      ...prev,
      industryCode: upperValue,
      industry: inferredIndustry || prev.industry,
    }))
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

  const handleSave = () => {
    const industryCodes = parseIndustryCodes(companyInfo.industryCode)

    const onboardingPayload = {
      onboarding_completed: completionScore >= 70,
      basic_info: {
        name: basicInfo.name.trim(),
        email: basicInfo.email.trim(),
        manager: basicInfo.manager.trim(),
        phone: basicInfo.phone.trim(),
      },
      company: {
        company_name: companyInfo.companyName.trim(),
        business_number: companyInfo.businessNumber.trim(),
        industry_name: companyInfo.industry.trim(),
        industry_code: companyInfo.industryCode.trim(),
        industry_codes: industryCodes,
        region: companyInfo.region.trim(),
        employee_count:
          Number(companyInfo.employees.replace(/[^0-9]/g, "")) || null,
        annual_revenue:
          Number(companyInfo.annualRevenue.replace(/[^0-9.]/g, "")) || null,
        affiliate_status:
          companyInfo.affiliateStatus === "선택 필요"
            ? null
            : companyInfo.affiliateStatus,
        inferred_company_size: inferredCompanySize,
        purpose:
          companyInfo.purpose === "선택 필요" ? null : companyInfo.purpose,
      },
      equipments: equipmentList.map((equipment) => ({
        equipment_name: equipment.name.trim(),
        category:
          equipment.category === "선택 필요" ? null : equipment.category,
        process: equipment.process.trim(),
        age_years: Number(equipment.years.replace(/[^0-9]/g, "")) || null,
        energy_cost_annual:
          Number(equipment.annualEnergyCost.replace(/[^0-9]/g, "")) || null,
        defect_rate:
          Number(equipment.defectRate.replace(/[^0-9.]/g, "")) || null,
        status:
          equipment.status === "정보 입력 필요" ? null : equipment.status,
      })),
      fallback_policy: {
        message:
          "입력값이 부족한 경우 분석 화면에서 업종 평균값을 fallback으로 사용할 예정입니다.",
      },
    }

    const storageData: MyPageStorageData = {
      basicInfo,
      companyInfo,
      equipmentList,
      profileCompleted: completionScore >= 70,
      savedAt: new Date().toISOString(),
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData))
    console.log("마이페이지 저장 payload:", onboardingPayload)

    setSaved(true)
    setProfileCompleted(completionScore >= 70)

    window.setTimeout(() => {
      setSaved(false)
    }, 2400)
  }

  const handleReset = () => {
    const confirmed = window.confirm("입력한 마이페이지 정보를 초기화할까요?")
    if (!confirmed) return

    window.localStorage.removeItem(STORAGE_KEY)
    setBasicInfo(emptyBasicInfo)
    setCompanyInfo(emptyCompanyInfo)
    setEquipmentList([createEmptyEquipment(1)])
    setProfileCompleted(false)
  }

  const goToAnalysis = () => {
    if (!profileCompleted) {
      window.alert(
        "기업정보와 설비정보를 먼저 저장해주세요. 입력값이 부족하면 분석 화면에서는 평균값 fallback을 사용할 수 있습니다.",
      )
      return
    }

    window.alert(
      "분석 시작 API는 백엔드 /api/dashboard/me 또는 /api/onboarding/me 연결 후 활성화 예정입니다.",
    )
  }

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

          {!profileCompleted && (
            <section
              style={{
                position: "relative",
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "1.18fr 0.82fr",
                gap: "28px",
                alignItems: "stretch",
                background:
                  "linear-gradient(135deg, #101A31 0%, #18284D 58%, #344BA0 100%)",
                borderRadius: "34px",
                padding: "36px",
                color: "#FFFFFF",
                marginBottom: "28px",
                border: "1px solid rgba(255,255,255,.14)",
                boxShadow: "0 24px 64px rgba(15,27,51,.24)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "8px",
                  background: "#F4C76B",
                }}
              />

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "grid",
                  alignContent: "center",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      height: "34px",
                      padding: "0 15px",
                      borderRadius: "999px",
                      background: "rgba(244,199,107,.16)",
                      border: "1px solid rgba(244,199,107,.35)",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "1.2px",
                    }}
                  >
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "999px",
                        background: "#F4C76B",
                      }}
                    />
                    필수 정보 입력 필요
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: "34px",
                      padding: "0 14px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,.1)",
                      border: "1px solid rgba(255,255,255,.14)",
                      color: "rgba(255,255,255,.84)",
                      fontSize: "12px",
                      fontWeight: 900,
                    }}
                  >
                    분석 준비 미완료
                  </span>
                </div>

                <h2
                  style={{
                    fontSize: "36px",
                    lineHeight: 1.24,
                    fontWeight: 950,
                    letterSpacing: "-1.1px",
                    margin: 0,
                  }}
                >
                  맞춤 분석을 위해
                  <br />
                  기업·설비 정보를 저장해주세요.
                </h2>

                <p
                  style={{
                    color: "rgba(255,255,255,.76)",
                    fontSize: "15px",
                    lineHeight: 1.85,
                    fontWeight: 800,
                    margin: 0,
                    maxWidth: "760px",
                  }}
                >
                  입력된 정보는 ROI 분석, 지원사업 추천, 신청 준비도 계산에
                  활용됩니다. 부족한 항목은 분석 단계에서 업종 평균값을
                  fallback으로 적용할 수 있습니다.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "12px",
                    marginTop: "8px",
                  }}
                >
                  {[
                    ["01", "기업 기본정보"],
                    ["02", "업종·지역 기준"],
                    ["03", "설비·비용 정보"],
                  ].map(([step, label]) => (
                    <div
                      key={step}
                      style={{
                        border: "1px solid rgba(255,255,255,.13)",
                        background: "rgba(255,255,255,.08)",
                        borderRadius: "18px",
                        padding: "14px",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#F4C76B",
                          fontFamily: "DM Mono, monospace",
                          fontSize: "13px",
                          marginBottom: "8px",
                        }}
                      >
                        STEP {step}
                      </span>

                      <b
                        style={{
                          display: "block",
                          color: "#FFFFFF",
                          fontSize: "14px",
                          fontWeight: 900,
                        }}
                      >
                        {label}
                      </b>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "grid",
                  gap: "14px",
                  alignContent: "stretch",
                }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,.1)",
                    border: "1px solid rgba(255,255,255,.16)",
                    borderRadius: "26px",
                    padding: "26px",
                    display: "grid",
                    alignContent: "center",
                    minHeight: "170px",
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
                    <span
                      style={{
                        color: "rgba(255,255,255,.72)",
                        fontSize: "13px",
                        fontWeight: 900,
                      }}
                    >
                      입력 완성도
                    </span>

                    <span
                      style={{
                        color: "#F4C76B",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      필수 항목 {missingCoreCount}개 남음
                    </span>
                  </div>

                  <strong
                    style={{
                      display: "block",
                      fontFamily: "DM Mono, monospace",
                      fontSize: "54px",
                      lineHeight: 1,
                      fontWeight: 500,
                      marginBottom: "18px",
                    }}
                  >
                    {completionScore}%
                  </strong>

                  <div
                    style={{
                      height: "10px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,.16)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${completionScore}%`,
                        height: "100%",
                        borderRadius: "999px",
                        background:
                          "linear-gradient(90deg, #F4C76B 0%, #FFFFFF 100%)",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn blue"
                  onClick={() => {
                    const target = document.getElementById("company-profile-form")
                    target?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }}
                  style={{
                    minHeight: "60px",
                    fontSize: "16px",
                    boxShadow: "0 14px 30px rgba(52,75,160,.24)",
                  }}
                >
                  필수 정보 입력하기
                </button>
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
              alignItems: "stretch",
              scrollMarginTop: "120px",
            }}
          >
            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
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
                  flex: 1,
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
                  placeholder="예: 010-0000-0000"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      phone: value,
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
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
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
                    기업정보
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
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                  }}
                >
                  <Field
                    label="기업명"
                    value={companyInfo.companyName}
                    placeholder="예: 평우제조"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        companyName: value,
                      }))
                    }
                  />

                  <Field
                    label="사업자등록번호"
                    value={companyInfo.businessNumber}
                    placeholder="예: 123-45-67890"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        businessNumber: value,
                      }))
                    }
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 0.72fr",
                    gap: "14px",
                  }}
                >
                  <Field
                    label="업종"
                    value={companyInfo.industry}
                    placeholder="예: 금속 가공업"
                    onChange={handleIndustryChange}
                  />

                  <Field
                    label="업종코드"
                    value={companyInfo.industryCode}
                    placeholder="예: C24"
                    onChange={handleIndustryCodeChange}
                  />
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                  }}
                >
                  <Field
                    label="연 매출액"
                    value={companyInfo.annualRevenue}
                    placeholder="억원 단위"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        annualRevenue: value,
                      }))
                    }
                  />

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
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                  }}
                >
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

                  <div
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
                      기업규모 예상
                    </span>

                    <div
                      style={{
                        height: "52px",
                        borderRadius: "18px",
                        border: "1px solid #E2E8F0",
                        background: "#F8FAFC",
                        color: "#061B34",
                        padding: "0 16px",
                        fontSize: "15px",
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        boxSizing: "border-box",
                      }}
                    >
                      {inferredCompanySize}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "2px",
                    border: "1px solid #E2E8F0",
                    borderRadius: "24px",
                    background: "#F8FAFC",
                    padding: "22px",
                  }}
                >
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "18px",
                      fontWeight: 900,
                      letterSpacing: "-0.3px",
                      margin: 0,
                    }}
                  >
                    기업 데이터 활용 기준
                  </h3>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "13px",
                      fontWeight: 800,
                      lineHeight: 1.7,
                      margin: "8px 0 0",
                    }}
                  >
                    업종코드, 지역, 직원 수, 매출액, 계열사 여부는 지원사업
                    매칭과 기업규모 판정 기준으로 사용됩니다. 최종 판정 기준은
                    백엔드/DB 기준 확정 후 계산됩니다.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section
            className="card"
            style={{
              borderRadius: "32px",
              overflow: "hidden",
              marginTop: "24px",
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
              {equipmentList.map((equipment, index) => (
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
                      gridTemplateColumns: "1.2fr 0.7fr 1fr",
                      gap: "14px",
                    }}
                  >
                    <Field
                      label="설비명"
                      value={equipment.name}
                      placeholder="예: 프레스 설비"
                      onChange={(value) =>
                        updateEquipment(equipment.id, "name", value)
                      }
                    />

                    <SelectField
                      label="카테고리"
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
                      gridTemplateColumns: "0.7fr 1fr 0.8fr 0.9fr",
                      gap: "14px",
                    }}
                  >
                    <Field
                      label="사용연수"
                      value={equipment.years}
                      placeholder="예: 15"
                      onChange={(value) =>
                        updateEquipment(equipment.id, "years", value)
                      }
                    />

                    <Field
                      label="연간 에너지 비용"
                      value={equipment.annualEnergyCost}
                      placeholder="만원 단위"
                      onChange={(value) =>
                        updateEquipment(
                          equipment.id,
                          "annualEnergyCost",
                          value,
                        )
                      }
                    />

                    <Field
                      label="불량률"
                      value={equipment.defectRate}
                      placeholder="예: 3.2"
                      onChange={(value) =>
                        updateEquipment(equipment.id, "defectRate", value)
                      }
                    />

                    <SelectField
                      label="상태"
                      value={equipment.status}
                      onChange={(value) =>
                        updateEquipment(equipment.id, "status", value)
                      }
                      options={[
                        "정보 입력 필요",
                        "정상",
                        "점검 필요",
                        "교체 검토",
                        "교체 권고",
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              alignItems: "start",
              marginTop: "24px",
            }}
          >
            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "hidden",
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
                    저장한 지원사업
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    북마크한 지원사업을 다시 확인할 수 있습니다.
                  </p>
                </div>

                <span className="badge green">북마크</span>
              </div>

              <div
                style={{
                  padding: "34px",
                  display: "grid",
                  gap: "16px",
                }}
              >
                {savedPolicies.length > 0 ? (
                  savedPolicies.map((policy) => (
                    <article
                      key={policy.id}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "24px",
                        padding: "20px",
                        background: "#FFFFFF",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <h3
                            style={{
                              color: "#061B34",
                              fontSize: "18px",
                              fontWeight: 900,
                              lineHeight: 1.35,
                            }}
                          >
                            {policy.title}
                          </h3>

                          <p
                            style={{
                              color: "#667085",
                              fontSize: "13px",
                              fontWeight: 800,
                              marginTop: "8px",
                            }}
                          >
                            {policy.organization} · {policy.amount}
                          </p>
                        </div>

                        <b
                          style={{
                            color: "#E65F00",
                            fontFamily: "DM Mono, monospace",
                            fontSize: "22px",
                            fontWeight: 500,
                          }}
                        >
                          {policy.dday}
                        </b>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                          marginTop: "16px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="badge blue">적합도 {policy.fit}</span>
                        <span className="badge green">저장됨</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="저장한 지원사업이 없습니다."
                    description="지원사업 추천 결과에서 관심 있는 사업을 저장하면 이곳에 표시됩니다."
                  />
                )}
              </div>
            </section>

            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "hidden",
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
                    최근 분석 기록
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    최근 실행한 분석과 신청서 작업을 확인합니다.
                  </p>
                </div>

                <span className="badge blue">히스토리</span>
              </div>

              <div
                style={{
                  padding: "34px",
                  display: "grid",
                  gap: "16px",
                }}
              >
                {analysisHistories.length > 0 ? (
                  analysisHistories.map((history) => (
                    <article
                      key={history.id}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderLeft:
                          history.status === "완료"
                            ? "6px solid #0B7A53"
                            : "6px solid #E65F00",
                        borderRadius: "24px",
                        padding: "20px",
                        background: "#FFFFFF",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <h3
                            style={{
                              color: "#061B34",
                              fontSize: "18px",
                              fontWeight: 900,
                              lineHeight: 1.35,
                            }}
                          >
                            {history.title}
                          </h3>

                          <p
                            style={{
                              color: "#667085",
                              fontSize: "13px",
                              fontWeight: 800,
                              marginTop: "8px",
                            }}
                          >
                            {history.result}
                          </p>
                        </div>

                        <span
                          className={
                            history.status === "완료"
                              ? "badge green"
                              : "badge orange"
                          }
                        >
                          {history.status}
                        </span>
                      </div>

                      <p
                        style={{
                          color: "#94A3B8",
                          fontSize: "12px",
                          fontWeight: 800,
                          marginTop: "14px",
                        }}
                      >
                        {history.date}
                      </p>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="최근 분석 기록이 없습니다."
                    description="ROI 분석, 안전점검, 신청서 생성을 실행하면 기록이 이곳에 표시됩니다."
                  />
                )}
              </div>
            </section>
          </div>

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
                시작할 수 있습니다. API 연결 전까지는 저장 payload를
                Console에서 확인합니다.
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
                style={{
                  minWidth: "180px",
                }}
              >
                프로필 저장하기
              </button>

              <button
                type="button"
                className="btn dark"
                onClick={goToAnalysis}
                style={{
                  minWidth: "180px",
                }}
              >
                분석 시작하기
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