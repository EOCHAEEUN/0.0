import {
  formatManwon,
  formatPaybackYearsCompact,
} from "../applicationDraft/applicationDraft.utils"
import { ROI_ROADMAP_PHASES } from "../roi/roiRoadmap.constants"
import type {
  ApplicationDraftWorkspaceData,
  SafetyEvidenceViewpoint,
  WorkspaceSafetyRow,
  WorkspaceScenario,
} from "../applicationDraft/applicationDraft.contract"
import type { SafetyCheckItem } from "../safetyCheck/safetyCheck.contract"
import type { SupportProjectsPolicyCard } from "../support/supportProjectsOverview.types"
import type {
  MobileApplicationViewModel,
  MobileHomeViewModel,
  MobileMapperInput,
  MobilePoliciesViewModel,
  MobilePolicyTypeGroup,
  MobilePriorityPolicyDetail,
  MobileReadinessSummary,
  MobileRoiKpi,
  MobileRoiViewModel,
  MobileSafetyViewModel,
  MobileScenarioCard,
  MobileStrategyRoadmap,
} from "./mobileApp.types"

function safeText(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return fallback
}

function hasDisplayValue(value: unknown) {
  const text = safeText(value)
  if (!text) return false
  if (
    text === "-" ||
    text === "0" ||
    text === "공고 확인 필요" ||
    text === "마감일 확인 필요" ||
    text === "상시 모집" ||
    /^[-·\s]+$/.test(text) ||
    text.endsWith(" · -") ||
    text.endsWith(" ·")
  ) {
    return false
  }
  return true
}

function joinMetaParts(...parts: Array<string | undefined | null>) {
  return parts.filter((part) => hasDisplayValue(part)).join(" · ")
}

function stripEngiPrefix(message: string) {
  return message.replace(/^Engi:\s*/i, "").trim()
}

function formatSupportAmountLabel(value: string) {
  const text = safeText(value)
  if (!hasDisplayValue(text)) return ""
  if (text.includes("지원금")) return text
  if (text.startsWith("최대 ")) return text.replace(/^최대\s+/, "최대 지원금 ")
  return `최대 지원금 ${text}`
}

function formatPolicyTags(chips: string[]) {
  return chips
    .filter(Boolean)
    .slice(0, 3)
    .map((chip) => (chip.startsWith("#") ? chip : `#${chip}`))
}

function mapScenarioCard(
  key: "A" | "B",
  scenario: WorkspaceScenario | undefined,
  fallbackSubtitle: string,
): MobileScenarioCard {
  const title = key === "A" ? "A안 전체 교체" : "B안 부분 교체"
  const badge = key === "A" ? "SCENARIO A" : "SCENARIO B"
  const hasData = Boolean(
    scenario?.investment_manwon ||
      scenario?.roi_pct ||
      scenario?.net_investment_manwon ||
      scenario?.annual_net_benefit_manwon,
  )

  return {
    key,
    badge,
    title: safeText(scenario?.label, title),
    subtitle: hasData ? fallbackSubtitle : "분석 데이터가 없습니다.",
    investmentText: formatManwon(scenario?.investment_manwon),
    subsidyText: formatManwon(scenario?.subsidy_manwon),
    netInvestmentText: formatManwon(scenario?.net_investment_manwon),
    paybackText: formatPaybackYearsCompact({
      payback_months: scenario?.payback_months,
      payback_years: scenario?.payback_years,
    }),
    roiText:
      scenario?.roi_pct != null && Number.isFinite(Number(scenario.roi_pct))
        ? `${Number(scenario.roi_pct).toFixed(1)}%`
        : "-",
    annualBenefitText: formatManwon(scenario?.annual_net_benefit_manwon),
    hasData,
  }
}

function resolveRecommendedKey(
  draftWorkspace: MobileMapperInput["draftWorkspace"],
  recommendedName: string,
  recommendationText = "",
): "A" | "B" | null {
  const selected = draftWorkspace?.scenarios?.selected
  if (selected === "a") return "A"
  if (selected === "b") return "B"
  const normalized = recommendedName.trim().toUpperCase()
  if (normalized.startsWith("A") || normalized.includes("전체")) return "A"
  if (normalized.startsWith("B") || normalized.includes("부분")) return "B"

  const text = stripEngiPrefix(safeText(recommendationText))
  if (/A\s*안|전체\s*교체|SCENARIO\s*A/i.test(text)) return "A"
  if (/B\s*안|부분\s*교체|SCENARIO\s*B/i.test(text)) return "B"

  return pickRecommendedKeyByRoi(draftWorkspace?.scenarios?.a, draftWorkspace?.scenarios?.b)
}

