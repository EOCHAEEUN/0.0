import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { INDUSTRY_OPTIONS } from "../../../components/auth/signup/signup.constants"
import {
  BUSINESS_SITE_TYPE_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  EquipmentOptionalAccordion,
  Field,
  InfoTooltip,
  PURPOSE_OPTIONS,
  SelectChip,
  SelectField,
  formatBusinessNumber,
  formatCommaNumber,
  normalizeCommaNumber,
  toNumberOrNull,
} from "../../mypage/myPage.parts"
import {
  OnboardingFormCard,
  OnboardingSetupLayout,
} from "../components/OnboardingSetupLayout"
import { saveOnboardingCompany } from "../onboardingAnalysisApi"
import {
  getCompanyProfileDraft,
  saveCompanyProfileDraft,
  updateUserOnboardingState,
  type CompanyProfileDraft,
} from "../onboardingState"

const sidoOptions = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "충남", "경남"]
const sigunguOptions: Record<string, string[]> = {
  서울: ["강남구", "구로구", "금천구", "성동구"],
  경기: ["안산시", "화성시", "시흥시", "부천시"],
  인천: ["연수구", "서구", "부평구"],
  부산: ["강서구", "사상구", "기장군"],
}

function getProfileStatus(draft: CompanyProfileDraft) {
  const required = [
    draft.companyName,
    draft.companyType !== "선택 필요" ? draft.companyType : "",
    draft.regionSido,
    draft.regionSigungu,
    draft.industry,
    draft.industryCode,
    draft.annualRevenue,
  ]
  const filledCount = required.filter((value) => String(value).trim()).length
  if (filledCount === 0) return "not_started"
  if (filledCount === required.length) return "completed"
  return "in_progress"
}

function countCompanyOptionalFilled(draft: CompanyProfileDraft) {
  return [
    draft.businessNumber,
    draft.foundedYear,
    draft.businessSiteType !== "선택 필요" ? draft.businessSiteType : "",
    draft.purpose !== "선택 필요" ? draft.purpose : "",
  ].filter((value) => String(value ?? "").trim()).length
}

