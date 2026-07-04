import { useState } from "react"
import type { EquipmentInfo } from "../mypage/myPage.parts"
import SafetyCheckApplicationTab from "./components/SafetyCheckApplicationTab"
import SafetyCheckEquipmentEvidenceTab from "./components/SafetyCheckEquipmentEvidenceTab"
import { useSafetyCheckData, type SafetyCheckTab } from "./hooks/useSafetyCheckData"

export default function SafetyCheckEmbeddedPanel() {
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

  const openCreateModal = (equipment: EquipmentInfo) => {
    setCreateModalEquipment(equipment)
    setCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    if (createSubmitting) return
    setCreateModalOpen(false)
    setCreateModalEquipment(null)
  }

  return (
    <div className="safety-check-page safety-check-page--embedded">
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
          onClick={() => setActiveTab("equipment")}
        >
          📋 설비관리 탭
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "application"}
          className={`tab-button ${activeTab === "application" ? "active" : ""}`}
          onClick={() => setActiveTab("application")}
        >
          📝 신청서 탭
        </button>
      </div>

      {loading ? (
        <p className="loading-text">안전·정비 증빙을 불러오는 중...</p>
      ) : (
        <>
          {refreshing ? (
            <p className="loading-text">최신 데이터를 반영하는 중...</p>
          ) : null}

          {activeTab === "equipment" ? (
            <SafetyCheckEquipmentEvidenceTab
              equipmentList={equipmentList}
              itemsByEquipmentId={itemsByEquipmentId}
              onOpenCreate={openCreateModal}
              createModalEquipment={createModalEquipment}
              createModalOpen={createModalOpen}
              createSubmitting={createSubmitting}
              onCloseCreateModal={closeCreateModal}
              onCreateSubmit={async (params) => {
                setCreateSubmitting(true)
                try {
                  await createEvidence({
                    equipment: params.equipment,
                    inspectionPurpose: params.inspectionPurpose,
                    currentSafetyMeasures: params.currentSafetyMeasures,
                    file: params.file,
                  })
                } finally {
                  setCreateSubmitting(false)
                }
              }}
              onDeleteItem={removeEvidence}
            />
          ) : (
            <SafetyCheckApplicationTab
              representativeEquipment={representativeEquipment}
              representativeEquipmentId={representativeEquipmentId}
              items={representativeItems}
              onGoToEquipmentTab={() => setActiveTab("equipment")}
              onSaveImprovement={saveImprovementPlan}
              onClearImprovement={clearImprovementPlan}
            />
          )}
        </>
      )}
    </div>
  )
}
