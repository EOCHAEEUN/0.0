import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import SignupModal from "../components/auth/SignupModal"

type ModalType = "preview" | "signup" | "sso" | null

export default function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [modalType, setModalType] = useState<ModalType>(null)

  const handleLogin = () => {
    setModalType("preview")
  }

  const handleContinue = () => {
    setModalType(null)
    navigate("/")
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        color: "#FFFFFF",
        fontFamily: `"Noto Sans KR", "Pretendard", system-ui, sans-serif`,
        backgroundColor: "#273142",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/images/login-factory-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "52% center",
          backgroundRepeat: "no-repeat",
          filter: "saturate(1.03) contrast(1.05) brightness(1.12)",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(6,27,52,.68) 0%, rgba(6,27,52,.42) 44%, rgba(6,27,52,.12) 100%)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 62% 50%, rgba(255,255,255,.08) 0%, rgba(6,27,52,.06) 40%, rgba(6,27,52,.20) 100%)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      <button
        type="button"
        onClick={() => navigate("/main")}
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          zIndex: 30,
          height: "38px",
          padding: "0 16px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,.26)",
          background: "rgba(255,255,255,.16)",
          color: "#FFFFFF",
          fontSize: "13px",
          fontWeight: 900,
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          boxShadow: "0 12px 30px rgba(0,0,0,.18)",
        }}
      >
        ← 메인으로
      </button>

      <section
        style={{
          position: "relative",
          zIndex: 3,
          width: "100%",
          minHeight: "100vh",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(540px, 760px) minmax(420px, 470px)",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "clamp(56px, 7vw, 150px)",
          padding: "clamp(72px, 8vh, 110px) clamp(64px, 5vw, 86px)",
        }}
      >
        <div
          style={{
            maxWidth: "720px",
            justifySelf: "start",
            transform: "translateY(10px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "48px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: "#FFFFFF",
                color: "#344BA0",
                display: "grid",
                placeItems: "center",
                fontSize: "28px",
                fontWeight: 900,
                boxShadow: "0 14px 34px rgba(0,0,0,.16)",
              }}
            >
              F
            </div>

            <div>
              <strong
                style={{
                  display: "block",
                  fontSize: "28px",
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: "-.8px",
                }}
              >
                FactoFit
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: "#DCE7F5",
                  fontSize: "12px",
                  fontWeight: 900,
                }}
              >
                Manufacturing AI Advisor
              </span>
            </div>
          </div>

          <h1
            style={{
              margin: "0 0 34px",
              color: "#FFFFFF",
              fontSize: "clamp(52px, 5vw, 78px)",
              lineHeight: 1.12,
              letterSpacing: "-3.2px",
              fontWeight: 900,
              textShadow: "0 18px 48px rgba(0,0,0,.24)",
            }}
          >
            제조업 의사결정을 위한
            <br />
            AI CFO + 정부지원금 비서
          </h1>

          <p
            style={{
              margin: "0 0 48px",
              color: "#E9F0FA",
              fontSize: "19px",
              lineHeight: 1.85,
              fontWeight: 800,
              textShadow: "0 10px 32px rgba(0,0,0,.22)",
            }}
          >
            흩어진 제조업 지원 정보를 모아
            <br />
            우리 기업에 맞는 지원사업을 추천하고,
            <br />
            ROI 분석과 신청서 생성까지 도와드립니다.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "14px",
              maxWidth: "640px",
            }}
          >
            {[
              ["◎", "맞춤형", "지원사업 추천"],
              ["↗", "ROI 분석 및", "투자효과 예측"],
              ["▤", "신청 서류 준비", "자동화"],
              ["◇", "마감 알림 &", "일정 관리"],
            ].map(([icon, line1, line2]) => (
              <div
                key={`${line1}-${line2}`}
                style={{
                  minHeight: "108px",
                  borderRadius: "18px",
                  border: "1px solid rgba(255,255,255,.16)",
                  background: "rgba(10,24,46,.46)",
                  backdropFilter: "blur(10px)",
                  display: "grid",
                  placeItems: "center",
                  alignContent: "center",
                  textAlign: "center",
                  padding: "18px 12px",
                  boxShadow: "0 18px 42px rgba(0,0,0,.20)",
                }}
              >
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,.14)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: "12px",
                    color: "#FFFFFF",
                    fontSize: "18px",
                    fontWeight: 900,
                  }}
                >
                  {icon}
                </div>

                <strong
                  style={{
                    color: "#FFFFFF",
                    fontSize: "14px",
                    lineHeight: 1.45,
                    fontWeight: 900,
                  }}
                >
                  {line1}
                  <br />
                  {line2}
                </strong>
              </div>
            ))}
          </div>
        </div>

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
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
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
                  onChange={(event) => setRemember(event.target.checked)}
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

            <button type="button" onClick={handleLogin} style={primaryButtonStyle}>
              로그인
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

            <button
              type="button"
              onClick={() => setModalType("sso")}
              style={secondaryButtonStyle}
            >
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
                onClick={() => setModalType("signup")}
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
      </section>

      {modalType === "preview" && (
        <LoginPreviewDialog
          onClose={() => setModalType(null)}
          onContinue={handleContinue}
        />
      )}

      {modalType === "signup" && (
        <SignupModal
          onClose={() => setModalType(null)}
          onLoginClick={() => setModalType(null)}
        />
      )}

      {modalType === "sso" && (
        <SsoDialog
          onClose={() => setModalType(null)}
          onContinue={() => setModalType("preview")}
        />
      )}
    </main>
  )
}