function pickRecommendedKeyByRoi(
  scenarioA?: WorkspaceScenario,
  scenarioB?: WorkspaceScenario,
): "A" | "B" | null {
  const roiA = scenarioA?.roi_pct
  const roiB = scenarioB?.roi_pct
  const hasA = roiA != null && Number.isFinite(Number(roiA))
  const hasB = roiB != null && Number.isFinite(Number(roiB))

  if (hasA && hasB) {
    return Number(roiA) >= Number(roiB) ? "A" : "B"
  }
  if (hasA) return "A"
  if (hasB) return "B"
  return null
}

function kpisAreEmpty(kpis: MobileRoiKpi[]) {
  return kpis.length === 0 || kpis.every((item) => !hasDisplayValue(item.value))
}

function buildScenarioKpis(
  scenario: MobileScenarioCard,
  matchedPolicyCount: string,
): MobileRoiKpi[] {
  return [
    { label: "예상 ROI", value: scenario.roiText },
    { label: "실부담금", value: scenario.netInvestmentText },
    { label: "회수기간", value: scenario.paybackText },
    { label: "매칭 지원사업", value: matchedPolicyCount || "-" },
  ]
}

function resolveRecommendedLabel(
  recommendedKey: "A" | "B" | null,
  scenarioA: MobileScenarioCard,
  scenarioB: MobileScenarioCard,
  fallbackName: string,
) {
  if (recommendedKey === "A") {
    return `${scenarioA.title} 추천`
  }
  if (recommendedKey === "B") {
    return `${scenarioB.title} 추천`
  }
  return fallbackName || "추천 시나리오 미정"
}

function getPaybackYears(scenario?: WorkspaceScenario) {
  if (scenario?.payback_years != null && Number.isFinite(Number(scenario.payback_years))) {
    return Number(scenario.payback_years)
  }
  if (scenario?.payback_months != null && Number.isFinite(Number(scenario.payback_months))) {
    return Number(scenario.payback_months) / 12
  }
  return null
}

function formatPaybackYearsValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(1)}년`
}

function buildStrategyRoadmap(params: {
  recommendedLabel: string
  recommendationSummary: string
  scenarioA?: WorkspaceScenario
  scenarioB?: WorkspaceScenario
  scenarioCardA: MobileScenarioCard
  scenarioCardB: MobileScenarioCard
}): MobileStrategyRoadmap {
  const roiA = params.scenarioA?.roi_pct
  const roiB = params.scenarioB?.roi_pct
  const hasRoiA = roiA != null && Number.isFinite(Number(roiA))
  const hasRoiB = roiB != null && Number.isFinite(Number(roiB))

  const roiComparison =
    hasRoiA && hasRoiB
      ? {
          label: `ROI 차이: ${Math.abs(Number(roiA) - Number(roiB)).toFixed(1)}%p 차이`,
          detail: `A안 ${Number(roiA).toFixed(1)}% vs B안 ${Number(roiB).toFixed(1)}%`,
          hasData: true,
        }
      : {
          label: "ROI 비교 데이터 준비 중",
          detail: params.scenarioCardA.hasData || params.scenarioCardB.hasData
            ? `${params.scenarioCardA.roiText} · ${params.scenarioCardB.roiText}`
            : "",
          hasData: false,
        }

  const paybackA = getPaybackYears(params.scenarioA)
  const paybackB = getPaybackYears(params.scenarioB)
  const paybackComparison =
    paybackA != null && paybackB != null
      ? {
          label: `회수 기간 약 ${Math.abs(paybackA - paybackB).toFixed(1)}년 단축`,
          detail: `A안 ${formatPaybackYearsValue(paybackA)} vs B안 ${formatPaybackYearsValue(paybackB)}`,
          hasData: true,
        }
      : {
          label: "회수기간 비교 준비 중",
          detail:
            params.scenarioCardA.hasData || params.scenarioCardB.hasData
              ? `${params.scenarioCardA.paybackText} · ${params.scenarioCardB.paybackText}`
              : "",
          hasData: false,
        }

  const subtitle = params.recommendedLabel.includes("미정")
    ? "정책 반영, 실투자금, 연간 절감 효과, 설비 노후도를 종합해 단계별 실행 로드맵을 제안합니다."
    : `${params.recommendedLabel}을 우선 검토안으로 선정했습니다. 정책 반영, 실투자금, 연간 절감 효과, 설비 노후도를 종합해 단계별 실행 로드맵을 제안합니다.`

  return {
    eyebrow: "AI INSIGHT",
    title: "제조 공정 효율화를 위한 3단계 AI 추천 로드맵",
    subtitle,
    roiComparison,
    paybackComparison,
    phases: ROI_ROADMAP_PHASES.map((phase) => ({
      id: phase.id,
      phase: phase.phase,
      duration: phase.duration,
      title: phase.title,
      items: phase.items,
    })),
    summaryTitle: "AI EXPERT ANALYSIS",
    summary: params.recommendationSummary,
  }
}

export function mapMobileHomeViewModel({
  dashboard,
  draftWorkspace,
}: MobileMapperInput): MobileHomeViewModel {
  const workspace = dashboard.workspace
  const companyName = workspace.companyName || ""
  const firstMetric = workspace.kpis[0]
  const reviewCount = workspace.priorityEquipmentCount
  const alertMessage =
    reviewCount > 0
      ? `이번 주, 우선 검토할 설비가 ${reviewCount}대 있습니다.`
      : workspace.recentStatusMessage ||
        workspace.actionMessage ||
        workspace.heroReason ||
        "설비 상태를 확인해 주세요."

  const equipmentAlert = {
    title: "설비 상태 알림",
    message: alertMessage,
    ctaLabel: "상태 확인하기",
    ctaPath: "/mobile/roi",
    showCta: true,
  }

  const matchedPolicyLabel =
    workspace.matchedPolicyCount ||
    workspace.policySummary?.matchedPolicyCount ||
    (workspace.equipmentCount > 0 ? "0건" : "-")

  const companyCard = {
    companyName: companyName || "기업 정보 등록 필요",
    locationLine:
      joinMetaParts(workspace.industryLabel, workspace.regionLabel) ||
      "업종 · 지역 정보를 등록해 주세요.",
    equipmentStatusLine:
      joinMetaParts(workspace.equipmentName, workspace.summaryStatusText) ||
      "대표 설비 · 상태 확인 필요",
    registeredEquipmentCount: workspace.equipmentCount,
    closingSoonCount: workspace.closingSoonCount ?? 0,
    matchedPolicyLabel,
  }

  const companyRows = dashboard.companyRows.length
    ? dashboard.companyRows.map((row) => ({ label: row.label, value: row.value || "-" }))
    : [
        { label: "업종", value: workspace.industryLabel || "-" },
        { label: "지역", value: workspace.regionLabel || "-" },
        { label: "매칭 지원사업", value: workspace.matchedPolicyCount || "0" },
      ]

  const priorityCards = [
    {
      id: "deadline",
      title:
        workspace.deadline.dday !== "-"
          ? `신청 마감 ${workspace.deadline.dday} 정책이 있어요.`
          : "확인할 마감 일정이 없습니다.",
      description: workspace.deadline.policyTitle || "연결된 정책이 없습니다.",
      ctaLabel: "지원사업 확인",
      ctaPath: "/mobile/policies",
    },
    {
      id: "safety",
      title:
        draftWorkspace?.safety?.summary?.uploaded_required_count
          ? "안전 점검 증빙이 등록되어 있어요."
          : "대표설비 안전 점검 증빙이 아직 등록되지 않았어요.",
      description:
        draftWorkspace?.safety?.summary?.uploaded_required_count &&
        draftWorkspace?.safety?.summary?.total_required_count
          ? `등록 ${draftWorkspace.safety.summary.uploaded_required_count}/${draftWorkspace.safety.summary.total_required_count}`
          : "현장에서 PDF 증빙을 바로 등록해 주세요.",
      ctaLabel: "증빙 등록",
      ctaPath: "/mobile/safety",
    },
    {
      id: "roi",
      title:
        workspace.status === "completed"
          ? "대표설비 ROI 분석 결과를 확인해보세요."
          : "먼저 ROI 분석을 진행해 주세요.",
      description: firstMetric?.value ? `${firstMetric.label} ${firstMetric.value}` : "핵심 수치가 없습니다.",
      ctaLabel: "ROI 보기",
      ctaPath: "/mobile/roi",
    },
  ]

  const tasks = [
    {
      id: "safety",
      label: workspace.equipmentName
        ? `${workspace.equipmentName} 안전 점검`
        : "안전 점검 증빙 등록",
      summary: draftWorkspace?.safety?.summary
        ? `${draftWorkspace.safety.summary.uploaded_required_count}/${draftWorkspace.safety.summary.total_required_count} 등록`
        : "현장 증빙을 PDF로 등록하세요.",
      path: "/mobile/safety",
      status:
        draftWorkspace?.safety?.summary &&
        draftWorkspace.safety.summary.uploaded_required_count >=
          (draftWorkspace.safety.summary.total_required_count || 0)
          ? ("done" as const)
          : ("pending" as const),
    },
    {
      id: "draft",
      label: "신청서 초안 확인",
      summary: draftWorkspace?.draft.exists ? "초안 작성됨 · 요약 확인" : "준비도와 누락 항목을 점검하세요.",
      path: "/mobile/application",
      status: draftWorkspace?.draft.exists ? ("done" as const) : ("pending" as const),
    },
    {
      id: "policy",
      label: "마감 임박 정책 검토",
      summary:
        workspace.deadline.dday !== "-"
          ? `${workspace.deadline.dday} · ${workspace.deadline.policyTitle}`
          : "지금 열려있는 지원사업을 확인하세요.",
      path: "/mobile/policies",
      status: workspace.deadline.dday !== "-" ? ("urgent" as const) : ("pending" as const),
    },
  ].slice(0, 3)

  const todayTaskCount =
    workspace.actionCount > 0 ? workspace.actionCount : tasks.filter((task) => task.status !== "done").length

  const mapPolicySummary = (item: (typeof workspace.deadlineList.items)[number], index: number) => {
    const deadlineLabel = hasDisplayValue(item.dday) ? item.dday : ""
    const supportAmountText =
      index === 0 && hasDisplayValue(workspace.deadline.supportAmountText)
        ? workspace.deadline.supportAmountText
        : ""
    const preflightNote = hasDisplayValue(item.sourceName)
      ? item.sourceName
      : hasDisplayValue(workspace.needsText)
        ? workspace.needsText
        : ""

    return {
      id: item.policyId || `policy-${index}`,
      title: item.policyTitle || "정책명 확인 필요",
      deadlineLabel,
      reason: preflightNote || "대표설비와 매칭된 정책",
      supportAmountText,
      metaLine: joinMetaParts(deadlineLabel, supportAmountText),
      preflightNote,
      path: "/mobile/policies",
      organizationLabel: "",
      tags: index === 0 ? formatPolicyTags(workspace.priorityChips) : [],
      matchBadge: "",
      supportAmountLabel: formatSupportAmountLabel(supportAmountText),
      ctaLabel: "지원 조건 확인하기",
    }
  }

  const recommendedPolicies = workspace.deadlineList.items.slice(0, 3).map(mapPolicySummary)
  const featuredPolicy = recommendedPolicies[0] || null

  const readiness: MobileReadinessSummary = draftWorkspace
    ? {
        scoreLabel: `${Math.round(
          ([
            draftWorkspace.readiness.company,
            draftWorkspace.readiness.equipment,
            draftWorkspace.readiness.roi,
            draftWorkspace.readiness.policy,
          ].filter((item) => item.status === "complete").length /
            4) *
            100,
        )}%`,
        missingItems: [
          ...(draftWorkspace.readiness.company.missing_fields || []),
          ...(draftWorkspace.readiness.equipment.missing_fields || []),
          ...(draftWorkspace.readiness.roi.missing_fields || []),
          ...(draftWorkspace.readiness.policy.missing_fields || []),
        ].filter(Boolean).slice(0, 2),
      }
    : {
        scoreLabel: workspace.status === "completed" ? "진행 중" : "미시작",
        missingItems: ["ROI 분석", "정책 연결"],
      }

  const aiBody =
    stripEngiPrefix(safeText(workspace.heroSummary)) ||
    stripEngiPrefix(safeText(workspace.engiMessage)) ||
    safeText(workspace.heroReason)
  const aiHighlight = safeText(workspace.actionTitle) || safeText(workspace.engiTitle)
  const aiMessage =
    companyName && aiBody ? `${companyName}님, ${aiBody}` : aiBody || aiHighlight || "현장 인사이트를 준비 중입니다."

  return {
    greeting: companyName ? `${companyName}님` : "안녕하세요",
    companyName,
    statusHeadline: "오늘의 현장 현황",
    equipmentAlert,
    companyCard,
    companyRows,
    matchedPolicyCount: workspace.matchedPolicyCount || "0",
    summaryStatusText: hasDisplayValue(workspace.summaryStatusText) ? workspace.summaryStatusText : "",
    todayTaskCount,
    priorityCards,
    tasks,
    featuredPolicy,
    recommendedPolicies,
    policiesViewAllPath: "/mobile/policies",
    readiness,
    aiCard: {
      message: aiMessage,
      highlightText: aiHighlight,
      ctaLabel: "자세히 보기",
    },
    aiChips: [
      { label: "오늘 해야 할 일", question: "오늘 해야 할 일을 알려줘" },
      { label: "설비 투자 판단", question: "이 설비 투자해도 될까?" },
      { label: "신청서 누락", question: "신청서에 무엇이 부족해?" },
      { label: "증빙 등록", question: "안전 점검 증빙은 어떻게 등록해?" },
    ],
    aiHeadline: safeText(workspace.actionTitle) || safeText(workspace.engiTitle),
    aiPrompt: stripEngiPrefix(safeText(workspace.engiMessage)),
  }
}

export function mapMobileRoiViewModel({
  dashboard,
  draftWorkspace,
}: MobileMapperInput): MobileRoiViewModel {
  const workspace = dashboard.workspace
  const hasAnalysis = workspace.status === "completed"
  const equipmentCategory = dashboard.equipmentRows[0]?.subtitle || "설비 카테고리 확인 필요"
  const recommendationSummary =
    stripEngiPrefix(safeText(workspace.engiMessage)) ||
    safeText(workspace.analysisMetricText) ||
    "-"
  const scenarioA = mapScenarioCard(
    "A",
    draftWorkspace?.scenarios?.a,
    "전체 교체 시 지원금·절감 효과를 함께 검토합니다.",
  )
  const scenarioB = mapScenarioCard(
    "B",
    draftWorkspace?.scenarios?.b,
    "부분 교체로 초기 실부담금을 낮출 수 있습니다.",
  )
  const recommendedKey = resolveRecommendedKey(
    draftWorkspace,
    workspace.recommendedScenarioName,
    recommendationSummary,
  )
  const recommendedScenario =
    recommendedKey === "B" ? scenarioB : recommendedKey === "A" ? scenarioA : null
  const roiMetric = workspace.kpis.find((item) => item.label.includes("ROI")) || workspace.kpis[0]

  const chartRoiA =
    draftWorkspace?.scenarios?.a?.roi_pct != null
      ? Number(draftWorkspace.scenarios.a.roi_pct)
      : null
  const chartRoiB =
    draftWorkspace?.scenarios?.b?.roi_pct != null
      ? Number(draftWorkspace.scenarios.b.roi_pct)
      : null

  let kpis: MobileRoiKpi[] = workspace.kpis.length
    ? workspace.kpis.slice(0, 4).map((item) => ({ label: item.label, value: item.value || "-" }))
    : [
        { label: "예상 ROI", value: "-" },
        { label: "실부담금", value: "-" },
        { label: "회수기간", value: "-" },
        { label: "매칭 지원사업", value: "-" },
      ]

  if (kpisAreEmpty(kpis) && recommendedScenario?.hasData) {
    kpis = buildScenarioKpis(recommendedScenario, workspace.matchedPolicyCount || "-")
  }

  const roiMetricValue = hasDisplayValue(roiMetric?.value)
    ? roiMetric!.value
    : recommendedScenario?.hasData
      ? recommendedScenario.roiText
      : "-"
  const roiMetricLabel = hasDisplayValue(roiMetric?.label)
    ? roiMetric!.label
    : recommendedKey
      ? `${recommendedKey}안 핵심 ROI`
      : "핵심 ROI"

  const recommendedLabel = resolveRecommendedLabel(
    recommendedKey,
    scenarioA,
    scenarioB,
    workspace.recommendedScenarioName,
  )

  const strategyRoadmap = buildStrategyRoadmap({
    recommendedLabel,
    recommendationSummary,
    scenarioA: draftWorkspace?.scenarios?.a,
    scenarioB: draftWorkspace?.scenarios?.b,
    scenarioCardA: scenarioA,
    scenarioCardB: scenarioB,
  })

  const roadmapSteps = [
    {
      phase: "STEP 1",
      duration: workspace.progressText ? "진행 중" : "-",
      title: "투자 분석",
      body: workspace.progressText || "-",
    },
    {
      phase: "STEP 2",
      duration: workspace.nextStepText ? "다음" : "-",
      title: "지원사업 연계",
      body: workspace.nextStepText || "-",
    },
    {
      phase: "STEP 3",
      duration: draftWorkspace?.draft.exists ? "준비됨" : "-",
      title: "신청 준비",
      body: draftWorkspace?.draft.summary_paragraphs?.[0] || workspace.engiMessage || "-",
    },
  ]

  return {
    hasAnalysis,
    equipmentName: workspace.equipmentName || "대표 설비",
    equipmentCategory,
    introTitle: "ROI 기반 전략적 투자 분석",
    introBody:
      "정책 지원금과 운영 효율성을 결합해 현장에서 빠르게 의사결정할 수 있는 핵심 지표를 제공합니다.",
    recommendedKey,
    recommendedLabel,
    scenarioA,
    scenarioB,
    roiMetricLabel,
    roiMetricValue,
    kpis,
    chartRoiA: Number.isFinite(chartRoiA) ? chartRoiA : null,
    chartRoiB: Number.isFinite(chartRoiB) ? chartRoiB : null,
    recommendationSummary,
    roadmapSteps,
    strategyRoadmap,
    aiSummary: stripEngiPrefix(safeText(workspace.engiMessage)) || recommendationSummary,
    webDetailPath: workspace.roiPath || "/roi/strategy",
    emptyMessage: "먼저 웹에서 ROI 분석을 진행해주세요.",
    emptyCtaPath: "/roi/strategy",
  }
}

function dedupePolicies(items: SupportProjectsPolicyCard[]) {
  const map = new Map<string, SupportProjectsPolicyCard>()
  items.forEach((item) => {
    if (!item.policy_id || map.has(item.policy_id)) return
    map.set(item.policy_id, item)
  })
  return [...map.values()]
}

function formatMainCardStatus(status: string) {
  if (status === "우선 검토") return "신청 준비 가능"
  return status || "조건 확인 필요"
}

function formatPolicyDdayLabel(policy: SupportProjectsPolicyCard) {
  if (policy.d_day && policy.d_day !== "-") return policy.d_day
  if (policy.deadline_display) return policy.deadline_display
  return ""
}

function resolvePolicyDdayTone(policy: SupportProjectsPolicyCard): MobilePriorityPolicyDetail["ddayTone"] {
  if (policy.is_past_deadline) return "past"
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 7) return "urgent"
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 21) return "soon"
  return "normal"
}

function formatPolicyDisplayTitle(policy: SupportProjectsPolicyCard) {
  const title = safeText(policy.title)
  const organization = safeText(policy.organization)
  if (!organization || organization === "-") return title
  if (title.startsWith("[") || title.includes(organization)) return title
  return `[${organization}] ${title}`
}

function formatAnalysisTimestamp(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}.${month}.${day} ${hours}:${minutes}`
}

