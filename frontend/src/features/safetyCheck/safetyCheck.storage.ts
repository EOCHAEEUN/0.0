import { buildApiUrl, getAccessToken } from "../mypage/myPage.parts"
import { markAuthExpired } from "../../services/auth"
import { validateInspectionPdfFile } from "./safetyCheck.utils"

type EquipmentAttachmentUploadResponse = {
  success?: boolean
  data?: {
    attachment?: {
      original_filename?: string
      signed_url?: string
      download_url?: string
      preview_url?: string
    }
  }
  detail?: string
  message?: string
}

const EQUIPMENT_ATTACHMENTS_BUCKET = "equipment-attachments"

export async function uploadInspectionPdf(params: {
  file: File
  inspectionPurpose: string
  equipmentId: string
}): Promise<{ fileName: string; publicUrl: string; storagePath: string }> {
  validateInspectionPdfFile(params.file)

  const accessToken = getAccessToken()
  if (!accessToken) {
    throw new Error("로그인이 필요합니다. 다시 로그인해주세요.")
  }

  const body = new FormData()
  body.set("attachment_type", "safety_evidence")
  body.set("is_primary_photo", "false")
  body.set("file", params.file)

  const response = await fetch(
    buildApiUrl(`/api/equipment/${encodeURIComponent(params.equipmentId)}/attachments`),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body,
    },
  )

  const text = await response.text()
  let payload: EquipmentAttachmentUploadResponse | null = null
  try {
    payload = JSON.parse(text) as EquipmentAttachmentUploadResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      markAuthExpired("로그인이 만료되었습니다. 다시 로그인해주세요.")
    }
    const debugPath = `safety/<user>/<company>/${params.equipmentId}/<uuid>.pdf`
    const detail =
      payload?.detail?.trim() ||
      payload?.message?.trim() ||
      text.slice(0, 180) ||
      "unknown error"
    console.error("[SafetyCheckUpload] upload failed", {
      bucket: EQUIPMENT_ATTACHMENTS_BUCKET,
      storagePath: debugPath,
      statusCode: response.status,
      errorMessage: detail,
    })
    throw new Error(
      "PDF 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.",
    )
  }

  const attachment = payload?.data?.attachment
  const publicUrl =
    attachment?.download_url?.trim() ||
    attachment?.signed_url?.trim() ||
    attachment?.preview_url?.trim() ||
    ""

  if (!publicUrl) {
    throw new Error("첨부파일 URL 생성에 실패했습니다.")
  }

  const fileName = attachment?.original_filename?.trim() || params.file.name

  return {
    fileName,
    publicUrl,
    storagePath: "",
  }
}
