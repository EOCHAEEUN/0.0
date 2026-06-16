import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

type DraftStatus = "idle" | "saved" | "downloadReady"

type ChecklistItem = {
  label: string
  status: "완료" | "확인 필요"
  tone: "ok" | "need"
}

type DraftResult = {
  company_name?: string | null
  equipment_name?: string | null
  selected_policy?: string | null
  application_purpose?: string | null
  investment_manwon?: number | null
  subsidy_manwon?: number | null
  payback_months?: number | null
  expected_benefits?: string[] | null
  readiness_score?: number | null
  ai_reasons?: string[] | null
  business_necessity?: string | null
  expected_effects?: string | null
  required_documents?: string[] | null
}

type CompanyInfo = {
  company_name?: string | null
  industry_name?: string | null
  industry_code?: string[] | string | null
  region?: string | null
  company_type?: string | null
  business_registration_no?: string | null
}

type EquipmentInfo = {
  name?: string | null
  category?: string | null
  process?: string | null
  age_years?: number | null
  defect_rate?: number | null
  energy_cost_annual?: number | null
}

type RoiScenario = {
  label?: string
  investment_manwon?: number
  subsidy_manwon?: number
  net_investment_manwon?: number
  annual_net_benefit_manwon?: number
  payback_years?: number
  roi_pct?: number
  breakdown?: {
    energy_saving_manwon?: number
    maintenance_saving_manwon?: number
    defect_saving_manwon?: number
  }
}

type RoiResult = {
  scenario_a?: RoiScenario
  scenario_b?: RoiScenario
  recommended?: "A" | "B" | string
  data_quality?: {
    score?: number
    level?: string
    missing_fields?: string[]
    message?: string
  }
}

type AnalysisData = {
  company?: CompanyInfo | null
  equipment?: EquipmentInfo | null
  roi_result?: RoiResult | null
  draft_result?: DraftResult | null
  matched_policies?: any[]
  response?: string
}

const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"
const APPLICATION_DRAFT_STORAGE_KEY = "factofit_application_draft"

const fallbackDraft: DraftResult = {
  company_name: "기업명 미입력",
  equipment_name: "설비명 미입력",
  selected_policy: "추천 지원사업 미선택",
  application_purpose: "노후 설비 교체 및 에너지 효율 개선",
  investment_manwon: null,
  subsidy_manwon: null,
  payback_months: null,
  expected_benefits: ["에너지 비용 절감", "유지보수 비용 절감", "불량률 감소"],
  readiness_score: 65,
  ai_reasons: [
    "ROI 분석 결과를 기반으로 설비투자 타당성을 검토했습니다.",
    "설비 노후도와 불량률 개선 필요성을 신청 근거로 활용할 수 있습니다.",
  ],
  business_necessity:
    "현재 설비의 노후화로 인해 에너지 비용, 유지보수 부담, 품질 손실 문제가 발생하고 있어 설비 개선이 필요합니다.",
  expected_effects:
    "고효율 설비 도입을 통해 에너지 사용량을 줄이고 생산 안정성을 높이며, 불량률과 유지보수 비용을 낮출 수 있습니다.",
  required_documents: [
    "사업자등록증",
    "설비 견적서",
    "현 설비 사진",
  ],
}

function safeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function formatManwon(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  const amount = Number(value)

  if (amount >= 10000) {
    const eok = amount / 10000
    return `${eok.toFixed(amount % 10000 === 0 ? 0 : 1)}억원`
  }

  return `${Math.round(amount).toLocaleString()}만원`
}

