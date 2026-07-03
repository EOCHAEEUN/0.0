import { Search, SlidersHorizontal } from "lucide-react"

import "../supportProjects.workspace.css"

type SupportProjectsToolbarProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
  equipmentLabel?: string
}

export function SupportProjectsToolbar({
  searchQuery,
  onSearchChange,
  equipmentLabel = "전체 설비",
}: SupportProjectsToolbarProps) {
  return (
    <section className="ff-support-toolbar" aria-label="지원사업 검색 및 필터">
      <div className="ff-support-toolbar-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="사업명 또는 키워드를 입력하세요"
          aria-label="사업명 또는 키워드 검색"
        />
      </div>

      <div className="ff-support-toolbar-filters">
        <label className="ff-support-toolbar-select">
          <span className="sr-only">설비 선택</span>
          <select defaultValue="all" aria-label="설비 선택">
            <option value="all">{equipmentLabel}</option>
          </select>
        </label>

        <label className="ff-support-toolbar-select">
          <span className="sr-only">지원 유형</span>
          <select defaultValue="all" aria-label="지원 유형">
            <option value="all">지원 유형</option>
            <option value="subsidy">직접 지원금</option>
            <option value="finance">금융 지원</option>
            <option value="linked">비금융 연계</option>
          </select>
        </label>

        <label className="ff-support-toolbar-select">
          <span className="sr-only">목적</span>
          <select defaultValue="all" aria-label="목적">
            <option value="all">목적</option>
            <option value="equipment">설비·자동화</option>
            <option value="digital">디지털 전환</option>
            <option value="safety">안전·환경</option>
          </select>
        </label>

        <button type="button" className="ff-support-toolbar-detail">
          <SlidersHorizontal size={15} aria-hidden="true" />
          상세 필터
        </button>
      </div>
    </section>
  )
}
