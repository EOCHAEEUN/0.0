import { useMemo, useState } from "react"
import { useSafetyDashboard } from "./hooks/useSafetyDashboard"
import type {
  PenaltyAmountNote,
  PreWorkChecklistItem,
  SafetyCalendarEvent,
  SafetyEquipmentDashboardItem,
  SafetyInspectionItem,
  SafetyPurposeBreakdown,
  SafetySummaryCounts,
} from "./safety.contract"
import "./safety.css"

type SafetyTab = "legal" | "voluntary"
type ListMode = "priority" | "all"

type CalendarDay = {
  date: string | null
  dayNumber: number | null
  events: SafetyCalendarEvent[]
}

type PenaltyGroup = {
  equipmentName: string
  overdueCount: number
  items: SafetyInspectionItem[]
}

const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"]

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatMonthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
}

function getMonthKeyFromCalendar(calendar?: Record<string, SafetyCalendarEvent[]> | null) {
  const firstDate = Object.keys(calendar ?? {}).sort()[0]
  if (firstDate) return firstDate.slice(0, 7)

  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${now.getFullYear()}-${month}`
}

function buildMonthCalendar(
  monthKey: string,
  calendar?: Record<string, SafetyCalendarEvent[]> | null,
): CalendarDay[] {
  const [yearText, monthText] = monthKey.split("-")
  const year = safeNumber(yearText, new Date().getFullYear())
  const month = safeNumber(monthText, new Date().getMonth() + 1)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const leadingBlankCount = (firstDay.getDay() + 6) % 7
  const days: CalendarDay[] = []

  for (let index = 0; index < leadingBlankCount; index += 1) {
    days.push({ date: null, dayNumber: null, events: [] })
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    days.push({
      date,
      dayNumber: day,
      events: calendar?.[date] ?? [],
    })
  }

  return days
}

function formatDaysLeft(daysLeft?: number | null) {
  if (daysLeft === null || daysLeft === undefined) return "-"
  if (daysLeft < 0) return `D+${Math.abs(daysLeft)}`
  if (daysLeft === 0) return "D-DAY"
  return `D-${daysLeft}`
}

function getDisplayStatus(item: SafetyInspectionItem | SafetyCalendarEvent) {
  if (item.days_left === null || item.days_left === undefined) return "점검일 입력 필요"
  if (item.days_left < 0) return "기한 초과"
  if (item.days_left <= 10) return "기한 임박"
  return "완료"
}

function getStatusClass(item: SafetyInspectionItem | SafetyCalendarEvent) {
  if (item.days_left === null || item.days_left === undefined) return "empty"
  if (item.days_left < 0) return "danger"
  if (item.days_left <= 10) return "warning"
  return "done"
}

function getRiskLabel(risk?: string | null) {
  if (risk === "critical") return "매우 높음"
  if (risk === "high") return "높음"
  if (risk === "medium") return "보통"
  if (risk === "low") return "낮음"
  return risk || "보통"
}

function getRuleTitle(item: SafetyInspectionItem | SafetyCalendarEvent) {
  return item.rule?.inspection_type || item.rule?.check_item || "점검 항목"
}

function getRuleDescription(item: SafetyInspectionItem) {
  return (
    item.rule?.check_item ||
    item.rule?.purpose ||
    item.rule?.recommended_cycle ||
    item.rule?.cycle_text ||
    "점검 기준을 확인하고 완료 여부를 저장하세요."
  )
}

function getPenaltyMaxAmount(note?: PenaltyAmountNote | null) {
  const amounts = note?.amounts ?? []
  const values = amounts
    .map((amount) => safeNumber(amount.amount_value_manwon, 0))
    .filter((amount) => amount > 0)

  if (!values.length) return null
  return Math.max(...values)
}

function getPenaltyText(note?: PenaltyAmountNote | null) {
  const maxAmount = getPenaltyMaxAmount(note)
  if (maxAmount) return `과태료 최대 ${maxAmount.toLocaleString()}만원 부과 가능`
  if (note?.display_label) return note.display_label
  if (note?.raw_text) return note.raw_text
  return "법정점검 미이행 · 과태료 또는 감독 전환 위험"
}

function getPenaltyBasisText(value?: string | null) {
  if (!value) return ""
  return value.split("(")[0]?.trim() || value
}

function getSummaryValue(summary: SafetySummaryCounts | null | undefined, key: keyof SafetySummaryCounts) {
  return safeNumber(summary?.[key], 0)
}

function getTodayPreWorkProgress(total?: number | null, checked?: number | null) {
  const totalCount = safeNumber(total, 0)
  const checkedCount = safeNumber(checked, 0)
  if (!totalCount) return 0
  return Math.round((checkedCount / totalCount) * 100)
}

function buildPenaltyGroups(items: SafetyEquipmentDashboardItem[]): PenaltyGroup[] {
  return items
    .map((equipment) => {
      const overdueLegalItems = (equipment.all_items ?? []).filter(
        (item) => item.rule_type === "legal" && typeof item.days_left === "number" && item.days_left < 0,
      )

      return {
        equipmentName: equipment.equipment_name || "설비명 없음",
        overdueCount: overdueLegalItems.length,
        items: overdueLegalItems,
      }
    })
    .filter((group) => group.overdueCount > 0)
}

function EmptyState({ text }: { text: string }) {
  return <div className="ff-safety-empty">{text}</div>
}

function TopNavigation() {
  const navItems = ["대시보드", "ROI 분석", "지원사업", "신청서 생성", "안전점검", "AI Advisor"]

  return (
    <nav className="ff-safety-topnav">
      <a className="ff-safety-logo" href="/">F</a>

      <div className="ff-safety-navlinks">
        {navItems.map((item) => (
          <a key={item} className={item === "안전점검" ? "active" : ""} href="#">
            {item}
          </a>
        ))}
      </div>

      <div className="ff-safety-nav-actions">
        <a href="#">고객문의</a>
        <a className="white" href="/mypage">마이페이지</a>
      </div>
    </nav>
  )
}

function PenaltyBanner({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" className={`ff-safety-floating-penalty ${count > 0 ? "danger" : "good"}`} onClick={onClick}>
      <span>{count > 0 ? "!" : "✓"}</span>
      {count > 0 ? `법정점검 기한초과 ${count}건 · 과태료 위험` : "법정점검 기한초과 없음 · 정상"}
      <em>클릭하여 상세 보기 ↗</em>
    </button>
  )
}

function PenaltyModal({
  open,
  groups,
  onClose,
  onConfirm,
}: {
  open: boolean
  groups: PenaltyGroup[]
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="ff-safety-modal-backdrop">
      <section className="ff-safety-penalty-modal">
        <button className="ff-safety-modal-close" type="button" onClick={onClose}>×</button>

        <div className="ff-safety-modal-head">
          <span>⚠</span>
          <div>
            <h3>법정점검 기한초과 알림</h3>
            <p>현재 과태료·처벌 대상 항목이 발견되었습니다</p>
          </div>
        </div>

        <div className="ff-safety-penalty-groups">
          {!groups.length && <div className="ff-safety-modal-ok">기한초과 법정점검 항목이 없습니다.</div>}

          {groups.map((group, groupIndex) => (
            <article
              key={`${group.equipmentName}-${groupIndex}`}
              className={`ff-safety-penalty-group ${group.overdueCount > 0 ? "danger" : "ok"}`}
            >
              <div className="ff-safety-penalty-group-head">
                <strong><i />{group.equipmentName}</strong>
                <span>{group.overdueCount > 0 ? `${group.overdueCount}건 초과` : "기한초과 없음"}</span>
              </div>

              {group.overdueCount > 0 ? (
                group.items.map((item, index) => (
                  <div key={`${group.equipmentName}-${item.rule?.rule_id}-${index}`} className="ff-safety-penalty-item">
                    <div>
                      <b>{getRuleTitle(item)}</b>
                      <p>{getPenaltyText(item.rule?.penalty_amount_note)}</p>
                      {item.rule?.penalty_basis && <small>{getPenaltyBasisText(item.rule.penalty_basis)}</small>}
                    </div>
                    <em>{formatDaysLeft(item.days_left)}</em>
                  </div>
                ))
              ) : null}
            </article>
          ))}
        </div>

        <div className="ff-safety-modal-notice">
          ⚠ 해당 과태료 금액은 일반적인 기준이며, 실제 처벌 수준은 위반 횟수·경위 등에 따라 달라질 수 있습니다. 정확한 법적 판단은 전문가에게 문의하세요.
        </div>

        <button className="ff-safety-modal-primary" type="button" onClick={onConfirm}>
          확인 후 즉시 점검 기록하기
        </button>
      </section>
    </div>
  )
}

function CalendarSection({
  calendar,
  monthKey,
  onPrevMonth,
  onNextMonth,
}: {
  calendar?: Record<string, SafetyCalendarEvent[]> | null
  monthKey: string
  onPrevMonth: () => void
  onNextMonth: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const days = useMemo(() => buildMonthCalendar(monthKey, calendar), [calendar, monthKey])
  const [year, month] = monthKey.split("-").map(Number)
  const titleDate = new Date(year, month - 1, 1)

  const flattenedEvents = useMemo(
    () =>
      Object.entries(calendar ?? {})
        .flatMap(([date, events]) =>
          events.map((event) => ({ date, event })),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8),
    [calendar],
  )

  return (
    <section className="ff-safety-calendar-panel">
      <div className="ff-safety-scheduler-head">
        <div>
          <h3>안전점검 스케줄러</h3>
          <p>전체 설비 3대 · 점검 일정 통합 보기</p>
        </div>
      </div>

      <div className="ff-safety-calendar-card">
        <div className="ff-safety-calendar-title">
          <button type="button" onClick={onPrevMonth}>‹</button>
          <strong>{formatMonthTitle(titleDate)}</strong>
          <button type="button" onClick={onNextMonth}>›</button>
        </div>

        {!collapsed ? (
          <>
            <div className="ff-safety-calendar-week">
              {WEEK_LABELS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="ff-safety-calendar-grid">
              {days.map((day, index) => (
                <article
                  key={day.date ?? `blank-${index}`}
                  className={[
                    "ff-safety-day-cell",
                    day.events.some((event) => getStatusClass(event) === "danger") ? "has-danger" : "",
                    !day.date ? "blank" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {day.dayNumber && <b>{day.dayNumber}</b>}

                  {day.events.slice(0, 2).map((event, eventIndex) => (
                    <div key={`${day.date}-${eventIndex}`} className={`ff-safety-calendar-event ${getStatusClass(event)}`}>
                      <span>
                        {getRuleTitle(event)} {event.days_left !== null && event.days_left !== undefined ? formatDaysLeft(event.days_left) : ""}
                      </span>
                      <small>{event.equipment_name}</small>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="ff-safety-calendar-listview">
            {flattenedEvents.length ? (
              flattenedEvents.map(({ date, event }, index) => (
                <div key={`${date}-${index}`} className={`ff-safety-calendar-listitem ${getStatusClass(event)}`}>
                  <div>
                    <b>{date.replaceAll("-", ".")}</b>
                    <strong>{getRuleTitle(event)}</strong>
                    <p>{event.equipment_name}</p>
                  </div>
                  <em>{formatDaysLeft(event.days_left)}</em>
                </div>
              ))
            ) : (
              <EmptyState text="표시할 일정이 없습니다." />
            )}
          </div>
        )}

        <button type="button" className="ff-safety-calendar-fold" onClick={() => setCollapsed((current) => !current)}>
          {collapsed ? "∨ 달력 펼치기" : "︿ 목록으로 접기"}
        </button>
      </div>
    </section>
  )
}

function EquipmentPanel({
  items,
  selected,
  unsupportedNames,
  onSelect,
}: {
  items: SafetyEquipmentDashboardItem[]
  selected: SafetyEquipmentDashboardItem | null
  unsupportedNames: string[]
  onSelect: (item: SafetyEquipmentDashboardItem) => void
}) {
  const visibleItems = items.slice(0, 4)

  return (
    <section className="ff-safety-equipment-section">
      <article className="ff-safety-equipment-hero">
        <div className="ff-safety-equipment-line" />
        <span>{String(selected?.equipment_category || "PRESS").toUpperCase()}</span>
        <h3>{selected?.equipment_name || "설비를 선택해주세요"}</h3>
        <p>{selected?.age_years ?? "-"}년 사용 · 점검 항목 {selected?.total_rule_count ?? 0}개</p>
      </article>

      <div className="ff-safety-equipment-select">
        <h4>등록 설비 선택</h4>

        {visibleItems.map((item) => {
          const name = item.equipment_name || "설비명 없음"
          const isSelected = selected?.equipment_id === item.equipment_id
          const unsupported = unsupportedNames.includes(name)

          return (
            <button
              key={item.equipment_id || name}
              type="button"
              className={[
                "ff-safety-equipment-option",
                isSelected ? "active" : "",
                unsupported ? "disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(item)}
            >
              <b>{name}</b>
              <span>{unsupported ? "지원 안 됨" : isSelected ? "선택됨" : "보기"}</span>
            </button>
          )
        })}

        {!visibleItems.length && <EmptyState text="등록된 설비가 없습니다." />}
      </div>
    </section>
  )
}

function PreWorkChecklistSection({
  items,
  total,
  checked,
  onCheck,
  isSaving,
  isLoading,
}: {
  items: PreWorkChecklistItem[]
  total: number
  checked: number
  onCheck: (ruleId: string, ruleType: string) => void
  isSaving: boolean
  isLoading: boolean
}) {
  const progress = getTodayPreWorkProgress(total, checked)
  const unchecked = Math.max(total - checked, 0)
  const canStart = total > 0 && unchecked === 0
  const visibleItems = items.slice(0, 4)

  return (
    <section className="ff-safety-prework-section">
      <div className="ff-safety-section-title">
        <div>
          <h3>오늘의 작업 전 점검</h3>
          <p>작업 시작 전 매일 확인이 필요한 항목입니다</p>
        </div>
        <span>{unchecked}건 미확인</span>
      </div>

      <div className="ff-safety-checklist-card">
        {isLoading && <EmptyState text="작업 전 체크리스트를 불러오는 중입니다." />}

        {!isLoading && !visibleItems.length && <EmptyState text="작업 전 체크리스트 항목이 없습니다." />}

        {!isLoading &&
          visibleItems.map((item) => {
            const checkedToday = Boolean(item.checked_today)
            const ruleId = item.rule_id || ""

            return (
              <label key={`${item.rule_type}-${ruleId}`} className={`ff-safety-checkline ${checkedToday ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={checkedToday}
                  disabled={checkedToday || !ruleId || isSaving}
                  onChange={() => onCheck(ruleId, item.rule_type || "voluntary")}
                />

                <span>
                  <b>{item.inspection_type || "작업 전 점검"}</b>
                  <small>{item.check_item || "점검 내용을 확인하세요."}</small>
                </span>

                <em className={checkedToday ? "done" : "missing"}>{checkedToday ? "오늘 확인" : "미확인"}</em>
              </label>
            )
          })}
      </div>

      <div className={`ff-safety-work-ready ${canStart ? "ready" : ""}`}>
        {canStart ? "모든 항목 확인 완료 — 작업 시작 가능" : "미확인 항목이 있습니다 — 모두 확인 후 작업 시작"}
        <small>{progress}% 완료</small>
      </div>
    </section>
  )
}

