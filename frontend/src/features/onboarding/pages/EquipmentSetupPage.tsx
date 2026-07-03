import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  COMPANY_ID_STORAGE_KEY,
  EQUIPMENT_ID_STORAGE_KEY,
  SELECTED_EQUIPMENT_ID_STORAGE_KEY,
  createEmptyEquipment,
  countEquipmentOptionalFieldsFilled,
  EquipmentCategoryHelpTooltip,
  EquipmentOptionalAccordion,
  EQUIPMENT_CATEGORY_OPTIONS,
  Field,
  findEquipmentId,
  formatCommaNumber,
  getErrorMessage,
  hasRequiredEquipmentFields,
  InfoTooltip,
  normalizeCommaNumber,
  SelectField,
  submitEquipmentPayload,
  toNumberOrNull,
  toPositiveNumber,
  type EquipmentInfo,
  type EquipmentPayload,
} from "../../mypage/myPage.parts"
import {
  OnboardingFormCard,
  OnboardingSetupLayout,
} from "../components/OnboardingSetupLayout"
import {
  getUserOnboardingState,
  updateUserOnboardingState,
} from "../onboardingState"

type EquipmentPayloadFallback = {
  process: string | null
  defect_rate: number | null
  maintenance_cost_annual: number | null
  current_capacity_value: number | null
  production_qty: number | null
  contribution_margin_won: number | null
  scenario_a_investment_manwon: number | null
  scenario_b_investment_manwon: number | null
}

function normalizeEquipmentCategory(category: string) {
  const normalized = category.trim().toLowerCase()
  if (normalized.includes("press") || normalized.includes("프레스")) return "press"
  if (normalized.includes("cnc") || normalized.includes("공작") || normalized.includes("가공")) {
    return "cnc"
  }
  if (normalized.includes("injection") || normalized.includes("사출")) return "injection"
  return "etc"
}

function getEquipmentPayloadFallback(
  equipment: EquipmentInfo,
  energyCostAnnual: number,
): EquipmentPayloadFallback {
  const category = normalizeEquipmentCategory(equipment.category)
  const energyBasedMaintenance =
    energyCostAnnual > 0 ? Math.round(energyCostAnnual * 0.018) : null

  if (category === "press") {
    return {
      process: "프레스공정",
      defect_rate: 3.4,
      maintenance_cost_annual: energyBasedMaintenance ?? 900,
      current_capacity_value: 250,
      production_qty: 120000,
      contribution_margin_won: 18000,
      scenario_a_investment_manwon: 20000,
      scenario_b_investment_manwon: 4000,
    }
  }

  if (category === "cnc") {
    return {
      process: "cnc",
      defect_rate: 1.6,
      maintenance_cost_annual: energyBasedMaintenance ?? 420,
      current_capacity_value: 35,
      production_qty: 85000,
      contribution_margin_won: 22000,
      scenario_a_investment_manwon: 10000,
      scenario_b_investment_manwon: 3000,
    }
  }

  if (category === "injection") {
    return {
      process: "사출공정",
      defect_rate: 2.8,
      maintenance_cost_annual: energyBasedMaintenance ?? 780,
      current_capacity_value: 450,
      production_qty: 100000,
      contribution_margin_won: 16000,
      scenario_a_investment_manwon: 18000,
      scenario_b_investment_manwon: 5000,
    }
  }

  return {
    process: equipment.process.trim() || null,
    defect_rate: 3,
    maintenance_cost_annual: energyBasedMaintenance ?? 500,
    current_capacity_value: 100,
    production_qty: 50000,
    contribution_margin_won: 12000,
    scenario_a_investment_manwon: 12000,
    scenario_b_investment_manwon: 4000,
  }
}

function buildEquipmentPayloadItem(equipment: EquipmentInfo): EquipmentPayload {
  const energyCostAnnual =
    toPositiveNumber(normalizeCommaNumber(equipment.annualEnergyCost)) ?? 0
  const fallback = getEquipmentPayloadFallback(equipment, energyCostAnnual)

  return {
    equipment_id: equipment.equipmentId ?? null,
    name: equipment.name.trim(),
    category: equipment.category === "선택 필요" ? "etc" : equipment.category,
    process: equipment.process.trim() || fallback.process,
    age_years: toPositiveNumber(equipment.years) ?? 0,
    energy_cost_annual: energyCostAnnual,
    defect_rate: toNumberOrNull(equipment.defectRate) ?? fallback.defect_rate,
    maintenance_cost_annual:
      toNumberOrNull(normalizeCommaNumber(equipment.maintenanceCostAnnual)) ??
      fallback.maintenance_cost_annual,
    current_capacity_value:
      toNumberOrNull(equipment.currentCapacityValue) ??
      fallback.current_capacity_value,
    production_qty:
      toNumberOrNull(equipment.productionQty) ?? fallback.production_qty,
    contribution_margin_won:
      toNumberOrNull(normalizeCommaNumber(equipment.contributionMarginWon)) ??
      fallback.contribution_margin_won,
    scenario_a_investment_manwon:
      toNumberOrNull(normalizeCommaNumber(equipment.scenarioAInvestment)) ??
      fallback.scenario_a_investment_manwon,
    scenario_b_investment_manwon:
      toNumberOrNull(normalizeCommaNumber(equipment.scenarioBInvestment)) ??
      fallback.scenario_b_investment_manwon,
  }
}

