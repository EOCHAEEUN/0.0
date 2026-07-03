import { useCallback, useEffect, useMemo, useState } from "react"

import {
  fetchApplicationDraftWorkspace,
  requestApplicationDraftGeneration,
} from "../applicationDraft.api"
import type {
  ApplicationDraftReportParams,
  ApplicationDraftWorkspaceData,
  ReadinessItemStatus,
  ScenarioKey,
  WorkspaceScenario,
} from "../applicationDraft.contract"
import {
  formatManwon,
  formatPaybackFromScenario,
} from "../applicationDraft.utils"

type RouteContext = {
  analysisId?: string
  policyId?: string
  companyId?: string
}

type WorkspaceState =
  | { kind: "loading" }
  | { kind: "analysis_required"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ApplicationDraftWorkspaceData }

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key)?.trim() ?? ""
  } catch {
    return ""
  }
}

function resolveCompanyId(route: RouteContext) {
  return route.companyId || readLocalStorage("factofit_company_id") || readLocalStorage("company_id")
}

function scenarioKeyFromSelected(value?: string | null): ScenarioKey {
  return String(value || "a").toLowerCase() === "b" ? "B" : "A"
}

function readinessBadgeLabel(status: ReadinessItemStatus) {
  switch (status) {
    case "complete":
      return "완료"
    case "needs_evidence":
      return "증빙 필요"
    case "legacy_missing":
      return "이력 없음"
    default:
      return "수정필요"
  }
}

function readinessBadgeTone(
  status: ReadinessItemStatus,
): "ok" | "warn" | "need" {
  if (status === "complete") return "ok"
  if (status === "legacy_missing" || status === "needs_evidence") return "warn"
  return "need"
}

export function useApplicationDraftWorkspace(route: RouteContext) {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    kind: "loading",
  })
  const [manualScenarioKey, setManualScenarioKey] = useState<ScenarioKey>("A")
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [generateError, setGenerateError] = useState("")

  const companyId = resolveCompanyId(route)
  const analysisId = route.analysisId
  const policyId = route.policyId

  const reload = useCallback(async () => {
    if (!companyId) {
      setWorkspaceState({
        kind: "error",
        message: "company_id가 없어 신청서 초안 화면을 불러올 수 없습니다.",
      })
      return
    }

    if (!analysisId) {
      setWorkspaceState({
        kind: "analysis_required",
        message: "분석을 선택해야 신청서 초안 화면을 열 수 있습니다.",
      })
      return
    }

    setWorkspaceState({ kind: "loading" })

    try {
      const data = await fetchApplicationDraftWorkspace({
        companyId,
        analysisId,
        policyId,
      })

      if (data.state === "analysis_required") {
        setWorkspaceState({
          kind: "analysis_required",
          message: data.message || "분석을 선택해야 신청서 초안 화면을 열 수 있습니다.",
        })
        return
      }

      setWorkspaceState({ kind: "ready", data })
      setManualScenarioKey(scenarioKeyFromSelected(data.scenarios?.selected))
    } catch (error) {
      setWorkspaceState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "신청서 초안 화면 데이터를 불러오지 못했습니다.",
      })
    }
  }, [analysisId, companyId, policyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const data = workspaceState.kind === "ready" ? workspaceState.data : null

  const activeScenario: WorkspaceScenario | null = useMemo(() => {
    if (!data) return null
    return manualScenarioKey === "B" ? data.scenarios.b : data.scenarios.a
  }, [data, manualScenarioKey])

  const reportParams: ApplicationDraftReportParams | null = useMemo(() => {
    if (!data?.company_id || !data.equipment_id || !data.policy_id) return null

    return {
      companyId: data.company_id,
      equipmentId: data.equipment_id,
      policyId: data.policy_id,
      analysisId: data.analysis_id || analysisId,
      draftResultId: data.draft.draft_result_id || undefined,
    }
  }, [analysisId, data])

  const handleGenerateDraft = async () => {
    if (!data?.company_id || !data.equipment_id || !data.policy_id) return

    setIsGeneratingDraft(true)
    setGenerateError("")

    try {
      await requestApplicationDraftGeneration({
        companyId: data.company_id,
        equipmentId: data.equipment_id,
        policyId: data.policy_id,
        analysisId: data.analysis_id || analysisId,
      })
      await reload()
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "신청서 초안 생성에 실패했습니다.",
      )
    } finally {
      setIsGeneratingDraft(false)
    }
  }

  const subsidyLabel =
    activeScenario?.subsidy_manwon === null ||
    activeScenario?.subsidy_manwon === undefined
      ? "공고참고"
      : formatManwon(activeScenario.subsidy_manwon)

  const paybackLabel = formatPaybackFromScenario({
    payback_months: activeScenario?.payback_months,
    payback_years: activeScenario?.payback_years,
  })

  const investmentLabel = formatManwon(activeScenario?.investment_manwon)

  const summaryText = data?.draft.summary_paragraphs?.join("\n\n") || ""

  const pdfPreview = {
    businessNecessity:
      data?.draft.content?.business_necessity ||
      data?.draft.summary_paragraphs?.[0] ||
      "",
    applicationPurpose: data?.draft.content?.application_purpose || "",
    expectedBenefits: Array.isArray(data?.draft.content?.expected_benefits)
      ? (data?.draft.content?.expected_benefits as string[])
      : [],
    scenarioLabel:
      activeScenario?.label ||
      (manualScenarioKey === "A" ? "A 전체교체" : "B 부분교체"),
    equipmentName: data?.equipment?.name || "설비명 미확인",
    companyName: data?.company?.company_name || "기업명 미확인",
    selectedPolicy: data?.policy?.title || "지원사업 미확인",
  }

  const canUsePdf = Boolean(reportParams) && workspaceState.kind === "ready"

  return {
    workspaceState,
    data,
    isLoading: workspaceState.kind === "loading",
    isAnalysisRequired: workspaceState.kind === "analysis_required",
    errorMessage: workspaceState.kind === "error" ? workspaceState.message : "",
    analysisRequiredMessage:
      workspaceState.kind === "analysis_required" ? workspaceState.message : "",
    scenarioKey: manualScenarioKey,
    setScenarioKey: setManualScenarioKey,
    activeScenario,
    investmentLabel,
    subsidyLabel,
    paybackLabel,
    summaryText,
    draftExists: Boolean(data?.draft.exists),
    isGeneratingDraft,
    generateError,
    handleGenerateDraft,
    reload,
    reportParams,
    pdfPreview,
    canUsePdf,
    readinessBadgeLabel,
    readinessBadgeTone,
  }
}

export type ApplicationDraftWorkspaceModel = ReturnType<
  typeof useApplicationDraftWorkspace
>
