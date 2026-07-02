import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  Layers,
  Sparkles,
  Target,
} from "lucide-react"
import { useCallback } from "react"
import type { NavigateFunction } from "react-router-dom"

import engiBot from "../../../assets/advisor/engi-bot-transparent.png"
import type { ApplicationDraftDashboardModel, DraftNavigationParams } from "../applicationDraftDashboard.utils"
import { StatusBadge } from "./ApplicationDraftShared"
import { useApplicationDraftDashboard } from "../hooks/useApplicationDraftDashboard"
import { ApplicationDraftWorkspaceLayout } from "./ApplicationDraftWorkspaceLayout"

function CircularProgress({ value }: { value: number }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="ff-addash-progress-ring" aria-hidden="true">
      <svg viewBox="0 0 84 84">
        <circle className="ff-addash-progress-track" cx="42" cy="42" r={radius} />
        <circle
          className="ff-addash-progress-fill"
          cx="42"
          cy="42"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <strong>{value}%</strong>
    </div>
  )
}

function navigateToDraft(
  navigate: NavigateFunction,
  params: DraftNavigationParams,
) {
  const draftSearchParams = new URLSearchParams({ policyId: params.policyId })
  if (params.analysisId) {
    draftSearchParams.set("analysisId", params.analysisId)
  }

  navigate(`/application-draft?${draftSearchParams.toString()}`, {
    state: {
      companyId: params.companyId,
      company_id: params.companyId,
      equipmentId: params.equipmentId,
      equipment_id: params.equipmentId,
      policyId: params.policyId,
      policy_id: params.policyId,
      ...(params.analysisId
        ? { analysisId: params.analysisId, analysis_id: params.analysisId }
        : {}),
      selectedProject: {
        ...(params.selectedProject ?? {}),
        companyId: params.companyId,
        equipmentId: params.equipmentId,
        policyId: params.policyId,
        ...(params.analysisId
          ? { analysisId: params.analysisId, analysis_id: params.analysisId }
          : {}),
      },
    },
  })
}

export function ApplicationDraftDashboard({
  navigate,
}: {
  navigate: NavigateFunction
}) {
  const model = useApplicationDraftDashboard()

  const handleStartDraft = useCallback(() => {
    if (model.navigationSeed) {
      navigateToDraft(navigate, model.navigationSeed)
      return
    }

    navigate("/support-projects/priority")
  }, [model.navigationSeed, navigate])

  const handleGeneratePdf = useCallback(() => {
    if (!model.navigationSeed || !model.hasStoredDraft) return
    navigateToDraft(navigate, model.navigationSeed)
  }, [model.hasStoredDraft, model.navigationSeed, navigate])

  const handleOpenDraft = useCallback(
    (canOpen: boolean) => {
      if (!canOpen || !model.navigationSeed) return
      navigateToDraft(navigate, model.navigationSeed)
    },
    [model.navigationSeed, navigate],
  )

  return (
    <ApplicationDraftWorkspaceLayout
      analysisId={model.navigationSeed?.analysisId}
      policyId={model.navigationSeed?.policyId}
    >
      <div className="ff-addash-container">
        <SummaryBar model={model} />
        <MetricCards model={model} />
        <div className="ff-addash-main-grid">
          <PrepareCard
            model={model}
            onStartDraft={handleStartDraft}
            onGoRoi={() => navigate("/roi")}
            onGoSupport={() => navigate("/support-projects/priority")}
          />
          <ReadinessCard model={model} />
        </div>
        <DraftWorkSection
          model={model}
          onGeneratePdf={handleGeneratePdf}
          onStartDraft={handleStartDraft}
          onOpenDraft={handleOpenDraft}
        />
      </div>
    </ApplicationDraftWorkspaceLayout>
  )
}

