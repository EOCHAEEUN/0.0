import type { ApplicationDraftModel } from "../hooks/useApplicationDraft"
import {
  formatManwon,
  formatMonthlyPayback,
} from "../applicationDraft.utils"
import {
  InfoTip,
  ScenarioToggle,
  StatusBadge,
} from "./ApplicationDraftShared"

export function ApplicationDraftWorkspace({
  model,
  onGoRoi,
  onOpenChecklist,
}: {
  model: ApplicationDraftModel
  onGoRoi: () => void
  onOpenChecklist: () => void
}) {
  const isSnapshotDraft = Boolean(model.analysisData.draft_api_data?.analysis_id)

  return (
    <section className="ff-draft-workspace">
      <div className="ff-workspace-head">
        <div>
          <span className="ff-mini-label">초안 생성 흐름</span>
          <h3>정보 확인부터 초안 요약까지 한 화면에서 확인합니다.</h3>
        </div>
        <p>
          각 영역은 연결되어 있지만, 시선이 분산되지 않도록 하나의 작업 박스
          안에서 정리했습니다.
        </p>
      </div>

      <div className="ff-workspace-grid">
        <div className="ff-draft-left-stack">
          <div className="ff-card ff-readiness-card">
            <div className="ff-card-head">
              <div>
                <span className="ff-mini-label">지원사업 신청 준비 현황</span>
                <div className="ff-readiness-title-row">
                  <h3>신청 준비도</h3>
                  <button
                    type="button"
                    className="ff-readiness-info-button"
                    aria-label="신청준비도 체크리스트 보기"
                    onMouseEnter={onOpenChecklist}
                    onFocus={onOpenChecklist}
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                </div>
                <p>
                  ROI, 기업정보, 설비현황, 지원사업 적합도를 기준으로 초안 작성
                  준비도를 종합 평가했습니다.
                </p>
              </div>
              <span className="ff-pill blue">AI 검토</span>
            </div>

            <div className="ff-readiness-score">
              <strong>{model.readinessScore}</strong>
              <span>/100</span>
            </div>

            <p className="ff-readiness-copy">
              현재 분석 결과 기준으로 <b>{model.equipmentName}</b> 설비투자
              신청서 초안을 생성했습니다. 제출 전에는 견적서, 설비 사진, 공고
              원문을 최종 확인해주세요.
            </p>

            <div className="ff-progress-track">
              <i style={{ width: `${model.readinessScore}%` }} />
            </div>

            <div className="ff-readiness-parts">
              {model.readinessParts.map((part) => (
                <div className="ff-readiness-part" key={part.key}>
                  <div>
                    <strong>
                      {part.label}
                      <InfoTip>{part.description}</InfoTip>
                    </strong>
                    <span>
                      {part.score} / {part.weight}점 반영
                    </span>
                  </div>
                  <StatusBadge tone={part.tone}>{part.status}</StatusBadge>
                </div>
              ))}
            </div>
          </div>

          <div className="ff-card ff-ai-reason-card">
            <div className="ff-card-head compact">
              <div>
                <span className="ff-mini-label">AI 작성 근거</span>
                <h3>초안 생성 반영 기준</h3>
              </div>
            </div>
            <ul>
              {model.aiReasons.slice(0, 4).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ff-card ff-draft-preview-card">
          <div className="ff-card-head">
            <div>
              <span className="ff-mini-label">AI 신청서 초안</span>
              <h3>핵심 요약</h3>
              <p>
                PDF 보고서로 확장되기 전, 신청서에 바로 옮겨 적을 핵심 문장을
                먼저 확인합니다.
              </p>
            </div>
            <button type="button" className="ff-soft-button" onClick={onGoRoi}>
              ROI 다시 보기
            </button>
          </div>

          <div className="ff-summary-box">{model.draftMessage}</div>

          <div className="ff-scenario-row">
            <div>
              <b>투자 시나리오 선택</b>
              <span>
                지원사업 페이지에서 넘어온 A/B 조건을 기준으로 기본 선택됩니다.
              </span>
            </div>
            <ScenarioToggle
              selected={model.scenarioKey}
              onChange={model.setScenarioKey}
            />
          </div>

          <div className="ff-metric-grid">
            <div>
              <span>총 투자금</span>
              <strong>{formatManwon(model.investmentManwon)}</strong>
            </div>
            <div>
              <span>예상 지원금</span>
              <strong>
                {isSnapshotDraft && model.subsidyManwon === null
                  ? "지원금 확인 필요"
                  : formatManwon(model.subsidyManwon)}
              </strong>
            </div>
            <div>
              <span>예상 회수기간</span>
              <strong>
                {isSnapshotDraft && model.paybackMonths === null
                  ? "분석 결과 없음"
                  : formatMonthlyPayback(model.paybackMonths)}
              </strong>
            </div>
          </div>

          <div className="ff-draft-table">
            <div>
              <span>추천 신청사업</span>
              <b>{model.selectedPolicy}</b>
            </div>
            <div>
              <span>주관사</span>
              <b>{model.selectedAgency}</b>
            </div>
            <div>
              <span>기업명</span>
              <b>{model.companyName}</b>
            </div>
            <div>
              <span>대상 설비</span>
              <b>{model.equipmentName}</b>
            </div>
            <div>
              <span>신청 목적</span>
              <b>{model.applicationPurpose}</b>
            </div>
            <div>
              <span>주요 기대효과</span>
              <b>{model.expectedBenefits.join(", ")}</b>
            </div>
          </div>

          <div className="ff-mini-cards">
            <div>
              <strong>{model.scenarioLabel}</strong>
              <span>ROI {model.roiText} · 우선 검토</span>
            </div>
            <div>
              <strong>{model.industryText}</strong>
              <span>
                {model.company?.region || "지역 정보 없음"} ·{" "}
                {model.company?.company_type || "기업유형 정보 없음"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
