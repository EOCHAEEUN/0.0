import type { ChecklistItem } from "../applicationDraft.contract"
import { StatusBadge } from "./ApplicationDraftShared"

export function ApplicationDraftChecklistDialog({
  open,
  checklistItems,
  requiredDocuments,
  onClose,
}: {
  open: boolean
  checklistItems: ChecklistItem[]
  requiredDocuments: string[]
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="ff-checklist-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="ff-checklist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ff-checklist-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ff-checklist-modal-hero">
          <div>
            <span className="ff-mini-label dark">제출 전 확인할 서류</span>
            <h3 id="ff-checklist-modal-title">신청준비도 체크리스트</h3>
            <p>
              ROI 분석 결과, 기업 기본정보, 설비현황, 증빙자료를 제출 전 한 번 더 확인합니다.
            </p>
          </div>
          <button
            type="button"
            className="ff-checklist-modal-close icon"
            aria-label="체크리스트 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="ff-checklist-modal-body">
          <div className="ff-checklist-grid">
            {checklistItems.map((item) => (
              <div className="ff-check-card" key={item.label}>
                <div>
                  <h4>{item.label}</h4>
                  <p>{item.description}</p>
                </div>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
            ))}
          </div>

          <div className="ff-required-documents">
            {requiredDocuments.map((documentName) => (
              <span key={documentName}>{documentName}</span>
            ))}
          </div>

          <div className="ff-checklist-modal-foot">
            <p>공고 원문과 실제 제출 서류는 제출 전 별도 확인이 필요합니다.</p>
            <button type="button" onClick={onClose}>
              확인 완료
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
