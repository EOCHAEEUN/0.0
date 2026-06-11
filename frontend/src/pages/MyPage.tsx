import { useState } from "react"
import AppHeader from "../components/AppHeader"

type BasicInfo = {
  name: string
  email: string
  manager: string
  phone: string
}

type CompanyInfo = {
  industry: string
  region: string
  employees: string
  companySize: string
  purpose: string
}

type EquipmentInfo = {
  id: number
  name: string
  process: string
  years: string
  status: string
}

type SavedPolicy = {
  id: number
  title: string
  organization: string
  amount: string
  fit: string
  dday: string
}

type AnalysisHistory = {
  id: number
  title: string
  date: string
  result: string
  status: "완료" | "확인 필요"
}

const savedPolicies: SavedPolicy[] = [
  {
    id: 1,
    title: "스마트공장 구축 및 고도화 지원사업",
    organization: "중소벤처기업부",
    amount: "최대 1억원",
    fit: "92%",
    dday: "D-42",
  },
  {
    id: 2,
    title: "고효율 설비 교체 지원사업",
    organization: "한국에너지공단",
    amount: "최대 8,400만원",
    fit: "88%",
    dday: "D-67",
  },
  {
    id: 3,
    title: "중소기업 혁신바우처",
    organization: "중소벤처기업진흥공단",
    amount: "최대 5,000만원",
    fit: "74%",
    dday: "D-112",
  },
]

const analysisHistories: AnalysisHistory[] = [
  {
    id: 1,
    title: "프레스 설비 ROI 분석",
    date: "2026.06.10",
    result: "예상 ROI 85% · 회수기간 14개월",
    status: "완료",
  },
  {
    id: 2,
    title: "설비 안전점검",
    date: "2026.06.10",
    result: "안전 점수 72/100 · 정밀점검 권고",
    status: "완료",
  },
  {
    id: 3,
    title: "지원사업 신청서 초안",
    date: "2026.06.10",
    result: "견적서 첨부 및 사업계획서 문장 보완 필요",
    status: "확인 필요",
  },
]

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: "9px",
      }}
    >
      <span
        style={{
          color: "#667085",
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: "52px",
          borderRadius: "18px",
          border: "1px solid #E2E8F0",
          background: "#FFFFFF",
          color: "#061B34",
          padding: "0 16px",
          fontSize: "15px",
          fontWeight: 800,
          outline: "none",
        }}
      />
    </label>
  )
}

