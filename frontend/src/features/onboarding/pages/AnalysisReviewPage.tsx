import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { OnboardingStepper } from "../components/OnboardingStepper"
import { runOnboardingAnalysis } from "../onboardingAnalysisApi"
import {
  getAnalysisConditionDraft,
  getCompanyProfileDraft,
  saveAnalysisResult,
} from "../onboardingState"
import { buildRoiPath } from "../../roi/roiPaths"

const categoryLabels: Record<string, string> = {
  press: "프레스",
  cnc: "CNC",
  injection: "사출성형기",
  other: "기타 설비",
}

function formatManwon(raw?: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "")
  return digits ? `${Number(digits).toLocaleString("ko-KR")}만원` : "-"
}

function joinFilled(parts: string[], separator = " · ") {
  return parts.filter((part) => part.trim()).join(separator) || "-"
}

export default function AnalysisReviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get("draftId") || `analysis-${Date.now()}`
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const profile = useMemo(() => getCompanyProfileDraft(), [])
  const condition = useMemo(() => getAnalysisConditionDraft(), [])

  const industryText = profile.industry
    ? `${profile.industry}${profile.industryCode ? `(${profile.industryCode})` : ""}`
    : ""
  const regionText = [profile.regionSido, profile.regionSigungu]
    .filter((part) => part.trim())
    .join(" ")
  const companyLine = joinFilled([profile.companyName, industryText, regionText])
  const equipmentCategory =
    categoryLabels[condition.equipmentCategory] ?? condition.equipmentCategory
  const equipmentLine = condition.equipmentName || equipmentCategory || "-"
  const investmentLine = `예상 투자금 ${formatManwon(
    condition.investmentAmount || condition.investmentRange,
  )}`
  const purposeLine = `주요 목적 ${condition.purpose || "-"}`

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true)
    setErrorMessage("")

    try {
      const result = await runOnboardingAnalysis(draftId, profile, condition)
      saveAnalysisResult(result)
      navigate(buildRoiPath("strategy", { analysisId: draftId }))
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "투자 분석 중 오류가 발생했습니다.",
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <main className="ff-onboarding-page">
      <section className="ff-analysis-shell">
        <OnboardingStepper currentStep={3} />
        <section className="ff-review-panel">
          <p className="ff-onboarding-eyebrow">REVIEW</p>
          <h1>입력 내용을 확인해주세요</h1>
          <p>
            기업 정보와 투자 조건을 바탕으로 ROI, 회수기간, 맞춤 지원사업,
            신청 가능성을 분석합니다.
          </p>

          <div className="ff-review-list">
            <article>
              <span>01</span>
              <div>
                <strong>기업 정보</strong>
                <p className="ff-review-detail">{companyLine}</p>
              </div>
              <em>완료</em>
            </article>

            <article>
              <span>02</span>
              <div>
                <strong>투자 조건</strong>
                <p className="ff-review-detail">{equipmentLine}</p>
                <p className="ff-review-detail">{investmentLine}</p>
                <p className="ff-review-detail">{purposeLine}</p>
              </div>
              <em>완료</em>
            </article>

            <article>
              <span>03</span>
              <div>
                <strong>분석 예정 항목</strong>
                <p className="ff-review-detail">
                  ROI · 회수기간 · 맞춤 지원사업 · 신청 가능성
                </p>
              </div>
              <em>분석 준비 완료</em>
            </article>
          </div>

          {isAnalyzing && (
            <div className="ff-analysis-loading" role="status" aria-live="polite">
              <strong>분석 중...</strong>
              <span>ROI 계산</span>
              <span>회수기간 예측</span>
              <span>지원사업 조건 비교</span>
              <span>신청 가능성 정리</span>
            </div>
          )}

          {errorMessage && (
            <p className="ff-field-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="ff-setup-actions">
            <button
              type="button"
              className="ff-secondary-action"
              onClick={() => navigate(`/analysis/new?draftId=${draftId}`)}
              disabled={isAnalyzing}
            >
              투자 조건 수정
            </button>
            <button
              type="button"
              className="ff-primary-action"
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
            >
              투자 분석 시작하기
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}
