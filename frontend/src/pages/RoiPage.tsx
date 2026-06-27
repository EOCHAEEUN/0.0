import { useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { Landmark, Zap, Leaf, ShieldCheck, ChevronRight, ArrowLeft, Settings } from "lucide-react"
import { getAnalysisResult } from "../features/onboarding/onboardingState"

// ── data helpers (unchanged) ──────────────────────────────────────────────────
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function getNum(rec: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v
  }
  return null
}

function fmtPct(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}%` : "-"
}
function fmtYrs(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}년` : "-"
}
function fmtWon(v: number | null): string {
  return v !== null ? `${Math.round(v).toLocaleString("ko-KR")}만원` : "-"
}

function getScenario(r: Record<string, unknown>, k: "a" | "b") {
  return asRecord(r[`scenario_${k}`] ?? r[`scenario${k.toUpperCase()}`])
}

function normalizeRec(val: unknown): "a" | "b" {
  const s = String(val ?? "").trim().toUpperCase().replace(/[\s_-]/g, "")
  return s === "B" || s === "SCENARIOB" ? "b" : "a"
}

interface ScenarioMetrics {
  investment: number | null
  subsidy: number | null
  net: number | null
  saving: number | null
  roi: number | null
  payback: number | null
}

function buildMetrics(rec: Record<string, unknown>): ScenarioMetrics {
  return {
    investment: getNum(rec, "investment_manwon"),
    subsidy: getNum(rec, "subsidy_manwon"),
    net: getNum(rec, "net_investment_manwon", "net_cost_manwon"),
    saving: getNum(rec, "annual_saving_manwon", "saving_manwon"),
    roi: getNum(rec, "roi_pct", "roi_percent"),
    payback: getNum(rec, "payback_years", "paybackYears"),
  }
}

function extractPriorityPolicyId(policies: unknown): string | null {
  if (!Array.isArray(policies) || policies.length === 0) return null
  const first = policies[0] as Record<string, unknown>
  const id = first.policyId ?? first.policy_id ?? first.policyID ?? first.id
  return id ? String(id) : null
}

type JudgmentLevel = "높음" | "보통" | "낮음"

// ── design tokens ─────────────────────────────────────────────────────────────
const C = {
  navy: "#0f1f3d",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  blueBorder: "rgba(37,99,235,0.22)",
  green: "#16a34a",
  greenSoft: "#f0fdf4",
  greenBorder: "#bbf7d0",
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  text: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
  card: "#ffffff",
}

