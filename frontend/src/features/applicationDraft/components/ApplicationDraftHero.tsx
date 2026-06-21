import factofitAiCharacter from "../../support/assets/factofit-ai-character.png"
import type { ScenarioKey } from "../applicationDraft.contract"
import { formatManwon } from "../applicationDraft.utils"
import { StatCard, StepCard } from "./ApplicationDraftShared"

export function ApplicationDraftHero({
  readinessScore,
  scenarioKey,
  scenarioLabel,
  subsidyManwon,
  pdfStatusLabel,
}: {
  readinessScore: number
  scenarioKey: ScenarioKey
  scenarioLabel: string
  subsidyManwon: number | null
  pdfStatusLabel: string
}) {
  return (
    <section className="ff-draft-hero">
      <div className="ff-draft-hero-copy">
        <span>FactoFit AI Agent</span>
        <h3>
          분석 결과가 <br />
          <strong>신청서 초안</strong>으로 <br />
          이어집니다.
        </h3>
        <p>
          기업정보·설비현황·ROI 결과·정책 적합도를 연결해 신청서에 필요한
          근거와 문장을 한눈에 정리합니다.
        </p>
      </div>

      <div className="ff-draft-hero-board">
        <div className="ff-draft-steps">
          <StepCard
            index="01"
            title="정보 확인"
            description="마이페이지에 저장된 기업정보와 설비현황을 불러와 초안의 기본값으로 사용합니다."
          />
          <StepCard
            index="02"
            title="시나리오"
            description="지원사업 페이지에서 선택한 A/B 투자안을 기준으로 투자금과 지원금 항목을 정리합니다."
          />
          <StepCard
            index="03"
            title="초안 작성"
            description="ROI 분석 결과와 정책 적합도를 바탕으로 사업 필요성, 추진 내용, 기대효과 문장을 구성합니다."
          />
          <StepCard
            index="04"
            title="저장/PDF"
            description="저장된 초안을 기준으로 PDF 보고서 출력에 필요한 항목을 준비합니다."
          />
        </div>

        <div className="ff-draft-hero-grid">
          <div className="ff-draft-character-card">
            <div className="ff-draft-character-glow" aria-hidden="true" />
            <img src={factofitAiCharacter} alt="FactoFit AI" />
            <strong>FactoFit AI</strong>
            <span>
              저장된 정보를 읽고 <br />
              신청서 문장을 정리합니다.
            </span>
          </div>

          <div className="ff-draft-hero-stats">
            <StatCard
              label="초안 준비도"
              value={`${readinessScore}점`}
              caption="반영 기준 100점"
            />
            <StatCard
              label="선택 시나리오"
              value={scenarioKey}
              caption={scenarioLabel.replace(`${scenarioKey}안 `, "")}
            />
            <StatCard
              label="예상 지원금"
              value={formatManwon(subsidyManwon)}
              caption="정책/ROI 기준"
            />
            <StatCard
              label="PDF 상태"
              value={pdfStatusLabel}
              caption="저장 후 출력 준비"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
