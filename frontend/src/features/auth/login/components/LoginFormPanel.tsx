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
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onRememberChange: (value: boolean) => void
  onLogin: () => void
  onOpenSignup: () => void
  onOpenSso: () => void
}

export function LoginFormPanel({
  email,
  password,
  remember,
  isLoggingIn,
  onEmailChange,
  onPasswordChange,
  onRememberChange,
  onLogin,
  onOpenSignup,
  onOpenSso,
}: LoginFormPanelProps) {
  return (
    <section
      style={{
        width: "100%",
        minHeight: "585px",
        borderRadius: "30px",
        background: "rgba(255,255,255,.96)",
        color: "#061B34",
        padding: "46px 46px",
        boxShadow: "0 34px 100px rgba(6,27,52,.26)",
        display: "grid",
        alignContent: "center",
        justifySelf: "end",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h2
          style={{
            margin: "0 0 12px",
            color: "#061B34",
            fontSize: "36px",
            fontWeight: 900,
            letterSpacing: "-1.5px",
          }}
        >
          로그인
        </h2>

        <p
          style={{
            margin: 0,
            color: "#667085",
            fontSize: "15px",
            fontWeight: 900,
          }}
        >
          FactoFit 계정으로 로그인하세요.
        </p>
      </div>

      <div style={{ display: "grid", gap: "18px" }}>
        <label style={{ display: "grid", gap: "9px" }}>
          <span
            style={{
              color: "#475467",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            이메일
          </span>

          <input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="이메일을 입력하세요"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "9px" }}>
          <span
            style={{
              color: "#475467",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            비밀번호
          </span>

          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="비밀번호를 입력하세요"
            style={inputStyle}
          />
        </label>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginTop: "2px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#475467",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => onRememberChange(event.target.checked)}
              style={{
                width: "15px",
                height: "15px",
                accentColor: "#344BA0",
              }}
            />
            로그인 상태 유지
          </label>

          <button type="button" style={textButtonStyle}>
            비밀번호 찾기
          </button>
        </div>

        <button
          type="button"
          onClick={onLogin}
          style={primaryButtonStyle}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? "로그인 중..." : "로그인"}
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: "14px",
            color: "#98A2B3",
            fontSize: "13px",
            fontWeight: 900,
            margin: "4px 0",
          }}
        >
          <span style={{ height: "1px", background: "#E2E8F0" }} />
          또는
          <span style={{ height: "1px", background: "#E2E8F0" }} />
        </div>

        <button type="button" onClick={onOpenSso} style={secondaryButtonStyle}>
          ▦ 기업 SSO 로그인
        </button>

        <p
          style={{
            margin: "10px 0 0",
            textAlign: "center",
            color: "#667085",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          계정이 없으신가요?{" "}
          <button
            type="button"
            onClick={onOpenSignup}
            style={{
              border: 0,
              background: "transparent",
              color: "#344BA0",
              fontSize: "14px",
              fontWeight: 900,
              cursor: "pointer",
              padding: 0,
            }}
          >
            회원가입
          </button>
        </p>
      </div>
    </section>
  )
}
