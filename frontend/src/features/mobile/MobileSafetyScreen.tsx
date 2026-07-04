import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { useSafetyCheckData } from "../safetyCheck/hooks/useSafetyCheckData"
import type { InspectionPurpose, SafetyCheckItem } from "../safetyCheck/safetyCheck.contract"
import { PURPOSE_OPTIONS, getPurposeLabel } from "../safetyCheck/safetyCheck.constants"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileSafetyViewModel } from "./mobileApp.mapper"

function formatDate(value?: string | null) {
  if (!value) return "-"
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return "-"
  const date = new Date(time)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`
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
  const draftWorkspace = useApplicationDraftWorkspace({
    analysisId: flowContext.analysisId,
    policyId: flowContext.policyId,
    companyId: getStoredCompanyId() || undefined,
  })
  const {
    loading,
    error,
    feedback,
    setFeedback,
    equipmentList,
    representativeEquipment,
    itemsByEquipmentId,
    createEvidence,
    removeEvidence,
  } = useSafetyCheckData()

  const initialEquipmentId =
    flowContext.equipmentId || representativeEquipment?.equipmentId || equipmentList[0]?.equipmentId || ""
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId)
  const [purpose, setPurpose] = useState<InspectionPurpose>("safety_device")
  const [content, setContent] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [deletingId, setDeletingId] = useState("")
  const [showUploadForm, setShowUploadForm] = useState(false)

  const selectedEquipment = useMemo(
    () => equipmentList.find((item) => item.equipmentId === equipmentId) || representativeEquipment || null,
    [equipmentId, equipmentList, representativeEquipment],
  )

  const evidenceItems: SafetyCheckItem[] = selectedEquipment?.equipmentId
    ? itemsByEquipmentId[selectedEquipment.equipmentId] || []
    : []

  const model = useMemo(
    () =>
      mapMobileSafetyViewModel({
        draftWorkspace: draftWorkspace.data,
        equipmentName: selectedEquipment?.name || dashboard.workspace.equipmentName,
        evidenceItems,
        analysisId: flowContext.analysisId,
        policyId: flowContext.policyId,
        equipmentId: flowContext.equipmentId,
      }),
    [
      dashboard.workspace.equipmentName,
      draftWorkspace.data,
      evidenceItems,
      flowContext.analysisId,
      flowContext.equipmentId,
      flowContext.policyId,
      selectedEquipment?.name,
    ],
  )

  useEffect(() => {
    if (flowContext.equipmentId) {
      setEquipmentId(flowContext.equipmentId)
    }
  }, [flowContext.equipmentId])

  const handleSubmit = async () => {
    if (!selectedEquipment) {
      setSubmitError("설비를 먼저 선택해 주세요.")
      return
    }
    if (!content.trim()) {
      setSubmitError("점검 내용을 입력해 주세요.")
      return
    }
    if (!file) {
      setSubmitError("PDF 파일을 선택해 주세요.")
      return
    }

    setSubmitError("")
    setSubmitting(true)
    try {
      await createEvidence({
        equipment: selectedEquipment,
        inspectionPurpose: purpose,
        currentSafetyMeasures: content,
        file,
      })
      setContent("")
      setFile(null)
      setShowUploadForm(false)
    } catch (nextError) {
      setSubmitError(nextError instanceof Error ? nextError.message : "증빙 등록에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="ff-mobile-screen">
      <MobileTopBar
        companyName={dashboard.workspace.companyName}
        subtitle="안전개선 근거 · 증빙"
        showSubtitle
      />

      <header className="ff-mobile-page-title">
        <span className="ff-mobile-section-label">SAFETY EVIDENCE</span>
        <h1>안전개선 근거 및 증빙</h1>
        <p>{model.representativeEquipmentName} 기준 점검·증빙 상태입니다.</p>
      </header>

      {!flowContext.equipmentId ? (
        <article className="ff-mobile-card">
          <h2>설비 문맥이 없습니다.</h2>
          <p>신청서 화면에서 설비/정책을 선택한 뒤 증빙을 등록해 주세요.</p>
          <button
            type="button"
            className="ff-mobile-secondary-btn"
            onClick={() => navigate(buildMobilePath("/mobile/application", flowContext))}
          >
            신청서 문맥으로 이동
          </button>
        </article>
      ) : null}

      {feedback ? (
        <article className="ff-mobile-card">
          <p>{feedback}</p>
          <button type="button" className="ff-mobile-secondary-btn" onClick={() => setFeedback("")}>
            닫기
          </button>
        </article>
      ) : null}

      {error ? (
        <article className="ff-mobile-card">
          <p>{error}</p>
        </article>
      ) : null}

      <article className="ff-mobile-card">
        <div className="ff-mobile-card-head">
          <h2>운용 상태</h2>
          <span className={`ff-mobile-status-badge ${model.overallStatusTone}`}>
            {model.overallStatusLabel}
          </span>
        </div>
        <p className="ff-mobile-meta">증빙 상태: {model.attachmentSummary}</p>
      </article>

      <article className="ff-mobile-card">
        <h2>개선 필요 / 정상 운용</h2>
        {model.viewpoints.length === 0 ? (
          <p className="ff-mobile-empty-inline">점검 관점 정보가 없습니다.</p>
        ) : (
          <div className="ff-mobile-list">
            {model.viewpoints.map((viewpoint) => (
              <div key={viewpoint.key} className="ff-mobile-evidence-row">
                <div className="ff-mobile-evidence-head">
                  <strong>{viewpoint.title}</strong>
                  <span className={`ff-mobile-status-badge ${viewpoint.tone}`}>
                    {viewpoint.evidenceStatus}
                  </span>
                </div>
                <p>{viewpoint.judgement}</p>
                <p className="ff-mobile-meta">{viewpoint.description}</p>
                <p className="ff-mobile-meta">
                  {viewpoint.uploadedCount}/{viewpoint.requiredCount} 첨부
                </p>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="ff-mobile-card">
        <h2>증빙 관리</h2>
        <p>{model.attachmentSummary}</p>
        <button
          type="button"
          className="ff-mobile-primary-btn"
          onClick={() => setShowUploadForm((prev) => !prev)}
        >
          {showUploadForm ? "업로드 폼 닫기" : "증빙 등록 CTA"}
        </button>
      </article>

      {showUploadForm ? (
        <article className="ff-mobile-card">
          <h2>PDF 증빙 업로드</h2>
          <div className="ff-mobile-form-field">
            <label htmlFor="mobile-safety-equipment">설비</label>
            <select
              id="mobile-safety-equipment"
              value={selectedEquipment?.equipmentId || ""}
              onChange={(event) => setEquipmentId(event.target.value)}
            >
              {equipmentList.map((item) => (
                <option key={item.equipmentId} value={item.equipmentId || ""}>
                  {item.name || "설비"}
                </option>
              ))}
            </select>
          </div>

          <div className="ff-mobile-form-field">
            <label htmlFor="mobile-safety-purpose">점검 목적</label>
            <select
              id="mobile-safety-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as InspectionPurpose)}
            >
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ff-mobile-form-field">
            <label htmlFor="mobile-safety-content">점검 내용</label>
            <textarea
              id="mobile-safety-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="점검 내용과 개선 포인트를 작성하세요."
            />
          </div>

          <div className="ff-mobile-form-field">
            <label htmlFor="mobile-safety-file">PDF 업로드</label>
            <input
              id="mobile-safety-file"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <p className="ff-mobile-help">
              모바일 사진 첨부는 준비 중이며, 현재는 PDF 파일 등록 흐름을 우선 지원합니다.
            </p>
          </div>

          {submitError ? <p>{submitError}</p> : null}
          <button
            type="button"
            className="ff-mobile-primary-btn"
            disabled={submitting || loading}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "등록 중..." : "증빙 등록"}
          </button>
        </article>
      ) : null}

      <article className="ff-mobile-card">
        <h2>리포트 형식 생성</h2>
        <p className="ff-mobile-meta">
          {model.canGenerateReport
            ? "정책·분석 문맥이 연결되어 리포트를 확인할 수 있습니다."
            : "analysisId와 policyId가 필요합니다."}
        </p>
        <div className="ff-mobile-action-row">
          <button
            type="button"
            className="ff-mobile-secondary-btn"
            disabled={!model.canGenerateReport}
            onClick={() => navigate(model.reportPreviewPath)}
          >
            미리보기
          </button>
          <button
            type="button"
            className="ff-mobile-ghost-btn"
            disabled={!model.canGenerateReport}
            onClick={() => navigate(model.reportPreviewPath)}
          >
            다운로드
          </button>
        </div>
      </article>

      <article className="ff-mobile-card">
        <h2>등록된 증빙</h2>
        {evidenceItems.length === 0 ? (
          <p className="ff-mobile-empty-inline">등록된 증빙이 없습니다.</p>
        ) : (
          <div className="ff-mobile-list">
            {evidenceItems.map((item) => (
              <div key={item.id} className="ff-mobile-list-item">
                <h3>{item.inspection_pdf_file || "파일명 없음"}</h3>
                <p>{getPurposeLabel(item.inspection_purpose, item.inspection_purpose_label)}</p>
                <p>{formatDate(item.created_at)}</p>
                <div className="ff-mobile-action-row">
                  {item.pdf_file_url ? (
                    <button
                      type="button"
                      className="ff-mobile-secondary-btn"
                      onClick={() => window.open(item.pdf_file_url || "", "_blank", "noopener,noreferrer")}
                    >
                      미리보기
                    </button>
                  ) : (
                    <button type="button" className="ff-mobile-secondary-btn" disabled>
                      미리보기
                    </button>
                  )}
                  <button
                    type="button"
                    className="ff-mobile-ghost-btn"
                    disabled={deletingId === item.id}
                    onClick={async () => {
                      setDeletingId(item.id)
                      try {
                        await removeEvidence(item)
                      } finally {
                        setDeletingId("")
                      }
                    }}
                  >
                    {deletingId === item.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="ff-mobile-secondary-btn"
          onClick={() => navigate(buildMobilePath("/mobile/application", flowContext))}
        >
          신청서 탭으로 돌아가기
        </button>
      </article>
    </section>
  )
}
