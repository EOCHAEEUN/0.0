import { useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { fetchAnalysisEntryContext } from "../features/onboarding/onboardingAnalysisApi"
import { getAnalysisResult } from "../features/onboarding/onboardingState"
import { hydrateAccountData } from "../services/accountHydration"
import { Landmark, Zap, Leaf, ShieldCheck, ChevronRight, ArrowLeft, SlidersHorizontal } from "lucide-react"
import engiBot from "../assets/advisor/engi-bot-transparent.png"

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

// 0도 유효한 숫자로 처리 (지원금 0원 = "지원 없음"을 명시적으로 구분)
function getNumAllowZero(rec: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v
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

function normalizeRec(val: unknown): "a" | "b" | null {
  const s = String(val ?? "").trim().toUpperCase().replace(/[\s_-]/g, "")
  if (s === "A" || s === "SCENARIOA") return "a"
  if (s === "B" || s === "SCENARIOB") return "b"
  return null
}

interface ScenarioMetrics {
  investment: number | null
  subsidy: number | null
  subsidyRaw: number | null   // 0 포함 실제 지원금
  subsidyStatus: string | null
  net: number | null
  saving: number | null
  roi: number | null
  payback: number | null
}

function getPolicyApplication(rec: Record<string, unknown>): { status: string | null; amount: number | null } {
  const pa = rec.policy_application
  if (!pa || typeof pa !== "object" || Array.isArray(pa)) return { status: null, amount: null }
  const paRec = pa as Record<string, unknown>
  const status = typeof paRec.status === "string" ? paRec.status : null
  const amount = getNumAllowZero(paRec, "applied_support_manwon")
  return { status, amount }
}

function buildMetrics(rec: Record<string, unknown>): ScenarioMetrics {
  const pa = getPolicyApplication(rec)
  return {
    investment: getNum(rec, "investment_manwon"),
    subsidy: getNum(rec, "subsidy_manwon"),
    subsidyRaw: getNumAllowZero(rec, "subsidy_manwon"),
    subsidyStatus: pa.status,
    net: getNum(rec, "net_investment_manwon", "net_cost_manwon"),
    saving: getNum(rec, "annual_net_benefit_manwon", "annual_saving_manwon", "saving_manwon"),
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

function formatSubsidyDisplay(m: ScenarioMetrics): string {
  const s = m.subsidyStatus
  if (s === "applied" || s === "estimated") {
    if (m.subsidyRaw !== null && m.subsidyRaw > 0) {
      return `${Math.round(m.subsidyRaw).toLocaleString("ko-KR")}만원`
    }
    return "지원금 미반영"
  }
  if (s === "terms_missing") return "지원율 확인 필요"
  if (s === "no_policy") return "매칭 정책 없음"
  if (s === "invalid_investment") return "투자금 확인 필요"
  if (m.subsidyRaw !== null && m.subsidyRaw > 0) {
    return `${Math.round(m.subsidyRaw).toLocaleString("ko-KR")}만원`
  }
  return "지원금 미반영"
}

function getHeroText(
  recLabel: string,
  subsidyStatus: string | null,
  subsidyRaw: number | null,
  hasRecommendation: boolean,
): { main: string; sub: string | null } {
  if (!hasRecommendation) {
    return {
      main: "정책 조건 및 운영비 입력 후 최종 투자안을 산정할 수 있습니다.",
      sub: "A/B안의 투자금, 실투자금, 연간 순편익 조건을 확인하면 ROI와 회수기간을 계산할 수 있습니다.",
    }
  }
  if ((subsidyStatus === "applied" || subsidyStatus === "estimated") && subsidyRaw !== null && subsidyRaw > 0) {
    return { main: `지원사업 반영 시, ${recLabel}을 우선 검토하세요.`, sub: null }
  }
  if (subsidyStatus === "terms_missing") {
    return {
      main: `정책 조건 확인 후, ${recLabel}을 우선 검토하세요.`,
      sub: "매칭 정책의 지원율 확인 후 최종 ROI가 다시 계산됩니다.",
    }
  }
  return {
    main: `현재 입력 기준, ${recLabel}을 우선 검토하세요.`,
    sub: "현재 ROI는 지원금 미반영 기준입니다.",
  }
}

function getAiSummary(
  roiResult: Record<string, unknown>,
  rec: "a" | "b" | null,
): { summary: string; bullets: string[] } {
  if (rec === null) {
    return {
      summary: "정책 지원율 또는 투자 조건을 확인한 뒤 최종 추천안을 산정할 수 있습니다.",
      bullets: [],
    }
  }
  const ai = roiResult.ai_recommendation
  if (ai && typeof ai === "object" && !Array.isArray(ai)) {
    const aiRec = ai as Record<string, unknown>
    const summary = typeof aiRec.summary === "string" && aiRec.summary.trim() ? aiRec.summary.trim() : null
    const bullets = Array.isArray(aiRec.reason_bullets)
      ? (aiRec.reason_bullets as unknown[])
          .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
          .slice(0, 3)
      : []
    if (summary) return { summary, bullets }
  }
  return {
    summary:
      rec === "a"
        ? "A안은 설비 노후도와 연간 총 절감 효과를 고려한 우선 검토안입니다."
        : "B안은 초기 투자 부담과 회수기간을 고려한 우선 검토안입니다.",
    bullets: [],
  }
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
  const [reanalysisError, setReanalysisError] = useState("")
  const [isResolvingReanalysis, setIsResolvingReanalysis] = useState(false)

  if (!result) return <Navigate to="/analysis/new" replace />

  const resultRecord = result as Record<string, unknown>
  const roiResult = asRecord(result.roiResult)
  const rec = normalizeRec(roiResult.recommended ?? resultRecord.recommendedScenario)
  const topLevelRoi = (result as Record<string, unknown>).roiPct as number ?? null
  const topLevelPayback = (result as Record<string, unknown>).paybackYears as number ?? null
  const fallbackScenario =
    topLevelRoi !== null || topLevelPayback !== null
      ? {
        roi_pct: topLevelRoi,
        payback_years: topLevelPayback,
      }
      : {}
  const scenarioA = Object.keys(getScenario(roiResult, "a")).length > 0
    ? getScenario(roiResult, "a")
    : rec === "a"
      ? fallbackScenario
      : {}
  const scenarioB = Object.keys(getScenario(roiResult, "b")).length > 0
    ? getScenario(roiResult, "b")
    : rec === "b"
      ? fallbackScenario
      : {}
  const hasB = Object.keys(scenarioB).length > 0
  const mA = buildMetrics(scenarioA)
  const mB = buildMetrics(scenarioB)
  const hasRecommendation = rec !== null || topLevelRoi !== null || topLevelPayback !== null
  const mRec = rec === "b" ? mB : rec === "a" ? mA : null
  const mRecFallback = mRec ?? mA

  const roi = mRec?.roi ?? topLevelRoi
  const payback = mRec?.payback ?? topLevelPayback
  const draftId = analysisId || (result as Record<string, unknown>).id || "latest"
  const resultEquipment = asRecord(resultRecord.equipment)
  const resultAnalysisInput = asRecord(resultRecord.analysisInput ?? resultRecord.analysis_input)
  const resultEquipmentId = String(
    resultRecord.equipmentId ??
      resultRecord.equipment_id ??
      resultEquipment.equipment_id ??
      resultEquipment.equipmentId ??
      resultEquipment.id ??
      resultAnalysisInput.equipment_id ??
      resultAnalysisInput.equipmentId ??
      "",
  )
  const matchedPolicyCount = Number((result as Record<string, unknown>).matchedPolicies || 0)
  const recommendation = String((result as Record<string, unknown>).recommendation || "")
  const recommendationDetail = String(
    (result as Record<string, unknown>).recommendationDetail || "",
  )
  const priorityPolicyName = String(
    (result as Record<string, unknown>).priorityPolicyName || "",
  )

  const recLabel = rec === "b" ? "B안 · 부분 교체" : rec === "a" ? "A안 · 전체 교체" : "A/B안"
  const recShort = rec === "b" ? "B안" : rec === "a" ? "A안" : "투자안"

  const priorityPolicyId = extractPriorityPolicyId((result as Record<string, unknown>).policies)
  const supportProjectsPath = `/support-projects?analysisId=${encodeURIComponent(String(draftId))}`
  const priorityPolicyPath = priorityPolicyId
    ? `/support-projects?analysisId=${encodeURIComponent(String(draftId))}&policyId=${encodeURIComponent(priorityPolicyId)}`
    : supportProjectsPath

  const subsidyRatio =
    mRecFallback.subsidy !== null && mRecFallback.investment !== null && mRecFallback.investment > 0
      ? mRecFallback.subsidy / mRecFallback.investment
      : null
  const savingRatio =
    mRecFallback.saving !== null && mRecFallback.investment !== null && mRecFallback.investment > 0
      ? mRecFallback.saving / mRecFallback.investment
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
  const heroText = getHeroText(recLabel, mRecFallback.subsidyStatus, mRecFallback.subsidyRaw, hasRecommendation)
  const aiSummary = getAiSummary(roiResult, rec)

  const handleReanalysis = async () => {
    setReanalysisError("")
    setIsResolvingReanalysis(true)
    try {
      let resolvedEquipmentId = resultEquipmentId
      let resolvedAnalysisId = String(draftId)

      if (!resolvedEquipmentId || resolvedEquipmentId === resolvedAnalysisId) {
        await hydrateAccountData()
        const refreshedResult = getAnalysisResult()
        const context = await fetchAnalysisEntryContext()
        resolvedEquipmentId =
          String(refreshedResult?.equipmentId ?? "") ||
          resolvedEquipmentId ||
          context.latestEquipmentId
        if (
          resolvedEquipmentId === resolvedAnalysisId ||
          !resolvedAnalysisId
        ) {
          resolvedAnalysisId =
            String(refreshedResult?.id ?? "") || context.latestAnalysisId
        }
      }

      if (!resolvedEquipmentId || !resolvedAnalysisId || resolvedEquipmentId === resolvedAnalysisId) {
        console.error("재분석에 필요한 equipmentId 또는 analysisId를 구분할 수 없습니다.", {
          result,
          resolvedEquipmentId,
          resolvedAnalysisId,
        })
        setReanalysisError(
          "설비 정보를 찾을 수 없어 분석 조건을 불러오지 못했습니다. 설비 관리에서 다시 분석을 시작해 주세요.",
        )
        return
      }

      navigate(
        `/analysis/new?mode=reanalysis&equipmentId=${encodeURIComponent(resolvedEquipmentId)}&parentAnalysisId=${encodeURIComponent(resolvedAnalysisId)}`,
      )
    } catch (error) {
      console.error("재분석 정보 확인에 실패했습니다.", error)
      setReanalysisError(
        "설비 정보를 확인하지 못했습니다. 잠시 후 다시 시도하거나 설비 관리에서 분석을 시작해 주세요.",
      )
    } finally {
      setIsResolvingReanalysis(false)
    }
  }

  return (
    <main className="page">
      <style>{`
        @media (max-width: 980px) {
          .roi-result-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding: 36px 28px !important;
          }
          .roi-result-hero-bot {
            position: static !important;
            width: 128px !important;
            margin: 18px 28px 0 auto !important;
            display: block !important;
          }
          .roi-result-hero-grid > div:last-child {
            padding-top: 0 !important;
          }
        }
        @media (max-width: 620px) {
          .roi-result-hero-grid > div:last-child {
            grid-template-columns: 1fr !important;
          }
          .roi-result-hero-grid button {
            width: 100%;
          }
        }
      `}</style>
      <section className="section white">
        <div
          style={{
            width: "min(1350px, calc(100% - 44px))",
            margin: "0 auto",
            paddingTop: "28px",
            paddingBottom: "80px",
          }}
        >
          {/* ── 1. 네이비 Hero ─────────────────────────────────────────────── */}
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
              className="roi-result-hero-bot"
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
            </div>

            {reanalysisError && (
              <p
                role="alert"
                style={{ color: "#fecaca", fontSize: "13px", fontWeight: 800, padding: "0 32px 18px" }}
              >
                {reanalysisError}
              </p>
            )}

            {/* hero body */}
            <div
              className="roi-result-hero-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(360px,475px)",
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
                    fontSize: "clamp(34px,4.1vw,46px)",
                    fontWeight: 950,
                    lineHeight: 1.16,
                    letterSpacing: "-0.05em",
                    marginBottom: "20px",
                  }}
                >
                  {(result as Record<string, unknown>).equipmentName as string || "검토 설비"} 투자 검토
                </h1>
                <p
                  style={{
                    color: "#93c5fd",
                    fontSize: "clamp(18px,2vw,24px)",
                    fontWeight: 950,
                    lineHeight: 1.45,
                    marginBottom: heroText.sub ? "14px" : "28px",
                  }}
                >
                  {heroText.main}
                </p>
                {heroText.sub && (
                  <p
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "clamp(16px,1.55vw,19px)",
                      lineHeight: 1.7,
                      fontWeight: 850,
                      maxWidth: "600px",
                      marginBottom: "26px",
                    }}
                  >
                    {heroText.sub}
                  </p>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginTop: heroText.sub ? 0 : "4px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(supportProjectsPath)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      minHeight: "48px",
                      padding: "0 22px",
                      borderRadius: "10px",
                      border: 0,
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
                    onClick={() => void handleReanalysis()}
                    disabled={isResolvingReanalysis}
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
                      cursor: isResolvingReanalysis ? "wait" : "pointer",
                      opacity: isResolvingReanalysis ? 0.82 : 1,
                    }}
                  >
                    <SlidersHorizontal size={16} />
                    {isResolvingReanalysis ? "설비 정보 확인 중..." : "투자 조건 다시 설정"}
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
                {[
                  { label: "예상 ROI", value: hasRecommendation ? fmtPct(roi) : "산정 보류", accent: "#93c5fd" },
                  { label: "예상 회수기간", value: hasRecommendation ? fmtYrs(payback) : "산정 보류", accent: "#93c5fd" },
                  { label: "실부담금", value: hasRecommendation ? fmtWon(mRec?.net ?? null) : "조건 확인 필요", sub: "지원금 차감 후" },
                  { label: "적용 가능 지원금", value: formatSubsidyDisplay(mRecFallback), accent: "#86efac" },
                ].map((kpi) => (
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
                        color: "rgba(255,255,255,0.45)",
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
                        fontSize: "clamp(28px,3vw,34px)",
                        fontWeight: 950,
                        letterSpacing: "-0.05em",
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
                  const subLabel = hasRecommendation
                    ? (isRec ? "우선 검토" : "초기 비용 대안")
                    : (sId === "a" ? "전체 교체안" : "부분 교체안")

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
                          { label: "적용 가능 지원금", value: formatSubsidyDisplay(m), color: C.green },
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
                      {!hasRecommendation && (
                        <p style={{ color: C.muted, fontSize: "11px", fontWeight: 800, textAlign: "center", marginTop: "10px" }}>
                          운영비 또는 정책 지원조건 확인 후 계산됩니다.
                        </p>
                      )}
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
                    {hasRecommendation ? "핵심 요약" : "계산 조건 확인 필요"}
                  </p>
                  <p
                    style={{
                      color: C.text,
                      fontSize: "14px",
                      fontWeight: 800,
                      lineHeight: 1.6,
                      marginBottom: aiSummary.bullets.length > 0 ? "10px" : "18px",
                    }}
                  >
                    {aiSummary.summary}
                  </p>
                  {aiSummary.bullets.length > 0 && (
                    <ul
                      style={{
                        paddingLeft: "16px",
                        margin: "0 0 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {aiSummary.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          style={{ color: C.muted, fontSize: "12px", fontWeight: 800, lineHeight: 1.55 }}
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div
                    style={{
                      paddingTop: "16px",
                      borderTop: `1px solid ${C.blueBorder}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    {!hasRecommendation && (
                      <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800, lineHeight: 1.6 }}>
                        A/B안의 투자금·실투자금·연간 순편익이 모두 확인되면 ROI 비교가 가능합니다.
                      </p>
                    )}
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
                    onClick={() => navigate(supportProjectsPath)}
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
                    {Number((result as Record<string, unknown>).matchedPolicies) > 0
                      ? ` ${(result as Record<string, unknown>).matchedPolicies}건`
                      : ""}{" "}
                    보기
                    <ChevronRight size={15} />
                  </button>
                  {priorityPolicyId && (
                    <button
                      type="button"
                      onClick={() => navigate(priorityPolicyPath)}
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
              {priorityPolicyName && (
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
                    {priorityPolicyName}
                  </p>
                  <p style={{ color: C.muted, fontSize: "12px", fontWeight: 800 }}>
                    내 기업·설비 조건 매칭{" "}
                    {matchedPolicyCount > 0
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
                  { label: "총 투자금 (추천 시나리오)", value: fmtWon(mRecFallback.investment) },
                  { label: "적용 가능 지원금", value: formatSubsidyDisplay(mRecFallback) },
                  { label: "실부담금 (지원금 차감)", value: fmtWon(mRecFallback.net) },
                  { label: "연간 순편익 (절감 기준)", value: fmtWon(mRecFallback.saving) },
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
              {recommendation && (
                <div style={{ marginBottom: recommendationDetail ? "18px" : 0 }}>
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
                    {recommendation}
                  </p>
                </div>
              )}
              {recommendationDetail && (
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
                    {recommendationDetail}
                  </p>
                </div>
              )}
              {!recommendation && !recommendationDetail && (
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
