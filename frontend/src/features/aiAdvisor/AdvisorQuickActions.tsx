import { useState, type ReactNode } from "react"
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
  trailingAction?: ReactNode
  collapsible?: boolean
}

function MobileQuickActionsCollapsedBar({
  actions,
  loadingActionId,
  onAction,
  onExpand,
}: {
  actions: AdvisorActionDefinition[]
  loadingActionId: string | null
  onAction: (action: AdvisorActionDefinition) => void
  onExpand: () => void
}) {
  return (
    <div
      className={`ff-mobile-advisor-quick-toggle-row${actions.length < 5 ? " is-compact" : ""}`}
    >
      {actions.map((action) => {
        const isLoading = loadingActionId === action.id
        return (
          <button
            key={action.id}
            type="button"
            className="ff-mobile-advisor-quick-icon-btn"
            aria-label={isLoading ? action.loadingLabel : action.label}
            title={action.label}
            disabled={Boolean(loadingActionId)}
            onClick={() => onAction(action)}
          >
            <AdvisorActionIcon actionId={action.id} />
          </button>
        )
      })}
      <button type="button" className="ff-mobile-advisor-quick-open-btn" onClick={onExpand}>
        열기
      </button>
    </div>
  )
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
  trailingAction,
  collapsible = false,
}: AdvisorQuickActionsProps) {
  const [expanded, setExpanded] = useState(false)

  const handleAction = (action: AdvisorActionDefinition) => {
    onAction(action)
    if (collapsible) setExpanded(false)
  }

  if (variant === "workspace") {
    if (!hasAnalysis) {
      const action = NO_ANALYSIS_ACTION
      const isLoading = loadingActionId === action.id

      if (collapsible && !expanded) {
        return (
          <div className="ff-advisor-workspace-toolbar ff-advisor-workspace-toolbar--collapsed">
            <MobileQuickActionsCollapsedBar
              actions={[action]}
              loadingActionId={loadingActionId}
              onAction={handleAction}
              onExpand={() => setExpanded(true)}
            />
          </div>
        )
      }

      return (
        <div
          className={`ff-advisor-workspace-toolbar${collapsible ? " ff-advisor-workspace-toolbar--expanded" : ""}`}
        >
          <div className="ff-advisor-action-row ff-advisor-action-row--workspace">
            <button
              type="button"
              className="ff-advisor-action-btn ff-advisor-action-btn--workspace is-primary"
              disabled={Boolean(loadingActionId)}
              onClick={() => handleAction(action)}
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
          {collapsible ? (
            <button
              type="button"
              className="ff-mobile-advisor-quick-collapse-btn"
              onClick={() => setExpanded(false)}
            >
              접기
            </button>
          ) : null}
        </div>
      )
    }

    if (collapsible && !expanded) {
      return (
        <div className="ff-advisor-workspace-toolbar ff-advisor-workspace-toolbar--collapsed">
          <MobileQuickActionsCollapsedBar
            actions={ANALYSIS_QUICK_ACTIONS}
            loadingActionId={loadingActionId}
            onAction={handleAction}
            onExpand={() => setExpanded(true)}
          />
        </div>
      )
    }

    return (
      <div
        className={`ff-advisor-workspace-toolbar${collapsible ? " ff-advisor-workspace-toolbar--expanded" : ""}`}
      >
        <div className="ff-advisor-action-row ff-advisor-action-row--workspace">
          <ActionButtons
            actions={ANALYSIS_QUICK_ACTIONS}
            loadingActionId={loadingActionId}
            onAction={handleAction}
            buttonClassName="ff-advisor-action-btn ff-advisor-action-btn--workspace"
          />
          {trailingAction}
          <button
            type="button"
            className="ff-advisor-context-change ff-advisor-context-change--workspace"
            onClick={onChangeAnalysis}
          >
            분석 변경
          </button>
        </div>
        {collapsible ? (
          <button
            type="button"
            className="ff-mobile-advisor-quick-collapse-btn"
            onClick={() => setExpanded(false)}
          >
            접기
          </button>
        ) : null}
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