function mapPriorityPolicyDetail(
  policy: SupportProjectsPolicyCard | null,
  equipmentName: string,
): MobilePriorityPolicyDetail | null {
  if (!policy) return null

  const preflightChecks =
    policy.preflight_checks.length > 0
      ? policy.preflight_checks
      : [
          { label: "지원 한도", value: policy.support_amount_text || "공고문 확인 필요" },
          { label: "제출서류", value: policy.required_documents_label || "공고문 확인 필요" },
        ]

  return {
    rankStatusLabel: `1순위 · ${formatMainCardStatus(policy.application_status)}`,
    supportTypeLabel: policy.support_type_label || "지원 유형 확인 필요",
    displayTitle: formatPolicyDisplayTitle(policy),
    equipmentLabel:
      safeText(policy.scenario_label) ||
      policy.tags?.[0] ||
      equipmentName ||
      "대표 설비",
    deadlineLabel: policy.deadline_display || policy.deadline || "예산 소진 시 마감",
    ddayLabel: formatPolicyDdayLabel(policy),
    ddayTone: resolvePolicyDdayTone(policy),
    recommendationReason: policy.recommendation_summary || policy.match_reason || "-",
    whyCheckNow: policy.why_check_now.filter(Boolean),
    preflightChecks,
    documentsLabel: policy.required_documents_label || "공고문 확인 필요",
    actionLabel: policy.action_label || "지원 조건 확인하기",
  }
}

