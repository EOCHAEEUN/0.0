import { useEffect, useMemo, useRef, useState } from "react"
import type { DraftStatus } from "../applicationDraft.contract"
import type { ApplicationDraftModel } from "../hooks/useApplicationDraft"

type PdfDraftSource = {
  company_name?: string | null
  equipment_name?: string | null
  selected_policy?: string | null
  agency?: string | null
  organization?: string | null
  scenario_label?: string | null
  business_necessity?: string | null
  expected_benefits?: string[] | null
}

type PdfPreviewData = {
  companyName: string
  equipmentName: string
  selectedPolicy: string
  selectedAgency: string
  scenarioLabel: string
  businessNecessity: string
  expectedBenefits: string[]
}

type ReportParams = {
  companyId: string
  equipmentId: string
  policyId: string
  analysisId?: string
}

const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:8000/api"
).replace(/\/$/, "")

function buildApiUrl(path: string) {
  if (API_BASE_URL.endsWith("/api")) {
    return `${API_BASE_URL}${path.replace(/^\/api/, "")}`
  }

  return `${API_BASE_URL}${path}`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => String(item).trim()).filter(Boolean)
}

function readLocalStorage(key: string): string {
  try {
    return window.localStorage.getItem(key)?.trim() ?? ""
  } catch {
    return ""
  }
}

function getToken() {
  return (
    readLocalStorage("factofit_access_token") ||
    readLocalStorage("access_token") ||
    readLocalStorage("token")
  )
}

function getApiDraft(model: ApplicationDraftModel): PdfDraftSource {
  const analysisData = asRecord(model.analysisData)
  const draftApiData = asRecord(analysisData.draft_api_data)
  const draftResult = asRecord(draftApiData.draft_result)

  return draftResult as PdfDraftSource
}

function getReportParams(model: ApplicationDraftModel): ReportParams | null {
  const analysisData = asRecord(model.analysisData)
  const draftParams = asRecord(analysisData.draft_params)
  const draftApiData = asRecord(analysisData.draft_api_data)

  const responseAnalysisId = readText(draftApiData.analysis_id)
  const usesSnapshot = Boolean(responseAnalysisId)
  const companyId =
    (usesSnapshot ? readText(draftApiData.company_id) : "") ||
    readText(draftParams.companyId) ||
    readText(draftApiData.company_id)
  const equipmentId =
    (usesSnapshot ? readText(draftApiData.equipment_id) : "") ||
    readText(draftParams.equipmentId) ||
    readText(draftApiData.equipment_id)
  const policyId =
    (usesSnapshot ? readText(draftApiData.policy_id) : "") ||
    readText(draftParams.policyId) ||
    readText(draftApiData.policy_id)
  const analysisId =
    responseAnalysisId || readText(draftParams.analysisId)

  if (!companyId || !equipmentId || !policyId) return null

  return { companyId, equipmentId, policyId, analysisId: analysisId || undefined }
}

function hasReadyDraftApiData(model: ApplicationDraftModel): boolean {
  return Boolean(getReportParams(model))
}

function getPdfPreviewData(model: ApplicationDraftModel): PdfPreviewData {
  const apiDraft = getApiDraft(model)
  const expectedBenefitsFromApi = readStringList(apiDraft.expected_benefits)

  return {
    companyName: readText(apiDraft.company_name) || model.companyName || "기업명 미확인",
    equipmentName:
      readText(apiDraft.equipment_name) || model.equipmentName || "설비명 미확인",
    selectedPolicy:
      readText(apiDraft.selected_policy) ||
      model.selectedPolicy ||
      "추천 지원사업 미확인",
    selectedAgency:
      readText(apiDraft.agency) ||
      readText(apiDraft.organization) ||
      model.selectedAgency ||
      "주관기관 정보 없음",
    scenarioLabel:
      readText(apiDraft.scenario_label) || model.scenarioLabel || "시나리오 미확인",
    businessNecessity:
      readText(apiDraft.business_necessity) ||
      model.businessNecessity ||
      "DB에 저장된 신청서 초안의 사업 필요성을 정리합니다.",
    expectedBenefits:
      expectedBenefitsFromApi.length > 0
        ? expectedBenefitsFromApi
        : model.expectedBenefits,
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

async function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = "none"

  document.body.appendChild(anchor)
  anchor.click()

  await new Promise((resolve) => window.setTimeout(resolve, 420))

  document.body.removeChild(anchor)
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl)
  }, 1500)
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json()
    const detail = payload?.detail

    if (typeof detail === "string" && detail.trim()) return detail
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message
    }
  } catch {
    const text = await response.text().catch(() => "")
    if (text.trim()) return text
  }

  return "PDF 생성 중 오류가 발생했습니다."
}

