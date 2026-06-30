import {
  ArrowRight,
  ClipboardCheck,
  FileSearch,
  Gauge,
  Plus,
} from "lucide-react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
// AppHeader는 AuthenticatedLayout의 GlobalHeader로 통합됨
import engiBot from "../../assets/advisor/engi-bot-transparent.png"
import { useDashboardData } from "./hooks/useDashboardData"
import type {
  DashboardAnalysisRow,
  DashboardDeadlineList,
} from "./mappers/dashboardMapper"

function ActionButton({
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
      className={`ff-workspace-btn ${variant}`}
      onClick={onClick}
    >
      {children}
      <ArrowRight aria-hidden="true" size={16} />
    </button>
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
    <article className="ff-analysis-row">
      <div className="ff-analysis-thumb" aria-hidden="true">
        <Gauge size={20} />
      </div>
      <div className="ff-analysis-main">
        <div className="ff-analysis-title-line">
          <strong>{row.title}</strong>
          <span className={`ff-status-badge ${row.status}`}>{row.statusLabel}</span>
        </div>
        <p>{row.equipmentName}</p>
        <span>{row.summary}</span>
        <em>{row.detail}</em>
      </div>
      <button type="button" onClick={() => onNavigate(row.ctaPath)}>
        {row.ctaLabel}
      </button>
    </article>
  )
}

