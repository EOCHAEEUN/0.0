import type {
  SupportProjectsOverviewResponse,
  SupportProjectsOverviewViewModel,
  SupportProjectsPolicyCard,
} from "./supportProjectsOverview.types"

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ""
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapPolicyCard(raw: unknown): SupportProjectsPolicyCard | null {
  const record = asRecord(raw)
  const policyId = pickString(record.policy_id)
  if (!record.exists && !policyId) return null
  if (record.exists === false) return null

  return {
    rank: toNumberOrNull(record.rank),
    policy_id: policyId,
    title: pickString(record.title, "공고명 미확인"),
    organization: pickString(record.organization, "-"),
    deadline: pickString(record.deadline) || null,
    deadline_display: pickString(record.deadline_display) || null,
    d_day: pickString(record.d_day, "-"),
    days_remaining: toNumberOrNull(record.days_remaining),
    is_past_deadline: Boolean(record.is_past_deadline),
    match_score: toNumberOrNull(record.match_score),
    match_score_label: pickString(record.match_score_label) || null,
    fit_status: pickString(record.fit_status, "조건 확인 필요"),
    match_reason: pickString(record.match_reason),
    support_amount_text: pickString(record.support_amount_text, "지원금 조건 확인 필요"),
    tags: Array.isArray(record.tags)
      ? record.tags.map((tag) => String(tag)).filter(Boolean)
      : [],
    condition_links: Array.isArray(record.condition_links)
      ? record.condition_links
          .map((item) => asRecord(item))
          .filter((item) => pickString(item.label) && pickString(item.value))
          .map((item) => ({
            label: pickString(item.label),
            value: pickString(item.value),
          }))
      : [],
    eligible: record.eligible !== false,
    scenario_label: pickString(record.scenario_label) || null,
    url: pickString(record.url) || null,
    summary: pickString(record.summary) || null,
    exists: record.exists !== false,
  }
}

export function mapSupportProjectsOverview(
  raw: unknown,
  params: { companyId: string; analysisId?: string },
): SupportProjectsOverviewViewModel {
  const data = asRecord(raw) as SupportProjectsOverviewResponse & Record<string, unknown>
  const mode = data.mode === "analysis_snapshot" ? "analysis_snapshot" : "live_discovery"
  const isAnalysisMode = mode === "analysis_snapshot"
  const company = asRecord(data.company)
  const equipment = data.equipment ? asRecord(data.equipment) : null
  const countsRaw = asRecord(data.counts)

  const counts = {
    policy_db_total: toNumberOrNull(countsRaw.policy_db_total) ?? 0,
    matched_total: toNumberOrNull(countsRaw.matched_total) ?? 0,
    priority_policy_count: toNumberOrNull(countsRaw.priority_policy_count) ?? 0,
    closing_soon_count: toNumberOrNull(countsRaw.closing_soon_count) ?? 0,
  }

  const priorityPolicy = mapPolicyCard(data.priority_policy)
  const candidates = Array.isArray(data.candidates)
    ? data.candidates
        .map((item) => mapPolicyCard(item))
        .filter((item): item is SupportProjectsPolicyCard => Boolean(item))
    : []
  const allMatched = Array.isArray(data.all_matched)
    ? data.all_matched
        .map((item) => mapPolicyCard(item))
        .filter((item): item is SupportProjectsPolicyCard => Boolean(item))
    : candidates

  const equipmentName = pickString(equipment?.name, "현재 설비")
  const matchedCount = counts.matched_total

  return {
    mode,
    isAnalysisMode,
    companyId: pickString(company.company_id, params.companyId),
    companyName: pickString(company.company_name, "-"),
    equipmentName,
    analysisId: params.analysisId,
    heroTitle: `설비 정보와 투자 조건에 맞는 지원사업 ${matchedCount}건을 찾았습니다.`,
    heroSubtitle: isAnalysisMode
      ? "ROI 분석 당시 매칭된 정책 정보를 기준으로 우선 검토할 공고를 한눈에 정리했습니다."
      : "정책 DB와 기업·설비·ROI 조건을 연결해 우선 검토할 공고를 한눈에 정리했습니다.",
    counts,
    priorityPolicy,
    candidates,
    allMatched: allMatched.length > 0 ? allMatched : candidates,
    priorityBadge: "우선 검토 정책",
    secondaryBadge: isAnalysisMode ? "ROI 분석 연동 정책" : "현재 조건 기반 추천",
    legacyState: pickString(data.legacy_state) || null,
    emptyState: pickString(data.empty_state) || null,
  }
}
