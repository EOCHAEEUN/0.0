import {
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import AppHeader from "../components/AppHeader";

type BasicInfo = {
  name: string;
  email: string;
  phone: string;
  manager: string;
  managerPhone: string;
};

type PasswordInfo = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type IndustryItem = {
  id: number;
  industry: string;
  industryCode: string;
};

type CompanyInfo = {
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

type EquipmentInfo = {
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
};

type SavedPolicy = {
  id: number;
  title: string;
  organization: string;
  amount: string;
  fit: string;
  dday: string;
};

type AnalysisHistory = {
  id: number;
  title: string;
  date: string;
  result: string;
  status: "완료" | "확인 필요";
};

type MyPageStorageData = {
  basicInfo: BasicInfo;
  companyInfo: CompanyInfo;
  equipmentList: EquipmentInfo[];
  selectedAnalysisEquipmentId: number | null;
  profileCompleted: boolean;
  savedAt: string;
};

type UserProfilePayload = {
  name: string;
  phone: string;
};

type CompanyOnboardingPayload = {
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

type EquipmentPayload = {
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

const STORAGE_KEY = "factofit_mypage_profile";
const USER_ID_STORAGE_KEY = "factofit_user_id";
const COMPANY_ID_STORAGE_KEY = "factofit_company_id";
const ACCESS_TOKEN_STORAGE_KEY = "factofit_access_token";
const AUTH_SESSION_STORAGE_KEY = "factofit_auth_session";
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const CURRENT_YEAR = new Date().getFullYear();
const PREVIOUS_YEAR = CURRENT_YEAR - 1;
const TWO_YEARS_AGO = CURRENT_YEAR - 2;
const THREE_YEARS_AGO = CURRENT_YEAR - 3;

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const emptyBasicInfo: BasicInfo = {
  name: "",
  email: "",
  phone: "",
  manager: "",
  managerPhone: "",
};

const emptyPasswordInfo: PasswordInfo = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const createEmptyIndustry = (id: number): IndustryItem => ({
  id,
  industry: "",
  industryCode: "",
});

const emptyCompanyInfo: CompanyInfo = {
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

const createEmptyEquipment = (id: number): EquipmentInfo => ({
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

const savedPolicies: SavedPolicy[] = [];
const analysisHistories: AnalysisHistory[] = [];

const INDUSTRY_CODE_MAP: Record<string, string[]> = {
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

const INDUSTRY_CODE_LABELS: Record<string, string> = {
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

function loadStoredMyPageData(): MyPageStorageData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MyPageStorageData>;
    if (!parsed.basicInfo || !parsed.companyInfo || !parsed.equipmentList) {
      return null;
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

function parseIndustryCodes(value: string) {
  return value
    .toUpperCase()
    .split(/[\s,，/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatIndustryCodes(codes: string[]) {
  return codes.join(", ");
}

function getIndustryCodeCandidates(industryName: string) {
  const normalized = industryName.replace(/\s/g, "");
  if (!normalized) return [];

  const keys = Object.keys(INDUSTRY_CODE_MAP).sort(
    (a, b) => b.length - a.length,
  );
  const matchedKey = keys.find((key) => normalized.includes(key));
  if (!matchedKey) return [];

  return INDUSTRY_CODE_MAP[matchedKey];
}

function getIndustryNameByCode(codeValue: string) {
  const codes = parseIndustryCodes(codeValue);
  const firstCode = codes[0];

  if (!firstCode) return "";

  return INDUSTRY_CODE_LABELS[firstCode] ?? "";
}

function findCompanyId(data: unknown): string | null {
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

function findEquipmentId(data: unknown): string | null {
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function getStoredAuthSession() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;

  return safeJsonParse(raw);
}

function getStoredAuthUserId() {
  const session = getStoredAuthSession();
  if (!session || typeof session !== "object") return null;

  const record = session as Record<string, unknown>;
  const user = record.user;
  if (!user || typeof user !== "object") return null;

  const userId = (user as Record<string, unknown>).id;

  return typeof userId === "string" && isUuid(userId) ? userId : null;
}

function getAccessToken() {
  if (typeof window === "undefined") return null;

  const directToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (directToken?.trim()) return directToken.trim();

  const session = getStoredAuthSession();
  if (!session || typeof session !== "object") return null;

  const token = (session as Record<string, unknown>).access_token;

  return typeof token === "string" && token.trim() ? token.trim() : null;
}

function getApiErrorMessage(data: unknown, status: number) {
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

function toPositiveNumber(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function toNumberOrNull(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return null;

  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhoneNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatBusinessNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function normalizePhoneNumber(value: string) {
  return onlyDigits(value);
}

function normalizeBusinessNumber(value: string) {
  return onlyDigits(value);
}

function formatCommaNumber(value: string) {
  const digits = onlyDigits(value);

  if (!digits) return "";

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function normalizeCommaNumber(value: string) {
  return onlyDigits(value);
}

function getPasswordStrength(password: string) {
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

function isUuid(value: string | null | undefined) {
  return Boolean(
    value
      ?.trim()
      .match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
  );
}

function findUuidInSupabaseAuthData(data: unknown): string | null {
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

function getSupabaseAuthUserIdFromStorage() {
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

function getCurrentUserId() {
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

async function requestJson(
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

async function submitUserPayload(payload: UserProfilePayload) {
  return requestJson(
    "/api/user-profile/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    "사용자 프로필 수정 API",
  );
}

async function submitCompanyPayload(payload: CompanyOnboardingPayload) {
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

async function submitEquipmentPayload(
  companyId: string,
  payload: EquipmentPayload,
) {
  return requestJson(
    `/api/onboarding/${encodeURIComponent(companyId)}/equipment`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "온보딩 equipment API",
  );
}

async function fetchSavedOnboarding() {
  return requestJson(
    "/api/onboarding/me",
    {
      method: "GET",
    },
    "마이페이지 온보딩 조회 API",
  );
}

function RequiredMark() {
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

function SelectChip() {
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

function FieldLabel({
  label,
  required,
  selectable,
  right,
}: {
  label: string;
  required?: boolean;
  selectable?: boolean;
  right?: ReactNode;
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

      {selectable && <SelectChip />}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  helperText,
  labelRight,
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

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  helperText,
  selectable,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  helperText?: string;
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
        selectable={selectable ?? !required}
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

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
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

function InfoTooltip({ open, text }: { open: boolean; text: string }) {
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

function FloatingModalNotice({
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

function CollapsibleHeader({
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

function hasRequiredEquipmentFields(equipment: EquipmentInfo) {
  const categoryReady = equipment.category !== "선택 필요";
  const nameReady = equipment.name.trim();
  const yearsReady = equipment.years.trim();
  const energyReady = equipment.annualEnergyCost.trim();

  return Boolean(categoryReady && nameReady && yearsReady && energyReady);
}

type MyPagePanelKey = "basic" | "company" | "equipment";

const COMPANY_TYPE_OPTIONS = [
  "선택 필요",
  "소상공인",
  "소기업",
  "중소기업",
  "중견기업",
  "대기업",
  "확인 필요",
];

const AFFILIATE_STATUS_OPTIONS = [
  "선택 필요",
  "무소속",
  "대기업 계열사 소속",
  "확인 필요",
];

const BUSINESS_SITE_TYPE_OPTIONS = [
  "선택 필요",
  "본사",
  "공장",
  "연구소",
  "지점",
  "본사+공장",
  "기타",
];

const PURPOSE_OPTIONS = [
  "선택 필요",
  "지원사업 추천",
  "ROI 분석",
  "설비 교체",
  "에너지 절감",
  "안전점검",
  "신청서 생성",
];

const EQUIPMENT_CATEGORY_OPTIONS = [
  "선택 필요",
  "press",
  "cnc",
  "injection",
  "welding",
  "compressor",
  "etc",
];

type HeroFlowStep = {
  index: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
};

function AiGuideHeroBanner({
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
function AccordionPanel({
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

export default function MyPage() {
  const storedData = useMemo(() => {
    if (typeof window === "undefined") return null;
    return loadStoredMyPageData();
  }, []);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [passwordTooltipOpen, setPasswordTooltipOpen] = useState(false);
  const [industryTooltipOpen, setIndustryTooltipOpen] = useState(false);
  const [annualRevenueTooltipOpen, setAnnualRevenueTooltipOpen] =
    useState(false);
  const [companyInfoTooltipOpen, setCompanyInfoTooltipOpen] = useState(false);
  const [capacityTooltipEquipmentId, setCapacityTooltipEquipmentId] = useState<
    number | null
  >(null);
  const [energyTooltipEquipmentId, setEnergyTooltipEquipmentId] = useState<
    number | null
  >(null);

  const [openSections, setOpenSections] = useState<
    Record<MyPagePanelKey, boolean>
  >({
    basic: false,
    company: false,
    equipment: false,
  });
  const [analysisBlockNoticeOpen, setAnalysisBlockNoticeOpen] = useState(false);

  const [profileCompleted, setProfileCompleted] = useState(
    storedData?.profileCompleted ?? false,
  );

  const [basicInfo, setBasicInfo] = useState<BasicInfo>(
    storedData?.basicInfo ?? emptyBasicInfo,
  );

  const [passwordInfo, setPasswordInfo] =
    useState<PasswordInfo>(emptyPasswordInfo);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(
    storedData?.companyInfo ?? emptyCompanyInfo,
  );

  const [equipmentList, setEquipmentList] = useState<EquipmentInfo[]>(
    storedData?.equipmentList && storedData.equipmentList.length > 0
      ? storedData.equipmentList
      : [createEmptyEquipment(1)],
  );

  const [selectedAnalysisEquipmentId, setSelectedAnalysisEquipmentId] =
    useState<number | null>(
      storedData?.selectedAnalysisEquipmentId ??
        storedData?.equipmentList?.[0]?.id ??
        1,
    );

  useEffect(() => {
    setBasicInfo((prev) => ({
      ...prev,
      phone: formatPhoneNumber(prev.phone),
      managerPhone: formatPhoneNumber(prev.managerPhone),
    }));

    setCompanyInfo((prev) => {
      const formattedCompanyInfo = {
        ...prev,
        businessNumber: formatBusinessNumber(prev.businessNumber),
        assetTotalManwon: formatCommaNumber(prev.assetTotalManwon),
        annualRevenue: formatCommaNumber(prev.annualRevenue),
        revenue2YearsAgo: formatCommaNumber(prev.revenue2YearsAgo),
        revenue3YearsAgo: formatCommaNumber(prev.revenue3YearsAgo),
      };

      if (JSON.stringify(formattedCompanyInfo) === JSON.stringify(prev)) {
        return prev;
      }

      return formattedCompanyInfo;
    });

    setEquipmentList((prev) => {
      const formattedEquipmentList = prev.map((equipment) => ({
        ...equipment,
        annualEnergyCost: formatCommaNumber(equipment.annualEnergyCost),
        maintenanceCostAnnual: formatCommaNumber(
          equipment.maintenanceCostAnnual,
        ),
        contributionMarginWon: formatCommaNumber(
          equipment.contributionMarginWon,
        ),
        scenarioAInvestment: formatCommaNumber(equipment.scenarioAInvestment),
        scenarioBInvestment: formatCommaNumber(equipment.scenarioBInvestment),
      }));

      if (JSON.stringify(formattedEquipmentList) === JSON.stringify(prev)) {
        return prev;
      }

      return formattedEquipmentList;
    });
  }, []);

  useEffect(() => {
    if (
      !equipmentList.some(
        (equipment) => equipment.id === selectedAnalysisEquipmentId,
      )
    ) {
      setSelectedAnalysisEquipmentId(equipmentList[0]?.id ?? null);
    }
  }, [equipmentList, selectedAnalysisEquipmentId]);

  const passwordStrength = useMemo(() => {
    return getPasswordStrength(passwordInfo.newPassword);
  }, [passwordInfo.newPassword]);

  const passwordChecks: [string, boolean][] = [
    ["8자 이상", passwordInfo.newPassword.length >= 8],
    ["영문 포함", /[A-Za-z]/.test(passwordInfo.newPassword)],
    ["숫자 포함", /[0-9]/.test(passwordInfo.newPassword)],
    ["특수문자 포함", /[^A-Za-z0-9]/.test(passwordInfo.newPassword)],
  ];

  const passwordMatched =
    !passwordInfo.confirmPassword ||
    passwordInfo.newPassword === passwordInfo.confirmPassword;

  const primaryIndustry = companyInfo.industries[0] ?? createEmptyIndustry(1);
  const optionalIndustries = companyInfo.industries.slice(1);
  const secondaryIndustry = optionalIndustries[0] ?? createEmptyIndustry(2);

  const basicInfoDone = useMemo(() => {
    return Boolean(
      basicInfo.name.trim() &&
      basicInfo.email.trim() &&
      basicInfo.phone.trim() &&
      passwordInfo.currentPassword.trim(),
    );
  }, [basicInfo, passwordInfo.currentPassword]);

  const industryInfoDone = useMemo(() => {
    return Boolean(
      primaryIndustry.industry.trim() && primaryIndustry.industryCode.trim(),
    );
  }, [primaryIndustry]);

  const companyInfoDone = useMemo(() => {
    return Boolean(
      companyInfo.companyName.trim() &&
      companyInfo.companyType !== "선택 필요" &&
      industryInfoDone &&
      companyInfo.region.trim() &&
      companyInfo.annualRevenue.trim(),
    );
  }, [companyInfo, industryInfoDone]);

  const completedEquipmentCount = useMemo(() => {
    return equipmentList.filter(hasRequiredEquipmentFields).length;
  }, [equipmentList]);

  const equipmentInfoDone = completedEquipmentCount > 0;

  const needsInputGuide = useMemo(() => {
    return !companyInfoDone || !equipmentInfoDone;
  }, [companyInfoDone, equipmentInfoDone]);

  const completionScore = useMemo(() => {
    const basicRequiredValues = [
      basicInfo.name,
      basicInfo.email,
      basicInfo.phone,
      passwordInfo.currentPassword,
    ];

    const companyRequiredValues = [
      companyInfo.companyName,
      companyInfo.companyType !== "선택 필요" ? companyInfo.companyType : "",
      primaryIndustry.industry,
      primaryIndustry.industryCode,
      companyInfo.region,
      companyInfo.annualRevenue,
    ];

    const companyOptionalValues = [
      secondaryIndustry.industry,
      secondaryIndustry.industryCode,
      companyInfo.employees,
      companyInfo.revenue2YearsAgo,
      companyInfo.revenue3YearsAgo,
      companyInfo.businessNumber,
      companyInfo.assetTotalManwon,
      companyInfo.affiliateStatus !== "선택 필요"
        ? companyInfo.affiliateStatus
        : "",
      companyInfo.purpose !== "선택 필요" ? companyInfo.purpose : "",
      companyInfo.foundedYear,
      companyInfo.businessSiteType !== "선택 필요"
        ? companyInfo.businessSiteType
        : "",
    ];

    const equipmentRequiredValues = equipmentList.flatMap((equipment) => [
      equipment.category !== "선택 필요" ? equipment.category : "",
      equipment.name,
      equipment.years,
      equipment.annualEnergyCost,
    ]);

    const equipmentOptionalValues = equipmentList.flatMap((equipment) => [
      equipment.process,
      equipment.defectRate,
      equipment.maintenanceCostAnnual,
      equipment.currentCapacityValue,
      equipment.productionQty,
      equipment.contributionMarginWon,
      equipment.scenarioAInvestment,
      equipment.scenarioBInvestment,
    ]);

    const basicScore = Math.round(
      (basicRequiredValues.filter(Boolean).length /
        basicRequiredValues.length) *
        20,
    );

    const companyRequiredScore = Math.round(
      (companyRequiredValues.filter(Boolean).length /
        companyRequiredValues.length) *
        35,
    );

    const companyOptionalScore = Math.round(
      (companyOptionalValues.filter(Boolean).length /
        companyOptionalValues.length) *
        10,
    );

    const equipmentRequiredScore =
      equipmentRequiredValues.length > 0
        ? Math.round(
            (equipmentRequiredValues.filter(Boolean).length /
              equipmentRequiredValues.length) *
              25,
          )
        : 0;

    const equipmentOptionalScore =
      equipmentOptionalValues.length > 0
        ? Math.round(
            (equipmentOptionalValues.filter(Boolean).length /
              equipmentOptionalValues.length) *
              10,
          )
        : 0;

    return Math.min(
      basicScore +
        companyRequiredScore +
        companyOptionalScore +
        equipmentRequiredScore +
        equipmentOptionalScore,
      100,
    );
  }, [
    basicInfo,
    passwordInfo.currentPassword,
    companyInfo,
    primaryIndustry,
    secondaryIndustry,
    equipmentList,
  ]);

  const missingCoreCount = useMemo(() => {
    let count = 0;

    if (!basicInfo.name.trim()) count += 1;
    if (!basicInfo.email.trim()) count += 1;
    if (!basicInfo.phone.trim()) count += 1;
    if (!passwordInfo.currentPassword.trim()) count += 1;
    if (!companyInfo.companyName.trim()) count += 1;
    if (companyInfo.companyType === "선택 필요") count += 1;
    if (!primaryIndustry.industry.trim()) count += 1;
    if (!primaryIndustry.industryCode.trim()) count += 1;
    if (!companyInfo.region.trim()) count += 1;
    if (!companyInfo.annualRevenue.trim()) count += 1;
    if (!equipmentInfoDone) count += 1;

    return count;
  }, [
    basicInfo,
    passwordInfo.currentPassword,
    companyInfo,
    primaryIndustry,
    equipmentInfoDone,
  ]);

  const updateIndustry = (
    id: number,
    key: keyof Omit<IndustryItem, "id">,
    value: string,
  ) => {
    setCompanyInfo((prev) => {
      const nextIndustries = prev.industries.map((item) => {
        if (item.id !== id) return item;

        if (key === "industry") {
          const codes = getIndustryCodeCandidates(value);

          return {
            ...item,
            industry: value,
            industryCode:
              codes.length > 0 ? formatIndustryCodes(codes) : item.industryCode,
          };
        }

        const upperValue = value.toUpperCase();
        const inferredIndustry = getIndustryNameByCode(upperValue);

        return {
          ...item,
          industryCode: upperValue,
          industry: inferredIndustry || item.industry,
        };
      });

      const first = nextIndustries[0] ?? createEmptyIndustry(1);

      return {
        ...prev,
        industries: nextIndustries,
        industry: first.industry,
        industryCode: first.industryCode,
      };
    });
  };

  const addIndustryRow = () => {
    setCompanyInfo((prev) => {
      const nextId =
        prev.industries.length > 0
          ? Math.max(...prev.industries.map((industry) => industry.id)) + 1
          : 1;

      return {
        ...prev,
        industries: [...prev.industries, createEmptyIndustry(nextId)],
      };
    });
  };

  const updateEquipment = (
    id: number,
    key: keyof EquipmentInfo,
    value: string,
  ) => {
    setEquipmentList((prev) =>
      prev.map((equipment) =>
        equipment.id === id
          ? {
              ...equipment,
              [key]: value,
            }
          : equipment,
      ),
    );
  };

  const addEquipment = () => {
    const nextId =
      equipmentList.length > 0
        ? Math.max(...equipmentList.map((equipment) => equipment.id)) + 1
        : 1;

    setEquipmentList((prev) => [...prev, createEmptyEquipment(nextId)]);

    if (!selectedAnalysisEquipmentId) {
      setSelectedAnalysisEquipmentId(nextId);
    }
  };

  const removeEquipment = (id: number) => {
    if (equipmentList.length <= 1) {
      window.alert("설비 정보는 최소 1개 이상 필요합니다.");
      return;
    }

    setEquipmentList((prev) => prev.filter((equipment) => equipment.id !== id));

    if (selectedAnalysisEquipmentId === id) {
      const remain = equipmentList.filter((equipment) => equipment.id !== id);
      setSelectedAnalysisEquipmentId(remain[0]?.id ?? null);
    }
  };

  const toggleSection = (sectionKey: MyPagePanelKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };


  const selectedEquipmentLabel = useMemo(() => {
    const selected = equipmentList.find(
      (item) => item.id === selectedAnalysisEquipmentId,
    );

    if (!selected) return "선택 없음";

    return selected.name.trim()
      ? selected.name
      : `설비 ${equipmentList.findIndex((item) => item.id === selected.id) + 1}`;
  }, [equipmentList, selectedAnalysisEquipmentId]);

  const hasBlockingAnalysisMissing = useMemo(() => {
    if (!basicInfo.name.trim()) return true;
    if (!basicInfo.email.trim()) return true;
    if (!basicInfo.phone.trim()) return true;
    if (!passwordInfo.currentPassword.trim()) return true;

    if (!companyInfo.companyName.trim()) return true;
    if (companyInfo.companyType === "선택 필요") return true;
    if (!primaryIndustry.industry.trim()) return true;
    if (!primaryIndustry.industryCode.trim()) return true;
    if (!companyInfo.region.trim()) return true;
    if (!companyInfo.annualRevenue.trim()) return true;

    const selectedEquipment = equipmentList.find(
      (equipment) => equipment.id === selectedAnalysisEquipmentId,
    );

    if (!selectedEquipment) return true;
    if (!hasRequiredEquipmentFields(selectedEquipment)) return true;

    return false;
  }, [
    basicInfo,
    passwordInfo.currentPassword,
    companyInfo,
    primaryIndustry,
    equipmentList,
    selectedAnalysisEquipmentId,
  ]);

  const handleSave = async () => {
    if (saving) return;

    const activeIndustries = companyInfo.industries.filter((item) => {
      return item.industry.trim() || item.industryCode.trim();
    });

    const industryCodes = activeIndustries.flatMap((item) =>
      parseIndustryCodes(item.industryCode),
    );

    const uniqueIndustryCodes: string[] = Array.from(new Set(industryCodes));
    const primaryIndustryCode = uniqueIndustryCodes[0] ?? "C";

    const industryName =
      activeIndustries
        .map((item) => item.industry.trim())
        .filter(Boolean)
        .join(", ") ||
      getIndustryNameByCode(primaryIndustryCode) ||
      companyInfo.industry.trim() ||
      "제조업";

    const employeeCount = toNumberOrNull(
      normalizeCommaNumber(companyInfo.employees),
    );
    const annualRevenue = toNumberOrNull(
      normalizeCommaNumber(companyInfo.annualRevenue),
    );
    const revenue2YearsAgo = toNumberOrNull(
      normalizeCommaNumber(companyInfo.revenue2YearsAgo),
    );
    const revenue3YearsAgo = toNumberOrNull(
      normalizeCommaNumber(companyInfo.revenue3YearsAgo),
    );
    const establishedYear = toNumberOrNull(companyInfo.foundedYear);

    const completedEquipments = equipmentList.filter(
      hasRequiredEquipmentFields,
    );

    const missingFields: string[] = [];

    if (!basicInfo.name.trim()) missingFields.push("이름");
    if (!basicInfo.email.trim()) missingFields.push("이메일");
    if (!basicInfo.phone.trim()) missingFields.push("연락처");
    if (!passwordInfo.currentPassword.trim())
      missingFields.push("현재 비밀번호");

    if (passwordInfo.newPassword.trim()) {
      if (passwordChecks.some(([, passed]) => !passed)) {
        missingFields.push("새 비밀번호 조건 충족");
      }

      if (!passwordInfo.confirmPassword.trim()) {
        missingFields.push("새 비밀번호 확인");
      } else if (passwordInfo.newPassword !== passwordInfo.confirmPassword) {
        missingFields.push("새 비밀번호 확인 일치");
      }
    }

    if (!companyInfo.companyName.trim()) missingFields.push("기업명");
    if (companyInfo.companyType === "선택 필요") missingFields.push("기업규모");
    if (!primaryIndustry.industry.trim()) missingFields.push("업종명");
    if (!primaryIndustry.industryCode.trim()) missingFields.push("업종코드");
    if (!companyInfo.region.trim()) missingFields.push("지역");
    if (annualRevenue === null) missingFields.push("연매출액");

    if (completedEquipments.length === 0) {
      missingFields.push("설비 정보 1개 이상");
    }

    if (missingFields.length > 0) {
      setAnalysisBlockNoticeOpen(true);
      return;
    }

    const accessToken = getAccessToken();

    if (!accessToken) {
      window.alert(
        "로그인 인증 토큰을 찾지 못했습니다. 다시 로그인한 뒤 저장해주세요.",
      );
      return;
    }

    const userId = getCurrentUserId();

    const userPayload: UserProfilePayload = {
      name: basicInfo.name.trim(),
      phone: normalizePhoneNumber(basicInfo.phone),
    };

    const companyPayload: CompanyOnboardingPayload = {
      company_name: companyInfo.companyName.trim(),
      industry_name: industryName,
      industry_code:
        uniqueIndustryCodes.length > 0 ? uniqueIndustryCodes : ["C"],
      region: companyInfo.region.trim(),
      business_registration_no:
        normalizeBusinessNumber(companyInfo.businessNumber) || null,
      company_type: companyInfo.companyType,
      primary_purpose:
        companyInfo.purpose === "선택 필요" ? [] : [companyInfo.purpose],
      employee_count: employeeCount,
      annual_revenue: annualRevenue ?? 0,
      revenue_2y_ago_manwon: revenue2YearsAgo,
      revenue_3y_ago_manwon: revenue3YearsAgo,
      total_assets_manwon: toNumberOrNull(
        normalizeCommaNumber(companyInfo.assetTotalManwon),
      ),
      is_disclosure_group_member:
        companyInfo.affiliateStatus === "선택 필요" ||
        companyInfo.affiliateStatus === "확인 필요"
          ? null
          : companyInfo.affiliateStatus === "대기업 계열사 소속",
      established_year: establishedYear,
      workplace_type:
        companyInfo.businessSiteType === "선택 필요"
          ? null
          : companyInfo.businessSiteType,
    };

    const equipmentPayloads = completedEquipments.map((equipment) => ({
      localId: equipment.id,
      payload: {
        name: equipment.name.trim(),
        category:
          equipment.category === "선택 필요" ? "etc" : equipment.category,
        process: equipment.process.trim() || null,
        age_years: toPositiveNumber(equipment.years) ?? 0,
        energy_cost_annual:
          toPositiveNumber(normalizeCommaNumber(equipment.annualEnergyCost)) ??
          0,
        defect_rate: toNumberOrNull(equipment.defectRate),
        maintenance_cost_annual: toNumberOrNull(
          normalizeCommaNumber(equipment.maintenanceCostAnnual),
        ),
        current_capacity_value: toNumberOrNull(equipment.currentCapacityValue),
        production_qty: toNumberOrNull(equipment.productionQty),
        contribution_margin_won: toNumberOrNull(
          normalizeCommaNumber(equipment.contributionMarginWon),
        ),
        scenario_a_investment_manwon: toNumberOrNull(
          normalizeCommaNumber(equipment.scenarioAInvestment),
        ),
        scenario_b_investment_manwon: toNumberOrNull(
          normalizeCommaNumber(equipment.scenarioBInvestment),
        ),
      } satisfies EquipmentPayload,
    }));

    const savedProfileCompleted =
      basicInfoDone && companyInfoDone && equipmentInfoDone;

    try {
      setSaving(true);

      console.log("온보딩 user 요청 payload:", userPayload);
      await submitUserPayload(userPayload);

      console.log("온보딩 company 요청 payload:", companyPayload);
      const { responseData: companyResponseData, companyId } =
        await submitCompanyPayload(companyPayload);

      let nextEquipmentList = [...equipmentList];
      const equipmentResponses = [];

      for (const item of equipmentPayloads) {
        console.log("온보딩 equipment 요청 payload:", {
          companyId,
          equipmentPayload: item.payload,
        });

        const equipmentResponse = await submitEquipmentPayload(
          companyId,
          item.payload,
        );

        equipmentResponses.push(equipmentResponse);

        const equipmentId = findEquipmentId(equipmentResponse);

        if (equipmentId) {
          nextEquipmentList = nextEquipmentList.map((equipment) =>
            equipment.id === item.localId
              ? {
                  ...equipment,
                  equipmentId,
                }
              : equipment,
          );
        }
      }

      const storageData: MyPageStorageData = {
        basicInfo,
        companyInfo: {
          ...companyInfo,
          industry: activeIndustries[0]?.industry ?? companyInfo.industry,
          industryCode:
            activeIndustries[0]?.industryCode ?? companyInfo.industryCode,
        },
        equipmentList: nextEquipmentList,
        selectedAnalysisEquipmentId,
        profileCompleted: savedProfileCompleted,
        savedAt: new Date().toISOString(),
      };

      const savedOnboarding = await fetchSavedOnboarding();

      setEquipmentList(nextEquipmentList);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

      if (userId) {
        window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
      }

      window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, companyId);

      console.log(
        "저장된 user_id:",
        userId ?? "auth session에서 user_id 미확인",
      );
      console.log("저장된 company_id:", companyId);
      console.log("company 저장 응답:", companyResponseData);
      console.log("equipment 저장 응답:", equipmentResponses);
      console.log("온보딩 조회 응답:", savedOnboarding);

      setSaved(true);
      setProfileCompleted(savedProfileCompleted);

      window.setTimeout(() => {
        setSaved(false);
      }, 2400);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const confirmed = window.confirm("입력한 마이페이지 정보를 초기화할까요?");
    if (!confirmed) return;

    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(COMPANY_ID_STORAGE_KEY);
    window.localStorage.removeItem(ANALYSIS_RESULT_STORAGE_KEY);

    setBasicInfo(emptyBasicInfo);
    setPasswordInfo(emptyPasswordInfo);
    setCompanyInfo(emptyCompanyInfo);
    setEquipmentList([createEmptyEquipment(1)]);
    setSelectedAnalysisEquipmentId(1);
    setProfileCompleted(false);
  };

  const goToAnalysis = async () => {
    if (analyzing) return;

    if (hasBlockingAnalysisMissing) {
      setAnalysisBlockNoticeOpen(true);
      return;
    }

    const companyId = window.localStorage.getItem(COMPANY_ID_STORAGE_KEY);

    if (!companyId) {
      window.alert(
        "먼저 저장하기를 눌러 기업·설비 정보를 저장한 뒤 분석을 시작해주세요.",
      );
      return;
    }

    const selectedEquipment = equipmentList.find(
      (equipment) => equipment.id === selectedAnalysisEquipmentId,
    );

    if (!selectedEquipment) {
      window.alert("ROI 분석에 사용할 설비를 선택해주세요.");
      return;
    }

    try {
      setAnalyzing(true);

      const equipmentQuery = selectedEquipment.equipmentId
        ? `&equipment_id=${encodeURIComponent(selectedEquipment.equipmentId)}`
        : "";

      const query = `/api/analyze?company_id=${encodeURIComponent(
        companyId,
      )}${equipmentQuery}`;

      const accessToken = getAccessToken();

      const response = await fetch(buildApiUrl(query), {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
      });

      const responseText = await response.text();
      const analysisResult = safeJsonParse(responseText);

      if (!response.ok) {
        console.error("분석 API 오류:", {
          status: response.status,
          companyId,
          equipmentId: selectedEquipment.equipmentId,
          response: analysisResult ?? responseText,
        });

        throw new Error(getApiErrorMessage(analysisResult, response.status));
      }

      window.localStorage.setItem(
        ANALYSIS_RESULT_STORAGE_KEY,
        JSON.stringify({
          ...analysisResult,
          selected_equipment_id: selectedEquipment.equipmentId ?? null,
          selected_equipment_local_id: selectedAnalysisEquipmentId,
        }),
      );

      console.log("분석 결과:", analysisResult);
      window.location.assign("/dashboard");
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="page">
      <style>{`
        details > summary::-webkit-details-marker { display: none !important; }
        details > summary::marker { content: "" !important; }
        details > summary { list-style: none !important; }
        @media (max-width: 960px) {
          .ff-mypage-hero-grid,
          .ff-mypage-ai-banner-grid,
          .ff-mypage-service-flow,
          .ff-mypage-two-col,
          .ff-mypage-three-col,
          .ff-mypage-four-col,
          .ff-mypage-ai-summary-grid,
          .ff-mypage-analysis-bar {
            grid-template-columns: 1fr !important;
          }
          .ff-mypage-analysis-actions {
            justify-content: stretch !important;
          }
          .ff-mypage-analysis-actions > button {
            width: 100% !important;
          }
        }
      `}</style>
      <AppHeader />

      <FloatingModalNotice
        open={analysisBlockNoticeOpen}
        title="필수 정보를 먼저 입력해주세요."
        description={"기본정보, 기업정보, 설비현황의 필수 항목이\n모두 입력되어야 분석을 시작할 수 있습니다."}
        description2="필수값을 입력하고 저장한 뒤 다시 분석하기를 눌러주세요."
        onClose={() => setAnalysisBlockNoticeOpen(false)}
      />


      <section
        style={{
          background: "#F8FAFC",
          padding: "56px clamp(22px,5vw,80px) 96px",
        }}
      >
        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "0 auto",
          }}
        >
          <div
            className="ff-mypage-hero-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.85fr",
              gap: "40px",
              alignItems: "end",
              marginBottom: "30px",
            }}
          >
            <div>
              <div
                style={{
                  width: "122px",
                  height: "4px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, #C68B3C 50%, rgba(255,255,255,0) 100%)",
                  marginBottom: "16px",
                }}
              />

              <div className="screen-tag">FACTOFIT MY PAGE</div>

              <div
                className="label"
                style={{
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                ACCOUNT & COMPANY PROFILE
              </div>

              <h1
                style={{
                  color: "#061B34",
                  fontSize: "56px",
                  lineHeight: 1.12,
                  fontWeight: 900,
                  letterSpacing: "-2px",
                  margin: 0,
                }}
              >
                내 정보와 기업 정보를 <br />
                한곳에서 관리합니다.
              </h1>

              <div
                style={{
                  width: "130px",
                  height: "3px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, rgba(52,75,160,0) 100%)",
                  marginTop: "24px",
                }}
              />
            </div>

            <p
              style={{
                color: "#667085",
                fontSize: "16px",
                lineHeight: 1.8,
                fontWeight: 900,
                margin: 0,
              }}
            >
              회원가입 이후 기업·설비 정보를 입력하면 FactoFit이 ROI 분석,
              지원사업 추천, 신청 준비도를 더 정확하게 계산할 수 있습니다.
            </p>
          </div>

          <AiGuideHeroBanner
            completionScore={completionScore}
            missingCoreCount={missingCoreCount}
            needsInputGuide={needsInputGuide}
            savedPolicyCount={savedPolicies.length}
            completedEquipmentCount={completedEquipmentCount}
            analysisHistoryCount={analysisHistories.length}
          />

          <div
            style={{
              display: "grid",
              gap: "24px",
            }}
          >
            <AccordionPanel
              title="기본정보"
              description="사용자 계정과 담당자 정보를 관리합니다."
              badge={<span className="badge blue">필수 + 선택</span>}
              open={openSections.basic}
              onToggle={() => toggleSection("basic")}
            >
              <div
                className="ff-mypage-two-col"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                <Field
                  label="이름"
                  required
                  value={basicInfo.name}
                  placeholder="예: 홍길동"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({ ...prev, name: value }))
                  }
                />

                <Field
                  label="이메일"
                  required
                  value={basicInfo.email}
                  placeholder="예: user@example.com"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({ ...prev, email: value }))
                  }
                />
              </div>

              <Field
                label="연락처"
                required
                value={basicInfo.phone}
                placeholder="예: 010-1234-5678"
                onChange={(value) =>
                  setBasicInfo((prev) => ({
                    ...prev,
                    phone: formatPhoneNumber(value),
                  }))
                }
              />

              <label style={{ display: "grid", gap: "9px" }}>
                <FieldLabel
                  label="현재 비밀번호"
                  required
                  right={
                    <span
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      onMouseEnter={() => setPasswordTooltipOpen(true)}
                      onMouseLeave={() => setPasswordTooltipOpen(false)}
                      onFocus={() => setPasswordTooltipOpen(true)}
                      onBlur={() => setPasswordTooltipOpen(false)}
                    >
                      <button
                        type="button"
                        aria-label="비밀번호 변경 안내"
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "999px",
                          border: "0",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#F1F5F9",
                          color: "#64748B",
                          fontSize: "11px",
                          fontWeight: 800,
                          cursor: "help",
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        i
                      </button>

                      <InfoTooltip
                        open={passwordTooltipOpen}
                        text="비밀번호를 변경한 뒤에는 맨 아래의 저장하기 버튼을 눌러야 최종 적용됩니다."
                      />
                    </span>
                  }
                />

                <input
                  type="password"
                  value={passwordInfo.currentPassword}
                  placeholder="현재 비밀번호"
                  onChange={(event) =>
                    setPasswordInfo((prev) => ({
                      ...prev,
                      currentPassword: event.target.value,
                    }))
                  }
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
              </label>

              <div
                className="ff-mypage-two-col"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <Field
                  label="새 비밀번호"
                  value={passwordInfo.newPassword}
                  placeholder="새 비밀번호"
                  type="password"
                  onChange={(value) =>
                    setPasswordInfo((prev) => ({ ...prev, newPassword: value }))
                  }
                />

                <Field
                  label="새 비밀번호 확인"
                  value={passwordInfo.confirmPassword}
                  placeholder="새 비밀번호 확인"
                  type="password"
                  onChange={(value) =>
                    setPasswordInfo((prev) => ({
                      ...prev,
                      confirmPassword: value,
                    }))
                  }
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    height: "10px",
                    borderRadius: "999px",
                    background: "#E5E7EB",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${passwordStrength.percent}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: passwordStrength.color,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      minHeight: "32px",
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: "999px",
                      padding: "0 13px",
                      color: passwordStrength.color,
                      background: passwordStrength.bg,
                      fontSize: "12px",
                      fontWeight: 950,
                    }}
                  >
                    비밀번호 보안 수준 · {passwordStrength.label}
                  </span>

                  {passwordChecks.map(([label, passed]) => (
                    <span
                      key={label}
                      style={{
                        minHeight: "32px",
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "999px",
                        padding: "0 13px",
                        color: passed ? "#0B7A53" : "#94A3B8",
                        background: passed ? "#E6F6EF" : "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      · {label}
                    </span>
                  ))}
                </div>

                <p
                  style={{
                    color: passwordMatched ? "#0B7A53" : "#CD2E3A",
                    fontSize: "13px",
                    fontWeight: 900,
                    margin: 0,
                  }}
                >
                  {passwordMatched
                    ? "새 비밀번호가 일치합니다."
                    : "새 비밀번호 확인이 일치하지 않습니다."}
                </p>
              </div>

              <div
                className="ff-mypage-two-col"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <Field
                  label="담당자명"
                  selectable
                  value={basicInfo.manager}
                  placeholder="예: 홍길동"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({ ...prev, manager: value }))
                  }
                />

                <Field
                  label="담당자 연락처"
                  selectable
                  value={basicInfo.managerPhone}
                  placeholder="예: 010-0000-0000"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      managerPhone: formatPhoneNumber(value),
                    }))
                  }
                />
              </div>

              <div
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "26px",
                  padding: "24px",
                  background: "#FFFFFF",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "18px",
                  alignItems: "start",
                }}
              >
                <div>
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "20px",
                      fontWeight: 950,
                      letterSpacing: "-.3px",
                      margin: 0,
                    }}
                  >
                    프로필 저장 상태
                  </h3>

                  <p
                    style={{
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                      lineHeight: 1.6,
                      margin: "8px 0 0",
                    }}
                  >
                    저장 후 기업·설비 정보가 맞춤 분석 기준으로 사용됩니다.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      marginTop: "18px",
                    }}
                  >
                    <ChecklistItem
                      done={basicInfoDone}
                      label="기본 정보 입력"
                    />
                    <ChecklistItem
                      done={companyInfoDone}
                      label="기업정보 입력"
                    />
                    <ChecklistItem
                      done={equipmentInfoDone}
                      label="설비 1개 이상 등록"
                    />
                  </div>
                </div>

                <span
                  style={{
                    minHeight: "38px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    padding: "0 16px",
                    background: profileCompleted ? "#E6F6EF" : "#FFF4E5",
                    color: profileCompleted ? "#0B7A53" : "#B45309",
                    fontSize: "13px",
                    fontWeight: 950,
                    whiteSpace: "nowrap",
                  }}
                >
                  {profileCompleted ? "저장 완료" : "저장 필요"}
                </span>
              </div>
            </AccordionPanel>

            <AccordionPanel
              id="company-profile-form"
              title="기업정보"
              description="지원사업 추천 기준으로 사용되는 정보입니다."
              badge={<span className="badge green">매칭 기준</span>}
              open={openSections.company}
              onToggle={() => toggleSection("company")}
            >
              <div
                className="ff-mypage-two-col"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                <Field
                  label="기업명"
                  required
                  value={companyInfo.companyName}
                  placeholder="예: 평우제조"
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({ ...prev, companyName: value }))
                  }
                />

                <SelectField
                  label="기업 규모"
                  required
                  value={companyInfo.companyType}
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({ ...prev, companyType: value }))
                  }
                  options={COMPANY_TYPE_OPTIONS}
                  helperText="company_type 필수값입니다."
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "16px",
                }}
              >
                <div
                  className="ff-mypage-two-col"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 0.72fr",
                    gap: "16px",
                    alignItems: "start",
                  }}
                >
                  <label style={{ display: "grid", gap: "9px" }}>
                    <FieldLabel
                      label="업종명"
                      required
                      right={
                        <span
                          style={{
                            position: "relative",
                            display: "inline-flex",
                          }}
                          onMouseEnter={() => setIndustryTooltipOpen(true)}
                          onMouseLeave={() => setIndustryTooltipOpen(false)}
                          onFocus={() => setIndustryTooltipOpen(true)}
                          onBlur={() => setIndustryTooltipOpen(false)}
                        >
                          <button
                            type="button"
                            aria-label="업종명 안내"
                            style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "999px",
                              border: 0,
                              background: "#F1F5F9",
                              color: "#64748B",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "help",
                            }}
                          >
                            i
                          </button>
                          <InfoTooltip
                            open={industryTooltipOpen}
                            text="업종명과 업종코드는 지원사업 대상 업종을 판별하는 기준입니다. 주업종은 필수, 부업종은 선택입니다."
                          />
                        </span>
                      }
                    />
                    <input
                      value={primaryIndustry.industry}
                      placeholder="예: 바이오"
                      onChange={(event) =>
                        updateIndustry(
                          primaryIndustry.id,
                          "industry",
                          event.target.value,
                        )
                      }
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
                  </label>

                  <Field
                    label="업종코드"
                    required
                    value={primaryIndustry.industryCode}
                    placeholder="예: C21"
                    onChange={(value) =>
                      updateIndustry(primaryIndustry.id, "industryCode", value)
                    }
                  />
                </div>

                {optionalIndustries.map((industryItem, index) => (
                  <div
                    key={industryItem.id}
                    className="ff-mypage-two-col"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 0.72fr",
                      gap: "16px",
                      alignItems: "start",
                    }}
                  >
                    <Field
                      label="업종명"
                      selectable
                      value={industryItem.industry}
                      placeholder={index === 0 ? "예: 금속" : "예: 금속가공"}
                      onChange={(value) =>
                        updateIndustry(industryItem.id, "industry", value)
                      }
                    />

                    <Field
                      label="업종코드"
                      selectable
                      value={industryItem.industryCode}
                      placeholder={index === 0 ? "예: C24, C25" : "예: C25"}
                      onChange={(value) =>
                        updateIndustry(industryItem.id, "industryCode", value)
                      }
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addIndustryRow}
                  style={{
                    width: "100%",
                    minHeight: "64px",
                    borderRadius: "22px",
                    border: "1px dashed rgba(52,75,160,.34)",
                    background: "#FFFFFF",
                    color: "#344BA0",
                    fontSize: "16px",
                    fontWeight: 950,
                    letterSpacing: "-.2px",
                    cursor: "pointer",
                  }}
                >
                  + 업종 추가하기
                </button>
              </div>

              <div
                className="ff-mypage-two-col"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 0.72fr",
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                <Field
                  label="지역"
                  required
                  value={companyInfo.region}
                  placeholder="예: 경기 안산"
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({ ...prev, region: value }))
                  }
                />

                <Field
                  label="직원 수"
                  selectable
                  value={companyInfo.employees}
                  placeholder="예: 10"
                  inputMode="numeric"
                  onChange={(value) =>
                    setCompanyInfo((prev) => ({
                      ...prev,
                      employees: formatCommaNumber(value),
                    }))
                  }
                />
              </div>

              <label style={{ display: "grid", gap: "9px" }}>
                <FieldLabel
                  label="연매출액"
                  required
                  right={
                    <span
                      style={{ position: "relative", display: "inline-flex" }}
                      onMouseEnter={() => setAnnualRevenueTooltipOpen(true)}
                      onMouseLeave={() => setAnnualRevenueTooltipOpen(false)}
                      onFocus={() => setAnnualRevenueTooltipOpen(true)}
                      onBlur={() => setAnnualRevenueTooltipOpen(false)}
                    >
                      <button
                        type="button"
                        aria-label="연매출액 안내"
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "999px",
                          border: 0,
                          background: "#F1F5F9",
                          color: "#64748B",
                          fontSize: "11px",
                          fontWeight: 800,
                          cursor: "help",
                        }}
                      >
                        i
                      </button>
                      <InfoTooltip
                        open={annualRevenueTooltipOpen}
                        text={`단위는 만원입니다. ${CURRENT_YEAR}년 기준 ${PREVIOUS_YEAR}년 매출액을 입력하면 됩니다.`}
                      />
                    </span>
                  }
                />
                <input
                  value={companyInfo.annualRevenue}
                  placeholder="예: 100000"
                  inputMode="numeric"
                  onChange={(event) =>
                    setCompanyInfo((prev) => ({
                      ...prev,
                      annualRevenue: formatCommaNumber(event.target.value),
                    }))
                  }
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
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="badge">단위: 만원</span>
                  <span className="badge">예: 10억 원 = 100000</span>
                  <span className="badge">
                    {CURRENT_YEAR}년 기준 {PREVIOUS_YEAR}년 매출액
                  </span>
                </div>
              </label>

              <section
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "26px",
                  padding: "22px",
                  background: "#FFFFFF",
                  display: "grid",
                  gap: "18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "18px",
                      fontWeight: 950,
                      margin: 0,
                    }}
                  >
                    최근 3개년 매출액
                  </h3>
                  <SelectChip />
                </div>

                <div
                  className="ff-mypage-two-col"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <Field
                    label={`${TWO_YEARS_AGO}년 매출액`}
                    value={companyInfo.revenue2YearsAgo}
                    placeholder="예: 95,000"
                    helperText="단위: 만원"
                    inputMode="numeric"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        revenue2YearsAgo: formatCommaNumber(value),
                      }))
                    }
                  />

                  <Field
                    label={`${THREE_YEARS_AGO}년 매출액`}
                    value={companyInfo.revenue3YearsAgo}
                    placeholder="예: 90,000"
                    helperText="단위: 만원"
                    inputMode="numeric"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        revenue3YearsAgo: formatCommaNumber(value),
                      }))
                    }
                  />
                </div>

                <p
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 850,
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  입력하지 않으면 직전년도 매출액을 기준으로 3년 평균값을
                  계산합니다.
                </p>
              </section>

              <section
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "26px",
                  padding: "22px",
                  background: "#FFFFFF",
                  display: "grid",
                  gap: "18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "18px",
                      fontWeight: 950,
                      margin: 0,
                    }}
                  >
                    선택정보 입력하기
                  </h3>
                  <SelectChip />
                  <span
                    style={{ position: "relative", display: "inline-flex" }}
                    onMouseEnter={() => setCompanyInfoTooltipOpen(true)}
                    onMouseLeave={() => setCompanyInfoTooltipOpen(false)}
                    onFocus={() => setCompanyInfoTooltipOpen(true)}
                    onBlur={() => setCompanyInfoTooltipOpen(false)}
                  >
                    <button
                      type="button"
                      aria-label="기업 선택정보 안내"
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "999px",
                        border: 0,
                        background: "#F1F5F9",
                        color: "#64748B",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "help",
                      }}
                    >
                      i
                    </button>
                    <InfoTooltip
                      open={companyInfoTooltipOpen}
                      text="선택정보는 필수는 아니지만, 지원사업 매칭과 신청서 초안 생성 시 보조 기준으로 사용됩니다."
                    />
                  </span>
                </div>

                <div
                  className="ff-mypage-two-col"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    alignItems: "start",
                  }}
                >
                  <Field
                    label="사업자등록번호"
                    value={companyInfo.businessNumber}
                    placeholder="예: 123-45-67890"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        businessNumber: formatBusinessNumber(value),
                      }))
                    }
                  />

                  <Field
                    label="기업자산 총액"
                    value={companyInfo.assetTotalManwon}
                    placeholder="예: 500,000"
                    helperText="단위: 만원"
                    inputMode="numeric"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        assetTotalManwon: formatCommaNumber(value),
                      }))
                    }
                  />
                </div>

                <div
                  className="ff-mypage-two-col"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <SelectField
                    label="대기업 계열사 여부"
                    selectable={false}
                    value={companyInfo.affiliateStatus}
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        affiliateStatus: value,
                      }))
                    }
                    options={AFFILIATE_STATUS_OPTIONS}
                  />

                  <Field
                    label="설립연도"
                    value={companyInfo.foundedYear}
                    placeholder="예: 2024"
                    inputMode="numeric"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        foundedYear: value,
                      }))
                    }
                  />
                </div>

                <div
                  className="ff-mypage-two-col"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <SelectField
                    label="사업장 유형"
                    selectable={false}
                    value={companyInfo.businessSiteType}
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        businessSiteType: value,
                      }))
                    }
                    options={BUSINESS_SITE_TYPE_OPTIONS}
                  />

                  <SelectField
                    label="주요 목적"
                    selectable={false}
                    value={companyInfo.purpose}
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({ ...prev, purpose: value }))
                    }
                    options={PURPOSE_OPTIONS}
                  />
                </div>
              </section>
            </AccordionPanel>

            <AccordionPanel
              id="equipment-profile-form"
              title="설비현황"
              description="ROI 분석과 안전점검에 사용할 설비 정보를 관리합니다."
              badge={
                <span className="badge blue">
                  ROI 분석 대상: {selectedEquipmentLabel}
                </span>
              }
              open={openSections.equipment}
              onToggle={() => toggleSection("equipment")}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginTop: "-8px",
                }}
              >
                <button
                  type="button"
                  className="btn blue"
                  onClick={addEquipment}
                  style={{ minWidth: "150px" }}
                >
                  설비 추가
                </button>
              </div>

              <div style={{ display: "grid", gap: "22px" }}>
                {equipmentList.map((equipment, index) => {
                  const isSelected =
                    equipment.id === selectedAnalysisEquipmentId;

                  return (
                    <article
                      key={equipment.id}
                      style={{
                        border: isSelected
                          ? "2px solid rgba(52,75,160,.34)"
                          : "1px solid #E2E8F0",
                        borderRadius: "28px",
                        background: "#FFFFFF",
                        padding: "24px",
                        boxShadow: isSelected
                          ? "0 16px 38px rgba(52,75,160,.09)"
                          : "0 10px 24px rgba(15,23,42,.04)",
                        display: "grid",
                        gap: "22px",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: "16px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAnalysisEquipmentId(equipment.id)
                          }
                          style={{
                            border: 0,
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "999px",
                              background: isSelected ? "#344BA0" : "#EEF2FF",
                              color: isSelected ? "#FFFFFF" : "#344BA0",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "15px",
                              fontWeight: 950,
                              flexShrink: 0,
                            }}
                          >
                            {isSelected ? "✓" : index + 1}
                          </span>

                          <span>
                            <strong
                              style={{
                                display: "block",
                                color: "#061B34",
                                fontSize: "20px",
                                fontWeight: 950,
                                letterSpacing: "-.3px",
                              }}
                            >
                              {equipment.name.trim() || `설비 ${index + 1}`}
                            </strong>
                            <span
                              style={{
                                display: "block",
                                color: "#667085",
                                fontSize: "13px",
                                fontWeight: 850,
                                marginTop: "4px",
                              }}
                            >
                              {isSelected
                                ? "현재 ROI 분석 대상"
                                : "클릭하면 ROI 분석 대상으로 선택"}
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => removeEquipment(equipment.id)}
                          style={{
                            height: "40px",
                            borderRadius: "999px",
                            border: "1px solid #FEE2E2",
                            background: "#FFFFFF",
                            color: "#CD2E3A",
                            padding: "0 16px",
                            fontSize: "13px",
                            fontWeight: 950,
                            cursor: "pointer",
                          }}
                        >
                          삭제
                        </button>
                      </div>

                      <section
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "24px",
                          padding: "20px",
                          display: "grid",
                          gap: "18px",
                        }}
                      >
                        <h3
                          style={{
                            color: "#061B34",
                            fontSize: "17px",
                            fontWeight: 950,
                            margin: 0,
                          }}
                        >
                          설비 기본정보
                        </h3>

                        <div
                          className="ff-mypage-three-col"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.1fr 1fr 1fr",
                            gap: "16px",
                            alignItems: "start",
                          }}
                        >
                          <SelectField
                            label="설비 종류"
                            required
                            value={equipment.category}
                            onChange={(value) =>
                              updateEquipment(equipment.id, "category", value)
                            }
                            options={EQUIPMENT_CATEGORY_OPTIONS}
                          />

                          <Field
                            label="설비명"
                            required
                            value={equipment.name}
                            placeholder="예: 프레스 1호기"
                            onChange={(value) =>
                              updateEquipment(equipment.id, "name", value)
                            }
                          />

                          <Field
                            label="공정"
                            selectable
                            value={equipment.process}
                            placeholder="예: 프레스"
                            onChange={(value) =>
                              updateEquipment(equipment.id, "process", value)
                            }
                          />
                        </div>

                        <div
                          className="ff-mypage-three-col"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "0.8fr 1fr 1fr",
                            gap: "16px",
                            alignItems: "start",
                          }}
                        >
                          <Field
                            label="설비 사용연수"
                            required
                            value={equipment.years}
                            placeholder="예: 10"
                            helperText="단위: 년"
                            inputMode="numeric"
                            onChange={(value) =>
                              updateEquipment(equipment.id, "years", value)
                            }
                          />

                          <Field
                            label="연간 에너지 비용"
                            required
                            value={equipment.annualEnergyCost}
                            placeholder="예: 5,000"
                            helperText="단위: 만원"
                            inputMode="numeric"
                            labelRight={
                              <span
                                style={{
                                  position: "relative",
                                  display: "inline-flex",
                                }}
                                onMouseEnter={() =>
                                  setEnergyTooltipEquipmentId(equipment.id)
                                }
                                onMouseLeave={() =>
                                  setEnergyTooltipEquipmentId(null)
                                }
                                onFocus={() =>
                                  setEnergyTooltipEquipmentId(equipment.id)
                                }
                                onBlur={() => setEnergyTooltipEquipmentId(null)}
                              >
                                <button
                                  type="button"
                                  aria-label="연간 에너지 비용 안내"
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "999px",
                                    border: 0,
                                    background: "#F1F5F9",
                                    color: "#64748B",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    cursor: "help",
                                  }}
                                >
                                  i
                                </button>
                                <InfoTooltip
                                  open={
                                    energyTooltipEquipmentId === equipment.id
                                  }
                                  text="해당 설비를 1년 동안 운영하는 전기·가스 등 에너지 비용을 만원 단위로 입력합니다."
                                />
                              </span>
                            }
                            onChange={(value) =>
                              updateEquipment(
                                equipment.id,
                                "annualEnergyCost",
                                formatCommaNumber(value),
                              )
                            }
                          />

                          <Field
                            label="불량률"
                            selectable
                            value={equipment.defectRate}
                            placeholder="예: 3"
                            helperText="% 단위"
                            onChange={(value) =>
                              updateEquipment(equipment.id, "defectRate", value)
                            }
                          />
                        </div>
                      </section>

                      <section
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "24px",
                          padding: "20px",
                          display: "grid",
                          gap: "18px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <h3
                            style={{
                              color: "#061B34",
                              fontSize: "17px",
                              fontWeight: 950,
                              margin: 0,
                            }}
                          >
                            예상 투자비용 입력하기
                          </h3>
                          <SelectChip />
                        </div>

                        <div
                          className="ff-mypage-two-col"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "16px",
                          }}
                        >
                          <Field
                            label="전체교체 예상 투자금"
                            value={equipment.scenarioAInvestment}
                            placeholder="예: 22,000"
                            helperText="단위: 만원"
                            inputMode="numeric"
                            onChange={(value) =>
                              updateEquipment(
                                equipment.id,
                                "scenarioAInvestment",
                                formatCommaNumber(value),
                              )
                            }
                          />

                          <Field
                            label="부분교체 예상 투자금"
                            value={equipment.scenarioBInvestment}
                            placeholder="예: 4,994"
                            helperText="단위: 만원"
                            inputMode="numeric"
                            onChange={(value) =>
                              updateEquipment(
                                equipment.id,
                                "scenarioBInvestment",
                                formatCommaNumber(value),
                              )
                            }
                          />
                        </div>

                        <p
                          style={{
                            color: "#667085",
                            fontSize: "13px",
                            fontWeight: 850,
                            lineHeight: 1.65,
                            margin: 0,
                          }}
                        >
                          입력하지 않으면 업계 평균 투자금으로 ROI를 추정합니다.
                          입력하면 실제 투자 계획에 가까운 ROI 분석이
                          가능합니다.
                        </p>
                      </section>

                      <section
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "24px",
                          padding: "20px",
                          display: "grid",
                          gap: "18px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <h3
                            style={{
                              color: "#061B34",
                              fontSize: "17px",
                              fontWeight: 950,
                              margin: 0,
                            }}
                          >
                            추가 운영지표 입력하기
                          </h3>
                          <SelectChip />
                        </div>

                        <div
                          className="ff-mypage-four-col"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            gap: "16px",
                            alignItems: "start",
                          }}
                        >
                          <Field
                            label="연간 유지보수 비용"
                            value={equipment.maintenanceCostAnnual}
                            placeholder="예: 1,200"
                            helperText="단위: 만원"
                            inputMode="numeric"
                            onChange={(value) =>
                              updateEquipment(
                                equipment.id,
                                "maintenanceCostAnnual",
                                formatCommaNumber(value),
                              )
                            }
                          />

                          <Field
                            label="설비 용량 규격값"
                            value={equipment.currentCapacityValue}
                            placeholder="예: 100"
                            labelRight={
                              <span
                                style={{
                                  position: "relative",
                                  display: "inline-flex",
                                }}
                                onMouseEnter={() =>
                                  setCapacityTooltipEquipmentId(equipment.id)
                                }
                                onMouseLeave={() =>
                                  setCapacityTooltipEquipmentId(null)
                                }
                                onFocus={() =>
                                  setCapacityTooltipEquipmentId(equipment.id)
                                }
                                onBlur={() =>
                                  setCapacityTooltipEquipmentId(null)
                                }
                              >
                                <button
                                  type="button"
                                  aria-label="설비 용량 규격값 안내"
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "999px",
                                    border: 0,
                                    background: "#F1F5F9",
                                    color: "#64748B",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    cursor: "help",
                                  }}
                                >
                                  i
                                </button>
                                <InfoTooltip
                                  open={
                                    capacityTooltipEquipmentId === equipment.id
                                  }
                                  text="보조 단위: 프레스/사출기: 톤, CNC: kW"
                                />
                              </span>
                            }
                            onChange={(value) =>
                              updateEquipment(
                                equipment.id,
                                "currentCapacityValue",
                                value,
                              )
                            }
                          />

                          <Field
                            label="연간 생산량"
                            value={equipment.productionQty}
                            placeholder="예: 50000"
                            inputMode="numeric"
                            onChange={(value) =>
                              updateEquipment(
                                equipment.id,
                                "productionQty",
                                value,
                              )
                            }
                          />

                          <Field
                            label="제품 개당 예상이익"
                            value={equipment.contributionMarginWon}
                            placeholder="예: 12,000"
                            helperText="원 단위"
                            inputMode="numeric"
                            onChange={(value) =>
                              updateEquipment(
                                equipment.id,
                                "contributionMarginWon",
                                formatCommaNumber(value),
                              )
                            }
                          />
                        </div>
                      </section>
                    </article>
                  );
                })}
              </div>
            </AccordionPanel>
          </div>

          <section
            style={{
              marginTop: "28px",
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "30px",
              padding: "26px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "20px",
              alignItems: "center",
              boxShadow: "0 16px 48px rgba(15,23,42,.06)",
            }}
          >
            <div>
              <h2
                style={{
                  color: "#061B34",
                  fontSize: "24px",
                  fontWeight: 900,
                  letterSpacing: "-0.4px",
                  margin: 0,
                }}
              >
                분석 준비
              </h2>

              <p
                style={{
                  color: "#667085",
                  fontSize: "14px",
                  fontWeight: 800,
                  lineHeight: 1.7,
                  margin: "8px 0 0",
                }}
              >
                저장된 기업·설비 정보를 기준으로 ROI 분석과 지원사업 추천을
                시작할 수 있습니다. 현재 선택된 ROI 분석 대상 설비는{" "}
                <b>{selectedEquipmentLabel}</b> 입니다.
              </p>
            </div>

            <div
              className="ff-mypage-analysis-actions"
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn blue"
                onClick={handleSave}
                disabled={saving}
                style={{
                  minWidth: "180px",
                  opacity: saving ? 0.72 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>

              <button
                type="button"
                className="btn dark"
                onClick={goToAnalysis}
                disabled={analyzing}
                style={{
                  minWidth: "180px",
                  opacity: analyzing ? 0.72 : 1,
                  cursor: analyzing ? "not-allowed" : "pointer",
                }}
              >
                {analyzing ? "분석 중..." : "분석하기"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                style={{
                  minWidth: "120px",
                  height: "52px",
                  borderRadius: "999px",
                  border: "1px solid #E2E8F0",
                  background: "#FFFFFF",
                  color: "#667085",
                  fontSize: "14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                초기화
              </button>
            </div>
          </section>

          {saved && (
            <div
              style={{
                position: "fixed",
                right: "32px",
                bottom: "32px",
                zIndex: 100,
                background: "#061B34",
                color: "#FFFFFF",
                borderRadius: "22px",
                padding: "18px 22px",
                minWidth: "292px",
                boxShadow: "0 18px 42px rgba(6,27,52,.24)",
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "999px",
                    background: "#E6F6EF",
                    color: "#0B7A53",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>

                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "15px",
                      fontWeight: 900,
                      marginBottom: "4px",
                    }}
                  >
                    저장 완료
                  </strong>

                  <p
                    style={{
                      color: "rgba(255,255,255,.72)",
                      fontSize: "13px",
                      fontWeight: 800,
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    입력한 기업·설비 정보가 저장되었습니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
