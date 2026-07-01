import { Fragment, useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import {
  deleteSafetyEvidenceFile,
  generateSafetyPreviewBaseline,
  requestSafetyEvidenceDownload,
  uploadSafetyEvidencePdf,
} from "../applicationDraft.api"
import type { SafetyEvidenceViewpoint } from "../applicationDraft.contract"
import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { EvidenceStatusBadge, JudgementStatusBadge } from "./ApplicationDraftShared"

function formatUpdatedAt(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function ApplicationDraftSafetyEvidence({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const rows = model.data?.safety.rows ?? []
  const summary = model.data?.safety.summary
  const viewpoints = summary?.viewpoints ?? []
  const [expandedKey, setExpandedKey] = useState("")
  const [actionError, setActionError] = useState("")
  const [busyTuple, setBusyTuple] = useState("")
  const [isGeneratingBaseline, setIsGeneratingBaseline] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const viewpointMap = useMemo(() => {
    const map = new Map<string, SafetyEvidenceViewpoint>()
    viewpoints.forEach((item) => map.set(item.viewpoint_key, item))
    return map
  }, [viewpoints])

  const lastUpdatedLabel = useMemo(() => {
    const timestamps = viewpoints
      .flatMap((viewpoint) =>
        viewpoint.required_evidences.flatMap((item) =>
          item.files.map((file) => file.uploaded_at).filter(Boolean),
        ),
      )
      .filter(Boolean) as string[]

    const latestFileAt = timestamps.sort().at(-1)
    return formatUpdatedAt(summary?.summary_updated_at || latestFileAt)
  }, [summary?.summary_updated_at, viewpoints])

  const handleUpload = async (
    viewpoint: SafetyEvidenceViewpoint,
    evidence: SafetyEvidenceViewpoint["required_evidences"][number],
    file: File,
  ) => {
    if (!model.data?.analysis_id || !model.data.policy_id || !model.data.equipment_id) return
    const tupleKey = `${viewpoint.viewpoint_key}:${evidence.safety_rule_id}:${evidence.evidence_type}`
    setBusyTuple(tupleKey)
    setActionError("")
    try {
      await uploadSafetyEvidencePdf({
        analysisId: model.data.analysis_id,
        policyId: model.data.policy_id,
        equipmentId: model.data.equipment_id,
        viewpointKey: viewpoint.viewpoint_key,
        safetyRuleId: evidence.safety_rule_id,
        evidenceType: evidence.evidence_type,
        evidenceLabel: evidence.evidence_label,
        file,
      })
      await model.reload()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "증빙 파일 업로드에 실패했습니다.",
      )
    } finally {
      setBusyTuple("")
    }
  }

  const handleDownload = async (fileId: string) => {
    setActionError("")
    try {
      const payload = await requestSafetyEvidenceDownload(fileId)
      if (payload?.signed_url) {
        window.open(payload.signed_url, "_blank", "noopener,noreferrer")
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "다운로드 URL을 생성하지 못했습니다.",
      )
    }
  }

  const handleDelete = async (fileId: string) => {
    const confirmed = window.confirm("해당 증빙 파일을 삭제할까요?")
    if (!confirmed) return
    setActionError("")
    setBusyTuple(fileId)
    try {
      await deleteSafetyEvidenceFile(fileId)
      await model.reload()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "파일 삭제에 실패했습니다.")
    } finally {
      setBusyTuple("")
    }
  }

  const handleGenerateBaseline = async () => {
    if (
      !model.data?.company_id ||
      !model.data?.analysis_id ||
      !model.data.policy_id ||
      !model.data.equipment_id
    ) {
      setActionError("company_id / analysis_id / policy_id / equipment_id가 필요합니다.")
      return
    }
    setActionError("")
    setIsGeneratingBaseline(true)
    try {
      const generated = await generateSafetyPreviewBaseline({
        companyId: model.data.company_id || "",
        analysisId: model.data.analysis_id,
        policyId: model.data.policy_id,
        equipmentId: model.data.equipment_id,
      })
      if (generated?.can_run_safety_logic === false) {
        setActionError(
          generated?.message || "이 정책은 안전 증빙 기준 생성 대상이 아닙니다.",
        )
      }
      await model.reload()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "안전 증빙 기준 생성에 실패했습니다.",
      )
    } finally {
      setIsGeneratingBaseline(false)
    }
  }

  const handleCancel = () => {
    setExpandedKey("")
    setActionError("")
  }

  const handleSaveAll = async () => {
    setActionError("")
    setIsSaving(true)
    try {
      await model.reload()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "증빙 현황을 저장하지 못했습니다.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="ff-card ff-draft-safety-card">
      <div className="ff-card-head ff-draft-safety-head">
        <div>
          <span className="ff-mini-label">안전개선 근거</span>
          <h3>현재 상태와 증빙 여부 판단</h3>
          <p>
            각 관점별 현재 상태와 증빙 보유 여부를 가시성 높게 확인할 수 있도록
            구성했습니다.
          </p>
        </div>
      </div>

      {model.data?.safety.message ? (
        <div className="ff-draft-empty-state inline">
          <p>{model.data.safety.message}</p>
          <p className="ff-draft-empty-hint">
            안전 증빙 기준 생성은 자동으로 실행되지 않습니다.
          </p>
          <button
            type="button"
            className="btn blue"
            disabled={isGeneratingBaseline}
            onClick={() => void handleGenerateBaseline()}
          >
            {isGeneratingBaseline ? "기준 생성 중..." : "안전 증빙 기준 생성"}
          </button>
          {actionError && <div className="ff-draft-alert warning">{actionError}</div>}
        </div>
      ) : rows.length === 0 ? (
        <div className="ff-draft-empty-state inline">
          <p>안전개선 근거 표를 불러오지 못했습니다.</p>
          <p className="ff-draft-empty-hint">
            정책·설비 정보가 연결되면 관점별 현재 상태와 증빙 여부가 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          <div className="ff-draft-safety-table-wrap">
            {model.data?.safety.is_snapshot_outdated && (
              <div className="ff-draft-alert warning">
                안전 증빙 파일이 변경되었습니다. 신청서 초안을 다시 생성하면 최신 첨부
                현황이 반영됩니다.
              </div>
            )}
            {actionError && <div className="ff-draft-alert warning">{actionError}</div>}

            <table className="ff-draft-safety-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>관점</th>
                  <th>현재 상태</th>
                  <th>증빙 여부</th>
                  <th>설명 · 근거</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const viewpoint = viewpointMap.get(row.viewpoint_key)
                  const isOpen = expandedKey === row.viewpoint_key
                  return (
                    <Fragment key={`${row.no}-${row.viewpoint_key}`}>
                      <tr className={isOpen ? "is-expanded" : undefined}>
                        <td>{row.no}</td>
                        <td>{row.viewpoint_label}</td>
                        <td>
                          <JudgementStatusBadge status={row.current_status} />
                        </td>
                        <td>
                          <EvidenceStatusBadge status={row.evidence_status} />
                        </td>
                        <td>{row.description}</td>
                        <td>
                          <button
                            type="button"
                            className="ff-draft-safety-manage-btn"
                            onClick={() =>
                              setExpandedKey((prev) =>
                                prev === row.viewpoint_key ? "" : row.viewpoint_key,
                              )
                            }
                          >
                            {isOpen ? "접기" : "증빙 관리"}
                            {isOpen ? (
                              <ChevronUp size={14} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={14} aria-hidden="true" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {isOpen && viewpoint && (
                        <tr className="ff-draft-safety-detail-row">
                          <td colSpan={6}>
                            <div className="ff-draft-safety-evidence-panel">
                              <div className="ff-draft-safety-evidence-grid">
                                {viewpoint.required_evidences.map((item) => {
                                  const tupleKey = `${viewpoint.viewpoint_key}:${item.safety_rule_id}:${item.evidence_type}`
                                  return (
                                    <article
                                      key={`${tupleKey}:${item.evidence_label}`}
                                      className="ff-draft-safety-evidence-card"
                                    >
                                      <strong>{item.evidence_label}</strong>
                                      <span className="ff-draft-safety-evidence-id">
                                        {item.safety_rule_id} / {item.evidence_type}
                                      </span>
                                      <EvidenceStatusBadge
                                        status={item.is_uploaded ? "첨부됨" : "미첨부"}
                                      />
                                      <label className="ff-draft-safety-upload-btn">
                                        PDF 업로드
                                        <input
                                          type="file"
                                          accept="application/pdf,.pdf"
                                          hidden
                                          disabled={busyTuple === tupleKey}
                                          onChange={(event) => {
                                            const selected = event.target.files?.[0]
                                            if (!selected) return
                                            void handleUpload(viewpoint, item, selected)
                                            event.currentTarget.value = ""
                                          }}
                                        />
                                      </label>
                                      {item.files.length > 0 ? (
                                        <div className="ff-draft-safety-file-list">
                                          {item.files.map((file) => (
                                            <div
                                              key={file.file_id}
                                              className="ff-draft-safety-file-chip"
                                            >
                                              <span>
                                                {file.file_name}
                                                {file.uploaded_at
                                                  ? ` · ${formatUpdatedAt(file.uploaded_at)}`
                                                  : ""}
                                              </span>
                                              <div className="ff-draft-safety-file-actions">
                                                <button
                                                  type="button"
                                                  className="ff-draft-safety-link-btn"
                                                  onClick={() => void handleDownload(file.file_id)}
                                                >
                                                  다운로드
                                                </button>
                                                <button
                                                  type="button"
                                                  className="ff-draft-safety-link-btn danger"
                                                  disabled={busyTuple === file.file_id}
                                                  onClick={() => void handleDelete(file.file_id)}
                                                >
                                                  삭제
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </article>
                                  )
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <footer className="ff-draft-safety-footer">
            <span>최종 업데이트: {lastUpdatedLabel}</span>
            <div className="ff-draft-safety-footer-actions">
              <button type="button" className="ff-draft-safety-cancel-btn" onClick={handleCancel}>
                취소
              </button>
              <button
                type="button"
                className="ff-draft-safety-save-btn"
                disabled={isSaving}
                onClick={() => void handleSaveAll()}
              >
                {isSaving ? "저장 중..." : "전체 저장"}
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  )
}
