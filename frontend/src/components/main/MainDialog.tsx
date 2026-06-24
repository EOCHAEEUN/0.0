import { useRef, useState, type PointerEvent } from "react"

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
  const valueCards = [
    {
      number: "01",
      label: "Policy Discovery",
      title: "흩어진 공고를 한곳으로",
      description:
        "기관별로 분산된 제조업 지원사업을 기업이 직접 찾아다니지 않아도 되도록 정리합니다.",
    },
    {
      number: "02",
      label: "Eligibility Fit",
      title: "우리 회사 조건으로 선별",
      description:
        "업종, 지역, 매출, 직원 수처럼 공고마다 다른 조건을 회사 정보 기준으로 먼저 걸러냅니다.",
    },
    {
      number: "03",
      label: "Equipment Context",
      title: "설비 상황까지 함께 판단",
      description:
        "설비 연식, 에너지 비용, 불량률, 유지보수비를 함께 읽어 추천 이유를 더 명확하게 만듭니다.",
    },
    {
      number: "04",
      label: "Action Ready",
      title: "신청 준비까지 연결",
      description:
        "지원사업 추천에서 끝나지 않고 ROI 분석, 신청서 초안, 일정 관리 흐름으로 이어집니다.",
    },
  ]

  return (
    <div className="ff-dialog-content ff-why-premium-dialog">
      <section className="ff-why-premium-hero">
        <div className="ff-why-premium-hero-copy">
          <div className="ff-gold-line" />
          <p className="ff-section-label">WHY FACTOFIT</p>

          <h2>
            흩어진 지원사업을 모아, 우리 회사에 맞는 기회로 바꿉니다.
          </h2>

          <p>
            FactoFit은 제조기업이 여러 기관의 공고를 직접 찾고, 복잡한 조건을
            하나씩 해석해야 했던 방식을 바꿉니다.
          </p>

          <p>
            업종, 지역, 매출, 직원 수, 설비 상태를 기준으로 받을 수 있는
            지원사업을 선별하고, ROI 분석부터 신청 준비까지 하나의 흐름으로
            연결합니다.
          </p>
        </div>

        <div className="ff-why-premium-hero-panel">
          <div className="ff-why-premium-orbit" aria-label="FactoFit matching signals">
            <span
              className="ff-why-premium-token is-roi"
              data-tip="회수기간과 예상 수익성을 계산합니다"
            >
              ROI
            </span>
            <span
              className="ff-why-premium-token is-policy"
              data-tip="회사 조건에 맞는 지원사업을 선별합니다"
            >
              POLICY
            </span>
            <span
              className="ff-why-premium-token is-data"
              data-tip="업종·지역·매출·설비 데이터를 함께 봅니다"
            >
              DATA
            </span>
          </div>

          <div className="ff-why-premium-signal-card">
            <small>FACTOFIT MATCHING</small>
            <strong>7건</strong>
            <span>조건 기반 추천사업</span>
          </div>

          <div className="ff-why-premium-signal-card">
            <small>EXPECTED SUPPORT</small>
            <strong>2.0억</strong>
            <span>예상 확보 가능 금액</span>
          </div>
        </div>
      </section>

      <section className="ff-why-premium-value-grid">
        {valueCards.map((card) => (
          <article className="ff-why-premium-value-card" key={card.number}>
            <div className="ff-why-premium-card-top">
              <span>{card.number}</span>
              <small>{card.label}</small>
            </div>

            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="ff-why-premium-flow">
        <article className="ff-why-premium-flow-card is-before">
          <span>기존 방식</span>
          <h3>담당자가 직접 찾고 해석합니다.</h3>
          <p>
            기관별 사이트 접속 → 공고 검색 → 조건 해석 → 엑셀 계산 → 신청서
            작성
          </p>
        </article>

        <div className="ff-why-premium-flow-bridge" aria-hidden="true">
          <span>→</span>
          <small>전환</small>
        </div>

        <article className="ff-why-premium-flow-card is-after">
          <span>FactoFit 방식</span>
          <h3>회사와 설비 기준으로 먼저 걸러냅니다.</h3>
          <p>
            기업·설비 정보 입력 → 맞춤 지원사업 선별 → ROI 분석 → 신청 준비
            연결
          </p>
        </article>
      </section>
    </div>
  )
}

function ServicesDialog() {
  const mockupTrackRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
  })

  const serviceCards = [
    {
      number: "01",
      label: "ROI Simulation",
      title: "투자 판단을 먼저 계산합니다",
      description:
        "설비 교체가 필요한지, 지원금 적용 후 실부담과 회수기간이 어떤지 먼저 보여줍니다.",
    },
    {
      number: "02",
      label: "Policy Matching",
      title: "지원사업을 자동 선별합니다",
      description:
        "업종, 지역, 매출, 직원 수, 설비 상태를 기준으로 받을 수 있는 공고를 정리합니다.",
    },
    {
      number: "03",
      label: "Application Draft",
      title: "신청 준비를 이어갑니다",
      description:
        "분석 결과와 기업 정보를 바탕으로 신청서 초안과 준비 체크리스트를 연결합니다.",
    },
    {
      number: "04",
      label: "Safety & Alert",
      title: "일정과 리스크를 관리합니다",
      description:
        "지원사업 마감일, 안전점검, 인증 리스크를 대시보드에서 끊기지 않게 관리합니다.",
    },
  ]

  const mockupFlow = [
    {
      step: "01",
      title: "메인",
      caption: "무료 AI 진단 시작",
      variant: "landing",
    },
    {
      step: "02",
      title: "AI 진단",
      caption: "기업·설비 입력",
      variant: "diagnosis",
    },
    {
      step: "03",
      title: "AI 추천",
      caption: "팝업 요약",
      variant: "ai",
    },
    {
      step: "04",
      title: "대시보드",
      caption: "요약 결과",
      variant: "dashboard",
    },
    {
      step: "05",
      title: "설비 추천",
      caption: "3D 설비·우선순위",
      variant: "equipment",
    },
    {
      step: "06",
      title: "지원사업",
      caption: "캘린더·D-Day",
      variant: "policy",
    },
    {
      step: "07",
      title: "ROI 시뮬레이션",
      caption: "A/B/C 비교",
      variant: "roi",
    },
    {
      step: "08",
      title: "신청서 생성",
      caption: "초안·체크리스트",
      variant: "draft",
    },
    {
      step: "09",
      title: "안전점검",
      caption: "KTL·KOSHA 리스크",
      variant: "safety",
    },
  ]

  const handleMockupPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const track = mockupTrackRef.current
    if (!track) return

    dragStateRef.current = {
      isDown: true,
      startX: event.clientX,
      scrollLeft: track.scrollLeft,
    }

    track.dataset.dragging = "true"
    track.setPointerCapture(event.pointerId)
  }

  const handleMockupPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const track = mockupTrackRef.current
    if (!track || !dragStateRef.current.isDown) return

    event.preventDefault()

    const walk = event.clientX - dragStateRef.current.startX
    track.scrollLeft = dragStateRef.current.scrollLeft - walk
  }

  const stopMockupDrag = (event: PointerEvent<HTMLDivElement>) => {
    const track = mockupTrackRef.current
    dragStateRef.current.isDown = false

    if (!track) return

    delete track.dataset.dragging

    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="ff-dialog-content ff-services-premium-dialog">
      <section className="ff-services-premium-hero">
        <div className="ff-services-premium-hero-copy">
          <div className="ff-gold-line" />
          <p className="ff-section-label">CORE SERVICES</p>

          <h2>
            주요 서비스는 기능이 아니라, 사용자의 실행 흐름으로 이어집니다.
          </h2>

          <p>
            FactoFit은 지원사업 매칭, ROI 분석, 신청서 초안, 안전점검을 각각
            따로 보여주지 않습니다. 기업과 설비 정보를 기준으로 사용자가 실제로
            움직이는 순서에 맞춰 연결합니다.
          </p>
        </div>

        <div className="ff-services-premium-hero-map" aria-hidden="true">
          <div className="ff-services-map-node is-active">
            <span>01</span>
            <strong>입력</strong>
          </div>
          <div className="ff-services-map-line" />
          <div className="ff-services-map-node">
            <span>02</span>
            <strong>분석</strong>
          </div>
          <div className="ff-services-map-line" />
          <div className="ff-services-map-node">
            <span>03</span>
            <strong>매칭</strong>
          </div>
          <div className="ff-services-map-line" />
          <div className="ff-services-map-node">
            <span>04</span>
            <strong>실행</strong>
          </div>
        </div>
      </section>

      <section className="ff-services-premium-card-grid">
        {serviceCards.map((card) => (
          <article className="ff-services-premium-card" key={card.number}>
            <div className="ff-services-premium-card-top">
              <span>{card.number}</span>
              <small>{card.label}</small>
            </div>

            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="ff-services-mockup-preview">
        <div className="ff-services-mockup-head">
          <div>
            <p className="ff-section-label">UX FLOW PREVIEW</p>
            <h3>
              AI 진단 이후의 실행 흐름까지,
              <br />
              한 번에 이어집니다.
            </h3>
          </div>

          <p>
            기업·설비 정보를 입력하면 지원사업 추천, ROI 계산, 신청서 초안,
            안전점검 알림까지 하나의 흐름으로 연결됩니다. 옆으로 넘기며
            FactoFit이 실제로 어떻게 작동하는지 확인해보세요.
          </p>
        </div>

        <div className="ff-services-mockup-guide">
          <span>Drag</span>
          <strong>마우스로 좌우로 밀어 전체 흐름 보기</strong>
          <em>→</em>

          <div className="ff-services-mockup-tooltip" role="tooltip">
            사용자 흐름을 보여주기 위한 임시 앱 화면입니다.
            <br />
            실제 서비스 화면은 웹 환경에 맞게 조정될 수 있습니다.
          </div>
        </div>

        <div
          ref={mockupTrackRef}
          className="ff-services-mockup-track"
          aria-label="FactoFit service mockup flow"
          onPointerDown={handleMockupPointerDown}
          onPointerMove={handleMockupPointerMove}
          onPointerUp={stopMockupDrag}
          onPointerCancel={stopMockupDrag}
          onPointerLeave={stopMockupDrag}
        >
          {mockupFlow.map((item) => (
            <article className="ff-services-mockup-card" key={item.step}>
              <div className="ff-services-mockup-title">
                <strong>
                  {item.step}. {item.title}
                </strong>
                <span>{item.caption}</span>
              </div>

              <ServiceMockupScreen variant={item.variant} />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function ServiceMockupScreen({ variant }: { variant: string }) {
  return (
    <div className={`ff-service-device ff-service-device-${variant}`}>
      <div className="ff-service-device-notch" />

      <div className="ff-service-device-screen">
        {variant === "landing" && (
          <div className="ff-mock-landing">
            <div className="ff-mock-hero-bg" />
            <div className="ff-mock-landing-copy">
              <small>FACTOFIT ONE-PAGE AI</small>
              <h4>
                설비투자 ROI와
                <br />
                <em>숨은 정부지원금</em>을
                <br />
                1분 만에 확인
              </h4>
              <p>노후 설비와 에너지 비용을 입력하면 투자 시나리오를 진단합니다.</p>
              <button type="button">무료 AI 진단 시작하기</button>
              <div className="ff-mock-proof-grid">
                <span>
                  <b>1분</b>
                  입력 시간
                </span>
                <span>
                  <b>7건</b>
                  매칭 사업
                </span>
                <span>
                  <b>2.0억</b>
                  확보 가능
                </span>
                <span>
                  <b>47.5%</b>
                  예상 ROI
                </span>
              </div>
            </div>
          </div>
        )}

        {variant === "diagnosis" && (
          <div className="ff-mock-light-screen">
            <MockTopBar title="FactoFit" subtitle="SMART FACTORY" />
            <div className="ff-mock-content">
              <span className="ff-mock-pill">STEP 01</span>
              <h4>한 번에 끝내는 제조기업 AI 진단</h4>
              <p>업종과 설비 정보를 입력하면 지원금·ROI·안전점검을 요약합니다.</p>
              <div className="ff-mock-chip-grid">
                <span className="is-active">프레스</span>
                <span>CNC</span>
                <span>검사</span>
                <span>포장</span>
              </div>
              <MockField label="설비명" value="유압 프레스 라인 A" />
              <MockField label="설비 연식" value="15년" />
              <MockField label="불량률" value="3.2%" />
              <MockField label="연간 에너지 비용" value="4,800만원" />
            </div>
          </div>
        )}

        {variant === "ai" && (
          <div className="ff-mock-ai-screen">
            <div className="ff-mock-ai-modal">
              <div className="ff-mock-ai-head">
                <span>AI</span>
                <div>
                  <h4>FactoFit AI</h4>
                  <p>대표님, 지금 확인해보세요!</p>
                </div>
              </div>
              <div className="ff-mock-ai-metric">
                <small>현재 신청 가능한 사업</small>
                <strong>8건</strong>
              </div>
              <div className="ff-mock-ai-kpis">
                <div>
                  <small>예상 지원금</small>
                  <strong>8,200</strong>
                </div>
                <div>
                  <small>예상 ROI</small>
                  <strong>98%</strong>
                </div>
              </div>
              <div className="ff-mock-ai-rank">
                <span>추천 1순위</span>
                <strong>스마트공장 고도화</strong>
              </div>
              <button type="button">대시보드 보기 →</button>
            </div>
          </div>
        )}

        {variant === "dashboard" && (
          <div className="ff-mock-light-screen">
            <MockTopBar title="FactoFit" subtitle="DASHBOARD" />
            <div className="ff-mock-content">
              <div className="ff-mock-dark-card">
                <small>FACTOFIT INTELLIGENCE</small>
                <h4>기업 조건에 맞는 지원사업을 AI가 매칭</h4>
                <p>지원금 · ROI · 신청 우선순위를 함께 분석합니다.</p>
              </div>
              <div className="ff-mock-kpi-grid">
                <MockKpi label="예상 지원금" value="8,200" />
                <MockKpi label="추천 지원사업" value="8건" />
                <MockKpi label="예상 ROI" value="98%" wide />
              </div>
              <div className="ff-mock-summary-row">
                <strong>AI 추천 요약</strong>
                <span>회수기간 1.3년</span>
              </div>
            </div>
            <MockNav active="홈" />
          </div>
        )}

        {variant === "equipment" && (
          <div className="ff-mock-light-screen">
            <MockTopBar title="설비 추천" subtitle="EQUIPMENT PRIORITY" />
            <div className="ff-mock-content">
              <span className="ff-mock-pill">S등급 96%</span>
              <h4>프레스 성형 라인 교체 우선 대상</h4>
              <p>노후도·불량률·에너지 비용 기준으로 먼저 검토할 설비입니다.</p>
              <div className="ff-mock-machine-card">
                <div className="ff-mock-machine-art">
                  <div className="ff-mock-press">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <span className="ff-mock-priority-pill">우선순위 03 · S등급 96%</span>
                <div className="ff-mock-kpi-grid">
                  <MockKpi label="예상 지원금" value="5,000" />
                  <MockKpi label="예상 ROI" value="347%" />
                </div>
              </div>
            </div>
            <MockNav active="설비" />
          </div>
        )}

        {variant === "policy" && (
          <div className="ff-mock-light-screen">
            <MockTopBar title="지원사업" subtitle="POLICY MATCHING" />
            <div className="ff-mock-content">
              <h4>마감일과 확보 가능 금액을 한눈에</h4>
              <p>월별 마감 건수와 주요 공고를 확인합니다.</p>
              <div className="ff-mock-month-grid">
                {["7월", "8월", "9월", "10월", "11월", "12월"].map((month, index) => (
                  <div key={month}>
                    <small>{month}</small>
                    <strong>{[1, 2, 1, 0, 2, 1][index]}</strong>
                  </div>
                ))}
              </div>
              <MockPolicy title="KIAT 스마트 제조혁신" dday="D-42" />
              <MockPolicy title="에너지효율 노후설비 교체" dday="D-67" />
            </div>
            <MockNav active="사업" />
          </div>
        )}

        {variant === "roi" && (
          <div className="ff-mock-light-screen">
            <MockTopBar title="ROI 분석" subtitle="SCENARIO SIMULATION" />
            <div className="ff-mock-content">
              <div className="ff-mock-roi-card">
                <h4>AI 최종 권장안: 시나리오 A</h4>
                <p>고효율 프레스 전체 교체안이 지원사업 매칭과 장기 절감 효과가 가장 높습니다.</p>
                <div className="ff-mock-roi-mini-grid">
                  <span>지원금 <b>12,400</b></span>
                  <span>실부담 <b>5,600</b></span>
                  <span>ROI <b>47.5%</b></span>
                  <span>회수 <b>2.1년</b></span>
                </div>
              </div>

              <div className="ff-mock-scenario-grid">
                <span className="is-active">시나리오 A<small>전체 교체</small></span>
                <span>시나리오 B<small>부분 정비</small></span>
                <span>시나리오 C<small>모니터링</small></span>
              </div>

              <div className="ff-mock-bars">
                <strong>AI 추천 근거</strong>
                <label>노후도 <i style={{ width: "92%" }} /></label>
                <label>에너지 <i style={{ width: "81%" }} /></label>
                <label>지원금 <i style={{ width: "95%" }} /></label>
              </div>

              <div className="ff-mock-next-action">
                <strong>다음 실행</strong>
                <div>
                  <span>시나리오 저장</span>
                  <span>신청서 초안 생성</span>
                </div>
              </div>
            </div>
            <MockNav active="ROI" />
          </div>
        )}

        {variant === "draft" && (
          <div className="ff-mock-light-screen">
            <MockTopBar title="신청 준비" subtitle="APPLICATION DRAFT" />
            <div className="ff-mock-content">
              <h4>지원사업 신청서 초안을 자동 생성</h4>
              <p>기업 정보와 ROI 결과를 바탕으로 필수 항목을 정리합니다.</p>
              <div className="ff-mock-doc-card">
                <strong>스마트공장 고도화 사업</strong>
                <p>프레스 라인 교체와 에너지 효율 개선 효과 중심으로 작성</p>
                <span>신청기관 <b>KIAT / 산단공 연계</b></span>
                <span>준비도 <b>87%</b></span>
                <span>누락서류 <b>견적서 1건</b></span>
              </div>
              <div className="ff-mock-checklist-card">
                <strong>필수 서류 체크리스트</strong>
                <span>사업자등록증 <b>완료</b></span>
                <span>설비 견적서 <b>필요</b></span>
                <span>에너지 사용 내역 <b>완료</b></span>
              </div>
            </div>
            <MockNav active="신청" />
          </div>
        )}

        {variant === "safety" && (
          <div className="ff-mock-light-screen">
            <MockTopBar title="안전점검" subtitle="SAFETY COPILOT" />
            <div className="ff-mock-content">
              <div className="ff-mock-score-card">
                <small>AI 안전점검 점수</small>
                <strong>72점</strong>
                <p>화학물질 안전점검과 KOSHA 등록 항목을 우선 확인해야 합니다.</p>
              </div>
              <div className="ff-mock-risk-grid">
                <MockKpi label="미이행" value="3" />
                <MockKpi label="만료 예정" value="2" />
              </div>
              <MockTask title="KOSHA 화학물질 안전점검" status="긴급" />
              <MockTask title="KTL 인증 유효기간 확인" status="30일 내" />
              <MockTask title="정기점검 캘린더 등록" status="등록" />
            </div>
            <MockNav active="안전" />
          </div>
        )}
      </div>
    </div>
  )
}

function MockTopBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="ff-mock-topbar">
      <div>
        <b>F</b>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </div>
      <em>•••</em>
    </div>
  )
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div className="ff-mock-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MockKpi({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? "ff-mock-kpi is-wide" : "ff-mock-kpi"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MockPolicy({ title, dday }: { title: string; dday: string }) {
  return (
    <div className="ff-mock-policy-row">
      <span>{dday}</span>
      <strong>{title}</strong>
      <i />
    </div>
  )
}

function MockTask({ title, status }: { title: string; status: string }) {
  return (
    <div className="ff-mock-task-row">
      <strong>{title}</strong>
      <span>{status}</span>
    </div>
  )
}

function MockNav({ active }: { active: string }) {
  return (
    <div className="ff-mock-nav">
      {["홈", "설비", "사업", "ROI"].map((item) => (
        <span className={item === active ? "is-active" : ""} key={item}>
          {item}
        </span>
      ))}
    </div>
  )
}

function DashboardDialog({ onLoginClick }: { onLoginClick: () => void }) {
  const dashboardCards = [
    {
      number: "01",
      metric: "85%",
      metricLabel: "저장 준비도",
      label: "Analysis Archive",
      title: "분석 결과 저장",
      description:
        "기업별·설비별 분석 기록을 남기고 다음 비교와 의사결정에 바로 이어갑니다.",
    },
    {
      number: "02",
      metric: "7건",
      metricLabel: "관리 중인 공고",
      label: "Policy Calendar",
      title: "지원사업 일정 관리",
      description:
        "마감일, 적합도, 예상 확보금액을 기준으로 지원사업 일정을 정리합니다.",
    },
    {
      number: "03",
      metric: "73%",
      metricLabel: "신청 준비도",
      label: "Application Ready",
      title: "신청 준비 연결",
      description:
        "신청서 초안, 준비 서류, 누락 항목을 체크하며 실행 단계로 빠르게 넘어갑니다.",
    },
    {
      number: "04",
      metric: "72",
      metricLabel: "리스크 점수",
      label: "Safety Hub",
      title: "안전점검 알림 허브",
      description:
        "점검 일정과 인증 리스크를 한곳에서 묶어 관리하고 놓치기 쉬운 항목을 알려줍니다.",
    },
  ]

  return (
    <div className="ff-dialog-content ff-dashboard-premium-dialog">
      <section className="ff-dashboard-premium-hero">
        <div className="ff-dashboard-premium-hero-copy">
          <div className="ff-gold-line" />
          <p className="ff-section-label">DASHBOARD EXPERIENCE</p>

          <h2>
            분석 결과는 저장되고,
            <br />
            실행은 대시보드에서 이어집니다.
          </h2>

          <p>
            메인에서는 AI 진단 결과의 핵심을 빠르게 확인하고, 로그인 후에는
            기업별 분석 기록, 지원사업 일정, 신청 준비, 안전점검 알림을 하나의
            실행 공간에서 관리합니다.
          </p>
        </div>

        <div className="ff-dashboard-premium-panel" aria-hidden="true">
          <div className="ff-dashboard-premium-topbar">
            <div>
              <span>F</span>
              <strong>FactoFit Dashboard</strong>
            </div>
            <em>Live</em>
          </div>

          <div className="ff-dashboard-premium-intel-card">
            <small>FACTOFIT INTELLIGENCE</small>
            <h3>기업 조건에 맞는 실행 항목을 한곳에 정리합니다.</h3>
            <p>ROI · 지원사업 · 신청 준비 · 안전점검을 이어서 관리합니다.</p>
          </div>

          <div className="ff-dashboard-premium-mini-grid">
            <div>
              <small>예상 지원금</small>
              <strong>8,200</strong>
            </div>
            <div>
              <small>추천사업</small>
              <strong>7건</strong>
            </div>
            <div className="is-wide">
              <small>다음 실행</small>
              <strong>신청서 초안 생성</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="ff-dashboard-premium-card-grid">
        {dashboardCards.map((card) => (
          <article className="ff-dashboard-premium-card" key={card.number}>
            <div className="ff-dashboard-premium-card-top">
              <span>{card.number}</span>
              <small>{card.label}</small>
            </div>

            <div className="ff-dashboard-premium-metric">
              <strong>{card.metric}</strong>
              <span>{card.metricLabel}</span>
            </div>

            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="ff-dashboard-premium-cta">
        <div>
          <strong>핵심은 메인에서 보고, 대시보드에서는 실행으로 이어갑니다.</strong>
          <p>
            한 번 분석한 결과를 저장하고, 지원사업·신청서·안전점검을 끊기지
            않는 흐름으로 관리합니다.
          </p>
        </div>

        <button type="button" onClick={onLoginClick}>
          로그인하고 시작하기
        </button>
      </section>
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