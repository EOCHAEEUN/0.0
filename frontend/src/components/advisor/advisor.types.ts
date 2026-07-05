export type AdvisorScreen =
  | "home"
  | "intro"
  | "dashboard"
  | "roi"
  | "support"
  | "draft"
  | "advisor"
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

export type AdvisorDashboardStat = {
  icon: string
  label: string
  value: string
}

export type AdvisorDashboardDeadline = {
  dday: string
  tone: "red" | "orange" | "blue"
  title: string
}

export type AdvisorRecentAnalysis = {
  no: string
  title: string
  status: string
  tone: "green" | "orange" | "blue"
}

export type GuestChatAction = {
  id: string
  label: string
  icon: string
  screen: AdvisorScreen
}

export type GuestSuggestionChip = {
  id: string
  label: string
  message: string
  action?: string
  requiresEquipment?: boolean
}

export type AdvisorTopPick = {
  badge: string
  title: string
  tags: string[]
  score: number
  max: number
}

export type AdvisorOtherProject = {
  dday: string
  tone: "green" | "blue" | "orange"
  title: string
}

export type AdvisorDraftHighlight = {
  icon: string
  title: string
  desc: string
}

export type AdvisorDraftStatus = {
  icon: string
  title: string
  status: string
  tone: "red" | "yellow" | "blue"
}
