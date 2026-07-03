import { ChevronDown, Eye, Upload } from "lucide-react"
import { useState } from "react"
import type { CompanyDocumentTypeStatus } from "../../documents/companyDocuments.utils"
import {
  formatCompanyDocumentDate,
  formatCompanyDocumentFileSize,
  getMimeTypeLabel,
} from "../../documents/companyDocuments.utils"

type CompanyDocumentCardProps = {
  status: CompanyDocumentTypeStatus
  onUpload: () => void
  onReplace: () => void
  onPreview: () => void
}

export default function CompanyDocumentCard({
  status,
  onUpload,
  onReplace,
  onPreview,
}: CompanyDocumentCardProps) {
  const { catalogItem, latestDocument, isRegistered } = status
  const [expanded, setExpanded] = useState(false)
  const canExpand = isRegistered && Boolean(latestDocument)

  return (
    <article
      className={`ff-company-doc-row ${isRegistered ? "is-registered" : "is-empty"} ${
        expanded ? "is-expanded" : ""
      }`}
    >
      <div className="ff-company-doc-row__main">
        <button
          type="button"
          className="ff-company-doc-row__toggle"
          aria-expanded={canExpand ? expanded : undefined}
          disabled={!canExpand}
          onClick={() => {
            if (canExpand) setExpanded((current) => !current)
          }}
        >
          <ChevronDown
            size={16}
            className={`ff-company-doc-row__chevron ${canExpand ? "" : "is-hidden"}`}
            aria-hidden="true"
          />
          <span className="ff-company-doc-row__title">{catalogItem.documentLabel}</span>
        </button>

        {isRegistered && latestDocument ? (
          <span className="ff-company-doc-row__file">
            {latestDocument.original_filename}
          </span>
        ) : (
          <span className="ff-company-doc-row__placeholder">미등록</span>
        )}

        <span
          className={`ff-company-doc-row__badge ${isRegistered ? "done" : "missing"}`}
        >
          {isRegistered ? "완료" : "필요"}
        </span>

        <div className="ff-company-doc-row__actions">
          {isRegistered ? (
            <>
              <button
                type="button"
                className="ff-company-doc-link"
                onClick={onPreview}
              >
                <Eye size={14} />
                미리보기
              </button>
              <button
                type="button"
                className="ff-company-doc-link"
                onClick={onReplace}
              >
                <Upload size={14} />
                교체
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ff-company-doc-link primary"
              onClick={onUpload}
            >
              <Upload size={14} />
              업로드
            </button>
          )}
        </div>
      </div>

      {expanded && isRegistered && latestDocument ? (
        <div className="ff-company-doc-row__detail">
          <span>
            {formatCompanyDocumentDate(latestDocument.created_at)} ·{" "}
            {getMimeTypeLabel(latestDocument.mime_type)} ·{" "}
            {formatCompanyDocumentFileSize(latestDocument.file_size)}
          </span>
          {latestDocument.parse_status ? (
            <span>상태: {latestDocument.parse_status}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
