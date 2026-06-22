import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

type SafetyState = "loading" | "error" | "empty" | "success"
type Tone = "green" | "orange" | "red" | "blue" | "gold"
type EquipmentCategory = "press" | "cnc" | "injection"
type BasisType = "law" | "official_guide" | "manual" | "self_check"
type RiskLevel = "low" | "medium" | "high"
type InspectionStatus = "normal" | "due_soon" | "overdue"
type BottomAccordionKey = "replace" | "db" | null

type Equipment = {
  equipmentId: string
  name: string
  category: EquipmentCategory
  ageYears: number
  defectRate: number
  maintenanceTrend: "증가" | "유지" | "감소"
  safetyDeviceStatus: "양호" | "점검 필요" | "위험"
}

type SafetyDashboardSummary = {
  score: number
  statusLabel: string
  title: string
  summary: string
  normalCount: number
  cautionCount: number
  dangerCount: number
}

type RiskMetric = {
  label: string
  value: string
  score: number
  tone: Tone
  description: string
}

type SafetyRule = {
  ruleId: string
  equipmentCategory: EquipmentCategory
  checkItem: string
  cycleMonths: number
  basisType: BasisType
  riskLevel: RiskLevel
  note: string
  sourceName: string
}

type InspectionHistory = {
  equipmentId: string
  ruleId: string
  lastCheckedAt: string
  nextDueAt: string
}

type InspectionTask = {
  id: string
  order: number
  title: string
  description: string
  basisType: BasisType
  riskLevel: RiskLevel
  nextDueAt: string
  daysLabel: string
  status: InspectionStatus
  tone: Tone
  badgeText: string
  note: string
  sourceName: string
}

const TEST_SAFETY_STATE: SafetyState = "success"

const colors = {
  page: "#F6F8FC",
  white: "#FFFFFF",
  navy: "#071B3A",
  navySoft: "#0D244A",
  text: "#071B3A",
  muted: "#6C7A92",
  line: "#DCE4EE",
  lineSoft: "#E8EEF5",
  shadow: "0 18px 44px rgba(6,27,52,.06)",

  blue: "#4C57C5",
  blueSoft: "#EEF1FF",

  green: "#628B5A",
  greenSoft: "#EEF6EE",

  orange: "#C9772B",
  orangeSoft: "#FCF2E8",

  red: "#C2473E",
  redSoft: "#FCECEC",

  gold: "#B6954C",
  goldSoft: "#F8F2E4",

  barTrack: "#E5EBF3",
  heroTrack: "rgba(255,255,255,.18)",
}

const companyProfile = {
  companyName: "로그인 기업",
  industryName: "금속가공 제조업",
  industryCode: "C25",
  region: "경기도 안산시",
  employeeCount: 45,
}

const equipmentList: Equipment[] = [
  {
    equipmentId: "eq-press-a",
    name: "유압 프레스 라인 A",
    category: "press",
    ageYears: 15,
    defectRate: 5.8,
    maintenanceTrend: "증가",
    safetyDeviceStatus: "점검 필요",
  },
  {
    equipmentId: "eq-cnc-01",
    name: "CNC 머시닝센터 5축",
    category: "cnc",
    ageYears: 9,
    defectRate: 2.1,
    maintenanceTrend: "유지",
    safetyDeviceStatus: "양호",
  },
  {
    equipmentId: "eq-injection-01",
    name: "전동식 사출성형기 450톤",
    category: "injection",
    ageYears: 12,
    defectRate: 4.2,
    maintenanceTrend: "증가",
    safetyDeviceStatus: "점검 필요",
  },
]

const dashboardSummaryMap: Record<string, SafetyDashboardSummary> = {
  "eq-press-a": {
    score: 67,
    statusLabel: "정밀점검 권고",
    title: "유압 프레스 라인 A의 안전 점수는 67점입니다.",
    summary:
      "15년 사용, 불량률 5.8%, 유지보수비 증가 흐름을 기준으로 산정했습니다.",
    normalCount: 0,
    cautionCount: 3,
    dangerCount: 1,
  },
  "eq-cnc-01": {
    score: 81,
    statusLabel: "안정 관리",
    title: "CNC 머시닝센터 5축의 안전 점수는 81점입니다.",
    summary:
      "사용연수와 점검 이력이 안정적이며, 정기 자율점검 중심으로 관리할 수 있습니다.",
    normalCount: 3,
    cautionCount: 1,
    dangerCount: 0,
  },
  "eq-injection-01": {
    score: 73,
    statusLabel: "관리 필요",
    title: "전동식 사출성형기 450톤의 안전 점수는 73점입니다.",
    summary:
      "설비 연식과 인터락 점검 필요 항목을 반영해 관리 필요 상태로 산정했습니다.",
    normalCount: 1,
    cautionCount: 3,
    dangerCount: 0,
  },
}

