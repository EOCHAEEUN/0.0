import { useState } from "react"

type DialogType =
  | "why"
  | "services"
  | "dashboard"
  | "support"
  | "newsletter"
  | null

type MainDialogProps = {
  type: DialogType
  onClose: () => void
  onLoginClick: () => void
}

export default function MainDialog({
  type,
  onClose,
  onLoginClick,
}: MainDialogProps) {
  if (!type) return null

  const isNewsletter = type === "newsletter"

  return (
    <div
      className={isNewsletter ? "ff-alert-overlay" : "ff-dialog-overlay"}
      onClick={onClose}
    >
      <section
        className={isNewsletter ? "ff-alert-panel" : "ff-dialog-panel"}
        onClick={(event) => event.stopPropagation()}
      >
        {!isNewsletter && (
          <button type="button" className="ff-dialog-close" onClick={onClose}>
            ×
          </button>
        )}

        {type === "why" && <WhyFactoFitDialog />}
        {type === "services" && <ServicesDialog />}
        {type === "dashboard" && (
          <DashboardDialog onLoginClick={onLoginClick} />
        )}
        {type === "support" && <SupportDialog />}
        {type === "newsletter" && <NewsletterDialog onClose={onClose} />}
      </section>
    </div>
  )
}

function WhyFactoFitDialog() {
  return (
    <div className="ff-dialog-content">
      <div className="ff-dialog-title-row">
        <div>
          <div className="ff-gold-line" />
          <p className="ff-section-label">WHY FACTOFIT</p>
          <h2>
            지원사업은 많습니다.
            <br />
            문제는 우리 공장에 맞게
            <br />
            판단하기 어렵다는 것입니다.
          </h2>
        </div>

        <p className="ff-dialog-side-desc">
          팩토핏은 제조기업이 흩어진 공고를 직접 찾는 방식에서 벗어나,
          설비 노후도·에너지 비용·불량률을 먼저 읽고 투자 판단과 지원사업
          매칭을 함께 보여주는 AI 의사결정 에이전트입니다.
        </p>
      </div>

      <div className="ff-why-problem-grid">
        <article className="ff-why-problem-card blue">
          <h3>정보 분산</h3>
          <p>
            KIAT, 에너지공단, KOTRA, KICOX 등 기관별 공고를 담당자가 직접
            찾아야 해 놓치기 쉽습니다.
          </p>
        </article>

        <article className="ff-why-problem-card orange">
          <h3>자격 판단 어려움</h3>
          <p>
            업종, 지역, 종업원 수, 설비 종류, 투자 목적에 따라 받을 수 있는
            사업이 달라집니다.
          </p>
        </article>

        <article className="ff-why-problem-card green">
          <h3>투자 결정 부담</h3>
          <p>
            대표와 담당자는 “교체해야 하나?”를 먼저 고민합니다. 팩토핏은
            ROI와 실부담금부터 보여줍니다.
          </p>
        </article>
      </div>

      <div className="ff-why-flow-card">
        <div>
          <h3>기존 방식</h3>
          <p>
            기관별 사이트 접속 → 공고 검색 → 조건 해석 → 엑셀 계산 → 신청서 작성
          </p>
        </div>

        <span>→</span>

        <div>
          <h3>팩토핏 방식</h3>
          <p>
            기업·설비 정보 입력 → AI 분석 → ROI 계산 → 지원사업 매칭 → 신청서
            초안 생성
          </p>
        </div>
      </div>
    </div>
  )
}

