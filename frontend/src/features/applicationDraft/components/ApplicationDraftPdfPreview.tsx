import type { DraftStatus } from "../applicationDraft.contract"
import type { ApplicationDraftModel } from "../hooks/useApplicationDraft"
import {
  formatManwon,
  formatMonthlyPayback,
} from "../applicationDraft.utils"

type PdfDraftSource = {
  company_name?: string | null
  equipment_name?: string | null
  selected_policy?: string | null
  agency?: string | null
  organization?: string | null
  scenario_label?: string | null
  application_purpose?: string | null
  investment_manwon?: number | string | null
  subsidy_manwon?: number | string | null
  payback_months?: number | string | null
  business_necessity?: string | null
  expected_effects?: string | null
  expected_benefits?: string[] | null
  ai_reasons?: string[] | null
  required_documents?: string[] | null
}

type PdfData = {
  companyName: string
  equipmentName: string
  selectedPolicy: string
  selectedAgency: string
  scenarioLabel: string
  applicationPurpose: string
  investmentManwon: number | null
  subsidyManwon: number | null
  paybackMonths: number | null
  businessNecessity: string
  expectedEffects: string
  expectedBenefits: string[]
  aiReasons: string[]
  requiredDocuments: string[]
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => String(item).trim()).filter(Boolean)
}

