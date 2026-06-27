import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { OnboardingStepper } from "../components/OnboardingStepper"
import { runOnboardingAnalysis } from "../onboardingAnalysisApi"
import {
  type AnalysisConditionDraft,
  getAnalysisConditionDraft,
  getAnalysisResult,
  getCompanyProfileDraft,
  saveAnalysisConditionDraft,
  saveAnalysisResult,
  updateUserOnboardingState,
} from "../onboardingState"

const equipmentCategoryOptions = [
  { label: "프레스", value: "press" },
  { label: "CNC", value: "cnc" },
  { label: "사출성형기", value: "injection" },
  { label: "기타 설비", value: "other" },
]

const equipmentNamePlaceholders: Record<string, string> = {
  press: "예: 프레스 1호기",
  cnc: "예: CNC 선반 1호기",
  injection: "예: 사출성형기 1호기",
  other: "예: 설비명 직접 입력",
}

const purposeOptions = [
  "노후 설비 교체",
  "생산량 확대",
  "인력 절감",
  "에너지 절감",
  "안전성 개선",
]

function createDraftId() {
  return `analysis-${Date.now()}`
}

function formatNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  return digits ? Number(digits).toLocaleString("ko-KR") : ""
}

function stripFormatting(value: string): string {
  return value.replace(/,/g, "")
}

