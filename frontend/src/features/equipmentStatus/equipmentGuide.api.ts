const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

function buildApiUrl(path: string) {
  const normalizedBase = API_BASE_URL.replace(/\/+$/, "").replace(/\/api$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export type EquipmentGuideSearchResponse = {
  found: boolean
  label?: string | null
  why_needed?: string | null
  tip_display?: string | null
  input_method?: string | null
  examples?: string | null
  message?: string | null
}

export async function searchEquipmentGuide(query: string): Promise<EquipmentGuideSearchResponse> {
  const response = await fetch(buildApiUrl("/api/equipment-guide/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query }),
  })

  const text = await response.text()
  let payload: EquipmentGuideSearchResponse | null = null

  try {
    payload = JSON.parse(text) as EquipmentGuideSearchResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      typeof payload?.message === "string"
        ? payload.message
        : text.slice(0, 120) || "설비 가이드를 불러오지 못했습니다."
    throw new Error(detail)
  }

  return (
    payload ?? {
      found: false,
      message: "설비 가이드 응답 형식이 올바르지 않습니다.",
    }
  )
}

export function formatEquipmentGuideReply(data: EquipmentGuideSearchResponse) {
  if (!data.found) {
    return data.message || "설비관리에서 제공하지 않는 정보입니다."
  }

  const lines = [
    `【${data.label || "설비 항목"}】`,
    "",
    data.why_needed || "",
    data.tip_display || "",
    data.input_method ? `\n입력 방법: ${data.input_method}` : "",
    data.examples ? `\n예시: ${data.examples}` : "",
  ]

  return lines.filter(Boolean).join("\n")
}
