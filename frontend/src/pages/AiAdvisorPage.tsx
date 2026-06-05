import { useNavigate } from "react-router-dom"
import MainLayout from "../components/layout/MainLayout"

export default function AiAdvisorPage() {
  const navigate = useNavigate()

  return (
    <MainLayout>
      <div className="space-y-6">
        <button
          onClick={() => navigate("/")}
          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300"
        >
          ← 대시보드로 돌아가기
        </button>

        <div>
          <p className="text-sm font-semibold text-blue-600">
            FactoFit AI Advisor
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            AI 어드바이저
          </h1>

          <p className="mt-3 text-slate-500">
            설비투자, 지원사업, 안전점검 일정을 한 번에 상담합니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900">
              메뉴
            </p>

            <div className="mt-4 space-y-2">
              <button className="w-full rounded-xl bg-blue-600 px-4 py-3 text-left text-sm font-bold text-white">
                AI 맞춤 추천
              </button>

              <button
                onClick={() => navigate("/roi")}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                설비 ROI 분석
              </button>

              <button
                onClick={() => navigate("/support-projects")}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                보조금 탐색
              </button>

              <button
                onClick={() => navigate("/application-draft")}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                신청서 생성
              </button>

              <button
                onClick={() => navigate("/safety")}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                안전점검
              </button>
            </div>
          </aside>

          <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white">
                🤖
              </div>

              <div>
                <h2 className="font-bold text-slate-900">
                  팩토핏 AI 어드바이저
                </h2>
                <p className="text-sm text-slate-500">
                  설비투자 · 보조금 · 안전점검 통합 지원
                </p>
              </div>

              <span className="ml-auto rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-600">
                online
              </span>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex justify-end">
                <div className="max-w-xl rounded-2xl rounded-tr-sm bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
                  올해 안전점검 뭐 남았어요?
                </div>
              </div>

              <div className="max-w-3xl rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm leading-6 text-slate-700">
                  안산금속(주) 기준으로 올해 의무 점검 현황을 정리해드렸습니다.
                  KTL 전기안전 정기검사가 D-67로 가장 급합니다.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border-l-4 border-emerald-500 bg-white p-4">
                    <p className="font-bold text-slate-900">
                      ✅ 소방설비 정기점검
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      완료 · 2026년 2월 점검 완료
                    </p>
                  </div>

                  <div className="rounded-xl border-l-4 border-amber-500 bg-white p-4">
                    <p className="font-bold text-slate-900">
                      ⚠️ KTL 전기안전 정기검사
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      D-67 · 미이행 시 최대 300만원 과태료
                    </p>
                  </div>

                  <div className="rounded-xl border-l-4 border-red-500 bg-white p-4">
                    <p className="font-bold text-slate-900">
                      ❌ KOSHA 화학물질 취급 안전점검
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      미확인 · 미이행 시 최대 500만원 과태료
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate("/safety")}
                    className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100"
                  >
                    안전점검 현황 보기
                  </button>

                  <button
                    onClick={() => navigate("/advisor")}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
                  >
                    점검 일정 질문하기
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-xl rounded-2xl rounded-tr-sm bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
                  프레스 교체 지원금도 알려줘
                </div>
              </div>

              <div className="max-w-3xl rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm leading-6 text-slate-700">
                  유압 프레스 라인 A는 노후도 15년으로 교체 권고 기준을 초과했습니다.
                  현재 매칭 가능한 지원사업은 3건이며, 최대 2억원까지 확보 가능성이 있습니다.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <button
                    onClick={() => navigate("/support-detail")}
                    className="rounded-xl bg-blue-50 p-4 text-left transition hover:bg-blue-100"
                  >
                    <p className="text-sm font-bold text-slate-900">
                      KIAT 스마트공정개선
                    </p>
                    <p className="mt-2 text-sm text-blue-600">
                      최대 8,000만원
                    </p>
                    <p className="mt-1 text-xs text-red-500">
                      D-42
                    </p>
                  </button>

                  <button
                    onClick={() => navigate("/support-projects")}
                    className="rounded-xl bg-emerald-50 p-4 text-left transition hover:bg-emerald-100"
                  >
                    <p className="text-sm font-bold text-slate-900">
                      에너지공단 노후설비교체
                    </p>
                    <p className="mt-2 text-sm text-emerald-600">
                      최대 1억 2,000만원
                    </p>
                    <p className="mt-1 text-xs text-amber-600">
                      D-67
                    </p>
                  </button>

                  <button
                    onClick={() => navigate("/support-projects")}
                    className="rounded-xl bg-amber-50 p-4 text-left transition hover:bg-amber-100"
                  >
                    <p className="text-sm font-bold text-slate-900">
                      KICOX 스마트공장 구축
                    </p>
                    <p className="mt-2 text-sm text-amber-600">
                      최대 1억 5,000만원
                    </p>
                    <p className="mt-1 text-xs text-blue-600">
                      D-112
                    </p>
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate("/roi")}
                    className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600 transition hover:bg-blue-100"
                  >
                    ROI 분석 보기
                  </button>

                  <button
                    onClick={() => navigate("/support-detail")}
                    className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100"
                  >
                    추천 지원사업 상세 보기
                  </button>

                  <button
                    onClick={() => navigate("/application-draft")}
                    className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-100"
                  >
                    신청서 초안 생성
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate("/roi")}
                  className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600 transition hover:bg-blue-100"
                >
                  프레스 교체 ROI 분석
                </button>

                <button
                  onClick={() => navigate("/application-draft")}
                  className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-100"
                >
                  KIAT 신청서 초안 생성
                </button>

                <button
                  onClick={() => navigate("/support-projects")}
                  className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-600 transition hover:bg-amber-100"
                >
                  이번 달 마감 공고 보기
                </button>

                <button
                  onClick={() => navigate("/safety")}
                  className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100"
                >
                  안전점검 현황 보기
                </button>
              </div>

              <div className="mt-4 flex gap-3">
                <input
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                  placeholder="질문을 입력하세요..."
                />

                <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">
                  전송
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </MainLayout>
  )
}