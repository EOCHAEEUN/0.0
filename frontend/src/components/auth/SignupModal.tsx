import "./SignupModal.css"
import AccountSection from "./signup/components/AccountSection"
import AgreementBox from "./signup/components/AgreementBox"
import CompanyInfoSection from "./signup/components/CompanyInfoSection"
import UserInfoSection from "./signup/components/UserInfoSection"
import type { SignupModalProps } from "./signup/signup.types"
import { useSignupForm } from "./signup/useSignupForm"

export default function SignupModal({ onClose, onLoginClick }: SignupModalProps) {
  const form = useSignupForm({ onClose })

  return (
    <div className="ff-signup-overlay">
      <section
        className="ff-signup-panel"
        onClick={(event) => event.stopPropagation()}
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
          companySize={form.companySize}
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
          onCompanySizeChange={form.setCompanySize}
          onMainPurposeChange={form.setMainPurpose}
        />

        <AgreementBox
          agreeService={form.agreeService}
          agreePrivacy={form.agreePrivacy}
          onAgreeServiceChange={form.setAgreeService}
          onAgreePrivacyChange={form.setAgreePrivacy}
        />

        <button
          type="button"
          className="ff-signup-submit"
          onClick={form.handleSubmit}
          disabled={form.isSubmitting}
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