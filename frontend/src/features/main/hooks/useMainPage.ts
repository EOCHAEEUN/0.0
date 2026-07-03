import { useRef, useState } from "react"
import type { MainDialogType } from "../main.contract"

export function useMainPage() {
  const [dialogType, setDialogType] = useState<MainDialogType>(null)
  const [newsletterEmail, setNewsletterEmail] = useState("")
  const whyTeaserRef = useRef<HTMLElement | null>(null)

  const handleHeroScroll = () => {
    if (!whyTeaserRef.current) return

    window.scrollTo({
      top: whyTeaserRef.current.offsetTop,
      behavior: "smooth",
    })
  }

  const handleNewsletterSubmit = () => {
    setDialogType("newsletter")
    setNewsletterEmail("")
  }

  return {
    dialogType,
    setDialogType,
    newsletterEmail,
    setNewsletterEmail,
    whyTeaserRef,
    handleHeroScroll,
    handleNewsletterSubmit,
  }
}
