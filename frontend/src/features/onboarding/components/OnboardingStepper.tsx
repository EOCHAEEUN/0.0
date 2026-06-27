type Step = {
  label: string
}

type OnboardingStepperProps = {
  currentStep: 1 | 2 | 3
}

const steps: Step[] = [
  { label: "기업 정보" },
  { label: "투자 조건" },
  { label: "검토 결과" },
]

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  return (
    <ol className="ff-onboarding-stepper" aria-label="온보딩 진행 단계">
      {steps.map((step, index) => {
        const number = index + 1
        const state =
          number < currentStep ? "done" : number === currentStep ? "active" : "next"

        return (
          <li className={`ff-onboarding-step ${state}`} key={step.label}>
            <span aria-hidden="true">
              {state === "done" ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                number
              )}
            </span>
            <strong>{step.label}</strong>
          </li>
        )
      })}
    </ol>
  )
}
