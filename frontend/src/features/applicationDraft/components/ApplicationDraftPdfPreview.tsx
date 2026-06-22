import type { DraftStatus } from "../applicationDraft.contract"

export function ApplicationDraftPdfPreview({
  scenarioLabel,
  expectedBenefits,
  draftStatus,
  onSaveDraft,
  onPrepareDownload,
  onGoSupportProjects,
}: {
  scenarioLabel: string
  expectedBenefits: string[]
  draftStatus: DraftStatus
  onSaveDraft: () => void
  onPrepareDownload: () => void
  onGoSupportProjects: () => void
}) {
  return (
    <section className="ff-card ff-final-preview-section">
      <div className="ff-pdf-expand-preview">
        <div className="ff-pdf-expand-head">
          <div>
            <span className="ff-mini-label">PDF 확장 미리보기</span>
            <h4>최종 PDF에서는 이렇게 확장됩니다.</h4>
          </div>
          <p>
            현재 입력된 기업정보, 설비현황, ROI 분석 결과를 바탕으로 제출 참고용 문서 구조로 정리합니다.
          </p>
        </div>

        <div className="ff-pdf-expand-grid">
          <article>
            <span>01</span>
            <h5>사업 필요성</h5>
            <p>
              노후 설비, 에너지 비용, 유지보수 부담, 품질 개선 필요성을 신청 배경으로 정리합니다.
            </p>
          </article>
          <article>
            <span>02</span>
            <h5>추진 내용</h5>
            <p>
              {scenarioLabel} 기준으로 설비 교체 방향, 도입 목적, 실행 계획을 신청서 문장으로 구성합니다.
            </p>
          </article>
          <article>
            <span>03</span>
            <h5>기대효과</h5>
            <p>
              {expectedBenefits.slice(0, 3).join(", ")} 효과를 중심으로 성과관리 기준까지 확장합니다.
            </p>
          </article>
        </div>
      </div>

      <div className="ff-draft-actions ff-final-actions">
        <button className="blue" type="button" onClick={onSaveDraft}>
          초안 저장하기
        </button>
        <button
          className="dark"
          type="button"
          disabled={draftStatus === "idle"}
          onClick={onPrepareDownload}
        >
          PDF 다운로드
        </button>
        <button className="green" type="button" onClick={onGoSupportProjects}>
          지원사업 목록 보기
        </button>
      </div>

      {draftStatus === "saved" && (
        <div className="ff-draft-alert success">
          신청서 초안이 저장되었습니다. 이제 PDF 다운로드 준비를 진행할 수 있습니다.
        </div>
      )}
      {draftStatus === "downloadReady" && (
        <div className="ff-draft-alert warning">
          PDF 다운로드가 완료되었습니다. 저장된 초안과 ROI 분석 결과를 기준으로 보고서를 생성했습니다.
        </div>
      )}
    </section>
  )
}
