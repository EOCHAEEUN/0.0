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
    <div className="ff-draft-scenario-panel">
      <div className="ff-draft-scenario-panel-head">
        <button type="button" className="ff-soft-button" onClick={onGoRoi}>
          ROI 다시 보기 ↗
        </button>
      </div>

      <h4>투자 시나리오 선택</h4>
      <p className="ff-draft-scenario-desc">
        시나리오를 선택하면 예상 지원금과 회수기간이 함께 반영됩니다.
      </p>

      <ScenarioToggle
        selected={model.scenarioKey}
        onChange={model.setScenarioKey}
      />

      <div className="ff-metric-grid compact">
        <div>
          <span>총 투자금</span>
          <strong>{model.investmentLabel}</strong>
        </div>
        <div>
          <span>예상 지원금</span>
          <strong>{model.subsidyLabel}</strong>
        </div>
        <div>
          <span>예상 회수기간</span>
          <strong>{model.paybackLabel}</strong>
        </div>
      </div>
    </div>
  )
}
