import type { EquipmentInfo } from "../../mypage/myPage.parts"
import type { SafetyCheckItem } from "../safetyCheck.contract"
import { getCheckContent } from "../safetyCheck.constants"
import { formatEquipmentRegisteredAt, getEquipmentEmoji } from "../safetyCheck.utils"
import SafetyCheckPurposeBadge from "./SafetyCheckPurposeBadge"

type SafetyCheckEquipmentEvidenceTabProps = {
  equipmentList: EquipmentInfo[]
  itemsByEquipmentId: Record<string, SafetyCheckItem[]>
  onOpenCreate: (equipment: EquipmentInfo) => void
  onDeleteItem: (item: SafetyCheckItem) => void
}

export default function SafetyCheckEquipmentEvidenceTab({
  equipmentList,
  itemsByEquipmentId,
  onOpenCreate,
  onDeleteItem,
}: SafetyCheckEquipmentEvidenceTabProps) {
  if (equipmentList.length === 0) {
    return (
      <div className="section-block section-block--empty">
        <p>등록된 설비가 없습니다. 설비관리에서 설비를 먼저 등록해주세요.</p>
      </div>
    )
  }

  return (
    <div className="equipment-list">
      {equipmentList.map((equipment) => {
        const items = equipment.equipmentId
          ? itemsByEquipmentId[equipment.equipmentId] || []
          : []

        return (
          <div key={equipment.id} className="card card-compact">
            <div className="equipment-head">
              <div className="equipment-head__info">
                <div className="card-title">
                  <span aria-hidden="true">{getEquipmentEmoji(equipment.category)}</span>
                  {equipment.name || "설비"}
                </div>
                <div className="card-subtitle">
                  등록일: {formatEquipmentRegisteredAt(equipment.createdAt)}
                </div>
              </div>
              <button
                type="button"
                className="ff-draft-safety-save-btn"
                disabled={!equipment.equipmentId}
                onClick={() => onOpenCreate(equipment)}
              >
                + 점검 내용
              </button>
            </div>

            {items.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <span className="empty-state-icon" aria-hidden="true">
                  📂
                </span>
                <div>
                  <p>등록된 안전 점검이 없습니다</p>
                  <p className="subtle">+ 점검 내용 버튼으로 첫 증빙을 등록하세요.</p>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">점검 종류</th>
                      <th scope="col">점검 내용</th>
                      <th scope="col">파일명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <SafetyCheckPurposeBadge
                            purpose={item.inspection_purpose}
                            label={item.inspection_purpose_label}
                          />
                        </td>
                        <td>{getCheckContent(item)}</td>
                        <td>
                          {item.pdf_file_url ? (
                            <a
                              href={item.pdf_file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="file-link"
                            >
                              {item.inspection_pdf_file || "PDF 보기"}
                            </a>
                          ) : (
                            item.inspection_pdf_file || "-"
                          )}
                          <button
                            type="button"
                            className="ff-draft-safety-link-btn danger"
                            style={{ marginLeft: 8 }}
                            onClick={() => onDeleteItem(item)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
