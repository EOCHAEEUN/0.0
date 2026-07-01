import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ApplicationDraftScenarioSelector } from "./ApplicationDraftScenarioSelector"

export function ApplicationDraftSummary({
  model,
  onGoRoi,
}: {
  model: ApplicationDraftWorkspaceModel
  onGoRoi: () => void
}) {
  const policyLegacy = model.data?.policy?.legacy_missing

  return (
    <section className="ff-draft-summary-section">
      <article className="ff-card ff-draft-summary-card">
        <div className="ff-draft-summary-copy">
          <span className="ff-mini-label">AI 신청서 초안</span>
          <h3>핵심 요약</h3>

          {!model.draftExists ? (
            <div className="ff-draft-empty-state">
              <p>신청서 초안이 아직 생성되지 않았습니다.</p>
              <p className="ff-draft-empty-hint">
                ROI·정책·설비 정보가 준비되면 초안 생성 버튼으로 DB에 저장된
                초안을 만들 수 있습니다. 자동 생성은 실행되지 않습니다.
              </p>
              {policyLegacy && (
                <p className="ff-draft-empty-hint warn">
                  이 분석에는 정책 스냅샷 이력이 없습니다. 최신 정책으로
                  대체되지 않습니다.
                </p>
              )}
              <button
                type="button"
                className="btn blue"
                disabled={
                  model.isGeneratingDraft ||
                  !model.data?.policy_id ||
                  policyLegacy
                }
                onClick={() => void model.handleGenerateDraft()}
              >
                {model.isGeneratingDraft ? "초안 생성 중..." : "신청서 초안 생성"}
              </button>
              {model.generateError && (
                <div className="ff-draft-alert warning">{model.generateError}</div>
              )}
            </div>
          ) : (
            <div className="ff-summary-box is-multiline">
              {model.summaryText.split("\n\n").map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>
      </article>

      <ApplicationDraftScenarioSelector model={model} onGoRoi={onGoRoi} />
    </section>
  )
}
