import { useState } from "react"
import { createPortal } from "react-dom"
import { AdvisorFloatingButton } from "../aiAdvisor/components/AdvisorFloatingButton"
import EquipmentGuideChatPanel from "./EquipmentGuideChatPanel"

export default function EquipmentGuideChatLauncher() {
  const [open, setOpen] = useState(false)

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="ff-equipment-guide-chat-launcher" data-open={open ? "true" : "false"}>
      <AdvisorFloatingButton
        open={open}
        label="설비 입력 도우미"
        onClick={() => setOpen((value) => !value)}
      />
      <EquipmentGuideChatPanel open={open} onClose={() => setOpen(false)} />
    </div>,
    document.body,
  )
}
