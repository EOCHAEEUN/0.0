import { Fragment } from "react"
import { Check, FileText } from "lucide-react"

const STEPS = [
  { key: "company", label: "기업 정보" },
  { key: "equipment", label: "설비 정보" },
  { key: "roi", label: "ROI 분석" },
  { key: "application", label: "지원사업 신청서" },
] as const

export function ApplicationDraftProgressStepper() {
  return (
    <nav className="ff-draft-progress-stepper" aria-label="신청서 작성 진행 단계">
      <div className="ff-draft-progress-row">
        {STEPS.map((step, index) => {
          const isCurrent = step.key === "application"
          const isComplete = !isCurrent

          return (
            <Fragment key={step.key}>
              {index > 0 ? (
                <div className="ff-draft-progress-connector" aria-hidden="true" />
              ) : null}
              <div
                className={[
                  "ff-draft-progress-step",
                  isCurrent ? "is-current" : "",
                  isComplete ? "is-complete" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="ff-draft-progress-icon" aria-hidden="true">
                  {isCurrent ? (
                    <FileText size={17} strokeWidth={2.1} />
                  ) : (
                    <Check size={17} strokeWidth={2.6} />
                  )}
                </span>
                <span className="ff-draft-progress-label">{step.label}</span>
              </div>
            </Fragment>
          )
        })}
      </div>
    </nav>
  )
}
