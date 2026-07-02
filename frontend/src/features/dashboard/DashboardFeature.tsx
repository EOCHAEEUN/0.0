import {
  ArrowRight,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  LineChart,
  Plus,
  Wrench,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
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
  variant = "white",
}: {
  children: ReactNode
  onClick: () => void
  variant?: "white" | "outline"
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

function formatMonthTitle(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey
  return `${year}년 ${month}월`
}

const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"]

function getTodayDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`
}

function buildMonthCalendar(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const leadingBlankCount = (firstDay.getDay() + 6) % 7
  const days: Array<{ date: string | null; dayNumber: number | null }> = []

  for (let index = 0; index < leadingBlankCount; index += 1) {
    days.push({ date: null, dayNumber: null })
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    days.push({ date, dayNumber: day })
  }

  return days
}

function SectionHeading({
  number,
  title,
  action,
}: {
  number: string
  title: string
  action?: ReactNode
}) {
  return (
    <header className="ff-section-heading">
      <div className="ff-section-heading-main">
        <span className="ff-section-number">{number}</span>
        <strong>{title}</strong>
      </div>
      {action}
    </header>
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
      className="ff-analysis-row ff-analysis-rich-row is-clickable"
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
      <div className="ff-analysis-rich-leading">
        <div className="ff-analysis-icon" aria-hidden="true">
          <LineChart size={22} />
        </div>
        <div className="ff-analysis-main">
          <div className="ff-analysis-title-line">
            <strong>{row.title}</strong>
            <span className={`ff-status-badge ${row.status}`}>{row.statusLabel}</span>
          </div>
          {row.chips.length > 0 ? (
            <div className="ff-analysis-chip-row">
              {row.chips.map((chip) => (
                <span key={`${row.id ?? row.title}-${chip}`}>{chip}</span>
              ))}
            </div>
          ) : (
            <p>{[row.equipmentName, row.summary].filter(Boolean).join(" · ")}</p>
          )}
          {row.detail ? <span className="ff-analysis-investment">{row.detail}</span> : null}
        </div>
      </div>
      <div className="ff-analysis-kpi-side" aria-label="분석 핵심 지표">
        <div>
          <span>예상 ROI</span>
          <strong>{row.roiText}</strong>
        </div>
        <div>
          <span>연간 비용 절감</span>
          <strong>{row.annualSavingsText}</strong>
        </div>
        <div>
          <span>가동률 향상</span>
          <strong>{row.utilizationText}</strong>
        </div>
      </div>
    </article>
  )
}

function DeadlineCalendarPanel({
  list,
  onNavigate,
  onViewAll,
}: {
  list: DashboardDeadlineList
  onNavigate: (path: string) => void
  onViewAll: () => void
}) {
  const todayKey = getTodayDateKey()
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [expanded, setExpanded] = useState(true)

  const deadlinesByDate = useMemo(() => {
    const grouped = new Map<string, DashboardDeadlineListItem[]>()
    for (const item of list.items) {
      if (!item.deadlineDate) continue
      const bucket = grouped.get(item.deadlineDate) ?? []
      bucket.push(item)
      grouped.set(item.deadlineDate, bucket)
    }
    return grouped
  }, [list.items])

  const calendarDays = useMemo(() => buildMonthCalendar(monthKey), [monthKey])
  const selectedItems = deadlinesByDate.get(selectedDate) ?? []

  const shiftMonth = (offset: number) => {
    const [yearText, monthText] = monthKey.split("-")
    const next = new Date(Number(yearText), Number(monthText) - 1 + offset, 1)
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
    setMonthKey(nextKey)
  }

  return (
    <aside className="ff-dashboard-section-card ff-deadline-calendar-panel">
      <SectionHeading
        number="2"
        title={list.title}
        action={
          <button type="button" onClick={onViewAll}>
            {list.viewAllLabel} &gt;
          </button>
        }
      />

      {list.items.length === 0 ? (
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
                onClick={() => onNavigate(list.secondaryActionPath || "/support-projects/discovery")}
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
      ) : (
        <>
          <div className="ff-deadline-calendar-card">
            <div className="ff-deadline-calendar-toolbar">
              <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={18} />
              </button>
              <strong>{formatMonthTitle(monthKey)}</strong>
              <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="ff-deadline-calendar-week">
              {WEEK_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="ff-deadline-calendar-grid">
              {calendarDays.map((day, index) => {
                if (!day.date || day.dayNumber === null) {
                  return <span key={`blank-${index}`} className="ff-deadline-calendar-day is-empty" />
                }

                const dayItems = deadlinesByDate.get(day.date) ?? []
                const isSelected = day.date === selectedDate
                const isToday = day.date === todayKey

                return (
                  <button
                    key={day.date}
                    type="button"
                    className={`ff-deadline-calendar-day${isSelected ? " is-selected" : ""}${
                      isToday ? " is-today" : ""
                    }`}
                    onClick={() => setSelectedDate(day.date as string)}
                  >
                    <em>{day.dayNumber}</em>
                    {dayItems.length > 0 ? (
                      <i className={dayItems.some((item) => item.urgency === "urgent") ? "urgent" : "upcoming"} />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            className="ff-deadline-calendar-fold"
            onClick={() => setExpanded((current) => !current)}
          >
            <span>
              선택한 날짜 마감 공고 보기 ({selectedItems.length}건)
            </span>
            <ChevronDown
              size={18}
              className={expanded ? "is-open" : undefined}
              aria-hidden="true"
            />
          </button>

          {expanded ? (
            <div className="ff-deadline-list">
              {selectedItems.length > 0 ? (
                selectedItems.map((item) => (
                  <button
                    key={`${item.policyId ?? item.policyTitle}-${item.deadlineDate}`}
                    type="button"
                    className={`ff-deadline-list-row ${item.urgency}`}
                    onClick={() => onNavigate(item.path)}
                  >
                    <span className={`ff-dday-pill ${item.urgency}`}>{item.dday}</span>
                    <strong>{item.policyTitle}</strong>
                    <em>{item.sourceName}</em>
                    <b>공고 조건 확인 →</b>
                  </button>
                ))
              ) : (
                <p className="ff-deadline-calendar-hint">{list.subtitle}</p>
              )}
            </div>
          ) : null}
        </>
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
    navigate(workspace.newRoiPath || "/roi/strategy?source=dashboard")
  }

  const handleStartAnalysis = () => {
    navigate(workspace.newAnalysisPath || "/analysis/new?source=dashboard")
  }

  const companySubtitle = [
    [workspace.industryLabel, workspace.regionLabel].filter(Boolean).join(" · "),
    workspace.equipmentName && analysisStatusLabel
      ? `${workspace.equipmentName} · ${analysisStatusLabel}`
      : "",
  ]
    .filter(Boolean)
    .join("  ")

  const todayTaskNote =
    workspace.actionCount === 0 ? "현재 알림 마감 없음" : workspace.todayTaskNote

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
                <div className="ff-dashboard-hero-copy">
                  <h1>
                    <Wrench aria-hidden="true" size={22} className="ff-hero-inline-icon" />
                    이번 주, 우선 검토할 설비가 <span>{workspace.priorityEquipmentCount}대</span>{" "}
                    있습니다.
                  </h1>
                  <p>
                    {workspace.heroReason ||
                      `${workspace.equipmentName}은(는) 운영비와 투자효과를 기준으로 먼저 확인할 설비입니다.`}
                  </p>
                </div>
                <div className="ff-dashboard-hero-actions">
                  <HeroButton onClick={handlePriorityEquipmentNavigate}>
                    우선 설비 확인하기
                  </HeroButton>
                  <HeroButton variant="outline" onClick={handleNewRoiNavigate}>
                    ROI 분석하기
                  </HeroButton>
                </div>
              </section>

              <section className="ff-company-summary-card" aria-label="기업 요약">
                <div className="ff-company-block">
                  <div className="ff-company-title-line">
                    <Building2 aria-hidden="true" size={18} />
                    <strong>{workspace.companyName || "기업 정보 등록 필요"}</strong>
                  </div>
                  <p>
                    {companySubtitle ||
                      "업종/지역 정보를 등록하면 추천 정확도가 높아집니다."}
                  </p>
                </div>
                <div className="ff-action-kpi-bar" aria-label="대시보드 요약 지표">
                  <div>
                    <span>등록설비</span>
                    <strong>{workspace.equipmentCount}대</strong>
                  </div>
                  <div>
                    <span>마감임박</span>
                    <strong>{workspace.closingSoonCount ?? 0}건</strong>
                  </div>
                  <div>
                    <span>지원사업 매칭</span>
                    <strong>{workspace.policySummary.matchedPolicyCount}건</strong>
                  </div>
                </div>
                <div className="ff-today-task-block">
                  <Bell aria-hidden="true" size={16} />
                  <div>
                    <strong>오늘 확인할 작업 {workspace.actionCount}개</strong>
                    <p>{todayTaskNote}</p>
                  </div>
                </div>
              </section>

              {isEmpty && !workspace.companyName ? (
                <section className="ff-dashboard-section-card ff-empty-action">
                  <div>
                    <h2>기업 정보를 등록하면 맞춤 분석을 시작할 수 있습니다.</h2>
                    <p>
                      업종, 지역, 설비 정보를 연결하면 대시보드가 실제 분석 이력과 마감 일정 중심으로
                      구성됩니다.
                    </p>
                  </div>
                  <PanelButton onClick={() => navigate("/setup/company")}>
                    기업 정보 입력하기
                  </PanelButton>
                </section>
              ) : isEmpty ? (
                <section className="ff-dashboard-section-card ff-empty-action">
                  <div>
                    <h2>{workspace.actionMessage}</h2>
                    <p>{workspace.priorityPolicyTitle}</p>
                  </div>
                  <PanelButton onClick={handleStartAnalysis}>
                    <Plus aria-hidden="true" size={18} />
                    새 투자 분석 시작하기
                  </PanelButton>
                </section>
              ) : (
                <div className="ff-dashboard-main-grid">
                  <article className="ff-dashboard-section-card ff-priority-panel">
                    <div className="ff-priority-card-head">
                      <SectionHeading
                        number="1"
                        title="최우선 지원사업"
                        action={
                          <span className="ff-engi-recommend-chip">
                            <img src={engiBot} alt="" />
                            <span className="ff-engi-chip-label">
                              <b>Engi 추천</b>
                              <small>분석 근거 포함</small>
                            </span>
                          </span>
                        }
                      />
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
                        <Download aria-hidden="true" size={16} />
                        상세 자료 다운로드
                      </PanelButton>
                      {isDraft ? (
                        <PanelButton variant="secondary" onClick={() => navigate(workspace.draftPath)}>
                          이어서 작성하기
                        </PanelButton>
                      ) : null}
                    </div>

                    <footer className="ff-policy-trust-line">
                      <span>정책 DB {workspace.policySummary.totalPolicyCount}</span>
                      <span>전체 확인 가능 {workspace.policySummary.activePolicyCount}</span>
                      <span>내 조건 매칭 {workspace.policySummary.matchedPolicyCount}</span>
                    </footer>
                  </article>

                  <DeadlineCalendarPanel
                    list={workspace.deadlineList}
                    onNavigate={navigate}
                    onViewAll={handlePolicyNavigate}
                  />
                </div>
              )}

              <section className="ff-my-analysis-section">
                <header>
                  <SectionHeading number="3" title="투자안 분석" />
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

              <footer className="ff-dashboard-workspace-footer">
                <p>© 2024 FactoFit Industrial Analytics. All rights reserved.</p>
                <div className="ff-dashboard-workspace-footer-links">
                  <button type="button" onClick={() => navigate("/")}>
                    이용약관
                  </button>
                  <button type="button" onClick={() => navigate("/")}>
                    개인정보처리방침
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
