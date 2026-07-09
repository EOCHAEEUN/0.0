import { Bot, CircleHelp, Info, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import DashboardWorkspaceSidebar from "../../components/layout/DashboardWorkspaceSidebar"
import {
  fetchDashboardOnboarding,
  getStoredCompanyId,
  notifyDashboardRefresh,
  patchRepresentativeEquipment,
} from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { runSetupRoiAnalysis } from "../onboarding/onboardingAnalysisApi"
import { saveAnalysisResult } from "../onboarding/onboardingState"
import { buildRoiPath } from "../roi/roiPaths"
import {
  createEmptyEquipment,
  deleteEquipmentPayload,
  findCompanyId,
  findEquipmentId,
  getErrorMessage,
  hasRequiredEquipmentFields,
  submitEquipmentPayload,
  type EquipmentInfo,
} from "../mypage/myPage.parts"
import {
  buildEquipmentPayload,
  getCategoryLabel,
  mapRemoteEquipment,
} from "./equipmentStatus.mapper"
import { EquipmentRegistrationFormCard, type EquipmentRegistrationFormValues } from "./components/EquipmentRegistrationFormCard"
import EquipmentGuideChatLauncher from "./EquipmentGuideChatLauncher"
import EquipmentRegisteredList from "./EquipmentRegisteredList"
import { isEquipmentRegisterIntent } from "./equipmentStatusPaths"

function getStringValue(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function equipmentToFormValues(equipment: EquipmentInfo): EquipmentRegistrationFormValues {
  return {
    category: equipment.category,
    name: equipment.name,
    years: equipment.years,
    annualEnergyCost: equipment.annualEnergyCost,
    process: equipment.process,
    defectRate: equipment.defectRate,
    maintenanceCostMonthly: equipment.maintenanceCostAnnual,
    scenarioAInvestment: equipment.scenarioAInvestment,
    scenarioBInvestment: equipment.scenarioBInvestment,
  }
}

function applyFormValuesToEquipment(
  equipment: EquipmentInfo,
  patch: Partial<EquipmentRegistrationFormValues>,
): EquipmentInfo {
  return {
    ...equipment,
    category: patch.category ?? equipment.category,
    name: patch.name ?? equipment.name,
    years: patch.years ?? equipment.years,
    annualEnergyCost: patch.annualEnergyCost ?? equipment.annualEnergyCost,
    process: patch.process ?? equipment.process,
    defectRate: patch.defectRate ?? equipment.defectRate,
    maintenanceCostAnnual:
      patch.maintenanceCostMonthly ?? equipment.maintenanceCostAnnual,
    scenarioAInvestment: patch.scenarioAInvestment ?? equipment.scenarioAInvestment,
    scenarioBInvestment: patch.scenarioBInvestment ?? equipment.scenarioBInvestment,
  }
}

export default function EquipmentStatusFeature() {
  const { dashboard, loading: dashboardLoading } = useDashboardData()
  const workspace = dashboard.workspace
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const autoRegisterHandledRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companyId, setCompanyId] = useState("")
  const [equipmentList, setEquipmentList] = useState<EquipmentInfo[]>([])
  const [representativeEquipmentId, setRepresentativeEquipmentId] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftEquipment, setDraftEquipment] = useState<EquipmentInfo | null>(null)
  const [feedback, setFeedback] = useState("")

  const loadEquipment = useCallback(async () => {
    setLoading(true)
    try {
      const onboarding = await fetchDashboardOnboarding()
      const data = getObject(onboarding) ?? {}
      const company = getObject(data.company)
      const resolvedCompanyId =
        findCompanyId(onboarding) ||
        getStringValue(company?.company_id) ||
        getStoredCompanyId() ||
        ""
      const equipments = Array.isArray(data.equipments) ? data.equipments : []

      setCompanyId(resolvedCompanyId)
      setEquipmentList(
        equipments.length > 0 ? equipments.map(mapRemoteEquipment) : [],
      )
      setRepresentativeEquipmentId(getStringValue(company?.representative_equipment_id))
    } catch (error) {
      setFeedback(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEquipment()
  }, [loadEquipment])

  useEffect(() => {
    const handleRefresh = () => {
      void loadEquipment()
    }
    window.addEventListener("factofit:dashboard-refresh", handleRefresh)
    return () => {
      window.removeEventListener("factofit:dashboard-refresh", handleRefresh)
    }
  }, [loadEquipment])

  const representativeEquipment = useMemo(
    () => equipmentList.find((item) => item.equipmentId === representativeEquipmentId),
    [equipmentList, representativeEquipmentId],
  )

  const nextLocalId = useMemo(() => {
    if (equipmentList.length === 0) return 1
    return Math.max(...equipmentList.map((item) => item.id)) + 1
  }, [equipmentList])

  const startCreate = () => {
    const next = createEmptyEquipment(nextLocalId)
    setDraftEquipment(next)
    setEditingId(next.id)
    setFeedback("")
  }

  useEffect(() => {
    if (autoRegisterHandledRef.current) return
    if (!isEquipmentRegisterIntent(searchParams)) return
    if (loading || dashboardLoading || editingId !== null) return

    autoRegisterHandledRef.current = true
    const next = createEmptyEquipment(nextLocalId)
    setDraftEquipment(next)
    setEditingId(next.id)
    setFeedback("")
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("register")
    setSearchParams(nextParams, { replace: true })
  }, [
    dashboardLoading,
    editingId,
    loading,
    nextLocalId,
    searchParams,
    setSearchParams,
  ])

  const startEdit = (equipment: EquipmentInfo) => {
    setDraftEquipment({ ...equipment })
    setEditingId(equipment.id)
    setFeedback("")
  }

  const cancelEdit = () => {
    setDraftEquipment(null)
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!draftEquipment) return
    if (!companyId) {
      window.alert("회사 정보를 먼저 등록해주세요.")
      return
    }
    if (!hasRequiredEquipmentFields(draftEquipment)) {
      window.alert("설비 종류, 설비명, 사용연수, 연간 에너지 비용은 필수입니다.")
      return
    }

    setSaving(true)
    try {
      const response = await submitEquipmentPayload(
        companyId,
        buildEquipmentPayload(draftEquipment),
      )
      const equipmentId = findEquipmentId(response)
      const savedEquipment: EquipmentInfo = {
        ...draftEquipment,
        equipmentId: equipmentId ?? draftEquipment.equipmentId,
        status: "저장된 설비",
      }

      setEquipmentList((prev) => {
        const exists = prev.some((item) => item.id === savedEquipment.id)
        if (exists) {
          return prev.map((item) => (item.id === savedEquipment.id ? savedEquipment : item))
        }
        return [...prev, savedEquipment]
      })
      setFeedback(
        equipmentId || draftEquipment.equipmentId
          ? "설비 정보를 저장했습니다."
          : "설비를 등록했습니다.",
      )
      setDraftEquipment(null)
      setEditingId(null)
      notifyDashboardRefresh()

      const shouldAutoStartAnalysis = searchParams.get("source") === "analysis"
      if (shouldAutoStartAnalysis) {
        const savedEquipmentId = equipmentId || draftEquipment.equipmentId
        if (!savedEquipmentId) {
          window.alert(
            "설비 저장은 완료됐지만 설비 ID를 찾지 못해 자동 분석을 시작할 수 없습니다.",
          )
          return
        }

        const result = await runSetupRoiAnalysis(
          companyId,
          savedEquipmentId,
          savedEquipment.name || "검토 설비",
        )
        saveAnalysisResult(result)
        navigate(buildRoiPath("strategy", { analysisId: result.id }), { replace: true })
        return
      }
    } catch (error) {
      window.alert(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (equipment: EquipmentInfo) => {
    if (!equipment.equipmentId) {
      setEquipmentList((prev) => prev.filter((item) => item.id !== equipment.id))
      if (editingId === equipment.id) cancelEdit()
      return
    }

    if (!window.confirm(`'${equipment.name || "설비"}'를 삭제할까요?`)) return

    try {
      await deleteEquipmentPayload(equipment.equipmentId)
      if (representativeEquipmentId === equipment.equipmentId) {
        setRepresentativeEquipmentId("")
      }
      setEquipmentList((prev) => prev.filter((item) => item.id !== equipment.id))
      if (editingId === equipment.id) cancelEdit()
      setFeedback("설비를 삭제했습니다.")
      notifyDashboardRefresh()
    } catch (error) {
      window.alert(getErrorMessage(error))
    }
  }

  const handleSetRepresentative = async (equipment: EquipmentInfo) => {
    if (!companyId || !equipment.equipmentId) {
      window.alert("대표 설비로 설정하려면 먼저 설비를 저장해주세요.")
      return
    }

    try {
      await patchRepresentativeEquipment({
        companyId,
        equipmentId: equipment.equipmentId,
      })
      setRepresentativeEquipmentId(equipment.equipmentId)
      setFeedback(`${equipment.name || "설비"}를 ROI 계산용 대표 설비로 설정했습니다.`)
      notifyDashboardRefresh()
    } catch (error) {
      window.alert(getErrorMessage(error))
    }
  }

  const handleClearRepresentative = async () => {
    if (!companyId) return

    try {
      await patchRepresentativeEquipment({ companyId, equipmentId: null })
      setRepresentativeEquipmentId("")
      setFeedback("대표 설비 설정을 해제했습니다.")
      notifyDashboardRefresh()
    } catch (error) {
      window.alert(getErrorMessage(error))
    }
  }

  return (
    <main className="page ff-dashboard-workspace-page">
      <div className="ff-dashboard-layout">
        <DashboardWorkspaceSidebar
          paths={{
            newRoiPath: workspace.newRoiPath,
            policyPath: workspace.policyPath,
            draftPath: workspace.draftPath,
            advisorPath: workspace.advisorPath,
            analysisId: workspace.analysisId,
            priorityPolicyId: workspace.priorityPolicyId,
          }}
        />

        <div className="ff-dashboard-main-content ff-equipment-workspace-content">
          <div className="ff-equipment-workspace-inner">
            <section className="ff-equipment-hero-card">
            <div>
              <p className="ff-equipment-eyebrow">EQUIPMENT STATUS</p>
              <h1>설비 현황</h1>
              <p>
                등록된 설비를 관리하고, ROI 분석에 사용할 대표 설비를 설정하세요.
              </p>
              <p className="ff-equipment-guide-page-note">
                <Info aria-hidden="true" size={15} />
                <span>
                  우하단 챗봇은 설비 등록·수정 폼의 입력 항목만 안내합니다. 그 외
                  질문(ROI, 지원사업 등)은 AI Advisor를 이용해 주세요.
                </span>
              </p>
            </div>
            {!editingId ? (
              <button type="button" className="ff-equipment-secondary-btn ff-equipment-hero-action-btn" onClick={startCreate}>
                <Plus aria-hidden="true" size={18} />
                내 설비 등록
              </button>
            ) : null}
          </section>

          {feedback ? <div className="ff-equipment-feedback">{feedback}</div> : null}

          <section className="ff-equipment-representative-card">
            <div className="ff-equipment-representative-head">
              <div className="ff-equipment-representative-title">
                <strong>ROI 계산용 대표 설비</strong>
                <button
                  type="button"
                  className="ff-equipment-help-btn"
                  aria-label="대표 설비 안내"
                  title="ROI 분석에 사용할 기본 설비를 지정합니다."
                >
                  <CircleHelp aria-hidden="true" size={15} />
                </button>
              </div>
              <div
                className={`ff-equipment-representative-body ${representativeEquipment ? "has-value" : ""}`}
              >
                <p>
                  {representativeEquipment
                    ? `${representativeEquipment.name} · ${getCategoryLabel(representativeEquipment.category)}`
                    : "아직 대표 설비가 설정되지 않았습니다."}
                </p>
              </div>
            </div>
            {representativeEquipment ? (
              <button
                type="button"
                className="ff-equipment-secondary-btn"
                onClick={() => void handleClearRepresentative()}
              >
                대표 설비 해제
              </button>
            ) : null}
          </section>

          {loading || dashboardLoading ? (
            <div className="ff-equipment-loading">설비 정보를 불러오는 중...</div>
          ) : (
            <>
              {editingId !== null && draftEquipment ? (
                <EquipmentRegistrationFormCard
                  title={draftEquipment.equipmentId ? "설비 수정" : "내 설비 등록"}
                  values={equipmentToFormValues(draftEquipment)}
                  onChange={(patch) =>
                    setDraftEquipment((current) =>
                      current ? applyFormValuesToEquipment(current, patch) : current,
                    )
                  }
                  onCancel={cancelEdit}
                  onSubmit={() => void handleSave()}
                  submitLabel="설비 저장"
                  submitting={saving}
                />
              ) : null}

              <section className="ff-equipment-list-section">
                <header>
                  <strong>등록된 설비</strong>
                  <span>{equipmentList.length}대</span>
                </header>

                {equipmentList.length === 0 ? (
                  <div className="ff-equipment-empty">
                    <div className="ff-equipment-empty-icon" aria-hidden="true">
                      <Bot size={28} strokeWidth={1.8} />
                    </div>
                    <strong>등록된 설비가 없습니다.</strong>
                    <p>상단에서 &apos;내 설비 등록&apos; 버튼을 눌러 설비를 추가해 주세요.</p>
                  </div>
                ) : (
                  <EquipmentRegisteredList
                    equipmentList={equipmentList}
                    representativeEquipmentId={representativeEquipmentId}
                    companyId={companyId}
                    onEdit={startEdit}
                    onDelete={(equipment) => void handleDelete(equipment)}
                    onSetRepresentative={(equipment) => void handleSetRepresentative(equipment)}
                  />
                )}
              </section>
            </>
          )}
          </div>
        </div>
      </div>
      <EquipmentGuideChatLauncher />
    </main>
  )
}
