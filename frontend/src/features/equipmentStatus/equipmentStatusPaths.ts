export const EQUIPMENT_STATUS_PATH = "/equipment"

export function buildEquipmentRegisterPath(options?: { source?: string }) {
  const params = new URLSearchParams({ register: "1" })
  if (options?.source) {
    params.set("source", options.source)
  }
  return `${EQUIPMENT_STATUS_PATH}?${params.toString()}`
}

export function isEquipmentRegisterIntent(searchParams: URLSearchParams) {
  const value = searchParams.get("register")
  return value === "1" || value === "true"
}
