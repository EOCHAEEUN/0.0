import type { CompanyDocumentCatalogItem } from "./companyDocuments.contract"

/**
 * Backend ALLOWED_DOCUMENT_TYPES (documents.py) 기준 catalog.
 * document_type 값은 backend enum과 1:1 일치해야 한다.
 */
export const COMPANY_DOCUMENT_CATALOG: CompanyDocumentCatalogItem[] = [
  {
    documentCategory: "company_evidence",
    documentCategoryLabel: "기업증빙",
    documentType: "business_registration",
    documentLabel: "사업자등록증",
  },
  {
    documentCategory: "company_evidence",
    documentCategoryLabel: "기업증빙",
    documentType: "factory_registration",
    documentLabel: "공장등록증",
  },
  {
    documentCategory: "company_evidence",
    documentCategoryLabel: "기업증빙",
    documentType: "corporate_registry",
    documentLabel: "법인등기부등본",
  },
  {
    documentCategory: "company_evidence",
    documentCategoryLabel: "기업증빙",
    documentType: "sme_confirmation",
    documentLabel: "중소기업확인서",
  },
  {
    documentCategory: "company_evidence",
    documentCategoryLabel: "기업증빙",
    documentType: "financial_statement",
    documentLabel: "재무제표",
  },
  {
    documentCategory: "tax_evidence",
    documentCategoryLabel: "세무증빙",
    documentType: "national_tax_certificate",
    documentLabel: "국세 납세증명서",
  },
  {
    documentCategory: "tax_evidence",
    documentCategoryLabel: "세무증빙",
    documentType: "local_tax_certificate",
    documentLabel: "지방세 납세증명서",
  },
  {
    documentCategory: "tax_evidence",
    documentCategoryLabel: "세무증빙",
    documentType: "vat_tax_base_certificate",
    documentLabel: "부가가치세과세표준증명원",
  },
  {
    documentCategory: "tax_evidence",
    documentCategoryLabel: "세무증빙",
    documentType: "quotation",
    documentLabel: "견적서",
  },
  {
    documentCategory: "other_evidence",
    documentCategoryLabel: "기타증빙",
    documentType: "participation_commitment",
    documentLabel: "참여확약서",
  },
  {
    documentCategory: "other_evidence",
    documentCategoryLabel: "기타증빙",
    documentType: "research_institute_certificate",
    documentLabel: "기업부설연구소 인정서",
  },
  {
    documentCategory: "other_evidence",
    documentCategoryLabel: "기타증빙",
    documentType: "business_application_form",
    documentLabel: "사업신청서",
  },
  {
    documentCategory: "other_evidence",
    documentCategoryLabel: "기타증빙",
    documentType: "business_plan",
    documentLabel: "사업계획서",
  },
  {
    documentCategory: "other_evidence",
    documentCategoryLabel: "기타증빙",
    documentType: "privacy_consent",
    documentLabel: "개인정보 수집·이용 동의서",
  },
  {
    documentCategory: "other_evidence",
    documentCategoryLabel: "기타증빙",
    documentType: "credit_info_consent",
    documentLabel: "신용정보 조회 동의서",
  },
  {
    documentCategory: "other_evidence",
    documentCategoryLabel: "기타증빙",
    documentType: "ip_certification_evidence",
    documentLabel: "지식재산권·인증 증빙",
  },
]

export const COMPANY_DOCUMENT_CATEGORIES = Array.from(
  new Map(
    COMPANY_DOCUMENT_CATALOG.map((item) => [
      item.documentCategory,
      item.documentCategoryLabel,
    ]),
  ).entries(),
).map(([documentCategory, documentCategoryLabel]) => ({
  documentCategory,
  documentCategoryLabel,
}))
