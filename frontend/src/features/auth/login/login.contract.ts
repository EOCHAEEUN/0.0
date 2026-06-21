export type LoginModalType = "preview" | "signup" | "sso" | null

export type LoginCredentials = {
  email: string
  password: string
}

export type LoginFeatureCard = {
  icon: string
  line1: string
  line2: string
}

export type LoginPreviewMetric = {
  label: string
  value: string
  color: string
}

export type LoginPreviewData = {
  availablePolicyCount: string
  expectedSupportAmount: string
  expectedRoi: string
  recommendedPolicies: string[]
  policyNews: string[]
}
