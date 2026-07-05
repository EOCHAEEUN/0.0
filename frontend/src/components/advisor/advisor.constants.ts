import type {
  AdvisorDraftHighlight,
  AdvisorDraftProgress,
  AdvisorDraftStatus,
  AdvisorOtherProject,
  AdvisorQuickMenu,
  AdvisorRequirement,
  AdvisorResultCard,
  AdvisorSupportProject,
  AdvisorTopPick,
  AdvisorDashboardStat,
  AdvisorDashboardDeadline,
  AdvisorRecentAnalysis,
  GuestChatAction,
  GuestSuggestionChip,
} from "./advisor.types"

export const GUEST_COMPANY_NAME = "강승우 제조"

export const ANALYSIS_STEPS = ["필수 정보 입력", "AI 자동 분석", "결과 저장"] as const

export const QUICK_MENUS: AdvisorQuickMenu[] = [
  { id: "intro", label: "팩토핏 소개", icon: "F" },
  { id: "dashboard", label: "대시보드", icon: "▦" },
  { id: "roi", label: "ROI 분석", icon: "▥" },
  { id: "support", label: "지원사업 추천", icon: "◎" },
  { id: "draft", label: "신청서 초안", icon: "▤" },
  { id: "advisor", label: "AI Advisor", icon: "AI" },
]

export const DASHBOARD_STATS: AdvisorDashboardStat[] = [
  { icon: "⚙", label: "설비", value: "1" },
  { icon: "◷", label: "마감 임박", value: "1" },
  { icon: "◎", label: "매칭 정책", value: "10" },
  { icon: "▥", label: "분석", value: "1" },
]

export const DASHBOARD_DEADLINES: AdvisorDashboardDeadline[] = [
  { dday: "D-3", tone: "red", title: "AX 선도모델" },
  { dday: "D-7", tone: "orange", title: "스마트공장 구축" },
  { dday: "D-12", tone: "blue", title: "제조혁신 바우처" },
]

export const DASHBOARD_RECENT_ANALYSIS: AdvisorRecentAnalysis[] = [
  { no: "01", title: "프레스 1 투자분석", status: "완료", tone: "green" },
  { no: "02", title: "프레스 1 부분교체", status: "검토", tone: "orange" },
  { no: "03", title: "에너지 비용 절감안", status: "저장", tone: "blue" },
]

export const GUEST_CHAT_ACTIONS: GuestChatAction[] = [
  { id: "roi-detail", label: "ROI 상세", icon: "▥", screen: "roi" },
  { id: "ab-compare", label: "A/B 비교", icon: "⇄", screen: "roi" },
  { id: "investment", label: "투자금 변경", icon: "₩", screen: "roi" },
  { id: "support", label: "매칭 지원사업", icon: "🏛", screen: "support" },
  { id: "draft", label: "신청서 초안", icon: "▤", screen: "draft" },
  { id: "dashboard", label: "종합현황", icon: "▦", screen: "dashboard" },
]

export const GUEST_SUGGESTION_CHIPS: GuestSuggestionChip[] = [
  {
    id: "analysis-summary",
    label: "현재 분석 요약해줘",
    message: "현재 분석 요약해줘",
  },
  {
    id: "scenario-rationale",
    label: "추천 시나리오 근거 알려줘",
    message: "추천 시나리오 근거 알려줘",
  },
  {
    id: "ab-diff",
    label: "A안/B안 차이 쉽게 설명해줘",
    message: "A안/B안 차이 쉽게 설명해줘",
  },
  {
    id: "safety-check-summary",
    label: "안전점검 현황 알려줘",
    message: "안전점검 현황 알려줘",
    action: "safety_check_summary",
    requiresEquipment: true,
  },
  {
    id: "next-todo",
    label: "지금 바로 해야 할 일 정리해줘",
    message: "지금 바로 해야 할 일 정리해줘",
  },
]

export const GUEST_ENGI_GREETING =
  "안녕하세요. 작업형 AI 어드바이저 Engi입니다. 어떤 점을 도와드릴까요?"

export const ROI_REQUIREMENTS: AdvisorRequirement[] = [
  { icon: "⚙", title: "설비" },
  { icon: "▦", title: "사용연수" },
  { icon: "ϟ", title: "연간 에너지 비용" },
  { icon: "₩", title: "예상 투자비" },
]

export const ROI_RESULTS: AdvisorResultCard[] = [
  { icon: "◔", title: "ROI", description: "투자 대비 수익률" },
  { icon: "◷", title: "회수기간", description: "투자금 회수 기간" },
  { icon: "🏛", title: "지원사업 연계", description: "연계 가능 사업 안내" },
]

