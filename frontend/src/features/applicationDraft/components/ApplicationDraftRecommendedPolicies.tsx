import { Star } from "lucide-react"

import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { usePolicyPicker } from "../hooks/usePolicyPicker"

export function ApplicationDraftRecommendedPolicies({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const { items, currentPolicy } = usePolicyPicker(model)

  if (items.length === 0) {
    return (
      <article className="ff-card ff-draft-recommend-card">
        <h4>적합 지원 사업 추천</h4>
        <p className="ff-draft-recommend-empty">
          분석 결과에서 추천 지원사업을 찾지 못했습니다. 지원사업 메뉴에서 다시
          확인해 주세요.
        </p>
      </article>
    )
  }

  return (
    <article className="ff-card ff-draft-recommend-card">
      <h4>적합 지원 사업 추천</h4>
      {currentPolicy ? (
        <div className="ff-draft-recommend-item is-selected">
          <span className="ff-draft-recommend-icon is-primary" aria-hidden="true">
            <Star size={15} strokeWidth={2.2} fill="currentColor" />
          </span>
          <div className="ff-draft-recommend-copy">
            <strong>{currentPolicy.title}</strong>
            <p>
              {[
                currentPolicy.agency,
                currentPolicy.deadline ? `마감일: ${currentPolicy.deadline}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "지원 조건은 공고 원문을 확인해 주세요."}
            </p>
          </div>
        </div>
      ) : (
        <p className="ff-draft-recommend-empty">현재 신청서에 반영된 지원사업이 없습니다.</p>
      )}
      <p className="ff-draft-recommend-note">
        분석 결과 추천 top{items.length}건 중{" "}
        {currentPolicy ? "1건이 신청서에 반영되어 있습니다." : "지원사업을 선택해 주세요."} 변경은
        상단 &quot;신청 지원사업 변경&quot; 버튼에서 할 수 있습니다.
      </p>
    </article>
  )
}
