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
  max_amount: number;   // 만원
  deadline: string;     // ISO date
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
