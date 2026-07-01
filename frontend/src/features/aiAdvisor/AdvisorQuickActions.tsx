import {
  ANALYSIS_QUICK_ACTIONS,
  NO_ANALYSIS_ACTION,
  type AdvisorActionDefinition,
} from "./advisorActions"

type AdvisorQuickActionsProps = {
  hasAnalysis: boolean
  loadingActionId: string | null
  onChangeAnalysis: () => void
  onAction: (action: AdvisorActionDefinition) => void
}

export default function AdvisorQuickActions({
  hasAnalysis,
  loadingActionId,
  onChangeAnalysis,
  onAction,
}: AdvisorQuickActionsProps) {
  if (!hasAnalysis) {
    const action = NO_ANALYSIS_ACTION
    const Icon = action.icon
    const isLoading = loadingActionId === action.id
    return (
      <div className="ff-advisor-quick-panel">
        <div className="ff-advisor-quick-panel-head">
          <strong>현재 분석 빠른 실행</strong>
        </div>
        <p className="ff-advisor-quick-hint">분석이 없어서 새 투자 분석부터 시작합니다.</p>
        <button
          type="button"
          className="ff-advisor-action-btn is-primary"
          disabled={Boolean(loadingActionId)}
          onClick={() => onAction(action)}
        >
          <Icon size={15} aria-hidden />
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
        {ANALYSIS_QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          const isLoading = loadingActionId === action.id
          return (
            <button
              key={action.id}
              type="button"
              className="ff-advisor-action-btn"
              disabled={Boolean(loadingActionId)}
              onClick={() => onAction(action)}
            >
              <Icon size={15} aria-hidden />
              <span>{isLoading ? action.loadingLabel : action.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
