import type { ReactNode } from "react"

import { loginPreviewData } from "../login.parts"
import {
  fieldLabelStyle,
  fieldWrapStyle,
  inputStyle,
  modalNextButtonStyle,
} from "../login.parts"

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

export function LoginPreviewDialog({
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
            {loginPreviewData.availablePolicyCount}
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
            value={loginPreviewData.expectedSupportAmount}
            color="#3B7A57"
          />
          <PreviewMetric
            label="예상 ROI"
            value={loginPreviewData.expectedRoi}
            color="#D36A21"
          />
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
        <PreviewList title="추천 순위" items={loginPreviewData.recommendedPolicies} />

        <PreviewList
          title="제조업 주요 공고·정책 소식"
          items={loginPreviewData.policyNews}
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

export function SsoDialog({
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

