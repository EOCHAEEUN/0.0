import { useState } from "react"
import { useNavigate } from "react-router-dom"

type DraftStatus = "idle" | "saved" | "downloadReady"

type ChecklistItem = {
  label: string
  status: "완료" | "확인 필요"
  tone: "ok" | "need"
}

const checklistItems: ChecklistItem[] = [
  {
    label: "ROI 분석 결과 반영",
    status: "완료",
    tone: "ok",
  },
  {
    label: "지원사업 적합도 검토",
    status: "완료",
    tone: "ok",
  },
  {
    label: "기업 기본정보 확인",
    status: "확인 필요",
    tone: "need",
  },
  {
    label: "견적서 및 증빙자료 첨부",
    status: "확인 필요",
    tone: "need",
  },
]

export default function ApplicationDraftPage() {
  const navigate = useNavigate()
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle")

  const handleSaveDraft = () => {
    setDraftStatus("saved")
  }

  const handlePrepareDownload = () => {
    setDraftStatus("downloadReady")
  }

  return (
    <main className="page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/roi")}
            style={{
              marginBottom: "28px",
              height: "44px",
              padding: "0 18px",
              borderRadius: "999px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#061B34",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(6,27,52,.06)",
            }}
          >
            ← ROI 분석으로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT APPLICATION DRAFT</div>
              <div className="label">APPLICATION DRAFT</div>
              <h2>
                ROI 분석 결과를 바탕으로 <br />
                지원사업 신청서 초안을 생성합니다.
              </h2>
            </div>

            <p className="section-desc">
              설비투자 타당성, 지원사업 적합도, 기대효과를 자동 정리해
              신청서에 바로 활용할 수 있는 초안 형태로 제공합니다.
            </p>
          </div>

          <div className="application-flow-panel">
            <div className="application-flow-head">
              <div>
                <h3>지원사업 신청 준비 현황</h3>
                <span>
                  ROI 분석 결과와 기업 설비 정보를 기반으로 작성된 초안입니다.
                </span>
              </div>

              <span className="badge green">초안 생성 완료</span>
            </div>

            <div className="application-flow-body">
              <div>
                <div className="ready-card">
                  <div className="ready-top">
                    <div>
                      <h4>신청 준비도</h4>
                      <p>
                        ROI, 회수기간, 지원사업 적합도 기준으로 신청 가능성을
                        종합 평가했습니다.
                      </p>
                    </div>

                    <span className="badge blue">AI 검토</span>
                  </div>

                  <div className="ready-score">
                    <b>87</b>
                    <small>/100</small>
                  </div>

                  <p>
                    현재 조건에서는 스마트공장 고도화 및 고효율 설비 교체
                    지원사업에 신청할 만한 근거가 충분합니다. 다만 기업
                    기본정보와 견적서, 설비 사진 등 증빙자료는 제출 전 추가
                    확인이 필요합니다.
                  </p>

                  <div className="ready-progress">
                    <i />
                  </div>

                  <div className="checklist">
                    {checklistItems.map((item) => (
                      <div className="check-item" key={item.label}>
                        <strong>{item.label}</strong>
                        <span className={item.tone}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ai-ground-card">
                  <h4>AI 작성 근거</h4>

                  <ul>
                    <li>설비 사용연수 11년으로 교체 검토 필요성이 높습니다.</li>
                    <li>예상 실부담금은 2.0억원, 회수기간은 약 14개월입니다.</li>
                    <li>정부지원금 적용 시 투자 부담이 크게 낮아집니다.</li>
                    <li>
                      에너지 비용, 유지보수비, 불량 손실 개선 효과가 기대됩니다.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="draft-preview-card">
                <div className="draft-preview-top">
                  <div>
                    <h4>AI 신청서 초안</h4>
                    <p
                      style={{
                        marginTop: "8px",
                        color: "#667085",
                        fontSize: "14px",
                        lineHeight: 1.7,
                        fontWeight: 800,
                      }}
                    >
                      신청서에 바로 옮겨 적을 수 있도록 목적, 도입 설비,
                      기대효과를 문장형으로 정리했습니다.
                    </p>
                  </div>

                  <button type="button" onClick={() => navigate("/roi")}>
                    ROI 다시 보기
                  </button>
                </div>

                <div className="draft-message">
                  당사는 현재 사용 중인 프레스 설비의 노후화로 인해 에너지
                  비용 증가, 유지보수 부담, 불량률 상승 문제가 지속적으로
                  발생하고 있습니다. 이에 고효율 프레스 설비로 교체하고
                  스마트 모니터링 시스템을 도입하여 생산성 향상과 에너지
                  절감을 동시에 달성하고자 합니다.
                </div>

                <div className="draft-table">
                  <div className="draft-row">
                    <div>추천 신청사업</div>
                    <div>스마트공장 구축 및 고도화 지원사업</div>
                  </div>

                  <div className="draft-row">
                    <div>기업명</div>
                    <div>안산금속 주식회사</div>
                  </div>

                  <div className="draft-row">
                    <div>대상 설비</div>
                    <div>프레스 설비 / 유압 프레스 라인 A</div>
                  </div>

                  <div className="draft-row">
                    <div>신청 목적</div>
                    <div>노후 설비 교체 및 에너지 효율 개선</div>
                  </div>

                  <div className="draft-row">
                    <div>총 투자금</div>
                    <div>3.2억원</div>
                  </div>

                  <div className="draft-row">
                    <div>예상 지원금</div>
                    <div>1.2억원</div>
                  </div>

                  <div className="draft-row">
                    <div>예상 회수기간</div>
                    <div>약 14개월</div>
                  </div>

                  <div className="draft-row">
                    <div>주요 기대효과</div>
                    <div>전기요금 절감, 불량률 감소, 유지보수비 절감</div>
                  </div>
                </div>

                <div className="recommended-policy-mini">
                  <div className="policy-mini">
                    <strong>스마트공장 고도화</strong>
                    <span>적합도 92% · 우선 검토</span>
                  </div>

                  <div className="policy-mini">
                    <strong>고효율 설비 교체</strong>
                    <span>적합도 88% · 보조 검토</span>
                  </div>
                </div>

                <div className="draft-actions">
                  <button
                    className="btn blue"
                    type="button"
                    onClick={handleSaveDraft}
                  >
                    초안 저장하기
                  </button>

                  <button
                    className="btn dark"
                    type="button"
                    onClick={handlePrepareDownload}
                  >
                    PDF 다운로드 준비
                  </button>

                  <button
                    className="btn green"
                    type="button"
                    onClick={() => navigate("/support-projects")}
                  >
                    지원사업 목록 보기
                  </button>
                </div>

                {draftStatus === "saved" && (
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "16px 18px",
                      borderRadius: "18px",
                      background: "#E8F5EF",
                      color: "#0B7A53",
                      fontSize: "14px",
                      fontWeight: 900,
                    }}
                  >
                    신청서 초안이 저장되었습니다.
                  </div>
                )}

                {draftStatus === "downloadReady" && (
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "16px 18px",
                      borderRadius: "18px",
                      background: "#FFF2DF",
                      color: "#E65F00",
                      fontSize: "14px",
                      fontWeight: 900,
                    }}
                  >
                    PDF 다운로드 기능은 이후 연결 예정입니다. 현재는 초안
                    내용을 화면에서 확인할 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="details-wrap">
            <details open>
              <summary>신청서 문장 미리보기</summary>

              <div className="detail-body">
                <div className="scenario-grid">
                  <div className="scenario best">
                    <h4>사업 필요성</h4>
                    <p>
                      당사는 금속가공 제조 공정에서 프레스 설비를 핵심 생산
                      장비로 활용하고 있습니다. 그러나 현재 설비는 사용연수가
                      증가하면서 전력 사용량과 유지보수 비용이 높아지고 있으며,
                      일부 공정에서는 불량률 증가로 인한 손실이 발생하고
                      있습니다.
                    </p>

                    <div className="kv-grid">
                      <div className="kv">
                        <span>설비 사용연수</span>
                        <b>11년</b>
                      </div>

                      <div className="kv">
                        <span>현재 불량률</span>
                        <b>5.8%</b>
                      </div>

                      <div className="kv wide">
                        <span>핵심 문제</span>
                        <b>노후화</b>
                      </div>
                    </div>
                  </div>

                  <div className="scenario">
                    <h4>도입 후 기대효과</h4>
                    <p>
                      신규 고효율 설비 도입을 통해 에너지 사용량을 줄이고,
                      생산 공정의 안정성을 높일 수 있습니다. 또한 설비 상태를
                      실시간으로 확인하는 모니터링 체계를 함께 구축하여 고장
                      위험을 사전에 파악하고 생산 중단 리스크를 줄이고자 합니다.
                    </p>

                    <div className="saving-list">
                      <div className="saving">
                        <span>전기요금 절감</span>
                        <b>연 2,700만원</b>
                      </div>

                      <div className="saving">
                        <span>불량 손실 감소</span>
                        <b>연 3,600만원</b>
                      </div>

                      <div className="saving">
                        <span>유지보수비 절감</span>
                        <b>연 3,600만원</b>
                      </div>

                      <div className="saving">
                        <span>투자 회수기간</span>
                        <b>14개월</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <details>
              <summary>제출 전 확인할 서류</summary>

              <div className="detail-body">
                <div className="check-grid">
                  <div className="check-card">
                    <h4>사업자등록증</h4>
                    <p>
                      기업 기본정보 확인을 위해 최신 사업자등록증 사본을
                      준비합니다.
                    </p>
                  </div>

                  <div className="check-card orange">
                    <h4>설비 견적서</h4>
                    <p>
                      도입 예정 설비의 견적서와 사양서를 함께 제출하면
                      투자금 산정 근거가 명확해집니다.
                    </p>
                  </div>

                  <div className="check-card red">
                    <h4>현 설비 사진</h4>
                    <p>
                      노후 설비 상태를 보여주는 사진과 유지보수 내역을
                      첨부하면 신청 필요성이 강화됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}