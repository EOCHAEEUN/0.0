import { Navigate, Outlet } from "react-router-dom"
import GlobalHeader from "./GlobalHeader"
import { getAccessToken } from "../../services/auth"

export default function AuthenticatedLayout() {
  if (!getAccessToken()) {
    return <Navigate to="/main" replace />
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
