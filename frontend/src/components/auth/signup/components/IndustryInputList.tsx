import type { IndustryInputRow, IndustryOption } from "../signup.types"
import FieldLabel from "./FieldLabel"

type IndustryInputListProps = {
  industryRows: IndustryInputRow[]
  openIndustryRowId: string | null
  getFilteredIndustries: (row: IndustryInputRow) => IndustryOption[]
  onOpenIndustrySuggestion: (rowId: string) => void
  onIndustryNameChange: (rowId: string, value: string) => void
  onIndustryCodeChange: (rowId: string, value: string) => void
  onSelectIndustry: (rowId: string, industry: IndustryOption) => void
  onAddIndustryRow: () => void
  onRemoveIndustryRow: (rowId: string) => void
}

export default function IndustryInputList({
  industryRows,
  openIndustryRowId,
  getFilteredIndustries,
  onOpenIndustrySuggestion,
  onIndustryNameChange,
  onIndustryCodeChange,
  onSelectIndustry,
  onAddIndustryRow,
  onRemoveIndustryRow,
}: IndustryInputListProps) {
  return (
    <>
      <div className="ff-signup-industry-list">
        {industryRows.map((row, index) => {
          const filteredIndustries = getFilteredIndustries(row)
          const isSuggestionOpen =
            openIndustryRowId === row.id &&
            Boolean(row.industryName || row.industryCode) &&
            filteredIndustries.length > 0

          return (
            <div className="ff-signup-industry-row" key={row.id}>
              {industryRows.length > 1 && (
                <div className="ff-signup-industry-row-top">
                  <span>업종 {index + 1}</span>

                  <button
                    type="button"
                    onClick={() => onRemoveIndustryRow(row.id)}
                  >
                    삭제
                  </button>
                </div>
              )}

              <div className="ff-signup-two-col">
                <div className="ff-signup-field ff-signup-combo">
                  <FieldLabel text="업종명" required />
                  <input
                    placeholder="예: 금속가공"
                    value={row.industryName}
                    onFocus={() => onOpenIndustrySuggestion(row.id)}
                    onChange={(event) =>
                      onIndustryNameChange(row.id, event.target.value)
                    }
                  />

                  {isSuggestionOpen && (
                    <div className="ff-signup-suggest-box">
                      {filteredIndustries.map((item) => (
                        <button
                          type="button"
                          key={`${row.id}-${item.name}-${item.codes.join("-")}`}
                          onClick={() => onSelectIndustry(row.id, item)}
                        >
                          <span>{item.name}</span>
                          <b>{item.codes.join(", ")}</b>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ff-signup-field">
                  <FieldLabel text="업종코드" required />
                  <input
                    placeholder="예: C25"
                    value={row.industryCode}
                    onFocus={() => onOpenIndustrySuggestion(row.id)}
                    onChange={(event) =>
                      onIndustryCodeChange(row.id, event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className="ff-signup-add-industry"
        onClick={onAddIndustryRow}
      >
        + 업종 추가하기
      </button>
    </>
  )
}