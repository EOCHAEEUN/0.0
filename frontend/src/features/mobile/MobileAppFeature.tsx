import { useEffect } from "react"
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { MobileTabBar } from "./components/MobileTabBar"
import { AUTH_EXPIRED_EVENT, consumeAuthExpiredMessage, hasValidAuthSession } from "../../services/auth"
import "./mobileApp.workspace.css"

export default function MobileAppFeature() {
  const location = useLocation()
  const navigate = useNavigate()
  const redirectPath = `${location.pathname}${location.search}`

  useEffect(() => {
    const handleAuthExpired = (event: Event) => {
      const authEvent = event as CustomEvent<{ message?: string }>
      const message =
        authEvent.detail?.message ||
        consumeAuthExpiredMessage() ||
        "로그인이 만료되었습니다. 다시 로그인해주세요."
      window.alert(message)
      const redirect = encodeURIComponent(redirectPath)
      navigate(`/login?redirect=${redirect}`, { replace: true })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired as EventListener)
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired as EventListener)
    }
  }, [navigate, redirectPath])

  if (!hasValidAuthSession()) {
    const redirect = encodeURIComponent(redirectPath)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return (
    <main className="ff-mobile-app-page">
      <div className="ff-mobile-app-frame">
        <Outlet />
      </div>
      <MobileTabBar />
    </main>
  )
}
