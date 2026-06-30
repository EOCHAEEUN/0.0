import type {
  ApplicationDraftWorkspaceData,
  ReadinessItemStatus,
} from "../applicationDraft.contract"
import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ReadinessStatusBadge } from "./ApplicationDraftShared"

const READINESS_ITEMS: Array<{
  key: keyof ApplicationDraftWorkspaceData["readiness"]
  label: string
}> = [
  { key: "company", label: "기업정보" },
  { key: "equipment", label: "설비정보" },
  { key: "roi", label: "ROI 분석" },
  { key: "policy", label: "지원사업" },
]

export function ApplicationDraftReadinessPanel({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const readiness = model.data?.readiness

  if (!readiness) return null

  return (
    <div className="ff-draft-readiness-panel">
      <div className="ff-draft-readiness-panel-head">
        <div>
          <h4>초안 준비 현황</h4>
          <p>완료 항목과 수정이 필요한 항목을 구분해 보여드립니다.</p>
        </div>
        <span className="ff-draft-ai-pulse" aria-hidden="true">
          <i />
          AI 검토 진행
        </span>
      </div>

      <div className="ff-draft-readiness-grid">
        {READINESS_ITEMS.map((item) => {
          const row = readiness[item.key]
          const status = row.status as ReadinessItemStatus

          return (
            <article key={item.key} className="ff-draft-readiness-tile">
              <div className="ff-draft-readiness-tile-top">
                <strong>{item.label}</strong>
                <ReadinessStatusBadge
                  tone={model.readinessBadgeTone(status)}
                  label={model.readinessBadgeLabel(status)}
                />
              </div>
              <p>{row.summary}</p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
