import { useCallback, useEffect, useMemo, useState } from "react"
import type { EquipmentAttachmentItem } from "../equipmentAttachments.contract"
import {
  deleteEquipmentAttachment,
  fetchEquipmentAttachments,
  setEquipmentAttachmentPrimary,
  uploadEquipmentAttachment,
} from "../equipmentAttachments.api"
import type { EquipmentAttachmentType } from "../equipmentAttachments.contract"

type UseEquipmentAttachmentsOptions = {
  equipmentId?: string
  enabled?: boolean
}

export function useEquipmentAttachments({
  equipmentId,
  enabled = true,
}: UseEquipmentAttachmentsOptions) {
  const [attachments, setAttachments] = useState<EquipmentAttachmentItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  )
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    if (!equipmentId || !enabled) {
      setAttachments([])
      setTotalCount(0)
      return
    }

    setLoading(true)
    setError("")
    try {
      const data = await fetchEquipmentAttachments(equipmentId)
      setAttachments(data.attachments)
      setTotalCount(data.total_count)
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "첨부파일을 불러오지 못했습니다.",
      )
      setAttachments([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [enabled, equipmentId])

  useEffect(() => {
    void reload()
  }, [reload])

  const primaryPhoto = useMemo(
    () => attachments.find((item) => item.is_primary_photo && item.preview_url),
    [attachments],
  )

  const upload = useCallback(
    async (params: {
      file: File
      attachmentType: EquipmentAttachmentType
      isPrimaryPhoto?: boolean
    }) => {
      if (!equipmentId) return
      setUploading(true)
      setUploadProgress(null)
      setError("")
      try {
        await uploadEquipmentAttachment({
          equipmentId,
          file: params.file,
          attachmentType: params.attachmentType,
          isPrimaryPhoto: params.isPrimaryPhoto,
        })
        await reload()
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "첨부파일 업로드에 실패했습니다."
        setError(message)
        throw nextError
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [equipmentId, reload],
  )

  const uploadMany = useCallback(
    async (params: {
      files: File[]
      attachmentType: EquipmentAttachmentType
      isPrimaryPhoto?: boolean
    }) => {
      if (!equipmentId || params.files.length === 0) return

      setUploading(true)
      setError("")
      setUploadProgress({ current: 0, total: params.files.length })

      let failedFile: string | null = null
      let failedMessage = ""

      try {
        for (let index = 0; index < params.files.length; index += 1) {
          const file = params.files[index]
          setUploadProgress({ current: index + 1, total: params.files.length })
          try {
            await uploadEquipmentAttachment({
              equipmentId,
              file,
              attachmentType: params.attachmentType,
              isPrimaryPhoto:
                Boolean(params.isPrimaryPhoto) &&
                params.attachmentType === "equipment_photo" &&
                index === 0,
            })
          } catch (nextError) {
            failedFile = file.name
            failedMessage =
              nextError instanceof Error
                ? nextError.message
                : "첨부파일 업로드에 실패했습니다."
            break
          }
        }

        await reload()

        if (failedFile) {
          const message = `'${failedFile}' 업로드에 실패했습니다. ${failedMessage}`
          setError(message)
          throw new Error(message)
        }
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [equipmentId, reload],
  )

  const remove = useCallback(
    async (attachmentId: string) => {
      if (!equipmentId) return
      setError("")
      try {
        await deleteEquipmentAttachment({ equipmentId, attachmentId })
        await reload()
      } catch (nextError) {
        const message =
          nextError instanceof Error ? nextError.message : "첨부파일 삭제에 실패했습니다."
        setError(message)
        throw nextError
      }
    },
    [equipmentId, reload],
  )

  const setPrimary = useCallback(
    async (attachmentId: string) => {
      if (!equipmentId) return
      setError("")
      try {
        await setEquipmentAttachmentPrimary({ equipmentId, attachmentId })
        await reload()
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "대표 사진 지정에 실패했습니다."
        setError(message)
        throw nextError
      }
    },
    [equipmentId, reload],
  )

  return {
    attachments,
    totalCount,
    loading,
    uploading,
    uploadProgress,
    error,
    primaryPhoto,
    reload,
    upload,
    uploadMany,
    remove,
    setPrimary,
  }
}
