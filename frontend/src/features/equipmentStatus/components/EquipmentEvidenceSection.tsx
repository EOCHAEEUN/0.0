import { ClipboardCheck, FileSearch, Plus } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import type { EquipmentAttachmentItem } from "../equipmentAttachments.contract"
import EquipmentAttachmentsPanel from "../EquipmentAttachmentsPanel"
import type { EquipmentEvidenceRecord } from "../equipmentEvidence.contract"
import { EQUIPMENT_EVIDENCE_USE_MOCK } from "../equipmentEvidence.client"
import {
  hasApplicationSelectionContext,
  readApplicationContextIds,
  readPolicyDisplayName,
} from "../equipmentEvidenceContext.utils"
import { computeAttachmentEvidenceSummary } from "../equipmentEvidence.utils"
import type { AttachmentEvidenceSummary } from "../equipmentEvidence.utils"
import { useApplicationEvidenceSelections } from "../hooks/useApplicationEvidenceSelections"
import { useEquipmentEvidenceRecords } from "../hooks/useEquipmentEvidenceRecords"
import EquipmentCollapsibleSection from "./EquipmentCollapsibleSection"
import ApplicationEvidenceSelectionDrawer from "./ApplicationEvidenceSelectionDrawer"
import EquipmentEvidenceCard from "./EquipmentEvidenceCard"
import EquipmentEvidenceDrawer from "./EquipmentEvidenceDrawer"

type EquipmentEvidenceSectionProps = {
  equipmentId?: string
  equipmentName?: string
  companyId?: string
  enabled?: boolean
  onPrimaryPhotoChange?: (previewUrl: string | null) => void
}

type DrawerState =
  | { mode: "closed" }
  | { mode: "create"; attachment?: EquipmentAttachmentItem | null }
  | { mode: "edit"; record: EquipmentEvidenceRecord; attachment?: EquipmentAttachmentItem | null }
  | { mode: "selection" }

