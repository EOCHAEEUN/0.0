import { useNavigate } from "react-router-dom"
import MainLayout from "../components/layout/MainLayout"

export default function SupportProjectsPage() {
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
          <h1 className="text-3xl font-bold text-slate-900">
            지원사업 현황
          </h1>

          <p className="mt-2 text-slate-500">
            2026년 하반기 마감 일정
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-900">
            지원사업 캘린더
          </h2>

          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-red-100 p-3">
              KIAT 스마트공장 D-42
            </div>

            <div className="rounded-xl bg-amber-100 p-3">
              에너지공단 D-67
            </div>

            <div className="rounded-xl bg-blue-100 p-3">
              KOTRA D-89
            </div>

            <div className="rounded-xl bg-emerald-100 p-3">
              KICOX D-112
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-5 bg-slate-100 p-4 text-sm font-bold text-slate-600">
            <div>지원사업명</div>
            <div>주관기관</div>
            <div>지원금액</div>
            <div>마감일</div>
            <div>적합도</div>
          </div>

          {[
            ["KIAT 스마트 제조혁신 공정개선", "KIAT", "8,000만원", "D-42", "92%"],
            ["에너지공단 노후설비교체 지원", "에너지공단", "1억 2,000만원", "D-67", "88%"],
            ["KOTRA 수출 인큐베이팅 프로그램", "KOTRA", "컨설팅", "D-89", "74%"],
            ["KICOX 산업단지 스마트공장 구축", "KICOX", "1억 5,000만원", "D-112", "84%"],
          ].map((item) => (
            <div
              key={item[0]}
              onClick={() => navigate("/support-detail")}
              className="grid cursor-pointer grid-cols-5 border-t border-slate-100 p-4 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <div className="font-semibold text-slate-900">
                {item[0]}
              </div>
              <div>{item[1]}</div>
              <div className="font-bold text-blue-600">
                {item[2]}
              </div>
              <div className="font-bold text-red-500">
                {item[3]}
              </div>
              <div className="font-bold text-emerald-600">
                {item[4]}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              매칭된 공고
            </p>
            <p className="mt-3 text-3xl font-bold text-emerald-600">
              7건
            </p>
            <p className="mt-2 text-sm text-slate-500">
              이번 분기 신규 3건 포함
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              예상 확보 가능 금액
            </p>
            <p className="mt-3 text-3xl font-bold text-blue-600">
              2.0억원
            </p>
            <p className="mt-2 text-sm text-slate-500">
              보조금 합산 최대 기준
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              가장 빠른 마감
            </p>
            <p className="mt-3 text-3xl font-bold text-red-600">
              D-42
            </p>
            <p className="mt-2 text-sm text-slate-500">
              KIAT 스마트 제조혁신
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}