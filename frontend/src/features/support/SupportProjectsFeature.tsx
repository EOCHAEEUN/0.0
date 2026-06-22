import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
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

export default function SupportProjectsFeature() {
  const navigate = useNavigate()
  const location = useLocation()
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
    policyState === "success" && hasPolicyCards && Boolean(topProject) && Boolean(selectedProject)
  const shouldShowEmpty = policyState === "empty" && !hasPolicyCards

  useEffect(() => {
    const selectedProjectId = (
      location.state as { selectedProjectId?: number | null } | null
    )?.selectedProjectId

    if (
      typeof selectedProjectId === "number" &&
      finalRecommendedProjects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(selectedProjectId)
    }
  }, [finalRecommendedProjects, location.state, setSelectedProjectId])

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
            onClick={() => navigate("/dashboard")}
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
                onGoDraft={() =>
                  navigate("/application-draft", {
                    state: {
                      selectedProject,
                      from: "/support-projects",
                    },
                  })
                }
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