function groupPoliciesByType(policies: SupportProjectsPolicyCard[]): MobilePolicyTypeGroup[] {
  const groups = new Map<string, SupportProjectsPolicyCard[]>()
  policies.forEach((policy) => {
    const typeLabel = policy.support_type_label || "기타 지원사업"
    const bucket = groups.get(typeLabel) || []
    bucket.push(policy)
    groups.set(typeLabel, bucket)
  })
  return [...groups.entries()].map(([typeLabel, items]) => ({
    typeLabel,
    policies: items,
  }))
}

export function mapMobilePoliciesViewModel(params: {
  policies: SupportProjectsPolicyCard[]
  priorityPolicy: SupportProjectsPolicyCard | null
  equipmentName: string
  analysisCreatedAt?: string | null
  heroSubtitle?: string
}): MobilePoliciesViewModel {
  const policies = dedupePolicies(params.policies)
  const urgentPolicies = policies.filter(
    (item) => typeof item.days_remaining === "number" && item.days_remaining <= 7,
  )
  const updatedAtLabel = formatAnalysisTimestamp(params.analysisCreatedAt)

  return {
    hasData: policies.length > 0 || Boolean(params.priorityPolicy),
    eyebrow: "AI 분석 기반 맞춤형 추천",
    pageTitle: "지원사업 분석",
    pageSubtitle: params.heroSubtitle || "전략적 투자 결정이 필요한 이유",
    updatedAtLabel,
    title: "내 설비 맞춤 지원사업",
    subtitle: `${params.equipmentName} 기준으로 우선 확인할 정책입니다.`,
    priorityPolicy: params.priorityPolicy,
    priorityDetail: mapPriorityPolicyDetail(params.priorityPolicy, params.equipmentName),
    policies,
    policiesByType: groupPoliciesByType(policies),
    urgentPolicies,
    webSearchPath: "/support-projects/discovery",
  }
}