const riskMetricMap: Record<string, RiskMetric[]> = {
  "eq-press-a": [
    {
      label: "설비 노후도",
      value: "15년",
      score: 93,
      tone: "red",
      description:
        "설비 사용연수가 길수록 방호장치, 유압계통, 전기부품의 정밀점검 필요성이 높아집니다.",
    },
    {
      label: "유지보수 이력",
      value: "증가",
      score: 72,
      tone: "orange",
      description:
        "최근 유지보수비가 증가하면 부품 수명 저하 또는 반복 고장 가능성을 함께 봐야 합니다.",
    },
    {
      label: "불량률 변화",
      value: "5.8%",
      score: 73,
      tone: "orange",
      description:
        "불량률 상승은 설비 상태, 작업 안정성, 품질 리스크와 함께 연결될 수 있습니다.",
    },
    {
      label: "안전장치 상태",
      value: "점검 필요",
      score: 78,
      tone: "orange",
      description:
        "비상정지, 방호장치, 센서류 상태는 안전점검 우선순위 산정에 직접 반영됩니다.",
    },
    {
      label: "작업자 안전",
      value: "교육/표시 확인",
      score: 58,
      tone: "gold",
      description:
        "작업자 안전교육, 위험구역 표시, 점검표 기록이 최신 상태인지 확인해야 합니다.",
    },
  ],
  "eq-cnc-01": [
    {
      label: "설비 노후도",
      value: "9년",
      score: 58,
      tone: "gold",
      description:
        "사용연수 기준으로는 즉시 위험 단계는 아니지만 정기 예방점검은 필요합니다.",
    },
    {
      label: "유지보수 이력",
      value: "유지",
      score: 46,
      tone: "gold",
      description:
        "유지보수비는 안정적이지만, 핵심 부품 상태를 주기적으로 기록해야 합니다.",
    },
    {
      label: "불량률 변화",
      value: "2.1%",
      score: 39,
      tone: "green",
      description:
        "현재 불량률은 낮은 수준이므로 공정 안정성은 비교적 양호한 편입니다.",
    },
    {
      label: "안전장치 상태",
      value: "양호",
      score: 31,
      tone: "green",
      description:
        "인터락, 방호커버, 비상정지 상태가 전반적으로 안정적으로 관리되고 있습니다.",
    },
    {
      label: "작업자 안전",
      value: "기록 양호",
      score: 35,
      tone: "green",
      description:
        "교육 이력과 점검 기록 체계가 비교적 잘 관리되는 상태입니다.",
    },
  ],
  "eq-injection-01": [
    {
      label: "설비 노후도",
      value: "12년",
      score: 76,
      tone: "orange",
      description:
        "사출성형기 사용연수 기준으로 예방점검과 정밀점검을 병행해야 합니다.",
    },
    {
      label: "유지보수 이력",
      value: "증가",
      score: 69,
      tone: "orange",
      description:
        "유지보수비 증가 흐름이 있어 금형부, 유압부, 히터부 점검이 필요합니다.",
    },
    {
      label: "불량률 변화",
      value: "4.2%",
      score: 62,
      tone: "orange",
      description:
        "불량률이 상승 구간에 있어 품질 안정성과 설비 안전성을 함께 봐야 합니다.",
    },
    {
      label: "안전장치 상태",
      value: "점검 필요",
      score: 74,
      tone: "orange",
      description:
        "안전문 인터락과 접근 제한 표시 상태 확인이 필요합니다.",
    },
    {
      label: "작업자 안전",
      value: "교육 확인",
      score: 51,
      tone: "gold",
      description:
        "작업자 교육 및 접근제한 표시 기록을 최신화할 필요가 있습니다.",
    },
  ],
}

const safetyRules: SafetyRule[] = [
  {
    ruleId: "press-sensor",
    equipmentCategory: "press",
    checkItem: "광전자식 안전장치 정상 작동 여부",
    cycleMonths: 1,
    basisType: "self_check",
    riskLevel: "high",
    note: "센서 오염, 차광, 우회 사용 여부 확인",
    sourceName: "서비스 기본 안전점검 템플릿",
  },
  {
    ruleId: "press-emergency",
    equipmentCategory: "press",
    checkItem: "비상정지 버튼 작동 여부",
    cycleMonths: 1,
    basisType: "self_check",
    riskLevel: "high",
    note: "월 1회 이상 작동 여부 확인 권장",
    sourceName: "서비스 기본 안전점검 템플릿",
  },
  {
    ruleId: "press-two-hand",
    equipmentCategory: "press",
    checkItem: "양수조작식 방호장치 정상 작동 여부",
    cycleMonths: 1,
    basisType: "official_guide",
    riskLevel: "high",
    note: "방호장치 무효화 여부 확인 필요",
    sourceName: "KOSHA 안전보건공단",
  },
  {
    ruleId: "press-hydraulic",
    equipmentCategory: "press",
    checkItem: "유압 누유 및 압력 저하 여부",
    cycleMonths: 3,
    basisType: "manual",
    riskLevel: "medium",
    note: "호스, 밸브, 실린더 누유 확인",
    sourceName: "설비 제조사 매뉴얼",
  },

  {
    ruleId: "cnc-door",
    equipmentCategory: "cnc",
    checkItem: "도어 인터락 정상 작동 여부",
    cycleMonths: 1,
    basisType: "self_check",
    riskLevel: "medium",
    note: "가공 중 문 열림 방지 확인",
    sourceName: "서비스 기본 안전점검 템플릿",
  },
  {
    ruleId: "cnc-cover",
    equipmentCategory: "cnc",
    checkItem: "방호커버 파손 및 칩 비산 위험 확인",
    cycleMonths: 3,
    basisType: "manual",
    riskLevel: "medium",
    note: "커버 균열 및 고정상태 확인",
    sourceName: "설비 제조사 매뉴얼",
  },

  {
    ruleId: "inject-door",
    equipmentCategory: "injection",
    checkItem: "안전문 인터락 정상 작동 여부",
    cycleMonths: 1,
    basisType: "self_check",
    riskLevel: "high",
    note: "안전문 개방 시 동작 정지 여부 확인",
    sourceName: "서비스 기본 안전점검 템플릿",
  },
  {
    ruleId: "inject-heater",
    equipmentCategory: "injection",
    checkItem: "히터부 과열 및 냉각수 누수 여부",
    cycleMonths: 3,
    basisType: "manual",
    riskLevel: "medium",
    note: "온도 편차 및 누수 여부 확인",
    sourceName: "설비 제조사 매뉴얼",
  },
]

