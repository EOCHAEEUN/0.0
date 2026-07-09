import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Pencil,
  Sparkles,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import type { ApplicationDraftReportParams } from "../applicationDraft/applicationDraft.contract"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import {
  formatCurrencyWonFromManwon,
  formatPaybackYearsCompact,
} from "../applicationDraft/applicationDraft.utils"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileSafetyViewModel } from "./mobileApp.mapper"
import {
  MOBILE_PDF_SECTIONS,
  buildMobileEffectItems,
  buildMobileNecessityText,
  buildMobileRoiSummary,
} from "./mobileApplicationSummary.utils"

const STEPPER = [
  { key: "company", label: "기업정보" },
  { key: "equipment", label: "설비정보" },
  { key: "roi", label: "ROI분석" },
  { key: "application", label: "신청서" },
] as const

type MobileReportType = "consumer_summary" | "application_evidence"

const MOBILE_REPORT_OPTIONS: Array<{ key: MobileReportType; label: string }> = [
  { key: "consumer_summary", label: "한눈에 보는 분석 PDF" },
  { key: "application_evidence", label: "신청서 작성 초안 PDF" },
]

const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:8000/api"
).replace(/\/$/, "")

const MOBILE_FALLBACK_FILENAMES: Record<MobileReportType, string> = {
  consumer_summary: "FactoFit_분석결과_표중심.pdf",
  application_evidence: "FactoFit_신청서초안_그래프.pdf",
}

function buildApiUrl(path: string) {
  if (API_BASE_URL.endsWith("/api")) {
    return `${API_BASE_URL}${path.replace(/^\/api/, "")}`
  }
  return `${API_BASE_URL}${path}`
}

function getToken() {
  try {
    return (
      window.localStorage.getItem("factofit_access_token")?.trim() ||
      window.localStorage.getItem("access_token")?.trim() ||
      window.localStorage.getItem("token")?.trim() ||
      ""
    )
  } catch {
    return ""
  }
}

function parseContentDispositionFilename(header: string | null): string {
  if (!header) return ""
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  }
  return header.match(/filename="?([^";]+)"?/i)?.[1] ?? ""
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json()
    const detail = payload?.detail
    if (typeof detail === "string" && detail.trim()) return detail
    if (typeof payload?.message === "string" && payload.message.trim()) return payload.message
  } catch {
    const text = await response.text().catch(() => "")
    if (text.trim()) return text
  }
  return "PDF 생성 중 오류가 발생했습니다."
}

