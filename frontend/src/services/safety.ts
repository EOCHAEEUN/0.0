import { apiFetch } from "./apiClient"

export type BasisType = "law" | "official_guide" | "manual" | "self_check"
export type SafetyStatus = "normal" | "warning" | "danger"

export type SafetyRule = {
  rule_id: string
  equipment_category: string
  equipment_name_keywords: string[]
  inspection_type: string
  check_item: string
  cycle_months: number
  risk_level: "low" | "medium" | "high" | "critical"
  legal_basis?: string | null
  source_url?: string | null
  note?: string | null
  basis_type: BasisType
  legal_article?: string | null
  source_name?: string | null
  evidence_text?: string | null
}

export type SafetyInspection = {
  inspection_id: string
  company_id: string
  equipment_id: string
  rule_id: string
  last_checked_at?: string | null
  next_due_at?: string | null
  status?: string | null
  computed_status?: SafetyStatus
  assignee?: string | null
  evidence_file_url?: string | null
  memo?: string | null
  days_left?: number
}

export type SafetyRiskFactor = {
  key: string
  label: string
  score: number
  status: SafetyStatus
  reason: string
}

export type SafetyDashboardItem = {
  equipment_id: string
  equipment_name: string
  equipment_category: string
  age_years: number
  safety_score: number
  status: SafetyStatus
  priority_rank: number
  priority_score: number
  replacement_reasons: string[]
  risk_factors: SafetyRiskFactor[]
  rules: SafetyRule[]
  inspections: SafetyInspection[]
}

export type SafetyDashboard = {
  company_id: string
  summary: {
    average_score: number
    normal_count: number
    warning_count: number
    danger_count: number
    total_rules: number
    overdue_count: number
  }
  items: SafetyDashboardItem[]
}

