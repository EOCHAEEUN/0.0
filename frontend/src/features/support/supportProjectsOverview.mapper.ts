import type {
  SupportProjectsLiveDiscovery,
  SupportProjectsOverviewResponse,
  SupportProjectsOverviewViewModel,
  SupportProjectsPolicyCard,
  SupportProjectsPreflightCheck,
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

function sanitizeWhyCheckLine(line: string) {
  const match = line.match(/^지원 내용:\s*(.+)$/s)
  if (!match) return line

  const payload = match[1].trim()
  if (!payload.startsWith("[") && !payload.includes('"name"') && !payload.includes("'name'")) {
    return line
  }

  try {
    const parsed = JSON.parse(payload) as unknown
    if (Array.isArray(parsed)) {
      const names = parsed
        .map((item) => {
          if (!item || typeof item !== "object") return pickString(item)
          const record = item as Record<string, unknown>
          const name = pickString(record.name)
          const amount = pickString(record.amount)
          return name && amount ? `${name} ${amount}` : name || amount
        })
        .filter(Boolean)
      if (names.length > 0) {
        const summary = names.slice(0, 3).join(", ") + (names.length > 3 ? " 등" : "")
        return `지원 내용: ${summary}`
      }
    }
  } catch {
    // fall through to regex extraction
  }

  const names = [...payload.matchAll(/['"]name['"]\s*:\s*['"]([^'"]+)['"]/g)].map(
    (entry) => entry[1],
  )
  if (names.length > 0) {
    const summary = names.slice(0, 3).join(", ") + (names.length > 3 ? " 등" : "")
    return `지원 내용: ${summary}`
  }

  return line
}

function mapPreflightChecks(raw: unknown): SupportProjectsPreflightCheck[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => asRecord(item))
    .filter((item) => pickString(item.label) && pickString(item.value))
    .map((item) => ({
      label: pickString(item.label),
      value: pickString(item.value),
    }))
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
    application_status: pickString(record.application_status, "조건 확인 필요"),
    support_type_label: pickString(record.support_type_label, "지원 조건 확인 필요"),
    support_type_detail: pickString(record.support_type_detail) || null,
    recommendation_summary: pickString(
      record.recommendation_summary,
      record.match_reason,
      "우선 검토할 지원 조건입니다.",
    ),
    match_reason: pickString(record.match_reason),
    why_check_now: Array.isArray(record.why_check_now)
      ? record.why_check_now
          .map((line) => sanitizeWhyCheckLine(String(line)))
          .filter(Boolean)
      : [],
    preflight_checks: mapPreflightChecks(record.preflight_checks),
    support_amount_text: pickString(record.support_amount_text, "공고문 확인 필요"),
    required_documents_label: pickString(
      record.required_documents_label,
      "제출서류 공고문 확인 필요",
    ),
    action_label: pickString(record.action_label, "상세 보기 →"),
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
    required_documents_count: toNumberOrNull(record.required_documents_count),
    exists: record.exists !== false,
  }
}

function mapLiveDiscovery(raw: unknown): SupportProjectsLiveDiscovery {
  const record = asRecord(raw)
  const items = Array.isArray(record.items)
    ? record.items
        .map((item) => mapPolicyCard(item))
        .filter((item): item is SupportProjectsPolicyCard => Boolean(item))
    : []
  return {
    source: pickString(record.source, "current_policy_database"),
    total_count: toNumberOrNull(record.total_count) ?? items.length,
    items,
    error: pickString(record.error) || null,
  }
}

export function mapSupportProjectsOverview(
  raw: unknown,
  params: { companyId: string; analysisId?: string },
): SupportProjectsOverviewViewModel {
  const data = asRecord(raw) as SupportProjectsOverviewResponse & Record<string, unknown>
  const mode = data.mode === "analysis_snapshot" ? "analysis_snapshot" : "live_discovery"
  const isAnalysisMode = mode === "analysis_snapshot" && Boolean(params.analysisId)
  const company = asRecord(data.company)
  const equipment = data.equipment ? asRecord(data.equipment) : null
  const countsRaw = asRecord(data.counts)
  const analysisContext = data.analysis_context
    ? (asRecord(data.analysis_context) as SupportProjectsOverviewViewModel["analysisContext"])
    : null

  const counts = {
    policy_db_total:
      toNumberOrNull(data.policy_database_total) ??
      toNumberOrNull(countsRaw.policy_db_total) ??
      0,
    matched_total: toNumberOrNull(countsRaw.matched_total) ?? 0,
    priority_policy_count: toNumberOrNull(countsRaw.priority_policy_count) ?? 0,
    closing_soon_count: toNumberOrNull(countsRaw.closing_soon_count) ?? 0,
  }

  const priorityPolicy = mapPolicyCard(data.priority_policy)
  const priorityPolicies = Array.isArray(data.priority_policies)
    ? data.priority_policies
        .map((item) => mapPolicyCard(item))
        .filter((item): item is SupportProjectsPolicyCard => Boolean(item))
    : Array.isArray(data.candidates)
      ? data.candidates
          .map((item) => mapPolicyCard(item))
          .filter((item): item is SupportProjectsPolicyCard => Boolean(item))
      : []
  const allMatched = Array.isArray(data.all_matched)
    ? data.all_matched
        .map((item) => mapPolicyCard(item))
        .filter((item): item is SupportProjectsPolicyCard => Boolean(item))
    : priorityPolicies

  const equipmentName = pickString(equipment?.name, "현재 설비")
  const priorityCount = counts.priority_policy_count || (priorityPolicy ? 1 : 0) + priorityPolicies.length

  return {
    mode,
    isAnalysisMode,
    companyId: pickString(company.company_id, params.companyId),
    companyName: pickString(company.company_name, "-"),
    equipmentName,
    analysisId: params.analysisId,
    heroTrustLabel: `FACTOFIT POLICY DATABASE · 제조기업 지원정책 ${counts.policy_db_total.toLocaleString("ko-KR")}건 보유`,
    heroTitle: `지금 신청을 검토할 지원사업 ${priorityCount}건을 정리했어요`,
    heroSubtitle:
      "현재 설비와 투자안을 기준으로 우선 검토 정책을 정리하고, 기업 기본 조건에 맞는 추가 정책도 함께 확인할 수 있습니다.",
    counts,
    priorityPolicy,
    priorityPolicies,
    allMatched: allMatched.length > 0 ? allMatched : priorityPolicies,
    liveDiscovery: mapLiveDiscovery(data.live_discovery),
    analysisContext,
    legacyState: pickString(data.legacy_state) || null,
    emptyState: pickString(data.empty_state) || null,
  }
}