export default function AnalysisNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get("draftId")
  const isEditMode = Boolean(draftId)

  const profile = useMemo(() => getCompanyProfileDraft(), [])
  const existingResult = useMemo(
    () => (draftId ? getAnalysisResult(draftId) : null),
    [draftId],
  )

  const [condition, setCondition] = useState<AnalysisConditionDraft>(() =>
    getAnalysisConditionDraft(),
  )
  const [submitted, setSubmitted] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [toast, setToast] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const saveTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const navTimerRef = useRef<number | null>(null)

  const missing = {
    equipmentCategory: !condition.equipmentCategory.trim(),
    equipmentName: !condition.equipmentName.trim(),
    investmentAmount: !condition.investmentAmount.trim(),
    purpose: !condition.purpose.trim(),
  }

  const updateCondition = (patch: Partial<AnalysisConditionDraft>) => {
    setCondition((prev) => ({ ...prev, ...patch }))
  }

  useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    setSaveState("saving")
    saveTimerRef.current = window.setTimeout(() => {
      saveAnalysisConditionDraft(condition)
      setSaveState("saved")
    }, 800)
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [condition])

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000)
  }

  // ── 신규 모드 핸들러 ──
  const handleDashboard = () => {
    const id = draftId || createDraftId()
    saveAnalysisConditionDraft(condition)
    updateUserOnboardingState({ analysisDraftId: id, analysisDraftStatus: "in_progress" })
    showToast("입력한 내용이 저장되었습니다. 대시보드에서 언제든 이어서 작성할 수 있어요.")
    if (navTimerRef.current) window.clearTimeout(navTimerRef.current)
    navTimerRef.current = window.setTimeout(() => navigate("/dashboard"), 1500)
  }

  const handleReview = () => {
    setSubmitted(true)
    if (Object.values(missing).some(Boolean)) return

    const id = draftId || createDraftId()
    saveAnalysisConditionDraft(condition)
    updateUserOnboardingState({
      companyProfileStatus: "completed",
      analysisDraftId: id,
      analysisDraftStatus: "ready_for_review",
    })
    navigate(`/analysis/review?draftId=${id}`)
  }

  // ── 수정 모드 핸들러 ──
  const handleCancelEdit = () => {
    navigate(`/roi?analysisId=${draftId}`)
  }

  const handleReanalyze = async () => {
    setSubmitted(true)
    if (Object.values(missing).some(Boolean)) return

    setIsAnalyzing(true)
    setErrorMessage("")

    try {
      saveAnalysisConditionDraft(condition)
      const result = await runOnboardingAnalysis(draftId!, profile, condition)
      saveAnalysisResult(result)
      navigate(`/roi?analysisId=${draftId}`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.",
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveLabel =
    saveState === "saving" ? "저장 중..." : saveState === "saved" ? "자동 저장됨" : ""

  const equipmentPlaceholder =
    equipmentNamePlaceholders[condition.equipmentCategory] ?? "예: 설비명 입력"

  const equipmentDisplayName =
    existingResult?.equipmentName || condition.equipmentName || "투자 설비"

  const companyLine =
    [
      profile.companyName,
      profile.industry,
      [profile.regionSido, profile.regionSigungu].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(" · ") || "기업 정보 미입력"

  // ════════════════════════════════════════
  // 수정 모드 렌더
  // ════════════════════════════════════════
  if (isEditMode) {
    return (
      <main className="ff-onboarding-page">
        {toast && (
          <div className="ff-toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}

        <header className="ff-setup-header">
          <button
            type="button"
            className="ff-logo-button"
            onClick={() => navigate("/dashboard")}
          >
            FactoFit
          </button>
          <span className={`ff-save-status ${saveState}`}>{saveLabel}</span>
        </header>

        <div className="ff-edit-shell">
          {/* 뒤로가기 */}
          <nav className="ff-edit-nav">
            <button type="button" className="ff-edit-back-link" onClick={handleCancelEdit}>
              ← {equipmentDisplayName} 투자 검토 결과로 돌아가기
            </button>
          </nav>

          {/* 헤더 */}
          <div className="ff-edit-header">
            <p className="ff-onboarding-eyebrow">ANALYSIS CONDITIONS</p>
            <h1 className="ff-edit-title">{equipmentDisplayName} 분석 조건 조정</h1>
            <p className="ff-edit-desc">
              변경한 조건을 기준으로 ROI와 지원사업 매칭을 다시 계산합니다.
            </p>
          </div>

          {/* 기업 정보 요약 줄 */}
          <div className="ff-edit-company-summary">
            <div className="ff-edit-company-info">
              <span className="ff-edit-company-label">기업 정보</span>
              <span className="ff-edit-company-line">{companyLine}</span>
            </div>
            <button
              type="button"
              className="ff-edit-company-edit-btn"
              onClick={() => navigate("/setup/company")}
            >
              기업 정보 수정
            </button>
          </div>

          {/* 폼 패널 */}
          <div className="ff-edit-form-panel">
            {/* 섹션 1: 핵심 투자 조건 */}
            <p className="ff-edit-section-title">핵심 투자 조건</p>
            <div className="ff-placeholder-form">
              <label>
                <span>
                  설비 종류 <em className="ff-required-mark">*</em>
                </span>
                <select
                  value={condition.equipmentCategory}
                  onChange={(e) => updateCondition({ equipmentCategory: e.target.value })}
                >
                  <option value="">설비 종류 선택</option>
                  {equipmentCategoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {submitted && missing.equipmentCategory && <em>필수 항목입니다.</em>}
              </label>

              <label>
                <span>
                  검토 설비 <em className="ff-required-mark">*</em>
                </span>
                <input
                  value={condition.equipmentName}
                  onChange={(e) => updateCondition({ equipmentName: e.target.value })}
                  placeholder={equipmentPlaceholder}
                />
                {submitted && missing.equipmentName && <em>필수 항목입니다.</em>}
              </label>

              <div className="ff-purpose-field">
                <span className="ff-field-label">
                  주요 목적 <em className="ff-required-mark">*</em>
                </span>
                <div className="ff-purpose-chips" role="group" aria-label="주요 목적 선택">
                  {purposeOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`ff-purpose-chip${condition.purpose === opt ? " selected" : ""}`}
                      onClick={() => updateCondition({ purpose: opt })}
                      aria-pressed={condition.purpose === opt}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {submitted && missing.purpose && (
                  <p className="ff-field-error">필수 항목입니다.</p>
                )}
              </div>
            </div>

            <hr className="ff-edit-divider" />

            {/* 섹션 2: 비용 및 운영 가정 */}
            <p className="ff-edit-section-title">비용 및 운영 가정</p>
            <div className="ff-placeholder-form">
              <label>
                <span>
                  A안 투자금 (전체 교체) <em className="ff-required-mark">*</em>
                </span>
                <div className="ff-input-with-unit">
                  <input
                    inputMode="numeric"
                    value={formatNumber(condition.investmentAmount)}
                    onChange={(e) =>
                      updateCondition({ investmentAmount: stripFormatting(e.target.value) })
                    }
                    placeholder="예: 15,000"
                  />
                  <span className="ff-input-unit">만원</span>
                </div>
                {submitted && missing.investmentAmount && <em>필수 항목입니다.</em>}
              </label>

              <label>
                <span>B안 투자금 (부분 교체)</span>
                <div className="ff-input-with-unit">
                  <input
                    inputMode="numeric"
                    value={formatNumber(condition.scenarioBInvestmentManwon ?? "")}
                    onChange={(e) =>
                      updateCondition({
                        scenarioBInvestmentManwon: stripFormatting(e.target.value),
                      })
                    }
                    placeholder="예: 3,000"
                  />
                  <span className="ff-input-unit">만원</span>
                </div>
              </label>

              <label>
                <span>설비 사용연수</span>
                <input
                  inputMode="numeric"
                  value={condition.ageYears}
                  onChange={(e) => updateCondition({ ageYears: e.target.value })}
                  placeholder="예: 10"
                />
              </label>

              <label>
                <span>연간 에너지 비용</span>
                <div className="ff-input-with-unit">
                  <input
                    inputMode="numeric"
                    value={formatNumber(condition.energyCostAnnual)}
                    onChange={(e) =>
                      updateCondition({ energyCostAnnual: stripFormatting(e.target.value) })
                    }
                    placeholder="예: 4,800"
                  />
                  <span className="ff-input-unit">만원</span>
                </div>
              </label>

              <label>
                <span>월 유지보수 비용</span>
                <div className="ff-input-with-unit">
                  <input
                    inputMode="numeric"
                    value={formatNumber(condition.monthlyMaintenanceCost)}
                    onChange={(e) =>
                      updateCondition({
                        monthlyMaintenanceCost: stripFormatting(e.target.value),
                      })
                    }
                    placeholder="예: 150"
                  />
                  <span className="ff-input-unit">만원</span>
                </div>
              </label>
            </div>

            {/* 추가 가정 접힘 */}
            <details className="ff-analysis-optional">
              <summary>추가 계산 가정 펼치기</summary>
              <div className="ff-placeholder-form ff-optional-inner">
                <label>
                  <span>설비 용량 · 규격</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.equipmentCapacity ?? "")}
                      onChange={(e) =>
                        updateCondition({
                          equipmentCapacity: stripFormatting(e.target.value),
                        })
                      }
                      placeholder="예: 200 (ton 또는 kW)"
                    />
                    <span className="ff-input-unit">ton / kW</span>
                  </div>
                </label>
                <label>
                  <span>월 생산량 또는 작업량</span>
                  <input
                    value={condition.monthlyProduction}
                    onChange={(e) => updateCondition({ monthlyProduction: e.target.value })}
                    placeholder="예: 5,000개 / 200시간"
                  />
                </label>
                <label>
                  <span>월 인건비</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.monthlyLaborCost)}
                      onChange={(e) =>
                        updateCondition({ monthlyLaborCost: stripFormatting(e.target.value) })
                      }
                      placeholder="예: 500"
                    />
                    <span className="ff-input-unit">만원</span>
                  </div>
                </label>
                <label>
                  <span>예상 매출 증가액</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.expectedRevenueIncrease)}
                      onChange={(e) =>
                        updateCondition({
                          expectedRevenueIncrease: stripFormatting(e.target.value),
                        })
                      }
                      placeholder="예: 2,000"
                    />
                    <span className="ff-input-unit">만원/월</span>
                  </div>
                </label>
                <p className="ff-setup-helper">
                  정확한 수치를 모르는 항목은 비워두셔도 됩니다.
                  <br />
                  업종 평균값으로 보정해 분석합니다.
                </p>
              </div>
            </details>

            {errorMessage && (
              <p className="ff-field-error" role="alert" style={{ marginTop: 14 }}>
                {errorMessage}
              </p>
            )}

            {isAnalyzing && (
              <div
                className="ff-analysis-loading"
                role="status"
                aria-live="polite"
                style={{ marginTop: 16 }}
              >
                <strong>분석 중...</strong>
                <span>ROI 계산</span>
                <span>회수기간 예측</span>
                <span>지원사업 조건 비교</span>
              </div>
            )}

            <div className="ff-edit-actions">
              <button
                type="button"
                className="ff-edit-cancel"
                onClick={handleCancelEdit}
                disabled={isAnalyzing}
              >
                취소하고 결과로 돌아가기
              </button>
              <button
                type="button"
                className="ff-edit-submit"
                onClick={handleReanalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "분석 중..." : "변경사항으로 다시 분석"}
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ════════════════════════════════════════
  // 신규 분석 모드 렌더 (기존 그대로)
  // ════════════════════════════════════════
  return (
    <main className="ff-onboarding-page">
      {toast && (
        <div className="ff-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <header className="ff-setup-header">
        <button type="button" className="ff-logo-button" onClick={() => navigate("/dashboard")}>
          FactoFit
        </button>
        <span className={`ff-save-status ${saveState}`}>{saveLabel}</span>
      </header>

      <section className="ff-analysis-shell">
        <OnboardingStepper currentStep={2} />

        <div className="ff-analysis-grid">
          <aside className="ff-analysis-copy">
            <p className="ff-onboarding-eyebrow">INVESTMENT CONDITIONS</p>
            <h1>투자 조건을 정리해 주세요.</h1>
            <p>
              등록한 기업 정보를 기준으로, 이번에 검토할 설비와 투자 목적을 입력합니다.
              다음 단계에서 ROI, 지원사업, 신청서 준비 가능성을 한 번에 확인합니다.
            </p>
            <div className="ff-setup-note">
              <strong>기업 정보</strong>
              <span>
                {profile.companyName || "기업명 미입력"} · {profile.industry || "업종 미입력"}
              </span>
            </div>
          </aside>

          <section className="ff-analysis-panel">
            <div className="ff-placeholder-form">
              <label>
                <span>
                  설비 종류 <em className="ff-required-mark">*</em>
                </span>
                <select
                  value={condition.equipmentCategory}
                  onChange={(e) => updateCondition({ equipmentCategory: e.target.value })}
                >
                  <option value="">설비 종류 선택</option>
                  {equipmentCategoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {submitted && missing.equipmentCategory && <em>필수 항목입니다.</em>}
              </label>

              <label>
                <span>
                  검토 설비 <em className="ff-required-mark">*</em>
                </span>
                <input
                  value={condition.equipmentName}
                  onChange={(e) => updateCondition({ equipmentName: e.target.value })}
                  placeholder={equipmentPlaceholder}
                />
                {submitted && missing.equipmentName && <em>필수 항목입니다.</em>}
              </label>

              <label>
                <span>
                  A안 투자금 (전체 교체) <em className="ff-required-mark">*</em>
                </span>
                <div className="ff-input-with-unit">
                  <input
                    inputMode="numeric"
                    value={formatNumber(condition.investmentAmount)}
                    onChange={(e) =>
                      updateCondition({ investmentAmount: stripFormatting(e.target.value) })
                    }
                    placeholder="예: 15,000"
                  />
                  <span className="ff-input-unit">만원</span>
                </div>
                {submitted && missing.investmentAmount && <em>필수 항목입니다.</em>}
              </label>

              <div className="ff-purpose-field">
                <span className="ff-field-label">
                  주요 목적 <em className="ff-required-mark">*</em>
                </span>
                <div className="ff-purpose-chips" role="group" aria-label="주요 목적 선택">
                  {purposeOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`ff-purpose-chip${condition.purpose === opt ? " selected" : ""}`}
                      onClick={() => updateCondition({ purpose: opt })}
                      aria-pressed={condition.purpose === opt}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {submitted && missing.purpose && (
                  <p className="ff-field-error">필수 항목입니다.</p>
                )}
              </div>
            </div>

            <details className="ff-analysis-optional">
              <summary>추가 정보를 입력하면 ROI 정확도가 높아집니다.</summary>
              <div className="ff-placeholder-form ff-optional-inner">
                <label>
                  <span>B안 투자금 (부분 교체)</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.scenarioBInvestmentManwon ?? "")}
                      onChange={(e) =>
                        updateCondition({
                          scenarioBInvestmentManwon: stripFormatting(e.target.value),
                        })
                      }
                      placeholder="예: 3,000"
                    />
                    <span className="ff-input-unit">만원</span>
                  </div>
                </label>
                <label>
                  <span>설비 용량 · 규격</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.equipmentCapacity ?? "")}
                      onChange={(e) =>
                        updateCondition({
                          equipmentCapacity: stripFormatting(e.target.value),
                        })
                      }
                      placeholder="예: 200 (ton 또는 kW)"
                    />
                    <span className="ff-input-unit">ton / kW</span>
                  </div>
                </label>
                <label>
                  <span>설비 사용연수</span>
                  <input
                    inputMode="numeric"
                    value={condition.ageYears}
                    onChange={(e) => updateCondition({ ageYears: e.target.value })}
                    placeholder="예: 10"
                  />
                </label>
                <label>
                  <span>연간 에너지 비용</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.energyCostAnnual)}
                      onChange={(e) =>
                        updateCondition({ energyCostAnnual: stripFormatting(e.target.value) })
                      }
                      placeholder="예: 4,800"
                    />
                    <span className="ff-input-unit">만원</span>
                  </div>
                </label>
                <label>
                  <span>월 생산량 또는 작업량</span>
                  <input
                    value={condition.monthlyProduction}
                    onChange={(e) => updateCondition({ monthlyProduction: e.target.value })}
                    placeholder="예: 5,000개 / 200시간"
                  />
                </label>
                <label>
                  <span>월 인건비</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.monthlyLaborCost)}
                      onChange={(e) =>
                        updateCondition({ monthlyLaborCost: stripFormatting(e.target.value) })
                      }
                      placeholder="예: 500"
                    />
                    <span className="ff-input-unit">만원</span>
                  </div>
                </label>
                <label>
                  <span>월 유지보수 비용</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.monthlyMaintenanceCost)}
                      onChange={(e) =>
                        updateCondition({
                          monthlyMaintenanceCost: stripFormatting(e.target.value),
                        })
                      }
                      placeholder="예: 150"
                    />
                    <span className="ff-input-unit">만원</span>
                  </div>
                </label>
                <label>
                  <span>예상 매출 증가액</span>
                  <div className="ff-input-with-unit">
                    <input
                      inputMode="numeric"
                      value={formatNumber(condition.expectedRevenueIncrease)}
                      onChange={(e) =>
                        updateCondition({
                          expectedRevenueIncrease: stripFormatting(e.target.value),
                        })
                      }
                      placeholder="예: 2,000"
                    />
                    <span className="ff-input-unit">만원/월</span>
                  </div>
                </label>
                <p className="ff-setup-helper">
                  정확한 수치를 모르는 항목은 비워두셔도 됩니다.
                  <br />
                  업종 평균값으로 보정해 분석합니다.
                </p>
              </div>
            </details>

            <div className="ff-setup-actions">
              <button type="button" className="ff-secondary-action" onClick={handleDashboard}>
                대시보드로 이동
              </button>
              <button type="button" className="ff-primary-action" onClick={handleReview}>
                저장하고 입력 내용 확인하기
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
