import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"

export function MyPageSectionCard({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  id?: string
  icon: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="ff-mypage-section-card">
      <header className="ff-mypage-section-card__header">
        <span className="ff-mypage-section-card__icon" aria-hidden="true">
          {icon}
        </span>
        <div className="ff-mypage-section-card__titles">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <div className="ff-mypage-section-card__body">{children}</div>
    </section>
  )
}

export function MyPageProfileStatusSidebar({
  completionScore,
  basicInfoDone,
  companyInfoDone,
  equipmentInfoDone,
  onGoEquipment,
}: {
  completionScore: number
  basicInfoDone: boolean
  companyInfoDone: boolean
  equipmentInfoDone: boolean
  onGoEquipment: () => void
}) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, completionScore))
  const dashOffset = circumference - (progress / 100) * circumference

  return (
    <aside className="ff-mypage-status-sidebar">
      <h3>프로필 저장 상태</h3>
      <p>AI 맞춤 분석을 위한 데이터 완성도</p>

      <div className="ff-mypage-completion-ring" aria-label={`프로필 완성도 ${progress}%`}>
        <svg viewBox="0 0 132 132" role="img" aria-hidden="true">
          <circle cx="66" cy="66" r={radius} fill="none" stroke="#edf2f7" strokeWidth="10" />
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke="#344ba0"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="ff-mypage-completion-ring__label">
          <strong>{progress}%</strong>
          <span>완성도</span>
        </div>
      </div>

      <div className="ff-mypage-checklist">
        <div className={`ff-mypage-checklist-item ${basicInfoDone ? "is-done" : ""}`}>
          <span className="mark">{basicInfoDone ? "✓" : "·"}</span>
          <span>기본 정보 입력 완료</span>
        </div>
        <div className={`ff-mypage-checklist-item ${companyInfoDone ? "is-done" : ""}`}>
          <span className="mark">{companyInfoDone ? "✓" : "·"}</span>
          <span>기업 정보 입력 완료</span>
        </div>
        <div className={`ff-mypage-checklist-item ${equipmentInfoDone ? "is-done" : ""}`}>
          <span className="mark">{equipmentInfoDone ? "✓" : "·"}</span>
          <span>최소 1개 이상 설비 등록</span>
          {!equipmentInfoDone ? (
            <button type="button" className="link" onClick={onGoEquipment} aria-label="설비현황으로 이동">
              <ChevronRight size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="ff-mypage-tip-box">
        팁: 매출 데이터를 모두 입력하면 더 정교한 ROI 시뮬레이션 결과를 받아보실 수 있습니다.
      </div>
    </aside>
  )
}

export function MyPageRevenueStatusPill({ filled }: { filled: boolean }) {
  return (
    <span className={`ff-mypage-status-pill ${filled ? "is-done" : "is-waiting"}`}>
      {filled ? "검증 완료" : "입력 대기"}
    </span>
  )
}