export default function EquipmentSetupPage() {
  const navigate = useNavigate()
  const onboardingState = getUserOnboardingState()
  const companyId =
    onboardingState.companyId ?? window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) ?? ""

  const [equipmentList, setEquipmentList] = useState<EquipmentInfo[]>([
    createEmptyEquipment(1),
  ])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [energyTooltipEquipmentId, setEnergyTooltipEquipmentId] = useState<number | null>(null)
  const [capacityTooltipEquipmentId, setCapacityTooltipEquipmentId] = useState<number | null>(null)
  const [equipmentOptionalOpen, setEquipmentOptionalOpen] = useState<
    Record<number, boolean>
  >({})

  useEffect(() => {
    if (!companyId) {
      navigate("/setup/company", { replace: true })
      return
    }
    updateUserOnboardingState({ equipmentSetupStatus: "in_progress", companyId })
  }, [companyId, navigate])

  const updateEquipment = (
    id: number,
    key: keyof EquipmentInfo,
    value: string,
  ) => {
    setEquipmentList((prev) =>
      prev.map((equipment) =>
        equipment.id === id ? { ...equipment, [key]: value } : equipment,
      ),
    )
  }

  const toggleEquipmentOptional = (equipmentId: number) => {
    setEquipmentOptionalOpen((prev) => ({
      ...prev,
      [equipmentId]: !prev[equipmentId],
    }))
  }

  const isEquipmentOptionalOpen = (equipmentId: number) =>
    Boolean(equipmentOptionalOpen[equipmentId])

  const addEquipment = () => {
    const nextId =
      equipmentList.length > 0
        ? Math.max(...equipmentList.map((equipment) => equipment.id)) + 1
        : 1
    setEquipmentList((prev) => [...prev, createEmptyEquipment(nextId)])
    setSelectedEquipmentId(nextId)
  }

  const removeEquipment = (id: number) => {
    if (equipmentList.length <= 1) return
    const nextList = equipmentList.filter((equipment) => equipment.id !== id)
    setEquipmentList(nextList)
    setEquipmentOptionalOpen((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (selectedEquipmentId === id) {
      setSelectedEquipmentId(nextList[0]?.id ?? 1)
    }
  }

  const handleSubmit = async () => {
    setSubmitted(true)
    setError("")

    const completedEquipments = equipmentList.filter(hasRequiredEquipmentFields)
    if (completedEquipments.length === 0) {
      setError("설비 필수 항목(종류, 설비명, 사용연수, 연간 에너지 비용)을 입력해 주세요.")
      return
    }

    setIsSaving(true)
    try {
      let nextEquipmentList = [...equipmentList]

      for (const equipment of completedEquipments) {
        const response = await submitEquipmentPayload(
          companyId,
          buildEquipmentPayloadItem(equipment),
        )
        const equipmentUuid = findEquipmentId(response)
        if (equipmentUuid) {
          nextEquipmentList = nextEquipmentList.map((item) =>
            item.id === equipment.id ? { ...item, equipmentId: equipmentUuid } : item,
          )
        }
      }

      const primaryEquipment =
        nextEquipmentList.find((item) => item.id === selectedEquipmentId) ??
        nextEquipmentList.find((item) => item.equipmentId) ??
        nextEquipmentList[0]

      if (primaryEquipment?.equipmentId) {
        window.localStorage.setItem(EQUIPMENT_ID_STORAGE_KEY, primaryEquipment.equipmentId)
        window.localStorage.setItem(
          SELECTED_EQUIPMENT_ID_STORAGE_KEY,
          primaryEquipment.equipmentId,
        )
        if (primaryEquipment.name.trim()) {
          window.localStorage.setItem(
            "factofit_setup_equipment_name",
            primaryEquipment.name.trim(),
          )
        }
      }

      setEquipmentList(nextEquipmentList)
      updateUserOnboardingState({
        equipmentSetupStatus: "completed",
        companyId,
      })
      navigate("/setup/complete")
    } catch (reason) {
      setError(getErrorMessage(reason))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingSetupLayout
      step={2}
      eyebrow="2단계 · 설비 및 투자 정보"
      title="설비 및 투자 정보를 알려주세요."
      description={
        <>
          보유 설비와 예상 투자 조건을 입력하면 ROI 분석과 지원사업 추천의 정확도가
          높아집니다. 필수 항목만 먼저 입력해도 다음 단계로 진행할 수 있어요.
        </>
      }
      note={
        <>
          <strong>왜 필요한가요?</strong>
          <span>
            설비 노후도, 에너지 비용, 투자 규모에 따라 ROI와 지원사업 적합도가 달라집니다.
          </span>
        </>
      }
      footer={
        <>
          {error ? (
            <p className="ff-field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="ff-setup-actions ff-setup-actions--split">
            <button
              type="button"
              className="ff-secondary-action"
              onClick={() => navigate("/setup/company")}
              disabled={isSaving}
            >
              이전 단계
            </button>
            <button
              type="button"
              className="ff-primary-action"
              onClick={() => void handleSubmit()}
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "저장하고 맞춤 결과 확인"}
            </button>
          </div>
        </>
      }
    >
      <div className="ff-setup-equipment-toolbar">
        <button type="button" className="ff-secondary-action" onClick={addEquipment}>
          + 설비 추가
        </button>
      </div>

      <div className="ff-setup-equipment-stack">
        {equipmentList.map((equipment, index) => {
          const isSelected = equipment.id === selectedEquipmentId
          const missingRequired = submitted && !hasRequiredEquipmentFields(equipment)

          return (
            <OnboardingFormCard
              key={equipment.id}
              title={`설비 ${index + 1}`}
              description={
                missingRequired
                  ? "필수 항목(종류, 설비명, 사용연수, 연간 에너지 비용)을 입력해 주세요."
                  : undefined
              }
            >
              <div className="ff-setup-equipment-card-actions">
                <button
                  type="button"
                  className={`ff-setup-equipment-select${isSelected ? " is-selected" : ""}`}
                  onClick={() => setSelectedEquipmentId(equipment.id)}
                >
                  {isSelected ? "ROI 분석 대상" : "분석 대상으로 선택"}
                </button>
                {equipmentList.length > 1 ? (
                  <button
                    type="button"
                    className="ff-setup-equipment-delete"
                    onClick={() => removeEquipment(equipment.id)}
                  >
                    삭제
                  </button>
                ) : null}
              </div>

              <section className="ff-setup-equipment-basic">
                <h3>설비 기본 정보</h3>
                <div className="ff-mypage-equipment-required">
                  <SelectField
                    label="설비 종류"
                    required
                    labelRight={<EquipmentCategoryHelpTooltip />}
                    value={equipment.category}
                    onChange={(value) => updateEquipment(equipment.id, "category", value)}
                    options={EQUIPMENT_CATEGORY_OPTIONS}
                  />
                  <Field
                    label="설비명"
                    required
                    value={equipment.name}
                    placeholder="예: 프레스 1호기"
                    onChange={(value) => updateEquipment(equipment.id, "name", value)}
                  />
                  <Field
                    label="설비 사용연수"
                    required
                    value={equipment.years}
                    placeholder="예: 10"
                    helperText="단위: 년"
                    inputMode="numeric"
                    onChange={(value) => updateEquipment(equipment.id, "years", value)}
                  />
                  <Field
                    label="연간 에너지 비용"
                    required
                    value={equipment.annualEnergyCost}
                    placeholder="예: 5,000"
                    helperText="단위: 만원"
                    inputMode="numeric"
                    labelRight={
                      <span
                        style={{ position: "relative", display: "inline-flex" }}
                        onMouseEnter={() => setEnergyTooltipEquipmentId(equipment.id)}
                        onMouseLeave={() => setEnergyTooltipEquipmentId(null)}
                        onFocus={() => setEnergyTooltipEquipmentId(equipment.id)}
                        onBlur={() => setEnergyTooltipEquipmentId(null)}
                      >
                        <button type="button" aria-label="연간 에너지 비용 안내" className="ff-setup-info-button">
                          i
                        </button>
                        <InfoTooltip
                          open={energyTooltipEquipmentId === equipment.id}
                          text="해당 설비를 1년 동안 운영하는 전기·가스 등 에너지 비용을 만원 단위로 입력합니다."
                        />
                      </span>
                    }
                    onChange={(value) =>
                      updateEquipment(
                        equipment.id,
                        "annualEnergyCost",
                        formatCommaNumber(value),
                      )
                    }
                  />
                </div>
              </section>

              <EquipmentOptionalAccordion
                title="선택정보 입력하기"
                description="공정·투자비용·운영지표를 입력하면 분석 정확도를 높일 수 있어요."
                open={isEquipmentOptionalOpen(equipment.id)}
                filledCount={countEquipmentOptionalFieldsFilled(equipment)}
                onToggle={() => toggleEquipmentOptional(equipment.id)}
              >
                <div className="ff-setup-optional-groups">
                  <section className="ff-setup-optional-group">
                    <h4>설비 상세 정보</h4>
                    <div className="ff-setup-field-grid ff-setup-field-grid--two">
                      <Field
                        label="공정"
                        selectable
                        value={equipment.process}
                        placeholder="예: 프레스"
                        onChange={(value) => updateEquipment(equipment.id, "process", value)}
                      />
                      <Field
                        label="불량률"
                        selectable
                        value={equipment.defectRate}
                        placeholder="예: 3"
                        helperText="% 단위"
                        onChange={(value) => updateEquipment(equipment.id, "defectRate", value)}
                      />
                    </div>
                  </section>

                  <section className="ff-setup-optional-group">
                    <h4>실제 투자비용</h4>
                    <div className="ff-setup-field-grid ff-setup-field-grid--two">
                      <Field
                        label="전체교체 예상 투자금"
                        value={equipment.scenarioAInvestment}
                        placeholder="예: 22,000"
                        helperText="단위: 만원"
                        inputMode="numeric"
                        onChange={(value) =>
                          updateEquipment(
                            equipment.id,
                            "scenarioAInvestment",
                            formatCommaNumber(value),
                          )
                        }
                      />
                      <Field
                        label="부분교체 예상 투자금"
                        value={equipment.scenarioBInvestment}
                        placeholder="예: 4,994"
                        helperText="단위: 만원"
                        inputMode="numeric"
                        onChange={(value) =>
                          updateEquipment(
                            equipment.id,
                            "scenarioBInvestment",
                            formatCommaNumber(value),
                          )
                        }
                      />
                    </div>
                    <p className="ff-setup-helper ff-setup-helper--compact">
                      입력하지 않으면 업계 평균 투자금으로 ROI를 추정합니다. 입력하면 실제
                      투자 계획에 가까운 ROI 분석이 가능합니다.
                    </p>
                  </section>

                  <section className="ff-setup-optional-group">
                    <h4>추가 운영지표</h4>
                    <div className="ff-setup-field-grid ff-setup-field-grid--four">
                      <Field
                        label="연간 유지보수 비용"
                        value={equipment.maintenanceCostAnnual}
                        placeholder="예: 1,200"
                        helperText="단위: 만원"
                        inputMode="numeric"
                        onChange={(value) =>
                          updateEquipment(
                            equipment.id,
                            "maintenanceCostAnnual",
                            formatCommaNumber(value),
                          )
                        }
                      />
                      <Field
                        label="설비 용량 규격값"
                        value={equipment.currentCapacityValue}
                        placeholder="예: 100"
                        labelRight={
                          <span
                            style={{ position: "relative", display: "inline-flex" }}
                            onMouseEnter={() => setCapacityTooltipEquipmentId(equipment.id)}
                            onMouseLeave={() => setCapacityTooltipEquipmentId(null)}
                            onFocus={() => setCapacityTooltipEquipmentId(equipment.id)}
                            onBlur={() => setCapacityTooltipEquipmentId(null)}
                          >
                            <button
                              type="button"
                              aria-label="설비 용량 규격값 안내"
                              className="ff-setup-info-button"
                            >
                              i
                            </button>
                            <InfoTooltip
                              open={capacityTooltipEquipmentId === equipment.id}
                              text="보조 단위: 프레스/사출기: 톤, CNC: kW"
                            />
                          </span>
                        }
                        onChange={(value) =>
                          updateEquipment(equipment.id, "currentCapacityValue", value)
                        }
                      />
                      <Field
                        label="연간 생산량"
                        value={equipment.productionQty}
                        placeholder="예: 50000"
                        inputMode="numeric"
                        onChange={(value) =>
                          updateEquipment(equipment.id, "productionQty", value)
                        }
                      />
                      <Field
                        label="제품 개당 예상이익"
                        value={equipment.contributionMarginWon}
                        placeholder="예: 12,000"
                        helperText="원 단위"
                        inputMode="numeric"
                        onChange={(value) =>
                          updateEquipment(
                            equipment.id,
                            "contributionMarginWon",
                            formatCommaNumber(value),
                          )
                        }
                      />
                    </div>
                  </section>
                </div>
              </EquipmentOptionalAccordion>
            </OnboardingFormCard>
          )
        })}
      </div>
    </OnboardingSetupLayout>
  )
}
