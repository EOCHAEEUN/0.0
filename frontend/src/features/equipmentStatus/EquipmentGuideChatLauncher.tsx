import { useEffect, useState } from "react"
import { AdvisorFloatingButton } from "../aiAdvisor/components/AdvisorFloatingButton"
import "../aiAdvisor/aiAdvisor.css"
import EquipmentGuideChatPanel from "./EquipmentGuideChatPanel"

export default function EquipmentGuideChatLauncher() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  return (
    <div className="ff-equipment-guide-chat-launcher" data-open={open ? "true" : "false"}>
      <AdvisorFloatingButton
        open={open}
        label="설비 등록 도우미"
        onClick={() => setOpen((value) => !value)}
      />
      <EquipmentGuideChatPanel open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
