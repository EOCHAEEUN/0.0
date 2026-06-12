import { useNavigate } from "react-router-dom"

type SafetyStatus = "정상" | "주의" | "위험"
type Tone = "green" | "orange" | "red"
type SafetyState = "loading" | "error" | "empty" | "success"

type SafetyItem = {
  label: string
  status: SafetyStatus
  score: number
  tone: Tone
  description: string
}

type InspectionItem = {
  title: string
  priority: "낮음" | "보통" | "높음"
  dueDate: string
  description: string
  tone: Tone
}

type RiskFactor = {
  label: string
  value: string
  score: number
  tone: Tone
}

type SafetyInspection = {
  score: number
  statusLabel: string
  summary: string
  normalCount: number
  cautionCount: number
  dangerCount: number
  mainRiskTitle: string
  mainRiskDescription: string
}

/**
 * 테스트용 상태값
 *
 * success: 기존 안전점검 데이터 표시
 * empty: safety_inspection = null 상황 테스트
 * loading: 로딩 UI 테스트
 * error: 에러 UI 테스트
 *
 * 실사용 기본값은 success로 둡니다.
 */
const TEST_SAFETY_STATE: SafetyState = "success"

const selectedEquipmentContext = {
  equipmentName: "프레스 설비",
  industryName: "자동차 부품 제조업",
  equipmentAge: 11,
  defectRate: 5.8,
  maintenanceTrend: "증가",
  recommendedPolicy: "스마트공장",
  expectedSupport: "1억원",
  policyFitScore: 92,
}

const safetyInspection: SafetyInspection = {
  score: 72,
  statusLabel: "정밀점검 권고",
  summary:
    "즉시 중단이 필요한 수준은 아니지만, 사용연수와 유지보수비 증가, 불량률 변화를 고려하면 정밀점검과 설비 교체 검토가 필요한 상태입니다.",
  normalCount: 1,
  cautionCount: 3,
  dangerCount: 0,
  mainRiskTitle: "가장 큰 리스크는 설비 노후도와 유지보수비 증가입니다.",
  mainRiskDescription:
    "설비 사용연수 11년, 불량률 5.8%, 유지보수비 증가 흐름을 종합하면 단순 수리보다 교체 또는 고도화 투자 검토가 더 적합할 수 있습니다.",
}

const safetyItems: SafetyItem[] = [
  {
    label: "설비 사용연수",
    status: "주의",
    score: 72,
    tone: "orange",
    description:
      "프레스 설비 사용연수 11년으로 정밀점검 권고 구간에 진입했습니다.",
  },
  {
    label: "유지보수 이력",
    status: "주의",
    score: 68,
    tone: "orange",
    description: "최근 유지보수 비용 증가로 주요 부품 교체 여부 확인이 필요합니다.",
  },
  {
    label: "불량률 변화",
    status: "주의",
    score: 74,
    tone: "orange",
    description: "현재 불량률 5.8%로 공정 안정성 개선 검토가 필요합니다.",
  },
  {
    label: "작업자 안전",
    status: "정상",
    score: 86,
    tone: "green",
    description: "기본 안전장치와 작업자 보호 항목은 양호한 상태입니다.",
  },
]

const inspectionItems: InspectionItem[] = [
  {
    title: "프레스 유압계통 점검",
    priority: "높음",
    dueDate: "이번 주",
    description: "유압 누유, 압력 저하, 반복 작동 이상 여부를 우선 확인해야 합니다.",
    tone: "red",
  },
  {
    title: "전기 제어반 점검",
    priority: "보통",
    dueDate: "2주 내",
    description: "전력 사용량 증가와 관련해 제어반 과열 및 배선 상태를 확인합니다.",
    tone: "orange",
  },
  {
    title: "안전센서 작동 확인",
    priority: "보통",
    dueDate: "2주 내",
    description: "비상정지, 커버 센서, 작업자 접근 감지 센서 작동 여부를 확인합니다.",
    tone: "orange",
  },
  {
    title: "정기 안전교육 기록",
    priority: "낮음",
    dueDate: "이번 달",
    description: "작업자 교육 이력과 안전수칙 안내 자료를 최신 상태로 정리합니다.",
    tone: "green",
  },
]