function mapReadinessStatus(status: string): MobileApplicationViewModel["steps"][number]["status"] {
  if (status === "complete") return "complete"
  if (status === "needs_evidence" || status === "needs_revision") return "needs"
  return "pending"
}

export function mapMobileApplicationViewModel({
  dashboard,
  draftWorkspace,
}: MobileMapperInput): MobileApplicationViewModel {
  const workspace = dashboard.workspace
  const activeScenario =
    draftWorkspace?.scenarios?.selected === "b"
      ? draftWorkspace.scenarios.b
      : draftWorkspace?.scenarios?.a

  if (!draftWorkspace) {
    return {
      hasWorkspace: false,
      steps: [
        { key: "company", label: "기업 정보", status: "pending", summary: "-" },
        { key: "equipment", label: "설비 정보", status: "pending", summary: "-" },
        { key: "roi", label: "ROI 분석", status: "pending", summary: "-" },
        { key: "policy", label: "정책 연결", status: "pending", summary: "-" },
      ],
      summaryParagraphs: [],
      readinessLabel: workspace.status === "completed" ? "준비 중" : "미시작",
      missingItems: ["신청서 초안 생성", "증빙 등록"],
      policyName: workspace.priorityPolicyTitle || "연결된 정책이 없습니다.",
      policyDeadline: workspace.deadline.deadlineDisplay || "-",
      policyStatus: "정책 연결 필요",
      investmentText: "-",
      subsidyText: "-",
      netInvestmentText: "-",
      paybackText: "-",
      evidenceCountLabel: "0건",
      evidenceMissingText: "증빙 등록이 필요합니다.",
      draftExists: false,
      webDraftPath: "/application-draft",
    }
  }

  const readinessItems = [
    { key: "company", label: "기업 정보", item: draftWorkspace.readiness.company },
    { key: "equipment", label: "설비 정보", item: draftWorkspace.readiness.equipment },
    { key: "roi", label: "ROI 분석", item: draftWorkspace.readiness.roi },
    { key: "policy", label: "정책 연결", item: draftWorkspace.readiness.policy },
  ]

  const steps = readinessItems.map(({ key, label, item }) => ({
    key,
    label,
    status: mapReadinessStatus(item.status),
    summary: item.summary || "-",
  }))

  const completed = readinessItems.filter(({ item }) => item.status === "complete").length
  const total = readinessItems.length

  const missingItems = readinessItems
    .filter(({ item }) => item.status !== "complete")
    .flatMap(({ item }) => (item.missing_fields?.length ? item.missing_fields : [item.summary]))
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, 3)

  const safetySummary = draftWorkspace.safety.summary
  const uploadedCount = safetySummary?.uploaded_required_count ?? 0
  const requiredCount = safetySummary?.total_required_count ?? 0

  const netInvestment =
    activeScenario?.net_investment_manwon ??
    (activeScenario?.investment_manwon != null && activeScenario?.subsidy_manwon != null
      ? Math.max(0, Number(activeScenario.investment_manwon) - Number(activeScenario.subsidy_manwon))
      : null)

  const webDraftPath = draftWorkspace.analysis_id
    ? `/application-draft?analysisId=${encodeURIComponent(draftWorkspace.analysis_id)}${
        draftWorkspace.policy_id
          ? `&policyId=${encodeURIComponent(draftWorkspace.policy_id)}`
          : ""
      }`
    : "/application-draft"

  return {
    hasWorkspace: true,
    steps,
    summaryParagraphs: draftWorkspace.draft.summary_paragraphs.filter(Boolean).slice(0, 3),
    readinessLabel: `${Math.round((completed / total) * 100)}%`,
    missingItems,
    policyName: draftWorkspace.policy.title || workspace.priorityPolicyTitle || "연결된 정책 없음",
    policyDeadline: draftWorkspace.policy.deadline || workspace.deadline.deadlineDisplay || "마감일 확인 필요",
    policyStatus: draftWorkspace.draft.exists ? "초안 작성됨" : "초안 작성 필요",
    investmentText: formatManwon(activeScenario?.investment_manwon),
    subsidyText: formatManwon(activeScenario?.subsidy_manwon),
    netInvestmentText: formatManwon(netInvestment),
    paybackText: formatPaybackYearsCompact({
      payback_months: activeScenario?.payback_months,
      payback_years: activeScenario?.payback_years,
    }),
    evidenceCountLabel: `${uploadedCount}/${requiredCount}건`,
    evidenceMissingText:
      requiredCount > uploadedCount
        ? `${requiredCount - uploadedCount}건의 필수 증빙이 미등록 상태입니다.`
        : requiredCount === 0
          ? "증빙 대상 정보가 없습니다."
          : "필수 증빙이 모두 등록되었습니다.",
    draftExists: draftWorkspace.draft.exists,
    webDraftPath,
  }
}

