import { ChevronDown } from "lucide-react"
import { useMemo, useState } from "react"
import {
  COMPANY_DOCUMENT_CATALOG,
  COMPANY_DOCUMENT_CATEGORIES,
} from "../../documents/companyDocuments.catalog"
import type { CompanyDocumentCatalogItem } from "../../documents/companyDocuments.contract"
import {
  buildCatalogStatuses,
  getCategoryRegistrationCounts,
  getUncategorizedDocuments,
  openCompanyDocumentPreview,
} from "../../documents/companyDocuments.utils"
import { useCompanyDocuments } from "../../documents/hooks/useCompanyDocuments"
import CompanyDocumentCard from "./CompanyDocumentCard"
import CompanyDocumentUploadModal from "./CompanyDocumentUploadModal"

function buildInitialOpenState() {
  return Object.fromEntries(
    COMPANY_DOCUMENT_CATEGORIES.map((category, index) => [
      category.documentCategory,
      index === 0,
    ]),
  ) as Record<string, boolean>
}

export default function CompanyDocumentsManagement() {
  const {
    companyId,
    documents,
    latestByType,
    summary,
    loading,
    uploading,
    error,
    uploadDocument,
  } = useCompanyDocuments()

  const [openCategories, setOpenCategories] = useState(buildInitialOpenState)
  const [uncategorizedOpen, setUncategorizedOpen] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<{
    item: CompanyDocumentCatalogItem
    replace: boolean
  } | null>(null)

  const uncategorizedDocuments = useMemo(
    () => getUncategorizedDocuments(COMPANY_DOCUMENT_CATALOG, documents),
    [documents],
  )

  const toggleCategory = (categoryKey: string) => {
    setOpenCategories((current) => ({
      ...current,
      [categoryKey]: !current[categoryKey],
    }))
  }

  const expandAll = () => {
    setOpenCategories(
      Object.fromEntries(
        COMPANY_DOCUMENT_CATEGORIES.map((category) => [
          category.documentCategory,
          true,
        ]),
      ),
    )
    if (uncategorizedDocuments.length > 0) setUncategorizedOpen(true)
  }

  const collapseAll = () => {
    setOpenCategories(
      Object.fromEntries(
        COMPANY_DOCUMENT_CATEGORIES.map((category) => [
          category.documentCategory,
          false,
        ]),
      ),
    )
    setUncategorizedOpen(false)
  }

  if (!companyId) {
    return (
      <p className="ff-company-doc-hint">
        기업 정보를 저장한 뒤 기업 공통 증빙을 등록할 수 있습니다.
      </p>
    )
  }

  return (
    <div className="ff-company-doc-panel">
      <div className="ff-company-doc-toolbar">
        <div className="ff-company-doc-summary">
          <span className="ff-company-doc-summary__stat">
            <strong>{summary.registeredCount}</strong>
            <span>등록</span>
          </span>
          <span className="ff-company-doc-summary__divider" aria-hidden="true" />
          <span className="ff-company-doc-summary__stat">
            <strong>{summary.missingCount}</strong>
            <span>미등록</span>
          </span>
          <span className="ff-company-doc-summary__divider" aria-hidden="true" />
          <span className="ff-company-doc-summary__stat muted">
            <strong>{summary.totalRequired}</strong>
            <span>전체</span>
          </span>
        </div>

        <div className="ff-company-doc-toolbar__actions">
          <button type="button" className="ff-company-doc-text-btn" onClick={expandAll}>
            전체 펼치기
          </button>
          <button type="button" className="ff-company-doc-text-btn" onClick={collapseAll}>
            전체 접기
          </button>
        </div>
      </div>

      {error ? <div className="ff-company-doc-error">{error}</div> : null}

      {loading ? (
        <p className="ff-company-doc-hint">기업 증빙 목록을 불러오는 중...</p>
      ) : (
        <div className="ff-company-doc-accordions">
          {COMPANY_DOCUMENT_CATEGORIES.map((category) => {
            const counts = getCategoryRegistrationCounts(
              category.documentCategory,
              COMPANY_DOCUMENT_CATALOG,
              latestByType,
            )
            const isOpen = openCategories[category.documentCategory]
            const categoryStatuses = buildCatalogStatuses(
              COMPANY_DOCUMENT_CATALOG,
              documents,
              category.documentCategory,
            )

            return (
              <section
                key={category.documentCategory}
                className={`ff-company-doc-accordion ${isOpen ? "is-open" : ""}`}
              >
                <button
                  type="button"
                  className="ff-company-doc-accordion__trigger"
                  aria-expanded={isOpen}
                  onClick={() => toggleCategory(category.documentCategory)}
                >
                  <ChevronDown size={18} className="ff-company-doc-accordion__chevron" />
                  <span className="ff-company-doc-accordion__title">
                    {category.documentCategoryLabel}
                  </span>
                  <span className="ff-company-doc-accordion__count">
                    {counts.registered}/{counts.total}
                  </span>
                </button>

                {isOpen ? (
                  <div className="ff-company-doc-accordion__body">
                    {categoryStatuses.map((status) => (
                      <CompanyDocumentCard
                        key={status.catalogItem.documentType}
                        status={status}
                        onUpload={() =>
                          setUploadTarget({ item: status.catalogItem, replace: false })
                        }
                        onReplace={() =>
                          setUploadTarget({ item: status.catalogItem, replace: true })
                        }
                        onPreview={() => {
                          if (!status.latestDocument) return
                          try {
                            openCompanyDocumentPreview(status.latestDocument)
                          } catch (nextError) {
                            window.alert(
                              nextError instanceof Error
                                ? nextError.message
                                : "미리보기를 열 수 없습니다.",
                            )
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}

          {uncategorizedDocuments.length > 0 ? (
            <section
              className={`ff-company-doc-accordion ${uncategorizedOpen ? "is-open" : ""}`}
            >
              <button
                type="button"
                className="ff-company-doc-accordion__trigger"
                aria-expanded={uncategorizedOpen}
                onClick={() => setUncategorizedOpen((current) => !current)}
              >
                <ChevronDown size={18} className="ff-company-doc-accordion__chevron" />
                <span className="ff-company-doc-accordion__title">기타 등록 파일</span>
                <span className="ff-company-doc-accordion__count">
                  {uncategorizedDocuments.length}
                </span>
              </button>

              {uncategorizedOpen ? (
                <div className="ff-company-doc-accordion__body">
                  {uncategorizedDocuments.map((document) => (
                    <article
                      key={document.document_id}
                      className="ff-company-doc-row is-registered"
                    >
                      <div className="ff-company-doc-row__main">
                        <span className="ff-company-doc-row__title static">
                          {document.document_label || document.document_type}
                        </span>
                        <span className="ff-company-doc-row__file">
                          {document.original_filename}
                        </span>
                        <span className="ff-company-doc-row__badge done">완료</span>
                        <div className="ff-company-doc-row__actions">
                          <button
                            type="button"
                            className="ff-company-doc-link"
                            onClick={() => {
                              try {
                                openCompanyDocumentPreview(document)
                              } catch (nextError) {
                                window.alert(
                                  nextError instanceof Error
                                    ? nextError.message
                                    : "미리보기를 열 수 없습니다.",
                                )
                              }
                            }}
                          >
                            미리보기
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <CompanyDocumentUploadModal
        open={Boolean(uploadTarget)}
        catalogItem={uploadTarget?.item || null}
        isReplace={Boolean(uploadTarget?.replace)}
        uploading={uploading}
        onClose={() => setUploadTarget(null)}
        onUpload={async (file) => {
          if (!uploadTarget) return
          await uploadDocument({
            documentType: uploadTarget.item.documentType,
            documentLabel: uploadTarget.item.documentLabel,
            file,
          })
        }}
      />
    </div>
  )
}
