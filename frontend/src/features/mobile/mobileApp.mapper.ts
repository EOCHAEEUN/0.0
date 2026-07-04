import {
  formatManwon,
  formatPaybackYearsCompact,
} from "../applicationDraft/applicationDraft.utils"
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
  MobileReadinessSummary,
  MobileRoiViewModel,
  MobileSafetyViewModel,
  MobileScenarioCard,
} from "./mobileApp.types"

function safeText(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return fallback
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
): "A" | "B" | null {
  const selected = draftWorkspace?.scenarios?.selected
  if (selected === "a") return "A"
  if (selected === "b") return "B"
  const normalized = recommendedName.trim().toUpperCase()
  if (normalized.startsWith("A") || normalized.includes("전체")) return "A"
  if (normalized.startsWith("B") || normalized.includes("부분")) return "B"
  return null
}

export function mapMobileHomeViewModel({
  dashboard,
  draftWorkspace,
}: MobileMapperInput): MobileHomeViewModel {
  const workspace = dashboard.workspace
  const companyName = workspace.companyName || ""
  const firstMetric = workspace.kpis[0]

  const equipmentBanner = {
    headline: workspace.recentStatusMessage || workspace.actionMessage || "설비 상태를 확인해 주세요.",
    equipmentName: workspace.equipmentName || "대표 설비",
    statusLabel: workspace.summaryStatusText || "상태 확인 필요",
    metricText: workspace.analysisMetricText || firstMetric?.value || "-",
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
      label: "안전 점검 증빙 등록",
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

  const mapPolicySummary = (item: (typeof workspace.deadlineList.items)[number], index: number) => ({
    id: item.policyId || `policy-${index}`,
    title: item.policyTitle || "정책명 확인 필요",
    deadlineLabel: item.dday || "상시 모집",
    reason: item.sourceName || "대표설비와 매칭된 정책",
    supportAmountText: workspace.deadline.supportAmountText || "-",
    path: "/mobile/policies",
  })

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

  return {
    greeting: companyName ? `${companyName}님` : "안녕하세요",
    companyName,
    statusHeadline: "오늘의 현장 현황",
    equipmentBanner,
    companyRows,
    matchedPolicyCount: workspace.matchedPolicyCount || "0",
    summaryStatusText: workspace.summaryStatusText || "-",
    priorityCards,
    tasks,
    featuredPolicy,
    recommendedPolicies,
    readiness,
    aiChips: [
      { label: "오늘 해야 할 일", question: "오늘 해야 할 일을 알려줘" },
      { label: "설비 투자 판단", question: "이 설비 투자해도 될까?" },
      { label: "신청서 누락", question: "신청서에 무엇이 부족해?" },
      { label: "증빙 등록", question: "안전 점검 증빙은 어떻게 등록해?" },
    ],
    aiPrompt: workspace.engiMessage || "AI Assistant가 우선 행동을 정리해 드립니다.",
  }
}

export function mapMobileRoiViewModel({
  dashboard,
  draftWorkspace,
}: MobileMapperInput): MobileRoiViewModel {
  const workspace = dashboard.workspace
  const hasAnalysis = workspace.status === "completed"
  const equipmentCategory = dashboard.equipmentRows[0]?.subtitle || "설비 카테고리 확인 필요"
  const roiMetric = workspace.kpis.find((item) => item.label.includes("ROI")) || workspace.kpis[0]
  const recommendedKey = resolveRecommendedKey(draftWorkspace, workspace.recommendedScenarioName)
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

  const chartRoiA =
    draftWorkspace?.scenarios?.a?.roi_pct != null
      ? Number(draftWorkspace.scenarios.a.roi_pct)
      : null
  const chartRoiB =
    draftWorkspace?.scenarios?.b?.roi_pct != null
      ? Number(draftWorkspace.scenarios.b.roi_pct)
      : null

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
    recommendedLabel: workspace.recommendedScenarioName || "추천 시나리오 미정",
    scenarioA,
    scenarioB,
    roiMetricLabel: roiMetric?.label || "핵심 ROI",
    roiMetricValue: roiMetric?.value || "-",
    kpis: workspace.kpis.length
      ? workspace.kpis.slice(0, 4).map((item) => ({ label: item.label, value: item.value || "-" }))
      : [
          { label: "예상 ROI", value: "-" },
          { label: "실부담금", value: "-" },
          { label: "회수기간", value: "-" },
          { label: "매칭 지원사업", value: "-" },
        ],
    chartRoiA: Number.isFinite(chartRoiA) ? chartRoiA : null,
    chartRoiB: Number.isFinite(chartRoiB) ? chartRoiB : null,
    recommendationSummary: workspace.engiMessage || workspace.analysisMetricText || "-",
    roadmapSteps,
    aiSummary: workspace.engiMessage || "AI 해석을 준비 중입니다.",
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

export function mapMobilePoliciesViewModel(params: {
  policies: SupportProjectsPolicyCard[]
  priorityPolicy: SupportProjectsPolicyCard | null
  equipmentName: string
}): MobilePoliciesViewModel {
  const policies = dedupePolicies(params.policies)
  const urgentPolicies = policies.filter(
    (item) => typeof item.days_remaining === "number" && item.days_remaining <= 7,
  )

  return {
    hasData: policies.length > 0 || Boolean(params.priorityPolicy),
    title: "내 설비 맞춤 지원사업",
    subtitle: `${params.equipmentName} 기준으로 우선 확인할 정책입니다.`,
    priorityPolicy: params.priorityPolicy,
    policies,
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