function SummaryBar({ model }: { model: ApplicationDraftDashboardModel }) {
  return (
    <section className="ff-addash-summary">
      <div className="ff-addash-summary-left">
        <div className="ff-addash-company-head">
          <Building2 size={18} aria-hidden="true" />
          <div>
            <h1>{model.companyName}</h1>
            <p>
              {model.industryText !== "업종 정보 없음" ? model.industryText : "정보 없음"}
              {model.regionText !== "정보 없음" ? ` · ${model.regionText}` : ""}
            </p>
            <span>{model.equipmentName}</span>
          </div>
        </div>

        <div className="ff-addash-badge-row">
          {model.hasEquipment && (
            <span className="ff-addash-badge">
              <Factory size={14} aria-hidden="true" />
              등록 설비 1대
            </span>
          )}
          {model.analysisData.roi_result && (
            <span className="ff-addash-badge ok">
              <CheckCircle2 size={14} aria-hidden="true" />
              {model.equipmentName} ROI 분석 완료
            </span>
          )}
          {model.matchedCount > 0 && (
            <span className="ff-addash-badge">
              <Target size={14} aria-hidden="true" />
              매칭 정책 {model.matchedCount}건
            </span>
          )}
          {model.readinessPercent > 0 && (
            <span className="ff-addash-badge accent">
              <Sparkles size={14} aria-hidden="true" />
              초안 준비도 {model.readinessPercent}%
            </span>
          )}
          {model.scenarioLabel !== "시나리오 선택 필요" && (
            <span className="ff-addash-badge">
              <Layers size={14} aria-hidden="true" />
              {model.scenarioLabel}
            </span>
          )}
        </div>
      </div>

      <div className="ff-addash-summary-right">
        <div className="ff-addash-task-summary">
          {model.canCountTodayTasks ? (
            <>
              <strong>오늘 작업 {model.todayTaskCount}건</strong>
              {model.urgentDeadlineCount > 0 && (
                <span>확인할 마감 {model.urgentDeadlineCount}건</span>
              )}
            </>
          ) : (
            <strong>현재 확인할 항목</strong>
          )}
        </div>
        <div className="ff-addash-engi-inline">
          <img src={engiBot} alt="" aria-hidden="true" />
          <p>{model.engiMessage}</p>
        </div>
      </div>
    </section>
  )
}

function MetricCards({ model }: { model: ApplicationDraftDashboardModel }) {
  return (
    <section className="ff-addash-metrics">
      <article className="ff-addash-metric-card">
        <div className="ff-addash-metric-icon">
          <Gauge size={18} aria-hidden="true" />
        </div>
        <span>초안 준비도</span>
        <div className="ff-addash-metric-main">
          <CircularProgress value={model.readinessPercent} />
          <div>
            <strong>{model.readinessPercent}%</strong>
            <small>AI 종합 평가</small>
          </div>
        </div>
      </article>

      <article className="ff-addash-metric-card">
        <div className="ff-addash-metric-icon">
          <Layers size={18} aria-hidden="true" />
        </div>
        <span>선택 시나리오</span>
        <strong className="ff-addash-clamp">{model.scenarioLabel}</strong>
        <small>{model.scenarioLabel !== "시나리오 선택 필요" ? "권장 시나리오" : "분석 후 선택"}</small>
      </article>

      <article className="ff-addash-metric-card">
        <div className="ff-addash-metric-icon">
          <Target size={18} aria-hidden="true" />
        </div>
        <span>추천 지원사업</span>
        <strong>
          {model.matchedCount > 0 ? model.matchedCount : "지원사업 매칭 필요"}
        </strong>
        <small>{model.recommendedSubLabel}</small>
      </article>

      <article className="ff-addash-metric-card">
        <div className="ff-addash-metric-icon">
          <ClipboardList size={18} aria-hidden="true" />
        </div>
        <span>준비 항목</span>
        <strong>
          {model.incompletePrepCount > 0
            ? model.incompletePrepCount
            : "준비 완료"}
        </strong>
        <small>{model.incompletePrepLabels}</small>
      </article>
    </section>
  )
}

