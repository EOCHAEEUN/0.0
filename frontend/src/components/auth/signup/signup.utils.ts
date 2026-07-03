import type { IndustryInputRow } from "./signup.types"

export function createIndustryInputRow(): IndustryInputRow {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    industryName: "",
    industryCode: "",
    selectedIndustry: null,
  }
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function formatPhoneNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 3) return digits

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function formatBusinessNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 10)

  if (digits.length <= 3) return digits

  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export function normalizePhoneNumber(value: string) {
  return onlyDigits(value)
}

export function normalizeBusinessNumber(value: string) {
  return onlyDigits(value)
}