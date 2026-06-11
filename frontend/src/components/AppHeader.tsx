import { useLocation, useNavigate } from "react-router-dom"

type NavItem = {
  label: string
  path: string
}

const navItems: NavItem[] = [
  {
    label: "대시보드",
    path: "/",
  },
  {
    label: "지원사업",
    path: "/support-projects",
  },
  {
    label: "ROI 분석",
    path: "/roi",
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

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/"
    }

    return location.pathname.startsWith(path)
  }

  return (
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
                onClick={() => navigate(item.path)}
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
    </header>
  )
}