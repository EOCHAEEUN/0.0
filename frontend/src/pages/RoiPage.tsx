import { useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { fetchAnalysisEntryContext } from "../features/onboarding/onboardingAnalysisApi"
import { getAnalysisResult } from "../features/onboarding/onboardingState"
import { hydrateAccountData } from "../services/accountHydration"
import { useDashboardData } from "../features/dashboard/hooks/useDashboardData"
import DashboardWorkspaceSidebar from "../components/layout/DashboardWorkspaceSidebar"
import {
  RoiAnalysisResultView,
  ROI_STRATEGY_ICONS,
  type RoiScenarioView,
} from "../features/roi/components/RoiAnalysisResultView"
import "../features/dashboard/dashboard.workspace.css"
import "../features/roi/roi.workspace.css"

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
  if (s === "terms_missing") return "지원을 확인 필요"
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
      sub: "매칭 정책의 지원을 확인 후 최종 ROI가 다시 계산됩니다.",
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

type JudgmentLevel = "높음" | "보통" | "낮음" | "최적"

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim())
  return Number.isFinite(parsed) ? parsed : fallback
}

function getBreakdown(rec: Record<string, unknown>) {
  return asRecord(rec.breakdown)
}

function buildEvidenceMetrics(params: {
  result: Record<string, unknown>
  recommendedScenario: Record<string, unknown>
  savingRatio: number | null
  roi: number | null
  roiResult: Record<string, unknown>
}) {
  const analysisInput = asRecord(params.result.analysisInput ?? params.result.analysis_input)
  const ageYears = toNumber(analysisInput.ageYears, 12)
  const agingPct = Math.min(96, Math.max(45, Math.round((ageYears / 16) * 100)))
  const breakdown = getBreakdown(params.recommendedScenario)
  const annualEnergyCost = toNumber(analysisInput.energyCostAnnual, 0)
  const energySavingManwon = getNum(breakdown, "energy_saving_manwon")
  const energySavingRate =
    energySavingManwon !== null && annualEnergyCost > 0
      ? Math.round((energySavingManwon / annualEnergyCost) * 1000) / 10
      : params.savingRatio !== null
        ? Math.round(params.savingRatio * 1000) / 10
        : null
  const benchmark = asRecord(params.roiResult.benchmark)
  const industryAvgRoi =
    getNum(benchmark, "avg_roi_pct", "avg_roi_percent", "industry_avg_roi_pct") ?? 62.5

  return {
    agingPct,
    energySavingRate,
    industryAvgRoi,
    recommendedRoi: params.roi,
  }
}