const riskFactors: RiskFactor[] = [
  {
    label: "노후도",
    value: "11년",
    score: 77,
    tone: "orange",
  },
  {
    label: "불량률",
    value: "5.8%",
    score: 74,
    tone: "orange",
  },
  {
    label: "유지보수비",
    value: "증가",
    score: 69,
    tone: "orange",
  },
  {
    label: "안전장치",
    value: "양호",
    score: 86,
    tone: "green",
  },
]

function getToneColor(tone: Tone) {
  if (tone === "green") return "#0B7A53"
  if (tone === "orange") return "#E65F00"
  return "#CD2E3A"
}

function getToneSoftColor(tone: Tone) {
  if (tone === "green") return "#E8F5EF"
  if (tone === "orange") return "#FFF2DF"
  return "#FDE8E9"
}

function getStatusBadgeClass(tone: Tone) {
  if (tone === "green") return "green"
  if (tone === "orange") return "orange"
  return "red"
}

function getSafetyDataByState(state: SafetyState) {
  if (state === "success") {
    return {
      inspection: safetyInspection,
      safetyCards: safetyItems,
      inspectionCards: inspectionItems,
      riskCards: riskFactors,
    }
  }

  return {
    inspection: null,
    safetyCards: [],
    inspectionCards: [],
    riskCards: [],
  }
}

function SafetyLoadingState() {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #BFDBFE",
        background: "#EFF6FF",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge blue">LOADING</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#061B34",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        안전점검 데이터를 불러오는 중입니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#667085",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
        }}
      >
        설비 사용연수, 유지보수 이력, 불량률, 안전장치 상태를 기준으로 안전
        리스크를 분석하고 있습니다.
      </p>
    </div>
  )
}

function SafetyEmptyState({ onBackToRoi }: { onBackToRoi: () => void }) {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #FDBA74",
        background: "#FFF7ED",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge orange">안전점검 데이터 없음</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#061B34",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        안전점검 데이터가 아직 없습니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#667085",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
          maxWidth: "820px",
        }}
      >
        safety_inspection이 null이거나 점검 항목 배열이 비어 있어도 화면이
        깨지지 않도록 빈 상태 UI를 표시합니다. 설비 사용연수, 불량률,
        유지보수비, 안전장치 정보를 입력하면 안전 리스크를 다시 분석할 수
        있습니다.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button className="btn blue" type="button" onClick={onBackToRoi}>
          ROI 입력값 보완하기
        </button>

        <button
          className="btn dark"
          type="button"
          onClick={() =>
            window.alert(
              "테스트 완료: safety_inspection 데이터가 없어도 화면이 깨지지 않습니다.",
            )
          }
        >
          빈 상태 테스트 확인
        </button>
      </div>
    </div>
  )
}

function SafetyErrorState({ onBackToRoi }: { onBackToRoi: () => void }) {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #FCA5A5",
        background: "#FEF2F2",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge red">ERROR</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#991B1B",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        안전점검 결과를 불러오지 못했습니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#7F1D1D",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
          maxWidth: "820px",
        }}
      >
        안전점검 API 또는 데이터 로딩 중 오류가 발생해도 화면은 깨지지
        않습니다. 잠시 후 다시 시도하거나 ROI 입력값을 확인해주세요.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button className="btn blue" type="button" onClick={onBackToRoi}>
          ROI 분석으로 돌아가기
        </button>
      </div>
    </div>
  )
}

