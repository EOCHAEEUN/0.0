import {
  getEquipmentGradient,
  getProcessTooltipLeft,
  getToneColor,
  getToneSoftColor,
  type DdayItem,
  type ProcessItem,
  type ReasonItem,
} from "../dashboard.parts"

type PolicyMatchingSectionProps = {
  processItems: ProcessItem[]
  hoveredProcessStep: string | null
  selectedProcess: ProcessItem | null
  summaryProcess: ProcessItem
  visibleReasons: ReasonItem[]
  visibleDdays: DdayItem[]
  showGradeGuide: boolean
  onGradeGuideChange: (open: boolean) => void
  onHoveredProcessStepChange: (step: string | null) => void
  showAllReasons: boolean
  onToggleReasons: () => void
  showAllDdays: boolean
  onToggleDdays: () => void
}

export function PolicyMatchingSection({
  processItems,
  hoveredProcessStep,
  selectedProcess,
  summaryProcess,
  visibleReasons,
  visibleDdays,
  showGradeGuide,
  onGradeGuideChange,
  onHoveredProcessStepChange,
  showAllReasons,
  onToggleReasons,
  showAllDdays,
  onToggleDdays,
}: PolicyMatchingSectionProps) {
  return (
      <section
        style={{
          background: "#F3F6FA",
          padding: "76px clamp(22px,5vw,80px)",
        }}
      >
        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.9fr",
              gap: "40px",
              alignItems: "end",
              marginBottom: "34px",
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: "122px",
                  height: "4px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, #C68B3C 50%, rgba(255,255,255,0) 100%)",
                  marginBottom: "18px",
                }}
              />

              <div className="screen-tag">POLICY MATCHING FLOW</div>

              <div
                className="label"
                style={{
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                PROCESS BASED MATCHING
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                <h2
                  style={{
                    color: "#061B34",
                    fontSize: "52px",
                    lineHeight: 1.12,
                    fontWeight: 900,
                    letterSpacing: "-1.8px",
                    margin: 0,
                  }}
                >
                  지원사업 매칭 현황
                </h2>

                <button
                  type="button"
                  onMouseEnter={() => onGradeGuideChange(true)}
                  onMouseLeave={() => onGradeGuideChange(false)}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    border: "1px solid #BFDBFE",
                    background: "#EEF6FF",
                    color: "#344BA0",
                    fontSize: "20px",
                    fontWeight: 900,
                    cursor: "help",
                    flexShrink: 0,
                  }}
                >
                  i
                </button>

                {showGradeGuide && (
                  <div
                    style={{
                      position: "absolute",
                      top: "54px",
                      left: "250px",
                      zIndex: 50,
                      width: "370px",
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "22px",
                      padding: "24px",
                      boxShadow: "0 24px 64px rgba(6,27,52,.16)",
                    }}
                  >
                    <h3
                      style={{
                        color: "#061B34",
                        fontSize: "20px",
                        fontWeight: 900,
                        marginBottom: "14px",
                      }}
                    >
                      적합도 등급 기준
                    </h3>

                    <p
                      style={{
                        color: "#344BA0",
                        fontSize: "17px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      S등급: 90~100% / 즉시 추천
                    </p>

                    <p
                      style={{
                        color: "#0B7A53",
                        fontSize: "17px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      A등급: 80~89% / 검토 추천
                    </p>

                    <p
                      style={{
                        color: "#E65F00",
                        fontSize: "17px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      B등급: 70~79% / 보완 필요
                    </p>

                    <p
                      style={{
                        color: "#CD2E3A",
                        fontSize: "17px",
                        fontWeight: 900,
                      }}
                    >
                      C등급: 70% 미만 / 낮은 적합도
                    </p>
                  </div>
                )}
              </div>

              <div
                style={{
                  width: "130px",
                  height: "3px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, rgba(52,75,160,0) 100%)",
                  marginTop: "24px",
                }}
              />
            </div>

            <p
              style={{
                color: "#667085",
                fontSize: "16px",
                lineHeight: 1.8,
                fontWeight: 900,
                margin: 0,
              }}
            >
              설비별로 연결 가능한 지원사업과 신청 우선순위를 확인하세요.
              마우스를 올리면 해당 설비 근처에 상세 매칭 정보가 표시됩니다.
            </p>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "34px",
              padding: "34px",
              boxShadow: "0 24px 64px rgba(6,27,52,.10)",
              overflow: "visible",
            }}
          >
            <div
              onMouseLeave={() => onHoveredProcessStepChange(null)}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: "16px",
                position: "relative",
                minHeight: "420px",
              }}
            >
              {processItems.map((item) => {
                const selected = item.step === hoveredProcessStep
                const color = getToneColor(item.tone)
                const softColor = getToneSoftColor(item.tone)

                return (
                  <article
                    key={item.step}
                    onMouseEnter={() => onHoveredProcessStepChange(item.step)}
                    onClick={() => onHoveredProcessStepChange(item.step)}
                    style={{
                      position: "relative",
                      background: "#FFFFFF",
                      border: selected
                        ? "4px solid #344BA0"
                        : "1px solid #E2E8F0",
                      borderRadius: "28px",
                      padding: "24px",
                      minHeight: "400px",
                      boxShadow: selected
                        ? "0 24px 58px rgba(52,75,160,.18)"
                        : "0 10px 25px rgba(0,0,0,0.04)",
                      transition: "all .18s ease",
                      cursor: "pointer",
                      zIndex: selected ? 3 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "20px",
                      }}
                    >
                      <b
                        style={{
                          color: "#667085",
                          fontFamily: "DM Mono, monospace",
                          fontSize: "28px",
                          fontWeight: 500,
                        }}
                      >
                        {item.step}
                      </b>

                      <span
                        style={{
                          background: softColor,
                          color,
                          padding: "8px 11px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 900,
                        }}
                      >
                        {item.grade} {item.score}%
                      </span>
                    </div>

                    <div
                      style={{
                        height: "150px",
                        borderRadius: "24px",
                        background: getEquipmentGradient(item.tone),
                        border: "1px solid #E2E8F0",
                        display: "grid",
                        placeItems: "center",
                        marginBottom: "28px",
                        boxShadow: "inset 0 -36px 60px rgba(6,27,52,.04)",
                      }}
                    >
                      <div
                        style={{
                          width: "82px",
                          height: "82px",
                          borderRadius: "24px",
                          background: "#061B34",
                          color: "#FFFFFF",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "36px",
                          boxShadow: `0 22px 44px ${color}33`,
                        }}
                      >
                        {item.icon}
                      </div>
                    </div>

                    <h3
                      style={{
                        color: "#061B34",
                        fontSize: "24px",
                        lineHeight: 1.25,
                        fontWeight: 900,
                        letterSpacing: "-0.5px",
                        marginBottom: "12px",
                      }}
                    >
                      {item.title}
                    </h3>

                    <strong
                      style={{
                        display: "block",
                        color,
                        fontSize: "15px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      {item.status}
                    </strong>

                    <p
                      style={{
                        color: "#667085",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        fontWeight: 800,
                      }}
                    >
                      {item.description}
                    </p>
                  </article>
                )
              })}

              {selectedProcess && (
                <div
                  style={{
                    position: "absolute",
                    top: "58px",
                    left: getProcessTooltipLeft(selectedProcess.step),
                    transform: "translateX(-50%)",
                    width: "330px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "28px",
                    padding: "26px",
                    zIndex: 20,
                    boxShadow: "0 34px 76px rgba(6,27,52,.18)",
                    pointerEvents: "none",
                  }}
                >
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "30px",
                      lineHeight: 1.2,
                      fontWeight: 900,
                      letterSpacing: "-0.8px",
                      marginBottom: "18px",
                    }}
                  >
                    {selectedProcess.title}
                  </h3>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginBottom: "20px",
                    }}
                  >
                    <span className="badge green">지원 가능</span>
                    <span className="badge blue">우선 추천</span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "999px",
                        padding: "7px 11px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        color: "#667085",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      추천 대상
                    </span>
                  </div>

                  {[
                    ["지원사업", selectedProcess.supportProgram],
                    ["예상 지원금", selectedProcess.expectedSupport],
                    ["적합도", `${selectedProcess.score}%`],
                    ["신청 가능", selectedProcess.applicationStatus],
                    ["다음 단계", selectedProcess.nextStep],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "110px 1fr",
                        gap: "16px",
                        padding: "14px 0",
                        borderTop: "1px solid #E2E8F0",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          color: "#667085",
                          fontSize: "16px",
                          fontWeight: 900,
                        }}
                      >
                        {label}
                      </span>

                      <strong
                        style={{
                          color: "#061B34",
                          fontSize: "18px",
                          fontWeight: 900,
                          textAlign: "right",
                          lineHeight: 1.35,
                        }}
                      >
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className="summary-hero-card"
            style={{
              marginTop: "28px",
              borderLeftColor: "#344BA0",
              padding: "30px 34px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
                gap: "20px",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  color: "#061B34",
                  fontSize: "28px",
                  fontWeight: 900,
                  letterSpacing: "-0.6px",
                }}
              >
                AI 추천 요약
              </h3>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  추천 설비
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#061B34",
                    fontSize: "26px",
                    fontWeight: 900,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.title}
                </b>
              </div>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  예상 지원금
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#344BA0",
                    fontFamily: "DM Mono, monospace",
                    fontSize: "30px",
                    fontWeight: 500,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.expectedSupport}
                </b>
              </div>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  예상 ROI
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#061B34",
                    fontFamily: "DM Mono, monospace",
                    fontSize: "30px",
                    fontWeight: 500,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.roi}
                </b>
              </div>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  회수기간
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#061B34",
                    fontFamily: "DM Mono, monospace",
                    fontSize: "30px",
                    fontWeight: 500,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.payback}
                </b>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              marginTop: "28px",
            }}
          >
            <div
              className="card"
              style={{
                padding: "32px",
                borderRadius: "32px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <h3
                  style={{
                    color: "#061B34",
                    fontSize: "28px",
                    fontWeight: 900,
                    letterSpacing: "-0.6px",
                  }}
                >
                  추천 근거
                </h3>

                <button
                  type="button"
                  onClick={() => onToggleReasons()}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#667085",
                    fontSize: "22px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {showAllReasons ? "−" : "+"}
                </button>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {visibleReasons.map((reason) => (
                  <div
                    key={reason.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px 1fr",
                      gap: "14px",
                      alignItems: "start",
                    }}
                  >
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: "#E8F5EF",
                        color: "#0B7A53",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                      }}
                    >
                      ✓
                    </span>

                    <div>
                      <strong
                        style={{
                          display: "block",
                          color: "#061B34",
                          fontSize: "17px",
                          fontWeight: 900,
                          marginBottom: "6px",
                        }}
                      >
                        {reason.title}
                      </strong>

                      <p
                        style={{
                          color: "#667085",
                          fontSize: "14px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                        }}
                      >
                        {reason.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: "32px",
                borderRadius: "32px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <h3
                  style={{
                    color: "#061B34",
                    fontSize: "28px",
                    fontWeight: 900,
                    letterSpacing: "-0.6px",
                  }}
                >
                  🚨 D-DAY 공고
                </h3>

                <button
                  type="button"
                  onClick={() => onToggleDdays()}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#667085",
                    fontSize: "22px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {showAllDdays ? "−" : "+"}
                </button>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {visibleDdays.map((item) => (
                  <div
                    key={item.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "16px",
                      alignItems: "center",
                      padding: "18px 0",
                      borderTop: "1px solid #E2E8F0",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          display: "block",
                          color: "#061B34",
                          fontSize: "18px",
                          fontWeight: 900,
                          marginBottom: "6px",
                        }}
                      >
                        {item.title}
                      </strong>

                      <span
                        style={{
                          color: "#667085",
                          fontSize: "15px",
                          fontWeight: 900,
                        }}
                      >
                        {item.amount}
                      </span>
                    </div>

                    <b
                      style={{
                        color: "#E65F00",
                        fontFamily: "DM Mono, monospace",
                        fontSize: "28px",
                        fontWeight: 500,
                      }}
                    >
                      {item.dday}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
  )
}