// ── main component ────────────────────────────────────────────────────────────
export default function RoiPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const analysisId = searchParams.get("analysisId") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId: analysisId })
  const workspace = dashboard.workspace
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
  const recommendation = String((result as Record<string, unknown>).recommendation || "")
  const recommendationDetail = String(
    (result as Record<string, unknown>).recommendationDetail || "",
  )
  const canonicalPolicies = Array.isArray((result as Record<string, unknown>).policies)
    ? ((result as Record<string, unknown>).policies as unknown[])
    : []
  const recLabel = rec === "b" ? "B안 · 부분 교체" : rec === "a" ? "A안 · 전체 교체" : "A/B안"

  const priorityPolicyId = extractPriorityPolicyId(canonicalPolicies)
  const supportProjectsPath = `/support-projects/priority?analysis_id=${encodeURIComponent(String(draftId))}`

  const subsidyRatio =
    mRecFallback.subsidy !== null && mRecFallback.investment !== null && mRecFallback.investment > 0
      ? mRecFallback.subsidy / mRecFallback.investment
      : null
  const savingRatio =
    mRecFallback.saving !== null && mRecFallback.investment !== null && mRecFallback.investment > 0
      ? mRecFallback.saving / mRecFallback.investment
      : null

  const subsidyLevel: JudgmentLevel =
    subsidyRatio === null
      ? "보통"
      : subsidyRatio > 0.2
        ? "최적"
        : subsidyRatio > 0.1
          ? "보통"
          : "낮음"
  const savingLevel: JudgmentLevel =
    savingRatio === null ? "보통" : savingRatio > 0.3 ? "높음" : savingRatio > 0.15 ? "보통" : "낮음"

  const subsidyReliefText =
    subsidyRatio !== null && subsidyRatio > 0
      ? `초기 비용 부담 ${Math.round(subsidyRatio * 100)}% 완화`
      : "지원금 반영 시 초기 부담 완화"
  const savingAmountText =
    mRecFallback.saving !== null && mRecFallback.saving > 0
      ? `연간 ${Math.round(mRecFallback.saving).toLocaleString("ko-KR")}만원 절감`
      : "연간 운영비 절감 기대"

  const judgmentItems = [
    {
      icon: ROI_STRATEGY_ICONS.subsidy,
      label: "지원금 반영 효과",
      level: subsidyLevel,
      desc: subsidyReliefText,
      tone: "blue" as const,
    },
    {
      icon: ROI_STRATEGY_ICONS.equipment,
      label: "설비 개선 범위",
      level: (rec === "a" ? "높음" : "보통") as JudgmentLevel,
      desc: "생산 수율 및 설비 효율 향상 기대",
      tone: "blue" as const,
    },
    {
      icon: ROI_STRATEGY_ICONS.energy,
      label: "에너지 절감 효과",
      level: savingLevel,
      desc: savingAmountText,
      tone: "blue" as const,
    },
    {
      icon: ROI_STRATEGY_ICONS.safety,
      label: "안전 리스크 개선",
      level: "보통" as JudgmentLevel,
      desc: "규제 대응 및 안정성 확보",
      tone: "purple" as const,
    },
  ]

  const activeScen = selectedScen ?? rec

  const buildScenarioView = (sId: "a" | "b"): RoiScenarioView => {
    const isRec = rec === sId
    const isActive = activeScen === sId
    const m = sId === "a" ? mA : mB
    return {
      id: sId,
      title: sId === "a" ? "A안 · 전체 교체" : "B안 · 부분 교체",
      subLabel: hasRecommendation
        ? isRec
          ? "우선 검토"
          : "초기 비용 대안"
        : sId === "a"
          ? "전체 교체안"
          : "부분 교체안",
      investment: fmtWon(m.investment),
      subsidy: formatSubsidyDisplay(m),
      net: fmtWon(m.net),
      saving: fmtWon(m.saving),
      roi: fmtPct(m.roi),
      payback: fmtYrs(m.payback),
      isRecommended: isRec,
      isActive,
    }
  }

  // ROI/payback diff for summary card
  const roiDiff =
    mA.roi !== null && mB.roi !== null ? Math.abs(mA.roi - mB.roi).toFixed(1) : null
  const paybackDiff =
    mA.payback !== null && mB.payback !== null
      ? Math.abs(mA.payback - mB.payback).toFixed(1)
      : null
  const heroText = getHeroText(recLabel, mRecFallback.subsidyStatus, mRecFallback.subsidyRaw, hasRecommendation)
  const aiSummary = getAiSummary(roiResult, rec)
  const recommendedScenarioRecord = rec === "b" ? scenarioB : scenarioA
  const evidenceMetrics = buildEvidenceMetrics({
    result: resultRecord,
    recommendedScenario: recommendedScenarioRecord,
    savingRatio,
    roi,
    roiResult,
  })
  const evidenceHeadline =
    recommendation.trim() || "현재 조건에서 투자 검토를 적극 권장합니다."
  const defaultEvidenceBullets: string[] = []
  if (mA.saving !== null && mB.saving !== null && mA.saving > mB.saving) {
    defaultEvidenceBullets.push(
      "A안은 B안보다 연간 총 절감액이 커서 전체 개선 효과가 큽니다.",
    )
  } else if (rec === "a") {
    defaultEvidenceBullets.push(
      `${recLabel}은(는) 초기 부담과 장기 절감 효과의 균형을 고려한 우선 검토안입니다.`,
    )
  }
  if (evidenceMetrics.agingPct >= 75) {
    defaultEvidenceBullets.push(
      "설비 사용연수가 업종 평균 교체주기를 초과해 전체 교체 필요성이 높습니다.",
    )
  } else if (recommendationDetail.trim()) {
    defaultEvidenceBullets.push(recommendationDetail.trim())
  }
  const evidenceBullets =
    aiSummary.bullets.length > 0
      ? aiSummary.bullets
      : defaultEvidenceBullets.length > 0
        ? defaultEvidenceBullets
        : [recommendationDetail || "정책 지원 반영 시 초기 부담 완화 효과를 기대할 수 있습니다."]

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

  const roiDiffLabel = roiDiff ? `ROI ${roiDiff}%p 차이` : null
  const roiDiffDetail =
    roiDiff !== null ? `A안 ${fmtPct(mA.roi)} vs B안 ${fmtPct(mB.roi)}` : null
  const paybackDiffLabel = paybackDiff ? `${paybackDiff}년 단축` : null
  const paybackDiffDetail =
    paybackDiff !== null
      ? `A안 ${fmtYrs(mA.payback)} vs B안 ${fmtYrs(mB.payback)}`
      : null

  return (
    <main className="page ff-dashboard-workspace-page">
      <div className="ff-dashboard-layout">
        <DashboardWorkspaceSidebar
          paths={{
            newRoiPath: workspace.newRoiPath,
            policyPath: workspace.policyPath || supportProjectsPath,
            draftPath: workspace.draftPath,
            advisorPath: workspace.advisorPath,
            analysisId: draftId,
            priorityPolicyId: priorityPolicyId,
          }}
        />

        <div className="ff-dashboard-main-content ff-roi-workspace-content">
          <RoiAnalysisResultView
            equipmentName={`${(result as Record<string, unknown>).equipmentName as string || "검토 설비"}`}
            heroMain={heroText.main}
            heroSub={heroText.sub}
            kpis={[
              {
                label: "예상 ROI",
                value: hasRecommendation ? fmtPct(roi) : "산정 보류",
                accent: "#93c5fd",
              },
              {
                label: "예상 회수기간",
                value: hasRecommendation ? fmtYrs(payback) : "산정 보류",
                accent: "#93c5fd",
              },
              {
                label: "실부담금",
                value: hasRecommendation ? fmtWon(mRec?.net ?? null) : "조건 확인 필요",
                sub: "지원금 차감 후",
              },
              {
                label: "적용 가능 지원금",
                value: formatSubsidyDisplay(mRecFallback),
                accent: "#86efac",
              },
            ]}
            strategyCards={judgmentItems}
            scenarios={[buildScenarioView("a"), buildScenarioView("b")]}
            hasScenarios={hasB}
            aiStrategyTitle={hasRecommendation ? "AI 추천 전략" : "계산 조건 확인 필요"}
            aiStrategySummary={
              aiSummary.summary ||
              `${recLabel}은(는) 규제 대응과 장기적 수익성을 동시에 확보할 수 있는 우선 검토 시나리오입니다.`
            }
            roiDiffLabel={roiDiffLabel}
            roiDiffDetail={roiDiffDetail}
            paybackDiffLabel={paybackDiffLabel}
            paybackDiffDetail={paybackDiffDetail}
            evidenceTitle={evidenceHeadline}
            evidenceBullets={evidenceBullets}
            evidenceMetrics={evidenceMetrics}
            reanalysisError={reanalysisError}
            isResolvingReanalysis={isResolvingReanalysis}
            onSupportProjects={() => navigate(supportProjectsPath)}
            onReanalysis={() => void handleReanalysis()}
            onSelectScenario={setSelectedScen}
          />
        </div>
      </div>
    </main>
  )
}
