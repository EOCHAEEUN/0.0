import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { OnboardingStepper } from "../components/OnboardingStepper"
import {
  getCompanyProfileDraft,
  saveCompanyProfileDraft,
  updateUserOnboardingState,
  type CompanyProfileDraft,
} from "../onboardingState"
import { saveOnboardingCompany } from "../onboardingAnalysisApi"
import { INDUSTRY_OPTIONS } from "../../../components/auth/signup/signup.constants"

const sidoOptions = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "충남", "경남"]
const sigunguOptions: Record<string, string[]> = {
  서울: ["강남구", "구로구", "금천구", "성동구"],
  경기: ["안산시", "화성시", "시흥시", "부천시"],
  인천: ["연수구", "서구", "부평구"],
  부산: ["강서구", "사상구", "기장군"],
}
const employeeRanges = ["1~4명", "5~9명", "10~49명", "50~299명", "300명 이상", "아직 모르겠어요"]
const revenueRanges = ["1억원 미만", "1~10억원", "10~50억원", "50~100억원", "100억원 이상"]
const smartFactoryOptions = ["미도입", "기초 단계", "중간1 단계", "중간2 이상", "아직 모르겠어요"]

function getProfileStatus(draft: CompanyProfileDraft) {
  const required = [
    draft.companyName,
    draft.regionSido,
    draft.regionSigungu,
    draft.industry,
    draft.industryCode,
    draft.employeeRange,
  ]
  const filledCount = required.filter((value) => value.trim()).length
  if (filledCount === 0) return "not_started"
  if (filledCount === required.length) return "completed"
  return "in_progress"
}

