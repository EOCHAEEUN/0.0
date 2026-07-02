import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ApplicationDraftProgressStepper } from "./ApplicationDraftProgressStepper"

export function ApplicationDraftHero({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  return (
    <header className="ff-draft-page-header">
      <div className="ff-draft-page-header-copy">
        <h2>ROI 분석 결과를 바탕으로 지원사업 신청서 초안을 생성합니다.</h2>
        <p>
          입력하신 기업 정보와 설비 데이터, ROI 분석 내용을 종합하여 최적화된
          사업계획서 요약본을 제공합니다.
        </p>
      </div>

      <ApplicationDraftProgressStepper />
    </header>
  )
}
