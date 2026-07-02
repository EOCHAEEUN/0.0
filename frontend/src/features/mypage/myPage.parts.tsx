import { useState, type HTMLAttributes, type ReactNode } from "react";

export type BasicInfo = {
  name: string;
  email: string;
  phone: string;
  manager: string;
  managerPhone: string;
};

export type PasswordInfo = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type IndustryItem = {
  id: number;
  industry: string;
  industryCode: string;
};

export type CompanyInfo = {
  companyName: string;
  businessNumber: string;
  assetTotalManwon: string;
  industry: string;
  industryCode: string;
  industries: IndustryItem[];
  region: string;
  employees: string;
  annualRevenue: string;
  revenue2YearsAgo: string;
  revenue3YearsAgo: string;
  companyType: string;
  affiliateStatus: string;
  purpose: string;
  foundedYear: string;
  businessSiteType: string;
};

export type EquipmentInfo = {
  id: number;
  equipmentId?: string;
  name: string;
  category: string;
  process: string;
  years: string;
  annualEnergyCost: string;
  defectRate: string;
  maintenanceCostAnnual: string;
  currentCapacityValue: string;
  productionQty: string;
  contributionMarginWon: string;
  scenarioAInvestment: string;
  scenarioBInvestment: string;
  status: string;
  createdAt?: string;
};

export type SavedPolicy = {
  id: number;
  title: string;
  organization: string;
  amount: string;
  fit: string;
  dday: string;
};

export type AnalysisHistory = {
  id: number;
  title: string;
  date: string;
  result: string;
  status: "완료" | "확인 필요";
};

export type MyPageStorageData = {
  basicInfo: BasicInfo;
  companyInfo: CompanyInfo;
  equipmentList: EquipmentInfo[];
  selectedAnalysisEquipmentId: number | null;
  profileCompleted: boolean;
  savedAt: string;
  ownerId?: string;
};

export type UserProfilePayload = {
  name: string;
  phone: string;
};

export type CompanyOnboardingPayload = {
  company_name: string;
  industry_name: string;
  industry_code: string[];
  region: string;
  business_registration_no: string | null;
  company_type: string;
  primary_purpose: string[];
  employee_count: number | null;
  annual_revenue: number;
  revenue_2y_ago_manwon: number | null;
  revenue_3y_ago_manwon: number | null;
  total_assets_manwon: number | null;
  is_disclosure_group_member: boolean | null;
  established_year: number | null;
  workplace_type: string | null;
};

export type EquipmentPayload = {
  /**
   * 기존 설비 수정 기준값입니다.
   * 값이 있으면 백엔드에서 같은 equipment row를 update/upsert해야 합니다.
   * 값이 없으면 신규 설비로 생성합니다.
   */
  equipment_id?: string | null;
  name: string;
  category: string;
  process: string | null;
  age_years: number;
  energy_cost_annual: number;
  defect_rate: number | null;
  maintenance_cost_annual: number | null;
  current_capacity_value: number | null;
  production_qty: number | null;
  contribution_margin_won: number | null;
  scenario_a_investment_manwon: number | null;
  scenario_b_investment_manwon: number | null;
};

export const STORAGE_KEY = "factofit_mypage_profile";
export const USER_ID_STORAGE_KEY = "factofit_user_id";
export const COMPANY_ID_STORAGE_KEY = "factofit_company_id";
export const EQUIPMENT_ID_STORAGE_KEY = "factofit_equipment_id";
export const SELECTED_EQUIPMENT_ID_STORAGE_KEY = "factofit_selected_equipment_id";
export const ACCESS_TOKEN_STORAGE_KEY = "factofit_access_token";
export const AUTH_SESSION_STORAGE_KEY = "factofit_auth_session";
export const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const CURRENT_YEAR = new Date().getFullYear();
export const PREVIOUS_YEAR = CURRENT_YEAR - 1;
export const TWO_YEARS_AGO = CURRENT_YEAR - 2;
export const THREE_YEARS_AGO = CURRENT_YEAR - 3;

