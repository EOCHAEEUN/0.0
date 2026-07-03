import { Navigate, useParams } from "react-router-dom"
import { buildRoiPath } from "../../roi/roiPaths"

export default function AnalysisResultPage() {
  const { id } = useParams()
  return <Navigate to={id ? buildRoiPath("strategy", { analysisId: id }) : buildRoiPath("strategy")} replace />
}
