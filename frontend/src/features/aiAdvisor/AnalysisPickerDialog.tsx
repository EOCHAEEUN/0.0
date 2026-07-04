type AnalysisPickerItem = {
  analysisId: string
  equipmentId: string
  analysisTitle: string
  equipmentName: string
}

type AnalysisPickerDialogProps = {
  open: boolean
  items: AnalysisPickerItem[]
  selectedAnalysisId: string
  search: string
  onSearchChange: (value: string) => void
  onSelect: (item: AnalysisPickerItem) => void
  onClose: () => void
}

function getDisplayTitle(item: AnalysisPickerItem) {
  const title = item.analysisTitle.trim()
  if (title) return title
  const name = item.equipmentName.trim()
  if (name) return name
  return "이름 없는 설비"
}

export default function AnalysisPickerDialog({
  open,
  items,
  selectedAnalysisId,
  search,
  onSearchChange,
  onSelect,
  onClose,
}: AnalysisPickerDialogProps) {
  if (!open) return null

  return (
    <section className="ff-advisor-analysis-picker-shell" aria-label="분석 선택">
      <div className="ff-advisor-analysis-picker-panel" role="dialog" aria-modal="true">
        <header className="ff-advisor-analysis-picker-header">
          <h3>분석 변경</h3>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="ff-advisor-analysis-picker-body">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="설비명 검색"
            aria-label="설비명 검색"
          />

          <div className="ff-advisor-analysis-picker-list" role="listbox" aria-label="분석 목록">
            {items.map((item) => {
              const isActive = item.analysisId === selectedAnalysisId
              return (
                <button
                  key={item.analysisId}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`ff-advisor-analysis-picker-item${isActive ? " is-active" : ""}`}
                  onClick={() => onSelect(item)}
                >
                  {getDisplayTitle(item)}
                </button>
              )
            })}
            {!items.length && (
              <p className="ff-advisor-analysis-picker-empty">검색 결과가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
