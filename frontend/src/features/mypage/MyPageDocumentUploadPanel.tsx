import { useMemo, useRef, useState, type DragEvent } from "react"
import {
  DOCUMENT_GROUPS,
  createStoredDocument,
  normalizeDocumentName,
  readStoredDocuments,
  writeStoredDocuments,
  type DocumentGroupLabel,
  type StoredDocument,
} from "../documents/documentStorage"

export function MyPageDocumentUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const defaultGroup = DOCUMENT_GROUPS[0]
  const [selectedGroup, setSelectedGroup] = useState<DocumentGroupLabel>(
    defaultGroup.label,
  )
  const [selectedDocument, setSelectedDocument] = useState<string>(defaultGroup.options[0])
  const [selectedFileName, setSelectedFileName] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [documents, setDocuments] = useState<StoredDocument[]>(() =>
    readStoredDocuments(),
  )

  const selectedGroupInfo = useMemo(
    () => DOCUMENT_GROUPS.find((group) => group.label === selectedGroup) ?? DOCUMENT_GROUPS[0],
    [selectedGroup],
  )

  const savedDocumentNames = useMemo(
    () => new Set(documents.map((item) => normalizeDocumentName(item.documentName))),
    [documents],
  )

  const saveDocuments = (nextDocuments: StoredDocument[]) => {
    setDocuments(nextDocuments)
    writeStoredDocuments(nextDocuments)
  }

  const handleGroupSelect = (groupLabel: DocumentGroupLabel) => {
    const nextGroup = DOCUMENT_GROUPS.find((group) => group.label === groupLabel)
    if (!nextGroup) return

    setSelectedGroup(groupLabel)
    setSelectedDocument(nextGroup.options[0])
  }

  const handleFileSelect = (fileName: string) => {
    setSelectedFileName(fileName)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)

    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileSelect(droppedFile.name)
    }
  }

  const handleAddDocument = () => {
    const fileName = selectedFileName || `${selectedDocument}.pdf`
    const normalizedSelected = normalizeDocumentName(selectedDocument)
    const nextDocument = createStoredDocument(selectedDocument, fileName)
    const filteredDocuments = documents.filter(
      (item) => normalizeDocumentName(item.documentName) !== normalizedSelected,
    )

    saveDocuments([...filteredDocuments, nextDocument])
    setSelectedFileName("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleRemoveDocument = (id: string) => {
    saveDocuments(documents.filter((item) => item.id !== id))
  }

  return (
    <div className="ff-document-upload-panel">
      <style>{`
        .ff-document-upload-panel {
          display: grid;
          gap: 22px;
        }

        .ff-doc-upload-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 26px;
          align-items: start;
        }

        .ff-doc-upload-field {
          display: grid;
          gap: 12px;
        }

        .ff-doc-upload-field label,
        .ff-doc-sub-label {
          color: #061B34;
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .ff-doc-group-chips {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ff-doc-group-chip {
          min-height: 42px;
          border-radius: 999px;
          border: 1px solid #DCE3F0;
          background: #FFFFFF;
          color: #475569;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -0.03em;
          cursor: pointer;
          transition: .18s ease;
        }

        .ff-doc-group-chip.is-active {
          border-color: rgba(52,75,160,.28);
          background: #F1F5FF;
          color: #244BC3;
          box-shadow: 0 8px 18px rgba(36,75,195,.08);
        }

        .ff-doc-select,
        .ff-doc-file-button {
          width: 100%;
          min-height: 56px;
          border-radius: 16px;
          border: 1px solid #CBD5E1;
          background: #fff;
          color: #061B34;
          padding: 0 18px;
          font-size: 15px;
          font-weight: 850;
          outline: none;
          box-shadow: 0 8px 20px rgba(15,23,42,.04);
        }

        .ff-doc-file-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          cursor: pointer;
          text-align: left;
        }

        .ff-doc-file-name {
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .ff-doc-drop-zone {
          min-height: 112px;
          border-radius: 20px;
          border: 1.5px dashed #CBD5E1;
          background: #F8FAFC;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 20px;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -0.03em;
          cursor: pointer;
          transition: .18s ease;
          text-align: center;
        }

        .ff-doc-drop-zone.is-over {
          border-color: #344BA0;
          background: #F1F5FF;
          color: #344BA0;
        }

        .ff-doc-upload-actions {
          display: flex;
          justify-content: flex-end;
        }

        .ff-doc-add-button {
          min-width: 166px;
          height: 54px;
          border: 0;
          border-radius: 14px;
          background: linear-gradient(180deg, #2D50BE 0%, #173895 100%);
          color: #fff;
          font-size: 16px;
          font-weight: 950;
          box-shadow: 0 14px 28px rgba(31, 69, 182, .22);
          cursor: pointer;
        }

        .ff-doc-saved-card {
          border-top: 1px solid #EEF2F7;
          padding-top: 20px;
          display: grid;
          gap: 12px;
        }

        .ff-doc-saved-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .ff-doc-saved-title h3 {
          margin: 0;
          color: #061B34;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .ff-doc-saved-title span {
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 999px;
          background: #ECFDF3;
          color: #0B7A53;
          font-size: 13px;
          font-weight: 900;
        }

        .ff-doc-saved-list {
          display: grid;
          gap: 10px;
        }

        .ff-doc-saved-item {
          min-height: 58px;
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          background: #FBFCFF;
          padding: 12px 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
        }

        .ff-doc-saved-item strong {
          display: block;
          color: #244BC3;
          font-size: 15px;
          font-weight: 950;
        }

        .ff-doc-saved-item span {
          display: block;
          margin-top: 4px;
          color: #64748B;
          font-size: 13px;
          font-weight: 800;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .ff-doc-remove-button {
          border: 0;
          background: transparent;
          color: #94A3B8;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
        }

        .ff-doc-option-hint {
          color: #64748B;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.55;
        }

        @media (max-width: 860px) {
          .ff-doc-upload-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="ff-doc-upload-grid">
        <div className="ff-doc-upload-field">
          <label>증빙 서류 구분</label>
          <div className="ff-doc-group-chips" role="tablist" aria-label="증빙 서류 구분">
            {DOCUMENT_GROUPS.map((group) => (
              <button
                key={group.label}
                type="button"
                role="tab"
                aria-selected={selectedGroup === group.label}
                className={`ff-doc-group-chip${selectedGroup === group.label ? " is-active" : ""}`}
                onClick={() => handleGroupSelect(group.label)}
              >
                {group.label}
              </button>
            ))}
          </div>

          <span className="ff-doc-sub-label">서류명 선택</span>
          <select
            id="mypage-document-name"
            className="ff-doc-select"
            value={selectedDocument}
            onChange={(event) => setSelectedDocument(event.target.value)}
          >
            {selectedGroupInfo.options.map((documentName) => (
              <option key={documentName} value={documentName}>
                {documentName}
                {savedDocumentNames.has(normalizeDocumentName(documentName))
                  ? " · 저장됨"
                  : ""}
              </option>
            ))}
          </select>
          <p className="ff-doc-option-hint">
            마이페이지에 등록한 서류는 신청서 생성 화면의 제출 전 확인 목록에서 자동으로 비교됩니다.
          </p>
        </div>

        <div className="ff-doc-upload-field">
          <label htmlFor="mypage-document-file">파일 선택</label>
          <button
            type="button"
            className="ff-doc-file-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="ff-doc-file-name">
              {selectedFileName || "선택된 파일이 없습니다"}
            </span>
            <span aria-hidden="true">⌄</span>
          </button>
          <input
            ref={fileInputRef}
            id="mypage-document-file"
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFileSelect(file.name)
            }}
          />
          <div
            className={`ff-doc-drop-zone${dragOver ? " is-over" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragOver(false)
            }}
            onDrop={handleDrop}
          >
            <span aria-hidden="true">📎</span>
            <span>내 PC에서 문서를 불러올 수 있습니다.</span>
          </div>
        </div>
      </div>

      <div className="ff-doc-saved-card">
        <div className="ff-doc-saved-title">
          <h3>등록된 첨부파일</h3>
          <span>저장 문서 {documents.length}개</span>
        </div>

        <div className="ff-doc-saved-list">
          {documents.map((document) => (
            <div className="ff-doc-saved-item" key={document.id}>
              <div>
                <strong>{document.documentName}</strong>
                <span>{document.fileName}</span>
              </div>
              <button
                type="button"
                className="ff-doc-remove-button"
                onClick={() => handleRemoveDocument(document.id)}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="ff-doc-upload-actions">
        <button type="button" className="ff-doc-add-button" onClick={handleAddDocument}>
          추가하기
        </button>
      </div>
    </div>
  )
}
