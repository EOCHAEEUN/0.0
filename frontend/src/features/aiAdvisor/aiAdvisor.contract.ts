export type AdvisorQuickActionId =
  | "roi"
  | "support"
  | "safety"
  | "draft"

export type AdvisorMessageRole = "assistant" | "user"

export type AdvisorMessage = {
  id: string
  role: AdvisorMessageRole
  text: string
}

export type AdvisorQuickAction = {
  id: AdvisorQuickActionId
  label: string
  description: string
}

export type AdvisorStageCard = {
  id: string
  step: string
  title: string
  description: string
}

export type AdvisorApiResponse = {
  text: string
  intent: string
  cards: unknown[]
  matchedPolicies: unknown[]
  selectedEquipmentForPolicy: unknown | null
  nextQuestions: unknown[]
  chatId: string | null
  raw: unknown
}
