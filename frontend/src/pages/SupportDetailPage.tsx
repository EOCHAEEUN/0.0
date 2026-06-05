import { useNavigate } from "react-router-dom"
import MainLayout from "../components/layout/MainLayout"

export default function SupportDetailPage() {
  const navigate = useNavigate()

  return (
    <MainLayout>
      <div className="space-y-6">
        <button
          onClick={() => navigate("/support-projects")}
          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300"
        >
          ← 지원사업 목록으로 돌아가기
        </button>

        <div>
          <p className="text-sm font-semibold text-blue-600">
            FactoFit Support Detail
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            스마트공장 구축 및 고도화 지원사업
          </h1>

          <p className="mt-3 text-slate-500">
            안산금속(주)의 노후 설비 교체 목적과 높은 적합도를 보이는 지원사업입니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              적합도
            </p>
            <p className="mt-3 text-3xl font-bold text-emerald-600">
              92%
            </p>
            <p className="mt-2 text-sm text-slate-500">
              설비 교체 목적과 매우 적합
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              지원 한도
            </p>
            <p className="mt-3 text-3xl font-bold text-blue-600">
              1억원
            </p>
            <p className="mt-2 text-sm text-slate-500">
              정부 보조금 최대 기준
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              마감일
            </p>
            <p className="mt-3 text-3xl font-bold text-red-600">
              D-42
            </p>
            <p className="mt-2 text-sm text-slate-500">
              신청 준비 필요
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              추천 순위
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              1순위
            </p>
            <p className="mt-2 text-sm text-slate-500">
              ROI 분석 기준 최우선
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900">
              사업 개요
            </h2>

            <div className="mt-6 space-y-5 text-sm text-slate-700">
              <div>
                <p className="font-bold text-slate-900">주관기관</p>
                <p className="mt-1">중소벤처기업부 · 스마트제조혁신추진단</p>
              </div>

              <div>
                <p className="font-bold text-slate-900">지원 대상</p>
                <p className="mt-1">
                  제조 공정 개선, 자동화 설비 도입, 스마트 모니터링 시스템 구축을 추진하는 중소 제조기업
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900">지원 내용</p>
                <p className="mt-1">
                  노후 설비 교체, 생산 공정 디지털화, 에너지 절감 설비 도입, IoT 기반 설비 모니터링 구축 비용 일부 지원
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900">팩토핏 추천 사유</p>
                <div className="mt-2 rounded-xl bg-slate-50 p-4 leading-7 text-slate-700">
                  안산금속(주)의 유압 프레스 라인 A는 설비 연식 15년으로 교체 권고 기준을 초과했고,
                  연간 에너지 비용이 업종 평균보다 높게 나타났습니다.
                  본 지원사업은 고효율 설비 교체와 스마트 모니터링 도입 목적에 부합하므로
                  우선 신청 대상으로 추천됩니다.
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/application-draft")}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                신청서 초안 생성
              </button>

              <button
                onClick={() => navigate("/roi")}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                ROI 분석 다시 보기
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                신청 조건
              </h3>

              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>• 제조업 중소기업</li>
                <li>• 설비 투자 또는 공정 개선 계획 보유</li>
                <li>• 사업자등록증 보유</li>
                <li>• 최근 재무자료 제출 가능</li>
                <li>• 지원사업 마감 전 신청 가능</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                필요 서류
              </h3>

              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>• 사업자등록증</li>
                <li>• 최근 3개년 재무제표</li>
                <li>• 설비 투자 계획서</li>
                <li>• 견적서 또는 구매 계획서</li>
                <li>• 공정 개선 기대효과 자료</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                AI 준비도 진단
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                현재 신청 준비도는 높음입니다.  
                투자 목적, 기대효과, ROI 근거가 이미 정리되어 있어 신청서 초안 생성이 가능합니다.
              </p>

              <p className="mt-4 text-2xl font-bold text-blue-600">
                준비도 87%
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}