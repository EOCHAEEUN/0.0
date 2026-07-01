import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { EvidenceStatusBadge, JudgementStatusBadge } from "./ApplicationDraftShared"

export function ApplicationDraftSafetyEvidence({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const rows = model.data?.safety.rows ?? []

  return (
    <section className="ff-card ff-draft-safety-card">
      <div className="ff-card-head">
        <div>
          <span className="ff-mini-label">안전개선 근거</span>
          <h3>현재 상태와 증빙 여부 판단</h3>
          <p>
            각 관점별 현재 상태와 증빙 보유 여부를 가시성 높게 확인할 수 있도록
            구성했습니다.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="ff-draft-empty-state inline">
          <p>안전개선 근거 표를 불러오지 못했습니다.</p>
          <p className="ff-draft-empty-hint">
            정책·설비 정보가 연결되면 관점별 현재 상태와 증빙 여부가 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="ff-draft-safety-table-wrap">
          <table className="ff-draft-safety-table">
            <thead>
              <tr>
                <th>번호</th>
                <th>관점</th>
                <th>현재 상태</th>
                <th>증빙 여부</th>
                <th>설명·근거</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.no}-${row.viewpoint_key}`}>
                  <td>{row.no}</td>
                  <td>{row.viewpoint_label}</td>
                  <td>
                    <JudgementStatusBadge status={row.current_status} />
                  </td>
                  <td>
                    <EvidenceStatusBadge status={row.evidence_status} />
                  </td>
                  <td>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
