import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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

export default function AnalysisNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawMode = searchParams.get("mode")
  const equipmentId = searchParams.get("equipmentId")
  const parentAnalysisId = searchParams.get("parentAnalysisId")
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

  const handleAnalyze = async () => {
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
      navigate(`/roi?analysisId=${encodeURIComponent(id)}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "분석 중 오류가 발생했습니다.")
    } finally {
      setIsAnalyzing(false)
    }
  }

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
              <button className="ff-secondary-action" onClick={() => navigate("/analysis/new?mode=new")}>새 설비 등록 후 분석</button>
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
              <button className="ff-secondary-action" onClick={() => navigate("/analysis/new?mode=new")}>+ 새 설비 등록 후 분석</button>
            </div>
          )}
          {error && <p className="ff-field-error">{error}</p>}
        </section>
      </main>
    )
  }

  const readOnlyEquipment = mode !== "new_equipment"
  const isReanalysis = mode === "reanalysis"
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
    disabled = false,
  ) => (
    <label>
      <span>{label}</span>
      <div className="ff-input-with-unit">
        <input
          inputMode="numeric"
          value={numberValue(String(condition[key] ?? ""))}
          disabled={disabled}
          onChange={(event) => update({ [key]: event.target.value.replace(/,/g, "") })}
        />
        <span className="ff-input-unit">{unit}</span>
      </div>
    </label>
  )

  return (
    <main className="ff-onboarding-page">
      <header className="ff-setup-header"><button className="ff-logo-button" onClick={() => navigate("/dashboard")}>FactoFit</button></header>
      <section className="ff-analysis-shell">
        <div className="ff-edit-header">
          <p className="ff-onboarding-eyebrow">INVESTMENT CONDITIONS</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <section className="ff-edit-form-panel">
          <p className="ff-edit-section-title">설비 기본 정보</p>
          <div className="ff-placeholder-form">
            <label>
              <span>설비 종류</span>
              <select disabled={readOnlyEquipment} value={condition.equipmentCategory} onChange={(event) => update({ equipmentCategory: event.target.value })}>
                <option value="">설비 종류 선택</option>
                {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label><span>검토 설비명</span><input disabled={readOnlyEquipment} value={condition.equipmentName} onChange={(event) => update({ equipmentName: event.target.value })} /></label>
            {readOnlyEquipment && <label><span>공정</span><input disabled value={condition.process || selectedEquipment?.process || ""} /></label>}
            {numericField("사용연수", "ageYears", "년", readOnlyEquipment)}
          </div>
          {readOnlyEquipment && <p className="ff-setup-helper">설비 기본 정보를 수정하려면 설비 관리에서 변경하세요. <button className="ff-edit-company-edit-btn" onClick={() => navigate("/company")}>설비 관리로 이동</button></p>}
          <hr className="ff-edit-divider" />
          <p className="ff-edit-section-title">분석 조건</p>
          <div className="ff-placeholder-form">
            {!isReanalysis && (
              <div className="ff-purpose-field">
                <span className="ff-field-label">주요 목적</span>
                <div className="ff-purpose-chips">
                  {purposeOptions.map((purpose) => <button type="button" key={purpose} className={`ff-purpose-chip${condition.purpose === purpose ? " selected" : ""}`} onClick={() => update({ purpose })}>{purpose}</button>)}
                </div>
              </div>
            )}
            {numericField("연간 에너지 비용", "energyCostAnnual", "만원")}
            {numericField("월 유지보수 비용", "monthlyMaintenanceCost", "만원")}
            {numericField("불량률", "defectRate", "%")}
            {numericField("생산량", "monthlyProduction", "개/월")}
            {numericField("공헌이익", "contributionMarginWon", "원")}
            {numericField("A안 투자금", "investmentAmount", "만원")}
            {numericField("B안 투자금", "scenarioBInvestmentManwon", "만원")}
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
