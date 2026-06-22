import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"

import { getCurrentAuthSession } from "../../services/auth"

type SessionStatus = "loading" | "authenticated" | "guest"

function useSessionStatus() {
  const [status, setStatus] = useState<SessionStatus>("loading")

  useEffect(() => {
    let active = true

    getCurrentAuthSession()
      .then(() => {
        if (active) setStatus("authenticated")
      })
      .catch(() => {
        if (active) setStatus("guest")
      })

    return () => {
      active = false
    }
  }, [])

  return status
}

function SessionLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#F8FAFC",
        color: "#061B34",
        fontWeight: 900,
      }}
    >
      로그인 상태를 확인하고 있습니다.
    </main>
  )
}

export function ProtectedRoute() {
  const status = useSessionStatus()
  const location = useLocation()

  if (status === "loading") return <SessionLoading />
  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function GuestRoute() {
  const status = useSessionStatus()

  if (status === "loading") return <SessionLoading />
  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export function SessionExpiryRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleExpired = () => navigate("/login", { replace: true })
    window.addEventListener("factofit:session-expired", handleExpired)
    return () =>
      window.removeEventListener("factofit:session-expired", handleExpired)
  }, [navigate])

  return null
}
