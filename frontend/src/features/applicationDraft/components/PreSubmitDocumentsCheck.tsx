import { useMemo, useState } from "react"
import {
  normalizeDocumentName,
  readStoredDocuments,
  type StoredDocument,
} from "../../documents/documentStorage"

type DocumentCheckItem = {
  documentName: string
  matchedDocument: StoredDocument | null
}

function CheckIcon({ matched }: { matched: boolean }) {
  return (
    <span
      className={`ff-pre-doc-status-icon ${matched ? "ok" : "missing"}`}
      aria-label={matched ? "확인 완료" : "미보유"}
    >
      {matched ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      )}
    </span>
  )
}

export function PreSubmitDocumentsCheck({
  requiredDocuments,
}: {
  requiredDocuments: string[]
}) {
  const [open, setOpen] = useState(true)
  const [storedDocuments] = useState(() => readStoredDocuments())

  const checkItems = useMemo<DocumentCheckItem[]>(() => {
    return requiredDocuments.map((documentName) => {
      const normalizedRequiredName = normalizeDocumentName(documentName)
      const matchedDocument =
        storedDocuments.find(
          (document) =>
            normalizeDocumentName(document.documentName) === normalizedRequiredName,
        ) ?? null

      return {
        documentName,
        matchedDocument,
      }
    })
  }, [requiredDocuments, storedDocuments])

  const completedCount = checkItems.filter((item) => item.matchedDocument).length
  const missingCount = Math.max(checkItems.length - completedCount, 0)
  const savedDocumentNames = storedDocuments
    .map((document) => document.documentName)
    .join(", ")

  return (
    <section className={`ff-pre-submit-documents${open ? "" : " is-closed"}`}>
      <div className="ff-pre-doc-head">
        <div>
          <span className="ff-mini-label">제출 전 확인할 서류</span>
          <h3>저장된 PDF파일을 체크리스트와 함께 꺼내서 씁니다.</h3>
          <p>
            지원처별 필요 서류를 마이페이지 저장 문서와 비교해 확인합니다. 확인 완료 항목은 제출 준비 문서로 바로 활용할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className="ff-pre-doc-toggle"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "닫기" : "열기"}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="ff-pre-doc-card" aria-label="제출 필요 서류 확인 목록">
          <div className="ff-pre-doc-summary">
            <div>
              <strong>
                요구 서류 {checkItems.length}개 중 {completedCount}개 확인 완료
              </strong>
              <span>
                마이페이지에 저장된 문서는 {savedDocumentNames || "아직 없습니다"}입니다.
              </span>
            </div>
            <div className="ff-pre-doc-pills">
              <span className="ok">확인 완료 {completedCount}</span>
              <span className="missing">미보유 {missingCount}</span>
            </div>
          </div>

          <div className="ff-pre-doc-list">
            {checkItems.map((item) => {
              const matched = Boolean(item.matchedDocument)

              return (
                <article
                  className={`ff-pre-doc-row ${matched ? "ok" : "missing"}`}
                  key={item.documentName}
                >
                  <CheckIcon matched={matched} />
                  <div>
                    <h4>{item.documentName}</h4>
                    <p>
                      {item.matchedDocument
                        ? `${item.matchedDocument.fileName} 저장됨`
                        : "마이페이지에 저장된 파일 없음"}
                    </p>
                  </div>
                  <span className={`ff-pre-doc-badge ${matched ? "ok" : "missing"}`}>
                    {matched ? "확인 완료" : "미보유"}
                  </span>
                </article>
              )
            })}
          </div>

          <div className="ff-pre-doc-notice">
            <span aria-hidden="true">※</span>
            <p>
              <strong>확인 완료</strong>는 마이페이지에 저장된 서류명과 지원처 요구 서류명이 일치한 상태입니다. <strong>미보유</strong> 서류는 마이페이지의 첨부파일 영역에서 추가 등록해야 합니다.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
