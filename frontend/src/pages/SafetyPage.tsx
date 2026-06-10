import { useNavigate } from "react-router-dom"

export default function SafetyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <button
        onClick={() => navigate("/?screen=dashboard")}
        className="factofit-back-button"
      >
        ← 대시보드로 돌아가기
      </button>

      <p className="text-sm font-semibold text-blue-600">
        FactoFit Safety Check
      </p>

      <h1 className="mt-2 text-3xl font-bold text-slate-900">
        안전점검 현황
      </h1>

      <p className="mt-3 text-slate-500">
        전기안전, 소방설비, 화학물질 점검 일정을 한눈에 확인합니다.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">완료된 점검</p>
          <p className="mt-3 text-3xl font-bold text-emerald-600">1건</p>
          <p className="mt-2 text-sm text-slate-500">소방설비 정기점검 완료</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">예정된 점검</p>
          <p className="mt-3 text-3xl font-bold text-amber-600">1건</p>
          <p className="mt-2 text-sm text-slate-500">KTL 전기안전 정기검사 D-67</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">미완료 점검</p>
          <p className="mt-3 text-3xl font-bold text-red-600">1건</p>
          <p className="mt-2 text-sm text-slate-500">KOSHA 화학물질 안전점검</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border-l-4 border-emerald-500 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-600">완료</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                소방설비 정기점검
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                점검일: 2026-02-14 · 다음 점검: 2027-02 예정
              </p>
            </div>

            <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-600">
              정상
            </span>
          </div>
        </div>

        <div className="rounded-2xl border-l-4 border-amber-500 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-600">예정</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                KTL 전기안전 정기검사
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                예정일: 2026-08-10 · 미이행 시 최대 300만원 과태료
              </p>
            </div>

            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-600">
              D-67
            </span>
          </div>
        </div>

        <div className="rounded-2xl border-l-4 border-red-500 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-600">미완료</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                KOSHA 화학물질 취급 안전점검
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                상태: 미확인 · 미이행 시 최대 500만원 과태료
              </p>
            </div>

            <span className="rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-600">
              확인 필요
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          AI 안전관리 추천
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          KTL 전기안전 정기검사가 D-67로 다가오고 있습니다.
          KOSHA 화학물질 안전점검은 상태가 미확인되어 우선 확인이 필요합니다.
          점검 일정을 등록하고 담당자를 지정하는 것을 권장합니다.
        </p>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => navigate("/advisor")}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
          >
            AI에게 점검 일정 묻기
          </button>

          <button
            onClick={() => navigate("/support-projects")}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
          >
            관련 지원사업 보기
          </button>
        </div>
      </div>
    </div>
  )
}