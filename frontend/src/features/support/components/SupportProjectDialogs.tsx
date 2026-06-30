import type { ReactNode } from "react"
import type { SupportProject } from "../supportProjects.contract"
import { getDday } from "../supportProjects.utils"

function DialogHighlightedText({ text }: { text: string }) {
  return <>{text}</>
}


function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: "18px",
        border: "1px solid rgba(52,75,160,.12)",
        background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
        padding: "16px",
        boxShadow: "0 10px 24px rgba(6,27,52,.04)",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 900,
          marginBottom: "7px",
        }}
      >
        {label}
      </span>
      <b
        style={{
          display: "block",
          color: "#061B34",
          fontSize: "15px",
          lineHeight: 1.45,
          fontWeight: 900,
        }}
      >
        {value}
      </b>
    </div>
  )
}

export function PolicyDetailDialog({
  project,
  onClose,
  onCreateDraft,
}: {
  project: SupportProject | null
  onClose: () => void
  onCreateDraft?: (project: SupportProject) => void
}) {
  if (!project) return null

  const supportLines = project.supportContent
    .split(/\n|•|- /)
    .map((item) => item.trim())
    .filter(Boolean)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="지원사업 상세 정보"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, .46)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: "32px",
      }}
    >
      <style>
        {`
          .ff-support-detail-dialog::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
          }
        `}
      </style>
      <section
        className="ff-support-detail-dialog"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(920px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          borderRadius: "32px",
          border: "1px solid rgba(246,232,168,.24)",
          background: "#FFFFFF",
          boxShadow: "0 36px 90px rgba(6,27,52,.32)",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <div
          style={{
            padding: "34px 38px 30px",
            borderBottom: "1px solid rgba(246,232,168,.18)",
            background:
              "radial-gradient(circle at 85% 0%, rgba(246,232,168,.18), transparent 30%), linear-gradient(135deg, #081224 0%, #111C32 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "24px",
              alignItems: "flex-start",
            }}
          >
            <div>
              <span className="badge blue">지원사업 상세 정보</span>
              <h3
                style={{
                  marginTop: "16px",
                  color: "#FFFFFF",
                  fontSize: "32px",
                  lineHeight: 1.28,
                  fontWeight: 900,
                  letterSpacing: "-0.7px",
                }}
              >
                <DialogHighlightedText text={project.title} />
              </h3>
              <p
                style={{
                  marginTop: "10px",
                  color: "rgba(255,255,255,.72)",
                  fontSize: "14px",
                  lineHeight: 1.75,
                  fontWeight: 800,
                }}
              >
                <DialogHighlightedText text={project.agency} /> · {project.scenarioLabel} · {project.amount}
              </p>
            </div>

            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "1px solid rgba(246,232,168,.22)",
                background: "rgba(255,255,255,.08)",
                color: "#FFFFFF",
                fontSize: "26px",
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: "28px 34px 34px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "14px",
              marginBottom: "26px",
            }}
          >
            <MetaCard label="공고 등록일" value={project.postedDate} />
            <MetaCard label="접수 마감일" value={project.deadline} />
            <MetaCard label="D-DAY" value={getDday(project.deadlineRaw)} />
            <MetaCard label="정책 분류" value={project.policyCategory || "분류 미확인"} />
          </div>

          <div
            style={{
              borderRadius: "26px",
              border: "1px solid rgba(52,75,160,.12)",
              background: "linear-gradient(180deg, #FFFFFF 0%, #FBFCFF 100%)",
              padding: "26px",
              marginBottom: "22px",
              boxShadow: "0 12px 28px rgba(6,27,52,.04)",
            }}
          >
            <h4
              style={{
                color: "#061B34",
                fontSize: "20px",
                fontWeight: 900,
                letterSpacing: "-0.3px",
                marginBottom: "14px",
              }}
            >
              지원내용
            </h4>

            {supportLines.length > 1 ? (
              <ul
                style={{
                  display: "grid",
                  gap: "10px",
                  paddingLeft: "20px",
                  color: "#222222",
                  fontSize: "15px",
                  lineHeight: 1.75,
                  fontWeight: 800,
                }}
              >
                {supportLines.map((line) => (
                  <li key={line}>
                    <DialogHighlightedText text={line} />
                  </li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  color: "#222222",
                  fontSize: "15px",
                  lineHeight: 1.8,
                  fontWeight: 800,
                }}
              >
                <DialogHighlightedText text={project.supportContent || "지원내용 준비 중"} />
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                color: "#667085",
                fontSize: "13px",
                lineHeight: 1.6,
                fontWeight: 800,
              }}
            >
              URL은 원문 공고 확인용이며, 값이 없는 경우 버튼이 비활성화됩니다.
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="btn dark" type="button" onClick={onClose}>
                닫기
              </button>
              {onCreateDraft && (
                <button
                  className="btn blue"
                  type="button"
                  onClick={() => onCreateDraft(project)}
                >
                  신청서 만들기
                </button>
              )}
              <button
                className="btn blue"
                type="button"
                disabled={!project.sourceUrl}
                onClick={() => {
                  if (project.sourceUrl) window.open(project.sourceUrl, "_blank", "noopener,noreferrer")
                }}
                style={{ opacity: project.sourceUrl ? 1 : 0.45 }}
              >
                공고 바로가기
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function HoverInfo({
  children,
  content,
  width = 300,
  fullWidth = false,
}: {
  children: ReactNode
  content: ReactNode
  width?: number
  fullWidth?: boolean
}) {
  return (
    <span
      tabIndex={0}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        cursor: "help",
        width: fullWidth ? "100%" : undefined,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      <span
        style={{
          position: "absolute",
          right: 0,
          bottom: "calc(100% + 12px)",
          width,
          maxWidth: "min(360px, calc(100vw - 48px))",
          borderRadius: "20px",
          border: "1px solid rgba(246,232,168,.18)",
          background:
            "radial-gradient(circle at 12% 0%, rgba(246,232,168,.18), transparent 34%), #0B1226",
          color: "#FFFFFF",
          padding: "18px 20px",
          fontSize: "12px",
          lineHeight: 1.72,
          fontWeight: 850,
          boxShadow: "0 22px 52px rgba(15,23,42,.30)",
          opacity: 0,
          visibility: "hidden",
          transform: "translateY(6px)",
          transition: "opacity .16s ease, transform .16s ease, visibility .16s ease",
          pointerEvents: "none",
          zIndex: 30,
        }}
        className="ff-support-hover-info"
      >
        {content}
      </span>
      <style>
        {`
          span:hover > .ff-support-hover-info,
          span:focus-within > .ff-support-hover-info {
            opacity: 1 !important;
            visibility: visible !important;
            transform: translateY(0) !important;
          }
        `}
      </style>
    </span>
  )
}
