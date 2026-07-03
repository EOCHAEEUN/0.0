import type { CSSProperties } from "react"

import type { LoginFeatureCard, LoginPreviewData } from "./login.contract"

export const loginFeatureCards: LoginFeatureCard[] = [
  ["◎", "맞춤형", "지원사업 추천"],
  ["↗", "ROI 분석 및", "투자효과 예측"],
  ["▤", "신청 서류 준비", "자동화"],
  ["◇", "마감 알림 &", "일정 관리"],
].map(([icon, line1, line2]) => ({ icon, line1, line2 }))

export const loginPreviewData: LoginPreviewData = {
  availablePolicyCount: "8건",
  expectedSupportAmount: "8,200만원",
  expectedRoi: "98%",
  recommendedPolicies: [
    "스마트공장 고도화",
    "설비투자 정책자금",
    "ESG 개선사업",
  ],
  policyNews: [
    "스마트공장 고도화 지원사업 추가 모집 공고",
    "설비투자 활성화 정책자금 지원 확대",
  ],
}

export const inputStyle: CSSProperties = {
  height: "56px",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  color: "#061B34",
  padding: "0 18px",
  fontSize: "15px",
  fontWeight: 800,
  outline: "none",
}

export const primaryButtonStyle: CSSProperties = {
  height: "58px",
  borderRadius: "14px",
  border: 0,
  background: "#344BA0",
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 18px 38px rgba(52,75,160,.22)",
}

export const modalNextButtonStyle: CSSProperties = {
  width: "100%",
  height: "58px",
  minHeight: "58px",
  borderRadius: "16px",
  border: 0,
  background: "#344BA0",
  color: "#FFFFFF",
  fontSize: "17px",
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  whiteSpace: "nowrap",
  boxShadow: "0 18px 38px rgba(52,75,160,.22)",
}

export const secondaryButtonStyle: CSSProperties = {
  height: "56px",
  borderRadius: "14px",
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#061B34",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
}

export const textButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#344BA0",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
}

export const fieldWrapStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
}

export const fieldLabelStyle: CSSProperties = {
  color: "#475467",
  fontSize: "13px",
  fontWeight: 900,
}
