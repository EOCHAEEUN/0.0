export type Tone = "green" | "blue" | "orange" | "red"

export type OpenPanel = "company" | "equipment" | null

export type KpiCard = {
  label: string
  value: string
  description: string
  tone: Tone
}

export type ServiceCard = {
  title: string
  description: string
  badge: string
  path: string
  tone: Tone
}

export type ProcessItem = {
  step: string
  title: string
  status: string
  description: string
  score: number
  grade: string
  tone: Tone
  icon: string
  supportProgram: string
  expectedSupport: string
  applicationStatus: string
  nextStep: string
  roi: string
  payback: string
}

export type ReasonItem = {
  title: string
  description: string
}

export type DdayItem = {
  title: string
  amount: string
  dday: string
}

export const kpiCards: KpiCard[] = [
  {
    label: "예상 지원금",
    value: "8,200만원",
    description: "기업 조건 기준 산정",
    tone: "green",
  },
  {
    label: "지원사업",
    value: "8건",
    description: "우선 검토 3건 포함",
    tone: "blue",
  },
  {
    label: "예상 ROI",
    value: "98%",
    description: "투자효과 시뮬레이션",
    tone: "orange",
  },
  {
    label: "회수기간",
    value: "1.3년",
    description: "지원금 적용 기준",
    tone: "red",
  },
]

export const serviceCards: ServiceCard[] = [
  {
    title: "지원사업 추천",
    description:
      "기업 조건과 설비투자 목적에 맞는 정부지원사업을 우선순위로 정리합니다.",
    badge: "POLICY",
    path: "/support-projects/priority",
    tone: "green",
  },
  {
    title: "ROI 분석",
    description:
      "총 투자금, 지원금, 절감액을 기준으로 실부담금과 회수기간을 계산합니다.",
    badge: "ROI",
    path: "/roi/strategy",
    tone: "blue",
  },
  {
    title: "안전 진단",
    description:
      "노후 설비, 유지보수 이력, 불량률을 바탕으로 안전 리스크를 점검합니다.",
    badge: "SAFETY",
    path: "/safety",
    tone: "orange",
  },
  {
    title: "AI Advisor",
    description:
      "설비투자, 지원사업, 신청서 작성 과정에서 필요한 질문에 답변합니다.",
    badge: "AI",
    path: "/advisor",
    tone: "red",
  },
]

export const processItems: ProcessItem[] = [
  {
    step: "01",
    title: "원자재 투입",
    status: "정상",
    description: "기초 항목 2건",
    score: 76,
    grade: "B등급",
    tone: "orange",
    icon: "▦",
    supportProgram: "원자재 공정 개선 지원",
    expectedSupport: "2,000만원",
    applicationStatus: "보완 후 가능",
    nextStep: "공정 자료 정리",
    roi: "112%",
    payback: "2.1년",
  },
  {
    step: "02",
    title: "CNC 가공",
    status: "검토 필요",
    description: "관련 항목 1건",
    score: 88,
    grade: "A등급",
    tone: "green",
    icon: "⚙",
    supportProgram: "고효율 설비 교체 지원사업",
    expectedSupport: "4,000만원",
    applicationStatus: "검토 추천",
    nextStep: "설비 견적 확인",
    roi: "241%",
    payback: "1.6년",
  },
  {
    step: "03",
    title: "프레스 성형",
    status: "우선 대상",
    description: "핵심 카드 5건",
    score: 96,
    grade: "S등급",
    tone: "blue",
    icon: "▣",
    supportProgram: "스마트공장 고도화 지원사업",
    expectedSupport: "5,000만원",
    applicationStatus: "즉시 준비 가능",
    nextStep: "ROI 계산",
    roi: "347%",
    payback: "1.3년",
  },
  {
    step: "04",
    title: "품질 검사",
    status: "개선 가능",
    description: "연계 항목 2건",
    score: 92,
    grade: "S등급",
    tone: "blue",
    icon: "▤",
    supportProgram: "품질관리 자동화 지원사업",
    expectedSupport: "3,800만원",
    applicationStatus: "신청 가능",
    nextStep: "검사 데이터 정리",
    roi: "298%",
    payback: "1.5년",
  },
  {
    step: "05",
    title: "포장 / 출하",
    status: "안정",
    description: "연계 항목 1건",
    score: 74,
    grade: "B등급",
    tone: "orange",
    icon: "↗",
    supportProgram: "물류 자동화 개선 지원",
    expectedSupport: "2,500만원",
    applicationStatus: "보완 필요",
    nextStep: "자동화 범위 검토",
    roi: "86%",
    payback: "2.8년",
  },
]

export const reasonItems: ReasonItem[] = [
  {
    title: "노후설비 교체 지원 대상",
    description:
      "유압 프레스 라인 A는 15년 사용 설비로 교체 권고 기준에 진입했습니다.",
  },
  {
    title: "업종 평균 교체주기 초과",
    description:
      "금속 가공업의 주요 생산설비 교체주기와 비교했을 때 점검 및 교체 검토가 필요합니다.",
  },
  {
    title: "에너지효율화 사업 신청 가능",
    description:
      "전기요금 절감 목적이 명확해 고효율 설비 교체 지원사업과도 연결됩니다.",
  },
  {
    title: "예상 지원금 확보 가능성 높음",
    description:
      "스마트공장 고도화 및 에너지 효율 개선 계열 사업에서 지원 가능성이 높습니다.",
  },
  {
    title: "ROI 우수",
    description:
      "예상 ROI가 높고 회수기간이 짧아 투자효과 설명 근거로 활용하기 좋습니다.",
  },
]

export const ddayItems: DdayItem[] = [
  {
    title: "KIAT 스마트공정개선",
    amount: "최대 8,000만원",
    dday: "D-42",
  },
  {
    title: "에너지공단 노후설비교체",
    amount: "최대 1억 2,000만원",
    dday: "D-67",
  },
  {
    title: "KICOX 스마트공장 구축",
    amount: "최대 1억 5,000만원",
    dday: "D-112",
  },
]

export function getToneColor(tone: Tone) {
  if (tone === "green") return "#0B7A53"
  if (tone === "blue") return "#344BA0"
  if (tone === "orange") return "#E65F00"
  return "#CD2E3A"
}

export function getToneSoftColor(tone: Tone) {
  if (tone === "green") return "#E8F5EF"
  if (tone === "blue") return "#EEF6FF"
  if (tone === "orange") return "#FFF2DF"
  return "#FDE8E9"
}

export function getEquipmentGradient(tone: Tone) {
  if (tone === "green") {
    return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #E8F5EF 45%, #F8FAFC 100%)"
  }

  if (tone === "blue") {
    return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #EAF1FF 45%, #F8FAFC 100%)"
  }

  if (tone === "orange") {
    return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FFF2DF 45%, #F8FAFC 100%)"
  }

  return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FDE8E9 45%, #F8FAFC 100%)"
}

export function getProcessTooltipLeft(step: string) {
  if (step === "01") return "12%"
  if (step === "02") return "28%"
  if (step === "03") return "50%"
  if (step === "04") return "72%"
  return "88%"
}