function formatSaveTime(value?: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default function CompanySetupPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<CompanyProfileDraft>(() => getCompanyProfileDraft())
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [revenueTooltipOpen, setRevenueTooltipOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  const missingFields = useMemo(
    () => ({
      companyName: !draft.companyName.trim(),
      companyType: draft.companyType === "선택 필요",
      region: !draft.regionSido.trim() || !draft.regionSigungu.trim(),
      industry: !draft.industry.trim() || !draft.industryCode.trim(),
      annualRevenue: !draft.annualRevenue.trim(),
    }),
    [draft],
  )

  const updateDraft = (patch: Partial<CompanyProfileDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      return { ...next, status: getProfileStatus(next) }
    })
  }

  const handleIndustryNameChange = (value: string) => {
    const exact = INDUSTRY_OPTIONS.find((item) => item.name === value)
    updateDraft({
      industry: value,
      industryCode: exact ? exact.codes.join(", ") : "",
    })
  }

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setSaveState("saving")

    timerRef.current = window.setTimeout(() => {
      try {
        setDraft((prev) => {
          const saved = saveCompanyProfileDraft({
            ...prev,
            status: getProfileStatus(prev),
          })
          return saved
        })
        setSaveState("saved")
      } catch {
        setSaveState("failed")
      }
    }, 650)

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [
    draft.companyName,
    draft.companyType,
    draft.regionSido,
    draft.regionSigungu,
    draft.industry,
    draft.industryCode,
    draft.employees,
    draft.annualRevenue,
    draft.businessNumber,
    draft.foundedYear,
    draft.businessSiteType,
    draft.purpose,
  ])

  const handleContinue = async () => {
    setSubmitted(true)
    setSubmitError("")
    if (
      missingFields.companyName ||
      missingFields.companyType ||
      missingFields.region ||
      missingFields.industry ||
      missingFields.annualRevenue
    ) {
      return
    }

    if (toNumberOrNull(normalizeCommaNumber(draft.annualRevenue)) === null) {
      setSubmitError("연매출액은 숫자로 입력해 주세요.")
      return
    }

    const completedDraft = saveCompanyProfileDraft({
      ...draft,
      status: "completed",
    })
    setIsSubmitting(true)
    try {
      const companyId = await saveOnboardingCompany(completedDraft)
      updateUserOnboardingState({
        companyProfileStatus: "completed",
        companyId,
      })
      navigate("/setup/equipment")
    } catch (reason) {
      setSubmitError(
        reason instanceof Error ? reason.message : "기업 정보를 저장하지 못했습니다.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "저장 중..."
      : saveState === "failed"
        ? "저장에 실패했어요"
        : draft.updatedAt
          ? `저장됨 · ${formatSaveTime(draft.updatedAt)}`
          : "자동 저장 대기"

  return (
    <OnboardingSetupLayout
      step={1}
      eyebrow="1단계 · 기업 정보"
      title="기업 정보를 알려주세요."
      description={
        <>
          입력한 정보는 지원사업 자격, 예상 지원금, ROI 분석 기준을 잡는 데
          사용됩니다. 모르는 항목은 나중에 보완할 수 있어요.
        </>
      }
      note={
        <>
          <strong>왜 필요한가요?</strong>
          <span>
            업종, 지역, 규모에 따라 받을 수 있는 지원사업과 신청 우선순위가 달라집니다.
          </span>
        </>
      }
      headerRight={<span className={`ff-save-status ${saveState}`}>{saveLabel}</span>}
      footer={
        <>
          <p className="ff-setup-helper">
            저장된 정보는 대시보드와 AI Advisor에서 이어서 활용됩니다.
          </p>
          <div className="ff-setup-actions ff-setup-actions--end">
            <button
              type="button"
              className="ff-primary-action"
              onClick={() => void handleContinue()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "저장 중..." : "저장하고 설비 정보 입력"}
            </button>
          </div>
          {submitError ? (
            <p className="ff-field-error" role="alert">
              {submitError}
            </p>
          ) : null}
        </>
      }
    >
      <OnboardingFormCard
        title="기업정보"
        badge={<span className="badge green">매칭기준</span>}
        description="지원사업 추천과 ROI 분석에 사용되는 기업 기준 정보입니다."
      >
        <div className="ff-setup-field-grid ff-setup-field-grid--two">
          <Field
            label="기업명"
            required
            value={draft.companyName}
            placeholder="예: 평우제조"
            onChange={(value) => updateDraft({ companyName: value })}
          />
          <SelectField
            label="기업 규모"
            required
            value={draft.companyType}
            onChange={(value) => updateDraft({ companyType: value })}
            options={COMPANY_TYPE_OPTIONS}
          />
        </div>

        <SelectField
          label="업종명"
          required
          value={draft.industry}
          onChange={(value) => handleIndustryNameChange(value)}
          options={INDUSTRY_OPTIONS.map((item) => item.name)}
        />
        {submitted && missingFields.industry ? (
          <p className="ff-field-error">업종을 선택해 주세요.</p>
        ) : null}

        <div className="ff-setup-field-grid ff-setup-field-grid--two">
          <label className="ff-setup-native-field">
            <span>
              지역 <em className="ff-required-mark">*</em>
            </span>
            <select
              value={draft.regionSido}
              onChange={(event) =>
                updateDraft({ regionSido: event.target.value, regionSigungu: "" })
              }
            >
              <option value="">시도 선택</option>
              {sidoOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="ff-setup-native-field">
            <span>&nbsp;</span>
            <select
              value={draft.regionSigungu}
              disabled={!draft.regionSido}
              onChange={(event) => updateDraft({ regionSigungu: event.target.value })}
            >
              <option value="">시군구 선택</option>
              {(sigunguOptions[draft.regionSido] ?? ["산업단지", "일반지역"]).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        {submitted && missingFields.region ? (
          <p className="ff-field-error">지역을 선택해 주세요.</p>
        ) : null}

        <div className="ff-setup-field-grid ff-setup-field-grid--two">
          <Field
            label="직원수"
            value={draft.employees}
            placeholder="예: 25"
            inputMode="numeric"
            labelRight={<SelectChip />}
            onChange={(value) => updateDraft({ employees: value })}
          />
          <Field
            label="연매출액"
            required
            value={draft.annualRevenue}
            placeholder="예: 120000"
            helperText="단위: 만원 · 예) 10억 원 = 100000"
            inputMode="numeric"
            labelRight={
              <span
                style={{ position: "relative", display: "inline-flex" }}
                onMouseEnter={() => setRevenueTooltipOpen(true)}
                onMouseLeave={() => setRevenueTooltipOpen(false)}
                onFocus={() => setRevenueTooltipOpen(true)}
                onBlur={() => setRevenueTooltipOpen(false)}
              >
                <button
                  type="button"
                  aria-label="연매출액 안내"
                  className="ff-setup-info-button"
                >
                  i
                </button>
                <InfoTooltip
                  open={revenueTooltipOpen}
                  text="연매출액은 만원 단위로 입력합니다. 예) 10억 원 = 100000"
                />
              </span>
            }
            onChange={(value) =>
              updateDraft({ annualRevenue: formatCommaNumber(value) })
            }
          />
        </div>
        {submitted && missingFields.annualRevenue ? (
          <p className="ff-field-error">연매출액을 입력해 주세요.</p>
        ) : null}

        <EquipmentOptionalAccordion
          title="선택정보 입력하기"
          description="사업자등록번호, 설립연도 등 추가 정보를 입력할 수 있어요."
          open={optionalOpen}
          filledCount={countCompanyOptionalFilled(draft)}
          onToggle={() => setOptionalOpen((prev) => !prev)}
        >
          <div className="ff-setup-field-grid ff-setup-field-grid--two">
            <Field
              label="사업자등록번호"
              value={draft.businessNumber}
              placeholder="예: 123-45-67890"
              onChange={(value) =>
                updateDraft({ businessNumber: formatBusinessNumber(value) })
              }
            />
            <Field
              label="설립연도"
              value={draft.foundedYear ?? ""}
              placeholder="예: 2015"
              inputMode="numeric"
              onChange={(value) => updateDraft({ foundedYear: value })}
            />
          </div>
          <div className="ff-setup-field-grid ff-setup-field-grid--two">
            <SelectField
              label="사업장유형"
              value={draft.businessSiteType}
              onChange={(value) => updateDraft({ businessSiteType: value })}
              options={BUSINESS_SITE_TYPE_OPTIONS}
            />
            <SelectField
              label="주요 목적"
              value={draft.purpose}
              onChange={(value) => updateDraft({ purpose: value })}
              options={PURPOSE_OPTIONS}
            />
          </div>
        </EquipmentOptionalAccordion>
      </OnboardingFormCard>
    </OnboardingSetupLayout>
  )
}
