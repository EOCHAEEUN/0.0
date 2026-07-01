import {
  ArrowRight,
  ClipboardCheck,
  Plus,
} from "lucide-react"
import { useMemo, type ReactNode } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import engiBot from "../../assets/advisor/engi-bot-transparent.png"
import DashboardWorkspaceSidebar from "../../components/layout/DashboardWorkspaceSidebar"
import { useDashboardData } from "./hooks/useDashboardData"
import type {
  DashboardAnalysisRow,
  DashboardDeadlineList,
  DashboardDeadlineListItem,
} from "./mappers/dashboardMapper"

function HeroButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode
  onClick: () => void
  variant?: "primary" | "secondary"
}) {
  return (
    <button
      type="button"
      className={`ff-hero-btn ${variant}`}
      onClick={onClick}
    >
      {children}
      <ArrowRight aria-hidden="true" size={16} />
    </button>
  )
}

function PanelButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode
  onClick: () => void
  variant?: "primary" | "secondary"
}) {
  return (
    <button
      type="button"
      className={`ff-panel-btn ${variant}`}
      onClick={onClick}
    >
      {children}
      {variant === "primary" ? <span aria-hidden="true">&gt;</span> : null}
    </button>
  )
}

function DashboardSkeleton() {
  return (
    <div className="ff-dashboard-skeleton" aria-hidden="true">
      <div className="ff-skeleton ff-skeleton-hero" />
      <div className="ff-skeleton ff-skeleton-action-card" />
      <div className="ff-skeleton ff-skeleton-analysis" />
    </div>
  )
}

function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <section className="ff-dashboard-error-panel" role="alert">
      <strong>대시보드 데이터를 불러오지 못했습니다.</strong>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        다시 시도
      </button>
    </section>
  )
}

function AnalysisRow({
  row,
  onNavigate,
}: {
  row: DashboardAnalysisRow
  onNavigate: (path: string) => void
}) {
  return (
    <article
      className="ff-analysis-row is-clickable"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(row.ctaPath)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onNavigate(row.ctaPath)
        }
      }}
    >
      <div className="ff-analysis-main">
        <div className="ff-analysis-title-line">
          <strong>{row.title}</strong>
        </div>
        <p>{[row.equipmentName, row.summary].filter(Boolean).join(" · ")}</p>
        {row.detail ? <span className="ff-analysis-investment">{row.detail}</span> : null}
      </div>
      <span className={`ff-status-badge ${row.status}`}>{row.statusLabel}</span>
    </article>
  )
}

