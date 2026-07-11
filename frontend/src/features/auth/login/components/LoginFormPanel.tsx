import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textButtonStyle,
} from "../login.parts"

type LoginFormPanelProps = {
  email: string
  password: string
  remember: boolean
  isLoggingIn: boolean
  isRequestingPasswordReset?: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onRememberChange: (value: boolean) => void
  onLogin: () => void
  onOpenSignup: () => void
  onOpenSso: () => void
  onPasswordReset?: () => void
}

export function LoginFormPanel({
  email,
  password,
  remember,
  isLoggingIn,
  isRequestingPasswordReset,
  onEmailChange,
  onPasswordChange,
  onRememberChange,
  onLogin,
  onOpenSignup,
  onOpenSso,
  onPasswordReset,
}: LoginFormPanelProps) {
  return (
    <section className="ff-login-form-panel">
      <div className="ff-login-form-head">
        <h2>로그인</h2>
        <p>FactoFit 계정으로 로그인하세요.</p>
      </div>

      <div className="ff-login-form-fields">
        <label className="ff-login-field">
          <span>이메일</span>
          <input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="이메일을 입력하세요"
            style={inputStyle}
          />
        </label>

        <label className="ff-login-field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="비밀번호를 입력하세요"
            style={inputStyle}
          />
        </label>

        <div className="ff-login-form-row">
          <label className="ff-login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => onRememberChange(event.target.checked)}
            />
            로그인 상태 유지
          </label>

          <button
            type="button"
            style={textButtonStyle}
            onClick={onPasswordReset}
            disabled={isRequestingPasswordReset}
          >
            {isRequestingPasswordReset ? "발송 중..." : "비밀번호 찾기"}
          </button>
        </div>

        <button
          type="button"
          className="ff-login-btn ff-login-btn-primary"
          onClick={onLogin}
          style={primaryButtonStyle}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? "로그인 중..." : "로그인"}
        </button>

        <div className="ff-login-divider">
          <span />
          또는
          <span />
        </div>

        <button
          type="button"
          className="ff-login-btn ff-login-btn-secondary"
          onClick={onOpenSso}
          style={secondaryButtonStyle}
        >
          ▦ 기업 SSO 로그인
        </button>

        <p className="ff-login-signup-copy">
          계정이 없으신가요?{" "}
          <button type="button" onClick={onOpenSignup}>
            회원가입
          </button>
        </p>
      </div>
    </section>
  )
}
