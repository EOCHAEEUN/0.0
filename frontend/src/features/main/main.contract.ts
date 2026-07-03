export type MainDialogType =
  | "why"
  | "services"
  | "dashboard"
  | "support"
  | "newsletter"
  | null

export type MainMetricItem = {
  value: string
  label: string
}

export type MainBusinessCard = {
  mediaClassName: string
  label: string
  titleLines: [string, string]
  description: string
}

export type MainDashboardSummaryCard = {
  value: string
  title: string
  description: string
}

export type MainDashboardCompareCard = {
  label: string
  title: string | string[]
  items: string[]
}

export type MainSustainabilityValue = {
  title: string
  subtitle: string
  description: string
}

export type MainInsightChip = string

export type MainFooterLink = string

export type MainFooterInfo = string
