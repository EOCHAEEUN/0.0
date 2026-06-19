import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getAccessToken } from "../services/auth"

type DraftStatus = "idle" | "saved" | "downloadReady"

type StoredDraftResponse = {
  data?: {
    draft_result?: Record<string, unknown>
    scenario_used?: string
    scenario_label?: string
    policy_id?: string
    company_id?: string
    equipment_id?: string
  }
}

const DRAFT_RESULT_STORAGE_KEY = "factofit_draft_result"
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api"

function readStoredDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_RESULT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredDraftResponse
    return {
      draft: parsed?.data?.draft_result ?? null,
      scenarioUsed: parsed?.data?.scenario_used ?? "",
      scenarioLabel: parsed?.data?.scenario_label ?? "",
      policyId: parsed?.data?.policy_id ?? "",
      companyId: parsed?.data?.company_id ?? "",
      equipmentId: parsed?.data?.equipment_id ?? "",
    }
  } catch {
    return null
  }
}

function asText(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback
  if (Array.isArray(value)) return value.map((item) => asText(item)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function asList(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean)
  if (typeof value === "string" && value.trim()) return [value]
  return fallback
}

function formatManwon(value: unknown) {
  const amount = asNumber(value)
  if (!amount) return "-"
  if (amount >= 10000) {
    const eok = amount / 10000
    return `${eok.toLocaleString(undefined, {
      maximumFractionDigits: eok % 1 === 0 ? 0 : 1,
    })}억원`
  }
  return `${amount.toLocaleString()}만원`
}

function formatMonths(value: unknown) {
  const months = asNumber(value)
  if (!months) return "-"
  return `약 ${months.toLocaleString(undefined, { maximumFractionDigits: 1 })}개월`
}

function scenarioDisplay(scenarioUsed?: string, scenarioLabel?: string) {
  const normalized = scenarioUsed?.toUpperCase()
  if (!normalized && !scenarioLabel) return "-"
  return `${normalized || "-"}안 · ${scenarioLabel || "시나리오 기준"}`
}

export default function ApplicationDraftPage() {
  const navigate = useNavigate()
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle")
  const storedDraft = useMemo(() => readStoredDraft(), [])
  const draft = storedDraft?.draft ?? {}

  const companyName = asText(draft.company_name, "기업 정보 없음")
  const equipmentName = asText(draft.equipment_name, "설비 정보 없음")
  const policyTitle = asText(draft.policy_title, "선택된 지원사업")
  const scenario = scenarioDisplay(storedDraft?.scenarioUsed, storedDraft?.scenarioLabel)
  const applicationPurpose = asText(
    draft.application_purpose,
    "노후 설비 개선 및 생산 효율 향상을 위한 지원사업 신청",
  )
  const readinessScore = asNumber(draft.readiness_score, 82)
  const investment = formatManwon(draft.investment_manwon)
  const subsidy = formatManwon(draft.subsidy_manwon)
  const payback = formatMonths(draft.payback_months)
  const expectedBenefits = asList(draft.expected_benefits, [
    "생산 효율 개선",
    "에너지 비용 절감",
    "유지보수 부담 완화",
  ])
  const aiReasons = asList(draft.ai_reasons, [
    "ROI 분석 결과와 선택한 지원사업 목적이 연결됩니다.",
    "설비 투자 규모와 예상 지원금이 신청 근거로 활용 가능합니다.",
    "선택된 정책의 시나리오 기준에 맞춰 초안이 작성되었습니다.",
  ])
  const businessNecessity = asText(
    draft.business_necessity,
    `${companyName}은 현재 ${equipmentName} 개선을 통해 생산 안정성과 비용 효율을 높일 필요가 있습니다.`,
  )
  const implementationPlan = asText(
    draft.implementation_plan,
    "선정된 지원사업 기준에 맞춰 설비 도입 범위, 견적 자료, 기대효과를 정리한 뒤 신청서를 보완합니다.",
  )
  const expectedEffects = asText(
    draft.expected_effects,
    expectedBenefits.join(", "),
  )
  const requiredDocuments = asList(draft.required_documents, [
    "사업자등록증",
    "설비 견적서",
    "설비 사진 또는 현황 자료",
    "최근 매출 및 고용 관련 증빙",
  ])
  const checklist = asList(draft.checklist, [
    "기업 기본정보 확인",
    "견적서 및 증빙자료 첨부",
    "ROI 산출 근거 검토",
  ])

  const handleSaveDraft = () => {
    setDraftStatus("saved")
  }

  const handlePrepareDownload = async () => {
    if (!storedDraft?.companyId || !storedDraft?.equipmentId) {
      window.alert("PDF 생성에 필요한 기업·설비 정보를 찾을 수 없습니다.")
      return
    }

    try {
      const token = getAccessToken()
      const response = await fetch(`${API_BASE}/reports/application.pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          company_id: storedDraft.companyId,
          equipment_id: storedDraft.equipmentId,
          policy_id: storedDraft.policyId || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.detail || "PDF 생성에 실패했습니다.")
      }

      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition") ?? ""
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
      const fileName = encodedName
        ? decodeURIComponent(encodedName)
        : "factofit_application_report.pdf"
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
      setDraftStatus("downloadReady")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "PDF 생성에 실패했습니다.")
    }
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
                        정책 적합도, 사용자 정보, 선택정보, 설비현황, ROI 분석
                        반영 수준을 종합해 확인합니다.
                      </p>
                    </div>

                    <span className="badge blue">AI 검토</span>
                  </div>

                  <div className="ready-score">
                    <b>{readinessScore}</b>
                    <small>/100</small>
                  </div>

                  <p>
                    {policyTitle} 신청을 위해 {companyName}의 {equipmentName} 투자
                    목적과 기대효과를 초안에 반영했습니다. 최종 제출 전
                    사업자등록증, 견적서, 설비 현황 자료를 확인해주세요.
                  </p>

                  <div className="ready-progress">
                    <i style={{ width: `${Math.min(readinessScore, 100)}%` }} />
                  </div>

                  <div className="checklist">
                    {checklist.slice(0, 4).map((item, index) => (
                      <div className="check-item" key={`${item}-${index}`}>
                        <strong>{item}</strong>
                        <span className={index <= 1 ? "ok" : "need"}>
                          {index <= 1 ? "완료" : "확인 필요"}
                        </span>
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
                      선택한 정책, A/B/C 시나리오, ROI 계산값을 기준으로 목적,
                      도입 설비, 기대효과를 문장형으로 정리했습니다.
                    </p>
                  </div>

                  <button type="button" onClick={() => navigate("/roi")}>
                    ROI 다시 보기
                  </button>
                </div>

                <div className="draft-message">{businessNecessity}</div>

                <div className="draft-table">
                  <div className="draft-row">
                    <div>추천 신청사업</div>
                    <div>{policyTitle}</div>
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
                    <div>투자 시나리오</div>
                    <div>{scenario}</div>
                  </div>

                  <div className="draft-row">
                    <div>총 투자금</div>
                    <div>{investment}</div>
                  </div>

                  <div className="draft-row">
                    <div>예상 지원금</div>
                    <div>{subsidy}</div>
                  </div>

                  <div className="draft-row">
                    <div>예상 회수기간</div>
                    <div>{payback}</div>
                  </div>

                  <div className="draft-row">
                    <div>주요 기대효과</div>
                    <div>{expectedBenefits.join(", ")}</div>
                  </div>
                </div>

                <div className="recommended-policy-mini">
                  <div className="policy-mini">
                    <strong>{storedDraft?.scenarioLabel || "선택 정책"}</strong>
                    <span>{policyTitle}</span>
                  </div>

                  <div className="policy-mini">
                    <strong>ROI 반영</strong>
                    <span>
                      {investment} 투자 · {subsidy} 지원 · {payback} 회수
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
                    PDF 저장 기능은 연결 예정입니다. 현재 화면의 초안 내용을
                    먼저 확인해주세요.
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
                        <span>대상 설비</span>
                        <b>{equipmentName}</b>
                      </div>

                      <div className="kv">
                        <span>적용 시나리오</span>
                        <b>{scenario}</b>
                      </div>

                      <div className="kv wide">
                        <span>신청 목적</span>
                        <b>{applicationPurpose}</b>
                      </div>
                    </div>
                  </div>

                  <div className="scenario">
                    <h4>도입 계획 및 기대효과</h4>
                    <p>{implementationPlan}</p>

                    <div className="saving-list">
                      {expectedBenefits.slice(0, 3).map((benefit) => (
                        <div className="saving" key={benefit}>
                          <span>기대효과</span>
                          <b>{benefit}</b>
                        </div>
                      ))}

                      <div className="saving">
                        <span>예상 회수기간</span>
                        <b>{payback}</b>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="draft-message" style={{ marginTop: "18px" }}>
                  {expectedEffects}
                </div>
              </div>
            </details>

            <details>
              <summary>제출 전 확인할 서류</summary>

              <div className="detail-body">
                <div className="check-grid">
                  {requiredDocuments.map((document, index) => (
                    <div
                      className={`check-card ${index === 1 ? "orange" : index === 2 ? "red" : ""}`}
                      key={document}
                    >
                      <h4>{document}</h4>
                      <p>
                        신청서 제출 전 {document} 자료를 최신 기준으로 준비하고,
                        지원사업 공고의 제출 양식과 일치하는지 확인해주세요.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}