export default function SafetyPage() {
  const navigate = useNavigate()

  const { inspection, safetyCards, inspectionCards, riskCards } =
    getSafetyDataByState(TEST_SAFETY_STATE)

  const hasSafetyInspection = Boolean(inspection)
  const hasSafetyCards = safetyCards.length > 0
  const hasInspectionCards = inspectionCards.length > 0
  const hasRiskCards = riskCards.length > 0

  return (
    <main className="page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/")}
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
            ← 대시보드로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT SAFETY CHECK</div>
              <div className="label">EQUIPMENT SAFETY</div>
              <h2>
                노후 설비의 안전 리스크를 <br />
                사전에 점검합니다.
              </h2>
            </div>

            <p className="section-desc">
              선택된 {selectedEquipmentContext.equipmentName}의 설비 사용연수,
              유지보수 이력, 불량률, 안전장치 상태를 바탕으로 점검 우선순위와
              교체 필요성을 함께 판단합니다.
            </p>
          </div>

          {TEST_SAFETY_STATE === "loading" && <SafetyLoadingState />}

          {TEST_SAFETY_STATE === "empty" && (
            <SafetyEmptyState onBackToRoi={() => navigate("/roi")} />
          )}

          {TEST_SAFETY_STATE === "error" && (
            <SafetyErrorState onBackToRoi={() => navigate("/roi")} />
          )}

          {TEST_SAFETY_STATE === "success" &&
            hasSafetyInspection &&
            inspection && (
              <>
                <div className="safety-summary-grid">
                  <div className="safety-score-card">
                    <h3>설비 안전 점수</h3>

                    <b>{inspection.score}</b>
                    <small>/100</small>

                    <p>{inspection.summary}</p>

                    <div
                      style={{
                        marginTop: "28px",
                        height: "14px",
                        background: "rgba(255,255,255,.16)",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <i
                        style={{
                          display: "block",
                          width: `${inspection.score}%`,
                          height: "100%",
                          background: "#7DD3A7",
                          borderRadius: "999px",
                        }}
                      />
                    </div>

                    <div
                      className="hero-actions"
                      style={{
                        justifyContent: "flex-start",
                        marginTop: "28px",
                      }}
                    >
                      <button
                        className="btn primary"
                        type="button"
                        onClick={() => navigate("/roi")}
                      >
                        ROI 분석으로 연결
                      </button>

                      <button
                        className="btn outline"
                        type="button"
                        onClick={() => navigate("/support-projects")}
                      >
                        지원사업 보기
                      </button>
                    </div>
                  </div>

                  <div className="safety-card-grid">
                    <div className="safety-status-card">
                      <span>정상 항목</span>
                      <b>{inspection.normalCount}</b>
                      <h4>안전장치 상태</h4>
                    </div>

                    <div className="safety-status-card orange">
                      <span>주의 항목</span>
                      <b>{inspection.cautionCount}</b>
                      <h4>노후도 / 불량률</h4>
                    </div>

                    <div className="safety-status-card red">
                      <span>위험 항목</span>
                      <b>{inspection.dangerCount}</b>
                      <h4>즉시 중단 없음</h4>
                    </div>
                  </div>
                </div>

                <div
                  className="summary-hero-card"
                  style={{
                    marginTop: "28px",
                    marginBottom: "28px",
                    borderLeftColor: "#E65F00",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "0.92fr 1.08fr",
                      gap: "28px",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span className="badge orange">
                        {inspection.statusLabel}
                      </span>

                      <h3 style={{ marginTop: "18px" }}>
                        {inspection.mainRiskTitle}
                      </h3>

                      <p>{inspection.mainRiskDescription}</p>
                    </div>

                    {hasRiskCards ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: "14px",
                        }}
                      >
                        {riskCards.map((factor) => {
                          const color = getToneColor(factor.tone)
                          const softColor = getToneSoftColor(factor.tone)
                          const degree = factor.score * 3.6

                          return (
                            <div
                              key={factor.label}
                              style={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                                borderRadius: "26px",
                                padding: "22px 18px",
                                textAlign: "center",
                                boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                                borderTop: `5px solid ${color}`,
                              }}
                            >
                              <div
                                style={{
                                  width: "124px",
                                  height: "124px",
                                  borderRadius: "50%",
                                  margin: "0 auto 16px",
                                  background: `conic-gradient(${color} 0deg ${degree}deg, #E8EEF5 ${degree}deg 360deg)`,
                                  display: "grid",
                                  placeItems: "center",
                                  boxShadow: "0 14px 30px rgba(6,27,52,.08)",
                                }}
                              >
                                <div
                                  style={{
                                    width: "92px",
                                    height: "92px",
                                    borderRadius: "50%",
                                    background: "#FFFFFF",
                                    border: "1px solid #E2E8F0",
                                    display: "grid",
                                    placeItems: "center",
                                  }}
                                >
                                  <div>
                                    <b
                                      style={{
                                        display: "block",
                                        color,
                                        fontFamily: "DM Mono, monospace",
                                        fontSize: "28px",
                                        lineHeight: 1,
                                        fontWeight: 500,
                                      }}
                                    >
                                      {factor.score}
                                    </b>

                                    <span
                                      style={{
                                        display: "block",
                                        color: "#667085",
                                        fontSize: "11px",
                                        fontWeight: 900,
                                        marginTop: "4px",
                                      }}
                                    >
                                      /100
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <strong
                                style={{
                                  display: "block",
                                  color: "#061B34",
                                  fontSize: "17px",
                                  fontWeight: 900,
                                  marginBottom: "8px",
                                }}
                              >
                                {factor.label}
                              </strong>

                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: "30px",
                                  padding: "0 11px",
                                  borderRadius: "999px",
                                  background: softColor,
                                  color,
                                  fontSize: "12px",
                                  fontWeight: 900,
                                }}
                              >
                                {factor.value}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <SafetyEmptyState onBackToRoi={() => navigate("/roi")} />
                    )}
                  </div>
                </div>

                <div className="details-wrap">
                  <details open>
                    <summary>안전 리스크 항목별 진단</summary>

                    <div className="detail-body">
                      {hasSafetyCards ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: "18px",
                          }}
                        >
                          {safetyCards.map((item) => (
                            <article
                              key={item.label}
                              style={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                                borderRadius: "24px",
                                padding: "24px",
                                borderLeft: `6px solid ${getToneColor(
                                  item.tone,
                                )}`,
                                boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "14px",
                                  alignItems: "flex-start",
                                  marginBottom: "16px",
                                }}
                              >
                                <div>
                                  <span
                                    className={`badge ${getStatusBadgeClass(
                                      item.tone,
                                    )}`}
                                  >
                                    {item.status}
                                  </span>

                                  <h4
                                    style={{
                                      color: "#061B34",
                                      fontSize: "22px",
                                      fontWeight: 900,
                                      letterSpacing: "-0.4px",
                                      marginTop: "14px",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    {item.label}
                                  </h4>
                                </div>

                                <b
                                  style={{
                                    color: getToneColor(item.tone),
                                    fontFamily: "DM Mono, monospace",
                                    fontSize: "34px",
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.score}%
                                </b>
                              </div>

                              <div
                                style={{
                                  height: "10px",
                                  background: "#E8EEF5",
                                  borderRadius: "999px",
                                  overflow: "hidden",
                                  marginBottom: "16px",
                                }}
                              >
                                <i
                                  style={{
                                    display: "block",
                                    width: `${item.score}%`,
                                    height: "100%",
                                    background: getToneColor(item.tone),
                                    borderRadius: "999px",
                                  }}
                                />
                              </div>

                              <p
                                style={{
                                  color: "#667085",
                                  fontSize: "14px",
                                  lineHeight: 1.75,
                                  fontWeight: 800,
                                }}
                              >
                                {item.description}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <SafetyEmptyState onBackToRoi={() => navigate("/roi")} />
                      )}
                    </div>
                  </details>

                  <details open>
                    <summary>점검 우선순위</summary>

                    <div className="detail-body">
                      {hasInspectionCards ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            gap: "16px",
                          }}
                        >
                          {inspectionCards.map((item, index) => (
                            <article
                              key={item.title}
                              style={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                                borderTop: `6px solid ${getToneColor(
                                  item.tone,
                                )}`,
                                borderRadius: "24px",
                                padding: "24px",
                                boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "42px",
                                  height: "42px",
                                  borderRadius: "50%",
                                  background: getToneSoftColor(item.tone),
                                  color: getToneColor(item.tone),
                                  fontFamily: "DM Mono, monospace",
                                  fontSize: "16px",
                                  fontWeight: 500,
                                  marginBottom: "18px",
                                }}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </span>

                              <h4
                                style={{
                                  color: "#061B34",
                                  fontSize: "18px",
                                  lineHeight: 1.35,
                                  fontWeight: 900,
                                  marginBottom: "8px",
                                }}
                              >
                                {item.title}
                              </h4>

                              <strong
                                style={{
                                  display: "block",
                                  color: getToneColor(item.tone),
                                  fontSize: "13px",
                                  fontWeight: 900,
                                  marginBottom: "10px",
                                }}
                              >
                                {item.priority} · {item.dueDate}
                              </strong>

                              <p
                                style={{
                                  color: "#667085",
                                  fontSize: "13px",
                                  lineHeight: 1.7,
                                  fontWeight: 800,
                                }}
                              >
                                {item.description}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <SafetyEmptyState onBackToRoi={() => navigate("/roi")} />
                      )}
                    </div>
                  </details>

                  <details>
                    <summary>설비 교체 검토 사유</summary>

                    <div className="detail-body">
                      <div className="scenario-grid">
                        <div className="scenario best">
                          <h4>교체 검토가 필요한 이유</h4>

                          <p>
                            현재 {selectedEquipmentContext.equipmentName}는
                            사용연수 증가, 유지보수비 상승, 불량률 증가가 동시에
                            나타나고 있습니다. 단순 수리보다 고효율 설비 교체와
                            스마트 모니터링 시스템 도입을 함께 검토하는 것이
                            적합합니다.
                          </p>

                          <div className="saving-list">
                            <div className="saving">
                              <span>설비 사용연수</span>
                              <b>{selectedEquipmentContext.equipmentAge}년</b>
                            </div>

                            <div className="saving">
                              <span>현재 불량률</span>
                              <b>{selectedEquipmentContext.defectRate}%</b>
                            </div>

                            <div className="saving">
                              <span>안전 점수</span>
                              <b>{inspection.score}점</b>
                            </div>
                          </div>
                        </div>

                        <div className="scenario">
                          <h4>지원사업과 연결되는 이유</h4>

                          <p>
                            안전 리스크와 설비 노후도는 단순 내부 관리 문제가
                            아니라 설비 교체 지원사업의 신청 근거가 될 수
                            있습니다. ROI 분석과 함께 제시하면 사업계획서
                            설득력이 높아집니다.
                          </p>

                          <div className="saving-list">
                            <div className="saving">
                              <span>추천 지원사업</span>
                              <b>{selectedEquipmentContext.recommendedPolicy}</b>
                            </div>

                            <div className="saving">
                              <span>예상 지원금</span>
                              <b>{selectedEquipmentContext.expectedSupport}</b>
                            </div>

                            <div className="saving">
                              <span>적합도</span>
                              <b>{selectedEquipmentContext.policyFitScore}%</b>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className="hero-actions"
                        style={{
                          justifyContent: "center",
                          marginTop: "30px",
                        }}
                      >
                        <button
                          className="btn blue"
                          type="button"
                          onClick={() => navigate("/roi")}
                        >
                          ROI 분석으로 이동
                        </button>

                        <button
                          className="btn dark"
                          type="button"
                          onClick={() => navigate("/application-draft")}
                        >
                          신청서 초안 만들기
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              </>
            )}
        </div>
      </section>
    </main>
  )
}