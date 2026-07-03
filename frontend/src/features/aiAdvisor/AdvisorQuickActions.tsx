import AdvisorActionIcon from "./AdvisorActionIcon"
import {
  ANALYSIS_QUICK_ACTIONS,
  NO_ANALYSIS_ACTION,
  type AdvisorActionDefinition,
} from "./advisorActions"

type AdvisorQuickActionsProps = {
  variant?: "compact" | "workspace"
  hasAnalysis: boolean
  loadingActionId: string | null
  onChangeAnalysis: () => void
  onAction: (action: AdvisorActionDefinition) => void
}

function ActionButtons({
  actions,
  loadingActionId,
  onAction,
  buttonClassName,
}: {
  actions: AdvisorActionDefinition[]
  loadingActionId: string | null
  onAction: (action: AdvisorActionDefinition) => void
  buttonClassName?: string
}) {
  return (
    <>
      {actions.map((action) => {
        const isLoading = loadingActionId === action.id
        return (
          <button
            key={action.id}
            type="button"
            className={buttonClassName || "ff-advisor-action-btn"}
            disabled={Boolean(loadingActionId)}
            onClick={() => onAction(action)}
          >
            <AdvisorActionIcon actionId={action.id} />
            <span>{isLoading ? action.loadingLabel : action.label}</span>
          </button>
        )
      })}
    </>
  )
}

export default function AdvisorQuickActions({
  variant = "compact",
  hasAnalysis,
  loadingActionId,
  onChangeAnalysis,
  onAction,
}: AdvisorQuickActionsProps) {
  if (variant === "workspace") {
    if (!hasAnalysis) {
      const action = NO_ANALYSIS_ACTION
      const isLoading = loadingActionId === action.id
      return (
        <div className="ff-advisor-workspace-toolbar">
          <div className="ff-advisor-action-row ff-advisor-action-row--workspace">
            <button
              type="button"
              className="ff-advisor-action-btn ff-advisor-action-btn--workspace is-primary"
              disabled={Boolean(loadingActionId)}
              onClick={() => onAction(action)}
            >
              <AdvisorActionIcon actionId={action.id} />
              <span>{isLoading ? action.loadingLabel : action.label}</span>
            </button>
            <button
              type="button"
              className="ff-advisor-context-change ff-advisor-context-change--workspace"
              onClick={onChangeAnalysis}
            >
              분석 변경
            </button>
          </div>
          <p className="ff-advisor-quick-hint">분석 결과를 먼저 선택해주세요.</p>
        </div>
      )
    }

    return (
      <div className="ff-advisor-workspace-toolbar">
        <div className="ff-advisor-action-row ff-advisor-action-row--workspace">
          <ActionButtons
            actions={ANALYSIS_QUICK_ACTIONS}
            loadingActionId={loadingActionId}
            onAction={onAction}
            buttonClassName="ff-advisor-action-btn ff-advisor-action-btn--workspace"
          />
          <button
            type="button"
            className="ff-advisor-context-change ff-advisor-context-change--workspace"
            onClick={onChangeAnalysis}
          >
            분석 변경
          </button>
        </div>
      </div>
    )
  }

  if (!hasAnalysis) {
    const action = NO_ANALYSIS_ACTION
    const isLoading = loadingActionId === action.id
    return (
      <div className="ff-advisor-quick-panel">
        <div className="ff-advisor-quick-panel-head">
          <strong>현재 분석 빠른 실행</strong>
          <button type="button" className="ff-advisor-context-change" onClick={onChangeAnalysis}>
            분석 변경
          </button>
        </div>
        <p className="ff-advisor-quick-hint">분석 결과를 먼저 선택해주세요.</p>
        <button
          type="button"
          className="ff-advisor-action-btn is-primary"
          disabled={Boolean(loadingActionId)}
          onClick={() => onAction(action)}
        >
          <AdvisorActionIcon actionId={action.id} />
          <span>{isLoading ? action.loadingLabel : action.label}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="ff-advisor-quick-panel">
      <div className="ff-advisor-quick-panel-head">
        <strong>현재 분석 빠른 실행</strong>
        <button type="button" className="ff-advisor-context-change" onClick={onChangeAnalysis}>
          분석 변경
        </button>
      </div>

      <div className="ff-advisor-action-row">
        <ActionButtons
          actions={ANALYSIS_QUICK_ACTIONS}
          loadingActionId={loadingActionId}
          onAction={onAction}
        />
      </div>
    </div>
  )
}
