import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ApplicationDraftReadinessPanel } from "./ApplicationDraftReadinessPanel"

export function ApplicationDraftHero({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  return (
    <section className="ff-draft-hero ff-draft-hero-v2">
      <div className="ff-draft-hero-copy">
        <span className="ff-draft-hero-agent-badge">Factofit AI Agent</span>
        <h3>ROI 분석 결과를 바탕으로 지원사업 신청서 초안을 생성합니다.</h3>
        <p>
          기업정보 · 설비현황 · ROI 결과 · 정책활동을 연결해 신청서에 필요한
          근거와 문장을 한눈에 정리합니다.
        </p>
      </div>

      <ApplicationDraftReadinessPanel model={model} />
    </section>
  )
}
