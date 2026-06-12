import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

type LoadStatus = "idle" | "loading" | "success" | "empty" | "error"
type CardTone = "blue" | "green" | "orange"

type ParkManagerSummaryCardsProps = {
  companyId?: string
  customerId?: string
  apiBaseUrl?: string
}

type CompanyOnboardingData = {
  company_id: string
  company_name: string | null
  industry_code: string[] | string | null
  employee_count: number | null
  region: string | null
  annual_revenue: number | null
  energy_cost_annual: number | null
  created_at: string | null
  company_type: string | null
  user_id: string | null
  business_registration_no: string | null
  industry_name: string | null
  company_size: string | null
  primary_purpose: string[] | null
  updated_at: string | null
  avg_revenue_3y_manwon: number | null
  total_assets_manwon: number | null
  is_disclosure_group_member: boolean | null
  independence_check_passed: boolean | null
}

type OnboardingApiResponse = {
  success: boolean
  data: CompanyOnboardingData | null
}

type SummaryCard = {
  title: string
  value: string
  unit?: string
  description: string
  detail: string
  tone: CardTone
  path: string
  buttonLabel: string
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"

function formatShortId(id: string) {
  if (id.length <= 18) return id
  return `${id.slice(0, 8)}...${id.slice(-6)}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "미입력"
  }

  return value.toLocaleString("ko-KR")
}

function formatIndustryCode(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "미입력"
  }

  if (typeof value === "string" && value.trim()) {
    return value
  }

  return "미입력"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "미입력"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function getToneColor(tone: CardTone) {
  if (tone === "green") return "#0B7A53"
  if (tone === "orange") return "#E65F00"
  return "#344BA0"
}

function getToneSoftColor(tone: CardTone) {
  if (tone === "green") return "#E8F5EF"
  if (tone === "orange") return "#FFF2DF"
  return "#EEF6FF"
}

function getStatusLabel(status: LoadStatus) {
  if (status === "loading") return "데이터 불러오는 중"
  if (status === "success") return "데이터 연동 완료"
  if (status === "empty") return "연동 데이터 없음"
  if (status === "error") return "데이터 연동 실패"
  return "연동 대기"
}

function getStatusColor(status: LoadStatus) {
  if (status === "success") return "#0B7A53"
  if (status === "error") return "#CD2E3A"
  if (status === "empty") return "#E65F00"
  return "#344BA0"
}

function getStatusBackground(status: LoadStatus) {
  if (status === "success") return "#E8F5EF"
  if (status === "error") return "#FDE8E9"
  if (status === "empty") return "#FFF2DF"
  return "#EEF6FF"
}

function hasDisplayData(data: CompanyOnboardingData | null) {
  if (!data) return false

  return Boolean(
    data.company_id ||
      data.company_name ||
      data.industry_code ||
      data.employee_count ||
      data.region ||
      data.energy_cost_annual ||
      data.company_type,
  )
}

function buildSummaryCards(data: CompanyOnboardingData | null): SummaryCard[] {
  const companyName = data?.company_name || "선택 기업"
  const companyType = data?.company_type || "기업유형 미입력"
  const region = data?.region || "지역 미입력"
  const industryCode = formatIndustryCode(data?.industry_code)
  const industryName = data?.industry_name || "업종명 미입력"
  const employeeCount = data?.employee_count ?? null
  const energyCostAnnual = data?.energy_cost_annual ?? null

  return [
    {
      title: "기업 기본정보",
      value: formatNumber(employeeCount),
      unit:
        employeeCount === null || employeeCount === undefined ? undefined : "명",
      description: companyName,
      detail: `${companyType} · ${region}`,
      tone: "blue",
      path: "/support-projects",
      buttonLabel: "지원사업 보기",
    },
    {
      title: "업종 / 지역",
      value: industryCode,
      description: industryName,
      detail: `지역: ${region} · 기업유형: ${companyType}`,
      tone: "green",
      path: "/support-projects",
      buttonLabel: "매칭 보기",
    },
    {
      title: "에너지 비용",
      value: formatNumber(energyCostAnnual),
      unit:
        energyCostAnnual === null || energyCostAnnual === undefined
          ? undefined
          : "만원",
      description: "연간 에너지 비용",
      detail: "ROI 분석과 에너지 효율 지원사업 추천에 활용할 기준값입니다.",
      tone: "orange",
      path: "/roi",
      buttonLabel: "ROI 보기",
    },
  ]
}

function normalizeOnboardingResponse(
  response: OnboardingApiResponse,
): CompanyOnboardingData | null {
  if (!response.success) return null
  if (!response.data) return null
  return response.data
}

export default function ParkManagerSummaryCards({
  companyId,
  customerId,
  apiBaseUrl = DEFAULT_API_BASE_URL,
}: ParkManagerSummaryCardsProps) {
  const navigate = useNavigate()

  const targetCompanyId = companyId || customerId || ""

  const [status, setStatus] = useState<LoadStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [onboardingData, setOnboardingData] =
    useState<CompanyOnboardingData | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const requestUrl = useMemo(() => {
    if (!targetCompanyId) return ""

    const baseUrl = apiBaseUrl.replace(/\/$/, "")
    return `${baseUrl}/api/onboarding/${encodeURIComponent(targetCompanyId)}`
  }, [apiBaseUrl, targetCompanyId])

  const summaryCards = useMemo(() => {
    return buildSummaryCards(onboardingData)
  }, [onboardingData])

  useEffect(() => {
    if (!targetCompanyId || !requestUrl) {
      setStatus("empty")
      setOnboardingData(null)
      return
    }

    const controller = new AbortController()

    async function loadOnboardingData() {
      setStatus("loading")
      setErrorMessage("")

      try {
        const response = await fetch(requestUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`기업 데이터 조회 실패: ${response.status}`)
        }

        const json = (await response.json()) as OnboardingApiResponse
        const normalized = normalizeOnboardingResponse(json)

        setOnboardingData(normalized)
        setStatus(hasDisplayData(normalized) ? "success" : "empty")
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setOnboardingData(null)
        setStatus("error")

        if (error instanceof Error) {
          setErrorMessage(error.message)
        } else {
          setErrorMessage("알 수 없는 오류가 발생했습니다.")
        }
      }
    }

    loadOnboardingData()

    return () => {
      controller.abort()
    }
  }, [requestUrl, targetCompanyId, reloadKey])

  if (!targetCompanyId) {
    return (
      <section
        style={{
          borderRadius: "32px",
          border: "1px solid #FDBA74",
          background: "#FFF7ED",
          padding: "34px",
          boxShadow: "0 18px 44px rgba(6,27,52,.06)",
        }}
      >
        <span className="badge orange">기업 데이터 없음</span>

        <h2
          style={{
            marginTop: "16px",
            color: "#061B34",
            fontSize: "30px",
            lineHeight: 1.3,
            fontWeight: 900,
            letterSpacing: "-0.7px",
          }}
        >
          선택된 기업 데이터가 없습니다.
        </h2>

        <p
          style={{
            marginTop: "12px",
            color: "#667085",
            fontSize: "15px",
            lineHeight: 1.8,
            fontWeight: 800,
          }}
        >
          기업 데이터가 연결되면 설비투자와 지원사업 검토에 필요한 핵심 정보를
          요약해 표시합니다.
        </p>
      </section>
    )
  }

  return (
    <section
      style={{
        borderRadius: "34px",
        border: "1px solid #E2E8F0",
        background: "#FFFFFF",
        padding: "34px",
        boxShadow: "0 24px 64px rgba(6,27,52,.10)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "24px",
          alignItems: "start",
          marginBottom: "28px",
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

          <div className="screen-tag">기업 맞춤 요약</div>

          <div
            className="label"
            style={{
              marginTop: "14px",
              marginBottom: "14px",
            }}
          >
            AI 분석 기준 데이터
          </div>

          <h2
            style={{
              color: "#061B34",
              fontSize: "38px",
              lineHeight: 1.18,
              fontWeight: 900,
              letterSpacing: "-1.2px",
              margin: 0,
            }}
          >
            {onboardingData?.company_name
              ? `${onboardingData.company_name} 맞춤 설비투자 요약`
              : "선택 기업 맞춤 설비투자 요약"}
          </h2>

          <p
            style={{
              marginTop: "14px",
              color: "#667085",
              fontSize: "15px",
              lineHeight: 1.8,
              fontWeight: 800,
              maxWidth: "760px",
            }}
          >
            기업의 업종, 지역, 인력 규모, 에너지 비용을 바탕으로 설비투자와
            지원사업 검토에 필요한 핵심 정보를 요약합니다.
          </p>
        </div>

        <div
          style={{
            justifySelf: "end",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "22px",
            padding: "16px 18px",
            minWidth: "280px",
          }}
        >
          <span
            style={{
              display: "block",
              color: "#667085",
              fontSize: "12px",
              fontWeight: 900,
              marginBottom: "8px",
            }}
          >
            연동 기준 데이터
          </span>

          <b
            style={{
              display: "block",
              color: "#061B34",
              fontFamily: "DM Mono, monospace",
              fontSize: "16px",
              lineHeight: 1.4,
              fontWeight: 500,
              wordBreak: "break-all",
            }}
          >
            {formatShortId(targetCompanyId)}
          </b>

          <span
            style={{
              display: "inline-flex",
              marginTop: "12px",
              minHeight: "30px",
              alignItems: "center",
              borderRadius: "999px",
              padding: "0 11px",
              background: getStatusBackground(status),
              color: getStatusColor(status),
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            {getStatusLabel(status)}
          </span>
        </div>
      </div>

      {status === "loading" && (
        <div
          style={{
            marginBottom: "22px",
            padding: "16px 18px",
            borderRadius: "18px",
            border: "1px solid #BFDBFE",
            background: "#EFF6FF",
            color: "#1E3A8A",
            fontSize: "14px",
            lineHeight: 1.7,
            fontWeight: 800,
          }}
        >
          기업 데이터를 불러오는 중입니다.
        </div>
      )}

      {status === "empty" && (
        <div
          style={{
            marginBottom: "22px",
            padding: "16px 18px",
            borderRadius: "18px",
            border: "1px solid #FDBA74",
            background: "#FFF7ED",
            color: "#9A3412",
            fontSize: "14px",
            lineHeight: 1.7,
            fontWeight: 800,
          }}
        >
          연결된 기업 데이터는 있지만 화면에 표시할 핵심 정보가 부족합니다.
          기업정보 입력 상태를 확인해주세요.
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            marginBottom: "22px",
            padding: "16px 18px",
            borderRadius: "18px",
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "14px",
            lineHeight: 1.7,
            fontWeight: 800,
          }}
        >
          기업 데이터 연동에 실패했습니다. {errorMessage}
          <button
            type="button"
            onClick={() => setReloadKey((prev) => prev + 1)}
            style={{
              marginLeft: "10px",
              height: "30px",
              padding: "0 12px",
              borderRadius: "999px",
              border: "1px solid #FCA5A5",
              background: "#FFFFFF",
              color: "#991B1B",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            다시 조회
          </button>
        </div>
      )}

      {status === "success" && onboardingData && (
        <div
          style={{
            marginBottom: "22px",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          {[
            ["기업명", onboardingData.company_name || "미입력"],
            ["지역", onboardingData.region || "미입력"],
            ["기업유형", onboardingData.company_type || "미입력"],
            ["업데이트", formatDate(onboardingData.updated_at)],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "18px",
                padding: "16px",
              }}
            >
              <span
                style={{
                  display: "block",
                  color: "#667085",
                  fontSize: "12px",
                  fontWeight: 900,
                  marginBottom: "8px",
                }}
              >
                {label}
              </span>

              <b
                style={{
                  display: "block",
                  color: "#061B34",
                  fontSize: "16px",
                  lineHeight: 1.4,
                  fontWeight: 900,
                }}
              >
                {value}
              </b>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "18px",
        }}
      >
        {summaryCards.map((card) => {
          const color = getToneColor(card.tone)
          const softColor = getToneSoftColor(card.tone)

          return (
            <article
              key={card.title}
              style={{
                borderRadius: "28px",
                border: "1px solid #E2E8F0",
                borderTop: `6px solid ${color}`,
                background: "#FFFFFF",
                padding: "28px",
                boxShadow: "0 12px 30px rgba(6,27,52,.06)",
                minHeight: "260px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    minHeight: "32px",
                    alignItems: "center",
                    borderRadius: "999px",
                    padding: "0 12px",
                    background: softColor,
                    color,
                    fontSize: "12px",
                    fontWeight: 900,
                  }}
                >
                  {card.title}
                </span>

                <div
                  style={{
                    marginTop: "22px",
                    display: "flex",
                    alignItems: "baseline",
                    gap: "6px",
                    minHeight: "62px",
                  }}
                >
                  <b
                    style={{
                      color,
                      fontFamily: "DM Mono, monospace",
                      fontSize: card.value.length > 8 ? "34px" : "54px",
                      lineHeight: 1,
                      fontWeight: 500,
                      letterSpacing: "-2px",
                    }}
                  >
                    {card.value}
                  </b>

                  {card.unit && (
                    <span
                      style={{
                        color,
                        fontSize: "22px",
                        fontWeight: 900,
                      }}
                    >
                      {card.unit}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    marginTop: "16px",
                    color: "#061B34",
                    fontSize: "17px",
                    lineHeight: 1.6,
                    fontWeight: 900,
                  }}
                >
                  {card.description}
                </p>

                <p
                  style={{
                    marginTop: "10px",
                    color: "#667085",
                    fontSize: "13px",
                    lineHeight: 1.7,
                    fontWeight: 800,
                  }}
                >
                  {card.detail}
                </p>
              </div>

              <button
                className="btn blue"
                type="button"
                onClick={() => navigate(card.path)}
                style={{
                  width: "100%",
                  marginTop: "24px",
                }}
              >
                {card.buttonLabel}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
