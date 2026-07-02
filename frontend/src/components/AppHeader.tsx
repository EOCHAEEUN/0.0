import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  resolveApplicationDraftNavigationPath,
  resolveRoiNavigationPath,
  resolveSupportProjectsNavigationPath,
} from "../features/roi/roiNavigation"

type NavItem = {
  label: string
  path: string
}

type InquiryStatus = "접수완료" | "답변대기" | "답변완료"

type InquiryItem = {
  id: string
  category: string
  title: string
  message: string
  answer?: string
  status: InquiryStatus
  createdAt: string
}

const navItems: NavItem[] = [
  {
    label: "대시보드",
    path: "/",
  },
  {
    label: "ROI 분석",
    path: "/roi",
  },
  {
    label: "지원사업",
    path: "/support-projects/priority",
  },
  {
    label: "신청서 생성",
    path: "/application-draft",
  },
  {
    label: "안전점검",
    path: "/safety",
  },
  {
    label: "AI Advisor",
    path: "/advisor",
  },
]

const INQUIRY_STORAGE_KEY = "factofit_customer_inquiries"

function createInquiryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `inquiry-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadInquiryHistory(): InquiryItem[] {
  try {
    if (typeof window === "undefined") return []

    const raw = window.localStorage.getItem(INQUIRY_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as InquiryItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveInquiryHistory(items: InquiryItem[]) {
  window.localStorage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(items))
}

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()

  const [isInquiryOpen, setIsInquiryOpen] = useState(false)
  const [inquiries, setInquiries] = useState<InquiryItem[]>(() =>
    loadInquiryHistory(),
  )

  const [category, setCategory] = useState("서비스 이용 문의")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null)

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/"
    }

    return location.pathname.startsWith(path)
  }

  const selectedInquiry =
    inquiries.find((item) => item.id === selectedInquiryId) ?? inquiries[0]

  const handleSubmitInquiry = () => {
    if (!title.trim() || !message.trim()) {
      window.alert("문의 제목과 내용을 입력해주세요.")
      return
    }

    const newInquiry: InquiryItem = {
      id: createInquiryId(),
      category,
      title: title.trim(),
      message: message.trim(),
      status: "접수완료",
      createdAt: new Date().toISOString(),
      answer:
        "문의가 접수되었습니다. 실제 상담 답변은 고객문의 API 연결 후 관리자 답변으로 저장될 예정입니다.",
    }

    const nextItems = [newInquiry, ...inquiries]

    setInquiries(nextItems)
    saveInquiryHistory(nextItems)
    setSelectedInquiryId(newInquiry.id)
    setTitle("")
    setMessage("")
  }

  const handleClearInquiries = () => {
    const confirmed = window.confirm("저장된 고객문의 기록을 모두 삭제할까요?")
    if (!confirmed) return

    setInquiries([])
    saveInquiryHistory([])
    setSelectedInquiryId(null)
  }

  const handleNavigation = async (item: NavItem) => {
    if (item.label === "ROI 분석") {
      navigate(await resolveRoiNavigationPath(location.pathname, location.search))
      return
    }
    if (item.label === "지원사업") {
      navigate(
        await resolveSupportProjectsNavigationPath(location.pathname, location.search),
      )
      return
    }
    if (item.label === "신청서 생성") {
      navigate(
        await resolveApplicationDraftNavigationPath(location.pathname, location.search),
      )
      return
    }
    navigate(item.path)
  }

  return (
    <>
      <header
        style={{
          position: "relative",
          padding: "28px clamp(22px,5vw,80px) 0",
          background: "#F8FAFC",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/login")}
          style={{
            position: "absolute",
            left: "28px",
            top: "28px",
            zIndex: 20,
            height: "44px",
            padding: "0 18px",
            borderRadius: "999px",
            border: "1px solid rgba(6,27,52,.16)",
            background: "#061B34",
            color: "#FFFFFF",
            fontSize: "14px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 14px 34px rgba(6,27,52,.16)",
            whiteSpace: "nowrap",
          }}
        >
          ← 메인으로
        </button>

        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "0 auto",
            minHeight: "76px",
            borderRadius: "0 0 28px 28px",
            background: "#061B34",
            color: "#FFFFFF",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: "28px",
            alignItems: "center",
            padding: "14px 28px",
            boxShadow: "0 18px 42px rgba(6,27,52,.18)",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="FactoFit 대시보드로 이동"
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "16px",
              border: "0",
              background: "#FFFFFF",
              color: "#344BA0",
              display: "grid",
              placeItems: "center",
              fontSize: "28px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(0,0,0,.12)",
            }}
          >
            F
          </button>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            {navItems.map((item) => {
              const active = isActive(item.path)

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => void handleNavigation(item)}
                  style={{
                    height: "44px",
                    padding: "0 16px",
                    borderRadius: "999px",
                    border: active ? "0" : "1px solid rgba(255,255,255,.14)",
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? "#061B34" : "#E5EEF8",
                    fontSize: "15px",
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => setIsInquiryOpen(true)}
              style={{
                height: "44px",
                padding: "0 18px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,.22)",
                background: "rgba(255,255,255,.08)",
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              고객문의
            </button>

            <button
              type="button"
              onClick={() => navigate("/mypage")}
              style={{
                height: "44px",
                padding: "0 18px",
                borderRadius: "999px",
                border:
                  location.pathname === "/mypage"
                    ? "0"
                    : "1px solid rgba(255,255,255,.22)",
                background:
                  location.pathname === "/mypage"
                    ? "#FFFFFF"
                    : "rgba(255,255,255,.08)",
                color: location.pathname === "/mypage" ? "#061B34" : "#FFFFFF",
                fontSize: "15px",
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              마이페이지
            </button>
          </div>
        </div>
      </header>

      {isInquiryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="고객문의"
          onClick={() => setIsInquiryOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(6,27,52,.54)",
            backdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            padding: "32px",
          }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "86vh",
              overflow: "hidden",
              background: "#FFFFFF",
              borderRadius: "34px",
              boxShadow: "0 30px 80px rgba(6,27,52,.34)",
              display: "grid",
              gridTemplateRows: "auto 1fr",
            }}
          >
            <div
              style={{
                padding: "30px 34px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                gap: "20px",
                alignItems: "center",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    height: "32px",
                    padding: "0 14px",
                    borderRadius: "999px",
                    alignItems: "center",
                    background: "#EEF2FF",
                    color: "#344BA0",
                    fontSize: "12px",
                    fontWeight: 900,
                    letterSpacing: ".8px",
                    marginBottom: "12px",
                  }}
                >
                  CUSTOMER SUPPORT
                </span>

                <h2
                  style={{
                    color: "#061B34",
                    fontSize: "32px",
                    fontWeight: 950,
                    letterSpacing: "-.8px",
                    margin: 0,
                  }}
                >
                  고객문의
                </h2>

                <p
                  style={{
                    color: "#667085",
                    fontSize: "14px",
                    fontWeight: 800,
                    margin: "8px 0 0",
                  }}
                >
                  문의 작성, 상담목록, 문의 상세내역을 확인할 수 있습니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsInquiryOpen(false)}
                aria-label="고객문의 닫기"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "999px",
                  border: "1px solid #E2E8F0",
                  background: "#FFFFFF",
                  color: "#061B34",
                  fontSize: "24px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "28px 34px 34px",
                overflow: "auto",
                display: "grid",
                gridTemplateColumns: "0.9fr 1.1fr",
                gap: "24px",
                background: "#F8FAFC",
              }}
            >
              <section
                style={{
                  display: "grid",
                  gap: "18px",
                  alignContent: "start",
                }}
              >
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "26px",
                    padding: "24px",
                  }}
                >
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "22px",
                      fontWeight: 950,
                      margin: 0,
                    }}
                  >
                    새 문의 등록
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gap: "14px",
                      marginTop: "18px",
                    }}
                  >
                    <label
                      style={{
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "#667085",
                          fontSize: "13px",
                          fontWeight: 900,
                        }}
                      >
                        문의 유형
                      </span>

                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        style={{
                          height: "48px",
                          borderRadius: "16px",
                          border: "1px solid #E2E8F0",
                          padding: "0 14px",
                          color: "#061B34",
                          fontSize: "14px",
                          fontWeight: 800,
                          outline: "none",
                          background: "#FFFFFF",
                        }}
                      >
                        <option>서비스 이용 문의</option>
                        <option>ROI 분석 문의</option>
                        <option>지원사업 문의</option>
                        <option>신청서 생성 문의</option>
                        <option>안전점검 문의</option>
                        <option>계정/로그인 문의</option>
                        <option>오류 신고</option>
                      </select>
                    </label>

                    <label
                      style={{
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "#667085",
                          fontSize: "13px",
                          fontWeight: 900,
                        }}
                      >
                        문의 제목
                      </span>

                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="예: ROI 분석 결과가 저장되지 않습니다"
                        style={{
                          height: "48px",
                          borderRadius: "16px",
                          border: "1px solid #E2E8F0",
                          padding: "0 14px",
                          color: "#061B34",
                          fontSize: "14px",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label
                      style={{
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "#667085",
                          fontSize: "13px",
                          fontWeight: 900,
                        }}
                      >
                        문의 내용
                      </span>

                      <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="상담받고 싶은 내용을 입력해주세요."
                        style={{
                          minHeight: "128px",
                          resize: "vertical",
                          borderRadius: "18px",
                          border: "1px solid #E2E8F0",
                          padding: "14px",
                          color: "#061B34",
                          fontSize: "14px",
                          fontWeight: 800,
                          lineHeight: 1.6,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleSubmitInquiry}
                      style={{
                        height: "50px",
                        borderRadius: "16px",
                        border: "0",
                        background: "#344BA0",
                        color: "#FFFFFF",
                        fontSize: "15px",
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow: "0 12px 28px rgba(52,75,160,.22)",
                      }}
                    >
                      문의 저장하기
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "26px",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <h3
                      style={{
                        color: "#061B34",
                        fontSize: "22px",
                        fontWeight: 950,
                        margin: 0,
                      }}
                    >
                      내 문의 목록
                    </h3>

                    {inquiries.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearInquiries}
                        style={{
                          border: "0",
                          background: "transparent",
                          color: "#CD2E3A",
                          fontSize: "12px",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        전체 삭제
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      maxHeight: "280px",
                      overflow: "auto",
                    }}
                  >
                    {inquiries.length === 0 ? (
                      <div
                        style={{
                          border: "1px dashed #CBD5E1",
                          borderRadius: "20px",
                          padding: "24px",
                          color: "#667085",
                          fontSize: "14px",
                          fontWeight: 800,
                          textAlign: "center",
                        }}
                      >
                        저장된 문의 기록이 없습니다.
                      </div>
                    ) : (
                      inquiries.map((item) => {
                        const active = selectedInquiry?.id === item.id

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedInquiryId(item.id)}
                            style={{
                              textAlign: "left",
                              borderRadius: "18px",
                              border: active
                                ? "1px solid #344BA0"
                                : "1px solid #E2E8F0",
                              background: active ? "#EEF2FF" : "#FFFFFF",
                              padding: "16px",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "10px",
                                marginBottom: "8px",
                              }}
                            >
                              <strong
                                style={{
                                  color: "#061B34",
                                  fontSize: "14px",
                                  fontWeight: 950,
                                  lineHeight: 1.4,
                                }}
                              >
                                {item.title}
                              </strong>

                              <span
                                style={{
                                  color:
                                    item.status === "답변완료"
                                      ? "#0B7A53"
                                      : "#E65F00",
                                  fontSize: "11px",
                                  fontWeight: 900,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.status}
                              </span>
                            </div>

                            <p
                              style={{
                                color: "#667085",
                                fontSize: "12px",
                                fontWeight: 800,
                                margin: 0,
                              }}
                            >
                              {item.category} ·{" "}
                              {new Date(item.createdAt).toLocaleDateString()}
                            </p>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </section>

              <section
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "26px",
                  padding: "28px",
                  minHeight: "540px",
                }}
              >
                <h3
                  style={{
                    color: "#061B34",
                    fontSize: "24px",
                    fontWeight: 950,
                    margin: 0,
                  }}
                >
                  선택한 문의 상세
                </h3>

                {selectedInquiry ? (
                  <article
                    style={{
                      marginTop: "22px",
                      display: "grid",
                      gap: "18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          height: "30px",
                          padding: "0 12px",
                          borderRadius: "999px",
                          background: "#EEF2FF",
                          color: "#344BA0",
                          fontSize: "12px",
                          fontWeight: 900,
                        }}
                      >
                        {selectedInquiry.category}
                      </span>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          height: "30px",
                          padding: "0 12px",
                          borderRadius: "999px",
                          background:
                            selectedInquiry.status === "답변완료"
                              ? "#E6F6EF"
                              : "#FFF4E5",
                          color:
                            selectedInquiry.status === "답변완료"
                              ? "#0B7A53"
                              : "#B45309",
                          fontSize: "12px",
                          fontWeight: 900,
                        }}
                      >
                        {selectedInquiry.status}
                      </span>
                    </div>

                    <div
                      style={{
                        borderBottom: "1px solid #E2E8F0",
                        paddingBottom: "18px",
                      }}
                    >
                      <h4
                        style={{
                          color: "#061B34",
                          fontSize: "24px",
                          fontWeight: 950,
                          letterSpacing: "-.5px",
                          lineHeight: 1.4,
                          margin: 0,
                        }}
                      >
                        {selectedInquiry.title}
                      </h4>

                      <p
                        style={{
                          color: "#94A3B8",
                          fontSize: "13px",
                          fontWeight: 800,
                          margin: "10px 0 0",
                        }}
                      >
                        {new Date(selectedInquiry.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#061B34",
                          fontSize: "15px",
                          fontWeight: 950,
                        }}
                      >
                        질문 내용
                      </strong>

                      <p
                        style={{
                          color: "#334155",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "20px",
                          padding: "18px",
                          fontSize: "14px",
                          fontWeight: 800,
                          lineHeight: 1.8,
                          whiteSpace: "pre-wrap",
                          margin: 0,
                        }}
                      >
                        {selectedInquiry.message}
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#061B34",
                          fontSize: "15px",
                          fontWeight: 950,
                        }}
                      >
                        상담 답변
                      </strong>

                      <p
                        style={{
                          color: "#334155",
                          background: "#EEF2FF",
                          border: "1px solid #C7D2FE",
                          borderRadius: "20px",
                          padding: "18px",
                          fontSize: "14px",
                          fontWeight: 800,
                          lineHeight: 1.8,
                          whiteSpace: "pre-wrap",
                          margin: 0,
                        }}
                      >
                        {selectedInquiry.answer ?? "아직 답변이 없습니다."}
                      </p>
                    </div>
                  </article>
                ) : (
                  <div
                    style={{
                      height: "440px",
                      border: "1px dashed #CBD5E1",
                      borderRadius: "24px",
                      display: "grid",
                      placeItems: "center",
                      color: "#667085",
                      fontSize: "15px",
                      fontWeight: 900,
                      marginTop: "22px",
                      textAlign: "center",
                    }}
                  >
                    문의를 작성하면 상세내역이 이곳에 표시됩니다.
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