export function buildApiUrl(path: string) {
  const normalizedBase = API_BASE_URL
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

export const emptyBasicInfo: BasicInfo = {
  name: "",
  email: "",
  phone: "",
  manager: "",
  managerPhone: "",
};

export const emptyPasswordInfo: PasswordInfo = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export const createEmptyIndustry = (id: number): IndustryItem => ({
  id,
  industry: "",
  industryCode: "",
});

export const emptyCompanyInfo: CompanyInfo = {
  companyName: "",
  businessNumber: "",
  assetTotalManwon: "",
  industry: "",
  industryCode: "",
  industries: [createEmptyIndustry(1), createEmptyIndustry(2)],
  region: "",
  employees: "",
  annualRevenue: "",
  revenue2YearsAgo: "",
  revenue3YearsAgo: "",
  companyType: "선택 필요",
  affiliateStatus: "선택 필요",
  purpose: "선택 필요",
  foundedYear: "",
  businessSiteType: "선택 필요",
};

export const createEmptyEquipment = (id: number): EquipmentInfo => ({
  id,
  equipmentId: undefined,
  name: "",
  category: "선택 필요",
  process: "",
  years: "",
  annualEnergyCost: "",
  defectRate: "",
  maintenanceCostAnnual: "",
  currentCapacityValue: "",
  productionQty: "",
  contributionMarginWon: "",
  scenarioAInvestment: "",
  scenarioBInvestment: "",
  status: "정보 입력 필요",
});

export const savedPolicies: SavedPolicy[] = [];
export const analysisHistories: AnalysisHistory[] = [];

export const INDUSTRY_CODE_MAP: Record<string, string[]> = {
  제조업: ["C"],
  스마트공장: ["C"],
  스마트제조: ["C"],
  식품: ["C10"],
  섬유: ["C13"],
  화학: ["C20"],
  바이오: ["C21"],
  의약: ["C21"],
  의료기기: ["C27"],
  고무: ["C22"],
  플라스틱: ["C22"],
  금속: ["C24", "C25"],
  금속가공: ["C25"],
  전자: ["C26"],
  반도체: ["C26"],
  전기: ["C28"],
  기계: ["C29"],
  장비: ["C29"],
  로봇: ["C29"],
  자동차: ["C30"],
  부품: ["C30"],
  소부장: ["C20", "C24", "C25", "C26", "C28", "C29"],
  뿌리: ["C24", "C25", "C28", "C29"],
  기타제조업: ["C"],
};

export const INDUSTRY_CODE_LABELS: Record<string, string> = {
  C: "기타 제조업",
  C10: "식품 제조업",
  C13: "섬유 제조업",
  C20: "화학 관련 제조업",
  C21: "바이오·의약 제조업",
  C22: "고무·플라스틱 제조업",
  C24: "1차 금속 제조업",
  C25: "금속가공 제조업",
  C26: "전자·반도체 제조업",
  C27: "의료기기 제조업",
  C28: "전기장비 제조업",
  C29: "기계·장비 제조업",
  C30: "자동차·부품 제조업",
};

export function loadStoredMyPageData(): MyPageStorageData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MyPageStorageData>;
    if (!parsed.basicInfo || !parsed.companyInfo || !parsed.equipmentList) {
      return null;
    }

    // ownerId가 저장된 경우 현재 사용자와 다르면 반환하지 않음 (다른 사용자의 캐시)
    if (parsed.ownerId) {
      try {
        const authRaw = window.localStorage.getItem("factofit_auth_session");
        const currentUserId = authRaw
          ? String((JSON.parse(authRaw) as Record<string, unknown>)?.userId ?? "")
          : "";
        if (currentUserId && parsed.ownerId !== currentUserId) return null;
      } catch {
        // auth session 파싱 실패 시 계속 진행
      }
    }

    const rawCompanyInfo = parsed.companyInfo as Partial<CompanyInfo> & {
      companySize?: string;
      company_size?: string;
      company_type?: string;
    };

    const companyInfo = {
      ...emptyCompanyInfo,
      ...rawCompanyInfo,
      companyType:
        rawCompanyInfo.companyType ??
        rawCompanyInfo.company_type ??
        rawCompanyInfo.companySize ??
        rawCompanyInfo.company_size ??
        emptyCompanyInfo.companyType,
    };

    const storedIndustries = Array.isArray(companyInfo.industries)
      ? companyInfo.industries.filter(
          (item): item is IndustryItem =>
            Boolean(item) &&
            typeof item.id === "number" &&
            typeof item.industry === "string" &&
            typeof item.industryCode === "string",
        )
      : [];

    const normalizedIndustries =
      storedIndustries.length >= 2
        ? storedIndustries
        : [
            storedIndustries[0] ?? {
              ...createEmptyIndustry(1),
              industry: companyInfo.industry ?? "",
              industryCode: companyInfo.industryCode ?? "",
            },
            storedIndustries[1] ?? createEmptyIndustry(2),
          ];

    return {
      basicInfo: {
        ...emptyBasicInfo,
        ...parsed.basicInfo,
      },
      companyInfo: {
        ...companyInfo,
        industries: normalizedIndustries,
        industry: normalizedIndustries[0]?.industry ?? "",
        industryCode: normalizedIndustries[0]?.industryCode ?? "",
      },
      equipmentList: parsed.equipmentList.map((equipment, index) => ({
        ...createEmptyEquipment((equipment as EquipmentInfo).id ?? index + 1),
        ...equipment,
      })),
      selectedAnalysisEquipmentId:
        typeof parsed.selectedAnalysisEquipmentId === "number"
          ? parsed.selectedAnalysisEquipmentId
          : ((parsed.equipmentList[0] as EquipmentInfo | undefined)?.id ?? 1),
      profileCompleted: parsed.profileCompleted ?? false,
      savedAt: parsed.savedAt ?? "",
    };
  } catch {
    return null;
  }
}

export function parseIndustryCodes(value: string) {
  return value
    .toUpperCase()
    .split(/[\s,，/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatIndustryCodes(codes: string[]) {
  return codes.join(", ");
}

export function getIndustryCodeCandidates(industryName: string) {
  const normalized = industryName.replace(/\s/g, "");
  if (!normalized) return [];

  const keys = Object.keys(INDUSTRY_CODE_MAP).sort(
    (a, b) => b.length - a.length,
  );
  const matchedKey = keys.find((key) => normalized.includes(key));
  if (!matchedKey) return [];

  return INDUSTRY_CODE_MAP[matchedKey];
}

export function getIndustryNameByCode(codeValue: string) {
  const codes = parseIndustryCodes(codeValue);
  const firstCode = codes[0];

  if (!firstCode) return "";

  return INDUSTRY_CODE_LABELS[firstCode] ?? "";
}

export function findCompanyId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findCompanyId(item);
      if (found) return found;
    }

    return null;
  }

  const record = data as Record<string, unknown>;
  const directValue = record.company_id ?? record.companyId ?? record.id;

  if (typeof directValue === "string" && directValue.trim()) {
    return directValue.trim();
  }

  if (typeof directValue === "number" && Number.isFinite(directValue)) {
    return String(directValue);
  }

  for (const value of Object.values(record)) {
    const found = findCompanyId(value);
    if (found) return found;
  }

  return null;
}

export function findEquipmentId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findEquipmentId(item);
      if (found) return found;
    }

    return null;
  }

  const record = data as Record<string, unknown>;
  const directValue = record.equipment_id ?? record.equipmentId;

  if (typeof directValue === "string" && directValue.trim()) {
    return directValue.trim();
  }

  for (const value of Object.values(record)) {
    const found = findEquipmentId(value);
    if (found) return found;
  }

  return null;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
}

export function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function getStoredAuthSession() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;

  return safeJsonParse(raw);
}