function formatMonthlyPayback(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  const months = Number(value)

  if (months < 1) {
    return `${months.toFixed(1)}개월`
  }

  return `약 ${months.toFixed(months % 1 === 0 ? 0 : 1)}개월`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}%`
}

function formatAnnualSaving(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  return `연 ${formatManwon(value)}`
}

function parseResponseDraft(response?: string): DraftResult | null {
  if (!response) return null

  try {
    const parsed = JSON.parse(response)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function readAnalysisData(): AnalysisData {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    const data = parsed?.data ?? {}
    const responseDraft = parseResponseDraft(data?.response)

    return {
      ...data,
      draft_result: data?.draft_result ?? responseDraft ?? null,
    }
  } catch {
    return {}
  }
}

function getScenario(roiResult?: RoiResult | null): RoiScenario | undefined {
  if (!roiResult) return undefined

  if (roiResult.recommended === "B") {
    return roiResult.scenario_b ?? roiResult.scenario_a
  }

  return roiResult.scenario_a ?? roiResult.scenario_b
}

function getIndustryText(company?: CompanyInfo | null) {
  if (!company) return "업종 정보 없음"

  if (company.industry_name) return company.industry_name

  if (Array.isArray(company.industry_code)) {
    return company.industry_code.join(", ")
  }

  return company.industry_code || "업종 정보 없음"
}

function getEquipmentLabel(equipment?: EquipmentInfo | null, draft?: DraftResult | null) {
  const equipmentName = draft?.equipment_name || equipment?.name || "설비명 미입력"
  const process = equipment?.process

  if (process && process !== equipmentName) {
    return `${equipmentName} / ${process}`
  }

  return equipmentName
}

function getExpectedBenefits(draft?: DraftResult | null, scenario?: RoiScenario) {
  const fromDraft = draft?.expected_benefits?.filter(Boolean)

  if (fromDraft && fromDraft.length > 0) {
    return fromDraft
  }

  const breakdown = scenario?.breakdown

  return [
    breakdown?.energy_saving_manwon
      ? `에너지 비용 절감 ${formatAnnualSaving(breakdown.energy_saving_manwon)}`
      : "에너지 비용 절감",
    breakdown?.maintenance_saving_manwon
      ? `유지보수 비용 절감 ${formatAnnualSaving(breakdown.maintenance_saving_manwon)}`
      : "유지보수 비용 절감",
    breakdown?.defect_saving_manwon
      ? `불량률 감소 효과 ${formatAnnualSaving(breakdown.defect_saving_manwon)}`
      : "불량률 감소",
  ]
}

function buildChecklistItems(
  analysisData: AnalysisData,
  draft: DraftResult,
): ChecklistItem[] {
  const hasRoi = Boolean(analysisData.roi_result)
  const hasPolicies = (analysisData.matched_policies ?? []).length > 0
  const hasCompany = Boolean(
    analysisData.company?.company_name || draft.company_name,
  )

  return [
    {
      label: "ROI 분석 결과 반영",
      status: hasRoi ? "완료" : "확인 필요",
      tone: hasRoi ? "ok" : "need",
    },
    {
      label: "지원사업 적합도 검토",
      status: hasPolicies ? "완료" : "확인 필요",
      tone: hasPolicies ? "ok" : "need",
    },
    {
      label: "기업 기본정보 확인",
      status: hasCompany ? "완료" : "확인 필요",
      tone: hasCompany ? "ok" : "need",
    },
    {
      label: "견적서 및 증빙자료 첨부",
      status: "확인 필요",
      tone: "need",
    },
  ]
}

export default function ApplicationDraftPage() {
  const navigate = useNavigate()
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle")

  const analysisData = useMemo(() => readAnalysisData(), [])
  const draft = analysisData.draft_result ?? fallbackDraft
  const company = analysisData.company
  const equipment = analysisData.equipment
  const roiResult = analysisData.roi_result
  const selectedScenario = getScenario(roiResult)

  const companyName =
    draft.company_name ||
    company?.company_name ||
    fallbackDraft.company_name ||
    "기업명 미입력"

  const equipmentName = getEquipmentLabel(equipment, draft)

  const applicationPurpose =
    draft.application_purpose ||
    fallbackDraft.application_purpose ||
    "노후 설비 교체 및 에너지 효율 개선"

  const investmentManwon =
    draft.investment_manwon ??
    selectedScenario?.investment_manwon ??
    fallbackDraft.investment_manwon

  const subsidyManwon =
    draft.subsidy_manwon ??
    selectedScenario?.subsidy_manwon ??
    fallbackDraft.subsidy_manwon

  const paybackMonths =
    draft.payback_months ??
    (selectedScenario?.payback_years
      ? Number(selectedScenario.payback_years) * 12
      : fallbackDraft.payback_months)

  const readinessScore = Math.min(
    100,
    Math.max(0, safeNumber(draft.readiness_score, 65)),
  )

  const aiReasons =
    draft.ai_reasons && draft.ai_reasons.length > 0
      ? draft.ai_reasons
      : fallbackDraft.ai_reasons ?? []

  const expectedBenefits = getExpectedBenefits(draft, selectedScenario)

  const businessNecessity =
    draft.business_necessity ||
    fallbackDraft.business_necessity ||
    "설비 개선 필요성이 있습니다."

  const expectedEffects =
    draft.expected_effects ||
    fallbackDraft.expected_effects ||
    "설비 도입 후 생산성과 에너지 효율 개선이 기대됩니다."

  const requiredDocuments =
    draft.required_documents && draft.required_documents.length > 0
      ? draft.required_documents
      : fallbackDraft.required_documents ?? []

  const checklistItems = buildChecklistItems(analysisData, draft)

  const selectedPolicy =
    draft.selected_policy ||
    "추천 지원사업 미선택"

  const industryText = getIndustryText(company)
  const ageYears = equipment?.age_years ?? "-"
  const defectRate = equipment?.defect_rate ?? "-"

  const energySaving =
    selectedScenario?.breakdown?.energy_saving_manwon ?? null
  const maintenanceSaving =
    selectedScenario?.breakdown?.maintenance_saving_manwon ?? null
  const defectSaving =
    selectedScenario?.breakdown?.defect_saving_manwon ?? null

  const draftMessage = `${businessNecessity} ${expectedEffects}`

  const handleSaveDraft = () => {
    window.localStorage.setItem(
      APPLICATION_DRAFT_STORAGE_KEY,
      JSON.stringify({
        company_name: companyName,
        equipment_name: equipmentName,
        application_purpose: applicationPurpose,
        investment_manwon: investmentManwon,
        subsidy_manwon: subsidyManwon,
        payback_months: paybackMonths,
        expected_benefits: expectedBenefits,
        business_necessity: businessNecessity,
        expected_effects: expectedEffects,
        required_documents: requiredDocuments,
        saved_at: new Date().toISOString(),
      }),
    )

    setDraftStatus("saved")
  }

  const handlePrepareDownload = () => {
    setDraftStatus("downloadReady")
  }

  return (
    <main className="page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/roi")}
            style={{
              marginBottom: "28px",
              height: "44px",
              padding: "0 18px",
              borderRadius: "999px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#061B34",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(6,27,52,.06)",
            }}
          >
            ← ROI 분석으로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT APPLICATION DRAFT</div>
              <div className="label">APPLICATION DRAFT</div>
              <h2>
                ROI 분석 결과를 바탕으로 <br />
                지원사업 신청서 초안을 생성합니다.
              </h2>
            </div>

            <p className="section-desc">
              설비투자 타당성, 지원사업 적합도, 기대효과를 자동 정리해
              신청서에 바로 활용할 수 있는 초안 형태로 제공합니다.
            </p>
          </div>

          <div className="application-flow-panel">
            <div className="application-flow-head">
              <div>
                <h3>지원사업 신청 준비 현황</h3>
                <span>
                  ROI 분석 결과와 기업 설비 정보를 기반으로 작성된 초안입니다.
                </span>
              </div>

              <span className="badge green">초안 생성 완료</span>
            </div>

            <div className="application-flow-body">
              <div>
                <div className="ready-card">
                  <div className="ready-top">
                    <div>
                      <h4>신청 준비도</h4>
                      <p>
                        ROI, 회수기간, 지원사업 적합도 기준으로 신청 가능성을
                        종합 평가했습니다.
                      </p>
                    </div>

                    <span className="badge blue">AI 검토</span>
                  </div>

                  <div className="ready-score">
                    <b>{readinessScore}</b>
                    <small>/100</small>
                  </div>

                  <p>
                    현재 분석 결과 기준으로 {equipmentName} 설비투자 신청서
                    초안을 생성했습니다. 기업 기본정보와 견적서, 설비 사진 등
                    증빙자료는 제출 전 최종 확인이 필요합니다.
                  </p>

                  <div className="ready-progress">
                    <i style={{ width: `${readinessScore}%` }} />
                  </div>

                  <div className="checklist">
                    {checklistItems.map((item) => (
                      <div className="check-item" key={item.label}>
                        <strong>{item.label}</strong>
                        <span className={item.tone}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ai-ground-card">
                  <h4>AI 작성 근거</h4>

                  <ul>
                    {aiReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="draft-preview-card">
                <div className="draft-preview-top">
                  <div>
                    <h4>AI 신청서 초안</h4>
                    <p
                      style={{
                        marginTop: "8px",
                        color: "#667085",
                        fontSize: "14px",
                        lineHeight: 1.7,
                        fontWeight: 800,
                      }}
                    >
                      신청서에 바로 옮겨 적을 수 있도록 목적, 도입 설비,
                      기대효과를 문장형으로 정리했습니다.
                    </p>
                  </div>

                  <button type="button" onClick={() => navigate("/roi")}>
                    ROI 다시 보기
                  </button>
                </div>

                <div className="draft-message">{draftMessage}</div>

                <div className="draft-table">
                  <div className="draft-row">
                    <div>추천 신청사업</div>
                    <div>{selectedPolicy}</div>
                  </div>

                  <div className="draft-row">
                    <div>기업명</div>
                    <div>{companyName}</div>
                  </div>

                  <div className="draft-row">
                    <div>대상 설비</div>
                    <div>{equipmentName}</div>
                  </div>

                  <div className="draft-row">
                    <div>신청 목적</div>
                    <div>{applicationPurpose}</div>
                  </div>

                  <div className="draft-row">
                    <div>총 투자금</div>
                    <div>{formatManwon(investmentManwon)}</div>
                  </div>

                  <div className="draft-row">
                    <div>예상 지원금</div>
                    <div>{formatManwon(subsidyManwon)}</div>
                  </div>

                  <div className="draft-row">
                    <div>예상 회수기간</div>
                    <div>{formatMonthlyPayback(paybackMonths)}</div>
                  </div>

                  <div className="draft-row">
                    <div>주요 기대효과</div>
                    <div>{expectedBenefits.join(", ")}</div>
                  </div>
                </div>

                <div className="recommended-policy-mini">
                  <div className="policy-mini">
                    <strong>{roiResult?.recommended === "B" ? "시나리오 B" : "시나리오 A"}</strong>
                    <span>
                      ROI {formatPercent(selectedScenario?.roi_pct)} · 우선 검토
                    </span>
                  </div>

                  <div className="policy-mini">
                    <strong>{industryText}</strong>
                    <span>
                      {company?.region || "지역 정보 없음"} ·{" "}
                      {company?.company_type || "기업유형 정보 없음"}
                    </span>
                  </div>
                </div>

                <div className="draft-actions">
                  <button
                    className="btn blue"
                    type="button"
                    onClick={handleSaveDraft}
                  >
                    초안 저장하기
                  </button>

                  <button
                    className="btn dark"
                    type="button"
                    onClick={handlePrepareDownload}
                  >
                    PDF 다운로드 준비
                  </button>

                  <button
                    className="btn green"
                    type="button"
                    onClick={() => navigate("/support-projects")}
                  >
                    지원사업 목록 보기
                  </button>
                </div>

                {draftStatus === "saved" && (
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "16px 18px",
                      borderRadius: "18px",
                      background: "#E8F5EF",
                      color: "#0B7A53",
                      fontSize: "14px",
                      fontWeight: 900,
                    }}
                  >
                    신청서 초안이 저장되었습니다.
                  </div>
                )}

                {draftStatus === "downloadReady" && (
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "16px 18px",
                      borderRadius: "18px",
                      background: "#FFF2DF",
                      color: "#E65F00",
                      fontSize: "14px",
                      fontWeight: 900,
                    }}
                  >
                    PDF 다운로드 기능은 이후 연결 예정입니다. 현재는 초안
                    내용을 화면에서 확인할 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="details-wrap">
            <details open>
              <summary>신청서 문장 미리보기</summary>

              <div className="detail-body">
                <div className="scenario-grid">
                  <div className="scenario best">
                    <h4>사업 필요성</h4>
                    <p>{businessNecessity}</p>

                    <div className="kv-grid">
                      <div className="kv">
                        <span>설비 사용연수</span>
                        <b>
                          {typeof ageYears === "number" ? `${ageYears}년` : "-"}
                        </b>
                      </div>

                      <div className="kv">
                        <span>현재 불량률</span>
                        <b>
                          {typeof defectRate === "number" ? `${defectRate}%` : "-"}
                        </b>
                      </div>

                      <div className="kv wide">
                        <span>핵심 문제</span>
                        <b>노후화 및 품질 개선 필요</b>
                      </div>
                    </div>
                  </div>

                  <div className="scenario">
                    <h4>도입 후 기대효과</h4>
                    <p>{expectedEffects}</p>

                    <div className="saving-list">
                      <div className="saving">
                        <span>전기요금 절감</span>
                        <b>{formatAnnualSaving(energySaving)}</b>
                      </div>

                      <div className="saving">
                        <span>불량 손실 감소</span>
                        <b>{formatAnnualSaving(defectSaving)}</b>
                      </div>

                      <div className="saving">
                        <span>유지보수비 절감</span>
                        <b>{formatAnnualSaving(maintenanceSaving)}</b>
                      </div>

                      <div className="saving">
                        <span>투자 회수기간</span>
                        <b>{formatMonthlyPayback(paybackMonths)}</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <details>
              <summary>제출 전 확인할 서류</summary>

              <div className="detail-body">
                <div className="check-grid">
                  {requiredDocuments.map((documentName, index) => {
                    const toneClass =
                      index === 0 ? "" : index === 1 ? "orange" : "red"

                    return (
                      <div className={`check-card ${toneClass}`} key={documentName}>
                        <h4>{documentName}</h4>
                        <p>
                          제출 전 최신 상태로 준비하고, 신청사업 요구 양식에
                          맞는지 확인해주세요.
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}