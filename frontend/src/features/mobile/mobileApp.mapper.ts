import type { SupportProjectsPolicyCard } from "../support/supportProjectsOverview.types"
import type {
  MobileApplicationViewModel,
  MobileHomeViewModel,
  MobileMapperInput,
  MobilePoliciesViewModel,
  MobileReadinessSummary,
  MobileRoiViewModel,
} from "./mobileApp.types"

function safeText(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return fallback
}

export function mapMobileHomeViewModel({
  dashboard,
  draftWorkspace,
}: MobileMapperInput): MobileHomeViewModel {
  const workspace = dashboard.workspace
  const companyName = workspace.companyName || "FactoFit 사용자"
  const firstMetric = workspace.kpis[0]

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
      summary: "현장 증빙을 PDF로 등록하세요.",
      path: "/mobile/safety",
    },
    {
      id: "draft",
      label: "신청서 초안 확인",
      summary: "준비도와 누락 항목을 점검하세요.",
      path: "/mobile/application",
    },
    {
      id: "policy",
      label: "마감 임박 정책 검토",
      summary:
        workspace.deadline.dday !== "-"
          ? `${workspace.deadline.dday} · ${workspace.deadline.policyTitle}`
          : "지금 열려있는 지원사업을 확인하세요.",
      path: "/mobile/policies",
    },
  ].slice(0, 3)

  const recommendedPolicies = workspace.deadlineList.items.slice(0, 2).map((item, index) => ({
    id: item.policyId || `policy-${index}`,
    title: item.policyTitle,
    deadlineLabel: item.dday || "상시 모집",
    reason: item.sourceName || "대표설비와 매칭된 정책",
    path: "/mobile/policies",
  }))

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
    greeting: `${companyName}님`,
    companyName,
    statusHeadline: "오늘의 현장 현황",
    priorityCards,
    tasks,
    recommendedPolicies,
    readiness,
    aiChips: [
      { label: "오늘 해야 할 일", question: "오늘 해야 할 일을 알려줘" },
      { label: "설비 투자 판단", question: "이 설비 투자해도 될까?" },
      { label: "신청서 누락", question: "신청서에 무엇이 부족해?" },
      { label: "증빙 등록", question: "안전 점검 증빙은 어떻게 등록해?" },
    ],
  }
}

export function mapMobileRoiViewModel({ dashboard }: MobileMapperInput): MobileRoiViewModel {
  const workspace = dashboard.workspace
  const hasAnalysis = workspace.status === "completed"
  const equipmentCategory = dashboard.equipmentRows[0]?.subtitle || "설비 카테고리 확인 필요"
  const roiMetric = workspace.kpis.find((item) => item.label.includes("ROI")) || workspace.kpis[0]
  const investment = workspace.kpis.find((item) => item.label.includes("실부담")) || workspace.kpis[1]
  const savings = workspace.analysisMetricText || "절감 예상 수치가 없습니다."

  return {
    hasAnalysis,
    equipmentName: workspace.equipmentName || "대표 설비",
    equipmentCategory,
    roiMetricLabel: roiMetric?.label || "핵심 수치",
    roiMetricValue: roiMetric?.value || "-",
    investmentText: investment?.value || "-",
    savingsText: savings,
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
  equipmentName: string
}): MobilePoliciesViewModel {
  return {
    hasData: params.policies.length > 0,
    title: "내 설비 맞춤 지원사업",
    subtitle: `${params.equipmentName} 기준으로 우선 확인할 정책입니다.`,
    policies: dedupePolicies(params.policies),
    webSearchPath: "/support-projects/discovery",
  }
}

export function mapMobileApplicationViewModel({
  dashboard,
  draftWorkspace,
}: MobileMapperInput): MobileApplicationViewModel {
  const workspace = dashboard.workspace
  if (!draftWorkspace) {
    return {
      hasWorkspace: false,
      readinessLabel: workspace.status === "completed" ? "준비 중" : "미시작",
      missingItems: ["신청서 초안 생성", "증빙 등록"],
      policyName: "연결된 정책이 없습니다.",
      policyDeadline: "-",
      policyStatus: "정책 연결 필요",
      evidenceCountLabel: "0건",
      evidenceMissingText: "증빙 등록이 필요합니다.",
      webDraftPath: "/application-draft",
    }
  }

  const readinessItems = [
    draftWorkspace.readiness.company,
    draftWorkspace.readiness.equipment,
    draftWorkspace.readiness.roi,
    draftWorkspace.readiness.policy,
  ]
  const completed = readinessItems.filter((item) => item.status === "complete").length
  const total = readinessItems.length

  const missingItems = readinessItems
    .filter((item) => item.status !== "complete")
    .flatMap((item) => (item.missing_fields?.length ? item.missing_fields : [item.summary]))
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, 3)

  const safetySummary = draftWorkspace.safety.summary
  const uploadedCount = safetySummary?.uploaded_required_count ?? 0
  const requiredCount = safetySummary?.total_required_count ?? 0

  const webDraftPath = draftWorkspace.analysis_id
    ? `/application-draft?analysisId=${encodeURIComponent(draftWorkspace.analysis_id)}`
    : "/application-draft"

  return {
    hasWorkspace: true,
    readinessLabel: `${Math.round((completed / total) * 100)}%`,
    missingItems,
    policyName: draftWorkspace.policy.title || "연결된 정책 없음",
    policyDeadline: draftWorkspace.policy.deadline || "마감일 확인 필요",
    policyStatus: draftWorkspace.draft.exists ? "초안 작성됨" : "초안 작성 필요",
    evidenceCountLabel: `${uploadedCount}/${requiredCount}건`,
    evidenceMissingText:
      requiredCount > uploadedCount
        ? `${requiredCount - uploadedCount}건의 필수 증빙이 미등록 상태입니다.`
        : "필수 증빙이 모두 등록되었습니다.",
    webDraftPath,
  }
}

