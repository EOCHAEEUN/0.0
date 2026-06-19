import type {
  MainBusinessCard,
  MainDashboardCompareCard,
  MainDashboardSummaryCard,
  MainFooterInfo,
  MainFooterLink,
  MainInsightChip,
  MainMetricItem,
  MainSustainabilityValue,
} from "./main.contract"

export const heroMetrics: MainMetricItem[] = [
  {
    value: "1분",
    label: "진단 입력 시간",
  },
  {
    value: "7건",
    label: "매칭 지원사업",
  },
  {
    value: "2.0억",
    label: "예상 확보 가능 금액",
  },
  {
    value: "47.5%",
    label: "예상 ROI",
  },
]

export const businessCards: MainBusinessCard[] = [
  {
    mediaClassName: "ff-business-media-1",
    label: "ROI 분석",
    titleLines: ["교체할지 말지, 먼저", "계산합니다"],
    description: "설비 노후도와 비용을 읽어 투자 판단을 돕습니다.",
  },
  {
    mediaClassName: "ff-business-media-2",
    label: "지원사업 매칭",
    titleLines: ["내 공장에 맞는 지원금을", "찾습니다"],
    description: "업종·지역·설비 기준으로 공고를 정리합니다.",
  },
  {
    mediaClassName: "ff-business-media-3",
    label: "신청 · 안전관리",
    titleLines: ["신청서와 점검까지", "연결합니다"],
    description: "초안 생성과 D-day 알림으로 실행을 앞당깁니다.",
  },
]

export const dashboardSummaryCards: MainDashboardSummaryCard[] = [
  {
    value: "15년",
    title: "설비 분석",
    description: "설비 연식과 업종 평균 교체주기를 비교합니다.",
  },
  {
    value: "47.5%",
    title: "ROI 결과",
    description: "투자 시나리오별 예상 수익성과 회수기간을 보여줍니다.",
  },
  {
    value: "2.0억",
    title: "지원금 추천",
    description: "적합도와 마감일 기준으로 지원사업을 정리합니다.",
  },
  {
    value: "D-30",
    title: "안전점검",
    description: "점검 일정과 인증 리스크를 미리 안내합니다.",
  },
]

export const dashboardPreviewCard: MainDashboardCompareCard = {
  label: "로그인 전 Preview",
  title: "핵심 결과만 먼저 확인",
  items: [
    "설비 분석 요약",
    "ROI 대표 수치",
    "지원사업 샘플 추천",
    "저장 없이 빠른 체험",
  ],
}

export const dashboardAfterLoginCard: MainDashboardCompareCard = {
  label: "로그인 후 Dashboard",
  title: ["전체 분석을", "저장하고 관리"],
  items: [
    "기업별 분석 결과 저장",
    "지원사업 캘린더 연결",
    "신청서 초안 생성",
    "안전점검 알림 연결",
  ],
}

export const sustainabilityValues: MainSustainabilityValue[] = [
  {
    title: "Energy",
    subtitle: "에너지 효율",
    description: "노후 설비 교체와 고효율 설비 전환으로 전력비 절감을 돕습니다.",
  },
  {
    title: "Productivity",
    subtitle: "생산성 향상",
    description: "불량률과 고장 리스크를 줄여 생산 흐름을 안정화합니다.",
  },
  {
    title: "Finance",
    subtitle: "재무건전성",
    description: "ROI 기반 투자 판단으로 현금흐름 리스크를 줄입니다.",
  },
  {
    title: "Safety",
    subtitle: "안전관리",
    description: "법정 점검과 인증 리스크를 미리 관리해 운영 중단 위험을 예방합니다.",
  },
]

export const insightChips: MainInsightChip[] = [
  "최신 제조업 정책",
  "지원사업 소식",
  "설비 투자 트렌드",
  "안전관리 가이드",
]

export const publicDataChips = [
  "산업통상자원부",
  "공공데이터포털",
  "한국에너지공단",
  "한국산업단지공단",
  "KOTRA",
  "KTL",
]

export const footerLinks: MainFooterLink[] = [
  "개인정보처리방침",
  "이용약관",
  "이메일무단수집거부",
  "고객센터",
  "문의하기",
]

export const footerInfos: MainFooterInfo[] = [
  "상호명: FactoFit Labs",
  "대표: FactoFit Team",
  "사업자등록번호: 000-00-00000",
  "주소: 서울특별시 제조AI로 100",
  "이메일: contact@factofit.ai",
  "고객지원: 평일 10:00 - 18:00",
]
