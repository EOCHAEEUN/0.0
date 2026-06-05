import { useNavigate } from "react-router-dom"
import MainLayout from "../components/layout/MainLayout"

export default function RoiPage() {
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
            FactoFit ROI Analysis
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            유압 프레스 라인 A ROI 분석 결과
          </h1>
          <p className="mt-3 text-slate-500">
            설비 노후도, 에너지 비용, 고장 이력, 지원사업 매칭을 기준으로 투자 회수 가능성을 분석했습니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-500">설비 연식</p>
            <p className="mt-3 text-3xl font-bold text-red-600">15년</p>
            <p className="mt-2 text-sm text-slate-500">교체 권고 기준 초과</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-500">예상 투자금</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">1.8억</p>
            <p className="mt-2 text-sm text-slate-500">고효율 프레스 교체 기준</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-500">예상 지원금</p>
            <p className="mt-3 text-3xl font-bold text-emerald-600">8,400만</p>
            <p className="mt-2 text-sm text-slate-500">에너지공단 지원사업 매칭</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-500">회수기간</p>
            <p className="mt-3 text-3xl font-bold text-blue-600">2.6년</p>
            <p className="mt-2 text-sm text-slate-500">업종 평균보다 1.2년 단축</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-emerald-600">
              AI 추천 시나리오 A
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              고효율 프레스 교체
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              초기 투자금은 크지만, 에너지 비용 절감과 불량률 개선 효과가 높아 가장 추천되는 선택입니다.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">연간 에너지 절감</span>
                <strong className="text-emerald-600">1,440만원</strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">불량 감소 효과</span>
                <strong className="text-emerald-600">900만원</strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">실부담 투자금</span>
                <strong className="text-slate-900">6,000만원</strong>
              </div>
            </div>

            <button
              onClick={() => navigate("/application-draft")}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              시나리오 A 신청서 초안 생성
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              비교 시나리오 B
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              부분 정비 + 스마트 모니터링
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              초기 비용은 낮지만 절감 효과가 제한적이며, 장기적으로는 교체보다 효율이 낮습니다.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">연간 에너지 절감</span>
                <strong className="text-emerald-600">480만원</strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">예상 지원금</span>
                <strong className="text-emerald-600">1,500만원</strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">회수기간</span>
                <strong className="text-slate-900">4.1년</strong>
              </div>
            </div>

            <button className="mt-6 w-full rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200">
              시나리오 B 상세 보기
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}