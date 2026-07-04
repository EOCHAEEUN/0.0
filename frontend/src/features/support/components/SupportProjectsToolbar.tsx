import { Search } from "lucide-react"
import { useEffect, useRef, type FormEvent } from "react"

import { EQUIPMENT_GROUP_OPTIONS, type EquipmentGroup } from "../supportProjectsEquipmentGroups"
import "../supportProjects.workspace.css"

type SupportProjectsToolbarProps = {
  searchInput: string
  onSearchInputChange: (value: string) => void
  onSearch: () => void
  isSearching?: boolean
  equipmentGroup: EquipmentGroup
  onEquipmentGroupChange: (value: EquipmentGroup) => void
  supportType: string
  onSupportTypeChange: (value: string) => void
  purpose: string
  onPurposeChange: (value: string) => void
  autoFocusSearch?: boolean
}

export function SupportProjectsToolbar({
  searchInput,
  onSearchInputChange,
  onSearch,
  isSearching = false,
  equipmentGroup,
  onEquipmentGroupChange,
  supportType,
  onSupportTypeChange,
  purpose,
  onPurposeChange,
  autoFocusSearch = false,
}: SupportProjectsToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!autoFocusSearch) return
    searchInputRef.current?.focus()
  }, [autoFocusSearch])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch()
  }

  return (
    <section className="ff-support-toolbar" aria-label="지원사업 검색 및 필터">
      <form className="ff-support-toolbar-search" onSubmit={handleSubmit}>
        <button
          type="submit"
          className="ff-support-toolbar-search-btn"
          aria-label="검색"
          disabled={isSearching}
        >
          <Search size={18} aria-hidden="true" />
        </button>
        <input
          ref={searchInputRef}
          type="text"
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="지원사업명 또는 키워드를 입력하세요"
          aria-label="지원사업명 또는 키워드 검색"
          disabled={isSearching}
        />
        <button
          type="submit"
          className="ff-support-toolbar-search-submit"
          disabled={isSearching}
        >
          {isSearching ? "검색 중..." : "검색"}
        </button>
      </form>

      <label className="ff-support-toolbar-select">
        <span className="sr-only">설비 그룹</span>
        <select
          value={equipmentGroup}
          onChange={(event) => onEquipmentGroupChange(event.target.value as EquipmentGroup)}
          aria-label="설비 그룹"
        >
          {EQUIPMENT_GROUP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="ff-support-toolbar-select">
        <span className="sr-only">지원 유형</span>
        <select
          value={supportType}
          onChange={(event) => onSupportTypeChange(event.target.value)}
          aria-label="지원 유형"
        >
          <option value="all">지원 유형</option>
          <option value="subsidy">직접 지원금</option>
          <option value="finance">금융 지원</option>
          <option value="linked">비금융 연계</option>
        </select>
      </label>

      <label className="ff-support-toolbar-select">
        <span className="sr-only">목적</span>
        <select
          value={purpose}
          onChange={(event) => onPurposeChange(event.target.value)}
          aria-label="목적"
        >
          <option value="all">목적</option>
          <option value="equipment">설비·자동화</option>
          <option value="digital">디지털 전환</option>
          <option value="safety">안전·환경</option>
        </select>
      </label>
    </section>
  )
}
