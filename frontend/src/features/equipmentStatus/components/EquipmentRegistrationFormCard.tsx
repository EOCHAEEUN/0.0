import {
  EQUIPMENT_CATEGORY_OPTIONS,
  Field,
  SelectField,
} from "../../mypage/myPage.parts"

export type EquipmentRegistrationFormValues = {
  category: string
  name: string
  years: string
  annualEnergyCost: string
  process: string
  defectRate: string
  maintenanceCostMonthly: string
  scenarioAInvestment: string
  scenarioBInvestment: string
}

type EquipmentRegistrationFormCardProps = {
  title?: string
  values: EquipmentRegistrationFormValues
  onChange: (patch: Partial<EquipmentRegistrationFormValues>) => void
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
  submitting?: boolean
  error?: string
}

export function EquipmentRegistrationFormCard({
  title = "내 설비 등록",
  values,
  onChange,
  onCancel,
  onSubmit,
  submitLabel,
  submitting = false,
  error,
}: EquipmentRegistrationFormCardProps) {
  return (
    <section className="ff-equipment-form-card">
      <header>
        <strong>{title}</strong>
        <button type="button" className="ff-equipment-text-btn" onClick={onCancel}>
          취소
        </button>
      </header>

      <div className="ff-equipment-form-required">
        <SelectField
          label="설비 종류"
          required
          value={values.category}
          onChange={(value) => onChange({ category: value })}
          options={EQUIPMENT_CATEGORY_OPTIONS}
        />
        <Field
          label="설비명"
          required
          value={values.name}
          placeholder="예: 프레스 1호기"
          onChange={(value) => onChange({ name: value })}
        />
        <Field
          label="사용연수"
          required
          value={values.years}
          placeholder="예: 10"
          helperText="단위: 년"
          inputMode="numeric"
          onChange={(value) => onChange({ years: value })}
        />
        <Field
          label="연간 에너지 비용"
          required
          value={values.annualEnergyCost}
          placeholder="예: 5,000"
          helperText="단위: 만원"
          inputMode="numeric"
          onChange={(value) => onChange({ annualEnergyCost: value })}
        />
      </div>

      <p className="ff-equipment-form-optional-hint">
        선택 정보를 입력하면 ROI 정확도가 높아집니다
      </p>

      <div className="ff-equipment-form-optional-grid">
        <Field
          label="공정"
          selectable
          value={values.process}
          placeholder="예: 프레스공정"
          onChange={(value) => onChange({ process: value })}
        />
        <Field
          label="불량률"
          selectable
          value={values.defectRate}
          placeholder="예: 3.5"
          helperText="단위: %"
          inputMode="decimal"
          onChange={(value) => onChange({ defectRate: value })}
        />
        <Field
          label="월 유지보수 비용"
          selectable
          value={values.maintenanceCostMonthly}
          placeholder="예: 80"
          helperText="단위: 만원"
          inputMode="numeric"
          onChange={(value) => onChange({ maintenanceCostMonthly: value })}
        />
        <Field
          label="전체교체 투자금(A안)"
          selectable
          value={values.scenarioAInvestment}
          placeholder="예: 20,000"
          helperText="단위: 만원"
          inputMode="numeric"
          onChange={(value) => onChange({ scenarioAInvestment: value })}
        />
        <Field
          label="부분교체 투자금(B안)"
          selectable
          value={values.scenarioBInvestment}
          placeholder="예: 4,000"
          helperText="단위: 만원"
          inputMode="numeric"
          onChange={(value) => onChange({ scenarioBInvestment: value })}
        />
      </div>

      {error ? <p className="ff-field-error">{error}</p> : null}

      <div className="ff-equipment-form-actions">
        <button
          type="button"
          className="ff-equipment-primary-btn"
          disabled={submitting}
          onClick={onSubmit}
        >
          {submitting ? "처리 중..." : submitLabel}
        </button>
      </div>
    </section>
  )
}
