import { ChevronRight, Settings, UserRound, X } from "lucide-react"
import { createPortal } from "react-dom"

type MobileCompanyMenuSheetProps = {
  open: boolean
  anchorTop?: number
  anchorRight?: number
  onClose: () => void
  onSelectProfile: () => void
  onSelectEquipment: () => void
}

const MENU_ITEMS = [
  {
    id: "profile",
    label: "내 정보관리",
    description: "기본정보 · 기업정보 · 담당자",
    icon: UserRound,
    onSelect: (props: MobileCompanyMenuSheetProps) => props.onSelectProfile,
  },
  {
    id: "equipment",
    label: "내 설비현황",
    description: "등록 설비 · 대표 설비 설정",
    icon: Settings,
    onSelect: (props: MobileCompanyMenuSheetProps) => props.onSelectEquipment,
  },
] as const

export function MobileCompanyMenuSheet({
  open,
  anchorTop,
  anchorRight,
  onClose,
  onSelectProfile,
  onSelectEquipment,
}: MobileCompanyMenuSheetProps) {
  if (!open) return null

  const props = { open, anchorTop, anchorRight, onClose, onSelectProfile, onSelectEquipment }
  const sheetStyle =
    anchorTop && anchorTop > 0
      ? {
          top: anchorTop,
          right: anchorRight ?? 12,
        }
      : undefined

  return createPortal(
    <>
      <div className="ff-mobile-company-menu-backdrop" role="presentation" onClick={onClose} />
      <section
        className="ff-mobile-company-menu-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="기업 메뉴"
        style={sheetStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ff-mobile-company-menu-head">
          <div>
            <span className="ff-mobile-company-menu-eyebrow">SETTINGS</span>
            <h2>기업 설정</h2>
          </div>
          <button type="button" className="ff-mobile-company-menu-close" onClick={onClose} aria-label="닫기">
            <X size={18} strokeWidth={2.1} />
          </button>
        </header>

        <div className="ff-mobile-company-menu-list">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const handleSelect = item.onSelect(props)
            return (
              <button
                key={item.id}
                type="button"
                className="ff-mobile-company-menu-item"
                onClick={() => {
                  handleSelect()
                  onClose()
                }}
              >
                <span className="ff-mobile-company-menu-item-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={2.1} />
                </span>
                <span className="ff-mobile-company-menu-item-copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
                <ChevronRight size={16} strokeWidth={2.1} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>
    </>,
    document.body,
  )
}
