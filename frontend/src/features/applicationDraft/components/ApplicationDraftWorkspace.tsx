import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ApplicationDraftSafetyEvidence } from "./ApplicationDraftSafetyEvidence"
import { ApplicationDraftSummary } from "./ApplicationDraftSummary"

export function ApplicationDraftWorkspace({
  model,
  onGoRoi,
}: {
  model: ApplicationDraftWorkspaceModel
  onGoRoi: () => void
}) {
  return (
    <section className="ff-draft-workspace ff-draft-workspace-v2">
      <ApplicationDraftSummary model={model} onGoRoi={onGoRoi} />
      <ApplicationDraftSafetyEvidence model={model} />
    </section>
  )
}
