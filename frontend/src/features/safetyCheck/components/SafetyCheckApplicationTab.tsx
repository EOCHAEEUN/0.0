import { useState } from "react"
import type { EquipmentInfo } from "../../mypage/myPage.parts"
import type { SafetyCheckItem } from "../safetyCheck.contract"
import { getCheckContent, getPurposeLabel } from "../safetyCheck.constants"
import SafetyCheckConfirmDialog from "./SafetyCheckConfirmDialog"

type SafetyCheckApplicationTabProps = {
  representativeEquipment: EquipmentInfo | undefined
  representativeEquipmentId: string
  items: SafetyCheckItem[]
  onGoToEquipmentTab: () => void
  onSaveImprovement: (params: {
    itemId: string
    equipmentId: string
    improvementPlan: string
  }) => Promise<void>
  onClearImprovement: (params: { itemId: string; equipmentId: string }) => Promise<void>
}

export default function SafetyCheckApplicationTab({
  representativeEquipment,
  representativeEquipmentId,
  items,
  onGoToEquipmentTab,
  onSaveImprovement,
  onClearImprovement,
}: SafetyCheckApplicationTabProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draftPlan, setDraftPlan] = useState("")
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [clearTarget, setClearTarget] = useState<SafetyCheckItem | null>(null)
  const [clearPending, setClearPending] = useState(false)

  if (!representativeEquipmentId) {
    return (
      <div className="section-block section-block--empty">
        <p>대표설비가 설정되지 않았습니다. 설비관리에서 대표설비를 먼저 지정해주세요.</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="section-block section-block--empty">
        <p>대표설비에 등록된 증빙이 없습니다.</p>
        <button type="button" className="ff-draft-safety-save-btn" onClick={onGoToEquipmentTab}>
          설비관리 탭으로 이동
        </button>
      </div>
    )
  }

  const startEdit = (item: SafetyCheckItem) => {
    setEditingItemId(item.id)
    setDraftPlan(item.improvement_plan?.trim() || "")
  }

  const handleSave = async (item: SafetyCheckItem) => {
    if (!draftPlan.trim()) return
    setSavingItemId(item.id)
    try {
      await onSaveImprovement({
        itemId: item.id,
        equipmentId: item.equipment_id,
        improvementPlan: draftPlan.trim(),
      })
      setEditingItemId(null)
      setDraftPlan("")
    } finally {
      setSavingItemId(null)
    }
  }

  const handleEditClick = (item: SafetyCheckItem) => {
    const isEditing = editingItemId === item.id
    const hasPlan = Boolean(item.improvement_plan?.trim())
    if (isEditing) {
      void handleSave(item)
      return
    }
    startEdit(item)
    if (!hasPlan) setDraftPlan("")
  }

  const handleDeleteClick = (item: SafetyCheckItem) => {
    if (!item.improvement_plan?.trim()) return
    setClearTarget(item)
  }

  return (
    <>
      <div className="section-block">
        <p className="section-note">
          대표설비: <strong>{representativeEquipment?.name || "설비"}</strong> · 등록{" "}
          {items.length}건
        </p>

        <div className="table-container table-container--flat">
          <table>
            <thead>
              <tr>
                <th style={{ width: "15%" }}>점검 항목</th>
                <th style={{ width: "20%" }}>점검 내용</th>
                <th style={{ width: "15%" }}>현재 상태</th>
                <th style={{ width: "35%" }}>향후 관리 계획</th>
                <th style={{ width: "15%" }} />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isEditing = editingItemId === item.id
                const hasPlan = Boolean(item.improvement_plan?.trim())
                const isSaving = savingItemId === item.id

                return (
                  <tr key={item.id}>
                    <td>
                      <span className="inspection-type">
                        {getPurposeLabel(
                          item.inspection_purpose,
                          item.inspection_purpose_label,
                        )}
                      </span>
                    </td>
                    <td>{getCheckContent(item)}</td>
                    <td>파일보유</td>
                    <td>
                      <div className="improvement-cell">
                        {isEditing ? (
                          <input
                            type="text"
                            className="improvement-input"
                            value={draftPlan}
                            disabled={isSaving}
                            autoFocus
                            onChange={(event) => setDraftPlan(event.target.value)}
                          />
                        ) : hasPlan ? (
                          <span className="improvement-text">{item.improvement_plan}</span>
                        ) : (
                          <span className="improvement-empty">[선택입력]</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={
                          isEditing
                            ? "ff-draft-safety-save-btn"
                            : "ff-draft-edit-btn"
                        }
                        disabled={isSaving || (isEditing && !draftPlan.trim())}
                        onClick={() => handleEditClick(item)}
                      >
                        {isEditing
                          ? isSaving
                            ? "저장 중..."
                            : "저장"
                          : hasPlan
                            ? "수정"
                            : "입력"}
                      </button>{" "}
                      <button
                        type="button"
                        className="ff-draft-safety-link-btn danger"
                        disabled={isEditing || !hasPlan}
                        onClick={() => handleDeleteClick(item)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SafetyCheckConfirmDialog
        open={Boolean(clearTarget)}
        title="향후 관리 계획 삭제"
        message="저장된 향후 관리 계획만 삭제합니다. 점검 증빙과 PDF는 유지됩니다."
        confirmLabel="삭제"
        pending={clearPending}
        onClose={() => {
          if (!clearPending) setClearTarget(null)
        }}
        onConfirm={async () => {
          if (!clearTarget) return
          setClearPending(true)
          try {
            await onClearImprovement({
              itemId: clearTarget.id,
              equipmentId: clearTarget.equipment_id,
            })
            if (editingItemId === clearTarget.id) {
              setEditingItemId(null)
              setDraftPlan("")
            }
            setClearTarget(null)
          } finally {
            setClearPending(false)
          }
        }}
      />
    </>
  )
}
