import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { OnboardingStepper } from "../components/OnboardingStepper"
import {
  createOnboardingEquipment,
  type OnboardingEquipmentInput,
} from "../onboardingAnalysisApi"
import {
  getUserOnboardingState,
  updateUserOnboardingState,
} from "../onboardingState"

const categoryOptions = [
  { label: "프레스", value: "press" },
  { label: "CNC", value: "cnc" },
  { label: "사출성형기", value: "injection" },
  { label: "기타 설비", value: "other" },
]

type EquipmentDraft = {
  name: string
  category: string
  ageYears: string
  process: string
  energyCostAnnual: string
}

const emptyDraft: EquipmentDraft = {
  name: "",
  category: "",
  ageYears: "",
  process: "",
  energyCostAnnual: "",
}

function toOptionalNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export default function EquipmentSetupPage() {
  const navigate = useNavigate()
  const onboardingState = useMemo(() => getUserOnboardingState(), [])
  const companyId = onboardingState.companyId ?? ""
  const [draft, setDraft] = useState<EquipmentDraft>(emptyDraft)
  const [submitted, setSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!companyId) {
      navigate("/setup/company", { replace: true })
      return
    }
    updateUserOnboardingState({ equipmentSetupStatus: "in_progress", companyId })
  }, [companyId, navigate])

  const missing = {
    name: !draft.name.trim(),
    category: !draft.category,
    ageYears: draft.ageYears.trim() === "",
  }

  const updateDraft = (patch: Partial<EquipmentDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const handleSubmit = async () => {
    setSubmitted(true)
    setError("")
    if (missing.name || missing.category || missing.ageYears || !companyId) return

    const ageYears = Number(draft.ageYears)
    if (!Number.isInteger(ageYears) || ageYears < 0) {
      setError("사용 연수는 0 이상의 정수로 입력해주세요.")
      return
    }

    const energyCostAnnual = toOptionalNumber(draft.energyCostAnnual)
    if (draft.energyCostAnnual.trim() && (energyCostAnnual === null || energyCostAnnual < 0)) {
      setError("연간 에너지 비용은 0 이상의 숫자로 입력해주세요.")
      return
    }

    const equipment: OnboardingEquipmentInput = {
      name: draft.name.trim(),
      category: draft.category,
      ageYears,
      process: draft.process.trim() || undefined,
      energyCostAnnual,
    }

    setIsSaving(true)
    try {
      await createOnboardingEquipment(companyId, equipment)
      updateUserOnboardingState({
        companyProfileStatus: "completed",
        equipmentSetupStatus: "completed",
        companyId,
      })
      navigate("/dashboard", { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "설비 정보를 저장하지 못했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="ff-onboarding-page">
      <header className="ff-setup-header">
        <button type="button" className="ff-logo-button" onClick={() => navigate("/dashboard")}>
          FactoFit
        </button>
        <span>보유 설비 등록</span>
      </header>

      <section className="ff-setup-shell">
        <OnboardingStepper currentStep={2} variant="setup" />

        <div className="ff-edit-header">
          <p className="ff-onboarding-eyebrow">EQUIPMENT SETUP</p>
          <h1>설비 정보를 등록해주세요</h1>
          <p>
            등록한 설비를 기반으로 이후 ROI 분석, 지원사업 추천, 안전 진단을 받을 수 있어요.
          </p>
        </div>

        <section className="ff-edit-form-panel">
          <p className="ff-edit-section-title">보유 설비 기본정보</p>
          <div className="ff-placeholder-form">
            <label>
              <span>설비명</span>
              <input
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                placeholder="예: 프레스 1호기"
              />
              {submitted && missing.name && <em>필수 항목입니다.</em>}
            </label>

            <label>
              <span>설비 종류</span>
              <select
                value={draft.category}
                onChange={(event) => updateDraft({ category: event.target.value })}
              >
                <option value="">설비 종류 선택</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {submitted && missing.category && <em>필수 항목입니다.</em>}
            </label>

            <label>
              <span>사용 연수</span>
              <div className="ff-input-with-unit">
                <input
                  inputMode="numeric"
                  value={draft.ageYears}
                  onChange={(event) =>
                    updateDraft({ ageYears: event.target.value.replace(/\D/g, "") })
                  }
                  placeholder="예: 5"
                />
                <span className="ff-input-unit">년</span>
              </div>
              {submitted && missing.ageYears && <em>필수 항목입니다.</em>}
            </label>

            <label>
              <span>사용 공정 <small>선택</small></span>
              <input
                value={draft.process}
                onChange={(event) => updateDraft({ process: event.target.value })}
                placeholder="예: 금속 프레스 공정"
              />
            </label>

            <label>
              <span>연간 에너지 비용 <small>선택</small></span>
              <div className="ff-input-with-unit">
                <input
                  inputMode="numeric"
                  value={draft.energyCostAnnual}
                  onChange={(event) =>
                    updateDraft({
                      energyCostAnnual: event.target.value.replace(/[^\d,]/g, ""),
                    })
                  }
                  placeholder="예: 1200"
                />
                <span className="ff-input-unit">만원</span>
              </div>
            </label>
          </div>

          <p className="ff-setup-helper">
            지금은 보유 설비의 기본정보만 저장합니다. ROI 분석은 대시보드에서 별도로 시작할 수 있습니다.
          </p>
          {error && <p className="ff-field-error" role="alert">{error}</p>}

          <div className="ff-edit-actions">
            <button
              type="button"
              className="ff-edit-submit"
              onClick={() => void handleSubmit()}
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "설비 등록 완료"}
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}