type ReportType = "consumer_summary" | "application_evidence"

type ReportRequestResult = {
  blob: Blob
  filename: string
}

type DownloadOption = {
  key: ReportType
  label: string
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  { key: "consumer_summary", label: "표 중심 분석 PDF" },
  { key: "application_evidence", label: "계획서 초안 PDF" },
]

const FALLBACK_FILENAMES: Record<ReportType, string> = {
  consumer_summary: "FactoFit_분석결과_표중심.pdf",
  application_evidence: "FactoFit_신청서초안.pdf",
}

async function requestApplicationReportPdf(
  model: ApplicationDraftModel,
  reportType: ReportType,
): Promise<ReportRequestResult> {
  const params = getReportParams(model)
  if (!params) {
    throw new Error("PDF 생성에 필요한 company_id, equipment_id, policy_id가 없습니다.")
  }

  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const endpoint =
    reportType === "consumer_summary"
      ? "/api/reports/consumer-summary.pdf"
      : "/api/reports/application-evidence.pdf"

  const response = await fetch(buildApiUrl(endpoint), {
    method: "POST",
    headers,
    body: JSON.stringify({
      company_id: params.companyId,
      equipment_id: params.equipmentId,
      policy_id: params.policyId,
      analysis_id: params.analysisId,
      report_type: reportType,
      tone: "submission",
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const blob = await response.blob()
  const serverFilename = parseContentDispositionFilename(
    response.headers.get("Content-Disposition"),
  )
  const filename = FALLBACK_FILENAMES[reportType] || serverFilename || "factofit_application_report.pdf"

  return { blob, filename }
}

export function ApplicationDraftPdfPreview({
  model,
  draftStatus,
  onPrepareDownload,
}: {
  model: ApplicationDraftModel
  draftStatus: DraftStatus
  onPrepareDownload: () => void
}) {
  const pdf = getPdfPreviewData(model)
  const hasDraftApiData = hasReadyDraftApiData(model)
  const isLoading = Boolean(model.analysisData?.isLoading)
  const canGeneratePdf = draftStatus !== "idle" && hasDraftApiData && !isLoading
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState<ReportType>("consumer_summary")
  const [previewLoading, setPreviewLoading] = useState<Record<ReportType, boolean>>({
    consumer_summary: false,
    application_evidence: false,
  })
  const [previewErrors, setPreviewErrors] = useState<Record<ReportType, string>>({
    consumer_summary: "",
    application_evidence: "",
  })
  const [previewUrls, setPreviewUrls] = useState<Record<ReportType, string>>({
    consumer_summary: "",
    application_evidence: "",
  })
  const previewUrlsRef = useRef(previewUrls)

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloadSelection, setDownloadSelection] = useState<Record<ReportType, boolean>>({
    consumer_summary: true,
    application_evidence: true,
  })
  const [downloading, setDownloading] = useState(false)
  const [downloadFeedback, setDownloadFeedback] = useState("")

  const unavailableReason = useMemo(() => {
    if (isLoading) return "신청서 초안을 생성 중입니다. 잠시 후 다시 시도해주세요."
    if (!hasDraftApiData) return "정책 선택 후 PDF 바로보기가 가능합니다."
    if (draftStatus === "idle") {
      return (
        readText(model.analysisData?.errorMessage) ||
        "신청서 초안 생성 후 PDF 바로보기가 가능합니다."
      )
    }
    return ""
  }, [draftStatus, hasDraftApiData, isLoading, model.analysisData?.errorMessage])

  useEffect(() => {
    previewUrlsRef.current = previewUrls
  }, [previewUrls])

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        if (url) window.URL.revokeObjectURL(url)
      })
    }
  }, [])

  const ensurePreviewPdf = async (reportType: ReportType) => {
    if (previewUrls[reportType] || previewLoading[reportType]) return
    if (unavailableReason) {
      setPreviewErrors((prev) => ({ ...prev, [reportType]: unavailableReason }))
      return
    }

    setPreviewErrors((prev) => ({ ...prev, [reportType]: "" }))
    setPreviewLoading((prev) => ({ ...prev, [reportType]: true }))
    try {
      const { blob } = await requestApplicationReportPdf(model, reportType)
      const nextUrl = window.URL.createObjectURL(blob)
      setPreviewUrls((prev) => {
        if (prev[reportType]) {
          window.URL.revokeObjectURL(prev[reportType])
        }
        return { ...prev, [reportType]: nextUrl }
      })
    } catch (error) {
      setPreviewErrors((prev) => ({
        ...prev,
        [reportType]:
          error instanceof Error ? error.message : "PDF 바로보기를 준비하지 못했습니다.",
      }))
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [reportType]: false }))
    }
  }

  const openPreview = async () => {
    setPreviewOpen(true)
    setPreviewTab("consumer_summary")
    await ensurePreviewPdf("consumer_summary")
  }

  const selectedDownloadCount = Object.values(downloadSelection).filter(Boolean).length

  const downloadSelectedPdfs = async () => {
    if (downloading || selectedDownloadCount === 0) return
    setDownloading(true)
    setDownloadFeedback("")

    const failed: string[] = []
    const succeeded: string[] = []
    const selectedItems = DOWNLOAD_OPTIONS.filter((option) => downloadSelection[option.key])
    for (const option of DOWNLOAD_OPTIONS) {
      if (!downloadSelection[option.key]) continue
      if (unavailableReason) {
        failed.push(`${option.label}: ${unavailableReason}`)
        continue
      }
      try {
        const { blob, filename } = await requestApplicationReportPdf(model, option.key)
        await triggerBrowserDownload(blob, filename)
        succeeded.push(option.label)
        if (selectedItems.length > 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 420))
        }
      } catch (error) {
        failed.push(
          `${option.label}: ${error instanceof Error ? error.message : "PDF 생성 중 오류가 발생했습니다."}`,
        )
      }
    }

    if (succeeded.length > 0) {
      onPrepareDownload()
    }

    if (succeeded.length > 0 && failed.length === 0) {
      setDownloadFeedback(`PDF ${succeeded.length}개 다운로드를 요청했습니다.`)
    } else if (succeeded.length > 0 && failed.length > 0) {
      setDownloadFeedback(
        `PDF ${succeeded.length}개 다운로드를 요청했습니다. ${failed.length}개 파일은 생성하지 못했습니다. (${failed.join(" | ")}) 브라우저에서 이 사이트의 여러 파일 다운로드 허용 여부도 확인해주세요.`,
      )
    } else if (failed.length > 0) {
      setDownloadFeedback(`다운로드 실패: ${failed.join(" | ")}`)
    }

    setDownloading(false)
    setDownloadDialogOpen(false)
  }

  return (
    <section className="ff-card ff-final-preview-section">
      <div className="ff-pdf-expand-preview">
        <div className="ff-pdf-expand-head">
          <div>
            <span className="ff-mini-label">PDF 확장 바로보기</span>
            <h4>최종 PDF에 제출 참고 보고서 형식으로 생성됩니다</h4>
          </div>
          <p>
            현재 DB에 저장된 기업정보, 설비현황, ROI 분석 결과, 신청서 초안을 바탕으로
            application report 형식의 PDF를 생성합니다.
          </p>
        </div>

        <div className="ff-pdf-expand-grid">
          <article>
            <span>01</span>
            <h5>사업 필요성</h5>
            <p>{pdf.businessNecessity}</p>
          </article>

          <article>
            <span>02</span>
            <h5>추진 내용</h5>
            <p>
              {pdf.scenarioLabel} 기준으로 {pdf.equipmentName} 설비
              개선 방향, 도입 목적, 실행 계획을 보고서 문장으로 구성합니다.
            </p>
          </article>

          <article>
            <span>03</span>
            <h5>기대 효과</h5>
            <p>
              {pdf.expectedBenefits.length > 0
                ? `${pdf.expectedBenefits.slice(0, 3).join(", ")} 효과를 중심으로 성과관리 기준까지 확장합니다.`
                : "DB에 저장된 신청서 초안의 기대 효과를 PDF에 반영합니다."}
            </p>
          </article>
        </div>
      </div>

      <div className="ff-final-actions">
        <button
          className="ff-pdf-action-button outline"
          type="button"
          onClick={() => void openPreview()}
        >
          PDF 바로보기
        </button>
        <button
          className="ff-pdf-action-button primary"
          type="button"
          disabled={isLoading}
          onClick={() => setDownloadDialogOpen(true)}
        >
          PDF 다운로드 ▾
        </button>
      </div>

      {downloadFeedback && (
        <div className={downloadFeedback.includes("실패") ? "ff-draft-alert warning" : "ff-draft-alert success"}>
          {downloadFeedback}
        </div>
      )}

      {!canGeneratePdf && (
        <div className="ff-draft-alert warning">
          {unavailableReason || "신청서 초안 생성이 완료되면 PDF를 준비할 수 있습니다."}
        </div>
      )}

      {previewOpen && (
        <div className="ff-pdf-modal-backdrop" role="dialog" aria-modal="true" aria-label="PDF 바로보기">
          <div className="ff-pdf-modal">
            <div className="ff-pdf-modal-head">
              <h4>PDF 바로보기</h4>
              <button type="button" className="ff-support-btn ghost" onClick={() => setPreviewOpen(false)}>
                닫기
              </button>
            </div>
            <div className="ff-pdf-preview-tabs" role="tablist" aria-label="PDF 종류">
              {DOWNLOAD_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`ff-pdf-tab ${previewTab === option.key ? "active" : ""}`}
                  role="tab"
                  aria-selected={previewTab === option.key}
                  onClick={() => {
                    setPreviewTab(option.key)
                    void ensurePreviewPdf(option.key)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="ff-pdf-preview-body">
              {previewLoading[previewTab] && <p>PDF 준비 중...</p>}
              {!previewLoading[previewTab] && (previewErrors[previewTab] || unavailableReason) && (
                <div className="ff-draft-alert warning">
                  {previewErrors[previewTab] || unavailableReason}
                </div>
              )}
              {!previewLoading[previewTab] &&
                !previewErrors[previewTab] &&
                !unavailableReason &&
                previewUrls[previewTab] && (
                  <iframe
                    title={`${previewTab}-preview`}
                    src={previewUrls[previewTab]}
                    className="ff-pdf-preview-iframe"
                  />
                )}
            </div>
          </div>
        </div>
      )}

      {downloadDialogOpen && (
        <div className="ff-pdf-modal-backdrop" role="dialog" aria-modal="true" aria-label="PDF 다운로드">
          <div className="ff-pdf-download-dialog">
            <h4>PDF 다운로드</h4>
            <p>필요한 문서를 선택해 한 번에 다운로드할 수 있습니다.</p>
            <div className="ff-pdf-download-options">
              {DOWNLOAD_OPTIONS.map((option) => (
                <label key={option.key} className="ff-pdf-download-option">
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
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <div className="ff-pdf-download-actions">
              <button
                type="button"
                className="ff-support-btn ghost"
                onClick={() => setDownloadDialogOpen(false)}
                disabled={downloading}
              >
                취소
              </button>
              <button
                type="button"
                className="btn blue"
                disabled={selectedDownloadCount === 0 || downloading}
                onClick={() => void downloadSelectedPdfs()}
              >
                {downloading ? "PDF 준비 중..." : "선택한 PDF 다운로드"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
