import type { ReactNode } from "react"

import { useLoginBriefing } from "../hooks/useLoginBriefing"
import "../loginPreview.css"
import {
  getAvailablePolicyDisplay,
  getBriefingHeroTitle,
  getRoiDisplay,
  getSupportAmountDisplay,
} from "../loginPreview.utils"
import {
  fieldLabelStyle,
  fieldWrapStyle,
  inputStyle,
  modalNextButtonStyle,
} from "../login.parts"

function ModalShell({
  children,
  onClose,
}: {
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="ff-login-preview-overlay" onClick={onClose}>
      <section
        className="ff-login-preview-modal"
        aria-label="FactoFit AI 예비 진단 리포트"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  )
}

function PreviewHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="ff-login-preview-header">
      <div className="ff-login-preview-brand">
        <span className="ff-login-preview-brand-icon" aria-hidden="true">
          AI
        </span>
        <div className="ff-login-preview-brand-copy">
          <strong>FactoFit AI</strong>
          <span>예비 진단 리포트</span>
        </div>
      </div>
      <button
        type="button"
        className="ff-login-preview-close"
        onClick={onClose}
        aria-label="닫기"
      >
        ×
      </button>
    </header>
  )
}

export function LoginPreviewDialog({
  onClose,
  onContinue,
}: {
  onClose: () => void
  onContinue: () => void
}) {
  const { data, loading, error, reload } = useLoginBriefing(true)
  const heroTitle = getBriefingHeroTitle(data)
  const availablePolicy = getAvailablePolicyDisplay(data, loading)
  const supportAmount = getSupportAmountDisplay(data, loading)
  const roiValue = getRoiDisplay(data, loading)

  const handleContinue = () => {
    onContinue()
  }

  return (
    <ModalShell onClose={onClose}>
      <PreviewHeader onClose={onClose} />

      <div className="ff-login-preview-body">
        {error ? (
          <div className="ff-login-preview-error">
            {error}
            <button type="button" onClick={() => void reload()}>
              다시 시도
            </button>
          </div>
        ) : null}

        <div className="ff-login-preview-hero">
          <h2>{heroTitle}</h2>
          <p>{data?.hero_summary ?? "맞춤 진단 정보를 불러오는 중입니다."}</p>
        </div>

        <div className="ff-login-preview-metrics">
          <div className="ff-login-preview-metric-card">
            <span>현재 신청 가능한 사업</span>
            {loading ? (
              <span className="ff-login-preview-skeleton" aria-hidden="true" />
            ) : (
              <strong className={availablePolicy.tone === "muted" ? "is-muted" : ""}>
                {availablePolicy.value}
              </strong>
            )}
          </div>

          <div className="ff-login-preview-metric-grid">
            <div className="ff-login-preview-metric-card">
              <span>예상 확보 가능 지원금</span>
              {loading ? (
                <span className="ff-login-preview-skeleton" aria-hidden="true" />
              ) : (
                <>
                  <strong className={supportAmount.value === "분석 필요" || supportAmount.value === "산정 전" ? "is-muted" : ""}>
                    {supportAmount.value}
                  </strong>
                  {supportAmount.hint ? (
                    <span className="ff-login-preview-metric-hint">{supportAmount.hint}</span>
                  ) : null}
                </>
              )}
            </div>

            <div className="ff-login-preview-metric-card">
              <span>예상 ROI</span>
              {loading ? (
                <span className="ff-login-preview-skeleton" aria-hidden="true" />
              ) : (
                <strong className={roiValue === "분석 필요" || roiValue === "산정 전" ? "is-muted" : ""}>
                  {roiValue}
                </strong>
              )}
            </div>
          </div>
        </div>

        <div className="ff-login-preview-columns">
          <section className="ff-login-preview-section">
            <h3>추천 순위</h3>
            {!loading && data && data.recommendations.length > 0 ? (
              <ol className="ff-login-preview-list">
                {data.recommendations.map((item, index) => (
                  <li key={`${item.policy_id ?? "policy"}-${index}`}>
                    <span className="ff-login-preview-rank">{index + 1}</span>
                    <span>{item.title || "아직 맞춤 결과가 없습니다"}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ff-login-preview-empty">
                {loading
                  ? "추천 정책을 불러오는 중입니다."
                  : data?.has_analysis
                    ? "아직 맞춤 결과가 없습니다."
                    : "분석 완료 후 추천 순위가 표시됩니다."}
              </p>
            )}
          </section>

          <section className="ff-login-preview-section">
            <h3>주요 공고 · 소식</h3>
            {!loading && data && data.notices.length > 0 ? (
              <div>
                {data.notices.map((notice, index) => (
                  <div
                    key={`${notice.policy_id ?? "notice"}-${index}`}
                    className="ff-login-preview-notice-item"
                  >
                    <strong>{notice.title}</strong>
                    {notice.organization || notice.deadline ? (
                      <span>
                        {[notice.organization, notice.deadline].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ff-login-preview-empty">
                {loading
                  ? "공고 소식을 불러오는 중입니다."
                  : "새 공고 소식을 준비 중입니다."}
              </p>
            )}
          </section>
        </div>
      </div>

      <footer className="ff-login-preview-footer">
        <button
          type="button"
          className="ff-login-preview-cta"
          onClick={handleContinue}
          disabled={loading}
        >
          다음으로
        </button>
      </footer>
    </ModalShell>
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
          width: "min(560px, 100%)",
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
        <PreviewHeader onClose={onClose} />

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
      </section>
    </div>
  )
}