export function getStoredAuthUserId() {
  const session = getStoredAuthSession();
  if (!session || typeof session !== "object") return null;

  const record = session as Record<string, unknown>;
  const user = record.user;
  if (!user || typeof user !== "object") return null;

  const userId = (user as Record<string, unknown>).id;

  return typeof userId === "string" && isUuid(userId) ? userId : null;
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;

  const directToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (directToken?.trim()) return directToken.trim();

  const session = getStoredAuthSession();
  if (!session || typeof session !== "object") return null;

  const token = (session as Record<string, unknown>).access_token;

  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export function getApiErrorMessage(data: unknown, status: number) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.detail;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }

    if (Array.isArray(message)) {
      const validationMessages = message
        .map((item) => {
          if (typeof item === "string") return item;

          if (item && typeof item === "object") {
            const itemRecord = item as Record<string, unknown>;
            const msg = String(
              itemRecord.msg ?? itemRecord.message ?? "",
            ).trim();
            const loc = Array.isArray(itemRecord.loc)
              ? itemRecord.loc.map(String).join(".")
              : "";

            if (loc && msg) return `${loc}: ${msg}`;
            return msg;
          }

          return "";
        })
        .filter(Boolean);

      if (validationMessages.length > 0) {
        return validationMessages.join("\n");
      }
    }
  }

  return `요청 처리에 실패했습니다. (${status})`;
}

export function toPositiveNumber(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

export function toNumberOrNull(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return null;

  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatPhoneNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function formatBusinessNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function normalizePhoneNumber(value: string) {
  return onlyDigits(value);
}

export function normalizeBusinessNumber(value: string) {
  return onlyDigits(value);
}

export function formatCommaNumber(value: string) {
  const digits = onlyDigits(value);

  if (!digits) return "";

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function normalizeCommaNumber(value: string) {
  return onlyDigits(value);
}

export function getPasswordStrength(password: string) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Za-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!password) {
    return {
      label: "입력 전",
      percent: 0,
      color: "#94A3B8",
      bg: "#F8FAFC",
      description: "새 비밀번호를 입력하면 보안 강도를 확인할 수 있습니다.",
    };
  }

  if (score <= 1) {
    return {
      label: "낮음",
      percent: 33,
      color: "#CD2E3A",
      bg: "#FFF1F2",
      description: "영문, 숫자, 특수문자를 조합하면 더 안전합니다.",
    };
  }

  if (score <= 3) {
    return {
      label: "보통",
      percent: 67,
      color: "#E65F00",
      bg: "#FFF7ED",
      description: "사용 가능한 수준입니다. 8자 이상과 특수문자를 권장합니다.",
    };
  }

  return {
    label: "안전",
    percent: 100,
    color: "#0B7A53",
    bg: "#E6F6EF",
    description: "안전한 비밀번호 형식입니다.",
  };
}

export function isUuid(value: string | null | undefined) {
  return Boolean(
    value
      ?.trim()
      .match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
  );
}

export function findUuidInSupabaseAuthData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findUuidInSupabaseAuthData(item);
      if (found) return found;
    }

    return null;
  }

  const record = data as Record<string, unknown>;
  const user = record.user;

  if (user && typeof user === "object") {
    const userRecord = user as Record<string, unknown>;
    const userId = userRecord.id;

    if (typeof userId === "string" && isUuid(userId)) {
      return userId;
    }
  }

  for (const value of Object.values(record)) {
    const found = findUuidInSupabaseAuthData(value);
    if (found) return found;
  }

  return null;
}

export function getSupabaseAuthUserIdFromStorage() {
  if (typeof window === "undefined") return null;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) {
      continue;
    }

    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    const parsed = safeJsonParse(raw);
    const found = findUuidInSupabaseAuthData(parsed);

    if (found) return found;
  }

  return null;
}

export function getCurrentUserId() {
  if (typeof window === "undefined") return null;

  const storedAuthUserId = getStoredAuthUserId();
  if (storedAuthUserId) {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, storedAuthUserId);
    return storedAuthUserId;
  }

  const supabaseUserId = getSupabaseAuthUserIdFromStorage();
  if (supabaseUserId) {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, supabaseUserId);
    return supabaseUserId;
  }

  const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (isUuid(storedUserId)) {
    return storedUserId?.trim() ?? null;
  }

  return null;
}

export async function requestJson(
  path: string,
  options: RequestInit,
  debugLabel: string,
) {
  const accessToken = getAccessToken();

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });

  const responseText = await response.text();
  const responseData = safeJsonParse(responseText);

  if (response.ok) {
    console.log(`${debugLabel} 성공:`, responseData);
    return responseData;
  }

  console.error(`${debugLabel} 오류:`, {
    status: response.status,
    response: responseData ?? responseText,
  });
  console.error(
    `${debugLabel} 오류 상세:`,
    JSON.stringify(responseData ?? responseText, null, 2),
  );

  throw new Error(getApiErrorMessage(responseData, response.status));
}

export async function submitUserPayload(payload: UserProfilePayload) {
  return requestJson(
    "/api/user-profile/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    "사용자 프로필 수정 API",
  );
}

export async function submitCompanyPayload(payload: CompanyOnboardingPayload) {
  const responseData = await requestJson(
    "/api/onboarding",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "온보딩 company API",
  );

  const companyId = findCompanyId(responseData);

  if (!companyId) {
    console.error("company_id 추출 실패:", responseData);
    throw new Error(
      "company는 저장되었지만 응답에서 company_id를 찾지 못했습니다. 백엔드 응답에 company_id를 포함해주세요.",
    );
  }

  return {
    responseData,
    companyId,
  };
}