function SummaryStrip({ summary }: { summary?: SafetySummaryCounts | null }) {
  const cards = [
    {
      label: "법정점검 기한초과",
      value: getSummaryValue(summary, "overdue_legal_count"),
      desc: "과태료·처벌 대상\n즉시 조치 필요",
      tone: "legal-danger",
    },
    {
      label: "기한초과",
      value: getSummaryValue(summary, "overdue_count"),
      desc: "점검 기한이 지난 항목",
      tone: "danger",
    },
    {
      label: "기한임박",
      value: getSummaryValue(summary, "due_soon_count"),
      desc: "10일 이내 도래 항목",
      tone: "warning",
    },
    {
      label: "점검기록없음",
      value: getSummaryValue(summary, "no_record_count"),
      desc: "최초 점검일 등록 필요",
      tone: "neutral",
    },
    {
      label: "완료",
      value: getSummaryValue(summary, "completed_count"),
      desc: "점검 기록이 있는 항목",
      tone: "done",
    },
  ]

  return (
    <section className="ff-safety-summary-strip">
      {cards.map((card) => (
        <article key={card.label} className={`ff-safety-metric ${card.tone}`}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p>{card.desc}</p>
        </article>
      ))}
    </section>
  )
}

function PurposeStatus({ items }: { items: SafetyPurposeBreakdown[] }) {
  const visibleItems = items.slice(0, 3)

  return (
    <section className="ff-safety-purpose-panel">
      <h3>분류별 점검 기록 현황</h3>

      <div className="ff-safety-purpose-list-v2">
        {!visibleItems.length && <EmptyState text="분류별 점검 기록이 없습니다." />}

        {visibleItems.map((item, index) => {
          const total = safeNumber(item.total_count, 0)
          const incomplete = safeNumber(item.incomplete_count, 0)
          const completed = Math.max(total - incomplete, 0)
          const rate = total ? Math.round((completed / total) * 100) : 0

          return (
            <div key={`${item.purpose}-${index}`} className="ff-safety-purpose-bar">
              <div>
                <b>{item.purpose || "점검 분류"}</b>
                <span>{incomplete === 0 ? "✓ 이수완료" : `${incomplete}건 미완료 / ${total}건`}</span>
              </div>
              <i><em style={{ width: `${rate}%` }} /></i>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PriorityCard({
  item,
  index,
  onComplete,
  isSaving,
}: {
  item: SafetyInspectionItem
  index: number
  onComplete: (ruleId: string, ruleType: string) => void
  isSaving: boolean
}) {
  const statusClass = getStatusClass(item)
  const ruleId = item.rule?.rule_id || ""
  const isLegalOverdue = item.rule_type === "legal" && typeof item.days_left === "number" && item.days_left < 0

  return (
    <article className={`ff-safety-priority-card ${statusClass}`}>
      <div className="ff-safety-priority-top">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <em>{getDisplayStatus(item)}</em>
      </div>

      <h4>{getRuleTitle(item)}</h4>
      <p>{getRuleDescription(item)}</p>
      <p>{formatDaysLeft(item.days_left)} · 위험도 {getRiskLabel(item.rule?.risk_level)}</p>

      {isLegalOverdue && <div className="ff-safety-card-penalty">⚠ 법정점검 미이행<br />{getPenaltyText(item.rule?.penalty_amount_note)}</div>}

      <button type="button" disabled={!ruleId || isSaving} onClick={() => onComplete(ruleId, item.rule_type || "voluntary")}>
        {item.days_left === null || item.days_left === undefined ? "점검일 등록하기" : "점검일 선택하기"}
      </button>
    </article>
  )
}

function PrioritySection({
  priorityItems,
  allItems,
  activeTab,
  listMode,
  onTabChange,
  onModeChange: _onModeChange,
  onComplete,
  isSaving,
}: {
  priorityItems: SafetyInspectionItem[]
  allItems: SafetyInspectionItem[]
  activeTab: SafetyTab
  listMode: ListMode
  onTabChange: (tab: SafetyTab) => void
  onModeChange: (mode: ListMode) => void
  onComplete: (ruleId: string, ruleType: string) => void
  isSaving: boolean
}) {
  const source = listMode === "priority" ? priorityItems : allItems
  const filtered = source.filter((item) => item.rule_type === activeTab)

  return (
    <section className="ff-safety-priority-section">
      <div className="ff-safety-priority-head">
        <div>
          <h3>지금 처리해야 할 항목</h3>
          <p>우선순위 기준: 기한초과 → 10일 이내 도래 → 점검 기록 없음</p>
        </div>

        <div className="ff-safety-segmented">
          <button type="button" className={activeTab === "legal" ? "active" : ""} onClick={() => onTabChange("legal")}>법정점검</button>
          <button type="button" className={activeTab === "voluntary" ? "active" : ""} onClick={() => onTabChange("voluntary")}>자율점검</button>
        </div>
      </div>

      <div className="ff-safety-priority-scroll">
        {!filtered.length && <EmptyState text="현재 표시할 점검 항목이 없습니다." />}

        {filtered.slice(0, 8).map((item, index) => (
          <PriorityCard
            key={`${item.rule_type}-${item.rule?.rule_id}-${index}`}
            item={item}
            index={index}
            onComplete={onComplete}
            isSaving={isSaving}
          />
        ))}
      </div>
    </section>
  )
}

function AllItemsSection({ items }: { items: SafetyInspectionItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visibleItems = expanded ? items : items.slice(0, 5)
  const remainingCount = Math.max(items.length - 5, 0)

  return (
    <section className="ff-safety-all-section">
      <h3>전체 점검 항목 {items.length}건</h3>

      <div className={`ff-safety-all-list ${expanded ? "expanded" : ""}`}>
        {!items.length && <EmptyState text="전체 점검 항목이 없습니다." />}

        {visibleItems.map((item, index) => {
          const isLegalOverdue = item.rule_type === "legal" && typeof item.days_left === "number" && item.days_left < 0

          return (
            <article key={`${item.rule_type}-${item.rule?.rule_id}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h4>{getRuleTitle(item)}</h4>
                {isLegalOverdue && <p>⚠ 법정점검 미이행 · {getPenaltyText(item.rule?.penalty_amount_note)}</p>}
              </div>
              <em className={`ff-safety-small-pill ${getStatusClass(item)}`}>{getDisplayStatus(item)}</em>
              <b>{formatDaysLeft(item.days_left)}</b>
            </article>
          )
        })}

        {items.length > 5 && (
          <button type="button" className="ff-safety-all-more" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "목록 접기 ▲" : `전체 ${remainingCount}건 더 보기 ▼`}
          </button>
        )}
      </div>
    </section>
  )
}

export function SafetyFeature() {
  const {
    dashboard,
    selectedEquipment,
    equipmentItems,
    unsupportedEquipmentNames,
    preWorkChecklist,
    isLoadingDashboard,
    isLoadingChecklist,
    isSaving,
    errorMessage,
    toastMessage,
    setToastMessage,
    reloadDashboard,
    handleSelectEquipment,
    handlePreWorkCheck,
    handleRegularCheck,
  } = useSafetyDashboard()

  const [monthKey, setMonthKey] = useState(() => getMonthKeyFromCalendar(dashboard?.company_calendar_view))
  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SafetyTab>("legal")
  const [listMode] = useState<ListMode>("priority")

  const effectiveMonthKey = useMemo(() => monthKey || getMonthKeyFromCalendar(dashboard?.company_calendar_view), [dashboard?.company_calendar_view, monthKey])

  const penaltyGroups = useMemo(() => buildPenaltyGroups(equipmentItems), [equipmentItems])
  const totalPenaltyCount = penaltyGroups.reduce((sum, group) => sum + group.overdueCount, 0)

  const summary = selectedEquipment?.summary_counts ?? dashboard?.summary ?? null
  const allItems = selectedEquipment?.all_items ?? []
  const priorityItems = selectedEquipment?.priority_items ?? []

  const handleMonthMove = (direction: -1 | 1) => {
    const [year, month] = effectiveMonthKey.split("-").map(Number)
    const next = new Date(year, month - 1 + direction, 1)
    setMonthKey(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`)
  }

  return (
    <main className="ff-safety-app-page">
      <TopNavigation />

      <div className="ff-safety-shell">
        <PenaltyBanner count={totalPenaltyCount} onClick={() => setIsPenaltyOpen(true)} />

        {errorMessage && <div className="ff-safety-alert danger">{errorMessage}</div>}
        {toastMessage && (
          <div className="ff-safety-toast">
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage("")}>닫기</button>
          </div>
        )}

        {isLoadingDashboard && <div className="ff-safety-alert">안전점검 데이터를 불러오는 중입니다.</div>}

        <CalendarSection
          calendar={dashboard?.company_calendar_view}
          monthKey={effectiveMonthKey}
          onPrevMonth={() => handleMonthMove(-1)}
          onNextMonth={() => handleMonthMove(1)}
        />

        <EquipmentPanel
          items={equipmentItems}
          selected={selectedEquipment}
          unsupportedNames={unsupportedEquipmentNames}
          onSelect={handleSelectEquipment}
        />

        <PreWorkChecklistSection
          items={preWorkChecklist?.items ?? []}
          total={safeNumber(preWorkChecklist?.total_count, 0)}
          checked={safeNumber(preWorkChecklist?.checked_count, 0)}
          onCheck={handlePreWorkCheck}
          isSaving={isSaving}
          isLoading={isLoadingChecklist}
        />

        <SummaryStrip summary={summary} />
        <PurposeStatus items={selectedEquipment?.purpose_breakdown ?? []} />

        <PrioritySection
          priorityItems={priorityItems}
          allItems={allItems}
          activeTab={activeTab}
          listMode={listMode}
          onTabChange={setActiveTab}
          onModeChange={() => undefined}
          onComplete={handleRegularCheck}
          isSaving={isSaving}
        />

        <AllItemsSection items={allItems} />

        <div className="ff-safety-bottom-actions">
          <button type="button" onClick={reloadDashboard}>새로고침</button>
          <a href="/mypage">마이페이지 설비 정보 확인</a>
        </div>
      </div>

      <PenaltyModal
        open={isPenaltyOpen}
        groups={penaltyGroups}
        onClose={() => setIsPenaltyOpen(false)}
        onConfirm={() => {
          setIsPenaltyOpen(false)
          setActiveTab("legal")
        }}
      />
    </main>
  )
}
