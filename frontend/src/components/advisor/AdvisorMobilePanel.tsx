import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import botIcon from "../../assets/advisor/engi-bot-transparent.png"
import { requestAdvisorAnswer } from "../../features/aiAdvisor/aiAdvisor.api"
import { APPLICATION_DRAFT_MUST_INCLUDE_KEY } from "../../features/applicationDraft/applicationDraft.constants"
import {
  ANALYSIS_STEPS,
  COMPANY_REQUIRED,
  DASHBOARD_DEADLINES,
  DASHBOARD_RECENT_ANALYSIS,
  DASHBOARD_STATS,
  DRAFT_HIGHLIGHTS,
  DRAFT_SAFETY_STATUS,
  DRAFT_SECTIONS,
  GUEST_CHAT_ACTIONS,
  GUEST_COMPANY_NAME,
  GUEST_ENGI_GREETING,
  GUEST_SUGGESTION_CHIPS,
  QUICK_MENUS,
  ROI_REQUIREMENTS,
  ROI_RESULTS,
  SAFETY_ITEMS,
  SUPPORT_OTHER_PROJECTS,
  SUPPORT_TOP_PICK,
} from "./advisor.constants"
import type { AdvisorScreen } from "./advisor.types"

const KAKAO_CHANNEL_URL =
  (import.meta.env.VITE_KAKAO_CHANNEL_URL as string | undefined)?.trim() ||
  "http://pf.kakao.com/_tpeXX/friend"

function openKakaoChannel() {
  window.open(KAKAO_CHANNEL_URL, "_blank", "noopener,noreferrer")
}

function BotVisual() {
  return (
    <div className="factofit-advisor-bot-visual">
      <img src={botIcon} alt="" aria-hidden="true" />
    </div>
  )
}

function PrimaryCta({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode
  icon?: string
  onClick?: () => void
}) {
  return (
    <button className="factofit-advisor-primary-cta" type="button" onClick={onClick}>
      <span>{icon ?? "✓"}</span>
      <b>{children}</b>
      <em>›</em>
    </button>
  )
}

function SecondaryCta({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button className="factofit-advisor-secondary-cta" type="button" onClick={onClick}>
      {children}
      <span>›</span>
    </button>
  )
}

function StepStrip() {
  return (
    <div className="factofit-advisor-step-strip">
      {ANALYSIS_STEPS.map((step) => (
        <span key={step}>
          <i aria-hidden="true">✓</i>
          {step}
        </span>
      ))}
    </div>
  )
}

function BottomNav({
  onMove,
  activeNav = "home",
}: {
  onMove?: (screen: AdvisorScreen) => void
  activeNav?: "home" | "kakao" | "email"
}) {
  return (
    <nav className="factofit-advisor-bottom-nav">
      <button
        className={activeNav === "home" ? "active" : undefined}
        type="button"
        onClick={() => onMove?.("home")}
      >
        <span className="factofit-advisor-nav-icon is-home" aria-hidden="true" />
        홈
      </button>
      <button
        className={activeNav === "kakao" ? "active" : undefined}
        type="button"
        onClick={openKakaoChannel}
      >
        <span className="factofit-advisor-nav-icon is-kakao" aria-hidden="true" />
        카카오톡
      </button>
      <button
        className={activeNav === "email" ? "active" : undefined}
        type="button"
        onClick={() => {
          window.location.href = "mailto:support@factofit.com"
        }}
      >
        <span className="factofit-advisor-nav-icon is-email" aria-hidden="true" />
        이메일
      </button>
    </nav>
  )
}