export function mapMobileSafetyViewModel(params: {
  draftWorkspace: ApplicationDraftWorkspaceData | null
  equipmentName: string
  evidenceItems: SafetyCheckItem[]
  analysisId?: string
  policyId?: string
  equipmentId?: string
}): MobileSafetyViewModel {
  const summary = params.draftWorkspace?.safety?.summary
  const draftRows = params.draftWorkspace?.safety?.rows || []
  const viewpoints = summary?.viewpoints?.length
    ? summary.viewpoints.map((item: SafetyEvidenceViewpoint) => ({
        key: item.viewpoint_key,
        title: item.viewpoint_title,
        judgement: item.current_judgement || "-",
        evidenceStatus: item.evidence_status || "미첨부",
        description: item.description || "-",
        uploadedCount: item.uploaded_count ?? 0,
        requiredCount: item.required_count ?? 0,
        tone:
          item.evidence_status === "첨부됨"
            ? ("ok" as const)
            : item.evidence_status === "미첨부"
              ? ("need" as const)
              : ("neutral" as const),
      }))
    : draftRows.map((row: WorkspaceSafetyRow) => ({
        key: row.viewpoint_key,
        title: row.viewpoint_label,
        judgement: row.current_status || "-",
        evidenceStatus: row.evidence_status || "미첨부",
        description: row.description || "-",
        uploadedCount: row.evidence_status === "첨부됨" ? 1 : 0,
        requiredCount: 1,
        tone:
          row.evidence_status === "첨부됨"
            ? ("ok" as const)
            : row.evidence_status === "미첨부"
              ? ("need" as const)
              : ("neutral" as const),
      }))

  const uploaded = summary?.uploaded_required_count ?? 0
  const required = summary?.total_required_count ?? 0
  const hasNeed = viewpoints.some((item) => item.tone === "need")

  const reportPreviewPath =
    params.analysisId && params.policyId
      ? `/support-projects/priority?analysisId=${encodeURIComponent(params.analysisId)}&policyId=${encodeURIComponent(params.policyId)}${
          params.equipmentId ? `&equipmentId=${encodeURIComponent(params.equipmentId)}` : ""
        }`
      : "/support-projects/priority"

  return {
    representativeEquipmentName: params.equipmentName || "대표 설비",
    overallStatusLabel: hasNeed ? "개선 필요" : required > 0 && uploaded >= required ? "정상 운용" : "증빙 확인 필요",
    overallStatusTone: hasNeed ? "need" : required > 0 && uploaded >= required ? "ok" : "neutral",
    attachmentSummary:
      required > 0
        ? `${uploaded}/${required} 필수 증빙 등록`
        : params.evidenceItems.length > 0
          ? `${params.evidenceItems.length}건 등록됨`
          : "미첨부",
    viewpoints,
    evidenceCount: params.evidenceItems.length,
    evidenceItems: params.evidenceItems,
    canGenerateReport: Boolean(params.analysisId && params.policyId),
    reportPreviewPath,
  }
}