export const SUPPORT_TOP_PICK: AdvisorTopPick = {
  badge: "TOP 추천",
  title: "상생형 AI 전환(AX) 선도모델 구축지원",
  tags: ["스마트공장", "전체교체", "금천구", "프레스 1"],
  score: 81,
  max: 100,
}

export const SUPPORT_OTHER_PROJECTS: AdvisorOtherProject[] = [
  { dday: "D-1", tone: "green", title: "2차 자동차 산업 · 기업 도약 패키지" },
  { dday: "D-14", tone: "blue", title: "중소기업 환경개선자금 이자지원 계획" },
  { dday: "D-21", tone: "orange", title: "스마트공장 고도화 지원사업" },
]

export const DRAFT_HIGHLIGHTS: AdvisorDraftHighlight[] = [
  { icon: "🏭", title: "설비 노후화", desc: "프레스 1호기 9년 경과" },
  { icon: "AI", title: "AI 전환 필요", desc: "모니터링 · 스마트화 추진" },
  { icon: "↗", title: "생산성 · 안전성 개선", desc: "효율 · 품질 향상 기대" },
]

export const DRAFT_SAFETY_STATUS: AdvisorDraftStatus[] = [
  { icon: "⚠", title: "작업자 위험 노출 감소", status: "개선 필요", tone: "red" },
  { icon: "⚙", title: "설비 운영 안정성 개선", status: "일부 보유", tone: "yellow" },
  { icon: "☑", title: "교체 후 안전관리 체계 구축", status: "설치 후 준비 예정", tone: "blue" },
]

export const DRAFT_SECTIONS: AdvisorDraftHighlight[] = [
  { icon: "PDF", title: "사업 필요성", desc: "노후 · 비용 · 품질" },
  { icon: "▤", title: "추진 내용", desc: "교체 · 도입 · 실행" },
  { icon: "▥", title: "기대효과", desc: "절감 · 개선 · 관리" },
]

export const SUPPORT_PROJECTS: AdvisorSupportProject[] = [
  {
    rank: 1,
    title: "스마트공장 구축 지원사업",
    subsidy: "예상 지원금 최대 2.0억원",
    effect: "생산성 향상, 불량률 감소 기대",
    fit: "92%",
    tags: ["제조업", "중소기업", "설비투자"],
  },
  {
    rank: 2,
    title: "에너지효율 개선 자금 지원",
    subsidy: "예상 지원금 최대 1.5억원",
    effect: "에너지 비용 절감, 탄소배출 저감 효과",
    fit: "88%",
    tags: ["전 제조업", "중소기업", "설비개선"],
  },
  {
    rank: 3,
    title: "제조혁신 바우처 지원사업",
    subsidy: "예상 지원금 최대 7,000만원",
    effect: "기술·디자인·컨설팅 등 종합 지원",
    fit: "84%",
    tags: ["제조업", "중소기업", "혁신성장"],
  },
]

export const DRAFT_PROGRESS: AdvisorDraftProgress[] = [
  {
    no: "1",
    title: "기업 개요",
    description: "기업 일반현황 및 핵심 역량",
    status: "done",
  },
  {
    no: "2",
    title: "도입 배경",
    description: "현황 분석 및 문제점",
    status: "done",
  },
  {
    no: "3",
    title: "투자 계획",
    description: "도입 설비 및 추진 계획",
    status: "done",
  },
  {
    no: "4",
    title: "기대 효과",
    description: "정량·정성 효과 분석",
    status: "writing",
  },
  {
    no: "5",
    title: "필수 제출서류",
    description: "첨부서류 목록 및 준비현황",
    status: "wait",
  },
]

export const COMPANY_REQUIRED = [
  { no: "1", icon: "▦", title: "기업명", desc: "회사 식별 기준" },
  { no: "2", icon: "▰", title: "업종 코드", desc: "지원사업 매칭 기준" },
  { no: "3", icon: "●", title: "지역", desc: "지역별 사업 추천" },
  { no: "4", icon: "♟", title: "직원 수", desc: "기업 규모 판단" },
  { no: "5", icon: "▥", title: "연매출액", desc: "지원 자격 확인" },
]

export const SAFETY_ITEMS = [
  { icon: "盾", title: "안전장치" },
  { icon: "🔴", title: "비상정지" },
  { icon: "💧", title: "누유·압력" },
  { icon: "▥", title: "이상소음" },
  { icon: "▣", title: "점검 주기" },
  { icon: "▤", title: "기록 저장" },
]
