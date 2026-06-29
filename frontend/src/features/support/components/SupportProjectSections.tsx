import type { CSSProperties } from "react"
import type { EquipmentContext, PolicyCounters, SupportProject } from "../supportProjects.contract"
import { getDday, getFitLabel, getProjectScoreColor } from "../supportProjects.utils"

function formatCount(value: number) {
  return `${Math.max(0, value)}건`
}

function getMatchRate(project: SupportProject) {
  return Math.min(100, Math.max(0, Math.round(project.fitScore)))
}

function getTopPolicyReason(project: SupportProject) {
  if (project.reasonText?.trim()) return project.reasonText.trim()
  const fromList = project.reasons.find((item) => item.trim().length > 0)
  return fromList?.trim() ?? ""
}

function clampTextStyle(lines = 1): CSSProperties {
  return {
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    wordBreak: "break-word",
  }
}

function HeroMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        minHeight: "90px",
        padding: "14px 16px",
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.58)", fontSize: "12px", fontWeight: 800, marginBottom: "8px" }}>
        {label}
      </p>
      <p style={{ color: "#FFFFFF", fontSize: "30px", lineHeight: 1, fontWeight: 900, letterSpacing: "-0.03em" }}>
        {value}
      </p>
    </div>
  )
}

export function SupportWorkflowHero({
  policyCounters,
  equipmentName,
  currentAvailableCount,
  hasCurrentAvailableCount,
}: {
  policyCounters: PolicyCounters
  equipmentName: string
  currentAvailableCount: number
  hasCurrentAvailableCount: boolean
}) {
  const titleTarget = equipmentName?.trim() || "현재 투자 조건"
  const matchedCount = policyCounters.industryMatchedCount
  const metrics = [
    { label: "정책 DB 전체", value: formatCount(policyCounters.totalPolicyCount) },
    ...(hasCurrentAvailableCount
      ? [{ label: "현재 확인 가능", value: formatCount(currentAvailableCount) }]
      : [{ label: "현재 확인 가능", value: "정보 없음" }]),
    { label: "내 조건 매칭", value: formatCount(matchedCount) },
    { label: "우선 검토 정책", value: formatCount(policyCounters.priorityCount) },
  ]

  return (
    <section
      style={{
        marginTop: "18px",
        marginBottom: "18px",
        borderRadius: "18px",
        background: "linear-gradient(130deg, #0d1730 0%, #101d3a 52%, #16254a 100%)",
        padding: "22px 24px",
        boxShadow: "0 14px 36px rgba(6,20,52,0.24)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 460px",
          gap: "18px",
          alignItems: "stretch",
        }}
      >
        <div>
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#d6def5",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.09em",
              height: "26px",
              padding: "0 12px",
              marginBottom: "12px",
            }}
          >
            FACTOFIT AI AGENT
          </p>
          <h2
            style={{
              color: "#FFFFFF",
              fontSize: "38px",
              fontWeight: 900,
              lineHeight: 1.2,
              letterSpacing: "-0.04em",
              marginBottom: "10px",
            }}
          >
            {titleTarget} 투자에 맞는
            <br />
            지원사업 {formatCount(matchedCount)}을 찾았습니다
          </h2>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "14px", lineHeight: 1.7, fontWeight: 700 }}>
            전체 정책 DB와 현재 기업/설비 조건을 기준으로 연계 가능한 공고를 우선순위로 정리했습니다.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {metrics.map((metric) => (
            <HeroMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </div>
    </section>
  )
}

function TopPolicyMainCard({
  topProject,
  onOpenDetail,
}: {
  topProject: SupportProject
  onOpenDetail: (project: SupportProject) => void
}) {
  const dDay = getDday(topProject.deadlineRaw)
  const topReason = getTopPolicyReason(topProject)
  const connectedItems = [
    topProject.policyCategory?.trim() ? `정책 분류: ${topProject.policyCategory}` : "",
    topProject.scenarioLabel?.trim() ? `투자 시나리오: ${topProject.scenarioLabel}` : "",
    topProject.agency?.trim() ? `주관 기관: ${topProject.agency}` : "",
  ].filter(Boolean)
  const reviewItems = topProject.reasons
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)

  return (
    <article
      style={{
        border: "1px solid #e3e8f2",
        borderRadius: "16px",
        background: "#FFFFFF",
        boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
        padding: "20px",
        marginBottom: "14px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.55fr) minmax(320px,0.95fr)",
          gap: "20px",
        }}
      >
        <div>
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "28px",
              padding: "0 12px",
              borderRadius: "999px",
              border: "1px solid #cfd8ea",
              background: "#f2f6ff",
              color: "#334a88",
              fontSize: "12px",
              fontWeight: 900,
              marginBottom: "12px",
            }}
          >
            우선 검토 정책
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "10px",
              color: "#667085",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            {topProject.agency ? <span>{topProject.agency}</span> : null}
            {topProject.amount ? <span>최대 {topProject.amount}</span> : null}
            {topProject.deadline ? <span>{topProject.deadline}</span> : null}
            {dDay && dDay !== "마감일 미정" ? <span>{dDay}</span> : null}
          </div>
          <h3
            style={{
              color: "#111827",
              fontSize: "30px",
              lineHeight: 1.25,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              marginBottom: "10px",
              ...clampTextStyle(2),
            }}
            title={topProject.title}
          >
            {topProject.title}
          </h3>
          {topProject.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
              {topProject.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  style={{
                    height: "24px",
                    borderRadius: "999px",
                    padding: "0 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    background: "#f4f7fb",
                    border: "1px solid #e5ebf4",
                    color: "#475467",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {topReason && (
            <div style={{ borderRadius: "10px", background: "#f6f8fd", border: "1px solid #e4e9f4", padding: "12px", marginBottom: "12px" }}>
              <p style={{ color: "#334155", fontSize: "12px", fontWeight: 900, marginBottom: "6px" }}>
                이 공고를 먼저 보는 이유
              </p>
              <p style={{ color: "#4b5563", fontSize: "13px", lineHeight: 1.6, fontWeight: 700 }}>
                {topReason}
              </p>
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn blue" type="button" onClick={() => onOpenDetail(topProject)}>
              지원 조건 확인하기
            </button>
            <button className="btn dark" type="button" onClick={() => onOpenDetail(topProject)}>
              공고 상세 보기
            </button>
          </div>
        </div>

        <aside style={{ border: "1px solid #e5e9f2", borderRadius: "12px", background: "#fbfcff", padding: "16px" }}>
          <p style={{ color: "#64748b", fontSize: "12px", fontWeight: 800, marginBottom: "8px" }}>
            매칭 적합도
          </p>
          <p style={{ color: getProjectScoreColor(topProject.fitScore), fontSize: "46px", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "6px" }}>
            {topProject.fitScore}
            <span style={{ color: "#94a3b8", fontSize: "18px", marginLeft: "6px" }}>/ 100</span>
          </p>
          <div style={{ height: "8px", borderRadius: "999px", background: "#e6eaf3", overflow: "hidden", marginBottom: "14px" }}>
            <div style={{ height: "100%", width: `${getMatchRate(topProject)}%`, background: "#5a6ef2" }} />
          </div>
          <span className="badge green" style={{ marginBottom: "12px" }}>{getFitLabel(topProject.fitScore)}</span>

          {connectedItems.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ color: "#334155", fontSize: "12px", fontWeight: 900, marginBottom: "6px" }}>
                현재 조건과 연결된 항목
              </p>
              <ul style={{ margin: 0, paddingLeft: "16px", color: "#475569", fontSize: "12px", lineHeight: 1.6, fontWeight: 700 }}>
                {connectedItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}

          {reviewItems.length > 0 && (
            <div>
              <p style={{ color: "#334155", fontSize: "12px", fontWeight: 900, marginBottom: "6px" }}>
                신청 전 확인 필요
              </p>
              <ul style={{ margin: 0, paddingLeft: "16px", color: "#475569", fontSize: "12px", lineHeight: 1.6, fontWeight: 700 }}>
                {reviewItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  )
}

function CandidateRow({
  rank,
  project,
  onOpenDetail,
}: {
  rank: number
  project: SupportProject
  onOpenDetail: (project: SupportProject) => void
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px minmax(0,1fr) 170px 100px",
        alignItems: "center",
        gap: "12px",
        minHeight: "62px",
        borderBottom: "1px solid #edf1f7",
        padding: "0 12px",
      }}
    >
      <span style={{ color: "#334155", fontSize: "18px", fontWeight: 900 }}>{rank}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: "#111827", fontSize: "14px", fontWeight: 900, ...clampTextStyle(1) }} title={project.title}>
          {project.title}
        </p>
        <p style={{ color: "#6b7280", fontSize: "12px", fontWeight: 700, ...clampTextStyle(1) }}>
          {project.agency || "기관 정보 없음"}
        </p>
      </div>
      <div>
        <div style={{ height: "6px", background: "#e8edf7", borderRadius: "999px", overflow: "hidden", marginBottom: "5px" }}>
          <div style={{ height: "100%", width: `${getMatchRate(project)}%`, background: "#6574f5" }} />
        </div>
        <p style={{ color: "#334155", fontSize: "12px", fontWeight: 900, textAlign: "right" }}>{project.fitScore}</p>
      </div>
      <button
        type="button"
        onClick={() => onOpenDetail(project)}
        style={{
          height: "34px",
          borderRadius: "8px",
          border: "1px solid #d6dceb",
          background: "#ffffff",
          color: "#334155",
          fontSize: "12px",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        추가 검토
      </button>
    </div>
  )
}

function CandidateComparison({
  projects,
  onOpenDetail,
}: {
  projects: SupportProject[]
  onOpenDetail: (project: SupportProject) => void
}) {
  const candidates = projects.slice(1, 5)
  if (candidates.length === 0) {
    return (
      <div
        style={{
          border: "1px solid #e3e8f2",
          borderRadius: "14px",
          background: "#FFFFFF",
          padding: "18px 20px",
          color: "#64748b",
          fontSize: "14px",
          fontWeight: 800,
        }}
      >
        비교할 추가 후보 정책이 없습니다.
      </div>
    )
  }

  return (
    <section style={{ border: "1px solid #e3e8f2", borderRadius: "14px", background: "#FFFFFF", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #edf1f7", background: "#fafbff" }}>
        <p style={{ color: "#6b7280", fontSize: "12px", fontWeight: 800, marginBottom: "4px" }}>
          다른 지원사업 비교
        </p>
        <h4 style={{ color: "#111827", fontSize: "22px", fontWeight: 900, letterSpacing: "-0.02em" }}>
          우선순위 후보 {candidates.length}건
        </h4>
      </div>
      <div>
        {candidates.map((project, index) => (
          <CandidateRow key={`${project.rawId}-${index}`} rank={index + 2} project={project} onOpenDetail={onOpenDetail} />
        ))}
      </div>
    </section>
  )
}

export function SuccessHeroSection({
  topProject,
  finalRecommendedProjects,
  onOpenDetail,
}: {
  topProject: SupportProject
  selectedProject: SupportProject
  equipmentContext: EquipmentContext
  finalRecommendedProjects: SupportProject[]
  policyCounters: PolicyCounters
  onOpenDetail: (project: SupportProject) => void
}) {
  return (
    <div style={{ marginTop: "10px", marginBottom: "16px", display: "grid", gap: "12px" }}>
      <TopPolicyMainCard topProject={topProject} onOpenDetail={onOpenDetail} />
      <CandidateComparison projects={finalRecommendedProjects} onOpenDetail={onOpenDetail} />
    </div>
  )
}

export function OtherMatchedPoliciesPanel({
  projects,
  onOpenDetail,
}: {
  projects: SupportProject[]
  onOpenDetail: (project: SupportProject) => void
}) {
  if (projects.length === 0) return null

  return (
    <section style={{ border: "1px solid #e4e9f4", borderRadius: "14px", background: "#ffffff", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #edf1f7", background: "#f8faff" }}>
        <h4 style={{ color: "#1f2937", fontSize: "16px", fontWeight: 900 }}>
          전체 매칭 후보 {projects.length}건
        </h4>
      </div>
      <div style={{ maxHeight: "260px", overflowY: "auto" }}>
        {projects.map((project, index) => (
          <div
            key={`${project.rawId}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 120px",
              alignItems: "center",
              gap: "10px",
              minHeight: "54px",
              padding: "0 14px",
              borderBottom: "1px solid #eef2f7",
            }}
          >
            <p style={{ color: "#334155", fontSize: "13px", fontWeight: 800, ...clampTextStyle(1) }}>
              {project.title}
            </p>
            <button
              type="button"
              onClick={() => onOpenDetail(project)}
              style={{
                height: "30px",
                borderRadius: "7px",
                border: "1px solid #d7ddeb",
                background: "#fff",
                color: "#334155",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              상세 보기
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export const backButtonStyle: CSSProperties = {
  marginBottom: "18px",
  height: "40px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #d8dfed",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: "12px",
  cursor: "pointer",
}
