import type { PasswordCheck, PasswordLevel } from "../signup.types"
import FieldLabel from "./FieldLabel"

type AccountSectionProps = {
  email: string
  emailCode: string
  isEmailVerified: boolean
  password: string
  passwordCheck: string
  passwordChecks: PasswordCheck[]
  passwordLevel: PasswordLevel
  passwordLabel: string
  isPasswordMatched: boolean
  isPasswordMismatch: boolean
  isSendingCode: boolean
  isVerifyingCode: boolean
  onEmailChange: (value: string) => void
  onEmailCodeChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onPasswordCheckChange: (value: string) => void
  onSendEmailCode: () => void
  onVerifyEmail: () => void
}

export default function AccountSection({
  email,
  emailCode,
  isEmailVerified,
  password,
  passwordCheck,
  passwordChecks,
  passwordLevel,
  passwordLabel,
  isPasswordMatched,
  isPasswordMismatch,
  isSendingCode,
  isVerifyingCode,
  onEmailChange,
  onEmailCodeChange,
  onPasswordChange,
  onPasswordCheckChange,
  onSendEmailCode,
  onVerifyEmail,
}: AccountSectionProps) {
  return (
    <div className="ff-signup-section">
      <h3>1. 계정 정보</h3>

      <div className="ff-signup-field">
        <FieldLabel text="이메일" required />
        <div className="ff-signup-inline">
          <input
            type="email"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
          <button
            type="button"
            onClick={onSendEmailCode}
            disabled={isSendingCode}
          >
            {isSendingCode ? "발송 중..." : "인증번호 받기"}
          </button>
        </div>

        {email && !email.includes("@") && (
          <p className="ff-signup-message is-error">
            이메일 형식으로 입력해주세요.
          </p>
        )}
      </div>

      <div className="ff-signup-field">
        <FieldLabel text="이메일 인증번호" required />
        <div className="ff-signup-inline">
          <input
            placeholder="인증번호 입력"
            value={emailCode}
            onChange={(event) => onEmailCodeChange(event.target.value)}
          />
          <button
            type="button"
            onClick={onVerifyEmail}
            disabled={isVerifyingCode}
          >
            {isVerifyingCode ? "확인 중..." : "인증 확인"}
          </button>
        </div>

        {isEmailVerified && (
          <p className="ff-signup-message is-success">
            이메일 인증이 완료되었습니다.
          </p>
        )}
      </div>

      <div className="ff-signup-two-col ff-signup-password-row">
        <div className="ff-signup-field">
          <FieldLabel text="비밀번호" required />
          <input
            type="password"
            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />

          <div className={`ff-password-meter is-${passwordLevel}`}>
            <div className="ff-password-meter-track">
              <span />
              <span />
              <span />
            </div>
            <p>{passwordLabel}</p>
          </div>

          <ul className="ff-password-check-list">
            {passwordChecks.map((item) => (
              <li key={item.label} className={item.valid ? "is-valid" : undefined}>
                {item.valid ? "✓" : "•"} {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="ff-signup-field ff-signup-password-confirm-field">
          <FieldLabel text="비밀번호 확인" required />
          <input
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={passwordCheck}
            onChange={(event) => onPasswordCheckChange(event.target.value)}
          />

          {passwordCheck.length === 0 && (
            <p className="ff-signup-message is-muted">
              비밀번호를 한 번 더 입력해주세요.
            </p>
          )}

          {isPasswordMatched && (
            <p className="ff-signup-message is-success">
              비밀번호가 일치합니다.
            </p>
          )}

          {isPasswordMismatch && (
            <p className="ff-signup-message is-error">
              비밀번호가 일치하지 않습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}