export const mockSafetyDashboard: SafetyDashboard = {
  company_id: "demo-company-001",
  summary: {
    average_score: 45,
    normal_count: 1,
    warning_count: 1,
    danger_count: 1,
    total_rules: 7,
    overdue_count: 2,
  },
  items: [
    {
      equipment_id: "demo-equipment-press-001",
      equipment_name: "유압프레스 250톤",
      equipment_category: "press",
      age_years: 15,
      safety_score: 18,
      status: "danger",
      priority_rank: 1,
      priority_score: 82,
      replacement_reasons: [
        "설비 사용연수 15년으로 정밀점검 또는 교체 ROI 검토가 필요합니다.",
        "기한이 지난 안전점검 항목이 있어 사고 리스크와 생산중단 리스크가 커졌습니다.",
      ],
      risk_factors: [
        { key: "equipment_age", label: "설비 사용연수", score: 90, status: "danger", reason: "15년 사용 설비입니다." },
        { key: "maintenance_history", label: "유지보수 이력", score: 78, status: "danger", reason: "지연 1건, 임박 1건 기준입니다." },
        { key: "defect_trend", label: "불량률 변화", score: 61, status: "warning", reason: "최근 불량률 3.4% 기준입니다." },
        { key: "safety_device", label: "안전장치 상태", score: 84, status: "danger", reason: "방호장치와 비상정지장치 점검이 필요합니다." },
        { key: "worker_safety", label: "작업자 안전", score: 55, status: "warning", reason: "신규 작업자 교육이 예정되어 있습니다." },
      ],
      rules: [
        {
          rule_id: "safety-rule-press-guard-001",
          equipment_category: "press",
          equipment_name_keywords: ["유압프레스", "프레스"],
          inspection_type: "방호장치 점검",
          check_item: "양수조작식 방호장치, 광전자식 방호장치, 비상정지장치 작동 상태 확인",
          cycle_months: 1,
          risk_level: "critical",
          legal_basis: "산업안전보건기준에 관한 규칙의 프레스 및 전단기 방호조치 취지",
          source_url: "https://www.law.go.kr/",
          note: "법령 조항은 운영 전 최종 확인이 필요합니다.",
          basis_type: "law",
          legal_article: "산업안전보건기준에 관한 규칙: 프레스 등 방호조치 관련 조항",
          source_name: "국가법령정보센터",
          evidence_text: "프레스 작업 위험점에 접근하지 않도록 방호장치를 설치하고 정상 작동을 확인해야 한다는 취지의 기준입니다.",
        },
        {
          rule_id: "safety-rule-press-hydraulic-002",
          equipment_category: "press",
          equipment_name_keywords: ["유압", "압력계"],
          inspection_type: "유압계통 점검",
          check_item: "유압 누유, 압력계, 배관, 실린더 이상 여부 확인",
          cycle_months: 3,
          risk_level: "high",
          legal_basis: "KOSHA 프레스 작업 안전 관련 기술자료",
          source_url: "https://www.kosha.or.kr/",
          note: "공식자료 참고 항목이며 법정점검으로 단정하지 않습니다.",
          basis_type: "official_guide",
          legal_article: null,
          source_name: "한국산업안전보건공단",
          evidence_text: "유압계통 이상은 끼임 및 낙하 위험으로 이어질 수 있어 정기 확인이 필요합니다.",
        },
      ],
      inspections: [
        {
          inspection_id: "safety-inspection-press-guard-001",
          company_id: "demo-company-001",
          equipment_id: "demo-equipment-press-001",
          rule_id: "safety-rule-press-guard-001",
          last_checked_at: "2026-05-15",
          next_due_at: "2026-06-15",
          status: "warning",
          computed_status: "warning",
          assignee: "생산1팀 김대리",
          memo: "광전자식 방호장치 반응 속도 재확인 필요",
          days_left: 4,
        },
        {
          inspection_id: "safety-inspection-press-hydraulic-002",
          company_id: "demo-company-001",
          equipment_id: "demo-equipment-press-001",
          rule_id: "safety-rule-press-hydraulic-002",
          last_checked_at: "2026-03-01",
          next_due_at: "2026-06-01",
          status: "overdue",
          computed_status: "danger",
          assignee: "보전팀 박과장",
          memo: "실린더 하부 미세 누유 의심",
          days_left: -10,
        },
      ],
    },
    {
      equipment_id: "demo-equipment-injection-001",
      equipment_name: "전동식 사출성형기 450톤",
      equipment_category: "injection",
      age_years: 12,
      safety_score: 42,
      status: "warning",
      priority_rank: 2,
      priority_score: 58,
      replacement_reasons: ["안전문 인터록 점검 지연으로 예방점검 우선순위가 높습니다."],
      risk_factors: [
        { key: "equipment_age", label: "설비 사용연수", score: 72, status: "danger", reason: "12년 사용 설비입니다." },
        { key: "maintenance_history", label: "유지보수 이력", score: 54, status: "warning", reason: "지연 1건 기준입니다." },
        { key: "defect_trend", label: "불량률 변화", score: 50, status: "warning", reason: "최근 불량률 2.8% 기준입니다." },
        { key: "safety_device", label: "안전장치 상태", score: 58, status: "warning", reason: "안전문 인터록 확인이 필요합니다." },
        { key: "worker_safety", label: "작업자 안전", score: 38, status: "normal", reason: "작업표준서 개정 예정입니다." },
      ],
      rules: [
        {
          rule_id: "safety-rule-injection-door-001",
          equipment_category: "injection",
          equipment_name_keywords: ["사출성형기", "도어"],
          inspection_type: "안전문 및 인터록 점검",
          check_item: "안전문 인터록, 금형 구역 접근 차단, 비상정지 버튼 작동 상태 확인",
          cycle_months: 1,
          risk_level: "high",
          legal_basis: "KOSHA 기계설비 끼임 위험 예방 자료 참고",
          source_url: "https://www.kosha.or.kr/",
          note: "직접 법령 조항 미확인. 공식자료 참고 항목으로 표시합니다.",
          basis_type: "official_guide",
          legal_article: null,
          source_name: "한국산업안전보건공단",
          evidence_text: "금형 개폐부 접근 시 끼임 위험이 있어 안전문과 인터록 상태 확인이 필요합니다.",
        },
      ],
      inspections: [
        {
          inspection_id: "safety-inspection-injection-door-001",
          company_id: "demo-company-001",
          equipment_id: "demo-equipment-injection-001",
          rule_id: "safety-rule-injection-door-001",
          last_checked_at: "2026-04-20",
          next_due_at: "2026-05-20",
          status: "overdue",
          computed_status: "danger",
          assignee: "성형팀 최주임",
          memo: "안전문 닫힘 센서 점검 필요",
          days_left: -22,
        },
      ],
    },
    {
      equipment_id: "demo-equipment-cnc-001",
      equipment_name: "CNC 머시닝센터 5축",
      equipment_category: "cnc",
      age_years: 9,
      safety_score: 76,
      status: "normal",
      priority_rank: 3,
      priority_score: 24,
      replacement_reasons: ["현재는 교체보다 예방점검 주기 준수가 우선입니다."],
      risk_factors: [
        { key: "equipment_age", label: "설비 사용연수", score: 54, status: "warning", reason: "9년 사용 설비입니다." },
        { key: "maintenance_history", label: "유지보수 이력", score: 12, status: "normal", reason: "기한 지연 항목이 없습니다." },
        { key: "defect_trend", label: "불량률 변화", score: 28, status: "normal", reason: "최근 불량률 1.6% 기준입니다." },
        { key: "safety_device", label: "안전장치 상태", score: 36, status: "normal", reason: "도어 인터록은 정상입니다." },
        { key: "worker_safety", label: "작업자 안전", score: 25, status: "normal", reason: "정기교육 완료 상태입니다." },
      ],
      rules: [
        {
          rule_id: "safety-rule-cnc-interlock-001",
          equipment_category: "cnc",
          equipment_name_keywords: ["CNC", "머시닝센터"],
          inspection_type: "도어 인터록 점검",
          check_item: "가공 중 도어 인터록, 칩 커버, 비상정지 버튼 작동 상태 확인",
          cycle_months: 1,
          risk_level: "high",
          legal_basis: "KOSHA 기계설비 안전 일반 지침 참고",
          source_url: "https://www.kosha.or.kr/",
          note: "직접 법령 조항 미확인. 공식자료 참고 항목으로 표시합니다.",
          basis_type: "official_guide",
          legal_article: null,
          source_name: "한국산업안전보건공단",
          evidence_text: "회전체와 절삭칩 비산 위험이 있는 설비는 덮개, 인터록, 비상정지장치 상태 확인이 권장됩니다.",
        },
      ],
      inspections: [
        {
          inspection_id: "safety-inspection-cnc-interlock-001",
          company_id: "demo-company-001",
          equipment_id: "demo-equipment-cnc-001",
          rule_id: "safety-rule-cnc-interlock-001",
          last_checked_at: "2026-06-02",
          next_due_at: "2026-07-02",
          status: "normal",
          computed_status: "normal",
          assignee: "가공팀 이대리",
          memo: "이상 없음",
          days_left: 21,
        },
      ],
    },
  ],
}

export async function fetchSafetyDashboard(companyId = "demo-company-001"): Promise<SafetyDashboard> {
  try {
    const response = await apiFetch(`/safety/dashboard?company_id=${encodeURIComponent(companyId)}`)
    if (!response.ok) {
      throw new Error(`Safety API failed: ${response.status}`)
    }

    const payload = await response.json()
    return payload.data ?? mockSafetyDashboard
  } catch {
    return mockSafetyDashboard
  }
}