function DeadlineListPanel({
  list,
  onNavigate,
  onViewAll,
}: {
  list: DashboardDeadlineList
  onNavigate: (path: string) => void
  onViewAll: () => void
}) {
  return (
    <aside className="ff-deadline-list-panel">
      <header>
        <div>
          <h3>{list.title}</h3>
          <p>{list.subtitle}</p>
        </div>
        <button type="button" onClick={onViewAll}>
          {list.viewAllLabel}
        </button>
      </header>

      {list.items.length > 0 ? (
        <div className="ff-deadline-list">
          {list.items.map((item) => (
            <button
              type="button"
              className={`ff-deadline-list-row ${item.urgency}`}
              key={`${item.policyId ?? item.policyTitle}-${item.deadlineDisplay}`}
              onClick={() => onNavigate(item.path)}
            >
              <span className={`ff-dday-pill ${item.urgency}`}>{item.dday}</span>
              {item.isPriority && <span className="ff-priority-pill">우선 검토</span>}
              <strong>{item.policyTitle}</strong>
              <em>
                {item.sourceName} · 마감 {item.deadlineDisplay}
              </em>
              <b>공고 조건 확인 →</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="ff-deadline-empty">
          <p>{list.emptyMessage}</p>
          <button type="button" onClick={onViewAll}>
            전체 매칭 공고 보기
          </button>
        </div>
      )}
    </aside>
  )
}

export default function DashboardFeature() {
  const navigate = useNavigate()
  const { dashboard, loading, error, refetch } = useDashboardData()
  const workspace = dashboard.workspace

  const handleStartAnalysis = () => {
    navigate("/analysis/new")
  }

  const handlePolicyNavigate = () => {
    navigate(workspace.policyPath)
  }

  const handleRoiNavigate = () => {
    navigate(workspace.roiPath)
  }

  const handleDraftNavigate = () => {
    navigate(workspace.draftPath)
  }

  const handleAdvisorNavigate = () => {
    navigate(workspace.advisorPath)
  }

  const isEmpty = workspace.status === "empty"
  const isDraft = workspace.status === "draft"
  const isCompleted = workspace.status === "completed"
  const heroKpis = [
    { label: "관리 설비", value: `${workspace.equipmentCount}대` },
    { label: "우선 검토 설비", value: `${workspace.priorityEquipmentCount}대` },
    { label: "지원사업 매칭", value: `${workspace.policySummary.matchedPolicyCount}` },
    { label: "최근 분석", value: `${workspace.recentAnalysisCount}건` },
  ]

  return (
    <main className="page ff-dashboard-workspace-page">

      <section className="ff-dashboard-workspace">
        {error && (
          <div className="ff-workspace-alert" role="status">
            {error}
          </div>
        )}

        <section className="ff-dashboard-hero-card" aria-label="설비 투자 대시보드 요약">
          <div className="ff-dashboard-hero-copy">
            <span className="ff-ai-engi-badge">FACTOFIT AI ENGI</span>
            <p className="ff-dashboard-hero-eyebrow">설비 투자 대시보드</p>
            <h1>이번 주, 우선 검토할 설비가 {workspace.actionCount}대 있습니다.</h1>
            <strong>운영비 · 노후도 · 투자효과를 바탕으로 먼저 확인할 대상을 정리했어요.</strong>
            <p>
              {workspace.equipmentName}은(는) 노후도와 유지보수 부담을 기준으로 현재 투자 검토 우선순위가 높습니다.
            </p>
            <div className="ff-dashboard-hero-actions">
              <ActionButton onClick={handleRoiNavigate}>우선 설비 확인하기</ActionButton>
              <ActionButton variant="secondary" onClick={handleStartAnalysis}>새 ROI 분석하기</ActionButton>
            </div>
          </div>

          <div className="ff-dashboard-hero-side">
            <img className="ff-dashboard-hero-bot" src={engiBot} alt="" aria-hidden="true" />
            <div className="ff-dashboard-hero-kpis">
              {heroKpis.map((kpi) => (
                <div key={kpi.label} className="ff-dashboard-hero-kpi">
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`ff-investment-action-card ${workspace.status}`}>
          <header className="ff-personal-work-header">
            <div className="ff-company-context-main">
              {loading ? (
                <strong className="ff-company-name-loading">회사 정보를 불러오는 중</strong>
              ) : error ? (
                <>
                  <strong>기업 정보를 불러오지 못했습니다.</strong>
                  <button
                    type="button"
                    className="ff-company-retry-btn"
                    onClick={() => void refetch()}
                  >
                    다시 시도
                  </button>
                </>
              ) : workspace.companyName ? (
                <>
                  <strong>{workspace.companyName}</strong>
                  {(workspace.industryLabel || workspace.regionLabel) && (
                    <span>
                      {[workspace.industryLabel, workspace.regionLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  <em>
                    {workspace.equipmentName} ·{" "}
                    {isCompleted ? "분석 완료" : isDraft ? "작성 중" : "분석 필요"}
                  </em>
                </>
              ) : (
                <>
                  <strong>기업 정보 등록이 필요합니다.</strong>
                  <button
                    type="button"
                    className="ff-company-setup-btn"
                    onClick={() => navigate("/setup/company")}
                  >
                    기업 정보 등록하기
                  </button>
                </>
              )}
            </div>
            <div className="ff-company-context-side">
              <strong>오늘 확인할 작업 {workspace.actionCount}개</strong>
              <span>{workspace.nearestDeadlineSummary}</span>
              {isCompleted && (
                <small className="ff-engi-analyzed-note">
                  <img src={engiBot} alt="" />
                  Engi가 우선 행동을 정리했어요
                </small>
              )}
            </div>
          </header>

          {isEmpty && !workspace.companyName ? (
            <div className="ff-empty-action">
              <div>
                <h2>기업 정보를 등록하면 맞춤 분석을 시작할 수 있습니다.</h2>
                <p>업종과 기업 규모, 설비 정보를 입력하면 ROI 분석과 지원사업 추천을 더 정확하게 받을 수 있습니다.</p>
              </div>
              <ActionButton onClick={() => navigate("/setup/company")}>
                기업 정보 입력하기
              </ActionButton>
            </div>
          ) : isEmpty ? (
            <div className="ff-empty-action">
              <div>
                <h2>{workspace.actionMessage}</h2>
                <p>{workspace.priorityPolicyTitle}</p>
              </div>
              <ActionButton onClick={handleStartAnalysis}>
                <Plus aria-hidden="true" size={18} />
                새 투자 분석 시작
              </ActionButton>
            </div>
          ) : isDraft ? (
            <div className="ff-empty-action">
              <div>
                <h2>{workspace.actionMessage}</h2>
                <p>{workspace.priorityPolicyTitle}</p>
                <span className="ff-engi-inline-advice">{workspace.engiMessage}</span>
              </div>
              <ActionButton onClick={handleDraftNavigate}>이어서 작성하기</ActionButton>
            </div>
          ) : (
            <>
              <div className="ff-action-card-grid">
                <div className="ff-policy-action-panel">
                  <div className="ff-priority-card-head">
                    <span className="ff-priority-number">01</span>
                    <strong>오늘의 최우선</strong>
                    <span className="ff-engi-recommend-chip">
                      <img src={engiBot} alt="" />
                      <span className="ff-engi-chip-label">
                        <b>Engi 추천</b>
                        <small>AI 분석</small>
                      </span>
                    </span>
                  </div>
                  <p className="ff-priority-intro">
                    내 조건 매칭 {workspace.matchedPolicyCount} 중<br />
                    가장 먼저 조건을 확인할 공고입니다.
                  </p>
                  <strong>{workspace.priorityPolicyTitle}</strong>
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
                  <div className="ff-action-buttons">
                    <ActionButton onClick={handlePolicyNavigate}>
                      <FileSearch aria-hidden="true" size={18} />
                      지원 조건 확인하기
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={handleRoiNavigate}>
                      ROI 결과 보기
                    </ActionButton>
                  </div>
                  <button
                    type="button"
                    className="ff-advisor-reason-link"
                    onClick={handleAdvisorNavigate}
                  >
                    <img src={engiBot} alt="" className="ff-engi-btn-icon" />
                    Engi에게 추천 이유 묻기
                  </button>
                </div>

                <DeadlineListPanel
                  list={workspace.deadlineList}
                  onNavigate={navigate}
                  onViewAll={handlePolicyNavigate}
                />
              </div>

              <div className="ff-action-kpi-bar">
                {workspace.kpis.map((kpi) => (
                  <div key={kpi.label}>
                    <span>{kpi.label}</span>
                    <strong>{kpi.value}</strong>
                  </div>
                ))}
              </div>

              <div className="ff-action-progress-line">
                <span>{workspace.progressText}</span>
                <span>{workspace.nextStepText}</span>
              </div>

              <p className="ff-action-trust-line">
                정책 DB {workspace.policySummary.totalPolicyCount} · 현재 확인 가능{" "}
                {workspace.policySummary.activePolicyCount} · 내 조건 매칭{" "}
                {workspace.policySummary.matchedPolicyCount}
              </p>
            </>
          )}
        </section>

        <section className="ff-my-analysis-section">
          <header>
            <div>
              <span>내 투자 분석</span>
              <h2>투자안을 계속 관리하세요.</h2>
            </div>
            <button type="button" onClick={handleStartAnalysis}>
              <Plus aria-hidden="true" size={17} />새 투자 분석 시작
            </button>
          </header>

          {workspace.analyses.length > 0 ? (
            <div className="ff-analysis-list">
              {workspace.analyses.map((row) => (
                <AnalysisRow
                  key={`${row.id ?? row.title}-${row.status}`}
                  row={row}
                  onNavigate={navigate}
                />
              ))}
              {workspace.hasMoreAnalyses && (
                <button className="ff-all-analysis-link" type="button">
                  전체 분석 보기
                </button>
              )}
            </div>
          ) : (
            <div className="ff-analysis-empty">
              <ClipboardCheck aria-hidden="true" size={22} />
              <strong>아직 저장된 투자 분석이 없습니다.</strong>
              <p>새 분석을 시작하면 이곳에서 진행 상태와 결과를 이어서 확인할 수 있습니다.</p>
            </div>
          )}
        </section>

        {!isEmpty && (
          <nav className="ff-quick-text-links" aria-label="빠른 이동">
            <span>빠른 이동</span>
            <button type="button" onClick={() => navigate("/support-projects")}>
              지원사업 추천
            </button>
            <button type="button" onClick={() => navigate("/safety")}>
              안전 진단
            </button>
            <button type="button" onClick={handleAdvisorNavigate}>
              AI Advisor
            </button>
          </nav>
        )}
      </section>
    </main>
  )
}