export async function submitEquipmentPayload(
  companyId: string,
  payload: EquipmentPayload,
) {
  const equipmentId = payload.equipment_id?.trim();

  if (equipmentId) {
    const { equipment_id: _ignoredEquipmentId, ...updatePayload } = payload;
    void _ignoredEquipmentId;

    return requestJson(
      `/api/equipment/${encodeURIComponent(equipmentId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(updatePayload),
      },
      "설비 수정 API",
    );
  }

  const { equipment_id: _ignoredEquipmentId, ...createPayload } = payload;
  void _ignoredEquipmentId;

  return requestJson(
    `/api/onboarding/${encodeURIComponent(companyId)}/equipment`,
    {
      method: "POST",
      body: JSON.stringify(createPayload),
    },
    "설비 신규 등록 API",
  );
}

export async function deleteEquipmentPayload(equipmentId: string) {
  return requestJson(
    `/api/equipment/${encodeURIComponent(equipmentId)}`,
    {
      method: "DELETE",
    },
    "설비 삭제 API",
  );
}

export async function fetchSavedOnboarding() {
  return requestJson(
    "/api/onboarding/me",
    {
      method: "GET",
    },
    "마이페이지 온보딩 조회 API",
  );
}

export function RequiredMark() {
  return (
    <span
      style={{
        color: "#CD2E3A",
        marginLeft: "4px",
      }}
    >
      *
    </span>
  );
}

export function SelectChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "26px",
        padding: "0 10px",
        borderRadius: "999px",
        background: "#F4F6FA",
        color: "#98A2B3",
        fontSize: "11px",
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      선택
    </span>
  );
}

export type EquipmentOptionalSectionKey =
  | "details"
  | "investment"
  | "operations";

function isEquipmentFieldFilled(value: string | undefined) {
  return Boolean(String(value ?? "").trim());
}

export function countEquipmentOptionalSectionFilled(
  equipment: EquipmentInfo,
  section: EquipmentOptionalSectionKey,
) {
  switch (section) {
    case "details":
      return [equipment.process, equipment.defectRate].filter(isEquipmentFieldFilled)
        .length;
    case "investment":
      return [
        equipment.scenarioAInvestment,
        equipment.scenarioBInvestment,
      ].filter(isEquipmentFieldFilled).length;
    case "operations":
      return [
        equipment.maintenanceCostAnnual,
        equipment.currentCapacityValue,
        equipment.productionQty,
        equipment.contributionMarginWon,
      ].filter(isEquipmentFieldFilled).length;
    default:
      return 0;
  }
}

export function countEquipmentOptionalFieldsFilled(equipment: EquipmentInfo) {
  return (
    countEquipmentOptionalSectionFilled(equipment, "details") +
    countEquipmentOptionalSectionFilled(equipment, "investment") +
    countEquipmentOptionalSectionFilled(equipment, "operations")
  );
}

export function EquipmentOptionalAccordion({
  title,
  description,
  open,
  filledCount,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  filledCount: number;
  onToggle: () => void;
  children: ReactNode;
}) {
  const filledLabel =
    filledCount > 0
      ? filledCount === 1
        ? "입력됨"
        : `${filledCount}개 입력됨`
      : "";

  return (
    <section className="ff-equipment-optional-accordion">
      <button
        type="button"
        className="ff-equipment-optional-accordion__header"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="ff-equipment-optional-accordion__header-main">
          <span className="ff-equipment-optional-accordion__title-row">
            <span className="ff-equipment-optional-accordion__title">{title}</span>
            <SelectChip />
            {filledLabel ? (
              <span className="ff-equipment-optional-accordion__filled-badge">
                {filledLabel}
              </span>
            ) : null}
          </span>
          <span className="ff-equipment-optional-accordion__description">
            {description}
          </span>
        </span>
        <span
          className={`ff-equipment-optional-accordion__chevron${open ? " is-open" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      <div
        className={`ff-equipment-optional-accordion__panel${open ? " is-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div
          className="ff-equipment-optional-accordion__panel-inner"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function FieldLabel({
  label,
  required,
  selectable,
  right,
  action,
}: {
  label: string;
  required?: boolean;
  selectable?: boolean;
  right?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <span
      style={{
        color: "#667085",
        fontSize: "13px",
        fontWeight: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        minHeight: "32px",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          minWidth: 0,
        }}
      >
        <span>
          {label}
          {required && <RequiredMark />}
        </span>

        {right}
      </span>

      {action ?? (selectable && <SelectChip />)}
    </span>
  );
}


export function EquipmentCategoryHelpTooltip() {
  return (
    <span className="ff-equipment-help-wrap">
      <button
        type="button"
        className="ff-equipment-help-icon"
        aria-label="ROI 분석 지원 설비 안내"
      >
        i
      </button>

      <span className="ff-equipment-help-tooltip" role="tooltip">
        <strong>ROI 분석 지원 설비 안내</strong>
        <span>
          현재 ROI 분석은 press, cnc, injection 설비에 최적화되어 있습니다.
          <br />
          welding, compressor 등 기타 설비도 저장은 가능하지만, 분석 결과가 일부 제한될 수 있어요.
        </span>
      </span>
    </span>
  );
}

export function IndustryRemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="업종 삭제"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      style={{
        minHeight: "24px",
        padding: "0 10px",
        borderRadius: "999px",
        border: "1px solid rgba(226, 232, 240, 0.9)",
        background: "#F8FAFC",
        color: "#667085",
        fontSize: "11px",
        fontWeight: 900,
        lineHeight: 1,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      삭제
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  helperText,
  labelRight,
  labelAction,
  inputMode,
  selectable = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  helperText?: string;
  labelRight?: ReactNode;
  labelAction?: ReactNode;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  selectable?: boolean;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: "9px",
      }}
    >
      <FieldLabel
        label={label}
        required={required}
        selectable={selectable}
        right={labelRight}
        action={labelAction}
      />

      <input
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: "52px",
          borderRadius: "18px",
          border: "1px solid #E2E8F0",
          background: "#FFFFFF",
          color: "#061B34",
          padding: "0 16px",
          fontSize: "15px",
          fontWeight: 800,
          outline: "none",
          boxSizing: "border-box",
          width: "100%",
        }}
      />

      {helperText && (
        <p
          style={{
            color: "#94A3B8",
            fontSize: "12px",
            fontWeight: 800,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {helperText}
        </p>
      )}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  helperText,
  selectable,
  labelRight,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  helperText?: string;
  selectable?: boolean;
  labelRight?: ReactNode;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: "9px",
      }}
    >
      <FieldLabel
        label={label}
        required={required}
        selectable={selectable ?? !required}
        right={labelRight}
      />

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: "52px",
          borderRadius: "18px",
          border: "1px solid #E2E8F0",
          background: "#FFFFFF",
          color: "#061B34",
          padding: "0 16px",
          fontSize: "15px",
          fontWeight: 800,
          outline: "none",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {helperText && (
        <p
          style={{
            color: "#94A3B8",
            fontSize: "12px",
            fontWeight: 800,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {helperText}
        </p>
      )}
    </label>
  );
}

export function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        color: done ? "#0B7A53" : "#667085",
        fontSize: "13px",
        fontWeight: 900,
      }}
    >
      <span
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "999px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: done ? "#E6F6EF" : "#F1F5F9",
          color: done ? "#0B7A53" : "#94A3B8",
          fontSize: "12px",
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {done ? "✓" : "!"}
      </span>

      {label}
    </div>
  );
}

export function InfoTooltip({ open, text }: { open: boolean; text: string }) {
  if (!open) return null;

  return (
    <span
      style={{
        position: "absolute",
        left: "0",
        bottom: "calc(100% + 10px)",
        width: "330px",
        maxWidth: "min(330px, calc(100vw - 80px))",
        borderRadius: "16px",
        background: "#061B34",
        color: "#FFFFFF",
        padding: "13px 15px",
        fontSize: "12px",
        fontWeight: 800,
        lineHeight: 1.6,
        boxShadow: "0 14px 34px rgba(6,27,52,.2)",
        zIndex: 30,
        whiteSpace: "normal",
      }}
    >
      {text}
    </span>
  );
}

export function FloatingModalNotice({
  open,
  title,
  description,
  description2,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  description2: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 120,
          background: "rgba(3, 7, 18, 0.62)",
          backdropFilter: "blur(5px)",
        }}
      />

      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 121,
          width: "min(560px, calc(100vw - 32px))",
          borderRadius: "28px",
          padding: "28px 28px 24px",
          background:
            "radial-gradient(circle at 100% 0%, rgba(232, 204, 121, 0.18) 0%, transparent 32%), linear-gradient(135deg, #0A1323 0%, #192334 58%, #222B38 100%)",
          border: "1px solid rgba(232, 204, 121, 0.42)",
          boxShadow:
            "0 30px 80px rgba(3, 7, 18, 0.44), 0 0 0 1px rgba(255, 255, 255, 0.04) inset",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "18px",
          }}
        >
          <div>
            <span
              style={{
                display: "block",
                width: "112px",
                height: "3px",
                borderRadius: "999px",
                marginBottom: "18px",
                background:
                  "linear-gradient(90deg, #5B5FC7 0%, #E8CC79 48%, rgba(232, 204, 121, 0) 100%)",
              }}
            />

            <strong
              style={{
                display: "block",
                color: "#E8CC79",
                fontSize: "24px",
                lineHeight: 1.35,
                fontWeight: 900,
                letterSpacing: "-0.5px",
              }}
            >
              {title}
            </strong>

            <p
              style={{
                margin: "12px 0 0",
                color: "rgba(248, 250, 252, 0.92)",
                fontSize: "14px",
                lineHeight: 1.8,
                fontWeight: 800,
                whiteSpace: "pre-line",
              }}
            >
              {description}
            </p>

            <p
              style={{
                margin: "6px 0 0",
                color: "rgba(232, 204, 121, 0.94)",
                fontSize: "14px",
                lineHeight: 1.8,
                fontWeight: 850,
                whiteSpace: "pre-line",
              }}
            >
              {description2}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "42px",
              height: "42px",
              flexShrink: 0,
              borderRadius: "999px",
              border: "1px solid rgba(232, 204, 121, 0.28)",
              background: "rgba(255, 255, 255, 0.08)",
              color: "#F8FAFC",
              fontSize: "28px",
              lineHeight: 1,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(3, 7, 18, 0.28)",
            }}
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}

export function CollapsibleHeader({
  title,
  open,
  selectable = false,
  onToggle,
}: {
  title: string;
  open: boolean;
  selectable?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        color: "#061B34",
        fontSize: "15px",
        fontWeight: 950,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: "16px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "12px",
          minWidth: 0,
        }}
      >
        <span>{title}</span>
        {selectable && <SelectChip />}
      </span>

      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "64px",
          minWidth: "64px",
          maxWidth: "64px",
          height: "36px",
          padding: "0 14px",
          boxSizing: "border-box",
          borderRadius: "999px",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          color: "#98A2B3",
          fontSize: "12px",
          fontWeight: 900,
          whiteSpace: "nowrap",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        {open ? "닫기" : "열기"}
      </button>
    </div>
  );
}

export function hasRequiredEquipmentFields(equipment: EquipmentInfo) {
  const categoryReady = equipment.category !== "선택 필요";
  const nameReady = equipment.name.trim();
  const yearsReady = equipment.years.trim();
  const energyReady = equipment.annualEnergyCost.trim();

  return Boolean(categoryReady && nameReady && yearsReady && energyReady);
}

export type MyPagePanelKey = "basic" | "company" | "equipment" | "documents";

export const COMPANY_TYPE_OPTIONS = [
  "선택 필요",
  "소상공인",
  "소기업",
  "중소기업",
  "중견기업",
  "대기업",
  "확인 필요",
];

export const AFFILIATE_STATUS_OPTIONS = [
  "선택 필요",
  "무소속",
  "대기업 계열사 소속",
  "확인 필요",
];

export const BUSINESS_SITE_TYPE_OPTIONS = [
  "선택 필요",
  "본사",
  "공장",
  "연구소",
  "지점",
  "본사+공장",
  "기타",
];

export const PURPOSE_OPTIONS = [
  "선택 필요",
  "지원사업 추천",
  "ROI 분석",
  "설비 교체",
  "에너지 절감",
  "안전점검",
  "신청서 생성",
];

export const EQUIPMENT_CATEGORY_OPTIONS = [
  "선택 필요",
  "press",
  "cnc",
  "injection",
  "welding",
  "compressor",
  "etc",
];

export type HeroFlowStep = {
  index: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
};

export function AiGuideHeroBanner({
  completionScore,
  missingCoreCount,
  needsInputGuide,
  savedPolicyCount,
  completedEquipmentCount,
  analysisHistoryCount,
}: {
  completionScore: number;
  missingCoreCount: number;
  needsInputGuide: boolean;
  savedPolicyCount: number;
  completedEquipmentCount: number;
  analysisHistoryCount: number;
}) {
  const [hoveredStepIndex, setHoveredStepIndex] = useState<string | null>(null);

  const serviceSteps: HeroFlowStep[] = [
    {
      index: "01",
      title: "입력",
      subtitle: "기업·설비 정보 저장",
      description:
        "마이페이지에서 기업 규모, 업종, 매출, 설비 기본값을 입력해 분석 기준 데이터를 만듭니다.",
      bullets: [
        "필수값: 기본정보, 기업정보, 설비 1개 이상",
        "선택값: 최근 매출, 설비 투자비, 운영지표",
        "저장 후 분석 기준으로 재사용됩니다.",
      ],
    },
    {
      index: "02",
      title: "분석",
      subtitle: "ROI 계산 준비",
      description:
        "저장된 기업·설비 정보를 기준으로 투자비 회수기간, 절감 효과, 설비 개선 우선순위를 계산합니다.",
      bullets: [
        "설비명·종류·사용연수·에너지 비용을 우선 확인합니다.",
        "투자비가 비어 있으면 업계 평균값으로 추정합니다.",
        "선택한 ROI 분석 대상 설비 기준으로 실행됩니다.",
      ],
    },
    {
      index: "03",
      title: "매칭",
      subtitle: "지원사업 추천 기준",
      description:
        "업종코드, 기업 규모, 지역, 매출 조건을 활용해 신청 가능성이 높은 지원사업을 우선 추천합니다.",
      bullets: [
        "company_type은 기업 규모 기준입니다.",
        "업종명·업종코드는 정책 대상 업종 매칭에 사용됩니다.",
        "지역과 매출 조건은 제외/우대 조건 판별에 활용됩니다.",
      ],
    },
    {
      index: "04",
      title: "실행",
      subtitle: "신청 준비 연결",
      description:
        "분석 결과를 바탕으로 지원사업 상세 확인, 신청서 초안 작성, 후속 의사결정으로 이어집니다.",
      bullets: [
        "저장하기 후 분석하기를 눌러 결과를 생성합니다.",
        "분석 결과는 대시보드와 ROI 페이지에서 이어서 확인합니다.",
        "신청서 초안 생성에 필요한 근거 문장으로도 활용됩니다.",
      ],
    },
  ];

  const summaryItems = [
    ["저장 지원사업", `${savedPolicyCount}건`],
    ["등록 설비", `${completedEquipmentCount}대`],
    ["최근 분석", `${analysisHistoryCount}건`],
    ["입력 완성도", `${completionScore}%`],
  ];

  const stepIcons: Record<string, string> = {
    "01": "▤",
    "02": "▥",
    "03": "◎",
    "04": "↗",
  };

  return (
    <section
      style={{
        position: "relative",
        overflow: "visible",
        isolation: "isolate",
        borderRadius: "32px",
        border: "1px solid rgba(255,255,255,.13)",
        background:
          "radial-gradient(circle at 18% 82%, rgba(232,204,121,.14) 0%, rgba(232,204,121,0) 25%), linear-gradient(127deg, #061120 0%, #08172A 50%, #202A3D 100%)",
        boxShadow:
          "0 24px 60px rgba(15,23,42,.16), 0 1px 0 rgba(255,255,255,.11) inset",
        padding: "clamp(34px, 3.25vw, 48px)",
        minHeight: "clamp(360px, 27vw, 430px)",
        boxSizing: "border-box",
        marginBottom: "26px",
        color: "#FFFFFF",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "32px",
          background:
            "linear-gradient(135deg, rgba(255,255,255,.028) 0 1px, transparent 1px 28px)",
          opacity: 0.38,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "clamp(30px, 4vw, 74px)",
          bottom: "clamp(18px, 2.4vw, 34px)",
          width: "clamp(260px, 30vw, 520px)",
          height: "clamp(100px, 10vw, 150px)",
          opacity: 0.34,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, rgba(232,204,121,.34), rgba(255,255,255,.08), transparent 74%)",
          maskImage:
            "repeating-linear-gradient(90deg, transparent 0 44px, #000 44px 46px, transparent 46px 78px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: "7%",
          top: "8%",
          width: "260px",
          height: "180px",
          borderRadius: "999px",
          background:
            "radial-gradient(circle, rgba(232,204,121,.18) 0%, rgba(232,204,121,.05) 38%, rgba(255,255,255,0) 70%)",
          filter: "blur(2px)",
          pointerEvents: "none",
        }}
      />

      <div
        className="ff-mypage-ai-banner-grid"
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(310px, .78fr) minmax(520px, 1.08fr)",
          gap: "clamp(34px, 4.2vw, 66px)",
          alignItems: "center",
        }}
      >
        <div
          style={{
            minWidth: 0,
            maxWidth: "560px",
            transform: "translateY(-14px)",
          }}
        >
          <div
            style={{
              width: "116px",
              height: "3px",
              borderRadius: "999px",
              background:
                "linear-gradient(90deg, #6F78C8 0%, #E8CC79 45%, rgba(255,255,255,0) 100%)",
              marginBottom: "20px",
            }}
          />

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "34px",
              padding: "0 17px",
              borderRadius: "999px",
              background: "rgba(255,255,255,.055)",
              border: "1px solid rgba(232,204,121,.48)",
              color: "#E8CC79",
              fontSize: "13px",
              fontWeight: 950,
              letterSpacing: ".1px",
              marginBottom: "18px",
            }}
          >
            FactoFit AI Agent
          </span>

          <h2
            style={{
              color: "#FFFFFF",
              fontSize: "clamp(32px, 3.45vw, 52px)",
              lineHeight: 1.09,
              fontWeight: 950,
              letterSpacing: "-1.7px",
              margin: 0,
            }}
          >
            입력한 정보가
            <br />
            <span style={{ color: "#E8D77D" }}>AI 분석 흐름</span>으로
            <br />
            이어집니다.
          </h2>

          <p
            style={{
              color: "rgba(255,255,255,.74)",
              fontSize: "clamp(13px, 1.02vw, 15px)",
              lineHeight: 1.72,
              fontWeight: 850,
              margin: "18px 0 0",
              maxWidth: "520px",
            }}
          >
            {needsInputGuide ? (
              `필수 항목 ${missingCoreCount}개를 더 채우면 저장 후 분석을 시작할 수 있습니다.`
            ) : (
              <>
                저장된 정보를 기준으로 ROI 분석과
                <br />
                지원사업 추천을 바로 시작할 수 있어요.
              </>
            )}
          </p>
        </div>

        <div
          style={{
            minWidth: 0,
            position: "relative",
            zIndex: 20,
            overflow: "visible",
            borderRadius: "28px",
            background:
              "linear-gradient(138deg, rgba(255,255,255,.085) 0%, rgba(255,255,255,.045) 100%)",
            border: "1px solid rgba(232,204,121,.24)",
            boxShadow:
              "0 18px 46px rgba(0,0,0,.16), 0 1px 0 rgba(255,255,255,.08) inset",
            padding: "clamp(22px, 2.3vw, 30px)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "6%",
              top: "-2px",
              width: "150px",
              height: "3px",
              borderRadius: "999px",
              background:
                "linear-gradient(90deg, rgba(232,204,121,0), rgba(232,204,121,.76), rgba(255,255,255,0))",
              boxShadow: "0 0 26px rgba(232,204,121,.46)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", padding: "6px 0 12px" }}>
            <div
              style={{
                position: "absolute",
                left: "8%",
                right: "8%",
                top: "50%",
                height: "2px",
                background:
                  "linear-gradient(90deg, rgba(232,204,121,0), rgba(232,204,121,.56), rgba(232,204,121,0))",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />

            <div
              className="ff-mypage-service-flow"
              style={{
                position: "relative",
                zIndex: 1,
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(82px, 1fr))",
                gap: "14px",
                alignItems: "center",
              }}
            >
              {serviceSteps.map((step) => {
                const isHovered = hoveredStepIndex === step.index;

                return (
                  <div
                    key={step.index}
                    style={{ position: "relative", minWidth: 0 }}
                    onMouseEnter={() => setHoveredStepIndex(step.index)}
                    onMouseLeave={() => setHoveredStepIndex(null)}
                    onFocus={() => setHoveredStepIndex(step.index)}
                    onBlur={() => setHoveredStepIndex(null)}
                  >
                    {isHovered && (
                      <div
                        role="tooltip"
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: "calc(100% + 18px)",
                          zIndex: 999,
                          width: "min(330px, 78vw)",
                          transform: "translateX(-50%)",
                          borderRadius: "20px",
                          padding: "18px 18px 16px",
                          background: "rgba(255,255,255,.98)",
                          color: "#061B34",
                          border: "1px solid rgba(226,232,240,.9)",
                          boxShadow: "0 28px 64px rgba(0,0,0,.30)",
                          textAlign: "left",
                          pointerEvents: "none",
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            color: "#061B34",
                            fontSize: "18px",
                            fontWeight: 950,
                            letterSpacing: "-.3px",
                            lineHeight: 1.25,
                          }}
                        >
                          {step.title} · {step.subtitle}
                        </strong>

                        <p
                          style={{
                            margin: "9px 0 0",
                            color: "#475467",
                            fontSize: "12px",
                            lineHeight: 1.65,
                            fontWeight: 850,
                          }}
                        >
                          {step.description}
                        </p>

                        <ul
                          style={{
                            margin: "10px 0 0",
                            paddingLeft: "17px",
                            color: "#667085",
                            fontSize: "12px",
                            lineHeight: 1.65,
                            fontWeight: 800,
                          }}
                        >
                          {step.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>

                        <span
                          style={{
                            position: "absolute",
                            left: "50%",
                            bottom: "-7px",
                            width: "14px",
                            height: "14px",
                            background: "rgba(255,255,255,.98)",
                            borderRight: "1px solid rgba(226,232,240,.9)",
                            borderBottom: "1px solid rgba(226,232,240,.9)",
                            transform: "translateX(-50%) rotate(45deg)",
                          }}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      style={{
                        width: "100%",
                        minHeight: "82px",
                        borderRadius: "18px",
                        border: "1px solid rgba(232,204,121,.18)",
                        background: isHovered
                          ? "linear-gradient(180deg, rgba(58,66,82,.96) 0%, rgba(37,45,61,.96) 100%)"
                          : "linear-gradient(180deg, rgba(55,64,80,.8) 0%, rgba(34,43,59,.75) 100%)",
                        color: "#FFFFFF",
                        padding: "10px 8px",
                        cursor: "default",
                        display: "grid",
                        alignContent: "center",
                        justifyItems: "center",
                        gap: "5px",
                        boxShadow: isHovered
                          ? "0 13px 28px rgba(0,0,0,.20)"
                          : "0 9px 20px rgba(0,0,0,.10)",
                        transform: isHovered ? "translateY(-2px)" : "none",
                        transition:
                          "transform .15s ease, box-shadow .15s ease, background .15s ease",
                      }}
                    >
                      <span
                        style={{
                          color: "#E8CC79",
                          fontFamily: "DM Mono, monospace",
                          fontSize: "13px",
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
                      >
                        {step.index}
                      </span>

                      <span
                        aria-hidden="true"
                        style={{
                          color: "#E8CC79",
                          fontSize: "21px",
                          lineHeight: 1,
                          fontWeight: 400,
                        }}
                      >
                        {stepIcons[step.index]}
                      </span>

                      <strong
                        style={{
                          color: "#FFFFFF",
                          fontSize: "15px",
                          fontWeight: 950,
                          lineHeight: 1.1,
                          letterSpacing: "-.3px",
                        }}
                      >
                        {step.title}
                      </strong>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="ff-mypage-ai-middle-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, .9fr) minmax(0, 1.15fr)",
              gap: "14px",
              marginTop: "20px",
            }}
          >
            <div
              style={{
                minHeight: "164px",
                borderRadius: "20px",
                border: "1px solid rgba(232,204,121,.28)",
                background:
                  "radial-gradient(circle at 55% 22%, rgba(232,204,121,.16), rgba(232,204,121,0) 34%), linear-gradient(145deg, rgba(255,255,255,.075), rgba(255,255,255,.035))",
                display: "grid",
                placeItems: "center",
                padding: "18px",
                textAlign: "center",
                boxSizing: "border-box",
                boxShadow: "0 12px 30px rgba(0,0,0,.12) inset",
              }}
            >
              <div>
                <div
                  style={{
                    position: "relative",
                    width: "76px",
                    height: "64px",
                    margin: "0 auto 13px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      width: "12px",
                      height: "28px",
                      borderRadius: "999px",
                      background: "linear-gradient(180deg, #F1DC82, #B79E4E)",
                      transform: "translateX(-50%)",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "22px",
                      width: "72px",
                      height: "42px",
                      borderRadius: "999px 999px 24px 24px",
                      background:
                        "linear-gradient(135deg, #FFF7C3 0%, #D8BE65 100%)",
                      transform: "translateX(-50%)",
                      boxShadow: "0 12px 24px rgba(0,0,0,.18)",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "31px",
                      width: "54px",
                      height: "26px",
                      borderRadius: "999px",
                      background: "#111A2E",
                      transform: "translateX(-50%)",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "31px",
                      top: "42px",
                      width: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      background: "#E8CC79",
                      boxShadow: "18px 0 0 #E8CC79",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: "-3px",
                      top: "21px",
                      color: "#F1DC82",
                      fontSize: "20px",
                      lineHeight: 1,
                    }}
                  >
                    ✦
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: "-5px",
                      width: "36px",
                      height: "22px",
                      borderRadius: "9px",
                      border: "1px solid rgba(232,204,121,.55)",
                      background: "#182036",
                      color: "#E8CC79",
                      fontSize: "12px",
                      fontWeight: 950,
                      display: "grid",
                      placeItems: "center",
                      transform: "translateX(-50%)",
                    }}
                  >
                    AI
                  </span>
                </div>

                <strong
                  style={{
                    display: "block",
                    color: "#FFFFFF",
                    fontSize: "19px",
                    fontWeight: 950,
                    letterSpacing: "-.2px",
                    marginBottom: "8px",
                  }}
                >
                  FactoFit AI
                </strong>

                <p
                  style={{
                    margin: 0,
                    color: "rgba(255,255,255,.66)",
                    fontSize: "13px",
                    fontWeight: 850,
                    lineHeight: 1.6,
                  }}
                >
                  데이터를 이해하고
                  <br />
                  가치를 찾아드립니다.
                </p>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                minHeight: "164px",
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,.10)",
                background:
                  "radial-gradient(circle at 78% 82%, rgba(232,204,121,.08), rgba(232,204,121,0) 36%), linear-gradient(145deg, rgba(6,17,32,.95), rgba(9,21,38,.82))",
                padding: "24px 26px",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: "24px",
                  bottom: "-12px",
                  width: "180px",
                  height: "90px",
                  opacity: 0.24,
                  background:
                    "linear-gradient(90deg, transparent 0 20px, rgba(255,255,255,.28) 20px 22px, transparent 22px 46px), linear-gradient(0deg, transparent 0 24px, rgba(255,255,255,.16) 24px 26px, transparent 26px 50px)",
                }}
              />

              <span
                style={{
                  display: "block",
                  color: "rgba(255,255,255,.46)",
                  fontSize: "10px",
                  fontWeight: 950,
                  letterSpacing: "6px",
                  marginBottom: "14px",
                }}
              >
                FACTOFIT INTELLIGENCE
              </span>

              <strong
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "block",
                  color: "#FFFFFF",
                  fontSize: "clamp(18px, 1.55vw, 24px)",
                  fontWeight: 950,
                  lineHeight: 1.42,
                  letterSpacing: "-.5px",
                }}
              >
                기업 조건에 맞는
                <br />
                실행 항목을 한곳에
                <br />
                정리합니다.
              </strong>

              <p
                style={{
                  position: "relative",
                  zIndex: 1,
                  margin: "14px 0 0",
                  color: "rgba(255,255,255,.68)",
                  fontSize: "12px",
                  fontWeight: 850,
                  lineHeight: 1.65,
                }}
              >
                ROI · 지원사업 · 신청 준비 · 안전점검을 이어서 관리합니다.
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: "18px",
              paddingTop: "17px",
              borderTop: "1px solid rgba(255,255,255,.12)",
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "10px",
            }}
            className="ff-mypage-ai-summary-grid"
          >
            {summaryItems.map(([label, value]) => (
              <div
                key={label}
                style={{
                  minWidth: 0,
                  paddingLeft: "12px",
                  borderLeft:
                    label === "저장 지원사업"
                      ? "0"
                      : "1px solid rgba(255,255,255,.12)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    color: "rgba(255,255,255,.54)",
                    fontSize: "11px",
                    fontWeight: 900,
                    lineHeight: 1.3,
                    marginBottom: "5px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
                <strong
                  style={{
                    display: "block",
                    color: label === "입력 완성도" ? "#E8CC79" : "#FFFFFF",
                    fontFamily: "DM Mono, monospace",
                    fontSize: label === "입력 완성도" ? "22px" : "20px",
                    fontWeight: 500,
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export function AccordionPanel({
  id,
  title,
  description,
  badge,
  open,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="card"
      style={{
        borderRadius: "32px",
        overflow: "hidden",
        scrollMarginTop: "120px",
        border: open ? "1px solid rgba(52,75,160,.18)" : "1px solid #E2E8F0",
        boxShadow: open
          ? "0 18px 48px rgba(15,23,42,.07)"
          : "0 10px 28px rgba(15,23,42,.04)",
      }}
    >
      <div
        style={{
          padding: "28px 34px",
          borderBottom: open ? "1px solid #E2E8F0" : "0",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: "18px",
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                color: "#061B34",
                fontSize: "30px",
                fontWeight: 950,
                letterSpacing: "-.7px",
                margin: 0,
              }}
            >
              {title}
            </h2>
            {badge}
          </div>

          <p
            style={{
              color: "#667085",
              fontSize: "14px",
              fontWeight: 850,
              lineHeight: 1.65,
              margin: "8px 0 0",
            }}
          >
            {description}
          </p>
        </div>

        <CollapsibleHeader title="" open={open} onToggle={onToggle} />
      </div>

      {open && (
        <div
          style={{
            padding: "34px 38px 38px",
            display: "grid",
            gap: "22px",
            alignContent: "start",
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

