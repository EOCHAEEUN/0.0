import { Navigate, useParams } from "react-router-dom"

export default function AnalysisResultPage() {
  const { id } = useParams()
  return <Navigate to={id ? `/roi?analysisId=${id}` : "/roi"} replace />
}