export default function MyPage() {
  const [saved, setSaved] = useState(false)

  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name: "임평우",
    email: "lpw5894@gmail.com",
    manager: "임평우",
    phone: "010-0000-0000",
  })

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    industry: "금속 가공업",
    region: "경기 안산시",
    employees: "45명",
    companySize: "중소기업",
    purpose: "설비 교체 / 에너지 절감",
  })

  const [equipmentList, setEquipmentList] = useState<EquipmentInfo[]>([
    {
      id: 1,
      name: "유압 프레스 라인 A",
      process: "프레스 성형",
      years: "15년",
      status: "교체 권고",
    },
    {
      id: 2,
      name: "CNC 선반 B-3호기",
      process: "CNC 가공",
      years: "11년",
      status: "점검 필요",
    },
    {
      id: 3,
      name: "자동 용접기 W-2",
      process: "용접 공정",
      years: "4년",
      status: "정상",
    },
  ])

  const updateEquipment = (
    id: number,
    key: keyof EquipmentInfo,
    value: string,
  ) => {
    setEquipmentList((prev) =>
      prev.map((equipment) =>
        equipment.id === id
          ? {
              ...equipment,
              [key]: value,
            }
          : equipment,
      ),
    )
  }

  const handleSave = () => {
    setSaved(true)

    window.setTimeout(() => {
      setSaved(false)
    }, 2200)
  }

  return (
    <main className="page">
      <AppHeader />

      <section
        style={{
          background: "#F8FAFC",
          padding: "56px clamp(22px,5vw,80px) 90px",
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
              gridTemplateColumns: "1fr 0.85fr",
              gap: "40px",
              alignItems: "end",
              marginBottom: "34px",
            }}
          >
            <div>
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

              <div className="screen-tag">FACTOFIT MY PAGE</div>

              <div
                className="label"
                style={{
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                ACCOUNT & COMPANY PROFILE
              </div>

              <h1
                style={{
                  color: "#061B34",
                  fontSize: "56px",
                  lineHeight: 1.12,
                  fontWeight: 900,
                  letterSpacing: "-2px",
                  margin: 0,
                }}
              >
                내 정보와 기업 정보를 <br />
                한곳에서 관리합니다.
              </h1>

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
              기본 정보, 기업정보, 설비현황을 수정하고 저장한 지원사업과 최근
              분석 기록을 확인할 수 있습니다.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "18px",
              marginBottom: "28px",
            }}
          >
            {[
              ["저장 지원사업", "3건", "#0B7A53"],
              ["등록 설비", "3대", "#344BA0"],
              ["최근 분석", "3건", "#E65F00"],
              ["신청 준비도", "73%", "#CD2E3A"],
            ].map(([label, value, color]) => (
              <div
                key={label}
                className="card"
                style={{
                  padding: "26px",
                  borderRadius: "26px",
                  borderLeft: `7px solid ${color}`,
                }}
              >
                <span
                  style={{
                    display: "block",
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                    marginBottom: "12px",
                  }}
                >
                  {label}
                </span>

                <b
                  style={{
                    display: "block",
                    color,
                    fontFamily: "DM Mono, monospace",
                    fontSize: "34px",
                    fontWeight: 500,
                    letterSpacing: "-1px",
                  }}
                >
                  {value}
                </b>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              alignItems: "start",
            }}
          >
            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "30px 34px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2
                    style={{
                      color: "#061B34",
                      fontSize: "28px",
                      fontWeight: 900,
                      letterSpacing: "-0.6px",
                    }}
                  >
                    기본 정보
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    담당자와 계정 정보를 수정할 수 있습니다.
                  </p>
                </div>

                <span className="badge blue">수정 가능</span>
              </div>

              <div
                style={{
                  padding: "34px",
                  display: "grid",
                  gap: "18px",
                }}
              >
                <Field
                  label="이름"
                  value={basicInfo.name}
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      name: value,
                    }))
                  }
                />

                <Field
                  label="이메일"
                  value={basicInfo.email}
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      email: value,
                    }))
                  }
                />

                <Field
                  label="담당자명"
                  value={basicInfo.manager}
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      manager: value,
                    }))
                  }
                />

                <Field
                  label="연락처"
                  value={basicInfo.phone}
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      phone: value,
                    }))
                  }
                />
              </div>
            </section>

            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "30px 34px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2
                    style={{
                      color: "#061B34",
                      fontSize: "28px",
                      fontWeight: 900,
                      letterSpacing: "-0.6px",
                    }}
                  >
                    기업정보
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    지원사업 추천 기준으로 사용되는 정보입니다.
                  </p>
                </div>

                <span className="badge green">매칭 기준</span>
              </div>

              <div
                style={{
                  padding: "34px",
                  display: "grid",
                  gap: "18px",
                }}
              >
                <Field
                  label="업종"
                  value={companyInfo.industry}
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({
                      ...prev,
                      industry: value,
                    }))
                  }
                />

                <Field
                  label="지역"
                  value={companyInfo.region}
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({
                      ...prev,
                      region: value,
                    }))
                  }
                />

                <Field
                  label="종업원 수"
                  value={companyInfo.employees}
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({
                      ...prev,
                      employees: value,
                    }))
                  }
                />

                <Field
                  label="기업규모"
                  value={companyInfo.companySize}
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({
                      ...prev,
                      companySize: value,
                    }))
                  }
                />

                <Field
                  label="주요 목적"
                  value={companyInfo.purpose}
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({
                      ...prev,
                      purpose: value,
                    }))
                  }
                />
              </div>
            </section>
          </div>

          <section
            className="card"
            style={{
              borderRadius: "32px",
              overflow: "hidden",
              marginTop: "24px",
            }}
          >
            <div
              style={{
                padding: "30px 34px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    color: "#061B34",
                    fontSize: "28px",
                    fontWeight: 900,
                    letterSpacing: "-0.6px",
                  }}
                >
                  설비현황
                </h2>

                <p
                  style={{
                    color: "#667085",
                    fontSize: "14px",
                    fontWeight: 800,
                    marginTop: "8px",
                  }}
                >
                  설비명, 공정, 사용연수, 상태를 수정할 수 있습니다.
                </p>
              </div>

              <span className="badge orange">ROI·안전점검 기준</span>
            </div>

            <div
              style={{
                padding: "34px",
                display: "grid",
                gap: "18px",
              }}
            >
              {equipmentList.map((equipment) => (
                <div
                  key={equipment.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 0.8fr 0.9fr",
                    gap: "14px",
                    padding: "18px",
                    border: "1px solid #E2E8F0",
                    borderRadius: "24px",
                    background: "#F8FAFC",
                  }}
                >
                  <Field
                    label="설비명"
                    value={equipment.name}
                    onChange={(value) =>
                      updateEquipment(equipment.id, "name", value)
                    }
                  />

                  <Field
                    label="공정"
                    value={equipment.process}
                    onChange={(value) =>
                      updateEquipment(equipment.id, "process", value)
                    }
                  />

                  <Field
                    label="사용연수"
                    value={equipment.years}
                    onChange={(value) =>
                      updateEquipment(equipment.id, "years", value)
                    }
                  />

                  <Field
                    label="상태"
                    value={equipment.status}
                    onChange={(value) =>
                      updateEquipment(equipment.id, "status", value)
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              alignItems: "start",
              marginTop: "24px",
            }}
          >
            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "30px 34px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2
                    style={{
                      color: "#061B34",
                      fontSize: "28px",
                      fontWeight: 900,
                      letterSpacing: "-0.6px",
                    }}
                  >
                    저장한 지원사업
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    북마크한 지원사업을 다시 확인할 수 있습니다.
                  </p>
                </div>

                <span className="badge green">북마크</span>
              </div>

              <div
                style={{
                  padding: "34px",
                  display: "grid",
                  gap: "16px",
                }}
              >
                {savedPolicies.map((policy) => (
                  <article
                    key={policy.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "24px",
                      padding: "20px",
                      background: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            color: "#061B34",
                            fontSize: "18px",
                            fontWeight: 900,
                            lineHeight: 1.35,
                          }}
                        >
                          {policy.title}
                        </h3>

                        <p
                          style={{
                            color: "#667085",
                            fontSize: "13px",
                            fontWeight: 800,
                            marginTop: "8px",
                          }}
                        >
                          {policy.organization} · {policy.amount}
                        </p>
                      </div>

                      <b
                        style={{
                          color: "#E65F00",
                          fontFamily: "DM Mono, monospace",
                          fontSize: "22px",
                          fontWeight: 500,
                        }}
                      >
                        {policy.dday}
                      </b>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        marginTop: "16px",
                      }}
                    >
                      <span className="badge blue">적합도 {policy.fit}</span>
                      <span className="badge green">저장됨</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              className="card"
              style={{
                borderRadius: "32px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "30px 34px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2
                    style={{
                      color: "#061B34",
                      fontSize: "28px",
                      fontWeight: 900,
                      letterSpacing: "-0.6px",
                    }}
                  >
                    최근 분석 기록
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      marginTop: "8px",
                    }}
                  >
                    최근 실행한 분석과 신청서 작업을 확인합니다.
                  </p>
                </div>

                <span className="badge blue">히스토리</span>
              </div>

              <div
                style={{
                  padding: "34px",
                  display: "grid",
                  gap: "16px",
                }}
              >
                {analysisHistories.map((history) => (
                  <article
                    key={history.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderLeft:
                        history.status === "완료"
                          ? "6px solid #0B7A53"
                          : "6px solid #E65F00",
                      borderRadius: "24px",
                      padding: "20px",
                      background: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            color: "#061B34",
                            fontSize: "18px",
                            fontWeight: 900,
                            lineHeight: 1.35,
                          }}
                        >
                          {history.title}
                        </h3>

                        <p
                          style={{
                            color: "#667085",
                            fontSize: "13px",
                            fontWeight: 800,
                            marginTop: "8px",
                          }}
                        >
                          {history.result}
                        </p>
                      </div>

                      <span
                        className={
                          history.status === "완료"
                            ? "badge green"
                            : "badge orange"
                        }
                      >
                        {history.status}
                      </span>
                    </div>

                    <p
                      style={{
                        color: "#94A3B8",
                        fontSize: "12px",
                        fontWeight: 800,
                        marginTop: "14px",
                      }}
                    >
                      {history.date}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div
            style={{
              marginTop: "28px",
              display: "flex",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <button
              type="button"
              className="btn blue"
              onClick={handleSave}
              style={{
                minWidth: "180px",
              }}
            >
              변경사항 저장
            </button>

            <button
              type="button"
              className="btn dark"
              onClick={() => window.alert("프로필 초기화 기능은 준비 중입니다.")}
              style={{
                minWidth: "180px",
              }}
            >
              초기화
            </button>
          </div>

          {saved && (
            <div
              style={{
                position: "fixed",
                right: "32px",
                bottom: "32px",
                zIndex: 100,
                background: "#061B34",
                color: "#FFFFFF",
                borderRadius: "999px",
                padding: "16px 22px",
                fontSize: "14px",
                fontWeight: 900,
                boxShadow: "0 18px 42px rgba(6,27,52,.24)",
              }}
            >
              변경사항이 저장되었습니다.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}