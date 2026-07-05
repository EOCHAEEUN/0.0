import { Bot, ClipboardList, Cog, FileText, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import type { EquipmentInfo } from "../mypage/myPage.parts"
import { useSafetyCheckData } from "../safetyCheck/hooks/useSafetyCheckData"
import {
  getCheckContent,
  getPurposeLabel,
} from "../safetyCheck/safetyCheck.constants"
import type { InspectionPurpose, SafetyCheckItem } from "../safetyCheck/safetyCheck.contract"
import { formatEquipmentRegisteredAt } from "../safetyCheck/safetyCheck.utils"
import { MobileSafetyConfirmSheet } from "./components/MobileSafetyConfirmSheet"
import { MobileSafetyCreateSheet } from "./components/MobileSafetyCreateSheet"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"

function equipmentIcon(category: string) {
  const normalized = category.trim().toLowerCase()
  if (normalized.includes("press") || normalized.includes("프레스")) {
    return Bot
  }
  return Cog
}

function purposeBadgeTone(purpose: string) {
  if (purpose === "maintenance") return "maintenance"
  if (purpose === "safety_training") return "training"
  return "safety"
}

export default function MobileSafetyScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId })
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, dashboard.workspace),
    [dashboard.workspace, searchParams],
  )

  const {
    loading,
    refreshing,
    error,
    feedback,
    setFeedback,
    equipmentList,
    itemsByEquipmentId,
    createEvidence,
    removeEvidence,
  } = useSafetyCheckData()

  const [createModalEquipment, setCreateModalEquipment] = useState<EquipmentInfo | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SafetyCheckItem | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const sortedEquipmentList = useMemo(() => {
    if (!flowContext.equipmentId) return equipmentList
    const targetIndex = equipmentList.findIndex((item) => item.equipmentId === flowContext.equipmentId)
    if (targetIndex <= 0) return equipmentList
    const next = [...equipmentList]
    const [target] = next.splice(targetIndex, 1)
    return [target, ...next]
  }, [equipmentList, flowContext.equipmentId])

  const openCreate = (equipment: EquipmentInfo) => {
    setCreateModalEquipment(equipment)
  }

  const closeCreate = () => {
    if (createSubmitting) return
    setCreateModalEquipment(null)
  }

  return (
    <section className="ff-mobile-screen ff-mobile-safety-screen">
      <MobileTopBar companyName={dashboard.workspace.companyName} subtitle="안전 · 정비 근거" showSubtitle />

      <header className="ff-mobile-safety-header">
        <span className="ff-mobile-safety-kicker">안전 · 정비 근거</span>
        <h1>안전 · 정비 근거 관리</h1>
        <p>설비의 안전점검, 유지보수, 교육 근거를 등록하고 관리하세요</p>
      </header>

      <nav className="ff-mobile-safety-tabs" aria-label="안전 · 정비 관리 탭">
        <button type="button" className="is-active" aria-selected="true">
          <ClipboardList size={16} strokeWidth={2.1} aria-hidden="true" />
          설비관리
        </button>
      </nav>

      {feedback ? (
        <article className="ff-mobile-safety-feedback">
          <p>{feedback}</p>
          <button type="button" onClick={() => setFeedback("")}>
            닫기
          </button>
        </article>
      ) : null}

      {error ? (
        <article className="ff-mobile-safety-feedback is-error">
          <p>{error}</p>
        </article>
      ) : null}

      {loading ? (
        <article className="ff-mobile-safety-loading">
          <p>안전 · 정비 근거를 불러오는 중...</p>
        </article>
      ) : null}

      {!loading && refreshing ? (
        <p className="ff-mobile-safety-refresh">최신 데이터를 반영하는 중...</p>
      ) : null}

      {!loading ? (
        <div className="ff-mobile-safety-equipment-list">
          {sortedEquipmentList.length === 0 ? (
            <article className="ff-mobile-safety-equipment-card">
              <p className="ff-mobile-safety-empty-copy">등록된 설비가 없습니다. 설비를 먼저 등록해 주세요.</p>
              <button
                type="button"
                className="ff-mobile-safety-back-link"
                onClick={() => navigate(buildMobilePath("/mobile/application", flowContext))}
              >
                신청서로 돌아가기
              </button>
            </article>
          ) : (
            sortedEquipmentList.map((equipment) => {
              const items = equipment.equipmentId
                ? itemsByEquipmentId[equipment.equipmentId] || []
                : []
              const Icon = equipmentIcon(equipment.category)

              return (
                <article key={equipment.id} className="ff-mobile-safety-equipment-card">
                  <div className="ff-mobile-safety-equipment-head">
                    <span className="ff-mobile-safety-equipment-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={2.1} />
                    </span>
                    <div>
                      <strong>{equipment.name || "설비"}</strong>
                      <span>등록일: {formatEquipmentRegisteredAt(equipment.createdAt)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ff-mobile-safety-add-btn"
                    disabled={!equipment.equipmentId}
                    onClick={() => openCreate(equipment)}
                  >
                    <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                    근거 등록
                  </button>

                  {items.length === 0 ? (
                    <div className="ff-mobile-safety-empty-box">등록된 근거가 없습니다.</div>
                  ) : (
                    <div className="ff-mobile-safety-evidence-list">
                      {items.map((item) => (
                        <div key={item.id} className="ff-mobile-safety-evidence-item">
                          <div className="ff-mobile-safety-evidence-main">
                            <span
                              className={`ff-mobile-safety-purpose-badge is-${purposeBadgeTone(
                                String(item.inspection_purpose),
                              )}`}
                            >
                              {getPurposeLabel(item.inspection_purpose, item.inspection_purpose_label)}
                            </span>
                            <strong>{getCheckContent(item)}</strong>
                            <span className="ff-mobile-safety-file-row">
                              <FileText size={13} strokeWidth={2.1} aria-hidden="true" />
                              {item.pdf_file_url ? (
                                <a
                                  href={item.pdf_file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ff-mobile-safety-file-link"
                                >
                                  {item.inspection_pdf_file || "PDF 보기"}
                                </a>
                              ) : (
                                item.inspection_pdf_file || "파일명 없음"
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="ff-mobile-safety-delete-btn"
                            onClick={() => setDeleteTarget(item)}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )
            })
          )}
        </div>
      ) : null}

      <MobileSafetyCreateSheet
        open={Boolean(createModalEquipment)}
        equipment={createModalEquipment}
        submitting={createSubmitting}
        onClose={closeCreate}
        onSubmit={async (params) => {
          if (!createModalEquipment) return
          setCreateSubmitting(true)
          try {
            await createEvidence({
              equipment: createModalEquipment,
              inspectionPurpose: params.inspectionPurpose as InspectionPurpose,
              currentSafetyMeasures: params.currentSafetyMeasures,
              file: params.file,
            })
            closeCreate()
          } finally {
            setCreateSubmitting(false)
          }
        }}
      />

      <MobileSafetyConfirmSheet
        open={Boolean(deleteTarget)}
        title="근거 삭제"
        message="이 증빙 파일을 삭제하시겠습니까?"
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
    </section>
  )
}