function ScreenFrame({
  title,
  subtitle,
  showBack = false,
  chatLayout = false,
  children,
  onBack,
  onClose,
  onMove,
  activeNav = "home",
}: {
  title: string
  subtitle?: string
  showBack?: boolean
  chatLayout?: boolean
  children: React.ReactNode
  onBack?: () => void
  onClose: () => void
  onMove?: (screen: AdvisorScreen) => void
  activeNav?: "home" | "kakao" | "email"
}) {
  return (
    <section
      className={`factofit-advisor-mobile-page is-light-page${chatLayout ? " is-chat-layout" : ""}`}
    >
      <header className="factofit-advisor-page-head">
        <div className="factofit-advisor-home-top">
          <div className="factofit-advisor-page-top-left">
            {showBack && (
              <button
                className="factofit-advisor-page-back"
                type="button"
                onClick={onBack}
                aria-label="뒤로"
              >
                ‹
              </button>
            )}
            <span className="factofit-advisor-home-online">
              <i aria-hidden="true" />
              온라인
            </span>
          </div>
          <button
            type="button"
            className="factofit-advisor-home-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="factofit-advisor-home-brand">
          <div className="factofit-advisor-home-brand-copy">
            <span className="factofit-advisor-home-logo">F</span>
            <div className="factofit-advisor-home-brand-text">
              <strong>FactoFit</strong>
              <small>Manufacturing AI Advisor</small>
            </div>
          </div>

          <div className="factofit-advisor-home-mascot-wrap" aria-hidden="true">
            <span className="factofit-advisor-home-sparkle">✦</span>
            <img src={botIcon} alt="" className="factofit-advisor-home-mascot" />
          </div>
        </div>

        <div className="factofit-advisor-page-heading">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      <div className={`factofit-advisor-page-body${chatLayout ? " is-chat" : ""}`}>
        {children}
      </div>

      <BottomNav onMove={onMove} activeNav={activeNav} />
    </section>
  )
}

function HomeScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  return (
    <section className="factofit-advisor-mobile-page is-home-ref">
      <div className="factofit-advisor-home-shell">
        <header className="factofit-advisor-home-header">
          <div className="factofit-advisor-home-top">
            <span className="factofit-advisor-home-online">
              <i aria-hidden="true" />
              온라인
            </span>
            <button
              type="button"
              className="factofit-advisor-home-close"
              onClick={onClose}
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div className="factofit-advisor-home-brand">
            <div className="factofit-advisor-home-brand-copy">
              <span className="factofit-advisor-home-logo">F</span>
              <div className="factofit-advisor-home-brand-text">
                <strong>FactoFit</strong>
                <small>Manufacturing AI Advisor</small>
              </div>
            </div>

            <div className="factofit-advisor-home-mascot-wrap" aria-hidden="true">
              <span className="factofit-advisor-home-sparkle">✦</span>
              <img src={botIcon} alt="" className="factofit-advisor-home-mascot" />
            </div>
          </div>

          <div className="factofit-advisor-home-greeting">
            <h1>안녕하세요, FactoFit입니다.</h1>
            <p>무엇을 도와드릴까요?</p>
          </div>
        </header>

        <main className="factofit-advisor-home-main">
          <button
            type="button"
            className="factofit-advisor-home-banner"
            onClick={() => onMove("advisor")}
          >
            <div className="factofit-advisor-home-banner-bot-wrap">
              <img src={botIcon} alt="" className="factofit-advisor-home-banner-bot" aria-hidden="true" />
            </div>
            <div className="factofit-advisor-home-banner-copy">
              <strong>FactoFit AI가 도와드려요</strong>
              <span>성장에 필요한 분석과 지원을 빠르고 정확하게!</span>
            </div>
            <em aria-hidden="true">›</em>
          </button>

          <div className="factofit-advisor-home-grid">
            {QUICK_MENUS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`factofit-advisor-home-grid-btn is-${item.id}`}
                onClick={() => onMove(item.id)}
              >
                <span className="factofit-advisor-home-grid-icon" aria-hidden="true" />
                <span className="factofit-advisor-home-grid-label">{item.label}</span>
              </button>
            ))}
          </div>
        </main>

        <BottomNav onMove={onMove} />
      </div>
    </section>
  )
}

function IntroScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  return (
    <ScreenFrame
      title="팩토핏 소개"
      subtitle="제조기업을 위한 AI 의사결정 파트너"
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <div className="factofit-advisor-title-block">
        <div>
          <h2>왜 FactoFit인가요?</h2>
          <p>
            팩토핏은 제조기업의 성장을 돕기 위해 ROI 분석부터 지원사업 매칭,
            신청서 준비까지 모든 과정을 한곳에서 연결해드립니다.
          </p>
        </div>
        <BotVisual />
      </div>

      <div className="factofit-advisor-feature-list">
        <button type="button" onClick={() => onMove("roi")}>
          <span>▥</span>
          <div>
            <b>ROI 분석</b>
            <p>설비 투자 전 수익성과 회수기간을 빠르게 확인</p>
          </div>
          <em>›</em>
        </button>

        <button type="button" onClick={() => onMove("support")}>
          <span>◎</span>
          <div>
            <b>지원사업 추천</b>
            <p>우리 기업 조건에 맞는 사업만 선별</p>
          </div>
          <em>›</em>
        </button>

        <button type="button" onClick={() => onMove("draft")}>
          <span>▤</span>
          <div>
            <b>신청 준비</b>
            <p>초안, 일정, 준비 항목까지 연결</p>
          </div>
          <em>›</em>
        </button>
      </div>

      <article className="factofit-advisor-gold-notice">
        <span>✦</span>
        <div>
          <h4>시간은 절약하고, 성과는 높입니다.</h4>
          <p>팩토핏과 함께 더 현명한 의사결정을 시작하세요.</p>
        </div>
      </article>

      <PrimaryCta onClick={() => onMove("company")}>
        회원가입하고 시작하기
      </PrimaryCta>

      <SecondaryCta onClick={() => onMove("home")}>주요 기능 보기</SecondaryCta>
    </ScreenFrame>
  )
}

function DashboardScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  return (
    <ScreenFrame
      title="종합현황"
      subtitle={`${GUEST_COMPANY_NAME}님의 오늘 현황`}
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <button
        type="button"
        className="factofit-advisor-dashboard-company"
        onClick={() => onMove("company")}
      >
        <span className="factofit-advisor-dashboard-company__icon">🏭</span>
        <div>
          <strong>{GUEST_COMPANY_NAME}</strong>
          <em>프레스 1대 · 운영 중</em>
        </div>
        <i>›</i>
      </button>

      <div className="factofit-advisor-dashboard-stats">
        {DASHBOARD_STATS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="factofit-advisor-dashboard-stat"
            onClick={() => {
              if (item.label === "설비") onMove("roi")
              else if (item.label === "마감 임박" || item.label === "매칭 정책") onMove("support")
              else onMove("roi")
            }}
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </button>
        ))}
      </div>

      <div className="factofit-advisor-dashboard-split">
        <button
          type="button"
          className="factofit-advisor-dashboard-priority"
          onClick={() => onMove("support")}
        >
          <div className="factofit-advisor-dashboard-card-head">
            <strong>오늘의 우선 확인</strong>
            <b>추천</b>
          </div>
          <div className="factofit-advisor-dashboard-priority__body">
            <span>✦</span>
            <div>
              <strong>Engi 추천</strong>
              <p>마감 임박 공고를 먼저 확인하세요!</p>
            </div>
            <em>›</em>
          </div>
        </button>

        <section className="factofit-advisor-dashboard-deadlines">
          <div className="factofit-advisor-dashboard-card-head">
            <strong>마감 임박</strong>
            <button type="button" onClick={() => onMove("support")}>
              ›
            </button>
          </div>
          <ul>
            {DASHBOARD_DEADLINES.map((item) => (
              <li key={item.title}>
                <span className={`is-${item.tone}`}>{item.dday}</span>
                <b>{item.title}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="factofit-advisor-dashboard-recent">
        <div className="factofit-advisor-dashboard-card-head">
          <strong>최근 분석</strong>
          <button type="button" onClick={() => onMove("roi")}>
            ›
          </button>
        </div>
        <ul>
          {DASHBOARD_RECENT_ANALYSIS.map((item) => (
            <li key={item.no}>
              <span>{item.no}</span>
              <b>{item.title}</b>
              <em className={`is-${item.tone}`}>{item.status}</em>
            </li>
          ))}
        </ul>
      </section>
    </ScreenFrame>
  )
}

function AiAdvisorHomeScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<
    Array<{ id: string; role: "assistant" | "user"; content: string }>
  >([{ id: "welcome", role: "assistant", content: GUEST_ENGI_GREETING }])

  const appendExchange = async (
    question: string,
    options?: { action?: string; requiresEquipment?: boolean },
  ) => {
    const trimmed = question.trim()
    if (!trimmed) return

    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, content: trimmed }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    if (options?.action) {
      const selectedEquipmentId =
        (typeof window !== "undefined" &&
          (window.localStorage.getItem("factofit_selected_equipment_id") ||
            window.localStorage.getItem("factofit_equipment_id"))) ||
        ""
      if (options.requiresEquipment && !selectedEquipmentId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "설비를 먼저 선택해주세요.",
          },
        ])
        setInput("")
        return
      }

      const companyId =
        (typeof window !== "undefined" && window.localStorage.getItem("factofit_company_id")) || ""

      try {
        const response = await requestAdvisorAnswer(
          trimmed,
          nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          {
            companyId,
            action: options.action,
            selectedEquipmentId,
            source: "advisor",
          },
        )
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: response.text,
          },
        ])
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content:
              error instanceof Error
                ? error.message
                : "AI 상담 서비스를 일시적으로 연결하지 못했습니다.",
          },
        ])
      }
      setInput("")
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `${GUEST_COMPANY_NAME} 기준으로 ${trimmed} 요청을 확인했습니다. 회원가입 후 분석 결과와 함께 더 정확하게 안내해드릴게요.`,
      },
    ])
    setInput("")
  }

  return (
    <ScreenFrame
      title="AI Advisor"
      subtitle="필요한 작업을 선택하면 순서대로 이어드려요."
      showBack
      chatLayout
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <article className="factofit-advisor-guest-chat-card">
        <div className="factofit-advisor-guest-chat-head">
          <h3>현재 대화</h3>
          <span className="factofit-advisor-guest-chat-status">
            <i aria-hidden="true" />
            AI 시스템 활성화됨
          </span>
        </div>

        <div className="factofit-advisor-guest-action-list">
          {GUEST_CHAT_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onMove(action.screen)}
            >
              <span>{action.icon}</span>
              <b>{action.label}</b>
              <em>›</em>
            </button>
          ))}
        </div>
      </article>

      <div className="factofit-advisor-guest-chip-row">
        {GUEST_SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() =>
              void appendExchange(chip.message, {
                action: chip.action,
                requiresEquipment: chip.requiresEquipment,
              })
            }
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="factofit-advisor-guest-message-list">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="factofit-advisor-guest-message is-user">
              {message.content}
            </div>
          ) : (
            <div key={message.id} className="factofit-advisor-guest-message-row">
              <div className="factofit-advisor-guest-message-avatar">
                <img src={botIcon} alt="" aria-hidden="true" />
                <small>Industrial AI</small>
              </div>
              <div className="factofit-advisor-guest-message is-assistant">
                {message.content}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="factofit-advisor-guest-composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void appendExchange(input)
            }
          }}
          placeholder="질문 입력 (Enter 전송 / Shift+Enter 줄바꿈)"
          rows={1}
        />
        <button type="button" onClick={() => void appendExchange(input)}>
          보내기
          <span aria-hidden="true">➤</span>
        </button>
      </div>
    </ScreenFrame>
  )
}

function RoiScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  return (
    <ScreenFrame
      title="ROI 분석 문의"
      subtitle="설비 투자 효과를 AI가 분석합니다."
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <StepStrip />

      <section className="factofit-advisor-panel-card">
        <h3>분석 입력</h3>
        <div className="factofit-advisor-tile-grid is-four">
          {ROI_REQUIREMENTS.map((item) => (
            <article key={item.title}>
              <i aria-hidden="true">{item.icon}</i>
              <b>{item.title}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="factofit-advisor-panel-card">
        <h3>분석 결과</h3>
        <div className="factofit-advisor-tile-grid is-three">
          {ROI_RESULTS.map((item) => (
            <article key={item.title}>
              <i className="is-solid" aria-hidden="true">{item.icon}</i>
              <b>{item.title}</b>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <PrimaryCta onClick={() => onMove("company")}>ROI 분석 시작하기</PrimaryCta>
    </ScreenFrame>
  )
}

function SupportScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  return (
    <ScreenFrame
      title="지원사업 추천"
      subtitle="우리 회사에 꼭 맞는 지원사업을 찾아드려요."
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <button
        type="button"
        className="factofit-advisor-top-pick"
        onClick={() => onMove("company")}
      >
        <div className="factofit-advisor-top-pick-main">
          <span className="factofit-advisor-top-pick-badge">★ {SUPPORT_TOP_PICK.badge}</span>
          <h3>{SUPPORT_TOP_PICK.title}</h3>
          <div className="factofit-advisor-top-pick-tags">
            {SUPPORT_TOP_PICK.tags.map((tag) => (
              <b key={tag}>{tag}</b>
            ))}
          </div>
        </div>
        <div className="factofit-advisor-top-pick-score">
          <small>적합도</small>
          <strong>
            {SUPPORT_TOP_PICK.score}
            <span>/{SUPPORT_TOP_PICK.max}</span>
          </strong>
          <div className="factofit-advisor-score-bar">
            <i style={{ width: `${(SUPPORT_TOP_PICK.score / SUPPORT_TOP_PICK.max) * 100}%` }} />
          </div>
        </div>
      </button>

      <StepStrip />

      <section className="factofit-advisor-plain-section">
        <h3>다른 추천 사업</h3>
        <div className="factofit-advisor-project-list">
          {SUPPORT_OTHER_PROJECTS.map((project) => (
            <button
              key={project.title}
              type="button"
              onClick={() => onMove("company")}
            >
              <span className={`is-${project.tone}`}>{project.dday}</span>
              <b>{project.title}</b>
            </button>
          ))}
        </div>
      </section>

      <PrimaryCta onClick={() => onMove("company")}>
        회원가입하고 추천 더 보기
      </PrimaryCta>
    </ScreenFrame>
  )
}

function DraftScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  const [mustIncludeText, setMustIncludeText] = useState(
    () => window.localStorage.getItem(APPLICATION_DRAFT_MUST_INCLUDE_KEY) || "",
  )
  const [includeRequested, setIncludeRequested] = useState(
    () => Boolean(window.localStorage.getItem(APPLICATION_DRAFT_MUST_INCLUDE_KEY)),
  )

  const openApplicationDraft = () => {
    const normalized = mustIncludeText.trim()
    if (includeRequested && normalized) {
      window.localStorage.setItem(APPLICATION_DRAFT_MUST_INCLUDE_KEY, normalized)
    } else {
      window.localStorage.removeItem(APPLICATION_DRAFT_MUST_INCLUDE_KEY)
    }
    window.location.assign("/application-draft")
  }

  return (
    <ScreenFrame
      title="신청서 초안 생성"
      subtitle="지원사업 신청에 필요한 초안을 쉽고 빠르게 정리해드립니다."
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <section className="factofit-advisor-panel-card">
        <div className="factofit-advisor-highlight-grid">
          {DRAFT_HIGHLIGHTS.map((item) => (
            <article key={item.title}>
              <span className="factofit-advisor-round-icon" aria-hidden="true">
                {item.icon}
              </span>
              <b>{item.title}</b>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="factofit-advisor-panel-card">
        <ul className="factofit-advisor-status-list">
          {DRAFT_SAFETY_STATUS.map((item) => (
            <li key={item.title}>
              <i aria-hidden="true">{item.icon}</i>
              <b>{item.title}</b>
              <em className={`is-${item.tone}`}>{item.status}</em>
            </li>
          ))}
        </ul>
      </section>

      <section className="factofit-advisor-panel-card">
        <div className="factofit-advisor-highlight-grid is-solid">
          {DRAFT_SECTIONS.map((item) => (
            <article key={item.title}>
              <span className="factofit-advisor-round-icon is-solid" aria-hidden="true">
                {item.icon}
              </span>
              <b>{item.title}</b>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="factofit-advisor-panel-card factofit-advisor-draft-request">
        <label className="factofit-advisor-draft-request-toggle">
          <input
            type="checkbox"
            checked={includeRequested}
            onChange={(event) => setIncludeRequested(event.target.checked)}
          />
          <span>신청서에 추가할 내용 선택</span>
        </label>
        {includeRequested ? (
          <textarea
            value={mustIncludeText}
            maxLength={1000}
            rows={4}
            placeholder="예: 안전커버 보강 완료 내용과 작업자 교육 계획을 사업 필요성에 포함"
            onChange={(event) => setMustIncludeText(event.target.value)}
          />
        ) : null}
      </section>

      <PrimaryCta onClick={openApplicationDraft}>신청서 초안 생성</PrimaryCta>
    </ScreenFrame>
  )
}

function CompanyScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  return (
    <ScreenFrame
      title="기업정보 입력 도움"
      subtitle="기업명, 업종, 지역, 직원 수, 연매출을 입력하면 맞춤 분석과 추천을 받을 수 있어요."
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <section className="factofit-advisor-section">
        <h3>
          <span>▤</span>
          필수 입력 항목
        </h3>

        <div className="factofit-advisor-company-required">
          {COMPANY_REQUIRED.map((item) => (
            <article key={item.no}>
              <em>{item.no}</em>
              <i>{item.icon}</i>
              <b>{item.title}</b>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="factofit-advisor-company-tips">
        <h3>
          <span>💡</span>
          입력 팁
        </h3>
        <button type="button">업종 코드는 주 업종 기준으로 선택해 주세요.</button>
        <button type="button">직원 수와 연매출은 최근 기준으로 입력하면 추천 정확도가 높아져요.</button>
        <button type="button">모르는 항목은 나중에 마이페이지에서 수정할 수 있어요.</button>
      </section>

      <PrimaryCta onClick={() => onMove("home")} icon="✦">
        회원가입하고 기업정보 입력하기
      </PrimaryCta>

      <SecondaryCta onClick={() => onMove("intro")}>팩토핏 소개 보기</SecondaryCta>

      <article className="factofit-advisor-info-line">
        입력 완료 후 ROI 분석 · 지원사업 추천 · 신청서 초안으로 이어집니다.
      </article>

      <section className="factofit-advisor-mini-footer-card">
        <h3>관련 도움</h3>
        <div>
          <button type="button">기업정보 왜 필요한가요?</button>
          <button type="button">업종 코드 찾기</button>
          <button type="button">연매출 입력 기준</button>
          <button type="button">직원 수 입력 기준</button>
        </div>
      </section>
    </ScreenFrame>
  )
}

function SafetyScreen({
  onMove,
  onClose,
}: {
  onMove: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  return (
    <ScreenFrame
      title="안전점검 안내"
      subtitle="설비별 점검 항목과 법정 점검 주기를 간단히 안내해드려요."
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
      onMove={onMove}
    >
      <section className="factofit-advisor-panel-card">
        <h3>이런 항목을 확인해요</h3>
        <div className="factofit-advisor-tile-grid is-three">
          {SAFETY_ITEMS.map((item) => (
            <article key={item.title}>
              <i aria-hidden="true">{item.icon}</i>
              <b>{item.title}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="factofit-advisor-panel-card">
        <h3>이렇게 활용할 수 있어요</h3>
        <div className="factofit-advisor-tile-grid is-three">
          <article>
            <i className="is-solid">◎</i>
            <b>오늘 점검 우선순위</b>
            <p>먼저 볼 항목 안내</p>
          </article>
          <article>
            <i className="is-solid">▣</i>
            <b>법정 점검 주기</b>
            <p>기한 놓치지 않기</p>
          </article>
          <article>
            <i className="is-solid">▤</i>
            <b>점검 기록 관리</b>
            <p>저장 후 다시 확인</p>
          </article>
        </div>
      </section>

      <PrimaryCta onClick={() => onMove("company")} icon="✓">
        안전점검 시작하기
      </PrimaryCta>

      <SecondaryCta onClick={() => onMove("company")}>
        설비정보 먼저 입력하기
      </SecondaryCta>

      <article className="factofit-advisor-info-line">
        현재 안전점검은 press · cnc · injection 설비를 지원해요.
      </article>
    </ScreenFrame>
  )
}

export function AdvisorMobilePanel({
  screen,
  onScreenChange,
  onClose,
}: {
  screen: AdvisorScreen
  onScreenChange: (screen: AdvisorScreen) => void
  onClose: () => void
}) {
  const DESKTOP_MIN_WIDTH = 360
  const DESKTOP_MIN_HEIGHT = 480
  const DESKTOP_MAX_WIDTH = 620
  const DESKTOP_DEFAULT_WIDTH = 440
  const DESKTOP_DEFAULT_HEIGHT = 660
  const VIEWPORT_PADDING = 32
  const SESSION_STORAGE_KEY = "factofit.guestAdvisor.panelSize"

  const panelRef = useRef<HTMLDivElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const sizeRef = useRef<{ width: number; height: number } | null>(null)
  const resizeStartRef = useRef<{
    pointerX: number
    pointerY: number
    width: number
    height: number
  } | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null)

  const isDesktopResizableViewport = () => window.matchMedia("(min-width: 561px)").matches

  const clampSize = (width: number, height: number) => {
    const maxWidth = Math.min(DESKTOP_MAX_WIDTH, window.innerWidth - VIEWPORT_PADDING)
    const maxHeight = window.innerHeight - VIEWPORT_PADDING
    const minWidth = Math.min(DESKTOP_MIN_WIDTH, maxWidth)
    const minHeight = Math.min(DESKTOP_MIN_HEIGHT, maxHeight)
    return {
      width: Math.max(minWidth, Math.min(width, maxWidth)),
      height: Math.max(minHeight, Math.min(height, maxHeight)),
    }
  }

  const readSavedSize = () => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { width?: number; height?: number }
      if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return null
      return clampSize(parsed.width, parsed.height)
    } catch {
      return null
    }
  }

  const setClampedSize = (size: { width: number; height: number }) => {
    const next = clampSize(size.width, size.height)
    sizeRef.current = next
    setPanelSize(next)
    return next
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isDesktopResizableViewport()) {
      sizeRef.current = null
      setPanelSize(null)
      return
    }
    const initial = readSavedSize() ?? clampSize(DESKTOP_DEFAULT_WIDTH, DESKTOP_DEFAULT_HEIGHT)
    setClampedSize(initial)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onWindowResize = () => {
      if (!isDesktopResizableViewport()) {
        pointerIdRef.current = null
        resizeStartRef.current = null
        sizeRef.current = null
        setIsResizing(false)
        setPanelSize(null)
        return
      }
      const current = sizeRef.current ?? readSavedSize() ?? {
        width: DESKTOP_DEFAULT_WIDTH,
        height: DESKTOP_DEFAULT_HEIGHT,
      }
      setClampedSize(current)
    }

    window.addEventListener("resize", onWindowResize)
    return () => window.removeEventListener("resize", onWindowResize)
  }, [])

  useEffect(() => {
    sizeRef.current = panelSize
  }, [panelSize])

  useEffect(() => {
    if (!isResizing) return

    const onPointerMove = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return
      const start = resizeStartRef.current
      if (!start) return
      const deltaX = start.pointerX - event.clientX
      const deltaY = start.pointerY - event.clientY
      setClampedSize({
        width: start.width + deltaX,
        height: start.height + deltaY,
      })
    }

    const onPointerUp = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return
      const handle = panelRef.current?.querySelector<HTMLElement>(".factofit-advisor-resize-handle")
      if (handle && pointerIdRef.current !== null && handle.hasPointerCapture(pointerIdRef.current)) {
        handle.releasePointerCapture(pointerIdRef.current)
      }
      pointerIdRef.current = null
      resizeStartRef.current = null
      setIsResizing(false)
      document.body.classList.remove("factofit-advisor-resizing")

      if (sizeRef.current) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sizeRef.current))
      }
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [isResizing])

  useEffect(() => {
    return () => {
      document.body.classList.remove("factofit-advisor-resizing")
    }
  }, [])

  const onResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!panelSize) return
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    resizeStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: panelSize.width,
      height: panelSize.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add("factofit-advisor-resizing")
    setIsResizing(true)
  }

  const renderedScreen = useMemo(() => {
    if (screen === "dashboard") {
      return <DashboardScreen onMove={onScreenChange} onClose={onClose} />
    }
    if (screen === "advisor") {
      return <AiAdvisorHomeScreen onMove={onScreenChange} onClose={onClose} />
    }
    if (screen === "roi") return <RoiScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "support") return <SupportScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "draft") return <DraftScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "company") return <CompanyScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "safety") return <SafetyScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "intro") return <IntroScreen onMove={onScreenChange} onClose={onClose} />
    return <HomeScreen onMove={onScreenChange} onClose={onClose} />
  }, [screen, onScreenChange, onClose])

  return (
    <div
      ref={panelRef}
      className={`factofit-advisor-panel${panelSize ? " is-desktop-resizable" : ""}${isResizing ? " is-resizing" : ""}`}
      style={
        panelSize
          ? {
              width: `${panelSize.width}px`,
              height: `${panelSize.height}px`,
            }
          : undefined
      }
    >
      {renderedScreen}
      {panelSize && (
        <button
          type="button"
          className="factofit-advisor-resize-handle"
          aria-label="패널 크기 조절"
          onPointerDown={onResizePointerDown}
        />
      )}
    </div>
  )
}
