import { useNavigate } from "react-router-dom"

type Equipment = {
  name: string
  category: string
  age: number
  status: string
  type: string
}

type EquipmentStatusListProps = {
  items: Equipment[]
}

export default function EquipmentStatusList({
  items,
}: EquipmentStatusListProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900">
          설비 현황
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          주요 설비의 노후도와 점검 상태를 확인합니다.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const badgeClass =
            item.type === "danger"
              ? "bg-red-50 text-red-600"
              : item.type === "warning"
              ? "bg-amber-50 text-amber-600"
              : "bg-emerald-50 text-emerald-600"

          return (
            <div
              key={item.name}
              onClick={() => navigate("/roi")}
              className="flex cursor-pointer items-center justify-between p-5 transition hover:bg-slate-50"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {item.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.category}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <p className="text-xl font-bold text-slate-900">
                  {item.age}년
                </p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                  {item.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}