import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { requestRoiSimulation } from "./roi.api"
import { colors } from "./roi.constants"
import {
  EvidenceSection,
  FloatingModalNotice,
  InputPanel,
  InvestmentEstimateSection,
  PageHero,
  ResultAndAiSection,
  ScenarioCompareSection,
} from "./components/RoiPageSections"
import {
  buildLocalScenarios,
  buildPayload,
  buildScores,
  detectEquipmentTypeFromName,
  findIndustryCodeByName,
  findIndustryNameByCode,
  getDefaultEquipmentName,
  getDescription,
  getErrorMessage,
  getInitialFormFromMyPage,
  getMissingRequiredInputLabels,
  getRecommendedScenarioId,
  getStatusLabel,
  hasConflictingEquipmentName,
  isDefaultEquipmentName,
  mergeApiScenarios,
  normalizeApiData,
  normalizeEquipmentTypeValue,
  toNumber,
} from "./roi.utils"
import type { ApiStatus, RoiFormState, ScenarioCard } from "./roi.contract"

export default function RoiFeature() {
  const navigate = useNavigate()

  const inputSectionRef = useRef<HTMLDivElement | null>(null)
  const resultSectionRef = useRef<HTMLDivElement | null>(null)

  const initialLoadedForm = useRef<RoiFormState>(getInitialFormFromMyPage()).current
  const [form, setForm] = useState<RoiFormState>(initialLoadedForm)
  const [scenarios, setScenarios] = useState<ScenarioCard[]>(() =>
    buildLocalScenarios(initialLoadedForm),
  )
  const [selectedScenarioId, setSelectedScenarioId] = useState<"A" | "B">("A")
  const [recommendedScenarioId, setRecommendedScenarioId] = useState<"A" | "B">("A")
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [requiredNoticeOpen, setRequiredNoticeOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [benchmarkOpen, setBenchmarkOpen] = useState(false)

  const handleFieldChange = (key: keyof RoiFormState, value: string) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [key]: value,
      }

      if (key === "equipmentType") {
        const nextEquipmentType = normalizeEquipmentTypeValue(value)
        next.equipmentType = nextEquipmentType

        if (
          !prev.equipmentName.trim() ||
          isDefaultEquipmentName(prev.equipmentName) ||
          hasConflictingEquipmentName(prev.equipmentName, nextEquipmentType)
        ) {
          next.equipmentName = getDefaultEquipmentName(nextEquipmentType)
        }
      }

      if (key === "equipmentName") {
        const detectedEquipmentType = detectEquipmentTypeFromName(value)

        if (detectedEquipmentType) {
          next.equipmentType = detectedEquipmentType
        }
      }

      if (key === "industryCode") {
        const nextIndustryCode = value.toUpperCase().replace(/\s/g, "")
        next.industryCode = nextIndustryCode

        const matchedIndustryName = findIndustryNameByCode(nextIndustryCode)

        if (matchedIndustryName) {
          next.industryName = matchedIndustryName
        }
      }

      if (key === "industryName") {
        const matchedIndustryCode = findIndustryCodeByName(value)

        if (matchedIndustryCode) {
          next.industryCode = matchedIndustryCode
        }
      }

      return next
    })
  }

  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0]

  const recommendedScenario =
    scenarios.find((scenario) => scenario.id === recommendedScenarioId) ?? scenarios[0]

  const selectedScores = buildScores(form, selectedScenario)
  const selectedStatusLabel = getStatusLabel(selectedScores)
  const selectedDescription = getDescription(form, selectedScenario, selectedScores)

  const summaryAccent = selectedScenario.id === "A" ? colors.green : colors.blue2
  const summarySoft = selectedScenario.id === "A" ? colors.greenSoft : "#EEF0FF"

  const currentEnergyCost = toNumber(form.annualEnergyCostManwon, 4500)
  const currentMaintenanceCost = toNumber(form.annualMaintenanceCostManwon, 1200)
  const currentDefectLoss = Math.round(
    toNumber(form.annualRevenueManwon, 320000) * (toNumber(form.defectRate, 5.8) / 100) * 0.12,
  )

  const selectedEnergyAfter = Math.max(
    currentEnergyCost - selectedScenario.energySavingManwon,
    0,
  )

  const selectedMaintenanceAfter = Math.max(
    currentMaintenanceCost - selectedScenario.maintenanceSavingManwon,
    0,
  )

  const selectedDefectAfter = Math.max(
    currentDefectLoss - selectedScenario.defectSavingManwon,
    0,
  )

  const costMax = Math.max(
    currentEnergyCost,
    currentMaintenanceCost,
    currentDefectLoss,
    selectedEnergyAfter,
    selectedMaintenanceAfter,
    selectedDefectAfter,
    1,
  )

  const toBarWidth = (value: number) => `${Math.max((value / costMax) * 100, 4)}%`

  const benchmarkIndustryName =
    form.industryName || findIndustryNameByCode(form.industryCode) || "업종명 미확인"

  const handleCalculate = async () => {
    const missingLabels = getMissingRequiredInputLabels(form)

    if (missingLabels.length > 0) {
      setRequiredNoticeOpen(true)
      return
    }

    setApiStatus("loading")
    setErrorMessage("")

    const localScenarios = buildLocalScenarios(form)

    try {
      const payload = buildPayload(form)
      const apiResponse = await requestRoiSimulation(payload)
      const apiData = normalizeApiData(apiResponse)
      const merged = mergeApiScenarios(localScenarios, apiData)

      const nextRecommendedId = getRecommendedScenarioId(
        form,
        merged.scenarios,
        merged.apiRecommended,
      )

      setScenarios(merged.scenarios)
      setRecommendedScenarioId(nextRecommendedId)
      setSelectedScenarioId(nextRecommendedId)
      setApiStatus(apiData ? "success" : "empty")

      window.requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      })
    } catch (error) {
      const nextRecommendedId = getRecommendedScenarioId(form, localScenarios, "")

      setScenarios(localScenarios)
      setRecommendedScenarioId(nextRecommendedId)
      setSelectedScenarioId(nextRecommendedId)
      setApiStatus("error")
      setErrorMessage(getErrorMessage(error))

      window.requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      })
    }
  }

  const handleReset = () => {
    const resetForm = getInitialFormFromMyPage()
    const initialScenarios = buildLocalScenarios(resetForm)

    setForm(resetForm)
    setScenarios(initialScenarios)
    setRecommendedScenarioId("A")
    setSelectedScenarioId("A")
    setApiStatus("idle")
    setErrorMessage("")
    setCostOpen(false)
    setBenchmarkOpen(false)

    window.requestAnimationFrame(() => {
      inputSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  return (
    <main className="page">
      <FloatingModalNotice
        open={requiredNoticeOpen}
        title="필수 정보를 먼저 입력해주세요."
        description="기본정보, 기업정보, 설비현황의 필수 항목이 모두 입력되어야 분석을 시작할 수 있습니다."
        description2="필수값을 입력하고 저장한 뒤 다시 분석하기를 눌러주세요."
        onClose={() => setRequiredNoticeOpen(false)}
      />

      <section className="section white">
        <div
          className="container"
          style={{
            width: "min(1280px, calc(100% - 40px))",
            margin: "0 auto",
            paddingBottom: "56px",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            style={{
              marginBottom: "28px",
              height: "44px",
              padding: "0 18px",
              borderRadius: "999px",
              border: `1px solid ${colors.line}`,
              background: colors.card,
              color: colors.navy,
              fontSize: "14px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 8px 22px rgba(6,27,52,.06)",
            }}
          >
            ← 대시보드로 돌아가기
          </button>

          <PageHero />

          <InputPanel
            inputSectionRef={inputSectionRef}
            form={form}
            apiStatus={apiStatus}
            errorMessage={errorMessage}
            onChange={handleFieldChange}
            onCalculate={handleCalculate}
          />

          <section
            ref={resultSectionRef}
            style={{
              marginTop: "34px",
            }}
          >
            <ResultAndAiSection
              form={form}
              selectedScenario={selectedScenario}
              recommendedScenario={recommendedScenario}
              recommendedScenarioId={recommendedScenarioId}
              selectedScenarioId={selectedScenarioId}
              selectedScores={selectedScores}
              selectedStatusLabel={selectedStatusLabel}
              selectedDescription={selectedDescription}
              summaryAccent={summaryAccent}
              summarySoft={summarySoft}
              onReset={handleReset}
              onNavigateSupport={() => navigate("/support-projects")}
            />

            <ScenarioCompareSection
              scenarios={scenarios}
              recommendedScenarioId={recommendedScenarioId}
              selectedScenarioId={selectedScenarioId}
              onSelect={setSelectedScenarioId}
            />

            <InvestmentEstimateSection
              scenarios={scenarios}
              selectedScenarioId={selectedScenarioId}
            />

            <EvidenceSection
              costOpen={costOpen}
              benchmarkOpen={benchmarkOpen}
              onToggleCost={() => setCostOpen((prev) => !prev)}
              onToggleBenchmark={() => setBenchmarkOpen((prev) => !prev)}
              currentEnergyCost={currentEnergyCost}
              currentMaintenanceCost={currentMaintenanceCost}
              currentDefectLoss={currentDefectLoss}
              selectedEnergyAfter={selectedEnergyAfter}
              selectedMaintenanceAfter={selectedMaintenanceAfter}
              selectedDefectAfter={selectedDefectAfter}
              costMax={costMax}
              toBarWidth={toBarWidth}
              benchmarkIndustryName={benchmarkIndustryName}
              form={form}
              selectedScores={selectedScores}
            />
          </section>
        </div>
      </section>
    </main>
  )
}

