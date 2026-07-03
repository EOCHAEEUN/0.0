/**
 * Mock adapter is opt-in only. Set VITE_EQUIPMENT_EVIDENCE_USE_MOCK=true in .env.local
 * during UI development. Production builds never auto-fallback to mock data.
 */
export const EQUIPMENT_EVIDENCE_USE_MOCK =
  import.meta.env.VITE_EQUIPMENT_EVIDENCE_USE_MOCK === "true"
