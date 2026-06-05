import { useNavigate } from "react-router-dom"

import SupportRecommendCard from "../components/dashboard/SupportRecommendCard"
import MainLayout from "../components/layout/MainLayout"
import KpiCard from "../components/dashboard/KpiCard"
import EquipmentStatusList from "../components/dashboard/EquipmentStatusList"
import EnergyChart from "../components/dashboard/EnergyChart"
import { kpiData, equipmentData } from "../data/dashboard.mock"

export default function DashboardPage() {
  const navigate = useNavigate()

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            FactoFit Dashboard
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-950">
            안산금속(주) 설비 투자 진단
          </h2>

          <p className="mt-2 text-slate-500">
            설비 노후도, 에너지 비용, 지원사업 매칭 현황을 한눈에 확인합니다.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/roi")}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              ROI 분석 시작하기
            </button>

            <button
              onClick={() => navigate("/support-projects")}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              지원사업 보기
            </button>

            <button
              onClick={() => navigate("/safety")}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              안전점검 현황
            </button>

            <button
              onClick={() => navigate("/advisor")}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              AI 어드바이저
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiData.map((item) => (
            <KpiCard
              key={item.title}
              title={item.title}
              value={item.value}
              unit={item.unit}
              status={item.status}
              type={item.type}
            />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <EquipmentStatusList items={equipmentData} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              AI 추천
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              유압 프레스 라인 A는 평균 교체 주기를 초과했습니다.
              에너지공단 노후설비 교체 지원사업과 함께 ROI 분석을 진행해보세요.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/roi")}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                ROI 분석 시작하기
              </button>

              <button
                onClick={() => navigate("/application-draft")}
                className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                신청서 초안 보기
              </button>
            </div>
          </div>
        </div>

        <EnergyChart />

        <SupportRecommendCard />
      </div>
    </MainLayout>
  )
}