const inspectionHistories: InspectionHistory[] = [
  {
    equipmentId: "eq-press-a",
    ruleId: "press-sensor",
    lastCheckedAt: "2026-04-30",
    nextDueAt: "2026-05-30",
  },
  {
    equipmentId: "eq-press-a",
    ruleId: "press-emergency",
    lastCheckedAt: "2026-05-30",
    nextDueAt: "2026-06-30",
  },
  {
    equipmentId: "eq-press-a",
    ruleId: "press-two-hand",
    lastCheckedAt: "2026-05-20",
    nextDueAt: "2026-06-20",
  },
  {
    equipmentId: "eq-press-a",
    ruleId: "press-hydraulic",
    lastCheckedAt: "2026-04-10",
    nextDueAt: "2026-07-10",
  },

  {
    equipmentId: "eq-cnc-01",
    ruleId: "cnc-door",
    lastCheckedAt: "2026-06-01",
    nextDueAt: "2026-07-01",
  },
  {
    equipmentId: "eq-cnc-01",
    ruleId: "cnc-cover",
    lastCheckedAt: "2026-05-01",
    nextDueAt: "2026-08-01",
  },

  {
    equipmentId: "eq-injection-01",
    ruleId: "inject-door",
    lastCheckedAt: "2026-05-18",
    nextDueAt: "2026-06-18",
  },
  {
    equipmentId: "eq-injection-01",
    ruleId: "inject-heater",
    lastCheckedAt: "2026-04-28",
    nextDueAt: "2026-07-28",
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getToneColor(tone: Tone) {
  if (tone === "green") return colors.green
  if (tone === "orange") return colors.orange
  if (tone === "red") return colors.red
  if (tone === "gold") return colors.gold
  return colors.blue
}

function getToneSoftColor(tone: Tone) {
  if (tone === "green") return colors.greenSoft
  if (tone === "orange") return colors.orangeSoft
  if (tone === "red") return colors.redSoft
  if (tone === "gold") return colors.goldSoft
  return colors.blueSoft
}

function getBasisLabel(type: BasisType) {
  if (type === "law") return "법령근거"
  if (type === "official_guide") return "공식자료"
  if (type === "manual") return "제조사매뉴얼"
  return "자율점검"
}

function getBasisTone(type: BasisType): Tone {
  if (type === "law") return "red"
  if (type === "official_guide") return "blue"
  if (type === "manual") return "gold"
  return "green"
}

function getRiskLabel(level: RiskLevel) {
  if (level === "high") return "위험도 높음"
  if (level === "medium") return "위험도 보통"
  return "위험도 낮음"
}

function getRiskTone(level: RiskLevel): Tone {
  if (level === "high") return "red"
  if (level === "medium") return "gold"
  return "green"
}

function getCategoryLabel(category: EquipmentCategory) {
  if (category === "press") return "프레스"
  if (category === "cnc") return "CNC"
  return "사출성형기"
}

function formatDate(dateString: string) {
  const d = new Date(`${dateString}T00:00:00`)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}. ${m}. ${day}.`
}

function getDaysDiff(dateString: string) {
  const today = new Date()
  const target = new Date(`${dateString}T00:00:00`)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDdayLabel(dateString: string) {
  const diff = getDaysDiff(dateString)
  if (diff < 0) return `D+${Math.abs(diff)}`
  if (diff === 0) return "D-DAY"
  return `D-${diff}`
}

function getInspectionStatus(dateString: string): InspectionStatus {
  const diff = getDaysDiff(dateString)
  if (diff < 0) return "overdue"
  if (diff <= 30) return "due_soon"
  return "normal"
}

function getStatusMeta(status: InspectionStatus) {
  if (status === "overdue") {
    return {
      badgeText: "마감 초과",
      tone: "red" as Tone,
    }
  }
  if (status === "due_soon") {
    return {
      badgeText: "점검 임박",
      tone: "orange" as Tone,
    }
  }
  return {
    badgeText: "정상",
    tone: "green" as Tone,
  }
}

function getScoreGrade(score: number) {
  if (score <= 39) {
    return {
      label: "위험",
      range: "0 ~ 39",
      tone: "red" as Tone,
    }
  }
  if (score <= 59) {
    return {
      label: "주의",
      range: "40 ~ 59",
      tone: "orange" as Tone,
    }
  }
  if (score <= 79) {
    return {
      label: "관리 필요",
      range: "60 ~ 79",
      tone: "gold" as Tone,
    }
  }
  return {
    label: "양호",
    range: "80 ~ 100",
    tone: "green" as Tone,
  }
}

function buildInspectionTasks(
  equipmentId: string,
  category: EquipmentCategory,
): InspectionTask[] {
  const matchedRules = safetyRules.filter(
    (rule) => rule.equipmentCategory === category,
  )

  const mapped = matchedRules.map((rule, index) => {
    const history = inspectionHistories.find(
      (item) => item.equipmentId === equipmentId && item.ruleId === rule.ruleId,
    )

    const nextDueAt = history?.nextDueAt ?? "2026-07-30"
    const status = getInspectionStatus(nextDueAt)
    const statusMeta = getStatusMeta(status)

    return {
      id: `${equipmentId}-${rule.ruleId}`,
      order: index + 1,
      title: rule.checkItem,
      description: rule.note,
      basisType: rule.basisType,
      riskLevel: rule.riskLevel,
      nextDueAt,
      daysLabel: getDdayLabel(nextDueAt),
      status,
      tone: statusMeta.tone,
      badgeText: statusMeta.badgeText,
      note: rule.note,
      sourceName: rule.sourceName,
    }
  })

  const weight = {
    overdue: 0,
    due_soon: 1,
    normal: 2,
  }

  return mapped
    .sort((a, b) => {
      if (weight[a.status] !== weight[b.status]) {
        return weight[a.status] - weight[b.status]
      }

      if (a.riskLevel !== b.riskLevel) {
        const riskWeight = { high: 0, medium: 1, low: 2 }
        return riskWeight[a.riskLevel] - riskWeight[b.riskLevel]
      }

      return a.order - b.order
    })
    .map((item, idx) => ({
      ...item,
      order: idx + 1,
    }))
}

function Badge({
  tone,
  children,
}: {
  tone: Tone
  children: ReactNode
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "32px",
        padding: "0 14px",
        borderRadius: "999px",
        background: getToneSoftColor(tone),
        color: getToneColor(tone),
        fontSize: "12px",
        fontWeight: 900,
        letterSpacing: "-0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  )
}

function DonutChart({
  score,
  size = 210,
  tone = "orange",
  dark = false,
}: {
  score: number
  size?: number
  tone?: Tone
  dark?: boolean
}) {
  const degree = clamp(score, 0, 100) * 3.6
  const color = getToneColor(tone)

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: `conic-gradient(${color} 0deg ${degree}deg, ${
          dark ? "rgba(255,255,255,.18)" : colors.barTrack
        } ${degree}deg 360deg)`,
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: `${Math.round(size * 0.68)}px`,
          height: `${Math.round(size * 0.68)}px`,
          borderRadius: "50%",
          background: dark ? colors.navy : colors.white,
          border: dark
            ? "1px solid rgba(255,255,255,.15)"
            : `1px solid ${colors.line}`,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <strong
            style={{
              display: "block",
              color: dark ? "#EAF5EC" : color,
              fontSize: `${Math.round(size * 0.22)}px`,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            {score}
          </strong>
          <span
            style={{
              display: "block",
              marginTop: "6px",
              color: dark ? "rgba(255,255,255,.76)" : colors.muted,
              fontSize: `${Math.round(size * 0.07)}px`,
              fontWeight: 900,
            }}
          >
            /100
          </span>
        </div>
      </div>
    </div>
  )
}

function ScoreLegend() {
  const items = [
    { tone: "red" as Tone, label: "위험", range: "0 ~ 39%" },
    { tone: "orange" as Tone, label: "주의", range: "40 ~ 59%" },
    { tone: "gold" as Tone, label: "관리 필요", range: "60 ~ 79%" },
    { tone: "green" as Tone, label: "양호", range: "80 ~ 100%" },
  ]

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "12px",
        marginBottom: "20px",
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            border: `1px solid ${colors.line}`,
            borderRadius: "18px",
            background: colors.white,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              background: getToneColor(item.tone),
              flexShrink: 0,
            }}
          />
          <div>
            <strong
              style={{
                display: "block",
                color: colors.navy,
                fontSize: "13px",
                fontWeight: 900,
              }}
            >
              {item.label}
            </strong>
            <span
              style={{
                display: "block",
                marginTop: "2px",
                color: colors.muted,
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              {item.range}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatePanel({
  state,
  onBack,
}: {
  state: SafetyState
  onBack: () => void
}) {
  const meta = {
    loading: {
      tone: "blue" as Tone,
      title: "안전점검 데이터를 불러오는 중입니다.",
      desc: "설비 사용연수, 유지보수 이력, 불량률, 안전장치 상태를 기준으로 안전 리스크를 계산하고 있습니다.",
    },
    empty: {
      tone: "orange" as Tone,
      title: "안전점검 데이터가 아직 없습니다.",
      desc: "등록된 설비 또는 점검 이력이 없어도 화면이 깨지지 않도록 빈 상태 UI를 표시합니다.",
    },
    error: {
      tone: "red" as Tone,
      title: "안전점검 결과를 불러오지 못했습니다.",
      desc: "안전점검 API 또는 데이터 로딩 중 오류가 발생해도 화면은 유지됩니다. 잠시 후 다시 시도해주세요.",
    },
    success: {
      tone: "green" as Tone,
      title: "정상 상태입니다.",
      desc: "",
    },
  }[state]

  return (
    <section
      style={{
        marginTop: "24px",
        borderRadius: "28px",
        border: `1px solid ${getToneColor(meta.tone)}`,
        background: getToneSoftColor(meta.tone),
        padding: "36px",
      }}
    >
      <Badge tone={meta.tone}>{state.toUpperCase()}</Badge>
      <h3
        style={{
          margin: "18px 0 8px",
          color: colors.navy,
          fontSize: "30px",
          fontWeight: 900,
          lineHeight: 1.25,
          letterSpacing: "-0.04em",
        }}
      >
        {meta.title}
      </h3>
      <p
        style={{
          margin: 0,
          color: colors.muted,
          fontSize: "15px",
          fontWeight: 800,
          lineHeight: 1.8,
          maxWidth: "820px",
        }}
      >
        {meta.desc}
      </p>
      {state !== "loading" && (
        <button
          type="button"
          onClick={onBack}
          style={{
            marginTop: "20px",
            height: "48px",
            padding: "0 18px",
            borderRadius: "14px",
            border: "0",
            background: colors.blue,
            color: colors.white,
            fontSize: "14px",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          ROI 분석으로 이동
        </button>
      )}
    </section>
  )
}

function SectionCard({
  title,
  description,
  right,
  children,
}: {
  title: string
  description: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      style={{
        borderRadius: "32px",
        border: `1px solid ${colors.line}`,
        background: colors.white,
        boxShadow: colors.shadow,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "30px 32px 24px",
          borderBottom: `1px solid ${colors.lineSoft}`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: colors.navy,
              fontSize: "28px",
              lineHeight: 1.2,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: "10px 0 0",
              color: colors.muted,
              fontSize: "14px",
              lineHeight: 1.75,
              fontWeight: 800,
            }}
          >
            {description}
          </p>
        </div>
        {right}
      </div>

      <div style={{ padding: "28px 32px 32px" }}>{children}</div>
    </section>
  )
}

export default function SafetyPage() {
  const navigate = useNavigate()

  const [selectedEquipmentId, setSelectedEquipmentId] = useState("eq-press-a")
  const [showRiskSection, setShowRiskSection] = useState(true)
  const [showPrioritySection, setShowPrioritySection] = useState(true)
  const [bottomOpen, setBottomOpen] = useState<BottomAccordionKey>(null)

  const selectedEquipment =
    equipmentList.find((item) => item.equipmentId === selectedEquipmentId) ??
    equipmentList[0]

  const summary = dashboardSummaryMap[selectedEquipment.equipmentId]
  const riskMetrics = riskMetricMap[selectedEquipment.equipmentId] ?? []
  const tasks = useMemo(
    () =>
      buildInspectionTasks(
        selectedEquipment.equipmentId,
        selectedEquipment.category,
      ),
    [selectedEquipment],
  )

  const nextTask = tasks[0]
  const grade = getScoreGrade(summary.score)

  if (TEST_SAFETY_STATE !== "success") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: colors.page,
          padding: "36px 24px 80px",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <button
            type="button"
                  onClick={() => navigate("/dashboard")}
            style={{
              height: "44px",
              padding: "0 18px",
              borderRadius: "999px",
              border: `1px solid ${colors.line}`,
              background: colors.white,
              color: colors.navy,
              fontSize: "14px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(6,27,52,.06)",
            }}
          >
            ← 대시보드로 돌아가기
          </button>

          <StatePanel
            state={TEST_SAFETY_STATE}
            onBack={() => navigate("/roi")}
          />
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.page,
        padding: "36px 24px 80px",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <button
          type="button"
                  onClick={() => navigate("/dashboard")}
          style={{
            height: "44px",
            padding: "0 18px",
            borderRadius: "999px",
            border: `1px solid ${colors.line}`,
            background: colors.white,
            color: colors.navy,
            fontSize: "14px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(6,27,52,.06)",
            marginBottom: "28px",
          }}
        >
          ← 대시보드로 돌아가기
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: "26px",
            alignItems: "end",
            marginBottom: "26px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "40px",
                padding: "0 18px",
                borderRadius: "999px",
                background: colors.navy,
                color: colors.white,
                fontSize: "13px",
                fontWeight: 900,
                letterSpacing: "0.08em",
                marginBottom: "18px",
              }}
            >
              FACTOFIT SAFETY CHECK
            </div>

            <div
              style={{
                color: colors.blue,
                fontSize: "14px",
                fontWeight: 900,
                letterSpacing: "0.22em",
                marginBottom: "12px",
              }}
            >
              EQUIPMENT SAFETY
            </div>

            <h1
              style={{
                margin: 0,
                color: colors.navy,
                fontSize: "58px",
                lineHeight: 1.08,
                fontWeight: 900,
                letterSpacing: "-0.06em",
              }}
            >
              설비별 안전 리스크와 <br />
              다음 점검일을 확인합니다.
            </h1>

            <p
              style={{
                margin: "20px 0 0",
                color: colors.muted,
                fontSize: "16px",
                lineHeight: 1.8,
                fontWeight: 800,
                maxWidth: "760px",
              }}
            >
              회사가 등록한 설비를 기준으로 safety_rule과 점검 이력을 매칭해
              안전점수, 우선 점검 항목, 교체 검토 사유를 한눈에 보여줍니다.
            </p>
          </div>

          <div
            style={{
              borderRadius: "28px",
              border: `1px solid ${colors.line}`,
              background: colors.white,
              boxShadow: colors.shadow,
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    color: colors.navy,
                    fontSize: "20px",
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {companyProfile.companyName}
                </strong>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: colors.muted,
                    fontSize: "13px",
                    fontWeight: 800,
                    lineHeight: 1.7,
                  }}
                >
                  {companyProfile.industryName}
                  <br />
                  {companyProfile.region} · {companyProfile.employeeCount}명
                </p>
              </div>

              <Badge tone="blue">{companyProfile.industryCode}</Badge>
            </div>
          </div>
        </div>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.08fr) minmax(360px, .92fr)",
            gap: "24px",
            alignItems: "stretch",
            marginBottom: "28px",
          }}
        >
          <article
            style={{
              borderRadius: "36px",
              background: colors.navy,
              color: colors.white,
              boxShadow: colors.shadow,
              borderTop: `4px solid ${colors.gold}`,
              padding: "34px 32px 30px",
              display: "grid",
              gridTemplateRows: "auto auto 1fr auto",
              minHeight: "760px",
            }}
          >
            <div>
              <Badge tone="gold">{summary.statusLabel}</Badge>
            </div>

            <div style={{ marginTop: "22px" }}>
              <h2
                style={{
                  margin: 0,
                  color: colors.white,
                  fontSize: "68px",
                  lineHeight: 1.02,
                  fontWeight: 900,
                  letterSpacing: "-0.07em",
                }}
              >
                {selectedEquipment.name}의
                <br />
                안전 점수는
              </h2>

              <div
                style={{
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <strong
                  style={{
                    color: "#D2F0D8",
                    fontSize: "92px",
                    lineHeight: 0.95,
                    fontWeight: 900,
                    letterSpacing: "-0.08em",
                  }}
                >
                  {summary.score}
                </strong>
                <span
                  style={{
                    color: colors.white,
                    fontSize: "68px",
                    lineHeight: 1,
                    fontWeight: 900,
                    letterSpacing: "-0.06em",
                  }}
                >
                  점입니다.
                </span>
              </div>

              <p
                style={{
                  margin: "18px 0 0",
                  color: "rgba(255,255,255,.88)",
                  fontSize: "16px",
                  lineHeight: 1.8,
                  fontWeight: 800,
                  maxWidth: "760px",
                }}
              >
                {summary.summary}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                placeItems: "center",
                padding: "18px 0 8px",
              }}
            >
              <DonutChart
                score={summary.score}
                tone={grade.tone}
                size={240}
                dark
              />
            </div>

            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 60px",
                  alignItems: "center",
                  gap: "14px",
                  marginBottom: "26px",
                }}
              >
                <strong
                  style={{
                    color: colors.white,
                    fontSize: "18px",
                    fontWeight: 900,
                  }}
                >
                  안전 점수
                </strong>

                <div
                  style={{
                    width: "100%",
                    height: "16px",
                    background: colors.heroTrack,
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <i
                    style={{
                      display: "block",
                      width: `${summary.score}%`,
                      height: "100%",
                      background: getToneColor(grade.tone),
                      borderRadius: "999px",
                    }}
                  />
                </div>

                <strong
                  style={{
                    color: colors.white,
                    fontSize: "20px",
                    fontWeight: 900,
                    textAlign: "right",
                  }}
                >
                  {summary.score}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate("/roi")}
                  style={{
                    height: "54px",
                    padding: "0 24px",
                    borderRadius: "16px",
                    border: 0,
                    background: colors.white,
                    color: colors.navy,
                    fontSize: "15px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  ROI 분석으로 연결
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/support-projects")}
                  style={{
                    height: "54px",
                    padding: "0 24px",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,.24)",
                    background: "transparent",
                    color: colors.white,
                    fontSize: "15px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  지원사업 보기
                </button>
              </div>
            </div>
          </article>

          <div
            style={{
              display: "grid",
              gridTemplateRows: "auto auto 1fr",
              gap: "18px",
            }}
          >
            <article
              style={{
                borderRadius: "28px",
                border: `1px solid ${colors.line}`,
                background: colors.white,
                boxShadow: colors.shadow,
                padding: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: colors.navy,
                      fontSize: "24px",
                      fontWeight: 900,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    다음 점검 마감일
                  </h3>
                  <p
                    style={{
                      margin: "8px 0 0",
                      color: colors.muted,
                      fontSize: "13px",
                      fontWeight: 800,
                      lineHeight: 1.7,
                    }}
                  >
                    {nextTask.title} 항목을 먼저 확인해주세요.
                  </p>
                </div>

                <Badge tone={nextTask.tone}>{nextTask.daysLabel}</Badge>
              </div>

              <div style={{ marginTop: "18px" }}>
                <strong
                  style={{
                    display: "block",
                    color: colors.navy,
                    fontSize: "34px",
                    lineHeight: 1.1,
                    fontWeight: 900,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {formatDate(nextTask.nextDueAt)}
                </strong>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: colors.muted,
                    fontSize: "13px",
                    lineHeight: 1.7,
                    fontWeight: 800,
                  }}
                >
                  마감일 기준으로 우선순위를 정렬합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const section = document.getElementById("priority-section")
                  if (section) {
                    section.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                }}
                style={{
                  marginTop: "18px",
                  height: "48px",
                  padding: "0 18px",
                  borderRadius: "14px",
                  border: 0,
                  background: getToneColor(nextTask.tone),
                  color: colors.white,
                  fontSize: "14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                우선순위 보기
              </button>
            </article>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "14px",
              }}
            >
              {[
                {
                  label: "정상 항목",
                  count: summary.normalCount,
                  tone: "green" as Tone,
                },
                {
                  label: "주의 항목",
                  count: summary.cautionCount,
                  tone: "orange" as Tone,
                },
                {
                  label: "위험 항목",
                  count: summary.dangerCount,
                  tone: "red" as Tone,
                },
              ].map((item) => (
                <article
                  key={item.label}
                  style={{
                    borderRadius: "24px",
                    border: `1px solid ${colors.line}`,
                    borderTop: `4px solid ${getToneColor(item.tone)}`,
                    background: colors.white,
                    boxShadow: colors.shadow,
                    padding: "20px 18px",
                    minHeight: "146px",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      color: colors.muted,
                      fontSize: "13px",
                      fontWeight: 900,
                    }}
                  >
                    {item.label}
                  </span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: "10px",
                      color: getToneColor(item.tone),
                      fontSize: "54px",
                      lineHeight: 1,
                      fontWeight: 900,
                      letterSpacing: "-0.06em",
                    }}
                  >
                    {item.count}
                  </strong>
                </article>
              ))}
            </div>

            <article
              style={{
                borderRadius: "28px",
                border: `1px solid ${colors.line}`,
                background: colors.white,
                boxShadow: colors.shadow,
                padding: "24px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: colors.navy,
                  fontSize: "24px",
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                }}
              >
                등록 설비 선택
              </h3>
              <p
                style={{
                  margin: "8px 0 0",
                  color: colors.muted,
                  fontSize: "13px",
                  lineHeight: 1.7,
                  fontWeight: 800,
                }}
              >
                설비를 선택하면 해당 설비의 안전점검 규칙과 점검 우선순위가 다시
                계산됩니다.
              </p>

              <div
                style={{
                  marginTop: "18px",
                  display: "grid",
                  gap: "12px",
                }}
              >
                {equipmentList.map((item) => {
                  const active = item.equipmentId === selectedEquipmentId
                  const ruleCount = safetyRules.filter(
                    (rule) => rule.equipmentCategory === item.category,
                  ).length

                  return (
                    <button
                      key={item.equipmentId}
                      type="button"
                      onClick={() => setSelectedEquipmentId(item.equipmentId)}
                      style={{
                        textAlign: "left",
                        borderRadius: "18px",
                        border: `1px solid ${
                          active ? colors.blue : colors.line
                        }`,
                        background: active ? colors.blueSoft : colors.white,
                        padding: "16px",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "12px",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: "block",
                              color: colors.navy,
                              fontSize: "16px",
                              fontWeight: 900,
                            }}
                          >
                            {item.name}
                          </strong>
                          <span
                            style={{
                              display: "block",
                              marginTop: "4px",
                              color: colors.muted,
                              fontSize: "12px",
                              fontWeight: 800,
                            }}
                          >
                            {getCategoryLabel(item.category)} · {item.ageYears}년
                            사용 · 규칙 {ruleCount}개
                          </span>
                        </div>

                        <Badge tone={active ? "blue" : "green"}>
                          {active ? "선택됨" : "보기"}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </article>
          </div>
        </section>

        <div id="risk-section" style={{ marginBottom: "28px" }}>
          <SectionCard
            title="안전 리스크 항목별 진단"
            description="원그래프와 막대그래프로 어떤 항목이 안전 리스크를 높이는지 확인합니다."
            right={
              <button
                type="button"
                onClick={() => setShowRiskSection((prev) => !prev)}
                style={{
                  height: "64px",
                  minWidth: "88px",
                  padding: "0 20px",
                  borderRadius: "18px",
                  border: `1px solid ${colors.line}`,
                  background: colors.white,
                  color: colors.navy,
                  fontSize: "14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {showRiskSection ? "닫기" : "열기"}
              </button>
            }
          >
            {showRiskSection && (
              <>
                <ScoreLegend />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                    gap: "14px",
                    marginBottom: "28px",
                  }}
                >
                  {riskMetrics.map((metric) => (
                    <article
                      key={metric.label}
                      style={{
                        borderRadius: "22px",
                        border: `1px solid ${colors.line}`,
                        background: colors.white,
                        padding: "18px 16px",
                        boxShadow: "0 10px 24px rgba(6,27,52,.035)",
                        textAlign: "center",
                        borderTop: `4px solid ${getToneColor(metric.tone)}`,
                        minHeight: "270px",
                        display: "grid",
                        gridTemplateRows: "auto auto auto",
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <DonutChart
                          score={metric.score}
                          tone={metric.tone}
                          size={130}
                        />
                      </div>

                      <div
                        style={{
                          marginTop: "12px",
                          minHeight: "52px",
                          display: "grid",
                          alignContent: "center",
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            color: colors.navy,
                            fontSize: "17px",
                            lineHeight: 1.3,
                            fontWeight: 900,
                            letterSpacing: "-0.03em",
                          }}
                        >
                          {metric.label}
                        </strong>
                      </div>

                      <span
                        style={{
                          display: "block",
                          marginTop: "4px",
                          color: getToneColor(metric.tone),
                          fontSize: "13px",
                          lineHeight: 1.4,
                          fontWeight: 900,
                        }}
                      >
                        {metric.value}
                      </span>
                    </article>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "18px",
                  }}
                >
                  {riskMetrics.map((metric) => (
                    <article
                      key={metric.label}
                      style={{
                        borderRadius: "24px",
                        border: `1px solid ${colors.line}`,
                        background: colors.white,
                        boxShadow: "0 10px 24px rgba(6,27,52,.035)",
                        padding: "22px 20px",
                        borderLeft: `5px solid ${getToneColor(metric.tone)}`,
                        minHeight: "178px",
                        display: "grid",
                        gridTemplateRows: "auto auto 1fr",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "14px",
                          alignItems: "center",
                        }}
                      >
                        <strong
                          style={{
                            color: colors.navy,
                            fontSize: "18px",
                            fontWeight: 900,
                          }}
                        >
                          {metric.label}
                        </strong>

                        <strong
                          style={{
                            color: getToneColor(metric.tone),
                            fontSize: "26px",
                            fontWeight: 900,
                          }}
                        >
                          {metric.score}
                        </strong>
                      </div>

                      <div
                        style={{
                          marginTop: "16px",
                          width: "100%",
                          height: "14px",
                          background: colors.barTrack,
                          borderRadius: "999px",
                          overflow: "hidden",
                        }}
                      >
                        <i
                          style={{
                            display: "block",
                            width: `${metric.score}%`,
                            height: "100%",
                            background: getToneColor(metric.tone),
                            borderRadius: "999px",
                          }}
                        />
                      </div>

                      <p
                        style={{
                          margin: "16px 0 0",
                          color: colors.muted,
                          fontSize: "14px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                        }}
                      >
                        {metric.description}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        </div>

        <div id="priority-section" style={{ marginBottom: "28px" }}>
          <SectionCard
            title="점검 우선순위"
            description="설비 카테고리와 안전점검 규칙을 매칭해 먼저 확인해야 할 항목부터 정렬합니다."
            right={
              <button
                type="button"
                onClick={() => setShowPrioritySection((prev) => !prev)}
                style={{
                  height: "64px",
                  minWidth: "88px",
                  padding: "0 20px",
                  borderRadius: "18px",
                  border: `1px solid ${colors.line}`,
                  background: colors.white,
                  color: colors.navy,
                  fontSize: "14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {showPrioritySection ? "닫기" : "열기"}
              </button>
            }
          >
            {showPrioritySection && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "18px",
                }}
              >
                {tasks.map((task) => (
                  <article
                    key={task.id}
                    style={{
                      borderRadius: "24px",
                      border: `1px solid ${colors.line}`,
                      background: colors.white,
                      boxShadow: "0 10px 24px rgba(6,27,52,.035)",
                      borderTop: `5px solid ${getToneColor(task.tone)}`,
                      padding: "20px",
                      minHeight: "405px",
                      display: "grid",
                      gridTemplateRows: "auto auto auto 1fr auto",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        alignItems: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <span
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "#F8F1E8",
                          color: colors.orange,
                          display: "grid",
                          placeItems: "center",
                          fontSize: "15px",
                          fontWeight: 500,
                        }}
                      >
                        {String(task.order).padStart(2, "0")}
                      </span>

                      <Badge tone={task.tone}>{task.badgeText}</Badge>
                    </div>

                    <div
                      style={{
                        minHeight: "88px",
                        display: "grid",
                        alignContent: "start",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          color: colors.navy,
                          fontSize: "20px",
                          lineHeight: 1.28,
                          fontWeight: 900,
                          letterSpacing: "-0.04em",
                        }}
                      >
                        {task.title}
                      </h4>
                    </div>

                    <div
                      style={{
                        minHeight: "54px",
                        display: "grid",
                        alignContent: "start",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: colors.muted,
                          fontSize: "13px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                        }}
                      >
                        {task.description}
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "10px",
                        alignContent: "start",
                        marginTop: "16px",
                      }}
                    >
                      <div>
                        <Badge tone={getBasisTone(task.basisType)}>
                          {getBasisLabel(task.basisType)}
                        </Badge>
                      </div>
                      <div>
                        <Badge tone={getRiskTone(task.riskLevel)}>
                          {getRiskLabel(task.riskLevel)}
                        </Badge>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "18px",
                        paddingTop: "16px",
                        borderTop: `1px solid ${colors.lineSoft}`,
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: colors.muted,
                          fontSize: "12px",
                          fontWeight: 900,
                          marginBottom: "6px",
                        }}
                      >
                        다음 점검일
                      </span>
                      <strong
                        style={{
                          display: "block",
                          color: getToneColor(task.tone),
                          fontSize: "18px",
                          lineHeight: 1.4,
                          fontWeight: 900,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {formatDate(task.nextDueAt)} · {task.daysLabel}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "18px",
            marginBottom: "28px",
            alignItems: "start",
          }}
        >
          <section
            style={{
              borderRadius: "30px",
              border: `1px solid ${colors.line}`,
              background: colors.white,
              boxShadow: colors.shadow,
              overflow: "hidden",
              alignSelf: "start",
            }}
          >
            <div
              style={{
                padding: "28px 30px",
                display: "flex",
                justifyContent: "space-between",
                gap: "18px",
                alignItems: "flex-start",
                borderBottom:
                  bottomOpen === "replace"
                    ? `1px solid ${colors.lineSoft}`
                    : "0",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: colors.navy,
                    fontSize: "26px",
                    fontWeight: 900,
                    lineHeight: 1.2,
                    letterSpacing: "-0.04em",
                  }}
                >
                  설비 교체 검토 사유
                </h3>
                <p
                  style={{
                    margin: "10px 0 0",
                    color: colors.muted,
                    fontSize: "14px",
                    lineHeight: 1.7,
                    fontWeight: 800,
                  }}
                >
                  안전 리스크가 설비투자 검토로 연결되는 이유입니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setBottomOpen((prev) =>
                    prev === "replace" ? null : "replace",
                  )
                }
                style={{
                  height: "64px",
                  minWidth: "92px",
                  padding: "0 20px",
                  borderRadius: "18px",
                  border: `1px solid ${colors.line}`,
                  background: colors.white,
                  color: colors.navy,
                  fontSize: "14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {bottomOpen === "replace" ? "닫기" : "열기"}
              </button>
            </div>

            {bottomOpen === "replace" && (
              <div style={{ padding: "28px 30px 30px" }}>
                <div
                  style={{
                    display: "grid",
                    gap: "18px",
                  }}
                >
                  {[
                    {
                      label: "사용연수",
                      value: `${selectedEquipment.ageYears}년`,
                      desc: "평균 교체주기 또는 정밀점검 권고 구간에 진입했습니다.",
                      tone: "gold" as Tone,
                    },
                    {
                      label: "불량률",
                      value: `${selectedEquipment.defectRate}%`,
                      desc: "품질 안정성 저하와 안전 리스크를 함께 고려해야 합니다.",
                      tone: "gold" as Tone,
                    },
                    {
                      label: "안전장치",
                      value: selectedEquipment.safetyDeviceStatus,
                      desc: "방호장치와 센서 상태가 투자 검토 근거가 될 수 있습니다.",
                      tone:
                        selectedEquipment.safetyDeviceStatus === "양호"
                          ? ("green" as Tone)
                          : ("red" as Tone),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        borderRadius: "20px",
                        border: `1px solid ${colors.line}`,
                        background: colors.white,
                        padding: "18px 20px",
                        display: "grid",
                        gridTemplateColumns: "140px 140px 1fr",
                        gap: "16px",
                        alignItems: "center",
                      }}
                    >
                      <strong
                        style={{
                          color: colors.navy,
                          fontSize: "16px",
                          fontWeight: 900,
                        }}
                      >
                        {item.label}
                      </strong>

                      <Badge tone={item.tone}>{item.value}</Badge>

                      <p
                        style={{
                          margin: 0,
                          color: colors.muted,
                          fontSize: "14px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                        }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginTop: "22px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate("/roi")}
                    style={{
                      height: "54px",
                      padding: "0 24px",
                      borderRadius: "16px",
                      border: 0,
                      background: colors.blue,
                      color: colors.white,
                      fontSize: "15px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    ROI 분석으로 이동
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/application-draft")}
                    style={{
                      height: "54px",
                      padding: "0 24px",
                      borderRadius: "16px",
                      border: `1px solid ${colors.line}`,
                      background: colors.white,
                      color: colors.navy,
                      fontSize: "15px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    신청서 초안 만들기
                  </button>
                </div>
              </div>
            )}
          </section>

          <section
            style={{
              borderRadius: "30px",
              border: `1px solid ${colors.line}`,
              background: colors.white,
              boxShadow: colors.shadow,
              overflow: "hidden",
              alignSelf: "start",
            }}
          >
            <div
              style={{
                padding: "28px 30px",
                display: "flex",
                justifyContent: "space-between",
                gap: "18px",
                alignItems: "flex-start",
                borderBottom:
                  bottomOpen === "db" ? `1px solid ${colors.lineSoft}` : "0",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: colors.navy,
                    fontSize: "26px",
                    fontWeight: 900,
                    lineHeight: 1.2,
                    letterSpacing: "-0.04em",
                  }}
                >
                  DB 근거 매칭 구조
                </h3>
                <p
                  style={{
                    margin: "10px 0 0",
                    color: colors.muted,
                    fontSize: "14px",
                    lineHeight: 1.7,
                    fontWeight: 800,
                  }}
                >
                  실제 연동 시 safety_rule과 safety_inspection에서 가져올
                  정보입니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setBottomOpen((prev) => (prev === "db" ? null : "db"))
                }
                style={{
                  height: "64px",
                  minWidth: "92px",
                  padding: "0 20px",
                  borderRadius: "18px",
                  border: `1px solid ${colors.line}`,
                  background: colors.white,
                  color: colors.navy,
                  fontSize: "14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {bottomOpen === "db" ? "닫기" : "열기"}
              </button>
            </div>

            {bottomOpen === "db" && (
              <div style={{ padding: "28px 30px 30px" }}>
                <div
                  style={{
                    display: "grid",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      borderRadius: "20px",
                      border: `1px solid ${colors.line}`,
                      background: "#FBFCFE",
                      padding: "18px 20px",
                    }}
                  >
                    <Badge tone="blue">safety_rule</Badge>
                    <p
                      style={{
                        margin: "12px 0 0",
                        color: colors.muted,
                        fontSize: "14px",
                        lineHeight: 1.75,
                        fontWeight: 800,
                      }}
                    >
                      rule_id, equipment_category, inspection_type, check_item,
                      cycle_months, risk_level, basis_type, legal_basis,
                      legal_article, source_name, source_url, evidence_text,
                      note
                    </p>
                  </div>

                  <div
                    style={{
                      borderRadius: "20px",
                      border: `1px solid ${colors.line}`,
                      background: "#FBFCFE",
                      padding: "18px 20px",
                    }}
                  >
                    <Badge tone="green">safety_inspection</Badge>
                    <p
                      style={{
                        margin: "12px 0 0",
                        color: colors.muted,
                        fontSize: "14px",
                        lineHeight: 1.75,
                        fontWeight: 800,
                      }}
                    >
                      inspection_id, company_id, equipment_id, rule_id,
                      last_checked_at, next_due_at, status, assignee,
                      evidence_file_url, memo
                    </p>
                  </div>

                  <div
                    style={{
                      borderRadius: "20px",
                      border: `1px solid ${colors.line}`,
                      background: "#FBFCFE",
                      padding: "18px 20px",
                    }}
                  >
                    <Badge tone="orange">표시 원칙</Badge>
                    <p
                      style={{
                        margin: "12px 0 0",
                        color: colors.muted,
                        fontSize: "14px",
                        lineHeight: 1.75,
                        fontWeight: 800,
                      }}
                    >
                      법령 조항이 직접 확인되지 않은 항목은 “법정점검”으로
                      단정하지 않고, “공식자료”, “제조사매뉴얼”, “자율점검”
                      배지로 구분합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <SectionCard
          title="선택 설비 기준 매칭된 점검 항목"
          description={`${selectedEquipment.name}에 적용된 안전점검 규칙입니다. 실제 서비스에서는 이 항목을 DB에서 조회해 표시하면 됩니다.`}
        >
          <div
            style={{
              borderRadius: "24px",
              border: `1px solid ${colors.line}`,
              overflow: "hidden",
            }}
          >
            {tasks.map((task, index) => (
              <div
                key={task.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1.3fr 1fr 160px 120px",
                  gap: "14px",
                  alignItems: "center",
                  padding: "18px 20px",
                  borderTop: index === 0 ? "0" : `1px solid ${colors.lineSoft}`,
                  background: index % 2 === 0 ? colors.white : "#FBFCFE",
                }}
              >
                <strong
                  style={{
                    color: colors.blue,
                    fontSize: "14px",
                    fontWeight: 900,
                  }}
                >
                  {String(task.order).padStart(2, "0")}
                </strong>

                <strong
                  style={{
                    color: colors.navy,
                    fontSize: "14px",
                    fontWeight: 900,
                    lineHeight: 1.5,
                  }}
                >
                  {task.title}
                </strong>

                <span
                  style={{
                    color: colors.muted,
                    fontSize: "13px",
                    fontWeight: 800,
                    lineHeight: 1.5,
                  }}
                >
                  {task.sourceName}
                </span>

                <div>
                  <Badge tone={getBasisTone(task.basisType)}>
                    {getBasisLabel(task.basisType)}
                  </Badge>
                </div>

                <div>
                  <Badge tone={task.tone}>{task.daysLabel}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </main>
  )
}
