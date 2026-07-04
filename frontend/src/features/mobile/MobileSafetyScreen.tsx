import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { useSafetyCheckData } from "../safetyCheck/hooks/useSafetyCheckData"
import type { InspectionPurpose, SafetyCheckItem } from "../safetyCheck/safetyCheck.contract"
import { PURPOSE_OPTIONS, getPurposeLabel } from "../safetyCheck/safetyCheck.constants"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"

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

  const selectedEquipment = useMemo(
    () => equipmentList.find((item) => item.equipmentId === equipmentId) || representativeEquipment || null,
    [equipmentId, equipmentList, representativeEquipment],
  )

  const evidenceItems: SafetyCheckItem[] = selectedEquipment?.equipmentId
    ? itemsByEquipmentId[selectedEquipment.equipmentId] || []
    : []

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
    } catch (nextError) {
      setSubmitError(nextError instanceof Error ? nextError.message : "증빙 등록에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="ff-mobile-screen">
      <header className="ff-mobile-header">
        <div>
          <h1>안전 점검 증빙 등록</h1>
          <p>
            {flowContext.policyId
              ? "현재 선택된 설비 기준으로 안전·점검 증빙을 등록합니다."
              : "현장에서 PDF 증빙을 빠르게 업로드"}
          </p>
        </div>
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
        <h2>증빙 등록</h2>
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
        <button type="button" className="ff-mobile-primary-btn" disabled={submitting || loading} onClick={() => void handleSubmit()}>
          {submitting ? "등록 중..." : "증빙 등록"}
        </button>
      </article>

      <article className="ff-mobile-card">
        <h2>등록된 증빙</h2>
        {evidenceItems.length === 0 ? (
          <p>등록된 증빙이 없습니다.</p>
        ) : (
          <div className="ff-mobile-list">
            {evidenceItems.map((item) => (
              <div key={item.id} className="ff-mobile-list-item">
                <h3>{item.inspection_pdf_file || "파일명 없음"}</h3>
                <p>{getPurposeLabel(item.inspection_purpose, item.inspection_purpose_label)}</p>
                <p>{formatDate(item.created_at)}</p>
                <div className="ff-mobile-list">
                  {item.pdf_file_url ? (
                    <button
                      type="button"
                      className="ff-mobile-secondary-btn"
                      onClick={() => window.open(item.pdf_file_url || "", "_blank", "noopener,noreferrer")}
                    >
                      상세 보기
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ff-mobile-secondary-btn"
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
