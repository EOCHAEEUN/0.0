export interface Company {
  id: string;
  name: string;
  industry_code: string;
  employee_count: number;
  region: string;
  energy_cost_annual: number;
}

export interface PolicyAnnouncement {
  policy_id: string;
  title: string;
  organization: string;
  
  // 분류
  policy_category?: string;      // 기업마당 원본 분류
  service_category?: string;     // 우리 서비스 분류
  service_subcategory?: string;  // 우리 서비스 세부분류
  
  // 지원 정보
  max_amount: number;            // 만원
  max_amount_note?: string;      // 금액 설명
  max_amount_source?: string;    // 추출 출처
  deadline: string;              // ISO date
  deadline_note?: string;        // 마감일 설명
  
  d_day: number;
  match_score?: number;
  url: string;
}

export interface Equipment {
  name: string;
  category: string;
  age_years: number;
  energy_cost_annual: number;
  defect_rate?: number;
}

export interface RoiScenario {
  type: "full_replacement" | "partial_maintenance";
  investment: number;
  subsidies: PolicyAnnouncement[];
  net_cost: number;
  annual_saving: number;
  payback_years: number;
  is_recommended: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  cards?: PolicyAnnouncement[];
}
