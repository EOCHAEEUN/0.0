export type AnalysisPickerItem = {
  equipmentId: string
  equipmentName: string
  subtitle: string
  analysisId: string
  roiPct: number | null
  createdAt: string
}

type AnalysisPickerDialogProps = {
  open: boolean
  search: string
  items: AnalysisPickerItem[]
  selectedEquipmentId: string
  selectedAnalysisId: string
  onSearchChange: (value: string) => void
  onSelect: (item: AnalysisPickerItem) => void
  onClose: () => void
  variant?: "default" | "mobile-card"
  anchorTop?: number
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return "-"
  const date = new Date(parsed)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`
}

export default function AnalysisPickerDialog({
  open,
  search,
  items,
  selectedEquipmentId,
  selectedAnalysisId,
  onSearchChange,
  onSelect,
  onClose,
  variant = "default",
  anchorTop,
}: AnalysisPickerDialogProps) {
  if (!open) return null

  const panel = (
    <>
      <header className="ff-advisor-analysis-picker-header">
        <h3>분석 변경</h3>
        <button type="button" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </header>
      <div className="ff-advisor-analysis-picker-body">
        <input
          className="ff-advisor-analysis-picker-search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="설비명 검색"
        />
        <div className="ff-advisor-analysis-picker-list" role="listbox" aria-label="설비 목록">
          {items.map((item) => {
            const isActive =
              item.equipmentId === selectedEquipmentId &&
              (!item.analysisId || item.analysisId === selectedAnalysisId)
            return (
              <button
                key={item.equipmentId}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`ff-advisor-analysis-picker-item${isActive ? " is-active" : ""}`}
                onClick={() => onSelect(item)}
              >
                <div className="ff-advisor-analysis-picker-item-main">
                  <strong>{item.equipmentName}</strong>
                  <span>{item.subtitle}</span>
                </div>
                <div className="ff-advisor-analysis-picker-item-meta">
                  {item.analysisId ? (
                    <>
                      <span>ROI {formatPercent(item.roiPct)}</span>
                      <time>{formatDateTime(item.createdAt)}</time>
                    </>
                  ) : (
                    <span className="is-muted">분석 없음</span>
                  )}
                </div>
              </button>
            )
          })}
          {!items.length ? (
            <p className="ff-advisor-analysis-picker-empty">검색 결과가 없습니다.</p>
          ) : null}
        </div>
      </div>
    </>
  )

  if (variant === "mobile-card") {
    return (
      <div
        className="ff-advisor-analysis-picker-panel ff-advisor-analysis-picker-panel--mobile-card"
        role="dialog"
        aria-modal="true"
        aria-label="설비 선택"
        style={anchorTop && anchorTop > 0 ? { top: anchorTop } : undefined}
      >
        {panel}
      </div>
    )
  }

  return (
    <section className="ff-advisor-analysis-picker-shell" aria-label="설비 선택">
      <div className="ff-advisor-analysis-picker-panel" role="dialog" aria-modal="true">
        {panel}
      </div>
    </section>
  )
}