function listHtml(items: string[]) {
  if (!items.length) {
    return `<li>DB 초안 생성 후 표시됩니다.</li>`
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
}

function getApiDraft(model: ApplicationDraftModel): PdfDraftSource {
  const analysisData = asRecord(model.analysisData)
  const draftApiData = asRecord(analysisData.draft_api_data)
  const draftResult = asRecord(draftApiData.draft_result)

  return draftResult as PdfDraftSource
}

function hasReadyDraftApiData(model: ApplicationDraftModel): boolean {
  const analysisData = asRecord(model.analysisData)
  const draftApiData = asRecord(analysisData.draft_api_data)
  const draftResult = asRecord(draftApiData.draft_result)

  return (
    Object.keys(draftResult).length > 0 &&
    Boolean(readText(draftResult.company_name)) &&
    Boolean(readText(draftResult.equipment_name)) &&
    Boolean(readText(draftResult.selected_policy))
  )
}

function getPdfData(model: ApplicationDraftModel): PdfData {
  const apiDraft = getApiDraft(model)

  const expectedBenefitsFromApi = readStringList(apiDraft.expected_benefits)
  const aiReasonsFromApi = readStringList(apiDraft.ai_reasons)
  const requiredDocumentsFromApi = readStringList(apiDraft.required_documents)

  return {
    companyName:
      readText(apiDraft.company_name) ||
      model.companyName ||
      "기업명 미확인",

    equipmentName:
      readText(apiDraft.equipment_name) ||
      model.equipmentName ||
      "설비명 미확인",

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
      readText(apiDraft.scenario_label) ||
      model.scenarioLabel ||
      "시나리오 미확인",

    applicationPurpose:
      readText(apiDraft.application_purpose) ||
      model.applicationPurpose ||
      "신청 목적 정보 없음",

    investmentManwon:
      readNumber(apiDraft.investment_manwon) ??
      model.investmentManwon ??
      null,

    subsidyManwon:
      readNumber(apiDraft.subsidy_manwon) ??
      model.subsidyManwon ??
      null,

    paybackMonths:
      readNumber(apiDraft.payback_months) ??
      model.paybackMonths ??
      null,

    businessNecessity:
      readText(apiDraft.business_necessity) ||
      model.businessNecessity ||
      "사업 필요성 정보 없음",

    expectedEffects:
      readText(apiDraft.expected_effects) ||
      model.expectedEffects ||
      "기대효과 정보 없음",

    expectedBenefits:
      expectedBenefitsFromApi.length > 0
        ? expectedBenefitsFromApi
        : model.expectedBenefits,

    aiReasons:
      aiReasonsFromApi.length > 0 ? aiReasonsFromApi : model.aiReasons,

    requiredDocuments:
      requiredDocumentsFromApi.length > 0
        ? requiredDocumentsFromApi
        : model.requiredDocuments,
  }
}

function buildPdfHtml(model: ApplicationDraftModel) {
  const generatedAt = new Date().toLocaleString("ko-KR")
  const pdf = getPdfData(model)

  return `
    <div style="
      width: 794px;
      min-height: 1123px;
      box-sizing: border-box;
      padding: 48px;
      background: #ffffff;
      color: #061B34;
      font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', Arial, sans-serif;
    ">
      <div style="border-bottom: 3px solid #344BA0; padding-bottom: 20px; margin-bottom: 28px;">
        <div style="font-size: 13px; font-weight: 900; color: #344BA0; letter-spacing: .08em;">
          FACTOFIT APPLICATION DRAFT
        </div>
        <h1 style="font-size: 30px; line-height: 1.35; margin: 12px 0 0; font-weight: 950;">
          지원사업 신청서 초안
        </h1>
        <p style="font-size: 13px; color: #667085; margin: 10px 0 0; font-weight: 700;">
          생성일시: ${escapeHtml(generatedAt)}
        </p>
      </div>

      <section style="margin-bottom: 26px;">
        <h2 style="font-size: 18px; margin: 0 0 14px; font-weight: 950;">1. 기본 정보</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tbody>
            <tr>
              <th style="width: 150px; text-align: left; padding: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">기업명</th>
              <td style="padding: 12px; border: 1px solid #E2E8F0;">${escapeHtml(pdf.companyName)}</td>
            </tr>
            <tr>
              <th style="text-align: left; padding: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">대상 설비</th>
              <td style="padding: 12px; border: 1px solid #E2E8F0;">${escapeHtml(pdf.equipmentName)}</td>
            </tr>
            <tr>
              <th style="text-align: left; padding: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">추천 지원사업</th>
              <td style="padding: 12px; border: 1px solid #E2E8F0;">${escapeHtml(pdf.selectedPolicy)}</td>
            </tr>
            <tr>
              <th style="text-align: left; padding: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">주관사</th>
              <td style="padding: 12px; border: 1px solid #E2E8F0;">${escapeHtml(pdf.selectedAgency)}</td>
            </tr>
            <tr>
              <th style="text-align: left; padding: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">선택 시나리오</th>
              <td style="padding: 12px; border: 1px solid #E2E8F0;">${escapeHtml(pdf.scenarioLabel)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style="margin-bottom: 26px;">
        <h2 style="font-size: 18px; margin: 0 0 14px; font-weight: 950;">2. 투자 및 ROI 요약</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
          <div style="border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; background: #F8FAFC;">
            <div style="font-size: 12px; color: #667085; font-weight: 900;">총 투자금</div>
            <strong style="display: block; margin-top: 8px; font-size: 22px; color: #344BA0;">${escapeHtml(formatManwon(pdf.investmentManwon))}</strong>
          </div>
          <div style="border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; background: #F8FAFC;">
            <div style="font-size: 12px; color: #667085; font-weight: 900;">예상 지원금</div>
            <strong style="display: block; margin-top: 8px; font-size: 22px; color: #344BA0;">${escapeHtml(formatManwon(pdf.subsidyManwon))}</strong>
          </div>
          <div style="border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; background: #F8FAFC;">
            <div style="font-size: 12px; color: #667085; font-weight: 900;">예상 회수기간</div>
            <strong style="display: block; margin-top: 8px; font-size: 22px; color: #344BA0;">${escapeHtml(formatMonthlyPayback(pdf.paybackMonths))}</strong>
          </div>
        </div>
      </section>

      <section style="margin-bottom: 26px;">
        <h2 style="font-size: 18px; margin: 0 0 14px; font-weight: 950;">3. 신청 목적</h2>
        <p style="font-size: 14px; line-height: 1.8; margin: 0; padding: 18px; border: 1px solid #E2E8F0; border-radius: 16px;">
          ${escapeHtml(pdf.applicationPurpose)}
        </p>
      </section>

      <section style="margin-bottom: 26px;">
        <h2 style="font-size: 18px; margin: 0 0 14px; font-weight: 950;">4. 사업 필요성</h2>
        <p style="font-size: 14px; line-height: 1.8; margin: 0; padding: 18px; border: 1px solid #E2E8F0; border-radius: 16px;">
          ${escapeHtml(pdf.businessNecessity)}
        </p>
      </section>

      <section style="margin-bottom: 26px;">
        <h2 style="font-size: 18px; margin: 0 0 14px; font-weight: 950;">5. 기대효과</h2>
        <p style="font-size: 14px; line-height: 1.8; margin: 0 0 12px; padding: 18px; border: 1px solid #E2E8F0; border-radius: 16px;">
          ${escapeHtml(pdf.expectedEffects)}
        </p>
        <ul style="font-size: 14px; line-height: 1.8; margin: 0; padding-left: 22px;">
          ${listHtml(pdf.expectedBenefits)}
        </ul>
      </section>

      <section style="margin-bottom: 26px;">
        <h2 style="font-size: 18px; margin: 0 0 14px; font-weight: 950;">6. AI 작성 근거</h2>
        <ul style="font-size: 14px; line-height: 1.8; margin: 0; padding-left: 22px;">
          ${listHtml(pdf.aiReasons)}
        </ul>
      </section>

      <section>
        <h2 style="font-size: 18px; margin: 0 0 14px; font-weight: 950;">7. 제출 전 확인 서류</h2>
        <ul style="font-size: 14px; line-height: 1.8; margin: 0; padding-left: 22px;">
          ${listHtml(pdf.requiredDocuments)}
        </ul>
      </section>

      <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; line-height: 1.6;">
        본 문서는 FactoFit이 DB에 저장된 기업정보, 설비정보, ROI 분석 결과, 추천 지원사업 정보를 바탕으로 생성한 신청서 초안입니다.
        실제 제출 전에는 공고 원문과 제출기관의 요구 양식을 반드시 확인해야 합니다.
      </div>
    </div>
  `
}

async function downloadDraftPdf(model: ApplicationDraftModel) {
  const html2pdfModule = await import("html2pdf.js")
  const html2pdf = html2pdfModule.default
  const pdf = getPdfData(model)

  const element = document.createElement("div")
  element.innerHTML = buildPdfHtml(model)
  element.style.position = "fixed"
  element.style.left = "-99999px"
  element.style.top = "0"
  element.style.zIndex = "-1"

  document.body.appendChild(element)
  const pdfElement = element.firstElementChild

  const fileCompany = pdf.companyName || "기업"
  const filePolicy = pdf.selectedPolicy || "신청서초안"
  const filename = `FactoFit_${fileCompany}_${filePolicy}_신청서초안.pdf`
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 120)

  try {
    if (!pdfElement) {
      throw new Error("PDF 생성 대상 요소를 찾을 수 없습니다.")
    }

    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: "#ffffff",
        },
        jsPDF: {
          unit: "px",
          format: [794, 1123],
          orientation: "portrait",
        },
        pagebreak: {
          mode: ["avoid-all", "css", "legacy"],
        },
      } as any)
      .from(pdfElement as HTMLElement)
      .save()
  } finally {
    document.body.removeChild(element)
  }
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
  const pdf = getPdfData(model)
  const hasDraftApiData = hasReadyDraftApiData(model)
  const isLoading = Boolean(model.analysisData?.isLoading)
  const canDownload =
    draftStatus !== "idle" &&
    hasDraftApiData &&
    !isLoading

  const handleDownload = async () => {
    if (!canDownload) {
      window.alert("신청서 초안 데이터가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.")
      return
    }

    console.log("PDF MODEL CHECK", {
      companyName: pdf.companyName,
      equipmentName: pdf.equipmentName,
      selectedPolicy: pdf.selectedPolicy,
      investmentManwon: pdf.investmentManwon,
      subsidyManwon: pdf.subsidyManwon,
      paybackMonths: pdf.paybackMonths,
      apiData: model.analysisData?.draft_api_data,
    })

    try {
      await downloadDraftPdf(model)
      onPrepareDownload()
    } catch (error) {
      console.error("PDF 다운로드 실패:", error)
      window.alert("PDF 생성 중 오류가 발생했습니다. 콘솔을 확인해주세요.")
    }
  }

  return (
    <section className="ff-card ff-final-preview-section">
      <div className="ff-pdf-expand-preview">
        <div className="ff-pdf-expand-head">
          <div>
            <span className="ff-mini-label">PDF 확장 미리보기</span>
            <h4>최종 PDF에서는 이렇게 확장됩니다.</h4>
          </div>
          <p>
            현재 DB에 저장된 기업정보, 설비현황, ROI 분석 결과, 신청서 초안을
            바탕으로 제출 참고용 문서 구조로 정리합니다.
          </p>
        </div>

        <div className="ff-pdf-expand-grid">
          <article>
            <span>01</span>
            <h5>사업 필요성</h5>
            <p>
              {pdf.businessNecessity ||
                "DB에 저장된 신청서 초안의 사업 필요성을 정리합니다."}
            </p>
          </article>

          <article>
            <span>02</span>
            <h5>추진 내용</h5>
            <p>
              {pdf.scenarioLabel || scenarioLabel} 기준으로 설비 교체 방향,
              도입 목적, 실행 계획을 신청서 문장으로 구성합니다.
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
          신청서 초안이 DB에 저장되었습니다. PDF 다운로드를 진행할 수 있습니다.
        </div>
      )}

      {draftStatus === "saved" && !hasDraftApiData && (
        <div className="ff-draft-alert warning">
          신청서 초안 데이터를 불러오는 중입니다. 잠시 후 PDF 다운로드를 진행해주세요.
        </div>
      )}

      {draftStatus === "downloadReady" && (
        <div className="ff-draft-alert success">
          PDF 다운로드가 완료되었습니다. 필요한 경우 초안을 다시 수정한 뒤 재다운로드할 수 있습니다.
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
