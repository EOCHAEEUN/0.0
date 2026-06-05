import { useState } from "react"
import { useNavigate } from "react-router-dom"
import MainLayout from "../components/layout/MainLayout"

export default function ApplicationDraftPage() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)

  return (
    <MainLayout>
      <div className="space-y-6">
        <button
          onClick={() => navigate("/roi")}
          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300"
        >
          ← ROI 분석으로 돌아가기
        </button>

        <div>
          <p className="text-sm font-semibold text-blue-600">
            FactoFit Application Draft
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            지원사업 신청서 초안
          </h1>

          <p className="mt-3 text-slate-500">
            ROI 분석 결과를 바탕으로 지원사업 신청에 필요한 핵심 내용을 자동 정리했습니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900">
              스마트공장 구축 및 고도화 지원사업
            </h2>

            <div className="mt-6 space-y-5 text-sm text-slate-700">
              <div>
                <p className="font-bold text-slate-900">기업명</p>
                <p className="mt-1">안산금속(주)</p>
              </div>

              <div>
                <p className="font-bold text-slate-900">신청 목적</p>
                <p className="mt-1">
                  노후 유압 프레스 라인 A 교체를 통한 에너지 비용 절감 및 생산성 개선
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900">도입 설비</p>
                <p className="mt-1">
                  고효율 유압 프레스 설비 및 스마트 모니터링 시스템
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900">기대 효과</p>
                <p className="mt-1">
                  연간 에너지 비용 1,440만원 절감, 불량률 개선 효과 900만원,
                  투자 회수기간 2.6년 예상
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900">AI 작성 문장</p>
                <div className="mt-2 rounded-xl bg-slate-50 p-4 leading-7 text-slate-700">
                  당사는 현재 사용 중인 유압 프레스 라인 A의 노후화로 인해
                  에너지 비용 증가와 유지보수 부담이 지속적으로 발생하고 있습니다.
                  이에 고효율 프레스 설비로 교체하고 스마트 모니터링 시스템을 도입하여
                  생산성 향상과 에너지 절감을 동시에 달성하고자 합니다.
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => setSaved(true)}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                초안 저장하기
              </button>

              <button
                onClick={() => alert("PDF 다운로드 기능 준비 중입니다.")}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                PDF 다운로드
              </button>
            </div>

            {saved && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                ✅ 신청서 초안이 저장되었습니다.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                AI 작성 근거
              </h3>

              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>• 설비 연식 15년으로 교체 권고 기준 초과</li>
                <li>• 업종 평균 대비 에너지 비용 38% 높음</li>
                <li>• 연간 에너지 절감 예상액 1,440만원</li>
                <li>• 투자 회수기간 2.6년으로 사업성 양호</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                추천 지원사업
              </h3>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="font-bold text-slate-900">
                    스마트공장 구축 지원사업
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    최대 1억원 · 적합도 92%
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="font-bold text-slate-900">
                    고효율 설비 교체 지원사업
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    최대 8,400만원 · 적합도 88%
                  </p>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="font-bold text-slate-900">
                    중소기업 혁신바우처
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    최대 5,000만원 · 적합도 74%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}