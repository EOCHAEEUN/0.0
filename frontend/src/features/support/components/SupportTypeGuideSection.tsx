import { ChevronRight, Landmark, Sparkles, Wallet } from "lucide-react"

import "../supportProjects.workspace.css"

type SupportTypeGuideSectionProps = {
  stats?: {
    directCount: number
    financeCount: number
    linkedCount: number
    directAmountLabel: string
    financeBenefitLabel: string
    linkedVoucherLabel: string
  }
  onViewDiscovery?: () => void
}

export function SupportTypeGuideSection({
  stats,
  onViewDiscovery,
}: SupportTypeGuideSectionProps) {
  const guides = [
    {
      title: "직접 지원금",
      icon: Wallet,
      body: "상환 의무가 없는 순수 보조금 형태입니다. 스마트공장 구축, 신규 설비 도입 시 사업비의 일정 비율을 무상 지원합니다.",
      statPrimaryLabel: "추천 사업 수",
      statPrimaryValue: `${stats?.directCount ?? 0}건`,
      statSecondaryLabel: "활용 가능 총액",
      statSecondaryValue: stats?.directAmountLabel ?? "-",
    },
    {
      title: "금융 지원",
      icon: Landmark,
      body: "저금리 대출, 이자 보전, 신용 보증 등 금융 부담을 줄여주는 지원입니다. 대규모 설비 투자 시 초기 자금 부담 완화에 유리합니다.",
      statPrimaryLabel: "추천 금융 상품",
      statPrimaryValue: `${stats?.financeCount ?? 0}건`,
      statSecondaryLabel: "평균 이자 혜택",
      statSecondaryValue: stats?.financeBenefitLabel ?? "-",
    },
    {
      title: "비금융 연계 지원",
      icon: Sparkles,
      body: "전문가 컨설팅, 시장 개척, 글로벌 전시회 참가 등 무형 자산을 지원합니다. 투자 효율과 실행 리스크를 함께 줄일 수 있습니다.",
      statPrimaryLabel: "추천 프로그램",
      statPrimaryValue: `${stats?.linkedCount ?? 0}건`,
      statSecondaryLabel: "연계 바우처",
      statSecondaryValue: stats?.linkedVoucherLabel ?? "-",
    },
  ]

  const handleViewAll = () => {
    onViewDiscovery?.()
  }

  return (
    <section className="ff-support-type-section" aria-labelledby="ff-support-type-heading">
      <header className="ff-support-type-head">
        <h2 id="ff-support-type-heading">지원사업 유형별 분석</h2>
      </header>

      <div className="ff-support-type-grid">
        {guides.map((guide) => {
          const Icon = guide.icon
          return (
            <article key={guide.title} className="ff-support-type-card">
              <div className="ff-support-type-card-top">
                <span className="ff-support-type-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={2.1} />
                </span>
                <h3>{guide.title}</h3>
              </div>
              <p>{guide.body}</p>
              <div className="ff-support-type-stats">
                <div>
                  <span>{guide.statPrimaryLabel}</span>
                  <strong>{guide.statPrimaryValue}</strong>
                </div>
                <div>
                  <span>{guide.statSecondaryLabel}</span>
                  <strong>{guide.statSecondaryValue}</strong>
                </div>
              </div>
              <button type="button" className="ff-support-type-link" onClick={handleViewAll}>
                전체 보기
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
