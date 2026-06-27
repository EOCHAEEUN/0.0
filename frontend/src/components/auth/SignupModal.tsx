import {
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react"
import { useNavigate } from "react-router-dom"

import "./SignupModal.css"
import AccountSection from "./signup/components/AccountSection"
import AgreementBox from "./signup/components/AgreementBox"
import CompanyInfoSection from "./signup/components/CompanyInfoSection"
import UserInfoSection from "./signup/components/UserInfoSection"
import {
  markJustSignedUp,
  resolvePostLoginPath,
  updateUserOnboardingState,
} from "../../features/onboarding/onboardingState"
import { COMPANY_TYPE_PLACEHOLDER } from "./signup/signup.constants"
import type { SignupModalProps } from "./signup/signup.types"
import { useSignupForm } from "./signup/useSignupForm"

type SignupNotice = {
  type: "lock" | "required"
  title: string
  message: string
  items?: string[]
}

function isFilled(value: unknown) {
  if (value === null || value === undefined) return false

  if (Array.isArray(value)) {
    return value.some((item) => String(item ?? "").trim().length > 0)
  }

  return String(value).trim().length > 0
}

function getIndustryName(row: unknown) {
  if (!row || typeof row !== "object") return ""

  const item = row as Record<string, unknown>

  return String(
    item.industryName ??
      item.industry_name ??
      item.name ??
      item.label ??
      "",
  ).trim()
}

function getIndustryCode(row: unknown) {
  if (!row || typeof row !== "object") return ""

  const item = row as Record<string, unknown>

  return String(
    item.industryCode ??
      item.industry_code ??
      item.code ??
      item.value ??
      "",
  ).trim()
}

function getIndustryRequiredStatus(rows: unknown) {
  if (!Array.isArray(rows)) {
    return {
      hasCompleteIndustry: false,
      hasIndustryName: false,
      hasIndustryCode: false,
    }
  }

  const hasCompleteIndustry = rows.some((row) => {
    const industryName = getIndustryName(row)
    const industryCode = getIndustryCode(row)

    return industryName.length > 0 && industryCode.length > 0
  })

  const hasIndustryName = rows.some((row) => getIndustryName(row).length > 0)
  const hasIndustryCode = rows.some((row) => getIndustryCode(row).length > 0)

  return {
    hasCompleteIndustry,
    hasIndustryName,
    hasIndustryCode,
  }
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase()
}

function isPasswordRequirementPassed(
  password: unknown,
  passwordChecks: unknown,
  passwordLevel: unknown,
  passwordLabel: unknown,
) {
  if (!isFilled(password)) return false

  if (Array.isArray(passwordChecks)) {
    if (passwordChecks.length > 0) {
      return passwordChecks.every((item) => {
        if (item && typeof item === "object" && "valid" in item) {
          return Boolean((item as { valid?: unknown }).valid)
        }

        return Boolean(item)
      })
    }
  }

  if (passwordChecks && typeof passwordChecks === "object") {
    const values = Object.values(passwordChecks as Record<string, unknown>)

    if (values.length > 0) {
      return values.every(Boolean)
    }
  }

  const labelText = normalizeText(String(passwordLabel ?? ""))
  const levelText = normalizeText(String(passwordLevel ?? ""))

  if (
    labelText.includes("약함") ||
    labelText.includes("weak") ||
    levelText.includes("weak") ||
    levelText.includes("low") ||
    levelText.includes("bad")
  ) {
    return false
  }

  const levelNumber = Number(passwordLevel)

  if (Number.isFinite(levelNumber)) {
    return levelNumber >= 2
  }

  return true
}

function isEmailVerificationTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false

  const closeButton = target.closest(".ff-signup-close")
  const loginButton = target.closest(".ff-signup-login-link")
  const noticeCloseButton = target.closest(".ff-signup-notice-close")

  if (closeButton || loginButton || noticeCloseButton) return true

  const interactive = target.closest(
    "input, textarea, select, button, a",
  ) as HTMLElement | null

  if (!interactive) return true

  if (interactive instanceof HTMLInputElement) {
    const descriptor = normalizeText(
      [
        interactive.type,
        interactive.name,
        interactive.id,
        interactive.placeholder,
        interactive.getAttribute("aria-label"),
        interactive.getAttribute("data-field"),
      ]
        .filter(Boolean)
        .join(" "),
    )

    if (interactive.type === "hidden") return true

    return (
      interactive.type === "email" ||
      descriptor.includes("email") ||
      descriptor.includes("이메일") ||
      descriptor.includes("code") ||
      descriptor.includes("인증") ||
      descriptor.includes("verification") ||
      descriptor.includes("verify") ||
      descriptor.includes("otp")
    )
  }

  if (interactive instanceof HTMLButtonElement) {
    const descriptor = normalizeText(
      [
        interactive.innerText,
        interactive.textContent,
        interactive.name,
        interactive.id,
        interactive.getAttribute("aria-label"),
        interactive.getAttribute("data-action"),
      ]
        .filter(Boolean)
        .join(" "),
    )

    return (
      descriptor.includes("이메일") ||
      descriptor.includes("인증") ||
      descriptor.includes("코드") ||
      descriptor.includes("발송") ||
      descriptor.includes("전송") ||
      descriptor.includes("verify") ||
      descriptor.includes("code")
    )
  }

  return false
}

