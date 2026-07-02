import SupportProjectsFeature from "../features/support/SupportProjectsFeature"
import type { SupportProjectsView } from "../features/support/supportProjectsPaths"

type SupportProjectsPageProps = {
  view: SupportProjectsView
}

export default function SupportProjectsPage({ view }: SupportProjectsPageProps) {
  return <SupportProjectsFeature view={view} />
}
