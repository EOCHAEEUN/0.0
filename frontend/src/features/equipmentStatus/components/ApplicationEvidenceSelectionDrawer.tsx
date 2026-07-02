import { useEffect, useMemo, useState } from "react"
import type {
  ApplicationSection,
  EquipmentEvidenceRecord,
  EvidenceType,
} from "../equipmentEvidence.contract"
import {
  APPLICATION_SECTION_OPTIONS,
  EVIDENCE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
} from "../equipmentEvidence.contract"
import {
  filterEvidenceRecords,
  formatEvidenceDate,
  getDefaultReflectedText,
  getReviewStatusClassName,
  isEvidenceEligibleForApplication,
} from "../equipmentEvidence.utils"
import EquipmentDrawerShell from "./EquipmentDrawerShell"

type SelectionDraft = {
  evidence_id: string
  is_selected: boolean
  application_section: ApplicationSection
  reflected_text: string
  selection_id?: string
}

type ApplicationEvidenceSelectionDrawerProps = {
  open: boolean
  onClose: () => void
  equipmentName?: string
  policyName?: string
  analysisId?: string
  policyId?: string
  equipmentId?: string
  companyId?: string
  records: EquipmentEvidenceRecord[]
  initialSelections?: Array<{
    evidence_id: string
    application_section: ApplicationSection
    reflected_text: string
    is_selected: boolean
    selection_id?: string
  }>
  saving?: boolean
  onSave: (items: SelectionDraft[]) => Promise<void>
}

type EvidenceFilter = "all" | EvidenceType | "approved_only"

