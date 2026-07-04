import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileRoiViewModel } from "./mobileApp.mapper"

export default function MobileRoiScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId })
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, dashboard.workspace),
    [dashboard.workspace, searchParams],
  )
  const model = useMemo(() => mapMobileRoiViewModel({ dashboard, draftWorkspace: null }), [dashboard])

  return (
    <section className="ff-mobile-screen">
      <header className="ff-mobile-header">
        <div>
          <h1>대표설비 ROI</h1>
          <p>핵심 수치만 빠르게 확인</p>
        </div>
      </header>

      {!model.hasAnalysis ? (
        <article className="ff-mobile-card">
          <h2>ROI 분석 없음</h2>
          <p>{model.emptyMessage}</p>
          <button type="button" className="ff-mobile-primary-btn" onClick={() => navigate(model.emptyCtaPath)}>
            웹에서 ROI 분석 시작
          </button>
        </article>
      ) : (
        <>
          <article className="ff-mobile-card">
            <h2>{model.equipmentName}</h2>
            <p className="ff-mobile-meta">{model.equipmentCategory}</p>
            <p className="ff-mobile-meta">{model.roiMetricLabel}</p>
            <p className="ff-mobile-kpi">{model.roiMetricValue}</p>
          </article>

          <article className="ff-mobile-card">
            <h2>핵심 투자 요약</h2>
            <div className="ff-mobile-list">
              <div className="ff-mobile-list-item">
                <h3>투자금액</h3>
                <p>{model.investmentText}</p>
              </div>
              <div className="ff-mobile-list-item">
                <h3>절감/효율 방향</h3>
                <p>{model.savingsText}</p>
              </div>
            </div>
            <p>{model.aiSummary}</p>
            <button
              type="button"
              className="ff-mobile-primary-btn"
              onClick={() => {
                if (flowContext.analysisId && model.webDetailPath.startsWith("/roi/")) {
                  const query = new URLSearchParams({ analysisId: flowContext.analysisId })
                  navigate(`${model.webDetailPath}?${query.toString()}`)
                  return
                }
                navigate(model.webDetailPath)
              }}
            >
              웹에서 상세 분석 보기
            </button>
          </article>
        </>
      )}
    </section>
  )
}
