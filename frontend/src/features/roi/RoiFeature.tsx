import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { requestRoiSimulation } from "./roi.api"
import { getAnalysisResult } from "../onboarding/onboardingState"
import { colors } from "./roi.constants"
import {
  EvidenceSection,
  FloatingModalNotice,
  InputPanel,
  PageHero,
} from "./components/RoiPageSections"
import { ExpectedBenefits, PolicyCta, RoiHero, RoiScenarioCards } from "./components/RoiResultSections"
import {
  buildLocalScenarios,
  buildPayload,
  buildScores,
  detectEquipmentTypeFromName,
  findIndustryCodeByName,
  findIndustryNameByCode,
  getDefaultEquipmentName,
  getErrorMessage,
  getInitialFormFromMyPage,
  getMissingRequiredInputLabels,
  getRecommendedScenarioId,
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
  const [searchParams] = useSearchParams()

  const inputSectionRef = useRef<HTMLDivElement | null>(null)
  const resultSectionRef = useRef<HTMLDivElement | null>(null)
  const savedResultLoaded = useRef(false)

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

  // 온보딩 분석 완료 후 `/roi?analysisId=xxx`로 진입했을 때
  // 저장된 백엔드 결과를 자동으로 불러와 재분석 없이 결과를 표시한다.
  useEffect(() => {
    if (savedResultLoaded.current) return
    savedResultLoaded.current = true

    const analysisId = searchParams.get("analysisId") ?? undefined
    const saved = getAnalysisResult(analysisId)

    if (import.meta.env.DEV) {
      console.debug("[RoiPage] auto-load: raw roiResult from storage", {
        analysisId,
        hasSnapshot: !!saved,
        hasRoiResult: !!saved?.roiResult,
        roiResult: saved?.roiResult,
      })
    }

    if (!saved?.roiResult) return

    const apiData = normalizeApiData(saved.roiResult)

    if (import.meta.env.DEV) {
      console.debug("[RoiPage] auto-load: normalized apiData", {
        success: !!apiData,
        scenario_a: apiData?.scenario_a,
        scenario_b: apiData?.scenario_b,
        recommended: apiData?.recommended,
      })
    }

    if (!apiData) return

    const localScenarios = buildLocalScenarios(initialLoadedForm)
    const merged = mergeApiScenarios(localScenarios, apiData)
    const nextRecommendedId = getRecommendedScenarioId(
      initialLoadedForm,
      merged.scenarios,
      merged.apiRecommended,
    )

    setScenarios(merged.scenarios)
    setRecommendedScenarioId(nextRecommendedId)
    setSelectedScenarioId(nextRecommendedId)
    setApiStatus("success")

    if (import.meta.env.DEV) {
      const scenA = merged.scenarios.find((s) => s.id === "A")
      const scenB = merged.scenarios.find((s) => s.id === "B")
      console.debug("[RoiPage] auto-load: final view-model", {
        analysisId,
        recommended: nextRecommendedId,
        scenario_a: scenA
          ? {
              roiPct: scenA.roiPct,
              paybackYears: scenA.paybackYears,
              annualNetBenefitManwon: scenA.annualNetBenefitManwon,
              netInvestmentManwon: scenA.netInvestmentManwon,
              investmentManwon: scenA.investmentManwon,
              subsidyManwon: scenA.subsidyManwon,
            }
          : null,
        scenario_b: scenB
          ? {
              roiPct: scenB.roiPct,
              paybackYears: scenB.paybackYears,
              annualNetBenefitManwon: scenB.annualNetBenefitManwon,
              netInvestmentManwon: scenB.netInvestmentManwon,
            }
          : null,
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* 새 분석 흐름 안내 배너 */}
      <div
        style={{
          background: "#eef2ff",
          borderBottom: "1px solid #c7d2fe",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#344ba0", fontSize: "13px", fontWeight: 900 }}>
          새로운 투자 분석 흐름이 준비됐습니다. 기업 정보·설비 조건 입력부터 지원사업 추천까지 한 번에 확인하세요.
        </span>
        <button
          type="button"
          onClick={() => navigate("/analysis/new")}
          style={{
            height: "36px",
            padding: "0 16px",
            borderRadius: "8px",
            border: "1px solid #344ba0",
            background: "#344ba0",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 950,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          새 투자 분석 시작하기 →
        </button>
      </div>

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
            onClick={() => navigate("/")}
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

          {apiStatus !== "idle" && (
            <section
              ref={resultSectionRef}
              style={{ marginTop: "34px" }}
            >
              <RoiHero
                form={form}
                recommendedScenario={recommendedScenario}
                recommendedScenarioId={recommendedScenarioId}
                onReset={handleReset}
                onNavigateSupport={() => navigate("/analysis/new")}
              />

              <ExpectedBenefits scenarioId={recommendedScenarioId} />

              <RoiScenarioCards
                scenarios={scenarios}
                recommendedScenarioId={recommendedScenarioId}
                selectedScenarioId={selectedScenarioId}
                onSelect={setSelectedScenarioId}
              />

              <PolicyCta onNavigateSupport={() => navigate("/analysis/new")} />

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
          )}
        </div>
      </section>
    </main>
  )
}