export default function ApplicationEvidenceSelectionDrawer({
  open,
  onClose,
  equipmentName,
  policyName,
  analysisId,
  policyId,
  records,
  initialSelections = [],
  saving = false,
  onSave,
}: ApplicationEvidenceSelectionDrawerProps) {
  const [filter, setFilter] = useState<EvidenceFilter>("all")
  const [drafts, setDrafts] = useState<SelectionDraft[]>([])
  const [localError, setLocalError] = useState("")

  useEffect(() => {
    if (!open) return
    setFilter("all")
    setLocalError("")
    setDrafts(
      records.map((record) => {
        const existing = initialSelections.find(
          (selection) => selection.evidence_id === record.evidence_id,
        )
        return {
          evidence_id: record.evidence_id,
          is_selected: Boolean(existing?.is_selected),
          application_section:
            existing?.application_section || "supporting_evidence",
          reflected_text:
            existing?.reflected_text ||
            getDefaultReflectedText(record.application_sentence),
          selection_id: existing?.selection_id,
        }
      }),
    )
  }, [initialSelections, open, records])

  const filteredRecords = useMemo(
    () => filterEvidenceRecords(records, filter),
    [filter, records],
  )

  const selectedDrafts = drafts.filter((draft) => draft.is_selected)
  const previewText = selectedDrafts
    .map((draft) => draft.reflected_text.trim())
    .filter(Boolean)
    .join("\n\n")

  const updateDraft = (evidenceId: string, patch: Partial<SelectionDraft>) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.evidence_id === evidenceId ? { ...draft, ...patch } : draft,
      ),
    )
  }

  const handleSave = async () => {
    setLocalError("")
    try {
      await onSave(drafts)
      onClose()
    } catch (nextError) {
      if (nextError instanceof Error) {
        setLocalError(nextError.message)
      }
    }
  }

  const missingContext = !analysisId || !policyId

  return (
    <EquipmentDrawerShell
      open={open}
      title="신청서 반영 근거 선택"
      subtitle={
        equipmentName
          ? `${equipmentName}${policyName ? ` · ${policyName}` : ""}`
          : undefined
      }
      onClose={onClose}
      widthClass="ff-evidence-drawer-panel is-wide"
      footer={
        <div className="ff-evidence-selection-footer">
          <div className="ff-evidence-selection-footer-summary">
            <strong>선택된 근거 {selectedDrafts.length}건</strong>
            {previewText ? (
              <p>{previewText.slice(0, 180)}{previewText.length > 180 ? "..." : ""}</p>
            ) : (
              <p>선택한 근거의 반영 문장이 여기에 미리보기됩니다.</p>
            )}
          </div>
          <div className="ff-evidence-drawer-footer-primary">
            <button
              type="button"
              className="ff-equipment-secondary-btn"
              disabled={saving}
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="button"
              className="ff-equipment-primary-btn"
              disabled={saving || missingContext}
              onClick={() => void handleSave()}
            >
              {saving ? "저장 중..." : "선택 저장"}
            </button>
          </div>
        </div>
      }
    >
      <div className="ff-evidence-selection">
        <p className="ff-evidence-form-note">
          승인된 근거만 신청서에 반영할 수 있습니다. 선택한 문장은 신청서 초안 생성 시 참고
          근거로 사용됩니다.
        </p>

        {missingContext ? (
          <div className="ff-evidence-form-demo-alert">
            analysis_id 또는 policy_id가 없어 신청서 반영 선택을 저장할 수 없습니다. ROI
            분석 또는 신청서 초안 화면에서 정책을 선택한 뒤 다시 시도해 주세요.
          </div>
        ) : (
          <p className="ff-evidence-selection-context">
            분석 ID {analysisId} · 정책 ID {policyId}
          </p>
        )}

        {localError ? <div className="ff-equipment-attachments-error">{localError}</div> : null}

        <div className="ff-evidence-selection-filters">
          {(
            [
              ["all", "전체"],
              ["safety_inspection", "안전점검"],
              ["safety_improvement", "안전개선"],
              ["maintenance_record", "정비기록"],
              ["maintenance_plan", "정비계획"],
              ["approved_only", "승인 완료만"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`ff-evidence-filter-btn ${filter === value ? "is-active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ff-evidence-selection-list">
          {filteredRecords.length === 0 ? (
            <p className="ff-equipment-attachments-hint">
              표시할 근거가 없습니다. 승인된 근거를 먼저 등록해 주세요.
            </p>
          ) : (
            filteredRecords.map((record) => {
              const draft = drafts.find((item) => item.evidence_id === record.evidence_id)
              const selectable = isEvidenceEligibleForApplication(record)
              const checked = Boolean(draft?.is_selected)

              return (
                <article
                  key={record.evidence_id}
                  className={`ff-evidence-selection-card ${record.is_demo ? "is-demo" : ""}`}
                >
                  <label className="ff-evidence-selection-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectable || saving || missingContext}
                      onChange={(event) =>
                        updateDraft(record.evidence_id, {
                          is_selected: event.target.checked,
                          reflected_text:
                            draft?.reflected_text ||
                            getDefaultReflectedText(record.application_sentence),
                        })
                      }
                    />
                    <span>{selectable ? "신청서 반영 선택" : "선택 불가"}</span>
                  </label>

                  <div className="ff-evidence-selection-card-body">
                    <div className="ff-evidence-card-badges">
                      <span className="ff-evidence-type-badge">
                        {EVIDENCE_TYPE_LABELS[record.evidence_type]}
                      </span>
                      <span
                        className={getReviewStatusClassName(
                          record.review_status,
                          record.is_demo,
                        )}
                      >
                        {record.is_demo
                          ? "더미 자료 · 신청서 반영 불가"
                          : REVIEW_STATUS_LABELS[record.review_status]}
                      </span>
                    </div>
                    <strong>{record.title}</strong>
                    <p className="ff-evidence-card-meta">
                      {formatEvidenceDate(record.evidence_date)}
                      {record.attachment_filename
                        ? ` · ${record.attachment_filename}`
                        : ""}
                    </p>
                    <p className="ff-evidence-card-sentence">
                      {record.application_sentence || "신청서 반영 후보 문장 없음"}
                    </p>

                    {checked && selectable ? (
                      <div className="ff-evidence-selection-editor">
                        <label>
                          <span>신청서 섹션</span>
                          <select
                            value={draft?.application_section || "supporting_evidence"}
                            disabled={saving}
                            onChange={(event) =>
                              updateDraft(record.evidence_id, {
                                application_section: event.target.value as ApplicationSection,
                              })
                            }
                          >
                            {APPLICATION_SECTION_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>반영 문장</span>
                          <textarea
                            rows={3}
                            value={draft?.reflected_text || ""}
                            disabled={saving}
                            onChange={(event) =>
                              updateDraft(record.evidence_id, {
                                reflected_text: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </EquipmentDrawerShell>
  )
}
