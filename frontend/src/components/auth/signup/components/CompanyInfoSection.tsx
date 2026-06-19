import { COMPANY_TYPE_OPTIONS, PURPOSE_OPTIONS } from "../signup.constants"
import type { IndustryInputRow, IndustryOption } from "../signup.types"
import FieldLabel from "./FieldLabel"
import IndustryInputList from "./IndustryInputList"

type CompanyInfoSectionProps = {
  companyName: string
  industryRows: IndustryInputRow[]
  openIndustryRowId: string | null
  businessNumber: string
  region: string
  companyType: string
  mainPurpose: string
  getFilteredIndustries: (row: IndustryInputRow) => IndustryOption[]
  onCompanyNameChange: (value: string) => void
  onOpenIndustrySuggestion: (rowId: string) => void
  onIndustryNameChange: (rowId: string, value: string) => void
  onIndustryCodeChange: (rowId: string, value: string) => void
  onSelectIndustry: (rowId: string, industry: IndustryOption) => void
  onAddIndustryRow: () => void
  onRemoveIndustryRow: (rowId: string) => void
  onBusinessNumberChange: (value: string) => void
  onRegionChange: (value: string) => void
  onCompanyTypeChange: (value: string) => void
  onMainPurposeChange: (value: string) => void
}

export default function CompanyInfoSection({
  companyName,
  industryRows,
  openIndustryRowId,
  businessNumber,
  region,
  companyType,
  mainPurpose,
  getFilteredIndustries,
  onCompanyNameChange,
  onOpenIndustrySuggestion,
  onIndustryNameChange,
  onIndustryCodeChange,
  onSelectIndustry,
  onAddIndustryRow,
  onRemoveIndustryRow,
  onBusinessNumberChange,
  onRegionChange,
  onCompanyTypeChange,
  onMainPurposeChange,
}: CompanyInfoSectionProps) {
  const purposeOptions = PURPOSE_OPTIONS.filter(
    (option) => option.trim() !== "" && option !== "선택",
  )

  return (
    <div className="ff-signup-section">
      <h3>3. 기업 정보</h3>

      <div className="ff-signup-field">
        <FieldLabel text="기업명" required />
        <input
          placeholder="기업명을 입력하세요"
          value={companyName}
          onChange={(event) => onCompanyNameChange(event.target.value)}
        />
      </div>

      <IndustryInputList
        industryRows={industryRows}
        openIndustryRowId={openIndustryRowId}
        getFilteredIndustries={getFilteredIndustries}
        onOpenIndustrySuggestion={onOpenIndustrySuggestion}
        onIndustryNameChange={onIndustryNameChange}
        onIndustryCodeChange={onIndustryCodeChange}
        onSelectIndustry={onSelectIndustry}
        onAddIndustryRow={onAddIndustryRow}
        onRemoveIndustryRow={onRemoveIndustryRow}
      />

      <div className="ff-signup-field">
        <FieldLabel text="사업자등록번호" optional />
        <input
          placeholder="예: 123-45-67890"
          value={businessNumber}
          onChange={(event) => onBusinessNumberChange(event.target.value)}
        />
      </div>

      <div className="ff-signup-field">
        <FieldLabel text="지역" required />
        <input
          placeholder="예: 경기 안산시"
          value={region}
          onChange={(event) => onRegionChange(event.target.value)}
        />
      </div>

      <div className="ff-signup-two-col">
        <div className="ff-signup-field">
          <FieldLabel text="기업 규모" required />
          <select
            value={companyType}
            onChange={(event) => onCompanyTypeChange(event.target.value)}
          >
            {COMPANY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="ff-signup-field">
          <FieldLabel text="주요 목적" optional />
          <select
            value={mainPurpose}
            onChange={(event) => onMainPurposeChange(event.target.value)}
          >
            <option value="">선택</option>
            {purposeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}