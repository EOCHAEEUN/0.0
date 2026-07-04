import { Outlet } from "react-router-dom"
import { MobileTabBar } from "./components/MobileTabBar"
import "./mobileApp.workspace.css"

export default function MobileAppFeature() {
  return (
    <main className="ff-mobile-app-page">
      <div className="ff-mobile-app-frame">
        <Outlet />
      </div>
      <MobileTabBar />
    </main>
  )
}