const inputStyle: CSSProperties = {
  height: "56px",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  color: "#061B34",
  padding: "0 18px",
  fontSize: "15px",
  fontWeight: 800,
  outline: "none",
}

const primaryButtonStyle: CSSProperties = {
  height: "58px",
  borderRadius: "14px",
  border: 0,
  background: "#344BA0",
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 18px 38px rgba(52,75,160,.22)",
}

const modalNextButtonStyle: CSSProperties = {
  width: "100%",
  height: "58px",
  minHeight: "58px",
  borderRadius: "16px",
  border: 0,
  background: "#344BA0",
  color: "#FFFFFF",
  fontSize: "17px",
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  whiteSpace: "nowrap",
  boxShadow: "0 18px 38px rgba(52,75,160,.22)",
}

const secondaryButtonStyle: CSSProperties = {
  height: "56px",
  borderRadius: "14px",
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#061B34",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
}

const textButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#344BA0",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
}

function ModalShell({
  children,
  onClose,
  width = 560,
}: {
  children: ReactNode
  onClose: () => void
  width?: number
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "grid",
        placeItems: "center",
        padding: "28px",
        background: "rgba(6,27,52,.52)",
        backdropFilter: "blur(10px)",
      }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={{
          width: `min(${width}px, 100%)`,
          maxHeight: "calc(100vh - 56px)",
          overflowY: "auto",
          borderRadius: "30px",
          background: "#FFFFFF",
          color: "#061B34",
          padding: "36px 38px 40px",
          boxShadow: "0 34px 100px rgba(6,27,52,.34)",
          border: "1px solid rgba(255,255,255,.54)",
        }}
      >
        {children}
      </section>
    </div>
  )
}

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string
  subtitle: string
  onClose: () => void
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "18px",
        marginBottom: "30px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "58px",
            height: "58px",
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #061B34 0%, #263A82 48%, #D6B15A 100%)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 12px 30px rgba(6,27,52,.16)",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              background: "#FFFFFF",
              color: "#344BA0",
              display: "grid",
              placeItems: "center",
              fontSize: "18px",
              fontWeight: 900,
            }}
          >
            AI
          </div>
        </div>

        <div>
          <strong
            style={{
              display: "block",
              color: "#344BA0",
              fontSize: "28px",
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-1px",
            }}
          >
            {title}
          </strong>

          <span
            style={{
              display: "block",
              marginTop: "7px",
              color: "#667085",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            {subtitle}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: 0,
          background: "transparent",
          color: "#667085",
          fontSize: "26px",
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  )
}

