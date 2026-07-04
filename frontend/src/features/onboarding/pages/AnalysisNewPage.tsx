import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { buildEquipmentRegisterPath } from "../../equipmentStatus/equipmentStatusPaths"
import {
  fetchAnalysisEntryContext,
  runExistingEquipmentAnalysis,
  runOnboardingAnalysis,
  type SavedEquipment,
} from "../onboardingAnalysisApi"
import {
  emptyAnalysisConditionDraft,
  getAnalysisResult,
  getCompanyProfileDraft,
  saveAnalysisResult,
  type AnalysisConditionDraft,
} from "../onboardingState"
import { buildRoiPath } from "../../roi/roiPaths"

type AnalysisMode = "start" | "new_equipment" | "existing_equipment" | "reanalysis"

const categoryOptions = [
  { label: "프레스", value: "press" },
  { label: "CNC", value: "cnc" },
  { label: "사출성형기", value: "injection" },
  { label: "기타 설비", value: "other" },
]
const purposeOptions = ["노후 설비 교체", "생산량 확대", "인력 절감", "에너지 절감", "안전성 개선"]

function createAnalysisId() {
  return `analysis-${Date.now()}`
}

function toDraft(equipment: SavedEquipment): AnalysisConditionDraft {
  return {
    ...emptyAnalysisConditionDraft,
    equipmentCategory: equipment.category,
    equipmentName: equipment.name,
    purpose: equipment.purpose,
    process: equipment.process,
    ageYears: equipment.ageYears,
    energyCostAnnual: equipment.energyCostAnnual,
    monthlyMaintenanceCost: equipment.monthlyMaintenanceCost,
    defectRate: equipment.defectRate,
    monthlyProduction: equipment.monthlyProduction,
    contributionMarginWon: equipment.contributionMarginWon,
    investmentAmount: equipment.investmentAmount,
    scenarioBInvestmentManwon: equipment.scenarioBInvestmentManwon,
  }
}

function numberValue(value: string | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits ? Number(digits).toLocaleString("ko-KR") : ""
}

function RequiredMark() {
  return <em className="ff-required-mark">*</em>
}

function FieldLabel({
  label,
  required = false,
}: {
  label: string
  required?: boolean
}) {
  return (
    <span>
      {label}
      {required ? <RequiredMark /> : null}
    </span>
  )
}

