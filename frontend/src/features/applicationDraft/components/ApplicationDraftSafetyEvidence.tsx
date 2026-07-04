import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import SafetyCheckEmbeddedPanel from "../../safetyCheck/SafetyCheckEmbeddedPanel"

export function ApplicationDraftSafetyEvidence({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  return (
    <section className="ff-card ff-draft-safety-card">
      <div className="ff-card-head ff-draft-safety-head">
        <div>
          <span className="ff-mini-label">안전 점검</span>
          <h3>현재 상태와 증빙 여부 판단</h3>
          <p>설비별 점검 증빙을 등록하고 신청서에 반영합니다.</p>
        </div>
      </div>

      {model.data?.safety.is_snapshot_outdated ? (
        <div className="ff-draft-alert warning">
          안전 증빙 파일이 변경되었습니다. 신청서 초안을 다시 생성하면 최신 첨부 현황이
          반영됩니다.
        </div>
      ) : null}

      <SafetyCheckEmbeddedPanel />
    </section>
  )
}
