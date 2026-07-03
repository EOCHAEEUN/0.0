import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { clearAuthSession } from "../../services/auth"
import { clearUserOnboardingData } from "../../features/onboarding/onboardingState"
import {
  resolveApplicationDraftNavigationPath,
  resolveRoiNavigationPath,
  resolveSupportProjectsNavigationPath,
} from "../../features/roi/roiNavigation"

// ─── 네비게이션 메뉴 정의 ───────────────────────────────────────────────────

type NavItem = {
  label: string
  path: string
  matchPrefixes: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "설비 대시보드",
    path: "/dashboard",
    matchPrefixes: ["/dashboard", "/"],
  },
  {
    label: "ROI 분석",
    path: "/roi/strategy",
    matchPrefixes: ["/roi", "/analysis"],
  },
  {
    label: "지원사업 추천",
    path: "/support-projects/priority",
    matchPrefixes: ["/support-projects", "/support-detail"],
  },
  {
    label: "신청서 작성",
    path: "/application-draft",
    matchPrefixes: ["/application-draft"],
  },
  {
    label: "안전개선 근거",
    path: "/safety",
    matchPrefixes: ["/safety"],
  },
  {
    label: "설비 관리",
    path: "/company",
    matchPrefixes: ["/company", "/mypage"],
  },
]

// ─── active 판별 ─────────────────────────────────────────────────────────────

function isItemActive(item: NavItem, pathname: string): boolean {
  const isPolicyAnalysisPath = /^\/analysis\/[^/]+\/policies(?:\/.*)?$/.test(pathname)
  const isRoiAnalysisPath =
    pathname === "/roi" ||
    pathname.startsWith("/roi/") ||
    pathname === "/analysis/new" ||
    pathname.startsWith("/analysis/new/") ||
    pathname === "/analysis/review" ||
    pathname.startsWith("/analysis/review/") ||
    /^\/analysis\/[^/]+(?:\/result)?$/.test(pathname)

  if (item.label === "지원사업 추천" && isPolicyAnalysisPath) return true
  if (item.label === "ROI 분석") return isRoiAnalysisPath

  return item.matchPrefixes.some((prefix) => {
    if (prefix === "/") return pathname === "/"
    return (
      pathname === prefix ||
      pathname.startsWith(prefix + "/") ||
      pathname.startsWith(prefix + "?")
    )
  })
}

// ─── 색상 토큰 (딥 네이비 계열) ─────────────────────────────────────────────

const TOKEN = {
  /** 헤더 배경: FactoFit 브랜드 딥 네이비 */
  headerBg: "#0B1F42",
  /** 헤더 하단 보더 */
  headerBorder: "rgba(255,255,255,0.08)",
  /** 비활성 메뉴 텍스트 */
  navText: "rgba(203,213,225,0.9)",
  /** 비활성 메뉴 hover 배경 */
  navHover: "rgba(255,255,255,0.07)",
  /** 활성 메뉴 배경 */
  activeBg: "rgba(255,255,255,0.12)",
  /** 활성 메뉴 텍스트 */
  activeText: "#FFFFFF",
  /** 활성 하단 포인트 라인 */
  activeLine: "#5B8BFF",
  /** Engi 버튼 배경 */
  engiBg: "rgba(91,139,255,0.15)",
  /** Engi 버튼 보더 */
  engiBorder: "rgba(91,139,255,0.35)",
  /** Engi 버튼 텍스트 */
  engiText: "#A8C7FF",
  /** 프로필 버튼 */
  profileBg: "rgba(255,255,255,0.08)",
  profileText: "rgba(203,213,225,0.9)",
  /** 로고 텍스트 */
  logoText: "#FFFFFF",
  /** 로고 배지 */
  logoBadgeBg: "#344BA0",
}

// ─── GlobalHeader ─────────────────────────────────────────────────────────────

