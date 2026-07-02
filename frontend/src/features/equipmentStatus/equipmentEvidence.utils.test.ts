import type { EquipmentEvidenceRecord } from "./equipmentEvidence.contract"
import {
  computeAttachmentEvidenceSummary,
  computeEvidenceSummaryStats,
  getDefaultReflectedText,
  isEvidenceEligibleForApplication,
} from "./equipmentEvidence.utils"

function buildRecord(
  overrides: Partial<EquipmentEvidenceRecord>,
): EquipmentEvidenceRecord {
  return {
    evidence_id: overrides.evidence_id || "ev-1",
    attachment_id: overrides.attachment_id || "att-1",
    equipment_id: "eq-1",
    company_id: "co-1",
    user_id: "user-1",
    evidence_type: "safety_inspection",
    evidence_date: "2026-06-01",
    title: "테스트",
    summary: "요약",
    structured_items: [],
    application_sentence: "신청서 문장",
    review_status: "draft",
    is_demo: false,
    ...overrides,
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`)
  }
}

export function runEquipmentEvidenceUtilsTests() {
  const approved = buildRecord({
    evidence_id: "ev-approved",
    review_status: "approved",
    application_sentence: "승인 문장",
  })
  const draft = buildRecord({
    evidence_id: "ev-draft",
    review_status: "draft",
  })
  const demo = buildRecord({
    evidence_id: "ev-demo",
    review_status: "approved",
    is_demo: true,
  })

  assertEqual(isEvidenceEligibleForApplication(approved), true, "approved eligible")
  assertEqual(isEvidenceEligibleForApplication(draft), false, "draft ineligible")
  assertEqual(isEvidenceEligibleForApplication(demo), false, "demo ineligible")

  assertEqual(getDefaultReflectedText("  문장  "), "문장", "default reflected text")

  const attachmentSummary = computeAttachmentEvidenceSummary(
    [approved, draft],
    "att-1",
  )
  assertEqual(attachmentSummary.totalCount, 2, "attachment total")
  assertEqual(attachmentSummary.approvedCount, 1, "attachment approved")
  assertEqual(attachmentSummary.statusLabel, "승인 완료", "attachment status")

  const emptySummary = computeAttachmentEvidenceSummary([], "att-2")
  assertEqual(emptySummary.statusLabel, "근거 미등록", "empty attachment status")

  const demoSummary = computeAttachmentEvidenceSummary([demo], "att-1")
  assertEqual(demoSummary.statusTone, "demo", "demo attachment tone")

  const stats = computeEvidenceSummaryStats([approved, draft, demo], [
    {
      selection_id: "sel-1",
      evidence_id: "ev-approved",
      company_id: "co-1",
      equipment_id: "eq-1",
      analysis_id: "an-1",
      policy_id: "po-1",
      application_section: "supporting_evidence",
      reflected_text: "반영",
      is_selected: true,
    },
  ])
  assertEqual(stats.totalCount, 3, "stats total")
  assertEqual(stats.approvedCount, 1, "stats approved")
  assertEqual(stats.applicationSelectedCount, 1, "stats selected")
}