function DeadlineFeaturedPanel({
  list,
  onNavigate,
  onViewAll,
}: {
  list: DashboardDeadlineList
  onNavigate: (path: string) => void
  onViewAll: () => void
}) {
  const featured: DashboardDeadlineListItem | undefined = list.items[0]

  return (
    <aside className="ff-deadline-featured-panel">
      <header>
        <strong>{list.title}</strong>
        <button type="button" onClick={onViewAll}>
          {list.viewAllLabel}
        </button>
      </header>

      {featured ? (
        <button
          type="button"
          className={`ff-deadline-featured-card ${featured.urgency}`}
          onClick={() => onNavigate(featured.path)}
        >
          <span className={`ff-dday-pill ${featured.urgency}`}>{featured.dday}</span>
          <strong>{featured.policyTitle}</strong>
          <p>{featured.sourceName}</p>
          <em>공고 조건 확인 →</em>
        </button>
      ) : (
        <div className="ff-deadline-empty">
          <p>{list.emptyMessage}</p>
          {list.emptyState === "snapshot_missing" ? (
            <div className="ff-deadline-empty-actions">
              <button
                type="button"
                onClick={() => onNavigate(list.primaryActionPath || "/analysis/new")}
              >
                {list.primaryActionLabel || "투자 조건 다시 설정"}
              </button>
              <button
                type="button"
                onClick={() => onNavigate(list.secondaryActionPath || "/support-projects")}
              >
                {list.secondaryActionLabel || "최신 지원사업 보기"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={onViewAll}>
              전체 매칭 공고 보기
            </button>
          )}
        </div>
      )}
    </aside>
  )
}

export default function DashboardFeature() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const preferredAnalysisId = useMemo(() => {
    const fromQuery =
      searchParams.get("analysisId")?.trim() || searchParams.get("analysis_id")?.trim() || ""
    if (fromQuery) return fromQuery
    const stateRecord =
      location.state && typeof location.state === "object"
        ? (location.state as Record<string, unknown>)
        : null
    const fromState =
      (typeof stateRecord?.analysisId === "string" && stateRecord.analysisId.trim()) ||
      (typeof stateRecord?.analysis_id === "string" && stateRecord.analysis_id.trim()) ||
      ""
    return fromState
  }, [location.state, searchParams])
  const { dashboard, loading, error, refetch } = useDashboardData({
    preferredAnalysisId,
  })
  const workspace = dashboard.workspace

  const isEmpty = workspace.status === "empty"
  const isDraft = workspace.status === "draft"
  const showErrorOnly = Boolean(error) && dashboard.isFallback && !loading
  const analysisStatusLabel = workspace.analysisId
    ? workspace.legacyPolicyMissing
      ? "정책 이력 없음"
      : workspace.summaryStatusText || "분석 완료"
    : "분석 필요"

  const handlePriorityEquipmentNavigate = () => {
    navigate(workspace.equipmentManagePath || "/equipment")
  }

  const handlePolicyNavigate = () => {
    navigate(workspace.policyPath)
  }

  const handleDetailDownloadNavigate = () => {
    if (workspace.draftPath && workspace.priorityPolicyId) {
      navigate(workspace.draftPath)
      return
    }
    navigate(workspace.policyPath)
  }

  const handleNewRoiNavigate = () => {
    if (!workspace.analysisId && workspace.equipmentCount === 0) {
      handlePriorityEquipmentNavigate()
      return
    }
    navigate(workspace.newRoiPath || "/roi?source=dashboard")
  }

  const handleStartAnalysis = () => {
    navigate(workspace.newAnalysisPath || "/analysis/new?source=dashboard")
  }

  return (
    <main className="page ff-dashboard-workspace-page">
      <div className="ff-dashboard-layout">
        <DashboardWorkspaceSidebar
          paths={{
            newRoiPath: workspace.newRoiPath,
            policyPath: workspace.policyPath,
            draftPath: workspace.draftPath,
            advisorPath: workspace.advisorPath,
            analysisId: workspace.analysisId,
            priorityPolicyId: workspace.priorityPolicyId,
          }}
          stats={{
            equipmentCount: workspace.equipmentCount,
            closingSoonCount: workspace.closingSoonCount,
            matchedPolicyCount: workspace.policySummary.matchedPolicyCount,
            recentAnalysisCount: workspace.recentAnalysisCount,
          }}
        />

        <div className="ff-dashboard-main-content">
          {error && !showErrorOnly && (
            <div className="ff-workspace-alert" role="status">
              {error}
            </div>
          )}

          {loading ? (
            <DashboardSkeleton />
          ) : showErrorOnly ? (
            <DashboardErrorState message={error || "오류가 발생했습니다."} onRetry={() => void refetch()} />
          ) : (
            <>
              <section className="ff-dashboard-hero-card" aria-label="우선 검토 설비 요약">
                <h1>
                  이번 주, 우선 검토할 설비가 <span>{workspace.priorityEquipmentCount}대</span> 있습니다.
                </h1>
                <p>
                  {workspace.heroReason ||
                    `${workspace.equipmentName}은(는) 운영비와 투자효과를 기준으로 먼저 확인할 설비입니다.`}
                </p>
                <div className="ff-dashboard-hero-actions">
                  <HeroButton onClick={handlePriorityEquipmentNavigate}>
                    우선 설비 확인하기
                  </HeroButton>
                  <HeroButton variant="secondary" onClick={handleNewRoiNavigate}>
                    새 ROI 분석하기
                  </HeroButton>
                </div>
              </section>

              <section className="ff-investment-action-card">
                <header className="ff-action-card-top">
                  <div className="ff-company-block">
                    <strong>{workspace.companyName || "기업 정보 등록 필요"}</strong>
                    <p>
                      {[workspace.industryLabel, workspace.regionLabel].filter(Boolean).join(" · ") ||
                        "업종/지역 정보를 등록하면 추천 정확도가 높아집니다."}
                    </p>
                    <span className={`ff-equipment-status-badge ${workspace.status}`}>
                      {workspace.equipmentName} · {analysisStatusLabel}
                    </span>
                  </div>
                  <div className="ff-today-task-block">
                    <strong>
                      오늘 확인할 작업 {workspace.actionCount}개
                    </strong>
                    <p>{workspace.todayTaskNote}</p>
                  </div>
                </header>

                {isEmpty && !workspace.companyName ? (
                  <div className="ff-empty-action">
                    <div>
                      <h2>기업 정보를 등록하면 맞춤 분석을 시작할 수 있습니다.</h2>
                      <p>
                        업종, 지역, 설비 정보를 연결하면 대시보드가 실제 분석 이력과 마감 일정 중심으로 구성됩니다.
                      </p>
                    </div>
                    <PanelButton onClick={() => navigate("/setup/company")}>
                      기업 정보 입력하기
                    </PanelButton>
                  </div>
                ) : isEmpty ? (
                  <div className="ff-empty-action">
                    <div>
                      <h2>{workspace.actionMessage}</h2>
                      <p>{workspace.priorityPolicyTitle}</p>
                    </div>
                    <PanelButton onClick={handleStartAnalysis}>
                      <Plus aria-hidden="true" size={18} />
                      새 투자 분석 시작하기
                    </PanelButton>
                  </div>
                ) : (
                  <div className="ff-action-card-body">
                    <article className="ff-priority-panel">
                      <div className="ff-priority-inner-card">
                        <div className="ff-priority-card-head">
                          <span className="ff-priority-number">01</span>
                          <strong>오늘의 최우선</strong>
                          <span className="ff-engi-recommend-chip">
                            <img src={engiBot} alt="" />
                            <span className="ff-engi-chip-label">
                              <b>Engi 추천</b>
                              <small>분석 근거 포함</small>
                            </span>
                          </span>
                        </div>

                        <strong className="ff-priority-title">{workspace.priorityPolicyTitle}</strong>
                        {workspace.priorityMetaText ? (
                          <p className="ff-priority-meta">{workspace.priorityMetaText}</p>
                        ) : null}

                        {workspace.priorityChips.length > 0 && (
                          <div className="ff-priority-chip-row">
                            {workspace.priorityChips.map((chip) => (
                              <span key={chip}>{chip}</span>
                            ))}
                          </div>
                        )}

                        <div className="ff-engi-inline-advice">
                          <div className="ff-engi-advice-header">
                            <img src={engiBot} alt="" className="ff-engi-advice-icon" />
                            <span>Engi의 판단 · AI 추천 코멘트</span>
                          </div>
                          <p>{workspace.engiMessage.replace(/^Engi:\s*/, "")}</p>
                        </div>

                        <div className="ff-priority-actions">
                          <PanelButton onClick={handlePolicyNavigate}>
                            {workspace.legacyPolicyMissing ? "최신 지원사업 보기" : "지원 조건 확인하기"}
                          </PanelButton>
                          <PanelButton variant="secondary" onClick={handleDetailDownloadNavigate}>
                            상세 자료 다운로드
                          </PanelButton>
                          {isDraft ? (
                            <PanelButton variant="secondary" onClick={() => navigate(workspace.draftPath)}>
                              이어서 작성하기
                            </PanelButton>
                          ) : null}
                        </div>
                      </div>

                      <footer className="ff-policy-trust-line">
                        <span>정책 DB {workspace.policySummary.totalPolicyCount}</span>
                        <span>전체 확인 가능 {workspace.policySummary.activePolicyCount}</span>
                        <span>내 조건 매칭 {workspace.policySummary.matchedPolicyCount}</span>
                      </footer>
                    </article>

                    <DeadlineFeaturedPanel
                      list={workspace.deadlineList}
                      onNavigate={navigate}
                      onViewAll={handlePolicyNavigate}
                    />
                  </div>
                )}
              </section>

              <section className="ff-my-analysis-section">
                <header>
                  <div className="ff-analysis-section-head">
                    <strong>투자안 분석</strong>
                  </div>
                  <button type="button" onClick={handleStartAnalysis}>
                    <Plus aria-hidden="true" size={17} />
                    새 투자 분석 시작
                  </button>
                </header>

                {workspace.analyses.length > 0 ? (
                  <div className="ff-analysis-panel">
                    <div
                      className={`ff-analysis-list-scroll${workspace.analyses.length > 3 ? " is-scrollable" : ""}`}
                    >
                      <div className="ff-analysis-list">
                        {workspace.analyses.slice(0, 10).map((row) => (
                          <AnalysisRow
                            key={`${row.id ?? row.title}-${row.status}`}
                            row={row}
                            onNavigate={navigate}
                          />
                        ))}
                      </div>
                    </div>
                    {workspace.hasMoreAnalyses ? (
                      <div className="ff-analysis-list-footer">
                        <button
                          type="button"
                          className="ff-all-analysis-link ff-all-analysis-link-below"
                          onClick={() => navigate("/roi/history")}
                        >
                          투자분석 전체보기
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="ff-analysis-empty">
                    <ClipboardCheck aria-hidden="true" size={22} />
                    <strong>아직 저장된 투자 분석이 없습니다.</strong>
                    <p>새 분석을 시작하면 이곳에서 진행 상태와 결과를 이어서 확인할 수 있습니다.</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