async function requestMobilePdf(
  params: ApplicationDraftReportParams,
  reportType: MobileReportType,
) {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  const endpoint =
    reportType === "consumer_summary"
      ? "/api/reports/consumer-summary.pdf"
      : "/api/reports/application-evidence.pdf"

  const response = await fetch(buildApiUrl(endpoint), {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({
      company_id: params.companyId,
      equipment_id: params.equipmentId,
      policy_id: params.policyId,
      analysis_id: params.analysisId,
      draft_result_id: params.draftResultId,
      report_type: reportType,
      tone: "submission",
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const blob = await response.blob()
  const serverFilename = parseContentDispositionFilename(response.headers.get("Content-Disposition"))
  return {
    blob,
    filename:
      serverFilename || MOBILE_FALLBACK_FILENAMES[reportType] || "factofit_application_report.pdf",
  }
}

async function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  await new Promise((resolve) => window.setTimeout(resolve, 300))
  document.body.removeChild(anchor)
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1200)
}

function policySupportLabel(supportText?: string) {
  const text = supportText?.trim()
  if (text && text !== "-" && text !== "공고문 확인 필요") return text
  return ""
}

function truncatePolicyTitle(title: string, max = 22) {
  const trimmed = title.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export default function MobileApplicationScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedPdfSection, setSelectedPdfSection] = useState<string>(MOBILE_PDF_SECTIONS[0].id)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewType, setPreviewType] = useState<MobileReportType>("consumer_summary")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState("")
  const [downloadSelection, setDownloadSelection] = useState<Record<MobileReportType, boolean>>({
    consumer_summary: true,
    application_evidence: true,
  })
  const [policyPickerOpen, setPolicyPickerOpen] = useState(false)
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId })
  const workspace = dashboard.workspace
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, workspace),
    [searchParams, workspace],
  )

  const draft = useApplicationDraftWorkspace({
    analysisId: flowContext.analysisId,
    policyId: flowContext.policyId,
    companyId: getStoredCompanyId() || undefined,
  })

  const safetyModel = useMemo(
    () =>
      mapMobileSafetyViewModel({
        draftWorkspace: draft.data,
        equipmentName: draft.data?.equipment?.name || workspace.equipmentName,
        evidenceItems: [],
        analysisId: flowContext.analysisId,
        policyId: flowContext.policyId,
        equipmentId: flowContext.equipmentId,
      }),
    [draft.data, flowContext, workspace.equipmentName],
  )

  const hasRequiredContext = Boolean(flowContext.analysisId && flowContext.policyId)
  const scenario = draft.activeScenario
  const netInvestment =
    scenario?.net_investment_manwon ??
    (scenario?.investment_manwon != null && scenario?.subsidy_manwon != null
      ? Math.max(0, Number(scenario.investment_manwon) - Number(scenario.subsidy_manwon))
      : null)

  const necessityText = buildMobileNecessityText(draft.data)
  const effectItems = buildMobileEffectItems(draft.data)
  const roiSummary = buildMobileRoiSummary(scenario, draft.scenarioKey)
  const paybackText = formatPaybackYearsCompact({
    payback_months: scenario?.payback_months,
    payback_years: scenario?.payback_years,
  })

  const recommendedPolicies = useMemo(() => {
    const currentTitle = draft.data?.policy?.title?.trim()
    if (!currentTitle) return []

    return [
      {
        id: draft.data?.policy_id || "current",
        title: currentTitle,
        support: policySupportLabel(draft.subsidyLabel),
      },
    ]
  }, [draft.data?.policy?.title, draft.data?.policy_id, draft.subsidyLabel])

  const unavailablePdfReason = useMemo(() => {
    if (draft.isLoading) return "신청서 화면 데이터를 불러오는 중입니다."
    if (!draft.reportParams) return "분석·정책 정보가 준비되면 PDF를 생성할 수 있습니다."
    if (draft.data?.policy?.legacy_missing) return "정책 스냅샷 이력이 없어 PDF를 생성할 수 없습니다."
    return ""
  }, [draft.isLoading, draft.reportParams, draft.data?.policy?.legacy_missing])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const availablePolicies = draft.data?.policy?.available_policies ?? []
  const generatedAtLabel = draft.lastGeneratedAt
    ? new Date(draft.lastGeneratedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : ""

  const handleSelectPolicy = (policyId: string) => {
    setPolicyPickerOpen(false)
    if (!policyId || policyId === flowContext.policyId) return
    navigate(buildMobilePath("/mobile/application", flowContext, { policyId }))
  }

  const selectedReportType: MobileReportType =
    selectedPdfSection === "01" ? "consumer_summary" : "application_evidence"

  const openMobilePreview = async () => {
    if (!draft.reportParams || unavailablePdfReason) {
      setPreviewError(unavailablePdfReason || "PDF 생성 정보가 부족합니다.")
      setPreviewOpen(true)
      return
    }

    setPreviewType(selectedReportType)
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewError("")

    try {
      const { blob } = await requestMobilePdf(draft.reportParams, selectedReportType)
      if (previewUrl) window.URL.revokeObjectURL(previewUrl)
      const nextUrl = window.URL.createObjectURL(blob)
      setPreviewUrl(nextUrl)
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "PDF 바로보기를 준비하지 못했습니다.")
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDownloadSelected = async () => {
    if (downloading || !draft.reportParams) return
    const targets = MOBILE_REPORT_OPTIONS.filter((option) => downloadSelection[option.key])
    if (!targets.length) return

    setDownloading(true)
    setDownloadMessage("")

    try {
      for (const option of targets) {
        const { blob, filename } = await requestMobilePdf(draft.reportParams, option.key)
        await triggerBrowserDownload(blob, filename)
      }
      setDownloadMessage(`PDF ${targets.length}개 다운로드를 시작했습니다.`)
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "PDF 다운로드 중 오류가 발생했습니다.")
    } finally {
      setDownloading(false)
      setDownloadOpen(false)
    }
  }

  const stepComplete = (key: string) => {
    if (!draft.data) return false
    const readiness = draft.data.readiness
    if (key === "company") return readiness.company.status === "complete"
    if (key === "equipment") return readiness.equipment.status === "complete"
    if (key === "roi") return readiness.roi.status === "complete"
    return false
  }

  return (
    <section className="ff-mobile-screen ff-mobile-application-screen">
      <MobileTopBar companyName={workspace.companyName} subtitle="신청서" showSubtitle />

      {!hasRequiredContext ? (
        <article className="ff-mobile-card">
          <h2>신청 문맥이 없습니다.</h2>
          <p>ROI 분석에서 추천된 지원사업을 선택하면 신청서를 준비할 수 있습니다.</p>
          <button
            type="button"
            className="ff-mobile-primary-btn"
            onClick={() => navigate(buildMobilePath("/mobile/policies", flowContext))}
          >
            정책 선택하러 가기
          </button>
        </article>
      ) : null}

      {draft.isLoading ? (
        <article className="ff-mobile-card">
          <p>신청서 정보를 불러오는 중...</p>
        </article>
      ) : null}

      {draft.errorMessage ? (
        <article className="ff-mobile-card">
          <p>{draft.errorMessage}</p>
        </article>
      ) : null}

      {hasRequiredContext && !draft.isLoading && !draft.errorMessage ? (
        <>
          <nav className="ff-mobile-application-stepper" aria-label="신청서 작성 진행 단계">
            {STEPPER.map((step, index) => {
              const isCurrent = step.key === "application"
              const isComplete = !isCurrent && stepComplete(step.key)
              return (
                <div key={step.key} className="ff-mobile-application-step-wrap">
                  {index > 0 ? <span className="ff-mobile-application-step-line" aria-hidden="true" /> : null}
                  <div
                    className={`ff-mobile-application-step${isCurrent ? " is-current" : ""}${
                      isComplete ? " is-complete" : ""
                    }`}
                  >
                    <span className="ff-mobile-application-step-icon" aria-hidden="true">
                      {isCurrent ? (
                        <FileText size={16} strokeWidth={2.1} />
                      ) : isComplete ? (
                        <Check size={16} strokeWidth={2.4} />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </span>
                    <span>{step.label}</span>
                  </div>
                </div>
              )
            })}
          </nav>

          <article className="ff-mobile-application-summary-card">
            <div className="ff-mobile-application-summary-head">
              <h2>
                핵심 요약 <span>(Summary)</span>
              </h2>
              <button
                type="button"
                className="ff-mobile-application-edit-btn"
                onClick={() => setPolicyPickerOpen(true)}
              >
                <Pencil size={13} strokeWidth={2.1} aria-hidden="true" />
                수정
              </button>
            </div>

            <section className="ff-mobile-application-block">
              <h3>현황 및 필요성</h3>
              <p>{necessityText}</p>
            </section>

            {effectItems.length > 0 ? (
              <section className="ff-mobile-application-block">
                <h3>기대 효과</h3>
                <ul>
                  {effectItems.map((item) => (
                    <li key={`${item.label}-${item.body}`}>
                      {item.body ? (
                        <>
                          <strong>{item.label}</strong> {item.body}
                        </>
                      ) : (
                        item.label
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="ff-mobile-application-block">
              <h3>ROI 결과</h3>
              <p>{roiSummary}</p>
            </section>

            <div className="ff-mobile-application-ai-note">
              <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
              <p>AI가 데이터 기반으로 작성한 초안입니다.</p>
            </div>
          </article>

          {recommendedPolicies.length > 0 ? (
            <section className="ff-mobile-application-recommend-compact">
              <span>추천 지원 사업</span>
              {recommendedPolicies.map((policy) => (
                <p key={policy.id}>
                  <strong title={policy.title}>{truncatePolicyTitle(policy.title)}</strong>
                  {policy.support ? <em>{policy.support}</em> : null}
                </p>
              ))}
            </section>
          ) : null}

          <article className="ff-mobile-application-scenario-card">
            <div className="ff-mobile-application-scenario-toggle">
              <button
                type="button"
                className={draft.scenarioKey === "A" ? "is-active" : undefined}
                onClick={() => draft.setScenarioKey("A")}
              >
                A. 전체
              </button>
              <button
                type="button"
                className={draft.scenarioKey === "B" ? "is-active" : undefined}
                onClick={() => draft.setScenarioKey("B")}
              >
                B. 부분
              </button>
            </div>

            <div className="ff-mobile-application-finance-rows">
              <div>
                <span>총 투자금</span>
                <strong>{formatCurrencyWonFromManwon(scenario?.investment_manwon)}</strong>
              </div>
              <div className="is-subsidy">
                <span>지원금</span>
                <strong>
                  {scenario?.subsidy_manwon == null
                    ? "공고참고"
                    : `+ ${formatCurrencyWonFromManwon(scenario.subsidy_manwon)}`}
                </strong>
              </div>
              <div className="is-net">
                <span>실부담금</span>
                <strong>{formatCurrencyWonFromManwon(netInvestment)}</strong>
              </div>
            </div>

            <div className="ff-mobile-application-payback-box">
              <Clock3 size={16} strokeWidth={2.1} aria-hidden="true" />
              <span>회수기간</span>
              <strong>{paybackText !== "-" ? paybackText : draft.paybackLabel}</strong>
            </div>

            {draft.generateError ? <p className="ff-mobile-application-error">{draft.generateError}</p> : null}
            {!draft.generateError && generatedAtLabel ? (
              <p style={{ margin: 0, color: "#0B7A53", fontSize: 12, fontWeight: 800 }}>
                신청서 초안을 갱신했습니다 ({generatedAtLabel})
              </p>
            ) : null}

            <button
              type="button"
              className="ff-mobile-application-primary-cta"
              disabled={draft.isGeneratingDraft || draft.data?.policy?.legacy_missing}
              onClick={() => void draft.handleGenerateDraft()}
            >
              {draft.isGeneratingDraft ? "신청서 생성 중..." : "신청서 생성 시작"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </article>

          <section className="ff-mobile-application-safety">
            <header>
              <span>안전개선 근거</span>
              <h2>현재 상태와 증빙 여부 판단</h2>
            </header>

            <div className="ff-mobile-application-safety-list">
              {safetyModel.viewpoints.length === 0 ? (
                <p className="ff-mobile-empty-inline">안전개선 항목이 없습니다.</p>
              ) : (
                safetyModel.viewpoints.map((viewpoint, index) => (
                  <article key={viewpoint.key} className="ff-mobile-application-safety-card">
                    <div className="ff-mobile-application-safety-top">
                      <div className="ff-mobile-application-safety-badges">
                        <span
                          className={`is-${
                            /정상|양호|충족/.test(viewpoint.judgement) ? "ok" : "need"
                          }`}
                        >
                          {viewpoint.judgement || "개선 필요"}
                        </span>
                        <span className="is-neutral">{viewpoint.evidenceStatus}</span>
                      </div>
                      <em>No. {index + 1}</em>
                    </div>
                    <h3>{viewpoint.title}</h3>
                    <p>{viewpoint.description}</p>
                    <button
                      type="button"
                      className="ff-mobile-application-evidence-link"
                      onClick={() => navigate(buildMobilePath("/mobile/safety", flowContext))}
                    >
                      증빙 관리
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <article className="ff-mobile-application-report-card">
            <span className="ff-mobile-application-report-badge">최종 PDF 미리보기</span>
            <h2>리포트 형식 생성</h2>
            <p>
              신청서 초안 리포트와 안전개선 근거 리포트를 미리 확인하거나 필요한 PDF만 선택해
              다운로드할 수 있습니다.
            </p>

            <div className="ff-mobile-application-report-sections">
              {MOBILE_PDF_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`ff-mobile-application-report-section${
                    selectedPdfSection === section.id ? " is-active" : ""
                  }`}
                  onClick={() => setSelectedPdfSection(section.id)}
                >
                  <strong>{section.id}</strong>
                  <span>{section.title}</span>
                  <em>{section.body}</em>
                </button>
              ))}
            </div>

            <div className="ff-mobile-application-report-actions">
              <button
                type="button"
                className="ff-mobile-application-report-preview"
                disabled={!draft.canUsePdf || Boolean(unavailablePdfReason)}
                onClick={() => void openMobilePreview()}
              >
                미리보기
              </button>
              <button
                type="button"
                className="ff-mobile-application-report-download"
                disabled={!draft.canUsePdf || Boolean(unavailablePdfReason)}
                onClick={() => setDownloadOpen(true)}
              >
                다운로드
              </button>
            </div>
            {downloadMessage ? <p className="ff-mobile-application-error">{downloadMessage}</p> : null}
            {unavailablePdfReason ? <p className="ff-mobile-application-error">{unavailablePdfReason}</p> : null}
          </article>

          {previewOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="PDF 미리보기"
              onClick={() => setPreviewOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1600,
                background: "rgba(15, 23, 42, 0.52)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(100%, 430px)",
                  height: "78vh",
                  background: "#fff",
                  borderRadius: "20px 20px 0 0",
                  display: "grid",
                  gridTemplateRows: "auto minmax(0, 1fr)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>PDF 미리보기</strong>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#344ba0",
                      fontWeight: 900,
                      fontSize: 13,
                    }}
                  >
                    닫기
                  </button>
                </div>
                <div style={{ minHeight: 0, padding: 10 }}>
                  {previewLoading ? <p>PDF 준비 중...</p> : null}
                  {!previewLoading && previewError ? (
                    <p className="ff-mobile-application-error">{previewError}</p>
                  ) : null}
                  {!previewLoading && !previewError && previewUrl ? (
                    <iframe
                      title={`${previewType}-preview`}
                      src={previewUrl}
                      style={{ width: "100%", height: "100%", border: 0, borderRadius: 10 }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {downloadOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="PDF 다운로드"
              onClick={() => setDownloadOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1600,
                background: "rgba(15, 23, 42, 0.52)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(100%, 430px)",
                  background: "#fff",
                  borderRadius: "20px",
                  marginBottom: 120,
                  padding: 14,
                  display: "grid",
                  gap: 10,
                }}
              >
                <strong style={{ fontSize: 14 }}>PDF 다운로드</strong>
                {MOBILE_REPORT_OPTIONS.map((option) => (
                  <label key={option.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={downloadSelection[option.key]}
                      onChange={(event) =>
                        setDownloadSelection((prev) => ({
                          ...prev,
                          [option.key]: event.target.checked,
                        }))
                      }
                    />
                    <span style={{ fontSize: 12 }}>{option.label}</span>
                  </label>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button type="button" className="ff-mobile-application-report-preview" onClick={() => setDownloadOpen(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="ff-mobile-application-report-download"
                    onClick={() => void handleDownloadSelected()}
                    disabled={downloading || !Object.values(downloadSelection).some(Boolean)}
                  >
                    {downloading ? "준비 중..." : "다운로드"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {policyPickerOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="추천 지원사업 변경"
              onClick={() => setPolicyPickerOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1600,
                background: "rgba(15, 23, 42, 0.52)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(100%, 430px)",
                  background: "#fff",
                  borderRadius: "20px",
                  marginBottom: 120,
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  maxHeight: "70vh",
                  overflowY: "auto",
                }}
              >
                <strong style={{ fontSize: 14 }}>추천 지원사업 변경</strong>
                {availablePolicies.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#667085" }}>
                    선택 가능한 추천 지원사업이 없습니다.
                  </p>
                ) : (
                  availablePolicies.map((policy) => {
                    const isActive = policy.policy_id === flowContext.policyId
                    return (
                      <button
                        key={policy.policy_id}
                        type="button"
                        onClick={() => handleSelectPolicy(policy.policy_id)}
                        style={{
                          textAlign: "left",
                          border: isActive ? "1px solid #061B34" : "1px solid #E2E8F0",
                          borderRadius: 12,
                          padding: "10px 12px",
                          background: isActive ? "#EEF3FF" : "#fff",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#0B1F3A" }}>
                          {policy.title}
                        </div>
                        {policy.organization ? (
                          <div style={{ fontSize: 11, color: "#667085", marginTop: 2 }}>
                            {policy.organization}
                          </div>
                        ) : null}
                      </button>
                    )
                  })
                )}
                <button
                  type="button"
                  onClick={() => setPolicyPickerOpen(false)}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#344ba0",
                    fontWeight: 900,
                    fontSize: 13,
                    justifySelf: "center",
                    padding: "8px 0",
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
