import { useCallback, useEffect, useMemo, useState } from "react"
import { getStoredCompanyId } from "../../dashboard/dashboard.api"
import { getCurrentUserId } from "../../mypage/myPage.parts"
import { fetchCompanyDocuments, uploadCompanyDocument } from "../companyDocuments.api"
import { COMPANY_DOCUMENT_CATALOG } from "../companyDocuments.catalog"
import type { CompanyDocumentRecord } from "../companyDocuments.contract"
import {
  buildLatestDocumentsByType,
  computeCompanyDocumentSummary,
} from "../companyDocuments.utils"

export function useCompanyDocuments() {
  const [documents, setDocuments] = useState<CompanyDocumentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const companyId = getStoredCompanyId()
  const userId = getCurrentUserId()

  const reload = useCallback(async () => {
    if (!companyId) {
      setDocuments([])
      return
    }

    setLoading(true)
    setError("")
    try {
      const rows = await fetchCompanyDocuments({ companyId })
      setDocuments(rows)
    } catch (nextError) {
      setDocuments([])
      setError(
        nextError instanceof Error
          ? nextError.message
          : "기업 증빙 목록을 불러오지 못했습니다.",
      )
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const { latestByType } = useMemo(
    () => buildLatestDocumentsByType(documents),
    [documents],
  )

  const summary = useMemo(
    () => computeCompanyDocumentSummary(COMPANY_DOCUMENT_CATALOG, latestByType),
    [latestByType],
  )

  const uploadDocument = useCallback(
    async (params: {
      documentType: string
      documentLabel: string
      file: File
    }) => {
      if (!companyId) {
        throw new Error("company_id가 없어 업로드할 수 없습니다. 기업 정보를 먼저 저장해 주세요.")
      }
      if (!userId) {
        throw new Error("user_id를 확인할 수 없습니다. 다시 로그인해 주세요.")
      }

      setUploading(true)
      setError("")
      try {
        await uploadCompanyDocument({
          userId,
          companyId,
          documentType: params.documentType,
          documentLabel: params.documentLabel,
          file: params.file,
        })
        await reload()
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "기업 증빙 업로드에 실패했습니다."
        setError(message)
        throw nextError
      } finally {
        setUploading(false)
      }
    },
    [companyId, reload, userId],
  )

  return {
    companyId,
    userId,
    documents,
    latestByType,
    summary,
    loading,
    uploading,
    error,
    reload,
    uploadDocument,
  }
}
