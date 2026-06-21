import type { CSSProperties } from "react"

import type { RoiFormState } from "./roi.contract"

export const INDUSTRY_CODE_TO_NAME: Record<string, string> = {
  C24: "1차 금속 제조업",
  C25: "금속가공제품 제조업",
  C26: "전자부품 · 컴퓨터 · 영상 · 음향 및 통신장비 제조업",
  C27: "전기장비 제조업",
  C28: "기타 기계 및 장비 제조업",
  C29: "자동차 및 트레일러 제조업",
  C30: "기타 운송장비 제조업",
}

export const MY_PAGE_STORAGE_KEY = "factofit_mypage_profile"

export const EQUIPMENT_TYPE_OPTIONS = [
  {
    value: "press / 프레스",
    key: "press",
    labelKo: "프레스",
    defaultName: "1600톤 프레스 #1",
    keywords: ["press", "프레스"],
  },
  {
    value: "cnc / CNC",
    key: "cnc",
    labelKo: "CNC",
    defaultName: "CNC 가공기 #1",
    keywords: ["cnc"],
  },
  {
    value: "injection / 사출",
    key: "injection",
    labelKo: "사출",
    defaultName: "사출성형기 #1",
    keywords: ["injection", "사출"],
  },
] as const

export const initialForm: RoiFormState = {
  equipmentType: "press / 프레스",
  industryCode: "",
  industryName: "",
  region: "",
  equipmentName: "",
  equipmentAge: "",
  annualEnergyCostManwon: "",
  annualRevenueManwon: "",
  employees: "",
  process: "",
  currentCapacityValue: "",
  defectRate: "",
  productionQty: "",
  contributionMarginWon: "",
  scenarioAInvestmentManwon: "",
  scenarioBInvestmentManwon: "",
  annualMaintenanceCostManwon: "",
}

export const colors = {
  navy: "#061B34",
  blue: "#344BA0",
  blue2: "#5860D3",
  green: "#5A8D5E",
  greenSoft: "#EEF5ED",
  text: "#061B34",
  muted: "#667085",
  line: "#D8DEEA",
  lineSoft: "#E4EAF3",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  soft: "#F7F9FC",
  grayButton: "#AAB2C4",
  gold: "#B08B4B",
}

export const inputStyle: CSSProperties = {
  width: "100%",
  height: "68px",
  borderRadius: "22px",
  border: `1px solid ${colors.line}`,
  background: "#FFFFFF",
  color: colors.text,
  fontSize: "18px",
  lineHeight: 1,
  fontWeight: 900,
  padding: "0 20px",
  outline: "none",
  boxSizing: "border-box",
}

export const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "auto",
}


export const secondaryButtonStyle: CSSProperties = {
  height: "58px",
  padding: "0 34px",
  borderRadius: "18px",
  border: "0",
  background: colors.grayButton,
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
}
