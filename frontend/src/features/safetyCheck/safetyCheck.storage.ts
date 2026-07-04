import { getAccessToken } from "../mypage/myPage.parts"
import { buildInspectionStoragePath, validateInspectionPdfFile } from "./safetyCheck.utils"

const STORAGE_BUCKET = "inspection-files"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "") ?? ""
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ""

export async function uploadInspectionPdf(params: {
  file: File
  inspectionPurpose: string
}): Promise<{ fileName: string; publicUrl: string; storagePath: string }> {
  validateInspectionPdfFile(params.file)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase Storage 설정이 필요합니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인해주세요.",
    )
  }

  const accessToken = getAccessToken()
  if (!accessToken) {
    throw new Error("로그인이 필요합니다. 다시 로그인해주세요.")
  }

  const { storagePath, fileName } = buildInspectionStoragePath(
    params.inspectionPurpose,
    params.file.name,
  )

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/pdf",
        "x-upsert": "false",
      },
      body: params.file,
    },
  )

  if (!response.ok) {
    let detail = "파일 업로드에 실패했습니다."
    try {
      const payload = (await response.json()) as { message?: string; error?: string }
      detail = payload.message || payload.error || detail
    } catch {
      const text = await response.text()
      if (text.trim()) detail = text.slice(0, 180)
    }
    throw new Error(detail)
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`

  return {
    fileName,
    publicUrl,
    storagePath,
  }
}
