import { useState } from "react"
import { useLocation } from "react-router-dom"

export default function GlobalAiAdvisor() {
  const [showAiAdvisorModal, setShowAiAdvisorModal] = useState(false)
  const location = useLocation()

  // 중요:
  // /ai-advisor 화면은 팝업 iframe 안에서 열리는 실제 챗봇 페이지임.
  // 여기서 또 전역 챗봇 버튼을 띄우면 무한 중복됨.
  if (
    location.pathname === "/ai-advisor" ||
    location.pathname === "/ai" ||
    location.pathname === "/advisor"
  ) {
    return null
  }

  return (
    <>
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
          display: showAiAdvisorModal ? "none" : "flex",
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
            type="button"
            onClick={() => setShowAiAdvisorModal(false)}
            aria-label="AI 어드바이저 닫기"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              zIndex: 3,
              width: "42px",
              height: "42px",
              borderRadius: "999px",
              border: "0",
              background: "rgba(226, 232, 240, 0.95)",
              color: "#0f172a",
              fontSize: "26px",
              fontWeight: 900,
              cursor: "pointer",
              lineHeight: 1,
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
    </>
  )
}