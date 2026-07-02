import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  COMPANY_ID_STORAGE_KEY,
  EQUIPMENT_ID_STORAGE_KEY,
  SELECTED_EQUIPMENT_ID_STORAGE_KEY,
} from "../../mypage/myPage.parts"
import { OnboardingStepper } from "../components/OnboardingStepper"
import { runSetupRoiAnalysis } from "../onboardingAnalysisApi"
import {
  getUserOnboardingState,
  saveAnalysisResult,
  updateUserOnboardingState,
} from "../onboardingState"
import { buildRoiPath } from "../../roi/roiPaths"

const SETUP_EQUIPMENT_NAME_KEY = "factofit_setup_equipment_name"

export default function SetupCompletePage() {
  const navigate = useNavigate()
  const onboardingState = useMemo(() => getUserOnboardingState(), [])
  const companyId =
    onboardingState.companyId ?? window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) ?? ""
  const equipmentId =
    window.localStorage.getItem(SELECTED_EQUIPMENT_ID_STORAGE_KEY) ??
    window.localStorage.getItem(EQUIPMENT_ID_STORAGE_KEY) ??
    ""

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState("")

  const handleAnalyze = async () => {
    if (!companyId || !equipmentId) {
      setError("기업 또는 설비 정보가 없습니다. 설비 정보를 다시 저장해 주세요.")
      return
    }

    setIsAnalyzing(true)
    setError("")
    try {
      const equipmentName =
        window.localStorage.getItem(SETUP_EQUIPMENT_NAME_KEY)?.trim() || "검토 설비"
      const snapshot = await runSetupRoiAnalysis(companyId, equipmentId, equipmentName)
      saveAnalysisResult(snapshot)
      updateUserOnboardingState({
        equipmentSetupStatus: "completed",
        companyId,
        analysisDraftStatus: "completed",
        analysisDraftId: snapshot.id,
      })
      navigate(buildRoiPath("strategy", { analysisId: snapshot.id }))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ROI 분석 중 오류가 발생했습니다.",
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <main className="ff-onboarding-page">
      <header className="ff-setup-header">
        <button type="button" className="ff-logo-button" onClick={() => navigate("/dashboard")}>
          FactoFit
        </button>
      </header>

      <section className="ff-setup-shell ff-setup-complete-shell">
        <OnboardingStepper currentStep={3} variant="setup" />

        <section className="ff-setup-complete-panel">
          <div className="ff-setup-complete-icon" aria-hidden="true">
            ✓
          </div>
          <p className="ff-onboarding-eyebrow">REGISTRATION COMPLETE</p>
          <h1>등록이 완료되었습니다.</h1>
          <p>
            입력하신 기업·설비 정보를 바탕으로 ROI 분석과 맞춤 지원사업 추천을 바로
            시작할 수 있습니다.
          </p>

          <div className="ff-setup-complete-summary">
            <article>
              <span>기업 정보</span>
              <strong>저장 완료</strong>
            </article>
            <article>
              <span>설비 정보</span>
              <strong>{equipmentId ? "1개 등록" : "등록 확인 필요"}</strong>
            </article>
            <article>
              <span>맞춤 결과</span>
              <strong>생성 준비</strong>
            </article>
          </div>

          {error ? (
            <p className="ff-field-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ff-setup-actions ff-setup-actions--center">
            <button
              type="button"
              className="ff-secondary-action"
              onClick={() => navigate("/setup/equipment")}
              disabled={isAnalyzing}
            >
              설비 정보 수정
            </button>
            <button
              type="button"
              className="ff-primary-action"
              onClick={() => void handleAnalyze()}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "분석 중..." : "분석하기"}
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}