function ServicesDialog() {
  const serviceRows = [
    [
      "투자 실패를 줄입니다",
      "설비 교체가 필요한지 먼저 판단합니다.",
      "ROI 분석 시뮬레이션",
      "투자금, 지원금 적용 후 실부담, 회수기간, 예상 ROI를 계산합니다.",
    ],
    [
      "제조기업의 시간을 아낍니다",
      "담당자가 여러 사이트를 뒤지는 시간을 줄입니다.",
      "지원사업 자동 매칭",
      "업종·지역·설비·투자 목적에 맞는 정부지원사업을 추천합니다.",
    ],
    [
      "숨은 지원금을 찾아냅니다",
      "놓치기 쉬운 공고와 마감일을 함께 보여줍니다.",
      "지원사업 캘린더",
      "D-day, 적합도, 예상 확보 금액을 기준으로 정리합니다.",
    ],
    [
      "데이터 기반 의사결정을 돕습니다",
      "현장 데이터를 보고서형 결과로 바꿉니다.",
      "신청서 초안 생성",
      "기업 정보와 분석 결과를 바탕으로 신청서 항목 초안을 생성합니다.",
    ],
    [
      "지속가능한 제조업을 만듭니다",
      "운영 리스크를 사전에 관리합니다.",
      "안전점검 관리 · 알림",
      "KTL, KOSHA 등 점검 리스크와 마감 알림을 제공합니다.",
    ],
  ]

  const steps = [
    ["STEP 01", "기업·설비 입력", "업종, 지역, 설비 연식, 에너지 비용, 불량률 입력"],
    ["STEP 02", "AI 해석", "제조업 조건과 설비 상태를 자동 분석"],
    ["STEP 03", "ROI 분석", "실부담금과 회수기간 계산"],
    ["STEP 04", "지원사업 추천", "기관별 공고를 적합도순으로 매칭"],
    ["STEP 05", "신청·알림", "신청서 초안과 D-day 알림 제공"],
  ]

  return (
    <div className="ff-dialog-content">
      <div className="ff-dialog-title-row">
        <div>
          <div className="ff-gold-line" />
          <p className="ff-section-label">CORE SERVICES</p>
          <h2>
            주요 서비스는
            <br />
            팩토핏의 가치와 1:1로
            <br />
            연결됩니다.
          </h2>
        </div>

        <p className="ff-dialog-side-desc">
          정부지원금 매칭, ROI 분석, 신청서 초안, 안전점검, 알림 기능이
          사용자의 실제 의사결정 플로우를 따라 이어집니다.
        </p>
      </div>

      <div className="ff-service-flow-table">
        {serviceRows.map(([leftTitle, leftDesc, rightTitle, rightDesc]) => (
          <div className="ff-service-flow-row" key={leftTitle}>
            <div>
              <h3>{leftTitle}</h3>
              <p>{leftDesc}</p>
            </div>

            <span>→</span>

            <div>
              <h3>{rightTitle}</h3>
              <p>{rightDesc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="ff-service-step-box">
        {steps.map(([step, title, desc]) => (
          <article className="ff-service-step-card" key={step}>
            <span>{step}</span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function DashboardDialog({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="ff-dialog-content">
      <div className="ff-dialog-title-row">
        <div>
          <div className="ff-gold-line" />
          <p className="ff-section-label">DASHBOARD EXPERIENCE</p>
          <h2>
            대시보드는
            <br />
            결과 확인 이후의
            <br />
            실행 공간입니다.
          </h2>
        </div>

        <p className="ff-dialog-side-desc">
          메인에서는 로그인 전/후 차이를 보여주고, 이 팝업에서는 로그인 후
          실제로 어떤 관리가 가능해지는지 더 구체적으로 설명합니다.
        </p>
      </div>

      <div className="ff-dashboard-dialog-visual-grid">
        <article className="ff-dashboard-dialog-visual-card">
          <div className="ff-dashboard-dialog-card-top">
            <div className="ff-dashboard-icon-box ff-dashboard-icon-bars">
              <i />
              <i />
              <i />
            </div>

            <div className="ff-dashboard-mini-bars">
              <i style={{ height: "58%" }} />
              <i style={{ height: "76%" }} />
              <i style={{ height: "92%" }} />
            </div>
          </div>

          <div className="ff-dashboard-dialog-card-value">
            <strong>85%</strong>
            <span>저장 준비도</span>
          </div>

          <h3>분석 결과 저장</h3>
          <p>기업별·설비별로 분석 기록을 남기고 다음 비교에 바로 이어갑니다.</p>
        </article>

        <article className="ff-dashboard-dialog-visual-card">
          <div className="ff-dashboard-dialog-card-top">
            <div className="ff-dashboard-icon-box ff-dashboard-icon-calendar">
              <b />
              <span />
            </div>

            <div className="ff-dashboard-mini-calendar">
              <strong>D-30</strong>
              <span>마감</span>
            </div>
          </div>

          <div className="ff-dashboard-dialog-card-value">
            <strong>7건</strong>
            <span>관리 중인 공고</span>
          </div>

          <h3>지원사업 일정 관리</h3>
          <p>마감일, 적합도, 예상 확보금액을 일정 흐름으로 정리합니다.</p>
        </article>

        <article className="ff-dashboard-dialog-visual-card">
          <div className="ff-dashboard-dialog-card-top">
            <div className="ff-dashboard-icon-box ff-dashboard-icon-doc">
              <i />
              <i />
              <em />
            </div>

            <div className="ff-dashboard-mini-checklist">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="ff-dashboard-dialog-card-value">
            <strong>73%</strong>
            <span>신청 준비도</span>
          </div>

          <h3>신청 준비 연결</h3>
          <p>초안 생성과 준비 상태 체크를 통해 실행 단계로 빠르게 넘어갑니다.</p>
        </article>

        <article className="ff-dashboard-dialog-visual-card">
          <div className="ff-dashboard-dialog-card-top">
            <div className="ff-dashboard-icon-box ff-dashboard-icon-shield">
              <span />
            </div>

            <div className="ff-dashboard-mini-risk-ring">
              <strong>72</strong>
            </div>
          </div>

          <div className="ff-dashboard-dialog-card-value">
            <strong>72</strong>
            <span>리스크 점수</span>
          </div>

          <h3>안전점검 알림 허브</h3>
          <p>점검 일정과 인증 리스크를 한곳에서 묶어 관리합니다.</p>
        </article>
      </div>

      <div className="ff-dashboard-dialog-timeline">
        <div>
          <strong>01</strong>
          <span>결과 저장</span>
        </div>
        <div>
          <strong>02</strong>
          <span>일정 연결</span>
        </div>
        <div>
          <strong>03</strong>
          <span>신청 준비</span>
        </div>
        <div>
          <strong>04</strong>
          <span>안전 알림</span>
        </div>
      </div>

      <div className="ff-dashboard-dialog-cta">
        <div>
          <strong>핵심은 메인에서 보고, 대시보드에선 실행으로 이어갑니다.</strong>
          <p>
            한 번 분석한 결과를 저장하고, 지원사업·신청서·안전점검을 끊기지
            않는 흐름으로 관리합니다.
          </p>
        </div>

        <button type="button" onClick={onLoginClick}>
          로그인하고 시작하기
        </button>
      </div>
    </div>
  )
}

function SupportDialog() {
  const supportEmail = "factofit.team@example.com"
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  const faqs = [
    {
      question: "지원사업 추천 기준은 무엇인가요?",
      answer:
        "FactoFit은 기업의 업종, 지역, 종업원 수, 설비 상태, 투자 목적을 기준으로 현재 조건에 맞는 지원사업을 우선 추천합니다. 단순 공고 나열이 아니라 우리 공장에 맞는 가능성을 먼저 보여주는 방식입니다.",
    },
    {
      question: "ROI 분석 결과는 실제 확정 금액인가요?",
      answer:
        "ROI 분석 결과는 입력한 설비 비용, 예상 지원금, 절감액, 불량률 개선 효과를 바탕으로 계산한 예측값입니다. 실제 지원금 확정 금액은 기관 심사와 신청 결과에 따라 달라질 수 있습니다.",
    },
    {
      question: "신청서 초안은 어디까지 자동 작성되나요?",
      answer:
        "기업 기본정보, 설비 교체 목적, 기대효과, 투자 필요성 등 반복적으로 작성해야 하는 항목을 초안 형태로 정리합니다. 최종 제출 전에는 담당자가 공고 양식에 맞게 검토하고 보완해야 합니다.",
    },
    {
      question: "기업정보와 설비정보는 저장되나요?",
      answer:
        "로그인 후에는 대시보드에서 기업정보, 설비 분석 기록, 저장한 지원사업, 신청 준비 상태를 이어서 관리할 수 있도록 설계하고 있습니다. 개인정보와 기업 데이터는 서비스 정책에 따라 안전하게 관리되는 흐름을 목표로 합니다.",
    },
  ]

  return (
    <div className="ff-dialog-content ff-support-split">
      <div className="ff-dialog-title-row">
        <div>
          <div className="ff-gold-line" />
          <p className="ff-section-label">CUSTOMER SUPPORT</p>
          <h2>
            고객 지원
            <br />
            궁금한 흐름을
            <br />
            빠르게 확인합니다.
          </h2>
        </div>

        <p className="ff-dialog-side-desc">
          지원사업 추천 기준, ROI 분석 결과, 신청서 초안, 기업·설비정보 관리
          방식처럼 FactoFit 사용 중 자주 확인하는 내용을 정리했습니다. 추가
          문의는 이메일로 연결됩니다.
        </p>
      </div>

      <div className="ff-support-split-layout">
        <section className="ff-support-faq-panel">
          <div className="ff-support-panel-head">
            <span>FAQ</span>
            <h3>고객센터</h3>
            <p>자주 하는 질문을 열어 답변을 바로 확인할 수 있습니다.</p>
          </div>

          <ul className="ff-support-accordion-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index

              return (
                <li
                  className={
                    isOpen
                      ? "ff-support-accordion-item is-open"
                      : "ff-support-accordion-item"
                  }
                  key={faq.question}
                >
                  <button
                    type="button"
                    className="ff-support-accordion-question"
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <b>Q</b>
                  </button>

                  {isOpen && (
                    <div className="ff-support-accordion-answer">
                      <b>A</b>
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="ff-support-contact-panel">
          <div className="ff-support-panel-head">
            <span>CONTACT</span>
            <h3>문의하기</h3>
            <p>도입 문의, 제휴 문의, 기술 문의는 아래 이메일로 보내주세요.</p>
          </div>

          <div className="ff-support-email-box">
            <small>문의 이메일</small>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </div>

          <p className="ff-support-contact-note">
            문의 시 회사명, 문의 목적, 현재 확인이 필요한 화면이나 기능을 함께
            남겨주시면 더 빠르게 확인할 수 있습니다.
          </p>
        </aside>
      </div>
    </div>
  )
}

function NewsletterDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="ff-newsletter-complete">
      <h2>구독이 완료되었습니다.</h2>
      <p>
        FactoFit Insights를 통해 제조업 지원사업과
        <br />
        설비투자 정보를 받아보실 수 있습니다.
      </p>

      <button type="button" onClick={onClose}>
        확인
      </button>
    </div>
  )
}