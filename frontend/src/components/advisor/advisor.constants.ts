import type {
  AdvisorDraftProgress,
  AdvisorQuickMenu,
  AdvisorRequirement,
  AdvisorResultCard,
  AdvisorSupportProject,
} from "./advisor.types"

export const QUICK_MENUS: AdvisorQuickMenu[] = [
  { id: "intro", label: "팩토핏 소개", icon: "F" },
  { id: "company", label: "회원가입 안내", icon: "👤" },
  { id: "roi", label: "ROI 분석 문의", icon: "▥" },
  { id: "support", label: "지원사업 추천", icon: "◎" },
  { id: "draft", label: "신청서 초안", icon: "▤" },
  { id: "company", label: "기업정보 입력 도움", icon: "♙" },
  { id: "safety", label: "안전점검 안내", icon: "盾" },
  { id: "home", label: "상담 연결", icon: "☎" },
]

export const ROI_REQUIREMENTS: AdvisorRequirement[] = [
  { icon: "▥", title: "설비명" },
  { icon: "▣", title: "설비 사용연수" },
  { icon: "ϟ", title: "연간 에너지 비용" },
  { icon: "🔧", title: "유지보수 비용" },
  { icon: "△", title: "불량률" },
  { icon: "◎", title: "예상 투자비" },
]

export const ROI_RESULTS: AdvisorResultCard[] = [
  { icon: "◔", title: "예상 ROI", description: "투자 대비 수익률" },
  { icon: "◷", title: "회수기간", description: "투자금 회수 기간" },
  { icon: "▥", title: "지원사업 연계", description: "연계 가능 사업 안내" },
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
