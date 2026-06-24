export type IndustryOption = {
  name: string
  codes: string[]
}

export type IndustryInputRow = {
  id: string
  industryName: string
  industryCode: string
  selectedIndustry: IndustryOption | null
}

export type SignupModalProps = {
  onClose: () => void
  onLoginClick?: () => void
}

export type PasswordLevel = "empty" | "weak" | "normal" | "strong"

export type PasswordCheck = {
  label: string
  valid: boolean
}

export type NormalizedIndustry = {
  industry_name: string
  industry_code: string[]
}

export type UseSignupFormParams = {
  onClose: () => void
}