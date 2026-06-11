import { useState } from "react"
import { useNavigate } from "react-router-dom"
import MainHeader from "../components/main/MainHeader"
import MainDialog from "../components/main/MainDialog"
import "./MainPage.css"

type DialogType =
  | "why"
  | "services"
  | "dashboard"
  | "support"
  | "newsletter"
  | null

export default function MainPage() {
  const navigate = useNavigate()
  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [newsletterEmail, setNewsletterEmail] = useState("")

  const handleNewsletterSubmit = () => {
    setDialogType("newsletter")
    setNewsletterEmail("")
  }

  return (
    <main className="ff-main-page">
      <MainHeader
        onLoginClick={() => navigate("/login")}
        onWhyClick={() => setDialogType("why")}
        onServicesClick={() => setDialogType("services")}
        onDashboardClick={() => setDialogType("dashboard")}
        onSupportClick={() => setDialogType("support")}
      />

      <section className="ff-hero-section">
        <div className="ff-hero-video-placeholder" />

        <div className="ff-hero-content">
          <p className="ff-hero-kicker">FACTOFIT ONE-PAGE AI DIAGNOSIS</p>

          <h1>
            우리 공장의 설비투자 ROI와
            <br />
            <span>숨은 정부 지원금</span>을 1분 만에
            <br />
            확인하세요
          </h1>

          <p className="ff-hero-description">
            노후 설비·에너지 비용·불량률을 입력하면 AI가 투자 시나리오,
            예상 지원금, 회수기간, 안전점검 리스크까지 한 번에 진단합니다.
          </p>

          <div className="ff-hero-metrics">
            <div>
              <strong>1분</strong>
              <span>진단 입력 시간</span>
            </div>
            <div>
              <strong>7건</strong>
              <span>매칭 지원사업</span>
            </div>
            <div>
              <strong>2.0억</strong>
              <span>예상 확보 가능 금액</span>
            </div>
            <div>
              <strong>47.5%</strong>
              <span>예상 ROI</span>
            </div>
          </div>
        </div>

        <div className="ff-scroll-arrow">↓</div>
      </section>

      <section className="ff-why-teaser-section">
        <div className="ff-why-teaser-media" />

        <div className="ff-section-container">
          <div className="ff-why-teaser-copy">
            <p className="ff-section-label">WHY FACTOFIT</p>

            <h2>
              지원사업을 찾기 전에,
              <br />
              우리 공장에 맞게
              <br />
              먼저 해석합니다.
            </h2>

            <p>
              흩어진 제조업 지원정보를 모아 지원사업 추천, ROI 분석,
              신청 준비까지 하나의 흐름으로 연결합니다.
            </p>

            <button
              type="button"
              className="ff-pill-button"
              onClick={() => setDialogType("why")}
            >
              Why FactoFit 자세히 보기
            </button>
          </div>
        </div>
      </section>

      <section className="ff-business-section">
        <div className="ff-wide-container">
          <div className="ff-business-head">
            <h2>OUR BUSINESS</h2>

            <button
              type="button"
              className="ff-pill-button"
              onClick={() => setDialogType("services")}
            >
              주요서비스 보기
            </button>
          </div>

          <div className="ff-business-card-grid">
            <button
              type="button"
              className="ff-business-card"
              onClick={() => setDialogType("services")}
            >
              <div className="ff-business-media ff-business-media-1" />
              <div className="ff-business-card-copy">
                <span>ROI 분석</span>
                <h3>
                  교체할지 말지, 먼저
                  <br />
                  계산합니다
                </h3>
                <p>설비 노후도와 비용을 읽어 투자 판단을 돕습니다.</p>
              </div>
            </button>

            <button
              type="button"
              className="ff-business-card"
              onClick={() => setDialogType("services")}
            >
              <div className="ff-business-media ff-business-media-2" />
              <div className="ff-business-card-copy">
                <span>지원사업 매칭</span>
                <h3>
                  내 공장에 맞는 지원금을
                  <br />
                  찾습니다
                </h3>
                <p>업종·지역·설비 기준으로 공고를 정리합니다.</p>
              </div>
            </button>

            <button
              type="button"
              className="ff-business-card"
              onClick={() => setDialogType("services")}
            >
              <div className="ff-business-media ff-business-media-3" />
              <div className="ff-business-card-copy">
                <span>신청 · 안전관리</span>
                <h3>
                  신청서와 점검까지
                  <br />
                  연결합니다
                </h3>
                <p>초안 생성과 D-day 알림으로 실행을 앞당깁니다.</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      <div className="ff-section-transition">
        <span>FROM SERVICE TO DASHBOARD</span>
      </div>

      <section className="ff-dashboard-section" id="dashboard">
        <div className="ff-section-container">
          <div className="ff-split-head">
            <div>
              <p className="ff-section-label">DASHBOARD EXPERIENCE</p>
              <h2>
                로그인 전엔 핵심만,
                <br />
                로그인 후엔 전체 관리.
              </h2>
            </div>

            <p>
              로그인 전에는 핵심 결과를 빠르게 확인하고, 로그인 후에는
              지원사업·ROI·신청 준비·안전점검을 한 화면에서 관리합니다.
            </p>
          </div>

          <div className="ff-dashboard-summary-shell">
            <div className="ff-dashboard-summary-grid">
              <article className="ff-dashboard-summary-card">
                <strong>15년</strong>
                <h3>설비 분석</h3>
                <p>설비 연식과 업종 평균 교체주기를 비교합니다.</p>
              </article>

              <article className="ff-dashboard-summary-card">
                <strong>47.5%</strong>
                <h3>ROI 결과</h3>
                <p>투자 시나리오별 예상 수익성과 회수기간을 보여줍니다.</p>
              </article>

              <article className="ff-dashboard-summary-card">
                <strong>2.0억</strong>
                <h3>지원금 추천</h3>
                <p>적합도와 마감일 기준으로 지원사업을 정리합니다.</p>
              </article>

              <article className="ff-dashboard-summary-card">
                <strong>D-30</strong>
                <h3>안전점검</h3>
                <p>점검 일정과 인증 리스크를 미리 안내합니다.</p>
              </article>
            </div>
          </div>

          <div className="ff-dashboard-section-gap">
            <span>Preview to Dashboard</span>
          </div>

          <div className="ff-dashboard-compare-shell">
            <article className="ff-dashboard-compare-card ff-dashboard-compare-card-light">
              <span>로그인 전 Preview</span>
              <h3>핵심 결과만 먼저 확인</h3>

              <ul>
                <li>설비 분석 요약</li>
                <li>ROI 대표 수치</li>
                <li>지원사업 샘플 추천</li>
                <li>저장 없이 빠른 체험</li>
              </ul>
            </article>

            <article className="ff-dashboard-compare-card ff-dashboard-compare-card-dark">
              <span>로그인 후 Dashboard</span>
              <h3>
                전체 분석을
                <br />
                저장하고 관리
              </h3>

              <ul>
                <li>기업별 분석 결과 저장</li>
                <li>지원사업 캘린더 연결</li>
                <li>신청서 초안 생성</li>
                <li>안전점검 알림 연결</li>
              </ul>

              <button
                type="button"
                className="ff-dashboard-compare-button"
                onClick={() => setDialogType("dashboard")}
              >
                대시보드 자세히 보기
              </button>
            </article>
          </div>
        </div>
      </section>

      <section className="ff-sustainability-section" id="sustainability">
        <div className="ff-sustainability-head">
          <div>
            <div className="ff-gold-line" />
            <p className="ff-section-label">SUSTAINABILITY</p>
            <h2>
              팩토핏이 만드는
              <br />
              지속가능경영
            </h2>
          </div>

          <p>
            팩토핏의 지속가능경영은 선언이 아니라, 현장의 비용·생산성·재무·안전
            리스크를 숫자로 관리하는 방식입니다.
          </p>
        </div>

        <div className="ff-sustainability-board">
          <div className="ff-sustainability-media">
            <div>
              <h3>
                지속가능한 제조업은
                <br />
                정확한 투자 판단에서 시작됩니다.
              </h3>
              <button type="button" onClick={() => setDialogType("dashboard")}>
                대시보드 보기
              </button>
            </div>
          </div>

          <div className="ff-sustainability-value-grid">
            <article>
              <h3>Energy</h3>
              <span>에너지 효율</span>
              <p>노후 설비 교체와 고효율 설비 전환으로 전력비 절감을 돕습니다.</p>
            </article>

            <article>
              <h3>Productivity</h3>
              <span>생산성 향상</span>
              <p>불량률과 고장 리스크를 줄여 생산 흐름을 안정화합니다.</p>
            </article>

            <article>
              <h3>Finance</h3>
              <span>재무건전성</span>
              <p>ROI 기반 투자 판단으로 현금흐름 리스크를 줄입니다.</p>
            </article>

            <article>
              <h3>Safety</h3>
              <span>안전관리</span>
              <p>법정 점검과 인증 리스크를 미리 관리해 운영 중단 위험을 예방합니다.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="ff-insights-section" id="insights">
        <div className="ff-insights-panel">
          <div className="ff-insights-copy">
            <p className="ff-section-label">FACTOFIT INSIGHTS</p>

            <h2>
              흩어진 제조업 지원정보,
              <br />
              팩토핏이 정리합니다.
            </h2>

            <p>
              정부지원금 매칭부터 설비 진단, ROI 시뮬레이션까지 제조업
              의사결정 흐름을 하나로 연결합니다.
            </p>

            <div className="ff-insight-chip-grid">
              <span>최신 제조업 정책</span>
              <span>지원사업 소식</span>
              <span>설비 투자 트렌드</span>
              <span>안전관리 가이드</span>
            </div>
          </div>

          <div className="ff-newsletter-card">
            <h3>뉴스레터 신청</h3>
            <p>
              이메일을 남기면 팩토핏 인사이트 구독 완료 팝업이 표시됩니다.
            </p>

            <div className="ff-newsletter-form">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
                placeholder="company@example.com"
              />

              <button type="button" onClick={handleNewsletterSubmit}>
                구독하기
              </button>
            </div>

            <div className="ff-contact-line">
              <strong>Contact us</strong>
              <span>서비스 제휴 · 공공데이터 협력 · 제조기업 PoC 문의</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="ff-main-footer">
        <div className="ff-footer-public-data">
          <p>POWERED BY PUBLIC DATA</p>
          <h2>공공데이터 활용기관 및 기본 정보</h2>

          <div className="ff-footer-chip-grid">
            <span>산업통상자원부</span>
            <span>공공데이터포털</span>
            <span>한국에너지공단</span>
            <span>한국산업단지공단</span>
            <span>KOTRA</span>
            <span>KTL</span>
          </div>
        </div>

        <div className="ff-footer-company">
          <div>
            <h3>FactoFit</h3>
            <p>Manufacturing AI Advisor · 제조기업 의사결정 지원 플랫폼</p>
          </div>

          <div className="ff-footer-link-grid">
            <button type="button">개인정보처리방침</button>
            <button type="button">이용약관</button>
            <button type="button">이메일무단수집거부</button>
            <button type="button">고객센터</button>
            <button type="button">문의하기</button>
          </div>

          <div className="ff-footer-info">
            <span>상호명: FactoFit Labs</span>
            <span>대표: FactoFit Team</span>
            <span>사업자등록번호: 000-00-00000</span>
            <span>주소: 서울특별시 제조AI로 100</span>
            <span>이메일: contact@factofit.ai</span>
            <span>고객지원: 평일 10:00 - 18:00</span>
          </div>

          <small>
            본 서비스 화면은 제조업 설비투자 의사결정 및 공공데이터 기반
            지원사업 매칭을 설명하기 위한 데모입니다.
          </small>
        </div>
      </footer>

      <MainDialog
        type={dialogType}
        onClose={() => setDialogType(null)}
        onLoginClick={() => navigate("/login")}
      />
    </main>
  )
}