function formatSaveTime(value?: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default function CompanySetupPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<CompanyProfileDraft>(() => getCompanyProfileDraft())
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const timerRef = useRef<number | null>(null)

  const missingFields = useMemo(
    () => ({
      companyName: !draft.companyName.trim(),
      region: !draft.regionSido.trim() || !draft.regionSigungu.trim(),
      industry: !draft.industry.trim() || !draft.industryCode.trim(),
      employeeRange: !draft.employeeRange.trim(),
    }),
    [draft],
  )

  const updateDraft = (patch: Partial<CompanyProfileDraft>) => {
    setDraft((prev) => {
      const next = {
        ...prev,
        ...patch,
      }
      return {
        ...next,
        status: getProfileStatus(next),
      }
    })
  }

  const handleIndustryNameChange = (value: string) => {
    const exact = INDUSTRY_OPTIONS.find((item) => item.name === value)
    updateDraft({
      industry: value,
      industryCode: exact ? exact.codes.join(", ") : "",
    })
  }

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setSaveState("saving")

    timerRef.current = window.setTimeout(() => {
      try {
        setDraft((prev) => {
          const saved = saveCompanyProfileDraft({
            ...prev,
            status: getProfileStatus(prev),
          })
          return saved
        })
        setSaveState("saved")
      } catch {
        setSaveState("failed")
      }
    }, 650)

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [
    draft.companyName,
    draft.regionSido,
    draft.regionSigungu,
    draft.industry,
    draft.industryCode,
    draft.employeeRange,
    draft.foundedYear,
    draft.revenueRange,
    draft.smartFactoryStatus,
  ])

  const handleContinue = async () => {
    setSubmitted(true)
    setSubmitError("")
    if (
      missingFields.companyName ||
      missingFields.region ||
      missingFields.industry ||
      missingFields.employeeRange
    ) {
      return
    }

    const completedDraft = saveCompanyProfileDraft({
      ...draft,
      status: "completed",
    })
    setIsSubmitting(true)
    try {
      const companyId = await saveOnboardingCompany(completedDraft)
      updateUserOnboardingState({
        companyProfileStatus: "completed",
        companyId,
      })
      navigate("/analysis/new?mode=new")
    } catch (reason) {
      setSubmitError(
        reason instanceof Error ? reason.message : "기업 정보를 저장하지 못했습니다.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "저장 중..."
      : saveState === "failed"
        ? "저장에 실패했어요"
        : draft.updatedAt
          ? `저장됨 · ${formatSaveTime(draft.updatedAt)}`
          : "자동 저장 대기"

  return (
    <main className="ff-onboarding-page">
      <header className="ff-setup-header">
        <button type="button" className="ff-logo-button" onClick={() => navigate("/dashboard")}>
          FactoFit
        </button>
        <span className={`ff-save-status ${saveState}`}>{saveLabel}</span>
      </header>

      <section className="ff-setup-shell">
        <OnboardingStepper currentStep={1} variant="setup" />

        <div className="ff-setup-grid">
          <aside className="ff-setup-intro">
            <p className="ff-onboarding-eyebrow">1단계 · 기업 정보</p>
            <h1>기업 정보를 알려주세요.</h1>
            <p>
              입력한 정보는 지원사업 자격, 예상 지원금, ROI 분석 기준을 잡는 데
              사용됩니다. 모르는 항목은 나중에 보완할 수 있어요.
            </p>
            <div className="ff-setup-note">
              <strong>왜 필요한가요?</strong>
              <span>
                업종, 지역, 규모에 따라 받을 수 있는 지원사업과 신청 우선순위가 달라집니다.
              </span>
            </div>
          </aside>

          <section className="ff-setup-form" aria-label="기업 정보 입력">
            <label>
              <span>회사명</span>
              <input
                value={draft.companyName}
                onChange={(event) => updateDraft({ companyName: event.target.value })}
                placeholder="예: 동아정밀, 강승우제조"
              />
              {submitted && missingFields.companyName && <em>필수 항목입니다.</em>}
            </label>

            <div className="ff-field-row">
              <label>
                <span>사업장 소재지</span>
                <select
                  value={draft.regionSido}
                  onChange={(event) =>
                    updateDraft({ regionSido: event.target.value, regionSigungu: "" })
                  }
                >
                  <option value="">시도 선택</option>
                  {sidoOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>시군구</span>
                <select
                  value={draft.regionSigungu}
                  disabled={!draft.regionSido}
                  onChange={(event) => updateDraft({ regionSigungu: event.target.value })}
                >
                  <option value="">시군구 선택</option>
                  {(sigunguOptions[draft.regionSido] ?? ["산업단지", "일반지역"]).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            {submitted && missingFields.region && <p className="ff-field-error">지역을 선택해 주세요.</p>}

            <div className="ff-onboarding-industry">
              <label>
                <span>업종</span>
                <select
                  value={draft.industry}
                  onChange={(event) => handleIndustryNameChange(event.target.value)}
                >
                  <option value="">업종 선택</option>
                  {INDUSTRY_OPTIONS.map((item) => (
                    <option key={`${item.name}-${item.codes.join("-")}`} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="ff-setup-hint">선택한 업종과 연관된 지원사업 조건을 자동으로 확인합니다.</p>

              {submitted && missingFields.industry && (
                <p className="ff-field-error">업종을 선택해 주세요.</p>
              )}
            </div>

            <label>
              <span>상시근로자 수</span>
              <select
                value={draft.employeeRange}
                onChange={(event) => updateDraft({ employeeRange: event.target.value })}
              >
                <option value="">인원 구간 선택</option>
                {employeeRanges.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              {submitted && missingFields.employeeRange && <em>필수 항목입니다.</em>}
            </label>

            <details className="ff-optional-fields">
              <summary>선택 정보 추가하기</summary>
              <div className="ff-field-row">
                <label>
                  <span>설립연도</span>
                  <input
                    value={draft.foundedYear}
                    onChange={(event) => updateDraft({ foundedYear: event.target.value })}
                    placeholder="예: 2015"
                  />
                </label>
                <label>
                  <span>최근 매출 구간</span>
                  <select
                    value={draft.revenueRange}
                    onChange={(event) => updateDraft({ revenueRange: event.target.value })}
                  >
                    <option value="">선택 안 함</option>
                    {revenueRanges.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>스마트공장 구축 여부</span>
                <select
                  value={draft.smartFactoryStatus}
                  onChange={(event) => updateDraft({ smartFactoryStatus: event.target.value })}
                >
                  <option value="">선택 안 함</option>
                  {smartFactoryOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </details>

            <p className="ff-setup-helper">
              저장된 정보는 대시보드와 AI Advisor에서 이어서 활용됩니다.
            </p>

            <div className="ff-setup-actions">
              <button
                type="button"
                className="ff-primary-action"
                onClick={() => void handleContinue()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "저장 중..." : "저장하고 설비 정보 입력"}
              </button>
            </div>
            {submitError && <p className="ff-field-error" role="alert">{submitError}</p>}
          </section>
        </div>
      </section>
    </main>
  )
}
