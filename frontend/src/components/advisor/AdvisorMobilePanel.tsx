import { useMemo } from "react"
import {
  COMPANY_REQUIRED,
  DRAFT_PROGRESS,
  QUICK_MENUS,
  ROI_REQUIREMENTS,
  ROI_RESULTS,
  SAFETY_ITEMS,
  SUPPORT_PROJECTS,
} from "./advisor.constants"
import type { AdvisorScreen } from "./advisor.types"

function BotVisual() {
  return (
    <div className="factofit-advisor-bot-visual">
      <div className="factofit-advisor-css-bot" aria-hidden="true">
        <span>AI</span>
      </div>
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

function ScreenFrame({
  title,
  subtitle,
  showBack = false,
  children,
  onBack,
  onClose,
}: {
  title: string
  subtitle?: string
  showBack?: boolean
  children: React.ReactNode
  onBack?: () => void
  onClose: () => void
}) {
  return (
    <section className="factofit-advisor-mobile-page">
      <section className="factofit-advisor-hero">
        <div className="factofit-advisor-hero-overlay" />

        <div className="factofit-advisor-hero-top">
          {showBack && (
            <button className="factofit-advisor-back-btn" type="button" onClick={onBack}>
              ‹
            </button>
          )}

          <span className="factofit-advisor-online-pill">
            <i />
            온라인
          </span>

          <button className="factofit-advisor-close-btn" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="factofit-advisor-brand">
          <span className="factofit-advisor-f-logo">F</span>
          <div>
            <strong>FactoFit</strong>
            <small>Manufacturing AI Advisor</small>
          </div>
        </div>

        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </section>

      <section className="factofit-advisor-white-sheet">{children}</section>

      <nav className="factofit-advisor-bottom-nav">
        <button className="active" type="button">
          <span>⌂</span>
          홈
        </button>
        <button type="button">
          <span>☏</span>
          대화
        </button>
        <button type="button">
          <span>⚙</span>
          설정
        </button>
      </nav>
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
    <ScreenFrame
      title="안녕하세요, FactoFit입니다."
      subtitle="무엇을 도와드릴까요?"
      onClose={onClose}
    >
      <div className="factofit-advisor-intro-card">
        <div className="factofit-advisor-intro-bot">
          <span>AI</span>
        </div>
        <div>
          <h2>FactoFit AI가 도와드려요</h2>
          <p>
            제조기업의 성장을 위해 ROI 분석, 지원사업 매칭, 신청서 작성까지
            빠르고 정확하게 안내해 드립니다. 😊
          </p>
        </div>
        <div className="factofit-advisor-illustration">▤</div>
      </div>

      <section className="factofit-advisor-section">
        <h3>빠른 문의</h3>
        <div className="factofit-advisor-quick-grid">
          {QUICK_MENUS.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              onClick={() => onMove(item.id)}
            >
              <i>{item.icon}</i>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <PrimaryCta onClick={() => onMove("company")}>
        회원가입하고 맞춤 상담 시작
      </PrimaryCta>

      <article className="factofit-advisor-message-card">
        <span>🔔</span>
        <div>
          <h4>읽지 않은 메시지가 있어요</h4>
          <p>빠르게 확인하고 문의를 이어가세요.</p>
        </div>
        <b>2</b>
        <em>›</em>
      </article>

      <article className="factofit-advisor-contact-card">
        <div>
          <h4>다른 방법으로 문의</h4>
          <p>전화 상담 또는 이메일 문의를 이용해보세요.</p>
        </div>
        <div>
          <button type="button">채팅 문의</button>
          <button type="button">이메일 문의</button>
          <button type="button">전화 상담</button>
        </div>
      </article>
    </ScreenFrame>
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
        <span>盾</span>
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
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
    >
      <div className="factofit-advisor-title-block">
        <div>
          <h2>ROI 분석이란?</h2>
          <p>
            설비 교체/개선 투자에 대해 예상 투자비, 회수기간, 절감효과를
            분석해드려요.
          </p>
        </div>
        <BotVisual />
      </div>

      <section className="factofit-advisor-section">
        <h3>
          <span>▤</span>
          이런 정보를 바탕으로 분석해요
        </h3>
        <div className="factofit-advisor-chip-grid">
          {ROI_REQUIREMENTS.map((item) => (
            <article key={item.title}>
              <i>{item.icon}</i>
              <b>{item.title}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="factofit-advisor-section">
        <h3>
          <span>▥</span>
          분석 결과로 확인할 수 있어요
        </h3>
        <div className="factofit-advisor-result-grid">
          {ROI_RESULTS.map((item) => (
            <article key={item.title}>
              <i>{item.icon}</i>
              <div>
                <b>{item.title}</b>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <PrimaryCta onClick={() => onMove("company")}>ROI 분석 시작하기</PrimaryCta>

      <SecondaryCta onClick={() => onMove("company")}>
        기업정보 먼저 입력하기
      </SecondaryCta>

      <article className="factofit-advisor-check-card">
        <div>
          <h4>분석 전 체크</h4>
          <ul>
            <li>
              필수 정보 입력 <span>정확한 분석을 위해 정보를 입력 주세요.</span>
            </li>
            <li>
              설비 정보 저장 <span>입력한 정보는 안전하게 저장됩니다.</span>
            </li>
            <li>
              분석 결과는 대시보드에서 확인 <span>완료 후 다시 볼 수 있어요.</span>
            </li>
          </ul>
        </div>
        <div className="factofit-advisor-illustration">⌕</div>
      </article>
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
    >
      <div className="factofit-advisor-title-block">
        <div>
          <h2>우리 회사에 맞는 지원사업 추천</h2>
          <p>업종·지역·설비 상황을 바탕으로 추천사업을 선별해드려요.</p>
        </div>
        <BotVisual />
      </div>

      <section className="factofit-advisor-support-card">
        <h3>
          <span>◎</span>
          맞춤 추천 TOP 3
        </h3>

        {SUPPORT_PROJECTS.map((project) => (
          <article key={project.rank}>
            <div className="factofit-advisor-rank">{project.rank}</div>
            <div>
              <h4>{project.title}</h4>
              <p>ⓢ {project.subsidy}</p>
              <p>⌁ {project.effect}</p>
            </div>
            <div className="factofit-advisor-fit">
              <span>적합도 {project.fit}</span>
              <em>›</em>
              <div>
                {project.tags.map((tag) => (
                  <b key={tag}>{tag}</b>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

      <PrimaryCta onClick={() => onMove("company")}>
        회원가입하고 추천 더 보기
      </PrimaryCta>

      <section className="factofit-advisor-section">
        <h3>
          <span>ϟ</span>
          빠른 추천 예시
        </h3>
        <div className="factofit-advisor-mini-help-grid">
          <button type="button">스마트공장 추천</button>
          <button type="button">에너지 절감 지원</button>
          <button type="button">정책자금 찾기</button>
          <button type="button">신청 준비 안내</button>
        </div>
      </section>
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
  return (
    <ScreenFrame
      title="신청서 초안 생성"
      subtitle="지원사업 신청에 필요한 초안을 빠르게 준비해드릴게요."
      showBack
      onBack={() => onMove("home")}
      onClose={onClose}
    >
      <div className="factofit-advisor-title-block draft">
        <div>
          <h2>신청서 초안 생성</h2>
          <p>지원사업 신청에 필요한 초안을 빠르게 준비해드릴게요.</p>
        </div>
        <BotVisual />
      </div>

      <section className="factofit-advisor-draft-summary">
        <div>
          <span>▥</span>
          <b>선택 사업</b>
          <p>스마트공장 지원사업</p>
        </div>
        <div>
          <span>♙</span>
          <b>기업명</b>
          <p>(주) 팩토핏</p>
        </div>
        <div>
          <span>⚙</span>
          <b>설비명</b>
          <p>CNC 가공 라인 자동화 시스템</p>
        </div>
        <div>
          <span>₩</span>
          <b>예상 지원금</b>
          <p>최대 200,000,000원</p>
        </div>
        <div>
          <span>◷</span>
          <b>초안 상태</b>
          <p><em>초안 준비중</em></p>
        </div>
      </section>

      <section className="factofit-advisor-draft-progress">
        <h3>
          초안 구성 진행 상황
          <span>3/5 완료</span>
        </h3>

        {DRAFT_PROGRESS.map((item) => (
          <article key={item.no} className={item.status}>
            <i>{item.status === "done" ? "✓" : item.no}</i>
            <b>{item.title}</b>
            <p>{item.description}</p>
            <em>{item.status === "done" ? "완료" : item.status === "writing" ? "작성중" : "대기"}</em>
          </article>
        ))}
      </section>

      <PrimaryCta onClick={() => onMove("company")}>신청서 초안 생성</PrimaryCta>

      <article className="factofit-advisor-tip-card">
        <span>💡</span>
        <div>
          <h4>생성된 초안은 이후 수정할 수 있어요.</h4>
          <p>필요 시 언제든 편집하고 다시 저장할 수 있습니다.</p>
        </div>
      </article>
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
    >
      <div className="factofit-advisor-title-block company">
        <div>
          <h2>기업정보 입력 도움</h2>
          <p>
            기업명, 업종, 지역, 직원 수, 연매출을 입력하면 우리 회사에 맞는 ROI
            분석과 지원사업 추천을 받을 수 있어요.
          </p>
        </div>
        <BotVisual />
      </div>

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

      <PrimaryCta onClick={() => onMove("home")} icon="♙">
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
    >
      <div className="factofit-advisor-title-block">
        <div>
          <h2>안전점검이란?</h2>
          <p>
            프레스·CNC·사출 설비의 안전점검 항목과 점검 주기, 우선 확인할
            내용을 간단히 안내해드려요.
          </p>
        </div>
        <BotVisual />
      </div>

      <section className="factofit-advisor-section">
        <h3>
          <span>盾</span>
          이런 항목을 확인해요
        </h3>
        <div className="factofit-advisor-chip-grid safety">
          {SAFETY_ITEMS.map((item) => (
            <article key={item.title}>
              <i>{item.icon}</i>
              <b>{item.title}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="factofit-advisor-section">
        <h3>
          <span>▥</span>
          이렇게 활용할 수 있어요
        </h3>
        <div className="factofit-advisor-result-grid">
          <article>
            <i>◎</i>
            <div>
              <b>오늘 점검 우선순위</b>
              <p>먼저 볼 항목 안내</p>
            </div>
          </article>
          <article>
            <i>▣</i>
            <div>
              <b>법정 점검 주기</b>
              <p>기한 놓치지 않기</p>
            </div>
          </article>
          <article>
            <i>▤</i>
            <div>
              <b>점검 기록 관리</b>
              <p>저장 후 다시 확인</p>
            </div>
          </article>
        </div>
      </section>

      <PrimaryCta onClick={() => onMove("company")} icon="盾">
        안전점검 시작하기
      </PrimaryCta>

      <SecondaryCta onClick={() => onMove("company")}>
        설비정보 먼저 입력하기
      </SecondaryCta>

      <article className="factofit-advisor-check-card safety">
        <div>
          <h4>점검 전 체크</h4>
          <ul>
            <li>
              지원 설비 확인 <span>프레스, CNC, 사출 설비만 지원해요.</span>
            </li>
            <li>
              점검일 저장 <span>정확한 주기 관리를 위해 저장해요.</span>
            </li>
            <li>
              결과는 대시보드에서 확인 <span>점검 결과를 한눈에 확인할 수 있어요.</span>
            </li>
          </ul>
          <p>현재 안전점검은 press · cnc · injection 설비를 지원해요.</p>
        </div>
        <div className="factofit-advisor-illustration">盾</div>
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
  const renderedScreen = useMemo(() => {
    if (screen === "roi") return <RoiScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "support") return <SupportScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "draft") return <DraftScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "company") return <CompanyScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "safety") return <SafetyScreen onMove={onScreenChange} onClose={onClose} />
    if (screen === "intro") return <IntroScreen onMove={onScreenChange} onClose={onClose} />
    return <HomeScreen onMove={onScreenChange} onClose={onClose} />
  }, [screen, onScreenChange, onClose])

  return <div className="factofit-advisor-panel">{renderedScreen}</div>
}
