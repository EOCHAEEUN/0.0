type MobileCumulativeRoiChartProps = {
  roiA: number | null
  roiB: number | null
}

export function MobileCumulativeRoiChart({ roiA, roiB }: MobileCumulativeRoiChartProps) {
  const hasData = roiA != null || roiB != null
  const safeA = roiA ?? 0
  const safeB = roiB ?? 0
  const maxRoi = Math.max(safeA, safeB, 100)

  const buildPath = (roi: number) =>
    [0, 0.25, 0.5, 0.75, 1]
      .map((t, index) => {
        const x = 24 + t * 272
        const y = 96 - (roi * t * 72) / maxRoi
        return `${index === 0 ? "M" : "L"}${x},${y}`
      })
      .join(" ")

  const xLabels = ["투자", "6M", "12M", "18M", "24M"]
  const xPositions = [24, 92, 160, 228, 296]

  return (
    <div className="ff-mobile-chart">
      <div className="ff-mobile-chart-legend">
        <span>
          <i className="dot solid" /> A안
        </span>
        <span>
          <i className="dot dashed" /> B안
        </span>
      </div>
      <svg viewBox="0 0 320 120" className="ff-mobile-chart-svg" role="img" aria-label="누적 ROI 추이">
        <line x1="24" y1="96" x2="296" y2="96" stroke="#E2E8F0" strokeWidth="1" />
        <line x1="24" y1="24" x2="24" y2="96" stroke="#E2E8F0" strokeWidth="1" />
        {hasData ? (
          <>
            <path d={buildPath(safeA)} fill="none" stroke="#061B34" strokeWidth="2.5" />
            <path
              d={buildPath(safeB)}
              fill="none"
              stroke="#64748B"
              strokeWidth="2.5"
              strokeDasharray="6 5"
            />
          </>
        ) : (
          <text x="160" y="58" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="700">
            ROI 분석 후 그래프가 표시됩니다
          </text>
        )}
        {xLabels.map((label, index) => (
          <text
            key={label}
            x={xPositions[index]}
            y="112"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="9"
            fontWeight="700"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}
