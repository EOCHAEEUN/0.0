import { Bot, ChevronDown, ChevronUp, Star, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { EquipmentInfo } from "../mypage/myPage.parts"
import EquipmentEvidenceSection from "./components/EquipmentEvidenceSection"
import { getCategoryLabel } from "./equipmentStatus.mapper"

type EquipmentRegisteredListProps = {
  equipmentList: EquipmentInfo[]
  representativeEquipmentId: string
  companyId?: string
  onEdit: (equipment: EquipmentInfo) => void
  onDelete: (equipment: EquipmentInfo) => void
  onSetRepresentative: (equipment: EquipmentInfo) => void
}

function formatRegisteredDate(value?: string) {
  if (!value) return "등록일: -"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "등록일: -"
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `등록일: ${year}.${month}.${day}`
}

function formatDetailValue(value: string | undefined, suffix = "") {
  const trimmed = value?.trim()
  if (!trimmed) return "-"
  return `${trimmed}${suffix}`
}

export default function EquipmentRegisteredList({
  equipmentList,
  representativeEquipmentId,
  companyId,
  onEdit,
  onDelete,
  onSetRepresentative,
}: EquipmentRegisteredListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [primaryPhotoByEquipmentId, setPrimaryPhotoByEquipmentId] = useState<
    Record<string, string>
  >({})

  useEffect(() => {
    if (equipmentList.length === 0) {
      setExpandedId(null)
      return
    }

    setExpandedId((current) => {
      if (current !== null && equipmentList.some((item) => item.id === current)) {
        return current
      }
      return equipmentList[0]?.id ?? null
    })
  }, [equipmentList])

  return (
    <div className="ff-equipment-accordion-list">
      {equipmentList.map((equipment) => {
        const isExpanded = expandedId === equipment.id
        const isRepresentative = equipment.equipmentId === representativeEquipmentId
        const primaryPhotoUrl = equipment.equipmentId
          ? primaryPhotoByEquipmentId[equipment.equipmentId]
          : undefined

        return (
          <article
            key={equipment.id}
            className={`ff-equipment-accordion-item ${isExpanded ? "is-expanded" : ""}`}
          >
            <button
              type="button"
              className="ff-equipment-accordion-trigger"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedId((current) => (current === equipment.id ? null : equipment.id))
              }
            >
              <span className="ff-equipment-accordion-icon" aria-hidden="true">
                {primaryPhotoUrl ? (
                  <img
                    src={primaryPhotoUrl}
                    alt=""
                    className="ff-equipment-accordion-photo"
                  />
                ) : (
                  <Bot size={20} strokeWidth={1.8} />
                )}
              </span>

              <span className="ff-equipment-accordion-summary">
                <strong>{equipment.name || `설비 ${equipment.id}`}</strong>
                <span>{formatRegisteredDate(equipment.createdAt)}</span>
              </span>

              <span className="ff-equipment-accordion-end">
                {isRepresentative ? (
                  <span className="ff-equipment-badge representative">
                    <Star aria-hidden="true" size={13} />
                    대표
                  </span>
                ) : null}
                {isExpanded ? (
                  <ChevronUp aria-hidden="true" size={18} />
                ) : (
                  <ChevronDown aria-hidden="true" size={18} />
                )}
              </span>
            </button>

            {isExpanded ? (
              <div className="ff-equipment-accordion-panel">
                <div className="ff-equipment-accordion-details">
                  <div className="ff-equipment-detail-cell">
                    <span>설비 종류</span>
                    <strong>{getCategoryLabel(equipment.category)}</strong>
                  </div>
                  <div className="ff-equipment-detail-cell">
                    <span>공정</span>
                    <strong>{formatDetailValue(equipment.process)}</strong>
                  </div>
                  <div className="ff-equipment-detail-cell">
                    <span>사용연수</span>
                    <strong>{formatDetailValue(equipment.years, "년")}</strong>
                  </div>
                  <div className="ff-equipment-detail-cell">
                    <span>연간 에너지 비용</span>
                    <strong>{formatDetailValue(equipment.annualEnergyCost, "만원")}</strong>
                  </div>
                  <div className="ff-equipment-detail-cell">
                    <span>불량률</span>
                    <strong>{formatDetailValue(equipment.defectRate, "%")}</strong>
                  </div>
                  <div className="ff-equipment-detail-cell">
                    <span>유지보수 비용</span>
                    <strong>
                      {formatDetailValue(equipment.maintenanceCostAnnual, "만원")}
                    </strong>
                  </div>
                </div>

                <div className="ff-equipment-accordion-actions">
                  {!isRepresentative && equipment.equipmentId ? (
                    <button
                      type="button"
                      className="ff-equipment-secondary-btn"
                      onClick={() => onSetRepresentative(equipment)}
                    >
                      ROI 대표 설비로 설정
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ff-equipment-secondary-btn"
                    onClick={() => onEdit(equipment)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="ff-equipment-danger-btn"
                    onClick={() => onDelete(equipment)}
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    삭제
                  </button>
                </div>

                <EquipmentEvidenceSection
                  equipmentId={equipment.equipmentId}
                  equipmentName={equipment.name}
                  companyId={companyId}
                  enabled={isExpanded}
                  onPrimaryPhotoChange={(previewUrl) => {
                    if (!equipment.equipmentId) return
                    setPrimaryPhotoByEquipmentId((current) => {
                      const next = { ...current }
                      if (previewUrl) {
                        next[equipment.equipmentId!] = previewUrl
                      } else {
                        delete next[equipment.equipmentId!]
                      }
                      return next
                    })
                  }}
                />
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