export default function EquipmentEvidenceSection({
  equipmentId,
  equipmentName,
  companyId,
  enabled = true,
  onPrimaryPhotoChange,
}: EquipmentEvidenceSectionProps) {
  const [drawerState, setDrawerState] = useState<DrawerState>({ mode: "closed" })
  const [attachments, setAttachments] = useState<EquipmentAttachmentItem[]>([])

  const applicationContext = readApplicationContextIds()
  const policyName = readPolicyDisplayName(applicationContext.policyId)

  const {
    records,
    stats,
    loading,
    saving,
    error,
    saveRecord,
    deleteRecord,
  } = useEquipmentEvidenceRecords({
    equipmentId,
    companyId,
    enabled,
  })

  const {
    selections,
    selectedCount,
    saving: selectionSaving,
    error: selectionError,
    saveSelections,
  } = useApplicationEvidenceSelections({
    analysisId: applicationContext.analysisId,
    policyId: applicationContext.policyId,
    equipmentId,
    companyId,
    enabled: enabled && hasApplicationSelectionContext({
      analysisId: applicationContext.analysisId,
      policyId: applicationContext.policyId,
      equipmentId,
    }),
  })

  const attachmentEvidenceSummary = useCallback(
    (attachmentId: string): AttachmentEvidenceSummary =>
      computeAttachmentEvidenceSummary(records, attachmentId),
    [records],
  )

  const attachmentById = useMemo(() => {
    const map = new Map<string, EquipmentAttachmentItem>()
    for (const attachment of attachments) {
      map.set(attachment.attachment_id, attachment)
    }
    return map
  }, [attachments])

  const openCreateDrawer = (attachment?: EquipmentAttachmentItem | null) => {
    setDrawerState({ mode: "create", attachment })
  }

  const openEditDrawer = (record: EquipmentEvidenceRecord) => {
    setDrawerState({
      mode: "edit",
      record,
      attachment: attachmentById.get(record.attachment_id) || null,
    })
  }

  const displayError = error || selectionError

  if (!equipmentId) {
    return (
      <section className="ff-equipment-evidence-section">
        <header className="ff-equipment-evidence-head">
          <div className="ff-equipment-evidence-title">
            <ClipboardCheck aria-hidden="true" size={18} />
            <strong>안전·정비 근거 관리</strong>
          </div>
        </header>
        <p className="ff-equipment-attachments-hint">
          설비를 저장한 뒤 안전·정비 근거를 등록할 수 있습니다.
        </p>
      </section>
    )
  }

  return (
    <>
      <EquipmentAttachmentsPanel
        equipmentId={equipmentId}
        equipmentName={equipmentName}
        enabled={enabled}
        onPrimaryPhotoChange={onPrimaryPhotoChange}
        onAttachmentsChange={setAttachments}
        getAttachmentEvidenceSummary={attachmentEvidenceSummary}
        onManageEvidence={(attachment) => openCreateDrawer(attachment)}
      />

      <EquipmentCollapsibleSection
        sectionClassName="ff-equipment-evidence-section"
        title="안전·정비 근거 관리"
        description="업로드한 증빙자료를 바탕으로 신청서에 반영할 핵심 내용을 직접 정리하고 승인하세요."
        icon={<ClipboardCheck aria-hidden="true" size={18} />}
        badge={
          <span className="ff-equipment-evidence-stat approved">전체 {stats.totalCount}건</span>
        }
        actions={
          <>
            <button
              type="button"
              className="ff-equipment-secondary-btn"
              onClick={() => openCreateDrawer(attachments[0] || null)}
            >
              <Plus aria-hidden="true" size={14} />
              근거 등록
            </button>
            <button
              type="button"
              className="ff-equipment-primary-btn"
              onClick={() => setDrawerState({ mode: "selection" })}
            >
              <FileSearch aria-hidden="true" size={14} />
              신청서 반영 관리
            </button>
          </>
        }
      >
        {EQUIPMENT_EVIDENCE_USE_MOCK ? (
          <div className="ff-evidence-form-demo-alert">
            UI 개발용 mock 데이터가 활성화되어 있습니다. (VITE_EQUIPMENT_EVIDENCE_USE_MOCK=true)
          </div>
        ) : null}

        <div className="ff-equipment-evidence-stats">
          <span className="ff-equipment-evidence-stat">전체 {stats.totalCount}건</span>
          <span className="ff-equipment-evidence-stat draft">초안 {stats.draftCount}건</span>
          <span className="ff-equipment-evidence-stat approved">
            승인 {stats.approvedCount}건
          </span>
          <span className="ff-equipment-evidence-stat selected">
            신청서 반영 {selectedCount}건
          </span>
        </div>

        {displayError ? (
          <div className="ff-equipment-attachments-error">{displayError}</div>
        ) : null}

        {loading ? (
          <p className="ff-equipment-attachments-hint">근거 목록을 불러오는 중...</p>
        ) : records.length === 0 ? (
          <div className="ff-equipment-evidence-empty">
            <p>
              아직 등록된 안전·정비 근거가 없습니다.
              <br />
              첨부된 점검서나 정비기록을 기준으로 핵심 내용을 직접 정리해보세요.
            </p>
          </div>
        ) : (
          <div className="ff-equipment-evidence-list">
            {records.map((record) => (
              <EquipmentEvidenceCard
                key={record.evidence_id}
                record={record}
                onEdit={openEditDrawer}
                onDelete={(item) => void deleteRecord(item.evidence_id)}
              />
            ))}
          </div>
        )}
      </EquipmentCollapsibleSection>

      <EquipmentEvidenceDrawer
        open={drawerState.mode === "create" || drawerState.mode === "edit"}
        onClose={() => setDrawerState({ mode: "closed" })}
        equipmentName={equipmentName}
        attachment={
          drawerState.mode === "create"
            ? drawerState.attachment
            : drawerState.mode === "edit"
              ? drawerState.attachment
              : null
        }
        attachments={attachments}
        record={drawerState.mode === "edit" ? drawerState.record : null}
        saving={saving}
        onSave={async (params) => {
          await saveRecord(params)
        }}
        onDelete={async (evidenceId) => {
          await deleteRecord(evidenceId)
        }}
      />

      <ApplicationEvidenceSelectionDrawer
        open={drawerState.mode === "selection"}
        onClose={() => setDrawerState({ mode: "closed" })}
        equipmentName={equipmentName}
        policyName={policyName}
        analysisId={applicationContext.analysisId}
        policyId={applicationContext.policyId}
        equipmentId={equipmentId}
        companyId={companyId}
        records={records}
        initialSelections={selections}
        saving={selectionSaving}
        onSave={async (items) => {
          if (!companyId) {
            throw new Error("company_id가 없어 저장할 수 없습니다.")
          }
          await saveSelections(items)
        }}
      />
    </>
  )
}
