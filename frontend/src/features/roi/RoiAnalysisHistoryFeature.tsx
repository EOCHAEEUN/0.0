import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type {
  DashboardEquipmentContract,
  DashboardOnboardingMeResponse,
  DashboardRoiOutputContract,
} from "../dashboard/dashboard.contract"
import { fetchDashboardOnboarding } from "../dashboard/dashboard.api"

function compactText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function formatDate(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value || "-"
  const date = new Date(parsed)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function getScenarioRecord(roiData: Record<string, unknown>) {
  const recommended = String(roiData.recommended ?? "").trim().toUpperCase()
  const scenario =
    recommended === "B"
      ? readRecord(roiData.scenario_b)
      : readRecord(roiData.scenario_a)
  return Object.keys(scenario).length > 0 ? scenario : readRecord(roiData.scenario_a)
}

function getRoiText(roiData: Record<string, unknown>) {
  const scenario = getScenarioRecord(roiData)
  const roi =
    parseNumber(scenario.roi_pct) ??
    parseNumber(scenario.roi_percent) ??
    parseNumber(roiData.roi_pct) ??
    parseNumber(roiData.roi_percent)
  return roi === null ? "-" : `${Math.round(roi)}%`
}

function getPaybackText(roiData: Record<string, unknown>) {
  const scenario = getScenarioRecord(roiData)
  const payback =
    parseNumber(scenario.payback_years) ??
    parseNumber(scenario.paybackYears) ??
    parseNumber(roiData.payback_years)
  return payback === null ? "-" : `${payback.toFixed(1)}년`
}

function getEquipmentName(
  equipments: DashboardEquipmentContract[],
  equipmentId: string,
  roiOutput: DashboardRoiOutputContract,
) {
  const matched = equipments.find(
    (equipment) =>
      compactText(equipment.equipment_id) === equipmentId ||
      compactText(equipment.id) === equipmentId,
  )
  return (
    compactText(matched?.name) ||
    compactText((roiOutput as { equipment_name?: string }).equipment_name) ||
    "검토 설비"
  )
}

function getPolicySummary(roiOutput: DashboardRoiOutputContract) {
  const snapshot = readRecord(roiOutput.policy_snapshot)
  const snapshotPolicies = Array.isArray(snapshot.policies) ? snapshot.policies : []
  if (!snapshot.snapshot_version || snapshotPolicies.length === 0) {
    return {
      priorityPolicyTitle: "정책 이력 없음",
      matchedCountText: "정책 이력 없음",
    }
  }
  const firstPolicy = readRecord(snapshotPolicies[0])
  const counts = readRecord(snapshot.counts)
  const matchedCount = parseNumber(counts.matched)
  return {
    priorityPolicyTitle: compactText(firstPolicy.title) || "정책 이력 없음",
    matchedCountText:
      matchedCount === null ? `${snapshotPolicies.length}건` : `${Math.max(0, matchedCount)}건`,
  }
}

function mapHistoryItems(onboarding: DashboardOnboardingMeResponse | null) {
  const companyName = compactText(onboarding?.company?.company_name) || "기업 정보 없음"
  const equipments = onboarding?.equipments ?? []
  const roiOutputs = Array.isArray(onboarding?.roi_outputs) ? onboarding.roi_outputs : []
  return [...roiOutputs]
    .sort((left, right) => Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? ""))
    .map((roiOutput) => {
      const analysisId =
        compactText(roiOutput.analysis_id) ||
        compactText(roiOutput.analysisId) ||
        compactText(roiOutput.id)
      const equipmentId = compactText(roiOutput.equipment_id)
      const roiData = readRecord(roiOutput.roi_data)
      const policySummary = getPolicySummary(roiOutput)
      return {
        analysisId,
        equipmentName: getEquipmentName(equipments, equipmentId, roiOutput),
        companyName,
        createdAt: compactText(roiOutput.created_at),
        roiText: getRoiText(roiData),
        paybackText: getPaybackText(roiData),
        priorityPolicyTitle: policySummary.priorityPolicyTitle,
        matchedCountText: policySummary.matchedCountText,
      }
    })
    .filter((item) => Boolean(item.analysisId))
}

export default function RoiAnalysisHistoryFeature() {
  const navigate = useNavigate()
  const [onboarding, setOnboarding] = useState<DashboardOnboardingMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const requestRef = useRef(0)

  useEffect(() => {
    const nextRequest = requestRef.current + 1
    requestRef.current = nextRequest
    setLoading(true)
    setError("")

    void fetchDashboardOnboarding()
      .then((result) => {
        if (requestRef.current !== nextRequest) return
        setOnboarding(result)
      })
      .catch((nextError) => {
        if (requestRef.current !== nextRequest) return
        setError(nextError instanceof Error ? nextError.message : "분석 이력을 불러오지 못했습니다.")
      })
      .finally(() => {
        if (requestRef.current !== nextRequest) return
        setLoading(false)
      })
  }, [])

  const historyItems = useMemo(() => mapHistoryItems(onboarding), [onboarding])

  return (
    <main className="page">
      <section className="section white">
        <div className="container" style={{ maxWidth: "1160px" }}>
          <button type="button" style={{ marginBottom: 16 }} className="ff-all-analysis-link" onClick={() => navigate("/dashboard")}>
            ← 대시보드로 돌아가기
          </button>
          <h1 style={{ marginBottom: 8 }}>ROI 분석 이력</h1>
          <p style={{ marginTop: 0, marginBottom: 20, color: "#64748b" }}>
            저장된 ROI 분석 결과를 최신순으로 확인할 수 있습니다.
          </p>

          {loading && <p>분석 이력을 불러오는 중입니다...</p>}
          {!loading && error && (
            <div className="ff-workspace-alert" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && historyItems.length === 0 && (
            <div className="ff-analysis-empty">
              <strong>저장된 ROI 분석 이력이 없습니다.</strong>
              <p>새 투자 분석을 시작하면 이력이 여기에 표시됩니다.</p>
            </div>
          )}

          {!loading && !error && historyItems.length > 0 && (
            <div className="ff-analysis-list">
              {historyItems.map((item, index) => (
                <article className="ff-analysis-row ff-roi-history-row" key={`${item.analysisId}-${item.createdAt}-${index}`}>
                  <div className="ff-analysis-main">
                    <div className="ff-analysis-title-line">
                      <strong>{item.equipmentName}</strong>
                      <span className="ff-status-badge completed">분석 완료</span>
                    </div>
                    <p>{item.companyName}</p>
                    <span>생성일 {formatDate(item.createdAt)}</span>
                    <em>
                      ROI {item.roiText} · 회수기간 {item.paybackText} · 우선 정책 {item.priorityPolicyTitle} · 매칭 공고{" "}
                      {item.matchedCountText}
                    </em>
                  </div>
                  <button
                    type="button"
                    className="ff-roi-history-result-btn"
                    onClick={() => navigate(`/roi?analysisId=${encodeURIComponent(item.analysisId)}`)}
                  >
                    결과 보기
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
