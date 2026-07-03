import type { IndustryOption } from "./signup.types"

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { name: "스마트공장", codes: ["C"] },
  { name: "스마트제조", codes: ["C"] },

  { name: "식품", codes: ["C10"] },
  { name: "섬유", codes: ["C13"] },
  { name: "화학", codes: ["C20"] },
  { name: "바이오", codes: ["C21"] },
  { name: "의약", codes: ["C21"] },
  { name: "고무", codes: ["C22"] },
  { name: "플라스틱", codes: ["C22"] },

  { name: "금속", codes: ["C24", "C25"] },
  { name: "금속가공", codes: ["C25"] },

  { name: "전자", codes: ["C26"] },
  { name: "반도체", codes: ["C26"] },
  { name: "의료기기", codes: ["C27"] },

  { name: "전기", codes: ["C28"] },
  { name: "기계", codes: ["C29"] },
  { name: "장비", codes: ["C29"] },
  { name: "로봇", codes: ["C29"] },

  { name: "자동차", codes: ["C30"] },
  { name: "부품", codes: ["C30"] },

  { name: "소부장", codes: ["C20", "C24", "C25", "C26", "C28", "C29"] },
  { name: "뿌리", codes: ["C24", "C25", "C28", "C29"] },
]

export const COMPANY_TYPE_PLACEHOLDER = "선택 필요"

export const COMPANY_TYPE_OPTIONS = [
  COMPANY_TYPE_PLACEHOLDER,
  "소상공인",
  "소기업",
  "중소기업",
  "중견기업",
  "대기업",
  "확인 필요",
]

export const PURPOSE_OPTIONS = [
  "지원사업 추천",
  "ROI 분석",
  "설비 교체 검토",
  "신청서 초안 작성",
  "안전점검 관리",
]