export default function GlobalHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    clearUserOnboardingData()
    clearAuthSession()
    navigate("/", { replace: true })
  }

  const handleNavigation = async (item: NavItem) => {
    if (item.label === "ROI 분석") {
      navigate(await resolveRoiNavigationPath(location.pathname, location.search))
      return
    }
    if (item.label === "지원사업 추천") {
      navigate(
        await resolveSupportProjectsNavigationPath(location.pathname, location.search),
      )
      return
    }
    if (item.label === "신청서 작성") {
      navigate(
        await resolveApplicationDraftNavigationPath(location.pathname, location.search),
      )
      return
    }
    navigate(item.path)
  }

  const isEngiActive =
    location.pathname === "/advisor" ||
    location.pathname === "/ai" ||
    location.pathname === "/ai-advisor"

  const isProfileActive =
    location.pathname === "/mypage" || location.pathname === "/company"

  return (
    <>
      <header
        id="ff-global-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          background: TOKEN.headerBg,
          borderBottom: `1px solid ${TOKEN.headerBorder}`,
          height: "60px",
          display: "flex",
          alignItems: "center",
          paddingLeft: "clamp(16px, 4vw, 40px)",
          paddingRight: "clamp(16px, 4vw, 40px)",
          gap: "0",
          // 미묘한 그림자로 페이지와 분리
          boxShadow: "0 2px 16px rgba(6,20,48,0.32)",
        }}
      >
        {/* ── 로고 ── */}
        <button
          type="button"
          id="ff-header-logo"
          onClick={() => navigate("/dashboard")}
          aria-label="FactoFit 대시보드로 이동"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 20px 0 0",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "7px",
              background: TOKEN.logoBadgeBg,
              color: "#FFFFFF",
              display: "grid",
              placeItems: "center",
              fontSize: "15px",
              fontWeight: 900,
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(52,75,160,0.4)",
            }}
          >
            F
          </span>
          <span
            style={{
              color: TOKEN.logoText,
              fontSize: "15px",
              fontWeight: 900,
              letterSpacing: "-0.3px",
              whiteSpace: "nowrap",
            }}
          >
            FactoFit
          </span>
        </button>

        {/* ── 구분선 ── */}
        <div
          aria-hidden="true"
          style={{
            width: "1px",
            height: "20px",
            background: "rgba(255,255,255,0.12)",
            flexShrink: 0,
            marginRight: "20px",
          }}
        />

        {/* ── 네비게이션 (데스크톱) ── */}
        <nav
          aria-label="주요 메뉴"
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: "2px",
            flex: 1,
            height: "60px",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname)
            return (
              <button
                key={item.path}
                type="button"
                id={`ff-nav-${item.path.replace(/\//g, "").replace(/-/g, "_") || "dashboard"}`}
                onClick={() => void handleNavigation(item)}
                aria-current={active ? "page" : undefined}
                style={{
                  position: "relative",
                  height: "60px",
                  padding: "0 14px",
                  background: active ? TOKEN.activeBg : "none",
                  border: "none",
                  cursor: "pointer",
                  color: active ? TOKEN.activeText : TOKEN.navText,
                  fontSize: "13.5px",
                  fontWeight: active ? 900 : 700,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  borderRadius: "4px",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = TOKEN.navHover
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = "none"
                  }
                }}
              >
                {item.label}
                {/* 활성 하단 포인트 라인 */}
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "10px",
                      right: "10px",
                      height: "2px",
                      background: TOKEN.activeLine,
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* ── 우측 액션 ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
            marginLeft: "12px",
          }}
        >
          {/* Engi에게 질문하기 */}
          <button
            type="button"
            id="ff-header-engi"
            onClick={() => navigate("/advisor")}
            style={{
              height: "34px",
              padding: "0 14px",
              borderRadius: "999px",
              border: `1px solid ${isEngiActive ? "rgba(91,139,255,0.6)" : TOKEN.engiBorder}`,
              background: isEngiActive ? "rgba(91,139,255,0.22)" : TOKEN.engiBg,
              color: TOKEN.engiText,
              fontSize: "13px",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.15s, border-color 0.15s",
              letterSpacing: "0.01em",
            }}
          >
            ✦ Engi
          </button>

          {/* 프로필 */}
          <button
            type="button"
            id="ff-header-profile"
            onClick={() => navigate("/mypage")}
            aria-label="내 프로필"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: isProfileActive
                ? "rgba(91,139,255,0.22)"
                : TOKEN.profileBg,
              color: TOKEN.profileText,
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              transition: "background 0.15s",
            }}
          >
            👤
          </button>

          {/* 로그아웃 */}
          <button
            type="button"
            id="ff-header-logout"
            onClick={handleLogout}
            style={{
              height: "34px",
              padding: "0 12px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "none",
              color: "rgba(203,213,225,0.7)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.12)"
              e.currentTarget.style.color = "#fca5a5"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none"
              e.currentTarget.style.color = "rgba(203,213,225,0.7)"
            }}
          >
            로그아웃
          </button>

          {/* 모바일 햄버거 — 640px 이하에서만 CSS로 노출 */}
          <button
            type="button"
            id="ff-header-hamburger"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
            className="ff-header-hamburger"
            style={{
              display: "none",
              width: "34px",
              height: "34px",
              borderRadius: "7px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "none",
              cursor: "pointer",
              fontSize: "16px",
              color: TOKEN.navText,
              placeItems: "center",
            }}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* ── 모바일 드롭다운 ── */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="모바일 메뉴"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: "60px 0 0 0",
            zIndex: 199,
            background: "rgba(6,15,36,0.55)",
            backdropFilter: "blur(6px)",
          }}
        >
          <nav
            onClick={(e) => e.stopPropagation()}
            style={{
              background: TOKEN.headerBg,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              padding: "8px 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active = isItemActive(item, location.pathname)
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    void handleNavigation(item)
                    setMobileOpen(false)
                  }}
                  style={{
                    padding: "13px 24px",
                    background: active ? "rgba(255,255,255,0.1)" : "none",
                    border: "none",
                    borderLeft: active
                      ? `3px solid ${TOKEN.activeLine}`
                      : "3px solid transparent",
                    textAlign: "left",
                    color: active ? "#FFFFFF" : TOKEN.navText,
                    fontSize: "14px",
                    fontWeight: active ? 900 : 700,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                navigate("/advisor")
                setMobileOpen(false)
              }}
              style={{
                padding: "13px 24px",
                background: "none",
                border: "none",
                borderLeft: "3px solid transparent",
                textAlign: "left",
                color: TOKEN.engiText,
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✦ Engi에게 질문하기
            </button>
          </nav>
        </div>
      )}

      {/* ── 반응형 CSS ── */}
      <style>{`
        @media (max-width: 640px) {
          #ff-global-header nav[aria-label="주요 메뉴"] {
            display: none !important;
          }
          #ff-header-engi {
            display: none !important;
          }
          .ff-header-hamburger {
            display: grid !important;
          }
        }
        #ff-global-header nav::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  )
}
