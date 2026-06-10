import { useState } from "react"
import { useNavigate } from "react-router-dom"


export default function ApplicationDraftPage() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)

  return (

      <main className="factofit-page">
        <section className="factofit-section">
          <div className="factofit-container">
            <button
              onClick={() => navigate("/?screen=roi-summary")}
              className="factofit-back-button"
            >
              ← ROI 분석으로 돌아가기
            </button>

            <div className="mt-10">
              <p className="factofit-label">FactoFit Application Draft</p>

              <h1 className="factofit-title">지원사업 신청서 초안</h1>

              <p className="factofit-desc">
                ROI 분석 결과를 바탕으로 지원사업 신청에 필요한 핵심 내용을
                자동 정리했습니다.
              </p>
            </div>

            <div className="draft-layout">
              <article className="draft-main-card">
                <div className="draft-card-header">
                  <div>
                    <p className="draft-eyebrow">추천 신청 사업</p>
                    <h2>스마트공장 구축 및 고도화 지원사업</h2>
                  </div>

                  <span className="draft-status-badge">초안 생성 완료</span>
                </div>

                <div className="draft-info-grid">
                  <div className="draft-info-block">
                    <span>기업명</span>
                    <strong>안산금속(주)</strong>
                  </div>

                  <div className="draft-info-block">
                    <span>대상 설비</span>
                    <strong>유압 프레스 라인 A</strong>
                  </div>

                  <div className="draft-info-block">
                    <span>예상 지원금</span>
                    <strong>1.24억원</strong>
                  </div>

                  <div className="draft-info-block">
                    <span>예상 회수기간</span>
                    <strong>1.4년</strong>
                  </div>
                </div>

                <div className="draft-section">
                  <h3>신청 목적</h3>
                  <p>
                    노후 유압 프레스 라인 A 교체를 통한 에너지 비용 절감,
                    불량률 개선, 생산성 향상을 목표로 합니다.
                  </p>
                </div>

                <div className="draft-section">
                  <h3>도입 설비</h3>
                  <p>
                    고효율 유압 프레스 설비와 스마트 모니터링 시스템을 함께
                    도입하여 설비 운영 효율을 개선합니다.
                  </p>
                </div>

                <div className="draft-section">
                  <h3>기대 효과</h3>
                  <p>
                    연간 에너지 비용 1,440만원 절감, 불량 감소 효과 70만원,
                    유지보수 절감 363만원이 예상되며, 실부담 투자금 기준
                    회수기간은 약 1.4년입니다.
                  </p>
                </div>

                <div className="draft-ai-box">
                  <span>AI 작성 문장</span>
                  <p>
                    당사는 현재 사용 중인 유압 프레스 라인 A의 노후화로 인해
                    에너지 비용 증가와 유지보수 부담이 지속적으로 발생하고
                    있습니다. 이에 고효율 프레스 설비로 교체하고 스마트
                    모니터링 시스템을 도입하여 생산성 향상과 에너지 절감을
                    동시에 달성하고자 합니다.
                  </p>
                </div>

                <div className="draft-action-row">
                  <button
                    onClick={() => setSaved(true)}
                    className="draft-primary-button"
                  >
                    초안 저장하기
                  </button>

                  <button
                    onClick={() => alert("PDF 다운로드 기능 준비 중입니다.")}
                    className="draft-dark-button"
                  >
                    PDF 다운로드
                  </button>
                </div>

                {saved && (
                  <div className="draft-save-alert">
                    신청서 초안이 저장되었습니다.
                  </div>
                )}
              </article>

              <aside className="draft-side-column">
                <section className="draft-side-card">
                  <h3>AI 작성 근거</h3>

                  <ul className="draft-reason-list">
                    <li>설비 연식 15년으로 교체 권고 기준 초과</li>
                    <li>업종 평균 대비 에너지 비용 38% 높음</li>
                    <li>연간 에너지 절감 예상액 1,440만원</li>
                    <li>투자 회수기간 1.4년으로 사업성 양호</li>
                  </ul>
                </section>

                <section className="draft-side-card">
                  <h3>추천 지원사업</h3>

                  <div className="draft-policy-list">
                    <div className="draft-policy-card blue">
                      <strong>스마트공장 구축 지원사업</strong>
                      <span>최대 1억원 · 적합도 92%</span>
                    </div>

                    <div className="draft-policy-card green">
                      <strong>고효율 설비 교체 지원사업</strong>
                      <span>최대 8,400만원 · 적합도 88%</span>
                    </div>

                    <div className="draft-policy-card amber">
                      <strong>중소기업 혁신바우처</strong>
                      <span>최대 5,000만원 · 적합도 74%</span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </section>
      </main>

  )
}