import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import factoFitAiCharacter from "./assets/factofit-ai-character.png"
import {
  getAnalysisConditionDraft,
  getAnalysisResult,
} from "../onboarding/onboardingState"
import { LoadingPolicyState, ErrorPolicyState } from "./components/SupportProjectStates"
import { PolicyDetailDialog } from "./components/SupportProjectDialogs"
import { useSupportProjects } from "./hooks/useSupportProjects"
import { fetchSafetyPreview, generateSafetyPreview } from "./supportProjects.api"
import type { RequiredEvidence, SafetyPreview, SupportProject } from "./supportProjects.contract"
import { getDday } from "./supportProjects.utils"
import "./AnalysisPoliciesPage.css"

function getPolicyRouteId(project: SupportProject) {
  return encodeURIComponent(project.rawId || String(project.id))
}

function pickText(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ""
}

function findProjectByRouteId(projects: SupportProject[], policyId?: string) {
  const decodedId = decodeURIComponent(policyId || "")
  return projects.find((project) => String(project.rawId || project.id) === decodedId) || null
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

function getSnapshotTags(project: SupportProject) {
  return project.tags
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .filter((tag) => !["지원사업", "주관사 미확인", "입력값 없음"].includes(tag))
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .slice(0, 4)
}

function formatCount(value: number) {
  return `${Math.max(0, value).toLocaleString("ko-KR")}건`
}

function formatSnapshotCapturedAt(analysisResult: unknown, analysisData: unknown) {
  const resultRecord =
    analysisResult && typeof analysisResult === "object" && !Array.isArray(analysisResult)
      ? (analysisResult as Record<string, unknown>)
      : {}
  const dataRecord =
    analysisData && typeof analysisData === "object" && !Array.isArray(analysisData)
      ? (analysisData as Record<string, unknown>)
      : {}
  const rawDate = pickText(
    resultRecord.createdAt,
    resultRecord.created_at,
    resultRecord.analyzedAt,
    resultRecord.analyzed_at,
    resultRecord.analysisAt,
    resultRecord.analysis_at,
    dataRecord.createdAt,
    dataRecord.created_at,
    dataRecord.analyzedAt,
    dataRecord.analyzed_at,
  )
  if (!rawDate) return ""

  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) return rawDate.slice(0, 10)
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
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

function SafetyImprovementPreview({
  preview,
  state,
}: {
  preview: SafetyPreview | null
  state: "loading" | "error" | "success"
}) {
  return <SafetyImprovementPreviewFromApi preview={preview} state={state} />
}

function getPreviewStatusBadgeClass(value: string) {
  return value.includes("설치") || value.includes("준비") ? "planned" : "needs-improvement"
}

function PreviewStatusBadge({ value }: { value: string }) {
  return (
    <span className={`ff-policy-safety-table-badge ${getPreviewStatusBadgeClass(value)}`}>
      {value}
    </span>
  )
}

function getEvidenceLabel(evidence: RequiredEvidence): string {
  if (typeof evidence === "string") return evidence
  return evidence.label || evidence.base_label || "준비자료 확인 필요"
}

function PreviewRequiredEvidences({
  evidences,
  count,
}: {
  evidences: RequiredEvidence[]
  count?: number | null
}) {
  const evidenceCount = count ?? evidences.length

  return (
    <span className="ff-policy-safety-evidence-popover">
      <button type="button" className="ff-policy-safety-evidence-count">
        필요 자료 {evidenceCount}개
      </button>
      {evidences.length > 0 && (
        <span className="ff-policy-safety-evidence-tooltip" role="tooltip">
          <strong>준비할 자료</strong>
          <ul>
            {evidences.map((evidence, index) => (
              <li key={`${getEvidenceLabel(evidence)}-${index}`}>{getEvidenceLabel(evidence)}</li>
            ))}
          </ul>
        </span>
      )}
    </span>
  )
}

function SafetyImprovementPreviewFromApi({
  preview,
  state,
}: {
  preview: SafetyPreview | null
  state: "loading" | "error" | "success"
}) {
  if (state === "loading") {
    return (
      <section className="ff-policy-safety-preview">
        <p className="ff-policy-safety-preview-note">안전개선 준비 항목을 불러오고 있습니다.</p>
      </section>
    )
  }

  if (state === "error" || !preview) {
    return (
      <section className="ff-policy-safety-preview">
        <p className="ff-policy-safety-preview-note">안전개선 준비 항목을 불러오지 못했습니다.</p>
      </section>
    )
  }

  const items = preview.safety_preview_items || []

  return (
    <section className="ff-policy-safety-preview">
      <div className="ff-policy-safety-preview-head">
        <div>
          <span className="ff-safety-status-badge">안전개선 신청서 활용 가능성</span>
          <h3>{preview.equipment_name || "선택 설비"}</h3>
          <p>선택한 설비와 투자안을 기준으로 생성된 안전개선 준비 항목입니다.</p>
        </div>
      </div>

      <div className="ff-policy-safety-table-wrap">
        <table className="ff-policy-safety-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>안전개선 관점</th>
              <th>현재 판단</th>
              <th>준비할 자료</th>
              <th>설명/근거</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.no}-${item.viewpoint_key}`}>
                <td>{item.no}</td>
                <td>{item.viewpoint_title}</td>
                <td>
                  <PreviewStatusBadge value={item.current_judgement} />
                </td>
                <td>
                  <PreviewRequiredEvidences
                    evidences={item.required_evidences || []}
                    count={item.required_evidence_count}
                  />
                </td>
                <td>
                  <p className="ff-policy-safety-description">{item.description}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ff-policy-safety-preview-note">
        선택한 설비와 투자안을 기준으로 생성된 안전개선 준비 항목입니다. 실제 증빙 업로드는 신청서 작성 화면에서 진행합니다.
      </p>

    </section>
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
  snapshotCapturedAt,
}: {
  summary: {
    snapshotPolicyCount: number
    matchedPolicyCount: number
    candidatePolicyCount: number
    priorityPolicyCount: number
  }
  equipmentName: string
  snapshotCapturedAt: string
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
          이 분석 당시 저장된 정책 추천 결과입니다.
        </p>
        {snapshotCapturedAt && (
          <p className="ff-policy-hero-snapshot-meta">분석 시점: {snapshotCapturedAt}</p>
        )}
      </div>

      <div className="ff-policy-hero-right">
        <img className="ff-policy-bot" src={factoFitAiCharacter} alt="FactoFit AI" />
        <div className="ff-hero-stats">
          <div className="ff-hero-stat">
            <span>분석 당시 정책 수</span>
            <strong>{formatCount(summary.snapshotPolicyCount)}</strong>
          </div>
          <div className="ff-hero-stat">
            <span>내 조건 매칭 수</span>
            <strong>{formatCount(summary.matchedPolicyCount)}</strong>
          </div>
          <div className="ff-hero-stat">
            <span>추천 후보 수</span>
            <strong>{formatCount(summary.candidatePolicyCount)}</strong>
          </div>
          <div className="ff-hero-stat">
            <span>우선 검토 정책</span>
            <strong>{formatCount(summary.priorityPolicyCount)}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

function PriorityPolicyCard({
  project,
  onOpenDetail,
}: {
  project: SupportProject
  onOpenDetail: (project: SupportProject) => void
}) {
  const reviewItems = getReviewItems(project)
  const reasons = getPolicyReasons(project)
  const snapshotTags = getSnapshotTags(project)
  const scoreRatio = Math.min(100, Math.max(0, project.fitScore))
  const dday = getDday(project.deadlineRaw)
  const metaItems = [
    project.agency && project.agency !== "주관사 미확인" ? project.agency : "",
    project.amountValueManwon !== null ? project.amount : "",
    project.deadline && project.deadline !== "마감일 미정" ? project.deadline : "",
    dday && dday !== "마감일 미정" ? dday : "",
  ].filter(Boolean)

  return (
    <section className="ff-priority-card">
      <div className="ff-priority-final-grid">
        <div className="ff-priority-final-main">
          <span className="ff-policy-badge blue">우선 검토 정책</span>
          {metaItems.length > 0 && (
            <p className="ff-policy-subline">{metaItems.join(" · ")}</p>
          )}
          <h2>{project.title}</h2>

          {snapshotTags.length > 0 && (
            <div className="ff-reason-chip-row" aria-label="정책 태그">
              {snapshotTags.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          )}

          {reasons.length > 0 && (
            <div className="ff-short-reason">
              <strong>이 공고를 먼저 보는 이유</strong>
              <ul>
                {reasons.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="ff-policy-actions">
            <button
              type="button"
              className="ff-policy-primary"
              onClick={() => onOpenDetail(project)}
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
        </div>

        <aside className="ff-priority-final-side">
          <div className="ff-fit-score-panel">
            <span>매칭 적합도</span>
            <strong>
              {project.fitScore}
              <em>점 / 100</em>
            </strong>
          </div>

          <div className="ff-priority-score-progress" aria-hidden="true">
            <span style={{ width: `${scoreRatio}%` }} />
          </div>

          {snapshotTags.length > 0 && (
            <div className="ff-side-check-block">
              <h3>현재 조건과 연결된 항목</h3>
              <ul>
                {snapshotTags.slice(0, 3).map((item) => (
                  <li key={item}>
                    <b>✓</b>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reviewItems.length > 0 && (
            <div className="ff-side-check-block warn">
              <h3>신청 전 확인 필요</h3>
              <ul>
                {reviewItems.slice(0, 3).map((item) => (
                  <li key={item}>
                    <b>!</b>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
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
  const candidateProjects = projects.slice(1, 5)

  if (projects.length <= 1) {
    return (
      <section className="ff-policy-section-card">
        <div className="ff-policy-section-title">
          <div>
            <h2>다른 지원사업 비교</h2>
            <p>비교 가능한 추가 후보 정책이 없습니다.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="ff-policy-section-card">
      <div className="ff-policy-section-title">
        <div>
          <h2>다른 지원사업 비교</h2>
        </div>
      </div>
      <div className="ff-policy-list">
        {candidateProjects.map((project, index) => {
          const scoreRatio = Math.min(100, Math.max(0, project.fitScore))
          return (
            <article
              className="ff-policy-candidate-row"
              key={`${project.rawId}-${project.title}-${index}`}
              onClick={() =>
                navigate(`/analysis/${analysisId}/policies/${getPolicyRouteId(project)}`)
              }
            >
              <span className="ff-policy-rank">{index + 2}</span>
              <div className="ff-policy-candidate-main">
                <strong>{project.title}</strong>
                <small>{project.agency && project.agency !== "주관사 미확인" ? project.agency : ""}</small>
              </div>
              <div className="ff-policy-candidate-score">
                <p>{project.fitScore}점</p>
                <div className="ff-policy-candidate-progress" aria-hidden="true">
                  <span style={{ width: `${scoreRatio}%` }} />
                </div>
              </div>
              <button
                type="button"
                className="ff-policy-secondary ff-policy-candidate-button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(`/analysis/${analysisId}/policies/${getPolicyRouteId(project)}`)
                }}
              >
                상세 보기
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function LegacySnapshotMissingState({
  analysisId,
  equipmentId,
}: {
  analysisId: string
  equipmentId: string
}) {
  const navigate = useNavigate()
  const reanalysisPath =
    analysisId && equipmentId
      ? `/analysis/new?mode=reanalysis&equipmentId=${encodeURIComponent(equipmentId)}&parentAnalysisId=${encodeURIComponent(analysisId)}`
      : "/analysis/new"

  return (
    <section className="ff-policy-empty">
      <span className="ff-policy-badge gray">정책 이력 없음</span>
      <h2>이 분석은 정책 이력 저장 전 생성되었습니다.</h2>
      <p>
        정확한 지원사업 이력을 보려면 투자 조건을 다시 분석해 주세요.
        <br />
        새 분석에서는 정책 추천 결과가 함께 저장됩니다.
      </p>
      <div className="ff-policy-actions">
        <button
          type="button"
          className="ff-policy-primary"
          onClick={() => navigate(reanalysisPath)}
        >
          투자 조건 다시 설정
        </button>
        <button
          type="button"
          className="ff-policy-secondary"
          onClick={() => navigate("/support-projects/priority")}
        >
          최신 지원사업 둘러보기
        </button>
      </div>
    </section>
  )
}

function usePolicyPageContext() {
  const { id = "latest" } = useParams()
  const analysisResult = getAnalysisResult(id)
  const condition = getAnalysisConditionDraft()
  const support = useSupportProjects({
    analysisId: id && id !== "latest" ? id : undefined,
  })
  const equipmentId = pickText(
    (analysisResult as Record<string, unknown> | null)?.equipmentId,
    (analysisResult as Record<string, unknown> | null)?.equipment_id,
    (support.analysisData as Record<string, unknown> | null)?.equipment_id,
    (support.analysisData as Record<string, unknown> | null)?.equipmentId,
    support.analysisData.equipment?.equipment_id,
    window.localStorage.getItem("factofit_selected_equipment_id"),
    window.localStorage.getItem("factofit_equipment_id"),
  )
  const equipmentName =
    analysisResult?.equipmentName ||
    support.selectedEquipmentContext.equipmentName ||
    condition.equipmentName ||
    "검토 설비"

  return {
    analysisId: id,
    analysisResult,
    condition,
    support,
    equipmentId,
    equipmentName,
  }
}

export function AnalysisPoliciesPage() {
  const navigate = useNavigate()
  const { analysisId, analysisResult, support, equipmentId, equipmentName } = usePolicyPageContext()
  const [detailProject, setDetailProject] = useState<SupportProject | null>(null)
  const policies = support.policyCards
  const topPolicy = policies[0]
  const isSnapshotMissing = support.policyErrorCode === "POLICY_SNAPSHOT_MISSING"
  const summary = {
    snapshotPolicyCount: policies.length,
    matchedPolicyCount: policies.length,
    candidatePolicyCount: Math.max(policies.length - 1, 0),
    priorityPolicyCount: topPolicy ? 1 : 0,
  }
  const snapshotCapturedAt = formatSnapshotCapturedAt(analysisResult, support.analysisData)
  const handleGoDraftFromDetail = (project: SupportProject) => {
    const policyId = project.rawId || String(project.id)
    navigate(`/analysis/${analysisId}/policies/${getPolicyRouteId(project)}/application`, {
      state: {
        analysisId,
        policyId,
        policy_id: policyId,
        selectedProject: project,
      },
    })
  }

  return (
    <main className="ff-policy-page">
      <PolicyDetailDialog
        project={detailProject}
        onClose={() => setDetailProject(null)}
        onCreateDraft={() => {
          if (!detailProject) return
          handleGoDraftFromDetail(detailProject)
        }}
      />
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
          snapshotCapturedAt={snapshotCapturedAt}
        />

        {support.policyState === "loading" && <LoadingPolicyState />}
        {support.policyState === "error" && (
          isSnapshotMissing ? (
            <LegacySnapshotMissingState analysisId={analysisId} equipmentId={equipmentId} />
          ) : (
            <ErrorPolicyState onBackToRoi={() => navigate(`/analysis/${analysisId}/result`)} />
          )
        )}
        {support.policyState === "empty" && <EmptyPolicies analysisId={analysisId} />}

        {support.policyState === "success" && topPolicy && (
          <>
            <PriorityPolicyCard
              project={topPolicy}
              onOpenDetail={setDetailProject}
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
  const { support, condition } = usePolicyPageContext()
  const project = useMemo(
    () => findProjectByRouteId(support.policyCards, policyId),
    [policyId, support.policyCards],
  )
  const canShowSafetyImprovement = project?.can_run_safety_logic === true
  const [safetyPreview, setSafetyPreview] = useState<SafetyPreview | null>(null)
  const [safetyPreviewState, setSafetyPreviewState] = useState<"idle" | "loading" | "error" | "success">("idle")
  const equipmentId =
    support.analysisData.equipment?.equipment_id ||
    support.analysisData.equipment_id ||
    window.localStorage.getItem("factofit_equipment_id") ||
    window.localStorage.getItem("factofit_selected_equipment_id") ||
    ""

  useEffect(() => {
    let ignore = false

    async function loadSafetyPreview() {
      if (!project || project.can_run_safety_logic !== true) {
        setSafetyPreview(null)
        setSafetyPreviewState("idle")
        return
      }

      try {
        setSafetyPreviewState("loading")
        const preview =
          (await fetchSafetyPreview({
            analysisId: id,
            policyId: project.rawId || String(project.id),
            equipmentId,
          })) ||
          (await generateSafetyPreview({
            analysisId: id,
            policyId: project.rawId || String(project.id),
            equipmentId,
            body: {
              policy: project,
              equipment: {
                name: support.selectedEquipmentContext.equipmentName,
                category: support.analysisData.equipment?.category,
                process: support.analysisData.equipment?.process,
              },
              equipment_name: support.selectedEquipmentContext.equipmentName,
              equipment_type:
                support.analysisData.equipment?.category ||
                support.analysisData.equipment?.process ||
                condition.equipmentCategory,
              roi_context: {
                recommendedScenario: support.selectedEquipmentContext.recommendedScenario,
                roiPaybackMonths: support.selectedEquipmentContext.roiPaybackMonths,
                investmentManwon: support.selectedEquipmentContext.investmentManwon,
                subsidyManwon: support.selectedEquipmentContext.subsidyManwon,
                purpose: condition.purpose,
              },
            },
          }))

        if (ignore) return
        setSafetyPreview(preview)
        setSafetyPreviewState("success")
      } catch (error) {
        console.error("안전개선 preview API 호출 실패:", error)
        if (!ignore) {
          setSafetyPreview(null)
          setSafetyPreviewState("error")
        }
      }
    }

    void loadSafetyPreview()

    return () => {
      ignore = true
    }
  }, [condition.equipmentCategory, condition.purpose, equipmentId, id, project, support.analysisData.equipment, support.analysisData.equipment_id, support.selectedEquipmentContext])

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
            {canShowSafetyImprovement && (
              <SafetyImprovementPreview
                preview={safetyPreview}
                state={safetyPreviewState === "idle" ? "loading" : safetyPreviewState}
              />
            )}

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
                  navigate(`/analysis/${id}/policies/${getPolicyRouteId(project)}/application`, {
                    state: {
                      analysisId: id,
                      policyId: project.rawId || String(project.id),
                      policy_id: project.rawId || String(project.id),
                      selectedProject: project,
                    },
                  })
                }}
              >
                신청서 작성하기
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
