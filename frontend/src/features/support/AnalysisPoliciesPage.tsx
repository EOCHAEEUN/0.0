import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import factoFitAiCharacter from "./assets/factofit-ai-character.png"
import {
  getAnalysisConditionDraft,
  getAnalysisResult,
  getCompanyProfileDraft,
} from "../onboarding/onboardingState"
import { LoadingPolicyState, ErrorPolicyState } from "./components/SupportProjectStates"
import { useSupportProjects } from "./hooks/useSupportProjects"
import type { SupportProject } from "./supportProjects.contract"
import { getDday } from "./supportProjects.utils"
import "./AnalysisPoliciesPage.css"

function getPolicyRouteId(project: SupportProject) {
  return encodeURIComponent(project.rawId || String(project.id))
}

function findProjectByRouteId(projects: SupportProject[], policyId?: string) {
  const decodedId = decodeURIComponent(policyId || "")
  return projects.find((project) => String(project.rawId || project.id) === decodedId) || null
}

function formatInvestment(raw?: string) {
  const digits = String(raw ?? "").replace(/\D/g, "")
  return digits ? `${Number(digits).toLocaleString("ko-KR")}만원` : "입력값 없음"
}

function formatAmount(project: SupportProject) {
  return project.amountValueManwon === null ? "지원 규모 공고 확인" : project.amount
}

function formatDeadline(project: SupportProject) {
  if (!project.deadlineRaw) return "마감일 확인 필요"
  const dday = getDday(project.deadlineRaw)
  if (dday && dday !== "마감일 미정") return dday
  return project.deadline || "마감일 확인 필요"
}

function isMeaningfulReason(reason: string) {
  const text = reason.trim()
  if (!text) return false
  return ![
    "RAG 유사도 기반 매칭",
    "업종·지역·설비 정보와 정책 조건의 유사도를 함께 반영했습니다.",
  ].includes(text)
}

function getPolicyReasons(project: SupportProject) {
  return [project.reasonText, ...project.reasons]
    .filter((reason): reason is string => typeof reason === "string")
    .map((reason) => reason.trim())
    .filter(isMeaningfulReason)
    .filter((reason, index, list) => list.indexOf(reason) === index)
    .slice(0, 4)
}

function getReviewItems(project: SupportProject) {
  const text = `${project.supportContent || ""}\n${project.description || ""}`
  const items: string[] = []

  if (/서류|제출|증빙/.test(text)) items.push("필수 제출 서류")
  if (/제외|제한|대상 외/.test(text)) items.push("공고별 제외 조건")
  if (/업종|업종코드|산업분류/.test(text)) items.push("세부 업종코드")
  if (/수혜|중복|기지원/.test(text)) items.push("최근 유사 사업 수혜 이력")

  return items.slice(0, 3)
}

function getReasonChips({
  project,
  equipmentName,
  conditionPurpose,
}: {
  project: SupportProject
  equipmentName: string
  conditionPurpose: string
}) {
  const chipCandidates = [
    project.policyCategory,
    project.category,
    project.scenarioLabel,
    equipmentName,
    conditionPurpose,
    ...project.tags,
  ]

  return chipCandidates
    .map((chip) => String(chip || "").trim())
    .filter(Boolean)
    .filter((chip) => !["지원사업", "주관사 미확인", "입력값 없음"].includes(chip))
    .filter((chip, index, list) => list.indexOf(chip) === index)
    .slice(0, 4)
}

function writeSelectedPolicy(project: SupportProject) {
  try {
    window.localStorage.setItem("factofit_selected_policy_id", project.rawId || String(project.id))
    window.localStorage.setItem("factofit_policy_id", project.rawId || String(project.id))
    window.localStorage.setItem("factofit_selected_project", JSON.stringify(project))
  } catch {
    // 신청서 화면 이동을 막지 않기 위해 무시합니다.
  }
}

