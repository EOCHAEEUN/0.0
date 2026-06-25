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

  const companyId =
    readText(draftParams.companyId) || readText(draftApiData.company_id)
  const equipmentId =
    readText(draftParams.equipmentId) || readText(draftApiData.equipment_id)
  const policyId =
    readText(draftParams.policyId) || readText(draftApiData.policy_id)

  if (!companyId || !equipmentId || !policyId) return null

  return { companyId, equipmentId, policyId }
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
      "주관사 정보 없음",
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

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
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

async function downloadApplicationReportPdf(model: ApplicationDraftModel) {
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

  const response = await fetch(buildApiUrl("/api/reports/application.pdf"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      company_id: params.companyId,
      equipment_id: params.equipmentId,
      policy_id: params.policyId,
      tone: "submission",
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const blob = await response.blob()
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ||
    "factofit_application_report.pdf"

  saveBlob(blob, filename)
}

export function ApplicationDraftPdfPreview({
  model,
  scenarioLabel,
  expectedBenefits,
  draftStatus,
  onSaveDraft,
  onPrepareDownload,
  onGoSupportProjects,
}: {
  model: ApplicationDraftModel
  scenarioLabel: string
  expectedBenefits: string[]
  draftStatus: DraftStatus
  onSaveDraft: () => void
  onPrepareDownload: () => void
  onGoSupportProjects: () => void
}) {
  const pdf = getPdfPreviewData(model)
  const hasDraftApiData = hasReadyDraftApiData(model)
  const isLoading = Boolean(model.analysisData?.isLoading)
  const canDownload = draftStatus !== "idle" && hasDraftApiData && !isLoading

  const handleDownload = async () => {
    if (!canDownload) {
      window.alert("PDF 생성에 필요한 데이터가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.")
      return
    }

    try {
      await downloadApplicationReportPdf(model)
      onPrepareDownload()
    } catch (error) {
      console.error("PDF 다운로드 실패:", error)
      window.alert(
        error instanceof Error
          ? error.message
          : "PDF 생성 중 오류가 발생했습니다. 콘솔을 확인해주세요.",
      )
    }
  }

  return (
    <section className="ff-card ff-final-preview-section">
      <div className="ff-pdf-expand-preview">
        <div className="ff-pdf-expand-head">
          <div>
            <span className="ff-mini-label">PDF 확장 미리보기</span>
            <h4>최종 PDF는 제출 참고 보고서 형식으로 생성됩니다.</h4>
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
              {pdf.scenarioLabel || scenarioLabel} 기준으로 {pdf.equipmentName} 설비
              개선 방향, 도입 목적, 실행 계획을 보고서 문장으로 구성합니다.
            </p>
          </article>

          <article>
            <span>03</span>
            <h5>기대효과</h5>
            <p>
              {pdf.expectedBenefits.length > 0
                ? `${pdf.expectedBenefits.slice(0, 3).join(", ")} 효과를 중심으로 성과관리 기준까지 확장합니다.`
                : expectedBenefits.length > 0
                  ? `${expectedBenefits.slice(0, 3).join(", ")} 효과를 중심으로 성과관리 기준까지 확장합니다.`
                  : "DB에 저장된 신청서 초안의 기대효과를 PDF에 반영합니다."}
            </p>
          </article>
        </div>
      </div>

      <div className="ff-draft-actions ff-final-actions">
        <button className="blue" type="button" onClick={onSaveDraft}>
          초안 저장하기
        </button>

        <button
          className="dark"
          type="button"
          disabled={!canDownload}
          onClick={handleDownload}
        >
          {canDownload ? "PDF 다운로드" : "PDF 준비 중"}
        </button>

        <button className="green" type="button" onClick={onGoSupportProjects}>
          지원사업 목록 보기
        </button>
      </div>

      {draftStatus === "saved" && hasDraftApiData && (
        <div className="ff-draft-alert success">
          초안이 DB에 저장되었습니다. 정식 application report 형식으로 PDF를 다운로드할 수 있습니다.
        </div>
      )}

      {draftStatus === "saved" && !hasDraftApiData && (
        <div className="ff-draft-alert warning">
          PDF 생성에 필요한 식별자를 불러오는 중입니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {draftStatus === "downloadReady" && (
        <div className="ff-draft-alert success">
          PDF 다운로드가 완료되었습니다. 동일한 버튼으로 최신 DB 기준 보고서를 다시 받을 수 있습니다.
        </div>
      )}

      {draftStatus === "idle" && (
        <div className="ff-draft-alert warning">
          신청서 초안 생성이 완료되면 PDF 다운로드를 진행할 수 있습니다.
        </div>
      )}
    </section>
  )
}
