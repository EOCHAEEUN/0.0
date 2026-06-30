import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import GlobalHeader from "./GlobalHeader"
import { getAccessToken } from "../../services/auth"
import { getCompanyProfileDraft } from "../../features/onboarding/onboardingState"
import { hydrateAccountData } from "../../services/accountHydration"

export default function AuthenticatedLayout() {
  const location = useLocation()
  const hasToken = !!getAccessToken()

  // 토큰은 있지만 기업 데이터가 없는 경우(재로그인·새 기기)만 hydrate
  const [hydrating, setHydrating] = useState(() => {
    if (!hasToken) return false
    const draft = getCompanyProfileDraft()
    return draft.status === "not_started" && !draft.companyName.trim()
  })

  useEffect(() => {
    if (!hydrating) return
    void hydrateAccountData().finally(() => setHydrating(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasToken) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  if (hydrating) {
    return (
      <div
        id="ff-app-shell"
        style={{
          minHeight: "100vh",
          background: "var(--bg, #F5F7FB)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <GlobalHeader />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p style={{ color: "#64748b", fontSize: "14px", fontWeight: 800 }}>
            계정 정보를 불러오는 중...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      id="ff-app-shell"
      style={{
        minHeight: "100vh",
        background: "var(--bg, #F5F7FB)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <GlobalHeader />
      <div
        id="ff-page-content"
        style={{
          flex: 1,
          // 각 페이지의 자체 패딩/레이아웃을 방해하지 않도록 여백 없이 열어둠
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
