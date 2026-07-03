import { Building2, CalendarDays, Check, ChevronRight, FileText, Info } from "lucide-react"

import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import "../supportProjects.workspace.css"

function formatMainCardStatus(status: string) {
  if (status === "우선 검토") return "신청 준비 가능"
  return status
}

function formatDdayPill(policy: SupportProjectsPolicyCard) {
  if (policy.d_day && policy.d_day !== "-") return policy.d_day
  if (policy.deadline_display) return policy.deadline_display
  return null
}

function ddayClass(policy: SupportProjectsPolicyCard) {
  if (policy.is_past_deadline) return "past"
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 7) return "urgent"
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 21) return "soon"
  return "normal"
}

export function PriorityPolicyCard({
  policy,
  onOpenDetail,
}: {
  policy: SupportProjectsPolicyCard
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
}) {
  const whyCheckItems =
    policy.why_check_now.length > 0
      ? policy.why_check_now
      : [
          policy.scenario_label
            ? `${policy.scenario_label} 투자안과 연계 가능성이 있습니다.`
            : "현재 투자안과 연계 가능성이 있습니다.",
          "현재 업종과 기업 규모 조건이 대부분 맞습니다.",
          policy.required_documents_label || "신청 전 제출서류와 지원 한도 확인 필요",
        ]

  return (
    <section className="ff-support-main-priority">
      <header className="ff-support-main-priority-head">
        <p className="ff-support-main-priority-eyebrow">AI 분석 기반 맞춤형 추천</p>
        <h2>최우선 지원사업 분석</h2>
      </header>

      <article className="ff-support-main-priority-card">
        <div className="ff-support-main-priority-grid">
          <div className="ff-support-main-priority-copy">
            <div className="ff-support-priority-pill-row">
              <span className="ff-support-priority-pill">
                1순위 · {formatMainCardStatus(policy.application_status)}
              </span>
              <span className="ff-support-priority-pill">{policy.support_type_label}</span>
            </div>

            <h3>{policy.title}</h3>

            <div className="ff-support-main-meta-row">
              <span>
                <Building2 size={15} aria-hidden="true" />
                {policy.organization}
              </span>
              <span>
                <CalendarDays size={15} aria-hidden="true" />
                {policy.deadline_display || policy.deadline || "예산 소진 시 마감"}
              </span>
              {formatDdayPill(policy) ? (
                <span className={`ff-support-dday-pill ${ddayClass(policy)}`}>
                  {formatDdayPill(policy)}
                </span>
              ) : null}
            </div>

            <div className="ff-support-reason-panel">
              <div className="ff-support-reason-head">
                <span className="ff-support-reason-icon" aria-hidden="true">
                  <Info size={14} strokeWidth={2.4} />
                </span>
                <strong>추천 사유</strong>
              </div>
              <p>{policy.recommendation_summary || policy.match_reason}</p>
            </div>

            <div className="ff-support-why-check">
              <strong>Why check now?</strong>
              <ul>
                {whyCheckItems.map((line) => (
                  <li key={line}>
                    <span className="ff-support-why-check-icon" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="ff-support-preflight-panel">
            <h4>신청 전 확인할 항목</h4>
            <ul>
              {policy.preflight_checks.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>

            <div className="ff-support-docs-row">
              <FileText size={16} aria-hidden="true" />
              <span>{policy.required_documents_label}</span>
            </div>

            <button
              type="button"
              className="ff-support-primary-btn wide"
              onClick={() => onOpenDetail(policy)}
            >
              지원 조건 확인하기
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <p className="ff-support-preflight-note">
              조건 확인 후 신청서 작성을 이어갈 수 있습니다.
            </p>
          </aside>
        </div>
      </article>
    </section>
  )
}
