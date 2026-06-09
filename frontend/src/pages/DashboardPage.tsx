import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"

type FactoFitIframeWindow = Window & {
  openFactoFitLoginDashboard?: () => void
  showDashboard?: () => void
  showView?: (id: string) => void
}

export default function DashboardPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const location = useLocation()
  const [showAiAdvisorModal, setShowAiAdvisorModal] = useState(false)

  const params = new URLSearchParams(location.search)
  const screen = params.get("screen")

  const iframeSrc = "/factofit-main.html"

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const timers: number[] = []
    let observer: MutationObserver | null = null

    const getFrame = () => {
      const win = iframe.contentWindow as FactoFitIframeWindow | null
      const doc = iframe.contentDocument

      if (!win || !doc) return null

      return { win, doc }
    }

    const getText = (el: Element | null) => {
      if (!el) return ""

      return (
        (el as HTMLElement).innerText ||
        el.textContent ||
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        ""
      ).trim()
    }

    const moveToReactPage = (path: string) => {
      window.location.href = window.location.origin + path
    }

    const hideLegacyChatbotPopup = () => {
      const frame = getFrame()
      if (!frame) return

      const { doc } = frame

      const selectors = [
        ".ai-modal",
        ".advisor-modal",
        ".chat-modal",
        ".chatbot-modal",
        ".chatbot-panel",
        ".bot-modal",
        ".assistant-modal",
        ".floating-chat-modal",
        ".modal",
        "[id*='chat']",
        "[id*='Chat']",
        "[id*='bot']",
        "[id*='Bot']",
        "[id*='advisor']",
        "[id*='Advisor']",
        "[class*='chat']",
        "[class*='Chat']",
        "[class*='bot']",
        "[class*='Bot']",
        "[class*='advisor']",
        "[class*='Advisor']",
      ]

      doc.querySelectorAll(selectors.join(",")).forEach((el) => {
        const htmlEl = el as HTMLElement
        const text = getText(htmlEl)

        const looksLikeLegacyPopup =
          text.includes("FactoFit AI 어드바이저") ||
          text.includes("AI 진단") ||
          text.includes("시나리오 A") ||
          text.includes("지원사업 보여줘") ||
          text.includes("안전점검 위험 항목") ||
          text.includes("Dashboard Experience 보기")

        if (looksLikeLegacyPopup) {
          htmlEl.style.display = "none"
          htmlEl.style.visibility = "hidden"
          htmlEl.style.pointerEvents = "none"
        }
      })
    }

    const getEventPoint = (event: Event) => {
      if (event instanceof MouseEvent) {
        return {
          clientX: event.clientX,
          clientY: event.clientY,
        }
      }

      if (event instanceof TouchEvent && event.touches.length > 0) {
        return {
          clientX: event.touches[0].clientX,
          clientY: event.touches[0].clientY,
        }
      }

      return null
    }

    const isChatbotTarget = (event: Event) => {
      const frame = getFrame()
      const win = frame?.win
      const point = getEventPoint(event)

      let isBottomRightClick = false

      if (win && point) {
        isBottomRightClick =
          point.clientX > win.innerWidth - 210 &&
          point.clientY > win.innerHeight - 210
      }

      const path = event.composedPath()

      const matchedByElement = path.some((item) => {
        if (!(item instanceof HTMLElement)) return false

        const text = getText(item)
        const className = String(item.className || "").toLowerCase()
        const id = String(item.id || "").toLowerCase()
        const aria = String(item.getAttribute("aria-label") || "").toLowerCase()
        const title = String(item.getAttribute("title") || "").toLowerCase()
        const src = String((item as HTMLImageElement).src || "").toLowerCase()

        return (
          text.includes("FactoFit AI") ||
          text.includes("팩토핏 AI") ||
          text.includes("챗봇") ||
          text.includes("AI 상담") ||
          text.includes("어드바이저") ||
          className.includes("chat") ||
          className.includes("bot") ||
          className.includes("assistant") ||
          className.includes("floating") ||
          className.includes("advisor") ||
          id.includes("chat") ||
          id.includes("bot") ||
          id.includes("assistant") ||
          id.includes("floating") ||
          id.includes("advisor") ||
          aria.includes("chat") ||
          aria.includes("bot") ||
          aria.includes("assistant") ||
          aria.includes("advisor") ||
          title.includes("chat") ||
          title.includes("bot") ||
          title.includes("assistant") ||
          title.includes("advisor") ||
          src.includes("chat") ||
          src.includes("bot") ||
          src.includes("assistant") ||
          src.includes("advisor")
        )
      })

      return Boolean(isBottomRightClick || matchedByElement)
    }

    const handleIframeEvent = (event: Event) => {
      const target = event.target as Element | null
      if (!target) return

      const clicked = target.closest(
        "button, a, [role='button'], div"
      ) as HTMLElement | null

      if (!clicked) return

      const text = getText(clicked)

      if (isChatbotTarget(event)) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        hideLegacyChatbotPopup()

        console.log("[FactoFit] iframe 챗봇 클릭 → React AI Advisor 팝업 열기")
        setShowAiAdvisorModal(true)

        window.setTimeout(hideLegacyChatbotPopup, 50)
        window.setTimeout(hideLegacyChatbotPopup, 150)
        window.setTimeout(hideLegacyChatbotPopup, 300)

        return
      }

      const isMainButton =
        text.trim() === "← 메인으로" ||
        text.trim() === "메인으로" ||
        text.includes("메인으로")

      if (isMainButton) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        console.log("[FactoFit] 메인 화면으로 이동:", text)
        window.location.href = window.location.origin + "/"
        return
      }

      const isRoiDetail =
        text.includes("ROI 상세 리포트 보기") ||
        text.includes("AI 상세 리포트 분석") ||
        text.includes("상세 리포트 보기") ||
        text.includes("리포트 보기")

      const isSupportPage =
        text.trim() === "지원사업" ||
        text.includes("지원사업 보기") ||
        text.includes("추천 지원사업") ||
        text.includes("지원사업 현황") ||
        text.includes("SCREEN 02 지원사업 보여줘")

      const isApplicationDraft =
        text.trim() === "신청서 생성" ||
        text.includes("신청서 초안 생성") ||
        text.includes("신청서 생성 보기") ||
        text.includes("신청서 초안 보기") ||
        text.includes("신청서 초안 만들어줘") ||
        text.includes("시나리오 A 신청서 초안")

      const isSafetyPage =
        text.trim() === "안전점검" ||
        text.includes("안전점검 현황") ||
        text.includes("안전점검 보기") ||
        text.includes("안전점검 위험 항목")

      if (isRoiDetail) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        console.log("[FactoFit] ROI 상세 리포트 React 이동:", text)
        moveToReactPage("/roi")
        return
      }

      if (isSupportPage) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        console.log("[FactoFit] 지원사업 React 이동:", text)
        moveToReactPage("/support-projects")
        return
      }

      if (isApplicationDraft) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        console.log("[FactoFit] 신청서 생성 React 이동:", text)
        moveToReactPage("/application-draft")
        return
      }

      if (isSafetyPage) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        console.log("[FactoFit] 안전점검 React 이동:", text)
        moveToReactPage("/safety")
        return
      }
    }

    const bindClickRouter = () => {
      const frame = getFrame()
      if (!frame) return false

      const { doc } = frame

      doc.removeEventListener("pointerdown", handleIframeEvent, true)
      doc.removeEventListener("mousedown", handleIframeEvent, true)
      doc.removeEventListener("touchstart", handleIframeEvent, true)
      doc.removeEventListener("click", handleIframeEvent, true)

      doc.addEventListener("pointerdown", handleIframeEvent, true)
      doc.addEventListener("mousedown", handleIframeEvent, true)
      doc.addEventListener("touchstart", handleIframeEvent, true)
      doc.addEventListener("click", handleIframeEvent, true)

      console.log("[FactoFit] iframe 클릭 라우터 재연결 완료")
      return true
    }

    const observeCurrentDocument = () => {
      const frame = getFrame()
      if (!frame) return

      const { doc } = frame

      if (observer) {
        observer.disconnect()
        observer = null
      }

      if (!doc.body) return

      observer = new MutationObserver(() => {
        bindClickRouter()
      })

      observer.observe(doc.body, {
        childList: true,
        subtree: true,
      })

      bindClickRouter()
    }

    const openLoginDashboardHtml = () => {
      const frame = getFrame()
      if (!frame) return false

      const { win, doc } = frame

      const alreadyInnerDashboard = Boolean(doc.getElementById("dashboard"))

      if (alreadyInnerDashboard) {
        console.log("[FactoFit] 이미 로그인 후 HTML 문서 상태")
        return true
      }

      if (typeof win.openFactoFitLoginDashboard === "function") {
        console.log("[FactoFit] 겉 HTML → 로그인 이후 HTML로 전환")
        win.openFactoFitLoginDashboard()
        return true
      }

      console.log("[FactoFit] openFactoFitLoginDashboard 함수를 못 찾음")
      return false
    }

    const showRealDashboard = () => {
      const frame = getFrame()
      if (!frame) return false

      const { win, doc } = frame

      if (typeof win.showDashboard === "function") {
        console.log("[FactoFit] 내부 showDashboard 실행")
        win.showDashboard()

        if (typeof win.showView === "function") {
          win.showView("home")
        }

        observeCurrentDocument()
        return true
      }

      const dashboard = doc.getElementById("dashboard")

      if (dashboard) {
        console.log("[FactoFit] showDashboard 함수 없이 dashboard 직접 표시")

        dashboard.classList.add("show")
        doc.body.classList.add("dashboard-mode")

        doc.querySelectorAll(".view").forEach((view) => {
          view.classList.toggle("active", view.id === "home")
        })

        observeCurrentDocument()
        return true
      }

      console.log("[FactoFit] 내부 dashboard 아직 못 찾음")
      return false
    }

    const showRoiSummary = () => {
      const frame = getFrame()
      if (!frame) return false

      const { win, doc } = frame

      if (typeof win.showDashboard === "function") {
        console.log("[FactoFit] 내부 showDashboard 실행 후 ROI 화면 이동")
        win.showDashboard()
      }

      if (typeof win.showView === "function") {
        win.showView("roi")
        observeCurrentDocument()
        console.log("[FactoFit] HTML ROI 분석 화면 이동 성공")
        return true
      }

      const dashboard = doc.getElementById("dashboard")
      const roiView = doc.getElementById("roi")

      if (dashboard && roiView) {
        console.log("[FactoFit] showView 함수 없이 ROI view 직접 표시")

        dashboard.classList.add("show")
        doc.body.classList.add("dashboard-mode")

        doc.querySelectorAll(".view").forEach((view) => {
          view.classList.toggle("active", view.id === "roi")
        })

        observeCurrentDocument()
        return true
      }

      console.log("[FactoFit] HTML ROI 분석 화면 아직 못 찾음")
      return false
    }

    const bootDashboard = () => {
      bindClickRouter()

      if (screen === "dashboard") {
        console.log("[FactoFit] ?screen=dashboard 감지")

        openLoginDashboardHtml()

        timers.push(window.setTimeout(showRealDashboard, 300))
        timers.push(window.setTimeout(showRealDashboard, 800))
        timers.push(window.setTimeout(showRealDashboard, 1400))
        timers.push(window.setTimeout(showRealDashboard, 2200))
        timers.push(window.setTimeout(showRealDashboard, 3500))

        timers.push(window.setTimeout(bindClickRouter, 4500))
        timers.push(window.setTimeout(bindClickRouter, 5500))
        timers.push(window.setTimeout(bindClickRouter, 6500))

        return
      }

      if (screen === "roi-summary") {
        console.log("[FactoFit] ?screen=roi-summary 감지")

        openLoginDashboardHtml()

        timers.push(window.setTimeout(showRoiSummary, 300))
        timers.push(window.setTimeout(showRoiSummary, 800))
        timers.push(window.setTimeout(showRoiSummary, 1400))
        timers.push(window.setTimeout(showRoiSummary, 2200))
        timers.push(window.setTimeout(showRoiSummary, 3500))

        timers.push(window.setTimeout(bindClickRouter, 4500))
        timers.push(window.setTimeout(bindClickRouter, 5500))
        timers.push(window.setTimeout(bindClickRouter, 6500))

        return
      }

      observeCurrentDocument()
    }

    iframe.addEventListener("load", bootDashboard)

    if (iframe.contentDocument?.readyState === "complete") {
      timers.push(window.setTimeout(bootDashboard, 0))
    }

    return () => {
      iframe.removeEventListener("load", bootDashboard)
      timers.forEach((timer) => window.clearTimeout(timer))

      if (observer) {
        observer.disconnect()
      }
    }
  }, [screen])

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="FactoFit Main Mockup"
        style={{
          width: "100%",
          height: "100vh",
          border: "0",
          display: "block",
        }}
      />

      <button
        type="button"
        onClick={() => setShowAiAdvisorModal(true)}
        aria-label="FactoFit AI 어드바이저 열기"
        style={{
          position: "fixed",
          right: "32px",
          bottom: "32px",
          zIndex: 99998,
          width: "86px",
          height: "86px",
          borderRadius: "999px",
          border: "8px solid rgba(255,255,255,0.88)",
          background:
            "linear-gradient(145deg, #0f1b33 0%, #1f3b6d 52%, #d69b45 100%)",
          boxShadow:
            "0 24px 60px rgba(15, 23, 42, 0.34), 0 0 0 10px rgba(15, 23, 42, 0.08)",
          color: "white",
          fontSize: "30px",
          fontWeight: 900,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        AI
      </button>

      <div
        onClick={() => setShowAiAdvisorModal(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "rgba(15, 23, 42, 0.58)",
          backdropFilter: "blur(6px)",
          display: showAiAdvisorModal ? "flex" : "none",
          alignItems: "center",
          justifyContent: "center",
          padding: "28px",
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(520px, 94vw)",
            height: "min(720px, 88vh)",
            background: "#f8fafc",
            borderRadius: "30px",
            overflow: "hidden",
            boxShadow: "0 30px 90px rgba(15, 23, 42, 0.45)",
            position: "relative",
          }}
        >
          <button
            onClick={() => setShowAiAdvisorModal(false)}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              zIndex: 3,
              width: "38px",
              height: "38px",
              borderRadius: "999px",
              border: "0",
              background: "rgba(226, 232, 240, 0.95)",
              color: "#0f172a",
              fontSize: "22px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <iframe
            src="/ai-advisor"
            title="FactoFit AI Advisor"
            style={{
              width: "100%",
              height: "100%",
              border: "0",
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  )
}