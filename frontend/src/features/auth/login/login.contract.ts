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