function PrepareCard({
  model,
  onStartDraft,
  onGoRoi,
  onGoSupport,
}: {
  model: ApplicationDraftDashboardModel
  onStartDraft: () => void
  onGoRoi: () => void
  onGoSupport: () => void
}) {
  return (
    <article className="ff-addash-prepare-card">
      {model.showPriorityBadges && (
        <div className="ff-addash-mini-badges">
          <span className="ff-addash-mini-badge primary">오늘의 최우선</span>
          <span className="ff-addash-mini-badge">Engi 추천</span>
        </div>
      )}

      <h2>신청서 초안 생성 준비</h2>
      <p>
        ROI 분석 결과와 지원사업 추천을 바탕으로 신청서 초안 생성 준비 상태를
        확인합니다.
      </p>

      {model.statusTags.length > 0 && (
        <div className="ff-addash-status-tags">
          {model.statusTags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}

      <div className="ff-addash-engi-box">
        <img src={engiBot} alt="" aria-hidden="true" />
        <p>
          <strong>Engi 판단:</strong> {model.engiMessage}
        </p>
      </div>

      <div className="ff-addash-action-row">
        <button type="button" className="btn blue" onClick={onStartDraft}>
          초안 생성 시작하기
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn outline" onClick={onGoRoi}>
          ROI 결과 보기
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn outline" onClick={onGoSupport}>
          지원사업 보기
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="ff-addash-kpi-row">
        <div>
          <span>총 투자금</span>
          <strong>{model.investmentLabel}</strong>
        </div>
        <div>
          <span>예상 지원금</span>
          <strong>{model.subsidyLabel}</strong>
        </div>
        <div>
          <span>예상 회수기간</span>
          <strong>{model.paybackLabel}</strong>
        </div>
        <div>
          <span>추천 사업 수</span>
          <strong>{model.recommendedCountLabel}</strong>
        </div>
      </div>
    </article>
  )
}

function ReadinessCard({ model }: { model: ApplicationDraftDashboardModel }) {
  const allDone = model.checklist.every((item) => item.status === "완료")

  return (
    <article className="ff-addash-readiness-card">
      <div className="ff-addash-readiness-head">
        <div>
          <h3>신청 준비 체크</h3>
          <span>준비도 {model.readinessPercent}%</span>
        </div>
        <div className="ff-addash-progress-track">
          <i style={{ width: `${model.readinessPercent}%` }} />
        </div>
      </div>

      <ul className="ff-addash-checklist">
        {model.checklist.map((item) => (
          <li key={item.key}>
            <div className="ff-addash-check-icon" aria-hidden="true">
              {item.key === "company" && <Building2 size={18} />}
              {item.key === "equipment" && <Factory size={18} />}
              {item.key === "roi" && <Gauge size={18} />}
              {item.key === "policy" && <Target size={18} />}
            </div>
            <div className="ff-addash-check-copy">
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
            <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
            <ChevronRight size={16} aria-hidden="true" className="ff-addash-check-arrow" />
          </li>
        ))}
      </ul>

      {allDone && (
        <p className="ff-addash-readiness-foot">초안 생성 준비 완료</p>
      )}
    </article>
  )
}

function DraftWorkSection({
  model,
  onGeneratePdf,
  onStartDraft,
  onOpenDraft,
}: {
  model: ApplicationDraftDashboardModel
  onGeneratePdf: () => void
  onStartDraft: () => void
  onOpenDraft: (canOpen: boolean) => void
}) {
  const canPdf = model.hasStoredDraft && Boolean(model.navigationSeed)

  return (
    <section className="ff-addash-draft-section">
      <div className="ff-addash-draft-head">
        <div>
          <h3>내 초안 작업</h3>
          <p>최근 생성한 신청서 초안과 진행 상황을 확인하세요.</p>
        </div>
        <div className="ff-addash-draft-actions">
          <button
            type="button"
            className="btn outline navy"
            disabled={!canPdf}
            onClick={onGeneratePdf}
          >
            PDF 생성하기
          </button>
          <button type="button" className="btn blue" onClick={onStartDraft}>
            + 새 초안 생성 시작
          </button>
        </div>
      </div>

      {model.draftWorkItems.length > 0 ? (
        <div className="ff-addash-draft-list">
          {model.draftWorkItems.map((item) => (
            <article className="ff-addash-draft-row" key={item.id}>
              <div className="ff-addash-draft-icon" aria-hidden="true">
                <FileText size={20} />
              </div>
              <div className="ff-addash-draft-main">
                <strong className="ff-addash-clamp">{item.title}</strong>
                <p>
                  생성 {item.createdLabel}
                  {item.updatedLabel !== item.createdLabel
                    ? ` · 수정 ${item.updatedLabel}`
                    : ""}
                </p>
              </div>
              <StatusBadge tone={item.statusTone}>{item.statusLabel}</StatusBadge>
              <button
                type="button"
                className="ff-addash-draft-link"
                disabled={!item.canOpen}
                onClick={() => onOpenDraft(item.canOpen)}
              >
                결과 보기
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="ff-addash-draft-empty">
          <p>생성된 신청서 초안이 없습니다.</p>
          <span>지원사업을 선택한 뒤 첫 초안을 만들어 보세요.</span>
        </div>
      )}
    </section>
  )
}
