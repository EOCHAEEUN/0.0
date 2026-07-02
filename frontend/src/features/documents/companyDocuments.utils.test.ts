import { COMPANY_DOCUMENT_CATALOG } from "./companyDocuments.catalog"
import type { CompanyDocumentRecord } from "./companyDocuments.contract"
import {
  buildCatalogStatuses,
  buildLatestDocumentsByType,
  computeCompanyDocumentSummary,
  getCategoryRegistrationCounts,
} from "./companyDocuments.utils"

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`)
  }
}

export function runCompanyDocumentsUtilsTests() {
  const documents: CompanyDocumentRecord[] = [
    {
      document_id: "1",
      user_id: "u1",
      company_id: "c1",
      document_type: "business_registration",
      document_label: "사업자등록증",
      original_filename: "old.pdf",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      document_id: "2",
      user_id: "u1",
      company_id: "c1",
      document_type: "business_registration",
      document_label: "사업자등록증",
      original_filename: "new.pdf",
      created_at: "2026-06-01T00:00:00Z",
    },
  ]

  const { latestByType, countByType } = buildLatestDocumentsByType(documents)
  assertEqual(latestByType.get("business_registration")?.original_filename, "new.pdf", "latest file")
  assertEqual(countByType.get("business_registration"), 2, "type count")

  const summary = computeCompanyDocumentSummary(COMPANY_DOCUMENT_CATALOG, latestByType)
  assertEqual(summary.registeredCount, 1, "registered count")
  assertEqual(summary.missingCount, summary.totalRequired - 1, "missing count")

  const statuses = buildCatalogStatuses(
    COMPANY_DOCUMENT_CATALOG,
    documents,
    "company_evidence",
  )
  assertEqual(
    statuses.find((item) => item.catalogItem.documentType === "business_registration")
      ?.isRegistered,
    true,
    "registered status",
  )

  const counts = getCategoryRegistrationCounts(
    "company_evidence",
    COMPANY_DOCUMENT_CATALOG,
    latestByType,
  )
  assertEqual(counts.registered, 1, "category registered")
  assertEqual(counts.total, 5, "category total")
}
