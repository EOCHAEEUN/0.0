import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ApplicationDraftSafetyEvidence } from "./ApplicationDraftSafetyEvidence"
import { ApplicationDraftSummary } from "./ApplicationDraftSummary"

export function ApplicationDraftWorkspace({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  return (
    <section className="ff-draft-workspace ff-draft-workspace-v2">
      <ApplicationDraftSummary model={model} />
      <ApplicationDraftSafetyEvidence model={model} />
    </section>
  )
}
