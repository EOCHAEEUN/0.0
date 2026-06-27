import type { CSSProperties, ReactNode } from "react"
import { Landmark, Zap, Leaf, ShieldCheck, ChevronRight, Settings, ArrowLeft } from "lucide-react"
import type { RoiFormState, ScenarioCard } from "../roi.contract"
import { colors } from "../roi.constants"
import { formatMoneyFromManwon, formatPaybackYears } from "../roi.utils"

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
      value: `${recommendedScenario.roiPct}%`,
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
        background: C.navy,
        borderRadius: "20px",
        overflow: "hidden",
        marginBottom: "28px",
      }}
    >
      {/* top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px 0",
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

        <button
          type="button"
          onClick={onReset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            height: "34px",
            padding: "0 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "rgba(255,255,255,0.6)",
            fontSize: "12px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <Settings size={13} />
          분석 가정 수정
        </button>
      </div>

      {/* hero body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)",
          gap: "48px",
          padding: "32px 32px 36px",
          alignItems: "center",
        }}
      >
        {/* left */}
        <div>
          <p
            style={{
              color: "rgba(255,255,255,0.38)",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.16em",
              marginBottom: "14px",
            }}
          >
            ROI ANALYSIS
          </p>
          <h1
            style={{
              color: "#ffffff",
              fontSize: "clamp(22px, 2.6vw, 30px)",
              fontWeight: 900,
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              marginBottom: "14px",
            }}
          >
            {equipmentName} 투자 검토
          </h1>
          <p
            style={{
              color: "#93c5fd",
              fontSize: "clamp(15px, 1.6vw, 18px)",
              fontWeight: 900,
              lineHeight: 1.4,
              marginBottom: "10px",
            }}
          >
            지원사업 반영 시, {scenarioLabel}를 우선 검토하세요.
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "14px",
              lineHeight: 1.7,
              fontWeight: 800,
              maxWidth: "440px",
            }}
          >
            지원금 반영 효과와 설비 개선 범위를 함께 고려했을 때 현재 조건에서는{" "}
            {recommendedScenarioId === "A" ? "A안" : "B안"}이 더 적합합니다.
          </p>

          <button
            type="button"
            onClick={onNavigateSupport}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "22px",
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
            지원사업 상세보기
            <ChevronRight size={15} />
          </button>
        </div>

        {/* right: 2×2 KPI */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "14px",
                padding: "18px 20px",
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "12px",
                  fontWeight: 800,
                  marginBottom: "8px",
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
              {sn.roiPct}%
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
                ROI {roiDiff}배 ↑
              </p>
              <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
                A안 {scenA.roiPct}% vs B안 {scenB.roiPct}%
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
