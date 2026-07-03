type KpiCardProps = {
  title: string
  value: string
  unit: string
  status: string
  type: string
}

export default function KpiCard({
  title,
  value,
  unit,
  status,
  type,
}: KpiCardProps) {
  const colorClass =
    type === "danger"
      ? "text-red-600 bg-red-50"
      : type === "warning"
      ? "text-amber-600 bg-amber-50"
      : type === "success"
      ? "text-emerald-600 bg-emerald-50"
      : "text-blue-600 bg-blue-50"

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold text-slate-500">
        {title}
      </p>

      <div className="mt-3 flex items-end gap-1">
        <strong className="text-3xl font-bold text-slate-900">
          {value}
        </strong>
        <span className="pb-1 text-sm text-slate-500">
          {unit}
        </span>
      </div>

      <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colorClass}`}>
        {status}
      </div>
    </div>
  )
}