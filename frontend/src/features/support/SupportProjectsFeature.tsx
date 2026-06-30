import { useCallback, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

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

function removeLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key)
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
  const [searchParams] = useSearchParams()
  const analysisIdFromQuery = useMemo(() => {
    const value = searchParams.get("analysisId")
    return value && value.trim() ? value.trim() : undefined
  }, [searchParams])
  const policyIdFromQuery = useMemo(() => {
    const value = searchParams.get("policyId")
    return value && value.trim() ? decodeURIComponent(value.trim()) : ""
  }, [searchParams])

  const {
    selectedEquipmentContext,
    analysisData,
    policyState,
    policyCards,
    finalRecommendedProjects,
    otherMatchedProjects,
    policyCounters,
    policySummary,
    policyErrorCode,
    selectedProject,
    detailProject,
    setDetailProject,
  } = useSupportProjects({ analysisId: analysisIdFromQuery })

  const topProject = finalRecommendedProjects[0]
  const hasPolicyCards = finalRecommendedProjects.length > 0
  const shouldShowSuccess =
    policyState === "success" &&
    hasPolicyCards &&
    Boolean(topProject) &&
    Boolean(selectedProject)
  const shouldShowEmpty = policyState === "empty" && !hasPolicyCards
  const isSnapshotMissingLegacy =
    Boolean(analysisIdFromQuery) && policyState === "error" && policyErrorCode === "POLICY_SNAPSHOT_MISSING"

  useEffect(() => {
    if (!policyIdFromQuery || policyState !== "success") return
    const selectedByQuery =
      policyCards.find((project) => String(project.rawId || project.id) === policyIdFromQuery) || null
    if (selectedByQuery) {
      setDetailProject(selectedByQuery)
    }
  }, [policyCards, policyIdFromQuery, policyState, setDetailProject])

  const handleGoDraft = useCallback(
    (project: SupportProject | null | undefined) => {
      if (!project) {
        window.alert("신청서 초안을 만들 지원사업을 먼저 선택해주세요.")
        return
      }

      const companyId = analysisIdFromQuery
        ? pickString(
            analysisData.company?.company_id,
            analysisData.equipment?.company_id,
            getCompanyId(),
          )
        : getCompanyId()
      const equipmentId = analysisIdFromQuery
        ? pickString(
            analysisData.equipment?.equipment_id,
            analysisData.equipment_id,
            getEquipmentId(selectedEquipmentContext),
          )
        : getEquipmentId(selectedEquipmentContext)
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
      if (analysisIdFromQuery) {
        writeLocalStorage("factofit_analysis_id", analysisIdFromQuery)
      } else {
        removeLocalStorage("factofit_analysis_id")
      }
      writeJsonLocalStorage("factofit_selected_project", selectedProjectForDraft)

      const draftSearchParams = new URLSearchParams({ policyId })
      if (analysisIdFromQuery) {
        draftSearchParams.set("analysisId", analysisIdFromQuery)
      }

      navigate(`/application-draft?${draftSearchParams.toString()}`, {
        state: {
          companyId,
          company_id: companyId,
          equipmentId,
          equipment_id: equipmentId,
          policyId,
          policy_id: policyId,
          ...(analysisIdFromQuery
            ? { analysisId: analysisIdFromQuery, analysis_id: analysisIdFromQuery }
            : {}),
          selectedProject: {
            ...selectedProjectForDraft,
            ...(analysisIdFromQuery
              ? { analysisId: analysisIdFromQuery, analysis_id: analysisIdFromQuery }
              : {}),
          },
        },
      })
    },
    [analysisData, analysisIdFromQuery, navigate, selectedEquipmentContext],
  )

  const reanalysisPath =
    analysisIdFromQuery && getEquipmentId(selectedEquipmentContext)
      ? `/analysis/new?mode=reanalysis&equipmentId=${encodeURIComponent(getEquipmentId(selectedEquipmentContext))}&parentAnalysisId=${encodeURIComponent(analysisIdFromQuery)}`
      : "/analysis/new"

  return (
    <main className="page">
      <PolicyDetailDialog
        project={detailProject}
        onClose={() => setDetailProject(null)}
        onCreateDraft={handleGoDraft}
      />

      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() =>
              analysisIdFromQuery
                ? navigate(`/analysis/${analysisIdFromQuery}/result`)
                : navigate("/")
            }
            style={backButtonStyle}
          >
            {analysisIdFromQuery ? "← 투자 검토 결과로 돌아가기" : "← 대시보드로 돌아가기"}
          </button>

          <SupportWorkflowHero
            policyCounters={policyCounters}
            equipmentName={selectedEquipmentContext.equipmentName}
            currentAvailableCount={policySummary.activePolicyCount}
            hasCurrentAvailableCount={Boolean(policySummary.updatedAt)}
          />

          {policyState === "loading" && <LoadingPolicyState />}

          {policyState === "error" && !isSnapshotMissingLegacy && (
            <ErrorPolicyState onBackToRoi={() => navigate("/roi")} />
          )}

          {isSnapshotMissingLegacy && (
            <section
              style={{
                marginTop: "28px",
                marginBottom: "28px",
                padding: "44px",
                borderRadius: "30px",
                border: "1px solid #FDBA74",
                background: "#FFF7ED",
                boxShadow: "0 18px 44px rgba(6,27,52,.06)",
              }}
            >
              <span className="badge orange">정책 이력 없음</span>
              <h2>이 분석은 정책 이력 저장 전 생성되었습니다.</h2>
              <p>
                정확한 지원사업 이력을 보려면 투자 조건을 다시 분석해 주세요.
                <br />
                새 분석에서는 정책 추천 결과가 함께 저장됩니다.
              </p>
              <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn blue"
                  onClick={() => navigate(reanalysisPath)}
                >
                  투자 조건 다시 설정
                </button>
                <button
                  type="button"
                  className="btn dark"
                  onClick={() => navigate("/support-projects")}
                >
                  최신 지원사업 둘러보기
                </button>
              </div>
            </section>
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
                policyCounters={policyCounters}
                onOpenDetail={setDetailProject}
                isRoiLinked={Boolean(analysisIdFromQuery)}
              />

              <OtherMatchedPoliciesPanel
                projects={otherMatchedProjects}
                onOpenDetail={setDetailProject}
                isRoiLinked={Boolean(analysisIdFromQuery)}
              />
            </>
          )}
        </div>
      </section>
    </main>
  )
}
