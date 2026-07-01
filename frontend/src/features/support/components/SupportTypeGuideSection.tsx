import type { LucideIcon } from "lucide-react"
import { Banknote, Landmark, UserCog } from "lucide-react"

import "../supportProjects.workspace.css"

type SupportTypeGuide = {
  title: string
  body: string
  icon: LucideIcon
}

const GUIDES: SupportTypeGuide[] = [
  {
    title: "직접 지원금",
    icon: Banknote,
    body: "기업의 현금 지출을 직접적으로 줄여주는 지원 형태입니다. 스마트공장 구축, 신규 설비 도입 시 사업비의 일정 비율(최대 50~70%)을 무상 지원합니다.",
  },
  {
    title: "금융 지원",
    icon: Landmark,
    body: "정책 자금을 통한 저금리 융자 또는 신용 보증을 지원합니다. 대규모 설비 투자 시 초기 자금 부담을 완화하고 상환 기간을 장기로 설정할 수 있습니다.",
  },
  {
    title: "비금융 연계 지원",
    icon: UserCog,
    body: "기술 컨설팅, 특허 출원, 공정 진단 등 전문가 서비스를 제공합니다. 직접적인 현금 지원은 아니나 투자 효율을 높이고 리스크를 줄이는 데 기여합니다.",
  },
]

export function SupportTypeGuideSection() {
  return (
    <section className="ff-support-guide-section" aria-labelledby="ff-support-guide-heading">
      <header className="ff-support-guide-head">
        <h2 id="ff-support-guide-heading">지원 형태 안내</h2>
        <p>위에서 확인한 정책들이 어떤 방식으로 지원되는지 미리 이해해 두면 신청 판단이 쉬워집니다.</p>
      </header>

      <div className="ff-support-guide-grid">
        {GUIDES.map((guide) => {
          const Icon = guide.icon
          return (
            <article key={guide.title} className="ff-support-guide-card">
              <div className="ff-support-guide-card-head">
                <span className="ff-support-guide-icon" aria-hidden="true">
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <h3>{guide.title}</h3>
              </div>
              <p>{guide.body}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