export default function AnalysisNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawMode = searchParams.get("mode")
  const equipmentId = searchParams.get("equipmentId")
  const parentAnalysisId = searchParams.get("parentAnalysisId")
  const autoRunRequested = ["1", "true", "yes"].includes(
    String(searchParams.get("autoRun") ?? "").toLowerCase(),
  )
  const autoRunHandledRef = useRef(false)
  const mode: AnalysisMode =
    rawMode === "new"
      ? "new_equipment"
      : rawMode === "existing"
        ? "existing_equipment"
        : rawMode === "reanalysis"
          ? "reanalysis"
          : "start"

  const profile = useMemo(() => getCompanyProfileDraft(), [])
  const [condition, setCondition] = useState<AnalysisConditionDraft>({
    ...emptyAnalysisConditionDraft,
  })
  const [equipments, setEquipments] = useState<SavedEquipment[]>([])
  const [companyId, setCompanyId] = useState("")
  const [showEquipmentList, setShowEquipmentList] = useState(false)
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false)
  const [isLoadingEquipmentList, setIsLoadingEquipmentList] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState("")
  const [loadError, setLoadError] = useState("")
  const selectedEquipment = equipments.find((item) => item.equipmentId === equipmentId)

  useEffect(() => {
    setError("")
    setLoadError("")
    setShowEquipmentList(false)

    if (mode === "start" || mode === "new_equipment") {
      setIsLoadingEquipment(false)
      setEquipments([])
      setCompanyId("")
      setCondition({ ...emptyAnalysisConditionDraft })
      return
    }

    let active = true
    const loadEquipment = async () => {
      setIsLoadingEquipment(true)
      try {
        const context = await fetchAnalysisEntryContext()
        if (!active) return
        setCompanyId(context.companyId)
        setEquipments(context.equipments)
        const equipment = context.equipments.find((item) => item.equipmentId === equipmentId)
        if (!equipment) throw new Error("선택한 설비를 찾을 수 없습니다.")
        const equipmentDraft = toDraft(equipment)
        if (mode === "reanalysis") {
          const previous = getAnalysisResult(parentAnalysisId ?? undefined)
          if (!previous) {
            throw new Error("이전 분석 이력을 찾을 수 없습니다.")
          }
          setCondition({
            ...equipmentDraft,
            ...(previous?.analysisInput ?? {}),
            equipmentCategory: equipmentDraft.equipmentCategory,
            equipmentName: equipmentDraft.equipmentName,
            process: equipmentDraft.process,
            ageYears: equipmentDraft.ageYears,
          })
        } else {
          setCondition(equipmentDraft)
        }
      } catch (reason) {
        if (active) {
          setLoadError(
            reason instanceof Error ? reason.message : "설비 정보를 불러오지 못했습니다.",
          )
        }
      } finally {
        if (active) setIsLoadingEquipment(false)
      }
    }

    if (
      (mode === "existing_equipment" || mode === "reanalysis") &&
      equipmentId &&
      (mode !== "reanalysis" ||
        (Boolean(parentAnalysisId) && equipmentId !== parentAnalysisId))
    ) {
      void loadEquipment()
    } else {
      setIsLoadingEquipment(false)
    }

    return () => {
      active = false
    }
  }, [equipmentId, mode, parentAnalysisId])

  const handleShowEquipmentList = async () => {
    setShowEquipmentList(true)
    setIsLoadingEquipmentList(true)
    setError("")
    try {
      const context = await fetchAnalysisEntryContext()
      setCompanyId(context.companyId)
      setEquipments(context.equipments)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "설비 목록을 불러오지 못했습니다.")
    } finally {
      setIsLoadingEquipmentList(false)
    }
  }

  const update = (patch: Partial<AnalysisConditionDraft>) =>
    setCondition((current) => ({ ...current, ...patch }))

  const handleAnalyze = useCallback(async () => {
    if (!condition.equipmentCategory || !condition.equipmentName || !condition.investmentAmount) {
      setError("설비 종류, 검토 설비명, A안 투자금을 입력해주세요.")
      return
    }
    setIsAnalyzing(true)
    setError("")
    const id = createAnalysisId()
    try {
      const result =
        mode === "new_equipment"
          ? await runOnboardingAnalysis(id, profile, condition)
          : await runExistingEquipmentAnalysis(
              id,
              profile,
              condition,
              companyId,
              equipmentId!,
            )
      saveAnalysisResult(result)
      navigate(buildRoiPath("strategy", { analysisId: result.id }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "분석 중 오류가 발생했습니다.")
    } finally {
      setIsAnalyzing(false)
    }
  }, [companyId, condition, equipmentId, mode, navigate, profile])

  const needsEquipmentLoading =
    (mode === "existing_equipment" || mode === "reanalysis") &&
    Boolean(equipmentId) &&
    isLoadingEquipment

  const invalidReanalysisMessage =
    mode === "reanalysis" && (!equipmentId || !parentAnalysisId)
      ? "재분석에 필요한 설비 또는 분석 정보가 없습니다."
      : mode === "reanalysis" && equipmentId === parentAnalysisId
        ? "설비 ID와 분석 ID가 올바르게 구분되지 않았습니다."
        : mode === "existing_equipment" && !equipmentId
          ? "분석할 설비 정보가 없습니다."
          : ""

  useEffect(() => {
    if (!autoRunRequested) return
    if (autoRunHandledRef.current) return
    if (mode !== "existing_equipment") return
    if (!equipmentId || isLoadingEquipment || isAnalyzing) return
    if (loadError || invalidReanalysisMessage) return

    autoRunHandledRef.current = true
    void handleAnalyze()
  }, [
    autoRunRequested,
    mode,
    equipmentId,
    isLoadingEquipment,
    isAnalyzing,
    loadError,
    invalidReanalysisMessage,
    handleAnalyze,
  ])

  if (mode === "new_equipment") {
    return <Navigate to={buildEquipmentRegisterPath({ source: "analysis" })} replace />
  }

  if (invalidReanalysisMessage) {
    return (
      <main className="ff-onboarding-page">
        <section className="ff-analysis-shell">
          <div className="ff-edit-form-panel">
            <h1>분석 조건을 불러올 수 없습니다.</h1>
            <p className="ff-field-error" role="alert">{invalidReanalysisMessage}</p>
            <button className="ff-primary-action" onClick={() => navigate("/company")}>
              설비 관리로 이동
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (needsEquipmentLoading) {
    return <main className="ff-onboarding-page"><div className="ff-analysis-loading">설비 정보를 불러오는 중...</div></main>
  }

  if (
    loadError &&
    (mode === "existing_equipment" || mode === "reanalysis")
  ) {
    return (
      <main className="ff-onboarding-page">
        <section className="ff-analysis-shell">
          <div className="ff-edit-form-panel">
            <h1>분석 조건을 불러올 수 없습니다.</h1>
            <p className="ff-field-error" role="alert">{loadError}</p>
            <button className="ff-primary-action" onClick={() => navigate("/company")}>
              설비 관리로 이동
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (mode === "start") {
    return (
      <main className="ff-onboarding-page">
        <header className="ff-setup-header"><button className="ff-logo-button" onClick={() => navigate("/dashboard")}>FactoFit</button></header>
        <section className="ff-analysis-shell">
          <div className="ff-edit-header">
            <p className="ff-onboarding-eyebrow">ROI ANALYSIS</p>
            <h1>새 투자 분석을 시작하세요</h1>
            <p>등록 설비를 다시 분석하거나,<br />새 설비의 투자 타당성을 검토할 수 있습니다.</p>
          </div>
          {!showEquipmentList ? (
            <div className="ff-edit-form-panel ff-setup-actions">
              <button className="ff-primary-action" onClick={handleShowEquipmentList}>등록된 설비 재분석</button>
              <button className="ff-secondary-action" onClick={() => navigate(buildEquipmentRegisterPath({ source: "analysis" }))}>새 설비 등록 후 분석</button>
            </div>
          ) : (
            <div className="ff-edit-form-panel">
              <h2>등록된 설비를 선택하세요.</h2>
              <div className="ff-analysis-grid">
                {isLoadingEquipmentList && <p>등록 설비 목록을 불러오는 중...</p>}
                {equipments.map((equipment) => (
                  <article className="ff-setup-note" key={equipment.equipmentId}>
                    <strong>{equipment.name}</strong>
                    <span>{equipment.category} · {equipment.purpose || "목적 미입력"} · 사용 {equipment.ageYears || "-"}년</span>
                    <button className="ff-primary-action" onClick={() => navigate(`/analysis/new?mode=existing&equipmentId=${encodeURIComponent(equipment.equipmentId)}`)}>이 설비로 분석</button>
                  </article>
                ))}
                {!isLoadingEquipmentList && equipments.length === 0 && <p>등록된 설비가 없습니다.</p>}
              </div>
              <button className="ff-secondary-action" onClick={() => navigate(buildEquipmentRegisterPath({ source: "analysis" }))}>+ 새 설비 등록 후 분석</button>
            </div>
          )}
          {error && <p className="ff-field-error">{error}</p>}
        </section>
      </main>
    )
  }

  const readOnlyEquipment = mode !== "new_equipment"
  const isReanalysis = mode === "reanalysis"
  const isNewEquipment = mode === "new_equipment"
  const title =
    mode === "new_equipment"
      ? "새 설비 투자 분석"
      : isReanalysis
        ? `${condition.equipmentName || "설비"} 분석 조건 조정`
        : `${condition.equipmentName || "설비"} 새 투자 분석`
  const description =
    mode === "new_equipment"
      ? "새 설비 정보를 입력하고 투자 효과를 분석하세요."
      : isReanalysis
        ? "이전 분석 조건을 바탕으로 비용과 투자 가정을 수정해 새 결과를 만듭니다."
        : "등록된 설비의 분석 조건을 조정해 새 ROI 결과를 만듭니다."

  const numericField = (
    label: string,
    key: keyof AnalysisConditionDraft,
    unit: string,
    options?: {
      disabled?: boolean
      placeholder?: string
      required?: boolean
    },
  ) => {
    const disabled = options?.disabled ?? false
    return (
      <label>
        <FieldLabel label={label} required={options?.required} />
        <div className="ff-input-with-unit">
          <input
            inputMode="numeric"
            placeholder={options?.placeholder}
            value={numberValue(String(condition[key] ?? ""))}
            disabled={disabled}
            onChange={(event) => update({ [key]: event.target.value.replace(/,/g, "") })}
          />
          <span className="ff-input-unit">{unit}</span>
        </div>
      </label>
    )
  }

  return (
    <main className={`ff-onboarding-page${isNewEquipment ? " ff-analysis-page--new-equipment" : ""}`}>
      <header className="ff-setup-header"><button className="ff-logo-button" onClick={() => navigate("/dashboard")}>FactoFit</button></header>
      <section className="ff-analysis-shell">
        <div className="ff-edit-header">
          <p className="ff-onboarding-eyebrow">INVESTMENT CONDITIONS</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <section className="ff-edit-form-panel">
          <p className="ff-edit-section-title">설비 기본 정보</p>
          <div
            className={
              isNewEquipment
                ? "ff-placeholder-form ff-analysis-field-grid ff-analysis-field-grid--two"
                : "ff-placeholder-form"
            }
          >
            <label>
              <FieldLabel label="설비 종류" required />
              <select disabled={readOnlyEquipment} value={condition.equipmentCategory} onChange={(event) => update({ equipmentCategory: event.target.value })}>
                <option value="">설비 종류 선택</option>
                {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <FieldLabel label="검토 설비명" required />
              <input
                disabled={readOnlyEquipment}
                placeholder="예: 프레스 1호기"
                value={condition.equipmentName}
                onChange={(event) => update({ equipmentName: event.target.value })}
              />
            </label>
            {readOnlyEquipment && (
              <label>
                <span>공정</span>
                <input disabled placeholder="예: 프레스" value={condition.process || selectedEquipment?.process || ""} />
              </label>
            )}
            {numericField("사용연수", "ageYears", "년", {
              disabled: readOnlyEquipment,
              placeholder: "예: 10",
            })}
          </div>
          {readOnlyEquipment && <p className="ff-setup-helper">설비 기본 정보를 수정하려면 설비 관리에서 변경하세요. <button className="ff-edit-company-edit-btn" onClick={() => navigate("/company")}>설비 관리로 이동</button></p>}
          <hr className="ff-edit-divider" />
          <p className="ff-edit-section-title">분석 조건</p>
          <div className="ff-placeholder-form">
            {!isReanalysis && (
              <div className="ff-purpose-field">
                <span className="ff-field-label">
                  주요 목적
                  <RequiredMark />
                </span>
                <div className="ff-purpose-chips">
                  {purposeOptions.map((purpose) => <button type="button" key={purpose} className={`ff-purpose-chip${condition.purpose === purpose ? " selected" : ""}`} onClick={() => update({ purpose })}>{purpose}</button>)}
                </div>
              </div>
            )}
            {isNewEquipment ? (
              <>
                <div className="ff-analysis-field-grid ff-analysis-field-grid--two">
                  {numericField("A안 투자금", "investmentAmount", "만원", {
                    placeholder: "예: 7,000",
                    required: true,
                  })}
                </div>
                <details className="ff-analysis-optional">
                  <summary>선택 정보를 입력하면 ROI 정확도가 높아집니다</summary>
                  <div className="ff-optional-inner ff-analysis-field-grid ff-analysis-field-grid--two">
                    {numericField("연간 에너지 비용", "energyCostAnnual", "만원", {
                      placeholder: "예: 5,000",
                    })}
                    {numericField("월 유지보수 비용", "monthlyMaintenanceCost", "만원", {
                      placeholder: "예: 100",
                    })}
                    {numericField("불량률", "defectRate", "%", {
                      placeholder: "예: 3",
                    })}
                    {numericField("생산량", "monthlyProduction", "개/월", {
                      placeholder: "예: 500",
                    })}
                    {numericField("공헌이익", "contributionMarginWon", "원", {
                      placeholder: "예: 12,000",
                    })}
                    {numericField("B안 투자금", "scenarioBInvestmentManwon", "만원", {
                      placeholder: "예: 4,994",
                    })}
                  </div>
                </details>
              </>
            ) : (
              <>
                {numericField("연간 에너지 비용", "energyCostAnnual", "만원", {
                  placeholder: "예: 5,000",
                })}
                {numericField("월 유지보수 비용", "monthlyMaintenanceCost", "만원", {
                  placeholder: "예: 100",
                })}
                {numericField("불량률", "defectRate", "%", {
                  placeholder: "예: 3",
                })}
                {numericField("생산량", "monthlyProduction", "개/월", {
                  placeholder: "예: 500",
                })}
                {numericField("공헌이익", "contributionMarginWon", "원", {
                  placeholder: "예: 12,000",
                })}
                {numericField("A안 투자금", "investmentAmount", "만원", {
                  placeholder: "예: 7,000",
                  required: true,
                })}
                {numericField("B안 투자금", "scenarioBInvestmentManwon", "만원", {
                  placeholder: "예: 4,994",
                })}
              </>
            )}
          </div>
          {error && <p className="ff-field-error" role="alert">{error}</p>}
          <div className="ff-edit-actions">
            <button className="ff-edit-cancel" onClick={() => navigate("/analysis/new")} disabled={isAnalyzing}>취소</button>
            <button className="ff-edit-submit" onClick={handleAnalyze} disabled={isAnalyzing}>{isAnalyzing ? "분석 중..." : "ROI 분석 실행"}</button>
          </div>
        </section>
      </section>
    </main>
  )
}
