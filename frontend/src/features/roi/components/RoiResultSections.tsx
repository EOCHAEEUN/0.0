import type { CSSProperties, ReactNode } from "react"
import { Landmark, Zap, Leaf, ShieldCheck, ChevronRight, SlidersHorizontal, ArrowLeft } from "lucide-react"
import type {
  PolicySupportItem,
  PolicySupportSummary,
  RoiFormState,
  ScenarioCard,
} from "../roi.contract"
import { colors } from "../roi.constants"
import {
  formatMoneyFromManwon,
  formatPaybackYears,
} from "../roi.utils"
import engiBot from "../../../assets/advisor/engi-bot-transparent.png"

// ── design tokens ─────────────────────────────────────────────────────────────
const C = {
  navy: "#0f1f3d",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  blueBorder: "rgba(37,99,235,0.25)",
  green: "#16a34a",
  greenSoft: "#f0fdf4",
  greenBorder: "#bbf7d0",
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  text: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
  card: "#ffffff",
  bg: "#f0f4f8",
}

const safePayback = (v: number | null) => (v == null ? "-" : formatPaybackYears(v))

// ── RoiHero ──────────────────────────────────────────────────────────────────
export function RoiHero({
  form,
  recommendedScenario,
  recommendedScenarioId,
  onReset,
  onNavigateSupport,
}: {
  form: RoiFormState
  recommendedScenario: ScenarioCard
  recommendedScenarioId: "A" | "B"
  onReset: () => void
  onNavigateSupport: () => void
}) {
  const equipmentName = form.equipmentName || "설비"
  const scenarioLabel = recommendedScenarioId === "A" ? "A안 · 전체 교체" : "B안 · 부분 교체"
  const subsidyRate =
    recommendedScenario.investmentManwon > 0
      ? Math.round((recommendedScenario.subsidyManwon / recommendedScenario.investmentManwon) * 100)
      : 0

  const kpis: { label: string; value: string; sub?: string; accent?: string }[] = [
    {
      label: "예상 ROI",
      value: recommendedScenario.roiPct > 0 ? `${recommendedScenario.roiPct}%` : "-",
      accent: "#93c5fd",
    },
    {
      label: "예상 회수기간",
      value: safePayback(recommendedScenario.paybackYears),
      accent: "#93c5fd",
    },
    {
      label: "실투자금",
      value: recommendedScenario.netInvestmentManwon > 0
        ? formatMoneyFromManwon(recommendedScenario.netInvestmentManwon)
        : "-",
      sub: "지원금 차감 후 실부담",
    },
    {
      label: "적용 가능 지원금",
      value: formatMoneyFromManwon(recommendedScenario.subsidyManwon),
      sub: subsidyRate > 0 ? `지원율 ${subsidyRate}%` : undefined,
      accent: "#86efac",
    },
  ]

  return (
    <div
      style={{
        position: "relative",
        background:
          "radial-gradient(circle at 86% 20%, rgba(255,255,255,0.16), transparent 23%), linear-gradient(124deg, #0f1d35 0%, #142038 58%, #273348 100%)",
        borderRadius: "24px",
        overflow: "hidden",
        marginBottom: "36px",
        minHeight: "486px",
        boxShadow: "0 26px 60px rgba(15,29,53,0.16)",
      }}
    >
      <img
        src={engiBot}
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "72px",
          right: "56px",
          width: "min(172px, 18vw)",
          height: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.28))",
          zIndex: 1,
        }}
      />
      {/* top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "25px 40px 0",
          position: "relative",
          zIndex: 2,
        }}
      >
        <button
          type="button"
          onClick={onReset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "transparent",
            border: "0",
            color: "rgba(255,255,255,0.55)",
            fontSize: "13px",
            fontWeight: 800,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ArrowLeft size={14} />
          내 투자 분석
        </button>

      </div>

      {/* hero body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 475px)",
          gap: "56px",
          padding: "46px 40px 42px",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* left */}
        <div>
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "32px",
              padding: "0 17px",
              borderRadius: "999px",
              border: "1px solid rgba(255,235,174,0.38)",
              color: "#fff2b6",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "0.08em",
              marginBottom: "18px",
            }}
          >
            FACTOFIT AI ENGI
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.46)",
              fontSize: "15px",
              fontWeight: 900,
              marginBottom: "18px",
            }}
          >
            ROI 분석 결과
          </p>
          <h1
            style={{
              color: "#ffffff",
              fontSize: "clamp(34px, 4.1vw, 46px)",
              fontWeight: 950,
              lineHeight: 1.16,
              letterSpacing: "-0.05em",
              marginBottom: "20px",
            }}
          >
            {equipmentName} 투자 검토
          </h1>
          <p
            style={{
              color: "#93c5fd",
              fontSize: "clamp(18px, 2vw, 24px)",
              fontWeight: 950,
              lineHeight: 1.45,
              marginBottom: "14px",
            }}
          >
            지원사업 반영 시, {scenarioLabel}를 우선 검토하세요.
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "clamp(16px, 1.55vw, 19px)",
              lineHeight: 1.7,
              fontWeight: 850,
              maxWidth: "600px",
            }}
          >
            지원금 반영 효과와 설비 개선 범위를 함께 고려했을 때 현재 조건에서는{" "}
            {recommendedScenarioId === "A" ? "A안" : "B안"}이 더 적합합니다.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "22px",
            }}
          >
            <button
              type="button"
              onClick={onNavigateSupport}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                minHeight: "48px",
                padding: "0 22px",
                borderRadius: "10px",
                border: "0",
                background: C.blue,
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              지원사업 상세보기
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={onReset}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#E7902A"
                event.currentTarget.style.borderColor = "#E7902A"
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "#F4A340"
                event.currentTarget.style.borderColor = "#F4A340"
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                minHeight: "48px",
                padding: "0 22px",
                borderRadius: "10px",
                border: "1px solid #F4A340",
                background: "#F4A340",
                color: "#16213E",
                fontSize: "16px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              <SlidersHorizontal size={16} />
              투자 조건 다시 설정
            </button>
          </div>
        </div>

        {/* right: 2×2 KPI */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
            alignSelf: "end",
            paddingTop: "120px",
          }}
        >
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "10px",
                padding: "22px 20px",
                minHeight: "96px",
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "14px",
                  fontWeight: 900,
                  marginBottom: "12px",
                }}
              >
                {kpi.label}
              </p>
              <p
                style={{
                  color: kpi.accent ?? "#ffffff",
                  fontSize: "clamp(20px, 2vw, 26px)",
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  marginBottom: kpi.sub ? "6px" : 0,
                }}
              >
                {kpi.value}
              </p>
              {kpi.sub && (
                <p
                  style={{
                    color: "rgba(255,255,255,0.38)",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  {kpi.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* mobile stacked KPI override via @media — handled by CSS fallback below */}
      <style>{`
        @media (max-width: 768px) {
          .roi-hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .roi-kpi-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── ExpectedBenefits ─────────────────────────────────────────────────────────
type BenefitLevel = "높음" | "보통"

type BenefitItem = {
  icon: ReactNode
  title: string
  level: BenefitLevel
  desc: string
}

const BENEFIT_ITEMS: BenefitItem[] = [
  {
    icon: <Landmark size={18} />,
    title: "지원금 반영 효과",
    level: "높음",
    desc: "지원금 증가로 초기 부담 완화",
  },
  {
    icon: <Zap size={18} />,
    title: "설비 개선 범위",
    level: "높음",
    desc: "생산성 및 효율성 향상 기대",
  },
  {
    icon: <Leaf size={18} />,
    title: "에너지 절감 효과",
    level: "보통",
    desc: "연간 운영비 절감 기대",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "안전 리스크 개선",
    level: "보통",
    desc: "설비 안정성 일부 개선",
  },
]

export function ExpectedBenefits({ scenarioId }: { scenarioId: "A" | "B" }) {
  const labelText = scenarioId === "A" ? "A안" : "B안"

  return (
    <div
      style={{
        background: C.card,
        borderRadius: "20px",
        border: `1px solid ${C.border}`,
        padding: "28px 28px 24px",
        marginBottom: "24px",
      }}
    >
      <h2
        style={{
          color: C.text,
          fontSize: "17px",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          marginBottom: "20px",
        }}
      >
        {labelText} 변경으로 기대되는 효과
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "14px",
        }}
      >
        {BENEFIT_ITEMS.map((item) => {
          const isHigh = item.level === "높음"
          const badgeBg = isHigh ? C.blueSoft : C.amberSoft
          const badgeColor = isHigh ? C.blue : "#b45309"
          const iconBg = isHigh ? C.blueSoft : C.amberSoft
          const iconColor = isHigh ? C.blue : C.amber

          return (
            <div
              key={item.title}
              style={{
                background: "#fafbfc",
                border: `1px solid ${C.border}`,
                borderRadius: "14px",
                padding: "18px 16px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: iconBg,
                  color: iconColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px",
                }}
              >
                {item.icon}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    color: C.text,
                    fontSize: "13px",
                    fontWeight: 900,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.title}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 900,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: badgeBg,
                    color: badgeColor,
                  }}
                >
                  {item.level}
                </span>
              </div>
              <p
                style={{
                  color: C.muted,
                  fontSize: "12px",
                  fontWeight: 800,
                  lineHeight: 1.55,
                }}
              >
                {item.desc}
              </p>
            </div>
          )
        })}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .benefit-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .benefit-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── RoiScenarioCards ─────────────────────────────────────────────────────────
function ScenarioKpiRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: "10px",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ color: C.muted, fontSize: "13px", fontWeight: 800 }}>{label}</span>
      <span
        style={{
          color: valueColor ?? C.text,
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function RoiScenarioCards({
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
  const scenA = scenarios.find((s) => s.id === "A") ?? scenarios[0]
  const scenB = scenarios.find((s) => s.id === "B") ?? scenarios[1] ?? scenarios[0]
  const roiDiff = (scenA.roiPct - scenB.roiPct).toFixed(1)
  const paybackDiff =
    scenA.paybackYears != null && scenB.paybackYears != null
      ? (scenB.paybackYears - scenA.paybackYears).toFixed(1)
      : null

  const renderScenCard = (sn: ScenarioCard) => {
    const isRec = sn.id === recommendedScenarioId
    const isSelected = sn.id === selectedScenarioId
    const accent = isRec ? C.blue : colors.blue2
    const borderStyle: CSSProperties = isRec
      ? { border: `2px solid ${C.blue}` }
      : isSelected
      ? { border: `1.5px solid ${colors.blue2}` }
      : { border: `1px solid ${C.border}` }
    const scenLabel = sn.id === "A" ? "A안 · 전체 교체" : "B안 · 부분 교체"
    const scenSub = sn.id === "A" ? "우선 검토" : "초기 비용 대안"

    return (
      <button
        key={sn.id}
        type="button"
        onClick={() => onSelect(sn.id)}
        style={{
          textAlign: "left",
          background: isRec ? "#f8faff" : C.card,
          borderRadius: "18px",
          padding: "22px",
          cursor: "pointer",
          transition: "box-shadow 0.15s ease",
          boxShadow: isSelected ? "0 8px 24px rgba(15,23,42,0.08)" : "none",
          ...borderStyle,
        }}
      >
        {/* card header */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            {isRec && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 900,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: C.blue,
                  color: "#ffffff",
                }}
              >
                추천
              </span>
            )}
            <span
              style={{
                fontSize: "13px",
                fontWeight: 900,
                color: isRec ? C.blue : C.muted,
              }}
            >
              {scenSub}
            </span>
          </div>
          <h3
            style={{
              color: C.text,
              fontSize: "17px",
              fontWeight: 900,
              letterSpacing: "-0.02em",
            }}
          >
            {scenLabel}
          </h3>
        </div>

        {/* kpi rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          <ScenarioKpiRow label="총 투자금" value={formatMoneyFromManwon(sn.investmentManwon)} />
          <ScenarioKpiRow label="적용 가능 지원금" value={formatMoneyFromManwon(sn.subsidyManwon)} valueColor={C.green} />
          <ScenarioKpiRow
            label="실투자금"
            value={sn.netInvestmentManwon > 0 ? formatMoneyFromManwon(sn.netInvestmentManwon) : "-"}
          />
          <ScenarioKpiRow
            label="연간 순이익"
            value={sn.annualNetBenefitManwon > 0 ? formatMoneyFromManwon(sn.annualNetBenefitManwon) + "/년" : "-"}
          />
        </div>

        {/* big ROI + payback */}
        <div
          style={{
            paddingTop: "14px",
            borderTop: `1px solid ${C.border}`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.muted, fontSize: "11px", fontWeight: 800, marginBottom: "4px" }}>ROI</p>
            <p
              style={{
                color: accent,
                fontSize: "clamp(22px, 2.4vw, 28px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
              }}
            >
              {sn.roiPct > 0 ? `${sn.roiPct}%` : "-"}
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.muted, fontSize: "11px", fontWeight: 800, marginBottom: "4px" }}>회수기간</p>
            <p
              style={{
                color: accent,
                fontSize: "clamp(22px, 2.4vw, 28px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
              }}
            >
              {safePayback(sn.paybackYears)}
            </p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h2
          style={{
            color: C.text,
            fontSize: "17px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          시나리오 비교
        </h2>
        <p style={{ color: C.muted, fontSize: "13px", fontWeight: 800 }}>
          초기 부담과 장기 효과를 함께 비교하세요.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 320px",
          gap: "14px",
          alignItems: "start",
        }}
      >
        {renderScenCard(scenA)}
        {renderScenCard(scenB)}

        {/* Summary card */}
        <div
          style={{
            background: C.blueSoft,
            border: `1.5px solid ${C.blueBorder}`,
            borderRadius: "18px",
            padding: "22px",
          }}
        >
          <p
            style={{
              color: C.blue,
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.1em",
              marginBottom: "10px",
            }}
          >
            핵심 요약
          </p>
          <p
            style={{
              color: C.text,
              fontSize: "14px",
              fontWeight: 800,
              lineHeight: 1.6,
              marginBottom: "18px",
            }}
          >
            A안은 지원금 증가를 통해 초기 부담을 크게 낮추고 장기 수익성도 더 높습니다.
          </p>

          <div
            style={{
              paddingTop: "16px",
              borderTop: `1px solid ${C.blueBorder}`,
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div>
              <p
                style={{
                  color: C.blue,
                  fontSize: "clamp(18px, 2vw, 22px)",
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                  marginBottom: "2px",
                }}
              >
                {scenA.roiPct > 0 || scenB.roiPct > 0
                  ? `ROI +${roiDiff}%p`
                  : "ROI 계산 결과 없음"}
              </p>
              <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
                A안 {scenA.roiPct > 0 ? `${scenA.roiPct}%` : "-"} vs B안{" "}
                {scenB.roiPct > 0 ? `${scenB.roiPct}%` : "-"}
              </p>
            </div>
            {paybackDiff && (
              <div>
                <p
                  style={{
                    color: C.blue,
                    fontSize: "clamp(18px, 2vw, 22px)",
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    marginBottom: "2px",
                  }}
                >
                  {paybackDiff}년 단축
                </p>
                <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
                  A안 {safePayback(scenA.paybackYears)} vs B안 {safePayback(scenB.paybackYears)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .scenario-grid { grid-template-columns: 1fr 1fr !important; }
          .scenario-grid > :last-child { grid-column: 1 / -1 !important; }
        }
        @media (max-width: 600px) {
          .scenario-grid { grid-template-columns: 1fr !important; }
          .scenario-grid > :last-child { grid-column: auto !important; }
        }
      `}</style>
    </div>
  )
}

function supportTerms(item: PolicySupportItem) {
  const amount = item.cap_amount_manwon ?? item.fixed_amount_manwon
  const values: string[] = []

  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    values.push(`지원 한도 ${formatMoneyFromManwon(amount)}`)
  }
  if (
    typeof item.support_ratio === "number" &&
    Number.isFinite(item.support_ratio) &&
    item.support_ratio > 0
  ) {
    values.push(`지원율 ${Math.round(item.support_ratio * 100)}%`)
  }

  return values.join(" · ") || "지원 조건 확인 중"
}

type PolicySupportGroupKey = "business" | "financing" | "execution"

const POLICY_SUPPORT_VISIBLE_CARD_LIMIT = 3
const POLICY_SUPPORT_COLUMN_MAX_HEIGHT = "640px"

type RecommendedPolicyCard = {
  id: string
  policyId: string
  title: string
  supportItemName: string
  amountText: string
  description: string
  group: PolicySupportGroupKey
  matchedSupport?: PolicySupportItem
  isGuidance?: boolean
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readTextFrom(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function readNumberFrom(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.-]/g, ""))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readArrayFrom(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function normalizeSupportText(value: unknown): string {
  if (Array.isArray(value)) return value.map(normalizeSupportText).join(" ")
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(normalizeSupportText)
      .join(" ")
  }
  return String(value ?? "").trim()
}

function getPolicyIdFrom(policy: Record<string, unknown>) {
  const metadata = readRecord(policy.metadata)
  return (
    readTextFrom(policy, "policy_id", "policyId", "matched_policy_id", "id") ||
    readTextFrom(metadata, "policy_id", "policyId", "matched_policy_id", "id")
  )
}

function getPolicyTitleFrom(policy: Record<string, unknown>) {
  const metadata = readRecord(policy.metadata)
  return (
    readTextFrom(policy, "title", "policy_title", "name") ||
    readTextFrom(metadata, "title", "policy_title", "name")
  )
}

function getPolicyDescriptionFrom(policy: Record<string, unknown>) {
  const metadata = readRecord(policy.metadata)
  return (
    readTextFrom(
      policy,
      "reason",
      "summary",
      "support_summary",
      "description",
      "support_content",
      "content",
    ) ||
    readTextFrom(
      metadata,
      "reason",
      "summary",
      "support_summary",
      "description",
      "support_content",
      "content",
    ) ||
    "현재 분석 조건과의 적합성을 기준으로 추천된 정책입니다."
  )
}

function getPolicyAmountText(policy: Record<string, unknown>) {
  const metadata = readRecord(policy.metadata)
  const amount =
    readNumberFrom(
      policy,
      "max_amount_manwon",
      "max_amount",
      "support_amount",
      "support_limit",
      "subsidy_amount",
    ) ??
    readNumberFrom(
      metadata,
      "max_amount_manwon",
      "max_amount",
      "support_amount",
      "support_limit",
      "subsidy_amount",
    )

  if (amount !== null && amount > 0) return `지원 한도 ${formatMoneyFromManwon(amount)}`

  const amountText =
    readTextFrom(policy, "support_amount_text", "amount", "support_amount") ||
    readTextFrom(metadata, "support_amount_text", "amount", "support_amount")
  return amountText || "지원 한도 공고 확인 필요"
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getPolicyGroup(policy: Record<string, unknown>): PolicySupportGroupKey {
  const metadata = readRecord(policy.metadata)
  const label = [
    readTextFrom(policy, "support_type_label", "support_type_detail"),
    readTextFrom(metadata, "support_type_label", "support_type_detail"),
  ]
    .join(" ")
    .replace(/\s+/g, "")

  if (label.includes("금융지원") || label.includes("융자") || label.includes("보증") || label.includes("이자")) {
    return "financing"
  }
  if (label.includes("비금융연계지원") || label.includes("컨설팅") || label.includes("교육") || label.includes("지도")) {
    return "execution"
  }
  return "business"
}

function getSupportItemAmountText(
  supportItem: Record<string, unknown>,
  policy: Record<string, unknown>,
  group: PolicySupportGroupKey,
) {
  const amountText = readTextFrom(
    supportItem,
    "amount",
    "support_amount",
    "support_limit",
    "limit",
  )
  if (amountText) return amountText

  const amount =
    readNumberFrom(
      supportItem,
      "amount_manwon",
      "max_amount_manwon",
      "support_amount_manwon",
    ) ?? readNumberFrom(supportItem, "amount_numeric", "support_amount")

  if (amount !== null && amount > 0) return `지원 한도 ${formatMoneyFromManwon(amount)}`

  if (group === "execution") return "실행 조건 확인 필요"
  if (group === "financing") return "자금조달 조건 확인 필요"

  return getPolicyAmountText(policy)
}

function getSupportItemDescription(
  supportItem: Record<string, unknown>,
  policy: Record<string, unknown>,
) {
  return (
    readTextFrom(
      supportItem,
      "description",
      "summary",
      "content",
      "support_content",
      "detail",
    ) || getPolicyDescriptionFrom(policy)
  )
}

function getSupportItemGroup(
  policy: Record<string, unknown>,
  supportItem: Record<string, unknown>,
): PolicySupportGroupKey {
  const metadata = readRecord(policy.metadata)
  const fundingType = readTextFrom(supportItem, "funding_type")
  const itemCategory = readTextFrom(supportItem, "category")
  const label = normalizeSupportText([
    fundingType,
    readTextFrom(supportItem, "amount_role"),
    itemCategory,
    readArrayFrom(policy, "support_method"),
    readArrayFrom(metadata, "support_method"),
    readTextFrom(policy, "roi_support_type", "support_primary_category"),
    readTextFrom(policy, "policy_category", "policy_subcategory"),
    readArrayFrom(policy, "support_categories"),
    readTextFrom(policy, "policy_primary_nature"),
    readTextFrom(metadata, "roi_support_type", "support_primary_category"),
    readTextFrom(metadata, "policy_category", "policy_subcategory"),
    readArrayFrom(metadata, "support_categories"),
    readTextFrom(metadata, "policy_primary_nature"),
  ]).replace(/\s+/g, "")

  if (
    label.includes("융자") ||
    label.includes("이자지원") ||
    label.includes("이차보전") ||
    label.includes("보증") ||
    label.includes("loan") ||
    label.includes("interest_support") ||
    label.includes("guarantee")
  ) {
    return "financing"
  }

  if (fundingType === "현금보조") return "business"

  if (
    fundingType === "현물서비스" ||
    itemCategory.includes("인력·교육") ||
    itemCategory.includes("기술·사업화") ||
    label.includes("컨설팅") ||
    label.includes("멘토링") ||
    label.includes("교육") ||
    label.includes("시험") ||
    label.includes("인증") ||
    label.includes("장비활용") ||
    label.includes("공동장비") ||
    label.includes("기술지원")
  ) {
    return "execution"
  }

  if (!normalizeSupportText(supportItem)) return getPolicyGroup(policy)

  return "business"
}

function getPolicySupportItems(policy: Record<string, unknown>) {
  const metadata = readRecord(policy.metadata)
  const supportItems = readArrayFrom(policy, "support_items")
  if (supportItems.length > 0) return supportItems
  return readArrayFrom(metadata, "support_items")
}

function getSupportItemKey(supportItem: Record<string, unknown>, index: number) {
  return (
    readTextFrom(supportItem, "name", "title", "component_key", "category") ||
    normalizeSupportText(supportItem).slice(0, 120) ||
    `support-item-${index}`
  )
}

function buildSupportItemIndex(summary: PolicySupportSummary | null) {
  const entries = [
    ...(summary?.business_roi_support?.items ?? []),
    ...(summary?.financing_support?.items ?? []),
    ...(summary?.execution_support?.items ?? []),
  ]
  const byPolicyId = new Map<string, PolicySupportItem[]>()
  entries.forEach((item) => {
    if (item.policy_id) {
      byPolicyId.set(item.policy_id, [...(byPolicyId.get(item.policy_id) ?? []), item])
    }
  })
  return byPolicyId
}

function getPolicySupportSummaryItems(summary: PolicySupportSummary | null) {
  return [
    ...(summary?.business_roi_support?.items ?? []),
    ...(summary?.financing_support?.items ?? []),
    ...(summary?.execution_support?.items ?? []),
  ]
}

function getComponentGroup(item: PolicySupportItem): PolicySupportGroupKey {
  const supportType = String(item.support_type || "")
  const effectLayer = String(item.effect_layer || "")

  if (effectLayer === "capex_offset") return "business"
  if (
    effectLayer === "financing_effect" ||
    supportType === "loan" ||
    supportType === "interest_support" ||
    supportType === "guarantee"
  ) {
    return "financing"
  }
  return "execution"
}

function getComponentIdentity(item: PolicySupportItem) {
  return [
    item.id,
    item.policy_id,
    item.component_key,
    item.component_name,
    item.support_type,
  ]
    .filter(Boolean)
    .join(":")
}

function getComponentSupportItemName(item: PolicySupportItem) {
  if (item.component_name) return item.component_name
  if (item.support_type === "loan") return "정책자금 융자 검토"
  if (item.support_type === "interest_support") return "이자지원 검토"
  if (item.support_type === "guarantee") return "보증지원 검토"
  if (item.support_type === "consulting") return "컨설팅 지원"
  if (item.support_type === "education") return "교육 지원"
  if (item.support_type === "mentoring") return "멘토링 지원"
  return "공고 기준 지원 항목"
}

function buildComponentPolicyCards(
  summary: PolicySupportSummary | null,
  policyTitles: Map<string, string>,
  matchedComponentIds: Set<string>,
) {
  return getPolicySupportSummaryItems(summary).reduce<RecommendedPolicyCard[]>((cards, item, index) => {
    const identity = getComponentIdentity(item)
    if (identity && matchedComponentIds.has(identity)) return cards

    const policyId = item.policy_id || `component-policy-${index}`
    const title =
      (item.policy_id ? policyTitles.get(item.policy_id) : "") ||
      item.component_name ||
      "정책 지원 항목"

    cards.push({
      id: `component:${identity || index}`,
      policyId,
      title,
      supportItemName: getComponentSupportItemName(item),
      amountText: supportTerms(item),
      description:
        item.evidence_text ||
        "공고 기준 지원 항목입니다. 세부 요건 확인 후 신청서와 실행계획에 반영할 수 있습니다.",
      group: getComponentGroup(item),
      matchedSupport: item,
    })
    return cards
  }, [])
}

function findMatchedSupportItem(
  items: PolicySupportItem[] | undefined,
  supportItem: Record<string, unknown>,
) {
  if (!items || items.length === 0) return undefined
  if (items.length === 1 && Object.keys(supportItem).length === 0) return items[0]

  const supportName = normalizeSupportText(
    readTextFrom(supportItem, "name", "title", "component_key", "category"),
  ).replace(/\s+/g, "")
  const supportAmount = normalizeSupportText(
    readTextFrom(supportItem, "amount", "support_amount", "support_limit"),
  ).replace(/\s+/g, "")
  const supportText = normalizeSupportText([
    readTextFrom(supportItem, "name", "title", "category", "funding_type"),
    readTextFrom(supportItem, "amount", "amount_role"),
  ]).replace(/\s+/g, "")

  if (!supportText) return undefined

  return items.find((item) => {
    const componentName = normalizeSupportText(item.component_name).replace(/\s+/g, "")
    const evidenceText = normalizeSupportText(item.evidence_text).replace(/\s+/g, "")
    if (supportName && componentName && (componentName.includes(supportName) || supportName.includes(componentName))) {
      return true
    }
    if (supportAmount && evidenceText && evidenceText.includes(supportAmount)) {
      return true
    }

    const componentText = normalizeSupportText([
      item.component_key,
      item.component_name,
      item.support_type,
      item.evidence_text,
    ]).replace(/\s+/g, "")
    if (!componentText) return false
    return componentText.includes(supportText) || supportText.includes(componentText)
  })
}

function buildRecommendedPolicyCards(
  policies: unknown[] | null | undefined,
  summary: PolicySupportSummary | null,
): RecommendedPolicyCard[] {
  if (!Array.isArray(policies)) return []
  const supportByPolicyId = buildSupportItemIndex(summary)
  const deduped = new Map<string, RecommendedPolicyCard>()
  const policyTitles = new Map<string, string>()
  const matchedComponentIds = new Set<string>()

  policies.forEach((policy) => {
    const record = readRecord(policy)
    const policyId = getPolicyIdFrom(record)
    const title = getPolicyTitleFrom(record)
    if (!policyId || !title) return
    policyTitles.set(policyId, title)

    const supportComponents = supportByPolicyId.get(policyId)
    const supportItems = getPolicySupportItems(record)
    const normalizedItems = supportItems.length > 0 ? supportItems : [null]

    normalizedItems.forEach((supportItem, itemIndex) => {
      const supportRecord = readRecord(supportItem)
      const matchedSupport = findMatchedSupportItem(supportComponents, supportRecord)
      if (matchedSupport) matchedComponentIds.add(getComponentIdentity(matchedSupport))
      const supportItemName =
        readTextFrom(supportRecord, "name", "title", "category") || "공고 기준 지원 항목"
      const supportItemKey = getSupportItemKey(supportRecord, itemIndex)
      const group = getSupportItemGroup(record, supportRecord)
      const card: RecommendedPolicyCard = {
        id: `${policyId}:${supportItemKey}`,
        policyId,
        title,
        supportItemName,
        amountText: matchedSupport
          ? supportTerms(matchedSupport)
          : getSupportItemAmountText(supportRecord, record, group),
        description:
          matchedSupport?.evidence_text || getSupportItemDescription(supportRecord, record),
        group,
        matchedSupport,
      }

      if (!deduped.has(card.id)) deduped.set(card.id, card)
    })
  })

  buildComponentPolicyCards(summary, policyTitles, matchedComponentIds).forEach((card) => {
    if (!deduped.has(card.id)) deduped.set(card.id, card)
  })

  return Array.from(deduped.values())
}

function RecommendedPolicySupportCard({ card }: { card: RecommendedPolicyCard }) {
  const isMatchedPending = card.matchedSupport?.review_status === "pending"
  const isRoiNotApplied = card.matchedSupport?.roi_effect_applied === false

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "12px",
        padding: "14px",
        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "9px" }}>
        <h4
          style={{
            color: C.text,
            fontSize: "14px",
            fontWeight: 900,
            lineHeight: 1.35,
            flex: 1,
          }}
        >
          {card.title}
        </h4>
        <span
          style={{
            flexShrink: 0,
            borderRadius: "999px",
            background: card.matchedSupport ? C.amberSoft : "#e0f2fe",
            color: card.matchedSupport ? "#a16207" : "#0369a1",
            padding: "3px 8px",
            fontSize: "11px",
            fontWeight: 900,
          }}
        >
          {card.matchedSupport ? "검토 중" : "공고 기준"}
        </span>
      </div>
      <p style={{ color: C.text, fontSize: "12px", fontWeight: 900, marginBottom: "6px" }}>
        {card.supportItemName}
      </p>
      <p style={{ color: C.blue, fontSize: "12px", fontWeight: 900, marginBottom: "8px" }}>
        {card.amountText}
      </p>
      <p
        style={{
          color: C.muted,
          fontSize: "12px",
          fontWeight: 700,
          lineHeight: 1.55,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        - {card.description}
      </p>
      {isMatchedPending && isRoiNotApplied && (
        <p style={{ color: C.muted, fontSize: "11px", fontWeight: 900, marginTop: "9px" }}>
          현재 ROI 계산에는 반영되지 않음
        </p>
      )}
      {!card.matchedSupport && (
        <p style={{ color: C.muted, fontSize: "11px", fontWeight: 900, marginTop: "9px" }}>
          세부 요건 확인 필요
        </p>
      )}
    </div>
  )
}

function EmptyPolicySupportGuidanceCard({
  groupKey,
  text,
}: {
  groupKey: PolicySupportGroupKey
  text: string
}) {
  const title =
    groupKey === "financing"
      ? "자금조달 연계 검토"
      : groupKey === "execution"
        ? "실행지원 연계 검토"
        : "지원 항목 검토"
  const description =
    groupKey === "financing"
      ? "현재 분석에 확정된 융자·보증·이자지원 정책은 없지만, 사업 신청 전 정책자금·보증·이자보전 가능성을 별도 확인하는 항목입니다."
      : "현재 분석에 확정된 실행지원 항목은 없지만, 컨설팅·교육·시험인증·장비활용 가능성을 별도 확인하는 항목입니다."

  return (
    <div
      style={{
        background: C.card,
        border: `1px dashed ${C.border}`,
        borderRadius: "12px",
        padding: "14px",
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "9px" }}>
        <h4
          style={{
            color: C.text,
            fontSize: "14px",
            fontWeight: 900,
            lineHeight: 1.35,
            flex: 1,
          }}
        >
          {title}
        </h4>
        <span
          style={{
            flexShrink: 0,
            borderRadius: "999px",
            background: "#e0f2fe",
            color: "#0369a1",
            padding: "3px 8px",
            fontSize: "11px",
            fontWeight: 900,
          }}
        >
          확인 필요
        </span>
      </div>
      <p style={{ color: C.text, fontSize: "12px", fontWeight: 900, marginBottom: "6px" }}>
        {text}
      </p>
      <p style={{ color: C.muted, fontSize: "12px", fontWeight: 700, lineHeight: 1.55 }}>
        - {description}
      </p>
      <p style={{ color: C.muted, fontSize: "11px", fontWeight: 900, marginTop: "9px" }}>
        현재 ROI·실부담금 계산에는 반영되지 않음
      </p>
    </div>
  )
}

export function PolicySupportComposition({
  summary,
  policies,
}: {
  summary: PolicySupportSummary | null
  policies?: unknown[] | null
}) {
  const cards = buildRecommendedPolicyCards(policies, summary)
  if (cards.length === 0) return null

  const businessItems = cards.filter((item) => item.group === "business")
  const financingItems = cards.filter((item) => item.group === "financing")
  const executionItems = cards.filter((item) => item.group === "execution")

  const groups = [
    {
      key: "business",
      title: "지원금·사업성 ROI 관련",
      items: businessItems,
      emptyText: "현재 확인된 지원금·사업화 ROI 관련 항목이 없습니다.",
      showPendingState: true,
    },
    {
      key: "financing",
      title: "융자·보증·이자지원",
      items: financingItems,
      emptyText: "현재 확인된 자금조달 지원 항목이 없습니다.",
      showPendingState: true,
    },
    {
      key: "execution",
      title: "실행지원",
      items: executionItems,
      emptyText: "현재 확인된 실행지원 항목이 없습니다.",
      showPendingState: true,
    },
  ]

  return (
    <section
      aria-labelledby="policy-support-composition-title"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "20px",
        padding: "24px",
        marginBottom: "24px",
      }}
    >
      <h2
        id="policy-support-composition-title"
        style={{
          color: C.text,
          fontSize: "17px",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          marginBottom: "6px",
        }}
      >
        정책 지원 구성
      </h2>
      <p
        style={{
          color: C.muted,
          fontSize: "13px",
          fontWeight: 700,
          lineHeight: 1.6,
          marginBottom: "18px",
        }}
      >
        정책별 지원 내용을 지원금·자금조달·실행지원으로 구분해 확인할 수 있습니다.
        현재 검토 중인 항목은 ROI 계산에 반영되지 않습니다.
      </p>
      <p
        style={{
          color: C.muted,
          fontSize: "12px",
          fontWeight: 800,
          lineHeight: 1.6,
          marginBottom: "18px",
        }}
      >
        검토 중인 항목은 위 ROI·실부담금 계산에 반영되지 않습니다.
      </p>

      <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
            gap: "14px",
            alignItems: "stretch",
          }}
      >
        {groups.map((group) => {
          const shouldScroll = group.items.length > POLICY_SUPPORT_VISIBLE_CARD_LIMIT

          return (
            <div
              key={group.key}
              style={{
                borderRadius: "14px",
                background: "#f8fafc",
                padding: "14px",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h3
                style={{
                  color: C.text,
                  fontSize: "13px",
                  fontWeight: 900,
                  marginBottom: "10px",
                }}
              >
                {group.title}
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "9px",
                  maxHeight: shouldScroll ? POLICY_SUPPORT_COLUMN_MAX_HEIGHT : undefined,
                  overflowY: shouldScroll ? "auto" : undefined,
                  paddingRight: shouldScroll ? "4px" : undefined,
                }}
              >
                {group.items.length > 0 ? (
                  group.items.map((item, index) => (
                    <RecommendedPolicySupportCard
                      key={item.id || `${group.key}-${index}`}
                      card={item}
                    />
                  ))
                ) : (
                  <EmptyPolicySupportGuidanceCard
                    groupKey={group.key as PolicySupportGroupKey}
                    text={group.emptyText}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/*
            현재 분석된 정책에는 구조화된 지원 항목이 아직 등록되지 않았습니다.
      */}
    </section>
  )
}

// ── PolicyCta ─────────────────────────────────────────────────────────────────
const MOCK_POLICY = {
  name: "[코오롱베니트] 2026년도 상생형 인공지능 전환(AX) 선도모델 구축지원 사업 공고",
  matchRate: 92,
  matchCount: 10,
}

export function PolicyCta({ onNavigateSupport }: { onNavigateSupport: () => void }) {
  return (
    <div
      style={{
        background: C.greenSoft,
        border: `1.5px solid ${C.greenBorder}`,
        borderRadius: "20px",
        padding: "32px",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "32px",
          alignItems: "start",
        }}
      >
        {/* left */}
        <div>
          <p
            style={{
              color: C.green,
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.12em",
              marginBottom: "10px",
            }}
          >
            다음 단계
          </p>
          <p
            style={{
              color: C.text,
              fontSize: "clamp(15px, 1.6vw, 18px)",
              fontWeight: 900,
              lineHeight: 1.45,
              letterSpacing: "-0.02em",
              marginBottom: "22px",
              maxWidth: "440px",
            }}
          >
            A안의 초기 부담을 낮출 수 있는 지원사업 조건을 확인하세요.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onNavigateSupport}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                height: "44px",
                padding: "0 20px",
                borderRadius: "10px",
                border: "0",
                background: C.blue,
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              맞춤 지원사업 10건 보기
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={onNavigateSupport}
              style={{
                height: "44px",
                padding: "0 20px",
                borderRadius: "10px",
                border: `1px solid ${C.border}`,
                background: "#ffffff",
                color: C.text,
                fontSize: "14px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              우선 정책 조건 확인하기
            </button>
          </div>
        </div>

        {/* right: policy card */}
        <button
          type="button"
          onClick={onNavigateSupport}
          style={{
            textAlign: "left",
            background: "#ffffff",
            border: `1px solid ${C.border}`,
            borderRadius: "14px",
            padding: "18px 20px",
            cursor: "pointer",
            transition: "box-shadow 0.15s ease",
            width: "100%",
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(15,23,42,0.1)"
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = "none"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 900,
                padding: "3px 10px",
                borderRadius: "999px",
                background: C.green,
                color: "#ffffff",
              }}
            >
              추천
            </span>
            <span style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
              우선 검토 정책
            </span>
          </div>

          <p
            style={{
              color: C.text,
              fontSize: "13px",
              fontWeight: 900,
              lineHeight: 1.5,
              marginBottom: "10px",
            }}
          >
            {MOCK_POLICY.name}
          </p>

          <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800, marginBottom: "12px" }}>
            내 기업 · 설비 조건 매칭 {MOCK_POLICY.matchCount}건 중 우선 검토 1건
          </p>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
              }}
            >
              <span style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>매칭 정확도</span>
              <span style={{ color: C.green, fontSize: "12px", fontWeight: 900 }}>
                {MOCK_POLICY.matchRate}%
              </span>
            </div>
            <div
              style={{
                height: "6px",
                borderRadius: "999px",
                background: "#e2e8f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${MOCK_POLICY.matchRate}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: C.green,
                }}
              />
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
