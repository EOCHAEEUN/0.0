import { useEffect, useMemo, useRef, useState } from "react"

import type { ApplicationDraftReportParams } from "../applicationDraft.contract"
import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"

type ReportType = "consumer_summary" | "application_evidence"

type DownloadOption = {
  key: ReportType
  label: string
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  { key: "consumer_summary", label: "한눈에 보는 분석 PDF" },
  { key: "application_evidence", label: "신청서 작성 초안 PDF" },
]

const FALLBACK_FILENAMES: Record<ReportType, string> = {
  consumer_summary: "FactoFit_분석결과_표중심.pdf",
  application_evidence: "FactoFit_신청서초안_그래프.pdf",
}

const PDF_PREVIEW_COPY = {
  badge: "PDF 확장 미리보기",
  title: "최종 PDF에 제출 참고 보고서 형식으로 생성됩니다",
  description:
    "신청서 초안 리포트와 안전개선 근거 리포트를 미리 확인하거나 필요한 PDF만 선택해 다운로드할 수 있습니다.",
  cards: [
    {
      no: "01",
      title: "사업 필요성",
      body: "노후 설비, 에너지 비용, 유지보수 부담, 품질 개선 필요성을 신청 배경으로 정리합니다.",
    },
    {
      no: "02",
      title: "추진 내용",
      body: "A안 전체교체 기준으로 설비 교체 방향, 도입 목적, 실행 계획을 보고서 문장으로 구성합니다.",
    },
    {
      no: "03",
      title: "기대효과",
      body: "에너지 비용 절감, 유지보수 비용 절감, 불량률 감소 효과를 중심으로 성과관리 기준까지 확장합니다.",
    },
  ],
} as const

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

async function requestApplicationReportPdf(
  params: ApplicationDraftReportParams,
  reportType: ReportType,
) {
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
  const serverFilename = parseContentDispositionFilename(
    response.headers.get("Content-Disposition"),
  )
  const filename =
    FALLBACK_FILENAMES[reportType] ||
    serverFilename ||
    "factofit_application_report.pdf"

  return { blob, filename }
}

export function ApplicationDraftPdfPreview({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const reportParams = model.reportParams
  const canGeneratePdf = model.canUsePdf && Boolean(reportParams)
  const isLoading = model.isLoading

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
    if (isLoading) return "신청서 화면 데이터를 불러오는 중입니다."
    if (!reportParams) return "분석·정책 정보가 준비되면 PDF 바로보기가 가능합니다."
    if (model.data?.policy?.legacy_missing) {
      return "정책 스냅샷 이력이 없어 PDF를 생성할 수 없습니다."
    }
    return ""
  }, [isLoading, model.data?.policy?.legacy_missing, reportParams])

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

  const ensurePreviewPdf = async (reportType: ReportType, options: { force?: boolean } = {}) => {
    if (!options.force && previewUrls[reportType]) return
    if (previewLoading[reportType]) return
    if (unavailableReason || !reportParams) {
      setPreviewErrors((prev) => ({
        ...prev,
        [reportType]: unavailableReason || "PDF 생성 정보가 부족합니다.",
      }))
      return
    }

    setPreviewErrors((prev) => ({ ...prev, [reportType]: "" }))
    setPreviewLoading((prev) => ({ ...prev, [reportType]: true }))
    try {
      const { blob } = await requestApplicationReportPdf(reportParams, reportType)
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
    await ensurePreviewPdf("consumer_summary", { force: true })
  }

  const selectedDownloadCount = Object.values(downloadSelection).filter(Boolean).length

  const downloadSelectedPdfs = async () => {
    if (downloading || selectedDownloadCount === 0 || !reportParams) return
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
        const { blob, filename } = await requestApplicationReportPdf(
          reportParams,
          option.key,
        )
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

    if (succeeded.length > 0 && failed.length === 0) {
      setDownloadFeedback(`PDF ${succeeded.length}개 다운로드를 요청했습니다.`)
    } else if (succeeded.length > 0 && failed.length > 0) {
      setDownloadFeedback(
        `PDF ${succeeded.length}개 다운로드를 요청했습니다. ${failed.length}개 파일은 생성하지 못했습니다. (${failed.join(" | ")})`,
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
            <span className="ff-mini-label">{PDF_PREVIEW_COPY.badge}</span>
            <h4>{PDF_PREVIEW_COPY.title}</h4>
          </div>
          <p>{PDF_PREVIEW_COPY.description}</p>
        </div>

        <div className="ff-pdf-expand-grid">
          {PDF_PREVIEW_COPY.cards.map((card) => (
            <article key={card.no}>
              <span>{card.no}</span>
              <h5>{card.title}</h5>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="ff-final-actions">
        <button
          className="ff-pdf-action-button outline"
          type="button"
          disabled={!canGeneratePdf}
          onClick={() => void openPreview()}
        >
          PDF 바로보기
        </button>
        <button
          className="ff-pdf-action-button primary"
          type="button"
          disabled={!canGeneratePdf || isLoading}
          onClick={() => setDownloadDialogOpen(true)}
        >
          PDF 다운로드 ▾
        </button>
      </div>

      {downloadFeedback && (
        <div
          className={
            downloadFeedback.includes("실패")
              ? "ff-draft-alert warning"
              : "ff-draft-alert success"
          }
        >
          {downloadFeedback}
        </div>
      )}

      {!canGeneratePdf && unavailableReason && (
        <div className="ff-draft-alert warning">{unavailableReason}</div>
      )}

      {previewOpen && (
        <div
          className="ff-pdf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="PDF 바로보기"
        >
          <div className="ff-pdf-modal">
            <div className="ff-pdf-modal-head">
              <h4>PDF 바로보기</h4>
              <button
                type="button"
                className="ff-support-btn ghost"
                onClick={() => setPreviewOpen(false)}
              >
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
              {!previewLoading[previewTab] &&
                (previewErrors[previewTab] || unavailableReason) && (
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
        <div
          className="ff-pdf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="PDF 다운로드"
        >
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
