import { useCallback } from "react"
import { useNavigate } from "react-router-dom"

import { useSupportProjects } from "./hooks/useSupportProjects"
import { PolicyDetailDialog } from "./components/SupportProjectDialogs"
import {
  EmptyPolicyState,
  ErrorPolicyState,
  LoadingPolicyState,
} from "./components/SupportProjectStates"
import {
  OtherMatchedPoliciesPanel,
  SupportWorkflowHero,
  SuccessHeroSection,
  backButtonStyle,
} from "./components/SupportProjectSections"
import type { SupportProject } from "./supportProjects.contract"

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key)?.trim() ?? ""
  } catch {
    return ""
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    if (value) {
      window.localStorage.setItem(key, value)
    }
  } catch {
    // localStorage 접근 실패 시 화면 이동만 막지 않기 위해 무시합니다.
  }
}

function writeJsonLocalStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage 접근 실패 시 화면 이동만 막지 않기 위해 무시합니다.
  }
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue

    const text = String(value).trim()
    if (text) return text
  }

  return ""
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function getProjectPolicyId(project: SupportProject | null | undefined) {
  const source = asRecord(project)

  return pickString(
    source.policyId,
    source.policy_id,
    source.policyID,
    source.rawId,
    source.raw_id,
    source.id,
  )
}

function getCompanyId() {
  return pickString(
    readLocalStorage("factofit_company_id"),
    readLocalStorage("company_id"),
  )
}

function getEquipmentId(selectedEquipmentContext: unknown) {
  const source = asRecord(selectedEquipmentContext)

  return pickString(
    source.equipmentId,
    source.equipment_id,
    source.selectedEquipmentId,
    source.selected_equipment_id,
    source.id,
    readLocalStorage("factofit_selected_equipment_id"),
    readLocalStorage("factofit_equipment_id"),
    readLocalStorage("selected_equipment_id"),
    readLocalStorage("equipment_id"),
  )
}

function buildSelectedProjectForDraft(
  project: SupportProject,
  ids: {
    companyId: string
    equipmentId: string
    policyId: string
  },
) {
  return {
    ...project,
    companyId: ids.companyId,
    company_id: ids.companyId,
    equipmentId: ids.equipmentId,
    equipment_id: ids.equipmentId,
    policyId: ids.policyId,
    policy_id: ids.policyId,
  }
}

export default function SupportProjectsFeature() {
  const navigate = useNavigate()

  const {
    selectedEquipmentContext,
    policyState,
    finalRecommendedProjects,
    otherMatchedProjects,
    policyCounters,
    selectedProject,
    selectedProjectId,
    detailProject,
    setSelectedProjectId,
    setDetailProject,
  } = useSupportProjects()

  const topProject = finalRecommendedProjects[0]
  const hasPolicyCards = finalRecommendedProjects.length > 0
  const shouldShowSuccess =
    policyState === "success" &&
    hasPolicyCards &&
    Boolean(topProject) &&
    Boolean(selectedProject)
  const shouldShowEmpty = policyState === "empty" && !hasPolicyCards

  const handleGoDraft = useCallback(
    (project: SupportProject | null | undefined) => {
      if (!project) {
        window.alert("신청서 초안을 만들 지원사업을 먼저 선택해주세요.")
        return
      }

      const companyId = getCompanyId()
      const equipmentId = getEquipmentId(selectedEquipmentContext)
      const policyId = getProjectPolicyId(project)

      if (!companyId || !equipmentId || !policyId) {
        window.alert(
          [
            "신청서 초안 생성에 필요한 값이 부족합니다.",
            "",
            `company_id: ${companyId || "없음"}`,
            `equipment_id: ${equipmentId || "없음"}`,
            `policy_id: ${policyId || "없음"}`,
            "",
            "마이페이지에서 기업/설비 정보를 저장하고, ROI 분석 후 지원사업을 다시 선택해주세요.",
          ].join("\n"),
        )
        return
      }

      const selectedProjectForDraft = buildSelectedProjectForDraft(project, {
        companyId,
        equipmentId,
        policyId,
      })

      // 신청서 페이지 새로고침/직접 진입 대비용입니다.
      // 신청서 내용 자체는 목업이 아니라 /api/draft → DB 기준으로 생성됩니다.
      writeLocalStorage("factofit_company_id", companyId)
      writeLocalStorage("factofit_selected_equipment_id", equipmentId)
      writeLocalStorage("factofit_equipment_id", equipmentId)
      writeLocalStorage("factofit_selected_policy_id", policyId)
      writeLocalStorage("factofit_policy_id", policyId)
      writeJsonLocalStorage("factofit_selected_project", selectedProjectForDraft)

      navigate("/application-draft", {
        state: {
          companyId,
          company_id: companyId,
          equipmentId,
          equipment_id: equipmentId,
          policyId,
          policy_id: policyId,
          selectedProject: selectedProjectForDraft,
        },
      })
    },
    [navigate, selectedEquipmentContext],
  )

  return (
    <main className="page">
      <PolicyDetailDialog
        project={detailProject}
        onClose={() => setDetailProject(null)}
      />

      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/")}
            style={backButtonStyle}
          >
            ← 대시보드로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT SUPPORT PROJECTS</div>
              <div className="label">POLICY MATCHING</div>
              <h2>
                설비투자 조건에 맞는 <br />
                지원사업을 추천합니다.
              </h2>
            </div>

            <p className="section-desc">
              선택된 {selectedEquipmentContext.equipmentName}, ROI 분석 결과,
              설비 유형, 투자 목적, 예상 지원금 규모를 바탕으로 신청 가능성이
              높은 지원사업을 우선순위로 정리합니다.
            </p>
          </div>

          <SupportWorkflowHero
            policyCounters={policyCounters}
            equipmentName={selectedEquipmentContext.equipmentName}
          />

          {policyState === "loading" && <LoadingPolicyState />}

          {policyState === "error" && (
            <ErrorPolicyState onBackToRoi={() => navigate("/roi")} />
          )}

          {shouldShowEmpty && (
            <EmptyPolicyState
              equipmentName={selectedEquipmentContext.equipmentName}
              onBackToRoi={() => navigate("/roi")}
            />
          )}

          {shouldShowSuccess && topProject && selectedProject && (
            <>
              <SuccessHeroSection
                topProject={topProject}
                selectedProject={selectedProject}
                equipmentContext={selectedEquipmentContext}
                finalRecommendedProjects={finalRecommendedProjects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onOpenDetail={setDetailProject}
                onGoDraft={() => handleGoDraft(selectedProject)}
              />

              <OtherMatchedPoliciesPanel
                projects={otherMatchedProjects}
                onOpenDetail={setDetailProject}
              />
            </>
          )}
        </div>
      </section>
    </main>
  )
}