function LoginPreviewDialog({
  onClose,
  onContinue,
}: {
  onClose: () => void
  onContinue: () => void
}) {
  return (
    <ModalShell onClose={onClose} width={560}>
      <ModalHeader
        title="FactoFit AI"
        subtitle="예비 진단 리포트"
        onClose={onClose}
      />

      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            margin: "0 0 8px",
            color: "#061B34",
            fontSize: "27px",
            lineHeight: 1.25,
            letterSpacing: "-1px",
            fontWeight: 900,
          }}
        >
          대표님,
          <br />
          지금 바로 확인해보세요!
        </h2>

        <p
          style={{
            margin: 0,
            color: "#475467",
            fontSize: "15px",
            lineHeight: 1.7,
            fontWeight: 800,
          }}
        >
          현재 조건은 스마트공장 고도화와 설비투자 정책자금 우선 검토가
          적합합니다.
        </p>
      </div>

      <div style={{ display: "grid", gap: "14px", marginBottom: "22px" }}>
        <div
          style={{
            minHeight: "86px",
            borderRadius: "18px",
            border: "1px solid #E2E8F0",
            background: "#F8FAFC",
            padding: "20px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <span style={{ color: "#475467", fontSize: "14px", fontWeight: 900 }}>
            현재 신청 가능한 사업
          </span>

          <strong
            style={{
              color: "#344BA0",
              fontSize: "42px",
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-1px",
            }}
          >
            8건
          </strong>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
          }}
        >
          <PreviewMetric
            label="예상 확보 가능 지원금"
            value="8,200만원"
            color="#3B7A57"
          />
          <PreviewMetric label="예상 ROI" value="98%" color="#D36A21" />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "30px",
        }}
      >
        <PreviewList
          title="추천 순위"
          items={["스마트공장 고도화", "설비투자 정책자금", "ESG 개선사업"]}
        />

        <PreviewList
          title="제조업 주요 공고·정책 소식"
          items={[
            "스마트공장 고도화 지원사업 추가 모집 공고",
            "설비투자 활성화 정책자금 지원 확대",
          ]}
        />
      </div>

      <button type="button" onClick={onContinue} style={modalNextButtonStyle}>
        다음으로
      </button>
    </ModalShell>
  )
}

function PreviewMetric({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div
      style={{
        minHeight: "112px",
        borderRadius: "18px",
        border: "1px solid #E2E8F0",
        background: "#F8FAFC",
        padding: "18px 20px",
        display: "grid",
        alignContent: "center",
      }}
    >
      <span
        style={{
          color: "#475467",
          fontSize: "13px",
          fontWeight: 900,
          marginBottom: "12px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color,
          fontSize: "31px",
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: "-1px",
        }}
      >
        {value}
      </strong>
    </div>
  )
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3
        style={{
          margin: "0 0 12px",
          color: "#061B34",
          fontSize: "16px",
          fontWeight: 900,
        }}
      >
        {title}
      </h3>

      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: "9px",
        }}
      >
        {items.map((item, index) => (
          <li
            key={item}
            style={{
              display: "grid",
              gridTemplateColumns: "22px 1fr",
              gap: "8px",
              alignItems: "start",
              color: "#344054",
              fontSize: "13px",
              lineHeight: 1.55,
              fontWeight: 800,
            }}
          >
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#EEF4FF",
                color: "#344BA0",
                display: "grid",
                placeItems: "center",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
    </div>
  )
}

function SsoDialog({
  onClose,
  onContinue,
}: {
  onClose: () => void
  onContinue: () => void
}) {
  return (
    <ModalShell onClose={onClose} width={560}>
      <ModalHeader
        title="기업 SSO"
        subtitle="조직 계정으로 로그인"
        onClose={onClose}
      />

      <div style={{ marginBottom: "26px" }}>
        <h2
          style={{
            margin: "0 0 10px",
            color: "#061B34",
            fontSize: "28px",
            lineHeight: 1.25,
            letterSpacing: "-1px",
            fontWeight: 900,
          }}
        >
          회사 계정으로
          <br />
          FactoFit에 접속합니다.
        </h2>

        <p
          style={{
            margin: 0,
            color: "#667085",
            fontSize: "15px",
            lineHeight: 1.75,
            fontWeight: 800,
          }}
        >
          기업 SSO는 사내 계정, 관리자 승인, 조직 도메인을 통해 로그인하는
          방식입니다.
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
        <label style={fieldWrapStyle}>
          <span style={fieldLabelStyle}>회사 이메일</span>
          <input placeholder="name@company.com" style={inputStyle} />
        </label>

        <label style={fieldWrapStyle}>
          <span style={fieldLabelStyle}>조직 코드</span>
          <input placeholder="예: FACTOFIT-2026" style={inputStyle} />
        </label>

        <div
          style={{
            borderRadius: "18px",
            border: "1px solid #E2E8F0",
            background: "#F8FAFC",
            padding: "18px 20px",
            color: "#475467",
            fontSize: "14px",
            lineHeight: 1.75,
            fontWeight: 800,
          }}
        >
          관리자 승인 후에는 구성원별 권한, 분석 기록, 지원사업 캘린더를 조직
          단위로 관리할 수 있습니다.
        </div>
      </div>

      <button type="button" onClick={onContinue} style={modalNextButtonStyle}>
        다음으로
      </button>
    </ModalShell>
  )
}

const fieldWrapStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
}

const fieldLabelStyle: CSSProperties = {
  color: "#475467",
  fontSize: "13px",
  fontWeight: 900,
}