export default function SignupModal({
  onClose,
  onLoginClick,
}: SignupModalProps) {
  const navigate = useNavigate()

  const handleSignupComplete = () => {
    markJustSignedUp()
    updateUserOnboardingState({
      companyProfileStatus: "not_started",
      welcomeDismissed: false,
      analysisDraftId: undefined,
      analysisDraftStatus: undefined,
      analysisCount: 0,
    })
    onClose()
    navigate(resolvePostLoginPath(), { replace: true })
  }

  const form = useSignupForm({ onClose, onSignupComplete: handleSignupComplete })

  const [signupNotice, setSignupNotice] = useState<SignupNotice | null>(null)
  const [isLockNoticeDismissed, setIsLockNoticeDismissed] = useState(false)

  const isSignupUnlocked = form.isEmailVerified

  useEffect(() => {
    if (isSignupUnlocked) {
      setSignupNotice(null)
      setIsLockNoticeDismissed(false)
    }
  }, [isSignupUnlocked])

  const missingRequiredItems = useMemo(() => {
    const missing: string[] = []

    if (
      !isPasswordRequirementPassed(
        form.password,
        form.passwordChecks,
        form.passwordLevel,
        form.passwordLabel,
      ) ||
      !isFilled(form.passwordCheck) ||
      (isFilled(form.password) &&
        isFilled(form.passwordCheck) &&
        !form.isPasswordMatched)
    ) {
      missing.push("비밀번호")
    }

    if (!isFilled(form.userName)) {
      missing.push("이름")
    }

    if (!isFilled(form.phone)) {
      missing.push("연락처")
    }

    if (!isFilled(form.companyName)) {
      missing.push("기업명")
    }

    const industryStatus = getIndustryRequiredStatus(form.industryRows)

    if (!industryStatus.hasCompleteIndustry) {
      if (!industryStatus.hasIndustryName) {
        missing.push("업종명")
      }

      if (!industryStatus.hasIndustryCode) {
        missing.push("업종코드")
      }

      if (
        industryStatus.hasIndustryName &&
        industryStatus.hasIndustryCode &&
        !industryStatus.hasCompleteIndustry
      ) {
        missing.push("업종명/업종코드")
      }
    }

    if (!isFilled(form.region)) {
      missing.push("지역")
    }

    if (
      !isFilled(form.companyType) ||
      form.companyType === COMPANY_TYPE_PLACEHOLDER ||
      form.companyType === "선택"
    ) {
      missing.push("기업 규모")
    }

    if (!form.agreeService) {
      missing.push("서비스 이용약관 동의")
    }

    if (!form.agreePrivacy) {
      missing.push("개인정보 수집·이용 동의")
    }

    return missing
  }, [
    form.agreePrivacy,
    form.agreeService,
    form.companyName,
    form.companyType,
    form.industryRows,
    form.isPasswordMatched,
    form.password,
    form.passwordCheck,
    form.passwordChecks,
    form.passwordLabel,
    form.passwordLevel,
    form.phone,
    form.region,
    form.userName,
  ])

  const defaultLockedNotice = useMemo<SignupNotice | null>(() => {
    if (isSignupUnlocked || isLockNoticeDismissed) return null

    return {
      type: "lock",
      title: "이메일 인증을 먼저 완료해주세요.",
      message:
        "인증번호 확인 후 비밀번호, 사용자 정보, 기업 정보 입력이 활성화됩니다.",
    }
  }, [isLockNoticeDismissed, isSignupUnlocked])

  const lockNotice =
    !isSignupUnlocked && signupNotice?.type === "lock"
      ? signupNotice
      : defaultLockedNotice

  const requiredNotice =
    isSignupUnlocked && signupNotice?.type === "required" ? signupNotice : null

  const showLockedNotice = () => {
    setIsLockNoticeDismissed(false)
    setSignupNotice({
      type: "lock",
      title: "이메일 인증이 필요합니다.",
      message:
        "이메일 인증번호를 확인한 뒤 나머지 필수 정보를 입력할 수 있습니다.",
    })
  }

  const closeLockNotice = () => {
    setIsLockNoticeDismissed(true)

    if (signupNotice?.type === "lock") {
      setSignupNotice(null)
    }
  }

  const closeRequiredNotice = () => {
    if (signupNotice?.type === "required") {
      setSignupNotice(null)
    }
  }

  const handleLockedInteraction = (
    event:
      | MouseEvent<HTMLElement>
      | FocusEvent<HTMLElement>
      | KeyboardEvent<HTMLElement>,
  ) => {
    if (isSignupUnlocked) return

    if (isEmailVerificationTarget(event.target)) return

    event.preventDefault()
    event.stopPropagation()

    const activeElement = document.activeElement

    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }

    showLockedNotice()
  }

  const handleSubmit = () => {
    if (!isSignupUnlocked) {
      showLockedNotice()
      return
    }

    if (missingRequiredItems.length > 0) {
      setSignupNotice({
        type: "required",
        title: "필수 정보를 먼저 입력해주세요.",
        message:
          "회원가입을 완료하려면 계정 정보와 기업 정보의 필수 항목이 필요합니다.\n입력이 필요한 항목을 확인한 뒤 다시 회원가입 완료를 눌러주세요.",
        items: missingRequiredItems,
      })

      return
    }

    setSignupNotice(null)
    form.handleSubmit()
  }

  return (
    <div className="ff-signup-overlay">
      <section
        className={`ff-signup-panel ${
          isSignupUnlocked ? "" : "ff-signup-panel--email-locked"
        }`}
        onClick={(event) => event.stopPropagation()}
        onClickCapture={handleLockedInteraction}
        onFocusCapture={handleLockedInteraction}
        onKeyDownCapture={handleLockedInteraction}
      >
        <button type="button" className="ff-signup-close" onClick={onClose}>
          ×
        </button>

        <header className="ff-signup-header">
          <h2>회원가입</h2>
          <p>필수 정보를 입력하면 FactoFit 맞춤형 추천을 시작할 수 있습니다.</p>

          <div className="ff-signup-guide">
            <span>
              <b>*</b> 필수 입력
            </span>
            <span>선택 정보는 지원사업 조건 매칭에 활용됩니다.</span>
          </div>
        </header>

        {lockNotice && (
          <div
            className="ff-signup-top-notice ff-signup-top-notice--lock"
            role="status"
            aria-live="polite"
          >
            <div className="ff-signup-top-notice__head">
              <div>
                <strong>{lockNotice.title}</strong>
                <p>{lockNotice.message}</p>
              </div>

              <button
                type="button"
                className="ff-signup-notice-close"
                onClick={closeLockNotice}
                aria-label="안내 닫기"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <AccountSection
          email={form.email}
          emailCode={form.emailCode}
          isEmailVerified={form.isEmailVerified}
          password={form.password}
          passwordCheck={form.passwordCheck}
          passwordChecks={form.passwordChecks}
          passwordLevel={form.passwordLevel}
          passwordLabel={form.passwordLabel}
          isPasswordMatched={form.isPasswordMatched}
          isPasswordMismatch={form.isPasswordMismatch}
          isSendingCode={form.isSendingCode}
          isVerifyingCode={form.isVerifyingCode}
          onEmailChange={form.handleEmailChange}
          onEmailCodeChange={form.setEmailCode}
          onPasswordChange={form.setPassword}
          onPasswordCheckChange={form.setPasswordCheck}
          onSendEmailCode={form.handleSendEmailCode}
          onVerifyEmail={form.handleVerifyEmail}
        />

        <div className="ff-signup-locked-group">
          <fieldset
            disabled={!isSignupUnlocked}
            aria-disabled={!isSignupUnlocked}
            className="ff-signup-locked-fieldset"
          >
            <UserInfoSection
              userName={form.userName}
              phone={form.phone}
              onUserNameChange={form.setUserName}
              onPhoneChange={form.handlePhoneChange}
            />

            <CompanyInfoSection
              companyName={form.companyName}
              industryRows={form.industryRows}
              openIndustryRowId={form.openIndustryRowId}
              businessNumber={form.businessNumber}
              region={form.region}
              companyType={form.companyType}
              mainPurpose={form.mainPurpose}
              getFilteredIndustries={form.getFilteredIndustries}
              onCompanyNameChange={form.setCompanyName}
              onOpenIndustrySuggestion={form.handleOpenIndustrySuggestion}
              onIndustryNameChange={form.handleIndustryNameChange}
              onIndustryCodeChange={form.handleIndustryCodeChange}
              onSelectIndustry={form.handleSelectIndustry}
              onAddIndustryRow={form.handleAddIndustryRow}
              onRemoveIndustryRow={form.handleRemoveIndustryRow}
              onBusinessNumberChange={form.handleBusinessNumberChange}
              onRegionChange={form.setRegion}
              onCompanyTypeChange={form.setCompanyType}
              onMainPurposeChange={form.setMainPurpose}
            />

            <AgreementBox
              agreeService={form.agreeService}
              agreePrivacy={form.agreePrivacy}
              onAgreeServiceChange={form.setAgreeService}
              onAgreePrivacyChange={form.setAgreePrivacy}
            />
          </fieldset>

          {!isSignupUnlocked && (
            <button
              type="button"
              className="ff-signup-locked-layer"
              onClick={showLockedNotice}
              aria-label="이메일 인증 후 입력 가능"
            />
          )}
        </div>

        {requiredNotice && (
          <div
            className="ff-signup-required-popover"
            role="alert"
            aria-live="assertive"
          >
            <div className="ff-signup-required-popover__head">
              <div>
                <strong>{requiredNotice.title}</strong>
                <p>{requiredNotice.message}</p>
              </div>

              <button
                type="button"
                className="ff-signup-notice-close"
                onClick={closeRequiredNotice}
                aria-label="안내 닫기"
              >
                ×
              </button>
            </div>

            {requiredNotice.items && requiredNotice.items.length > 0 && (
              <ul className="ff-signup-required-popover__list">
                {requiredNotice.items.slice(0, 10).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="button"
          className={`ff-signup-submit ${
            isSignupUnlocked ? "" : "ff-signup-submit--locked"
          }`}
          onClick={handleSubmit}
          disabled={form.isSubmitting}
          aria-disabled={!isSignupUnlocked || form.isSubmitting}
        >
          {form.isSubmitting ? "저장 중..." : "회원가입 완료"}
        </button>

        <button
          type="button"
          className="ff-signup-login-link"
          onClick={onLoginClick ?? onClose}
        >
          이미 계정이 있으신가요? 로그인으로 돌아가기
        </button>
      </section>
    </div>
  )
}
