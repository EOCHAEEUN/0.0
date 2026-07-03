import type { LoginBriefingResponse } from "./loginBriefing.api"

export function formatBriefingManwon(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }
  return `${Math.round(value).toLocaleString("ko-KR")}만원`
}

export function formatBriefingRoi(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }
  return `${Math.round(value)}%`
}

export function getBriefingHeroTitle(data: LoginBriefingResponse | null) {
  const name = data?.user_name?.trim()
  if (name) {
    return `${name}님, 지금 바로 확인해보세요!`
  }
  return "지금 바로 확인해보세요!"
}

export function getAvailablePolicyDisplay(data: LoginBriefingResponse | null, loading: boolean) {
  if (loading) return { value: "불러오는 중", tone: "muted" as const }
  if (!data?.has_analysis) return { value: "분석 필요", tone: "muted" as const }
  if (data.available_policy_count === null) {
    return { value: "확인 중", tone: "muted" as const }
  }
  return { value: `${data.available_policy_count}건`, tone: "primary" as const }
}

export function getSupportAmountDisplay(data: LoginBriefingResponse | null, loading: boolean) {
  if (loading) return { value: "불러오는 중", hint: null }
  if (!data?.has_analysis) return { value: "분석 필요", hint: null }
  const formatted = formatBriefingManwon(data.expected_support_manwon)
  if (!formatted) return { value: "산정 전", hint: null }
  if (data.expected_support_label === "max_scenario") {
    return {
      value: formatted,
      hint: "시나리오 기준 최대 예상 지원금",
    }
  }
  return { value: formatted, hint: null }
}

export function getRoiDisplay(data: LoginBriefingResponse | null, loading: boolean) {
  if (loading) return "불러오는 중"
  if (!data?.has_analysis) return "분석 필요"
  return formatBriefingRoi(data.expected_roi_percent) ?? "산정 전"
}

export const OPEN_AI_ADVISOR_EVENT = "factofit:open-ai-advisor"

export function requestOpenAiAdvisor() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(OPEN_AI_ADVISOR_EVENT))
}
