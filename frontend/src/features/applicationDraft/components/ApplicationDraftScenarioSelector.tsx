import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ScenarioToggle } from "./ApplicationDraftShared"

export function ApplicationDraftScenarioSelector({
  model,
  onGoRoi,
}: {
  model: ApplicationDraftWorkspaceModel
  onGoRoi: () => void
}) {
  return (
    <article className="ff-card ff-draft-scenario-card">
      <div className="ff-draft-scenario-panel-head">
        <h4>투자 시나리오 선택</h4>
        <button type="button" className="ff-draft-roi-link" onClick={onGoRoi}>
          ROI 다시 보기
        </button>
      </div>

      <ScenarioToggle selected={model.scenarioKey} onChange={model.setScenarioKey} />

      <div className="ff-draft-metric-stack">
        <div>
          <span>총 투자금</span>
          <strong>{model.investmentLabel}</strong>
        </div>
        <div>
          <span>예상 지원금</span>
          <strong>{model.subsidyLabel}</strong>
        </div>
        <div className="is-payback">
          <span>예상 회수기간</span>
          <strong>{model.paybackLabel}</strong>
        </div>
      </div>
    </article>
  )
}
