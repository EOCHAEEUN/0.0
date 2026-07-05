import { FileText, Wrench } from "lucide-react"
import { useState } from "react"
import DashboardWorkspaceSidebar from "../../components/layout/DashboardWorkspaceSidebar"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import type { EquipmentInfo } from "../mypage/myPage.parts"
import SafetyCheckApplicationTab from "./components/SafetyCheckApplicationTab"
import SafetyCheckConfirmDialog from "./components/SafetyCheckConfirmDialog"
import SafetyCheckCreateModal from "./components/SafetyCheckCreateModal"
import SafetyCheckEquipmentEvidenceTab from "./components/SafetyCheckEquipmentEvidenceTab"
import { useSafetyCheckData, type SafetyCheckTab } from "./hooks/useSafetyCheckData"
import type { SafetyCheckItem } from "./safetyCheck.contract"

export default function SafetyCheckFeature() {
  const { dashboard } = useDashboardData()
  const workspace = dashboard.workspace
  const {
    loading,
    refreshing,
    error,
    feedback,
    setFeedback,
    equipmentList,
    representativeEquipmentId,
    representativeEquipment,
    representativeItems,
    itemsByEquipmentId,
    createEvidence,
    removeEvidence,
    saveImprovementPlan,
    clearImprovementPlan,
  } = useSafetyCheckData()

  const [activeTab, setActiveTab] = useState<SafetyCheckTab>("equipment")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalEquipment, setCreateModalEquipment] = useState<EquipmentInfo | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SafetyCheckItem | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const openCreateModal = (equipment: EquipmentInfo) => {
    setCreateModalEquipment(equipment)
    setCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    if (createSubmitting) return
    setCreateModalOpen(false)
    setCreateModalEquipment(null)
  }

  const switchTab = (tab: SafetyCheckTab) => {
    if (tab === activeTab) return
    closeCreateModal()
    setDeleteTarget(null)
    setActiveTab(tab)
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

        <div className="ff-dashboard-main-content ff-safety-check-workspace-content">
          <div className="safety-check-page">
            <div className="container">
              <div className="header">
                <h1>안전·정비 점검 관리</h1>
                <p>설비의 안전점검, 유지보수, 교육 점검을 등록하고 관리하세요</p>
              </div>

              {feedback ? (
                <div className="alert alert-success" role="status">
                  <span>{feedback}</span>
                  <button
                    type="button"
                    aria-label="알림 닫기"
                    style={{ marginLeft: 12, border: "none", background: "none", cursor: "pointer" }}
                    onClick={() => setFeedback("")}
                  >
                    닫기
                  </button>
                </div>
              ) : null}

              {error ? <div className="alert alert-error">{error}</div> : null}

              <div className="tabs" role="tablist" aria-label="안전·정비 관리 탭">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "equipment"}
                  className={`tab-button ${activeTab === "equipment" ? "active" : ""}`}
                  onClick={() => switchTab("equipment")}
                >
                  <Wrench aria-hidden="true" size={16} strokeWidth={2.2} />
                  설비관리 탭
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "application"}
                  className={`tab-button ${activeTab === "application" ? "active" : ""}`}
                  onClick={() => switchTab("application")}
                >
                  <FileText aria-hidden="true" size={16} strokeWidth={2.2} />
                  신청서 탭
                </button>
              </div>

              {loading ? (
                <p className="loading-text">안전·정비 증빙을 불러오는 중...</p>
              ) : null}

              {!loading && refreshing ? (
                <p className="loading-text">최신 데이터를 반영하는 중...</p>
              ) : null}

              {!loading && activeTab === "equipment" ? (
                <SafetyCheckEquipmentEvidenceTab
                  equipmentList={equipmentList}
                  itemsByEquipmentId={itemsByEquipmentId}
                  onOpenCreate={openCreateModal}
                  onDeleteItem={(item) => setDeleteTarget(item)}
                />
              ) : null}

              {!loading && activeTab === "application" ? (
                <SafetyCheckApplicationTab
                  representativeEquipment={representativeEquipment}
                  representativeEquipmentId={representativeEquipmentId}
                  items={representativeItems}
                  onGoToEquipmentTab={() => switchTab("equipment")}
                  onSaveImprovement={saveImprovementPlan}
                  onClearImprovement={clearImprovementPlan}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <SafetyCheckCreateModal
        open={createModalOpen}
        equipment={createModalEquipment}
        submitting={createSubmitting}
        onClose={closeCreateModal}
        onSubmit={async (params) => {
          if (!createModalEquipment) return
          setCreateSubmitting(true)
          try {
            await createEvidence({
              equipment: createModalEquipment,
              inspectionPurpose: params.inspectionPurpose,
              currentSafetyMeasures: params.currentSafetyMeasures,
              file: params.file,
            })
            closeCreateModal()
          } finally {
            setCreateSubmitting(false)
          }
        }}
      />

      <SafetyCheckConfirmDialog
        open={Boolean(deleteTarget)}
        title="점검 증빙 삭제"
        message="이 파일을 삭제하시겠습니까? 신청서 탭에서도 함께 제거됩니다."
        confirmLabel="삭제"
        pending={deletePending}
        onClose={() => {
          if (!deletePending) setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (!deleteTarget) return
          setDeletePending(true)
          try {
            await removeEvidence(deleteTarget)
            setDeleteTarget(null)
          } finally {
            setDeletePending(false)
          }
        }}
      />
    </main>
  )
}
