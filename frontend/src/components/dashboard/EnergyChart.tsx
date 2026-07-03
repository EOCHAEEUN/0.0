const chartData = [
  { month: "1월", value: 4200 },
  { month: "2월", value: 4500 },
  { month: "3월", value: 4800 },
  { month: "4월", value: 5100 },
  { month: "5월", value: 5300 },
  { month: "6월", value: 5600 },
]

export default function EnergyChart() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">
          월별 전력 사용량
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          최근 6개월 전력 사용량 추이입니다.
        </p>
      </div>

      <div className="space-y-4">
        {chartData.map((item) => (
          <div key={item.month}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-slate-600">{item.month}</span>
              <span className="text-slate-500">
                {item.value.toLocaleString()} kWh
              </span>
            </div>

            <div className="h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-blue-500"
                style={{ width: `${(item.value / 5600) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}