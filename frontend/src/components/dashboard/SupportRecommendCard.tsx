import { useNavigate } from "react-router-dom"

export default function SupportRecommendCard() {
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-blue-600">
        추천 지원사업
      </p>

      <h2 className="mt-2 text-xl font-bold text-slate-900">
        스마트공장 구축 및 고도화 지원사업
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        노후 설비 교체와 공정 개선 목적에 적합한 지원사업입니다.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            지원 한도
          </p>
          <p className="mt-1 font-bold text-slate-900">
            최대 1억원
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            마감일
          </p>
          <p className="mt-1 font-bold text-red-600">
            D-42
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            적합도
          </p>
          <p className="mt-1 font-bold text-emerald-600">
            92%
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate("/support-detail")}
        className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
      >
        지원사업 상세 보기
      </button>
    </div>
  )
}