function PolicyMetaGrid({ project }: { project: SupportProject }) {
  return (
    <div className="ff-policy-meta-grid">
      <article className="ff-policy-meta-card">
        <span>주관기관</span>
        <strong>{project.agency || "주관기관 공고 확인"}</strong>
      </article>
      <article className="ff-policy-meta-card">
        <span>매칭 적합도</span>
        <strong>{project.fitScore}점 / 100</strong>
      </article>
      <article className="ff-policy-meta-card">
        <span>지원 규모</span>
        <strong>{formatAmount(project)}</strong>
      </article>
      <article className="ff-policy-meta-card">
        <span>마감일</span>
        <strong>{formatDeadline(project)}</strong>
      </article>
    </div>
  )
}

function ReasonAndReviewBlocks({ project }: { project: SupportProject }) {
  const reasons = getPolicyReasons(project)
  const reviewItems = getReviewItems(project)

  return (
    <div className="ff-policy-two-col">
      <section className="ff-policy-info-box">
        <h3>이 사업을 먼저 확인하는 이유</h3>
        {reasons.length > 0 ? (
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p>제공된 매칭 근거를 상세 화면에서 확인해주세요.</p>
        )}
      </section>

      <section className="ff-policy-info-box">
        <h3>신청 전 확인이 필요해요</h3>
        {reviewItems.length > 0 && (
          <ul>
            {reviewItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: reviewItems.length > 0 ? "12px" : 0 }}>
          공고문에서 최종 확인이 필요합니다.
        </p>
      </section>
    </div>
  )
}

function EmptyPolicies({ analysisId }: { analysisId: string }) {
  const navigate = useNavigate()

  return (
    <section className="ff-policy-empty">
      <span className="ff-policy-badge gray">추천 결과 없음</span>
      <h2>현재 입력한 조건과 바로 일치하는 지원사업을 찾지 못했습니다.</h2>
      <p>
        투자 목적이나 설비 조건을 조정하면
        <br />
        다른 지원사업을 다시 확인할 수 있습니다.
      </p>
      <div className="ff-policy-actions">
        <button
          type="button"
          className="ff-policy-primary"
          onClick={() => navigate(`/analysis/new?draftId=${analysisId}`)}
        >
          투자 조건 수정
        </button>
        <button
          type="button"
          className="ff-policy-secondary"
          onClick={() => navigate("/support-detail")}
        >
          전체 지원사업 탐색
        </button>
      </div>
    </section>
  )
}

function HeroSection({
  summary,
  equipmentName,
}: {
  summary: {
    totalPolicyCount: number
    activePolicyCount: number
    matchedPolicyCount: number
    priorityPolicyCount: number
  }
  equipmentName: string
}) {
  return (
    <div className="ff-policy-hero">
      <div className="ff-policy-hero-left">
        <span className="ff-policy-hero-label">FACTOFIT AI AGENT</span>
        <h1>
          {equipmentName} 투자에 맞는
          <br />
          지원사업을 찾았습니다.
        </h1>
        <p>
          전체 정책 DB {summary.totalPolicyCount.toLocaleString("ko-KR")}건 중,
          <br />
          현재 기업·설비 조건과 연결되는 공고{" "}
          {summary.matchedPolicyCount.toLocaleString("ko-KR")}건을
          <br />
          우선순위로 정리했습니다.
        </p>
      </div>

      <div className="ff-policy-hero-right">
        <img className="ff-policy-bot" src={factoFitAiCharacter} alt="FactoFit AI" />
        <div className="ff-hero-stats">
          <div className="ff-hero-stat">
            <span>정책 DB 전체</span>
            <strong>{summary.totalPolicyCount.toLocaleString("ko-KR")}건</strong>
          </div>
          <div className="ff-hero-stat">
            <span>현재 확인 가능 공고</span>
            <strong>{summary.activePolicyCount.toLocaleString("ko-KR")}건</strong>
          </div>
          <div className="ff-hero-stat">
            <span>내 조건 매칭 공고</span>
            <strong>{summary.matchedPolicyCount.toLocaleString("ko-KR")}건</strong>
          </div>
          <div className="ff-hero-stat">
            <span>우선 검토 정책</span>
            <strong>{summary.priorityPolicyCount.toLocaleString("ko-KR")}건</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

function PriorityPolicyCard({
  project,
  analysisId,
  equipmentName,
  conditionPurpose,
  connectedItems,
}: {
  project: SupportProject
  analysisId: string
  equipmentName: string
  conditionPurpose: string
  connectedItems: string[]
}) {
  const navigate = useNavigate()
  const policyRouteId = getPolicyRouteId(project)
  const reviewItems = getReviewItems(project)
  const reasonChips = getReasonChips({
    project,
    equipmentName,
    conditionPurpose,
  })
  const reviewLine =
    reviewItems.length > 0
      ? reviewItems.join(" · ")
      : "세부 업종코드 · 필수 제출서류 · 유사 사업 수혜 이력"
  const visibleReviewItems =
    reviewItems.length > 0
      ? reviewItems
      : ["세부 업종코드", "필수 제출서류", "최근 유사 사업 수혜 이력"]

  return (
    <section className="ff-priority-card">
      <div className="ff-priority-final-grid">
        <div className="ff-priority-final-main">
          <span className="ff-policy-badge blue">우선 검토 정책</span>
          <h2>{project.title}</h2>
          <p className="ff-policy-subline">
            {project.agency || "주관기관 공고 확인"} · {formatAmount(project)} ·{" "}
            {formatDeadline(project)}
          </p>

          <div className="ff-short-reason">
            <strong>이 공고를 먼저 보는 이유</strong>
            <p>현재 기업·설비 조건과 정책 목적의 연결도가 가장 높습니다.</p>
          </div>

          {reasonChips.length > 0 && (
            <div className="ff-reason-chip-row" aria-label="추천 이유">
              {reasonChips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          )}

          <div className="ff-policy-actions">
            <button
              type="button"
              className="ff-policy-primary"
              onClick={() => {
                writeSelectedPolicy(project)
                navigate(`/analysis/${analysisId}/policies/${policyRouteId}`)
              }}
            >
              지원 조건 확인하기
            </button>
            {project.sourceUrl && (
              <button
                type="button"
                className="ff-policy-secondary"
                onClick={() => window.open(project.sourceUrl, "_blank", "noopener,noreferrer")}
              >
                공고 상세 보기
              </button>
            )}
          </div>

          <p className="ff-policy-next-hint">
            다음 단계: 공고 조건 확인 → 필요 서류 확인 → 신청서 초안 작성
          </p>
        </div>

        <aside className="ff-priority-final-side">
          <div className="ff-fit-score-panel">
            <span>매칭 적합도</span>
            <strong>
              {project.fitScore}
              <em>점 / 100</em>
            </strong>
          </div>

          {connectedItems.length > 0 && (
            <div className="ff-side-check-block">
              <h3>현재 조건과 연결된 항목</h3>
              <ul>
                {connectedItems.slice(0, 3).map((item) => (
                  <li key={item}>
                    <b>✓</b>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="ff-side-check-block warn">
            <h3>신청 전 확인 필요</h3>
            <ul>
              {visibleReviewItems.slice(0, 3).map((item) => (
                <li key={item}>
                  <b>!</b>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="ff-policy-checkline">
        <strong>신청 전 확인:</strong> {reviewLine}
        <small>공고문에서 최종 자격과 제외 조건을 확인해주세요.</small>
      </div>
    </section>
  )
}

function PolicyComparisonTabs({
  projects,
  analysisId,
}: {
  projects: SupportProject[]
  analysisId: string
}) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<"priority" | "all">("priority")
  const [showAll, setShowAll] = useState(false)
  const priorityProjects = projects.slice(1, 5)
  const visibleProjects = showAll ? projects : projects.slice(0, 5)

  if (projects.length <= 1) return null

  return (
    <section className="ff-policy-section-card">
      <div className="ff-policy-section-title">
        <div>
          <h2>다른 지원사업 비교</h2>
        </div>
      </div>

      <div className="ff-policy-tabs" role="tablist" aria-label="지원사업 비교">
        <button
          type="button"
          className={activeTab === "priority" ? "active" : ""}
          onClick={() => setActiveTab("priority")}
        >
          우선순위 후보 5건
        </button>
        <button
          type="button"
          className={activeTab === "all" ? "active" : ""}
          onClick={() => setActiveTab("all")}
        >
          전체 매칭 {projects.length}건
        </button>
      </div>

      {activeTab === "priority" && (
        <div className="ff-policy-list">
          {priorityProjects.map((project, index) => (
            <article
              className="ff-policy-row ff-policy-row-soft"
              key={`${project.rawId}-${project.title}`}
              onClick={() =>
                navigate(`/analysis/${analysisId}/policies/${getPolicyRouteId(project)}`)
              }
            >
              <span className="ff-policy-rank">{index + 2}</span>
              <span>
                <strong>{project.title}</strong>
                <small>
                  {project.agency || "주관기관 공고 확인"} · 매칭 적합도 {project.fitScore}점
                </small>
              </span>
              <span className="ff-policy-badge gray">추가 검토</span>
            </article>
          ))}
        </div>
      )}

      {activeTab === "all" && (
        <>
          <div className="ff-policy-table-head" aria-hidden="true">
            <span>순위</span>
            <span>정책명</span>
            <span>주관기관</span>
            <span>매칭 적합도</span>
            <span>상태</span>
          </div>

          <div className="ff-policy-list">
            {visibleProjects.map((project, index) => (
              <article
                className="ff-policy-table-row"
                key={`${project.rawId}-${project.title}-${index}`}
                onClick={() =>
                  navigate(`/analysis/${analysisId}/policies/${getPolicyRouteId(project)}`)
                }
              >
                <span className="ff-policy-rank">{index + 1}</span>
                <span>
                  <strong>{project.title}</strong>
                  <small>{project.policyCategory || "정책 분류 공고 확인"}</small>
                </span>
                <span>{project.agency || "공고 확인"}</span>
                <span>{project.fitScore}점</span>
                <span className="ff-policy-badge gray">
                  {index === 0 ? "우선 검토" : "추가 검토"}
                </span>
              </article>
            ))}
          </div>

          {!showAll && projects.length > 5 && (
            <div className="ff-policy-more">
              <button
                type="button"
                className="ff-policy-secondary"
                onClick={() => setShowAll(true)}
              >
                더 보기 ({projects.length - 5}건 더)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function usePolicyPageContext() {
  const { id = "latest" } = useParams()
  const analysisResult = getAnalysisResult(id)
  const condition = getAnalysisConditionDraft()
  const profile = getCompanyProfileDraft()
  const support = useSupportProjects()
  const equipmentName =
    analysisResult?.equipmentName ||
    support.selectedEquipmentContext.equipmentName ||
    condition.equipmentName ||
    "검토 설비"
  const investmentAmount = formatInvestment(condition.investmentAmount || condition.investmentRange)
  const connectedItems = [
    profile.industry || profile.industryCode ? "업종" : "",
    profile.regionSido || profile.regionSigungu ? "지역" : "",
    condition.equipmentName || condition.equipmentCategory || condition.purpose
      ? "설비·투자 목적"
      : "",
  ].filter(Boolean)

  return {
    analysisId: id,
    analysisResult,
    condition,
    support,
    equipmentName,
    investmentAmount,
    connectedItems,
  }
}

export function AnalysisPoliciesPage() {
  const navigate = useNavigate()
  const { analysisId, support, equipmentName, condition, connectedItems } = usePolicyPageContext()
  const policies = support.policyCards
  const topPolicy = policies[0]
  const summary = {
    totalPolicyCount: support.policySummary.totalPolicyCount,
    activePolicyCount: support.policySummary.activePolicyCount,
    matchedPolicyCount: support.policySummary.matchedPolicyCount || policies.length,
    priorityPolicyCount:
      support.policySummary.priorityPolicyCount || (topPolicy ? 1 : 0),
  }

  return (
    <main className="ff-policy-page">
      <section className="ff-policy-shell">
        <button
          type="button"
          className="ff-policy-back"
          onClick={() => navigate(`/analysis/${analysisId}/result`)}
        >
          ← 투자 검토 결과로 돌아가기
        </button>

        <HeroSection
          summary={summary}
          equipmentName={equipmentName}
        />

        {support.policyState === "loading" && <LoadingPolicyState />}
        {support.policyState === "error" && (
          <ErrorPolicyState onBackToRoi={() => navigate(`/analysis/${analysisId}/result`)} />
        )}
        {support.policyState === "empty" && <EmptyPolicies analysisId={analysisId} />}

        {support.policyState === "success" && topPolicy && (
          <>
            <PriorityPolicyCard
              project={topPolicy}
              analysisId={analysisId}
              equipmentName={equipmentName}
              conditionPurpose={condition.purpose}
              connectedItems={connectedItems}
            />
            <PolicyComparisonTabs projects={policies} analysisId={analysisId} />
          </>
        )}
      </section>
    </main>
  )
}

export function AnalysisPolicyDetailPage() {
  const navigate = useNavigate()
  const { id = "latest", policyId } = useParams()
  const { support } = usePolicyPageContext()
  const project = useMemo(
    () => findProjectByRouteId(support.policyCards, policyId),
    [policyId, support.policyCards],
  )

  return (
    <main className="ff-policy-page">
      <section className="ff-policy-shell">
        <button
          type="button"
          className="ff-policy-back"
          onClick={() => navigate(`/analysis/${id}/policies`)}
        >
          ← 맞춤 지원사업 목록
        </button>

        {support.policyState === "loading" && <LoadingPolicyState />}
        {support.policyState === "error" && (
          <ErrorPolicyState onBackToRoi={() => navigate(`/analysis/${id}/policies`)} />
        )}

        {support.policyState === "success" && !project && (
          <section className="ff-policy-empty">
            <span className="ff-policy-badge gray">정책을 찾을 수 없음</span>
            <h2>선택한 지원사업 정보를 찾지 못했습니다.</h2>
            <div className="ff-policy-actions">
              <button
                type="button"
                className="ff-policy-primary"
                onClick={() => navigate(`/analysis/${id}/policies`)}
              >
                목록으로 돌아가기
              </button>
            </div>
          </section>
        )}

        {project && (
          <section className="ff-policy-detail-card">
            <span className="ff-policy-badge blue">맞춤 추천</span>
            <h1>{project.title}</h1>
            <p className="ff-policy-subline">{project.description}</p>

            <PolicyMetaGrid project={project} />
            <ReasonAndReviewBlocks project={project} />

            {project.supportContent && project.supportContent !== "지원내용 준비 중" && (
              <section className="ff-policy-info-box" style={{ marginTop: "16px" }}>
                <h3>공고 요약</h3>
                <p>{project.supportContent}</p>
              </section>
            )}

            <div className="ff-policy-actions">
              <button
                type="button"
                className="ff-policy-primary"
                onClick={() => {
                  writeSelectedPolicy(project)
                  navigate(`/analysis/${id}/policies/${getPolicyRouteId(project)}/application`, {
                    state: {
                      policyId: project.rawId || String(project.id),
                      policy_id: project.rawId || String(project.id),
                      selectedProject: project,
                    },
                  })
                }}
              >
                지원 조건 확인하기
              </button>

              {project.sourceUrl && (
                <button
                  type="button"
                  className="ff-policy-secondary"
                  onClick={() => window.open(project.sourceUrl, "_blank", "noopener,noreferrer")}
                >
                  공고 원문 보기
                </button>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