// ── Accordion (unchanged) ─────────────────────────────────────────────────────
function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "12px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 22px",
          background: "#f8fafc",
          border: "none",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 900,
          color: C.text,
          textAlign: "left",
        }}
      >
        {title}
        <span style={{ color: "#94a3b8", fontSize: "20px", fontWeight: 400, lineHeight: 1, flexShrink: 0 }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "22px", background: C.card, borderTop: `1px solid ${C.border}` }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function RoiPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const analysisId = searchParams.get("analysisId") || undefined
  const result = getAnalysisResult(analysisId)

  const [selectedScen, setSelectedScen] = useState<"a" | "b" | null>(null)

  if (!result) return <Navigate to="/analysis/new" replace />

  const roiResult = asRecord(result.roiResult)
  const rec = normalizeRec(roiResult.recommended)
  const scenarioA = getScenario(roiResult, "a")
  const scenarioB = getScenario(roiResult, "b")
  const hasB = Object.keys(scenarioB).length > 0
  const mA = buildMetrics(scenarioA)
  const mB = buildMetrics(scenarioB)
  const mRec = rec === "b" ? mB : mA

  const roi = mRec.roi ?? (result as Record<string, unknown>).roiPct as number ?? null
  const payback = mRec.payback ?? (result as Record<string, unknown>).paybackYears as number ?? null
  const draftId = analysisId || (result as Record<string, unknown>).id || "latest"

  const recLabel = rec === "b" ? "B안 · 부분 교체" : "A안 · 전체 교체"
  const recShort = rec === "b" ? "B안" : "A안"
  const aIsRec = rec === "a"
  const bIsRec = rec === "b"

  const priorityPolicyId = extractPriorityPolicyId((result as Record<string, unknown>).policies)

  const subsidyRatio =
    mRec.subsidy !== null && mRec.investment !== null && mRec.investment > 0
      ? mRec.subsidy / mRec.investment
      : null
  const savingRatio =
    mRec.saving !== null && mRec.investment !== null && mRec.investment > 0
      ? mRec.saving / mRec.investment
      : null

  const subsidyLevel: JudgmentLevel =
    subsidyRatio === null ? "보통" : subsidyRatio > 0.4 ? "높음" : subsidyRatio > 0.2 ? "보통" : "낮음"
  const savingLevel: JudgmentLevel =
    savingRatio === null ? "보통" : savingRatio > 0.3 ? "높음" : savingRatio > 0.15 ? "보통" : "낮음"

  const judgmentItems: { icon: React.ReactNode; label: string; level: JudgmentLevel; desc: string }[] = [
    { icon: <Landmark size={18} />, label: "지원금 반영 효과", level: subsidyLevel, desc: "지원금 증가로 초기 부담 완화" },
    { icon: <Zap size={18} />, label: "설비 개선 범위", level: rec === "a" ? "높음" : "보통", desc: "생산성 및 효율성 향상 기대" },
    { icon: <Leaf size={18} />, label: "에너지 절감 효과", level: savingLevel, desc: "연간 운영비 절감 기대" },
    { icon: <ShieldCheck size={18} />, label: "안전 리스크 개선", level: "보통", desc: "설비 안정성 일부 개선" },
  ]

  const activeScen = selectedScen ?? rec

  // ROI/payback diff for summary card
  const roiDiff =
    mA.roi !== null && mB.roi !== null ? Math.abs(mA.roi - mB.roi).toFixed(1) : null
  const paybackDiff =
    mA.payback !== null && mB.payback !== null
      ? Math.abs(mA.payback - mB.payback).toFixed(1)
      : null
  const higherRoiIsA = mA.roi !== null && mB.roi !== null && mA.roi >= mB.roi

  return (
    <main className="page">
      <section className="section white">
        <div
          style={{
            width: "min(1080px, calc(100% - 40px))",
            margin: "0 auto",
            paddingTop: "28px",
            paddingBottom: "80px",
          }}
        >
          {/* ── 1. 네이비 Hero ─────────────────────────────────────────────── */}
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
                onClick={() => navigate("/dashboard")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "transparent",
                  border: 0,
                  color: "rgba(255,255,255,0.5)",
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
                onClick={() => navigate(`/analysis/new?draftId=${draftId}`)}
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
                gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)",
                gap: "40px",
                padding: "28px 32px 36px",
                alignItems: "center",
              }}
            >
              {/* left */}
              <div>
                <p
                  style={{
                    color: "rgba(255,255,255,0.36)",
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
                    fontSize: "clamp(22px,2.6vw,30px)",
                    fontWeight: 900,
                    lineHeight: 1.2,
                    letterSpacing: "-0.03em",
                    marginBottom: "14px",
                  }}
                >
                  {(result as Record<string, unknown>).equipmentName as string || "검토 설비"} 투자 검토
                </h1>
                <p
                  style={{
                    color: "#93c5fd",
                    fontSize: "clamp(14px,1.5vw,17px)",
                    fontWeight: 900,
                    lineHeight: 1.45,
                    marginBottom: "10px",
                  }}
                >
                  지원사업 반영 시, <strong style={{ color: "#bfdbfe" }}>{recLabel}</strong>을 우선 검토하세요.
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "14px",
                    lineHeight: 1.7,
                    fontWeight: 800,
                    maxWidth: "400px",
                    marginBottom: "22px",
                  }}
                >
                  지원금 반영 효과와 설비 개선 범위를 함께 고려했을 때 현재 조건에서는 {recShort}이 더 적합합니다.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/analysis/${draftId}/policies`)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "44px",
                    padding: "0 20px",
                    borderRadius: "10px",
                    border: 0,
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
                {[
                  { label: "예상 ROI", value: fmtPct(roi), accent: "#93c5fd" },
                  { label: "예상 회수기간", value: fmtYrs(payback), accent: "#93c5fd" },
                  { label: "실부담금", value: fmtWon(mRec.net), sub: "지원금 차감 후" },
                  { label: "적용 가능 지원금", value: fmtWon(mRec.subsidy), accent: "#86efac" },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "14px",
                      padding: "18px 16px",
                    }}
                  >
                    <p
                      style={{
                        color: "rgba(255,255,255,0.45)",
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
                        fontSize: "clamp(18px,2vw,24px)",
                        fontWeight: 900,
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                        marginBottom: kpi.sub ? "6px" : 0,
                      }}
                    >
                      {kpi.value}
                    </p>
                    {kpi.sub && (
                      <p style={{ color: "rgba(255,255,255,0.36)", fontSize: "11px", fontWeight: 800 }}>
                        {kpi.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 2. 기대 효과 4개 카드 ─────────────────────────────────────── */}
          <div
            style={{
              background: C.card,
              borderRadius: "20px",
              border: `1px solid ${C.border}`,
              padding: "28px",
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
              {recShort} 변경으로 기대되는 효과
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "14px",
              }}
            >
              {judgmentItems.map((item) => {
                const isHigh = item.level === "높음"
                const iconBg = isHigh ? C.blueSoft : C.amberSoft
                const iconColor = isHigh ? C.blue : C.amber
                const badgeBg = isHigh ? C.blueSoft : C.amberSoft
                const badgeColor = isHigh ? C.blue : "#b45309"
                return (
                  <div
                    key={item.label}
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
                        gap: "6px",
                        flexWrap: "wrap",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{ color: C.text, fontSize: "13px", fontWeight: 900 }}
                      >
                        {item.label}
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
                    <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800, lineHeight: 1.55 }}>
                      {item.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 3. 시나리오 비교 (3열 카드) ──────────────────────────────── */}
          {hasB && (
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
                  gridTemplateColumns: "1fr 1fr 300px",
                  gap: "14px",
                  alignItems: "start",
                }}
              >
                {(["a", "b"] as const).map((sId) => {
                  const isRec = rec === sId
                  const isActive = activeScen === sId
                  const m = sId === "a" ? mA : mB
                  const label = sId === "a" ? "A안 · 전체 교체" : "B안 · 부분 교체"
                  const subLabel = isRec ? "우선 검토" : "초기 비용 대안"

                  return (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => setSelectedScen(sId)}
                      style={{
                        textAlign: "left",
                        background: isRec ? "#f8faff" : C.card,
                        borderRadius: "18px",
                        padding: "22px",
                        cursor: "pointer",
                        border: isActive
                          ? `2px solid ${C.blue}`
                          : `1px solid ${C.border}`,
                        boxShadow: isActive ? "0 8px 24px rgba(15,23,42,0.08)" : "none",
                        transition: "box-shadow 0.15s",
                        width: "100%",
                      }}
                    >
                      {/* header */}
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
                            {subLabel}
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
                          {label}
                        </h3>
                      </div>

                      {/* kpi rows */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          marginBottom: "16px",
                        }}
                      >
                        {[
                          { label: "총 투자금", value: fmtWon(m.investment) },
                          { label: "적용 가능 지원금", value: fmtWon(m.subsidy), color: C.green },
                          { label: "실부담금", value: fmtWon(m.net) },
                          { label: "연간 순편익", value: fmtWon(m.saving) },
                        ].map((row) => (
                          <div
                            key={row.label}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              paddingBottom: "10px",
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            <span style={{ color: C.muted, fontSize: "13px", fontWeight: 800 }}>
                              {row.label}
                            </span>
                            <span
                              style={{
                                color: row.color ?? C.text,
                                fontSize: "13px",
                                fontWeight: 900,
                              }}
                            >
                              {row.value}
                            </span>
                          </div>
                        ))}
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
                          <p style={{ color: C.muted, fontSize: "11px", fontWeight: 800, marginBottom: "4px" }}>
                            ROI
                          </p>
                          <p
                            style={{
                              color: isRec ? C.blue : C.muted,
                              fontSize: "clamp(20px,2.2vw,26px)",
                              fontWeight: 900,
                              letterSpacing: "-0.04em",
                            }}
                          >
                            {fmtPct(m.roi)}
                          </p>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ color: C.muted, fontSize: "11px", fontWeight: 800, marginBottom: "4px" }}>
                            회수기간
                          </p>
                          <p
                            style={{
                              color: isRec ? C.blue : C.muted,
                              fontSize: "clamp(20px,2.2vw,26px)",
                              fontWeight: 900,
                              letterSpacing: "-0.04em",
                            }}
                          >
                            {fmtYrs(m.payback)}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}

                {/* 핵심 요약 카드 */}
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
                    {higherRoiIsA
                      ? "A안은 지원금 증가를 통해 초기 부담을 낮추고 장기 수익성도 더 높습니다."
                      : "B안은 초기 투자 부담을 낮추고 단기 회수에 유리한 선택지입니다."}
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
                    {roiDiff && (
                      <div>
                        <p
                          style={{
                            color: C.blue,
                            fontSize: "clamp(18px,1.8vw,22px)",
                            fontWeight: 900,
                            letterSpacing: "-0.04em",
                            marginBottom: "2px",
                          }}
                        >
                          ROI {roiDiff}%p 차이
                        </p>
                        <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
                          A안 {fmtPct(mA.roi)} vs B안 {fmtPct(mB.roi)}
                        </p>
                      </div>
                    )}
                    {paybackDiff && (
                      <div>
                        <p
                          style={{
                            color: C.blue,
                            fontSize: "clamp(18px,1.8vw,22px)",
                            fontWeight: 900,
                            letterSpacing: "-0.04em",
                            marginBottom: "2px",
                          }}
                        >
                          {paybackDiff}년 단축
                        </p>
                        <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
                          A안 {fmtYrs(mA.payback)} vs B안 {fmtYrs(mB.payback)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. 지원사업 CTA (그린 톤) ────────────────────────────────── */}
          <div
            style={{
              background: C.greenSoft,
              border: `1.5px solid ${C.greenBorder}`,
              borderRadius: "20px",
              padding: "32px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) 300px",
                gap: "28px",
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
                    fontSize: "clamp(15px,1.5vw,18px)",
                    fontWeight: 900,
                    lineHeight: 1.45,
                    letterSpacing: "-0.02em",
                    marginBottom: "22px",
                    maxWidth: "400px",
                  }}
                >
                  {recShort}의 초기 부담을 낮출 수 있는 지원사업 조건을 확인하세요.
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/analysis/${draftId}/policies`)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      height: "44px",
                      padding: "0 20px",
                      borderRadius: "10px",
                      border: 0,
                      background: C.blue,
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    맞춤 지원사업
                    {(result as Record<string, unknown>).matchedPolicies as number > 0
                      ? ` ${(result as Record<string, unknown>).matchedPolicies}건`
                      : ""}{" "}
                    보기
                    <ChevronRight size={15} />
                  </button>
                  {priorityPolicyId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/analysis/${draftId}/policies/${priorityPolicyId}`)}
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
                  )}
                </div>
              </div>

              {/* right: 정책 카드 */}
              {(result as Record<string, unknown>).priorityPolicyName && (
                <div
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${C.border}`,
                    borderRadius: "14px",
                    padding: "18px 20px",
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
                    {(result as Record<string, unknown>).priorityPolicyName as string}
                  </p>
                  <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
                    내 기업·설비 조건 매칭{" "}
                    {(result as Record<string, unknown>).matchedPolicies as number > 0
                      ? `${(result as Record<string, unknown>).matchedPolicies}건`
                      : ""}{" "}
                    중 우선 검토{" "}
                    {(result as Record<string, unknown>).priorityPolicies as number > 0
                      ? `${(result as Record<string, unknown>).priorityPolicies}건`
                      : ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── 5. 상세 아코디언 ──────────────────────────────────────────── */}
          <div>
            <Accordion title="비용 산정 기준 보기">
              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { label: "총 투자금 (추천 시나리오)", value: fmtWon(mRec.investment) },
                  { label: "적용 가능 지원금", value: fmtWon(mRec.subsidy) },
                  { label: "실부담금 (지원금 차감)", value: fmtWon(mRec.net) },
                  { label: "연간 순편익 (절감 기준)", value: fmtWon(mRec.saving) },
                  { label: "예상 ROI", value: fmtPct(roi) },
                  { label: "예상 회수기간", value: fmtYrs(payback) },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: `1px solid #f1f5f9`,
                    }}
                  >
                    <span style={{ color: C.muted, fontSize: "13px", fontWeight: 800 }}>
                      {row.label}
                    </span>
                    <strong
                      style={{
                        color: row.value === "-" ? "#94a3b8" : C.text,
                        fontSize: "14px",
                        fontWeight: 900,
                      }}
                    >
                      {row.value}
                    </strong>
                  </div>
                ))}
              </div>
            </Accordion>

            <Accordion title="AI 판단 상세 근거 보기">
              {(result as Record<string, unknown>).recommendation && (
                <div style={{ marginBottom: (result as Record<string, unknown>).recommendationDetail ? "18px" : 0 }}>
                  <p
                    style={{
                      color: C.blue,
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "1px",
                      marginBottom: "8px",
                    }}
                  >
                    추천 요약
                  </p>
                  <p style={{ color: "#1e3a6f", fontSize: "14px", fontWeight: 800, lineHeight: 1.75 }}>
                    {(result as Record<string, unknown>).recommendation as string}
                  </p>
                </div>
              )}
              {(result as Record<string, unknown>).recommendationDetail && (
                <div>
                  <p
                    style={{
                      color: C.blue,
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "1px",
                      marginBottom: "8px",
                    }}
                  >
                    상세 근거
                  </p>
                  <p style={{ color: C.muted, fontSize: "14px", fontWeight: 800, lineHeight: 1.75 }}>
                    {(result as Record<string, unknown>).recommendationDetail as string}
                  </p>
                </div>
              )}
              {!(result as Record<string, unknown>).recommendation &&
                !(result as Record<string, unknown>).recommendationDetail && (
                  <p style={{ color: "#94a3b8", fontSize: "14px", fontWeight: 800 }}>
                    상세 근거 데이터가 없습니다.
                  </p>
                )}
            </Accordion>
          </div>
        </div>
      </section>
    </main>
  )
}
