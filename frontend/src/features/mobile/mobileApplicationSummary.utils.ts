import type { ApplicationDraftWorkspaceData, WorkspaceScenario } from "../applicationDraft/applicationDraft.contract"
import { formatPaybackYearsCompact } from "../applicationDraft/applicationDraft.utils"

type EffectItem = {
  label: string
  body: string
}

function parseEffectItem(item: string): EffectItem {
  const colonIndex = item.indexOf(":")
  if (colonIndex > 0) {
    return {
      label: item.slice(0, colonIndex).trim(),
      body: item.slice(colonIndex + 1).trim(),
    }
  }
  return { label: item.trim(), body: "" }
}

export function buildMobileNecessityText(data: ApplicationDraftWorkspaceData | null) {
  const content = data?.draft.content
  const equipmentName = data?.equipment?.name?.trim()
  const base =
    (typeof content?.business_necessity === "string" && content.business_necessity) ||
    data?.draft.summary_paragraphs?.[0] ||
    ""

  if (base) return base

  if (equipmentName) {
    return `현재 보유 중인 ${equipmentName}의 노후화로 인해 유지보수 비용과 자동화 수준을 개선할 필요가 있습니다.`
  }

  return "현재 설비의 노후화로 인해 에너지 비용, 유지보수 부담, 품질 손실 문제가 발생하고 있어 지능형 자동화 설비 도입이 필요합니다."
}

export function buildMobileEffectItems(data: ApplicationDraftWorkspaceData | null): EffectItem[] {
  const benefits = data?.draft.content?.expected_benefits
  if (Array.isArray(benefits) && benefits.length > 0) {
    return benefits.map((item) => parseEffectItem(String(item)))
  }

  const effects = data?.draft.content?.expected_effects
  if (typeof effects === "string" && effects.trim()) {
    return effects
      .split(/[\n;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(parseEffectItem)
  }

  return []
}

export function buildMobileRoiSummary(
  scenario: WorkspaceScenario | null,
  scenarioKey: "A" | "B",
) {
  const payback = formatPaybackYearsCompact({
    payback_months: scenario?.payback_months,
    payback_years: scenario?.payback_years,
  })

  if (payback === "-") {
    return "ROI 분석 결과를 기반으로 투자 타당성을 검토했습니다."
  }

  const scenarioLabel = scenarioKey === "A" ? "전체교체" : "부분교체"
  return `ROI 분석 결과, ${scenarioLabel} 시나리오 기준 예상 회수기간은 ${payback}이며, 투자 타당성이 확인되었습니다.`
}

export const MOBILE_PDF_SECTIONS = [
  {
    id: "01",
    title: "사업 필요성",
    body: "노후 설비, 에너지 배경 정리",
  },
  {
    id: "02",
    title: "추진 내용",
    body: "설비 교체 및 실행 계획",
  },
  {
    id: "03",
    title: "기대효과",
    body: "비용 절감 및 성과 관리",
  },
] as const
