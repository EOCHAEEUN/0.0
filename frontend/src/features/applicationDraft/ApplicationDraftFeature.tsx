import { useLocation, useNavigate } from "react-router-dom"
import { ApplicationDraftChecklistDialog } from "./components/ApplicationDraftChecklistDialog"
import { ApplicationDraftHero } from "./components/ApplicationDraftHero"
import { ApplicationDraftPdfPreview } from "./components/ApplicationDraftPdfPreview"
import { ApplicationDraftWorkspace } from "./components/ApplicationDraftWorkspace"
import { useApplicationDraft } from "./hooks/useApplicationDraft"

export function ApplicationDraftFeature() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = useApplicationDraft(location.state)

  if (draft.analysisData.draft_params === null && !draft.analysisData.isLoading) {
    return (
      <main className="page ff-draft-page">
        <section className="section white">
          <div className="container">
            <button
              type="button"
              onClick={() => navigate("/support-projects")}
              className="ff-draft-back-button"
            >
              ← 지원사업 목록으로 돌아가기
            </button>
            <div className="section-head">
              <div>
                <div className="screen-tag">FACTOFIT APPLICATION DRAFT</div>
                <div className="label">APPLICATION DRAFT</div>
                <h2>작성 중인 신청서가 없습니다.</h2>
              </div>
              <p className="section-desc">
                AI가 ROI 분석 결과를 바탕으로 지원사업 신청서 초안을 자동으로
                작성해드립니다. 지원사업을 선택하거나 기업 정보를 먼저
                입력해주세요.
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                className="btn blue"
                onClick={() => navigate("/support-projects")}
              >
                지원사업 둘러보기
              </button>
              <button
                type="button"
                className="btn dark"
                onClick={() => navigate("/setup/company")}
              >
                기업 정보 입력하기
              </button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page ff-draft-page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/support-projects")}
            className="ff-draft-back-button"
          >
            ← 지원사업 목록으로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT APPLICATION DRAFT</div>
              <div className="label">APPLICATION DRAFT</div>
              <h2>
                ROI 분석 결과를 바탕으로 <br />
                지원사업 신청서 초안을 생성합니다.
              </h2>
            </div>

            <p className="section-desc">
              선택한 지원사업과 ROI 분석 결과를 연결해 사업 필요성, 투자 규모,
              기대효과를 신청서 문장으로 정리합니다.
            </p>
          </div>

          <ApplicationDraftHero
            readinessScore={draft.readinessScore}
            scenarioKey={draft.scenarioKey}
            scenarioLabel={draft.scenarioLabel}
            subsidyManwon={draft.subsidyManwon ?? null}
            pdfStatusLabel={draft.pdfStatusLabel}
          />

          <ApplicationDraftWorkspace
            model={draft}
            onGoRoi={() => navigate("/roi")}
            onOpenChecklist={draft.openChecklist}
          />

          <ApplicationDraftPdfPreview
            model={draft}
            scenarioLabel={draft.scenarioLabel}
            expectedBenefits={draft.expectedBenefits}
            draftStatus={draft.draftStatus}
            onSaveDraft={draft.handleSaveDraft}
            onPrepareDownload={draft.handlePrepareDownload}
            onGoSupportProjects={() => navigate("/support-projects")}
          />

          <ApplicationDraftChecklistDialog
            open={draft.isChecklistOpen}
            checklistItems={draft.checklistItems}
            requiredDocuments={draft.requiredDocuments}
            onClose={draft.closeChecklist}
          />
        </div>
      </section>
    </main>
  )
}
