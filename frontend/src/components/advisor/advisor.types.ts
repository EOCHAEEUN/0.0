export type AdvisorScreen =
  | "home"
  | "intro"
  | "roi"
  | "support"
  | "draft"
  | "company"
  | "safety"

export type AdvisorQuickMenu = {
  id: AdvisorScreen
  label: string
  icon: string
}

export type AdvisorRequirement = {
  icon: string
  title: string
  description?: string
}

export type AdvisorResultCard = {
  icon: string
  title: string
  description: string
}

export type AdvisorSupportProject = {
  rank: number
  title: string
  subsidy: string
  effect: string
  fit: string
  tags: string[]
}

export type AdvisorDraftProgress = {
  no: string
  title: string
  description: string
  status: "done" | "writing" | "wait"
}
