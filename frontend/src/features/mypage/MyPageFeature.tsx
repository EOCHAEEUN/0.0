import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CirclePlus,
  FileText,
  IdCard,
  UserRound,
} from "lucide-react";
import DashboardWorkspacePageLayout from "../../components/layout/DashboardWorkspacePageLayout";
import {
  MyPageProfileStatusSidebar,
  MyPageRevenueStatusPill,
  MyPageSectionCard,
} from "./MyPageWorkspaceParts";
import "./mypage.workspace.css";
import {
  getStoredCompanyId,
  patchRepresentativeEquipment,
} from "../dashboard/dashboard.api";
import { MYPAGE_DOCUMENT_STORAGE_KEY } from "../documents/documentStorage";
import CompanyDocumentsManagement from "./components/CompanyDocumentsManagement";
import type {
  BasicInfo,
  PasswordInfo,
  IndustryItem,
  CompanyInfo,
  EquipmentInfo,
  MyPageStorageData,
  UserProfilePayload,
  CompanyOnboardingPayload,
  EquipmentPayload,
  MyPagePanelKey,
} from "./myPage.parts";
import {
  STORAGE_KEY,
  USER_ID_STORAGE_KEY,
  COMPANY_ID_STORAGE_KEY,
  EQUIPMENT_ID_STORAGE_KEY,
  SELECTED_EQUIPMENT_ID_STORAGE_KEY,
  ANALYSIS_RESULT_STORAGE_KEY,
  CURRENT_YEAR,
  PREVIOUS_YEAR,
  TWO_YEARS_AGO,
  THREE_YEARS_AGO,
  emptyBasicInfo,
  emptyPasswordInfo,
  createEmptyIndustry,
  emptyCompanyInfo,
  createEmptyEquipment,
  savedPolicies,
  analysisHistories,
  COMPANY_TYPE_OPTIONS,
  AFFILIATE_STATUS_OPTIONS,
  BUSINESS_SITE_TYPE_OPTIONS,
  PURPOSE_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  submitUserPayload,
  submitCompanyPayload,
  submitEquipmentPayload,
  deleteEquipmentPayload,
  fetchSavedOnboarding,
  buildApiUrl,
  loadStoredMyPageData,
  parseIndustryCodes,
  formatIndustryCodes,
  getIndustryCodeCandidates,
  getIndustryNameByCode,
  findCompanyId,
  findEquipmentId,
  getErrorMessage,
  safeJsonParse,
  getAccessToken,
  getApiErrorMessage,
  toPositiveNumber,
  toNumberOrNull,
  formatPhoneNumber,
  formatBusinessNumber,
  normalizePhoneNumber,
  normalizeBusinessNumber,
  formatCommaNumber,
  normalizeCommaNumber,
  getPasswordStrength,
  getCurrentUserId,
  FieldLabel,
  EquipmentCategoryHelpTooltip,
  IndustryRemoveButton,
  Field,
  SelectField,
  InfoTooltip,
  FloatingModalNotice,
  hasRequiredEquipmentFields,
  AccordionPanel,
  EquipmentOptionalAccordion,
  countEquipmentOptionalFieldsFilled,
} from "./myPage.parts";


type OnboardingMeResponse = {
  success?: boolean;
  data?: {
    user_profile?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
    equipments?: unknown[];
    company_id?: string | null;
  };
};

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return null;
}

function getStringArrayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => getStringValue(item)).filter(Boolean);
  }

  const textValue = getStringValue(value);
  if (!textValue) return [];

  return textValue
    .split(/[,，/\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickNumberText(...values: unknown[]) {
  for (const value of values) {
    const textValue = getStringValue(value);
    if (textValue) return textValue;
  }

  return "";
}


type EquipmentPayloadFallback = {
  process: string | null;
  defect_rate: number | null;
  maintenance_cost_annual: number | null;
  current_capacity_value: number | null;
  production_qty: number | null;
  contribution_margin_won: number | null;
  scenario_a_investment_manwon: number | null;
  scenario_b_investment_manwon: number | null;
};

function normalizeEquipmentCategory(category: string) {
  const normalized = category.trim().toLowerCase();

  if (normalized.includes("press") || normalized.includes("프레스")) return "press";
  if (normalized.includes("cnc") || normalized.includes("공작") || normalized.includes("가공")) return "cnc";
  if (normalized.includes("injection") || normalized.includes("사출")) return "injection";

  return "etc";
}

function getEquipmentPayloadFallback(
  equipment: EquipmentInfo,
  energyCostAnnual: number,
): EquipmentPayloadFallback {
  const category = normalizeEquipmentCategory(equipment.category);
  const energyBasedMaintenance =
    energyCostAnnual > 0 ? Math.round(energyCostAnnual * 0.018) : null;

  if (category === "press") {
    return {
      process: "프레스공정",
      defect_rate: 3.4,
      maintenance_cost_annual: energyBasedMaintenance ?? 900,
      current_capacity_value: 250,
      production_qty: 120000,
      contribution_margin_won: 18000,
      scenario_a_investment_manwon: 20000,
      scenario_b_investment_manwon: 4000,
    };
  }

  if (category === "cnc") {
    return {
      process: "cnc",
      defect_rate: 1.6,
      maintenance_cost_annual: energyBasedMaintenance ?? 420,
      current_capacity_value: 35,
      production_qty: 85000,
      contribution_margin_won: 22000,
      scenario_a_investment_manwon: 10000,
      scenario_b_investment_manwon: 3000,
    };
  }

  if (category === "injection") {
    return {
      process: "사출공정",
      defect_rate: 2.8,
      maintenance_cost_annual: energyBasedMaintenance ?? 780,
      current_capacity_value: 450,
      production_qty: 100000,
      contribution_margin_won: 16000,
      scenario_a_investment_manwon: 18000,
      scenario_b_investment_manwon: 5000,
    };
  }

  return {
    process: equipment.process.trim() || null,
    defect_rate: 3,
    maintenance_cost_annual: energyBasedMaintenance ?? 500,
    current_capacity_value: 100,
    production_qty: 50000,
    contribution_margin_won: 12000,
    scenario_a_investment_manwon: 12000,
    scenario_b_investment_manwon: 4000,
  };
}

function normalizeRemoteIndustries(
  industryCodes: string[],
  industryName: string,
): IndustryItem[] {
  const codes = industryCodes.length > 0 ? industryCodes : [];
  const normalized = codes.map((code, index) => ({
    id: index + 1,
    industry:
      index === 0 && industryName
        ? industryName
        : getIndustryNameByCode(code) || industryName || "",
    industryCode: code,
  }));

  if (normalized.length === 0 && industryName) {
    normalized.push({
      ...createEmptyIndustry(1),
      industry: industryName,
      industryCode: "",
    });
  }

  while (normalized.length < 2) {
    normalized.push(createEmptyIndustry(normalized.length + 1));
  }

  return normalized;
}

function extractOnboardingMeData(response: unknown) {
  const responseRecord = getObject(response) as OnboardingMeResponse | null;
  const dataRecord = getObject(responseRecord?.data);

  return dataRecord ?? getObject(response) ?? {};
}

function mapRemoteEquipment(item: unknown, index: number): EquipmentInfo {
  const equipment = getObject(item) ?? {};
  const category = getStringValue(equipment.category);

  return {
    ...createEmptyEquipment(index + 1),
    equipmentId:
      getStringValue(equipment.equipment_id) ||
      getStringValue(equipment.equipmentId) ||
      undefined,
    name: getStringValue(equipment.name),
    category: category || "선택 필요",
    process: getStringValue(equipment.process),
    years: getStringValue(equipment.age_years),
    annualEnergyCost: formatCommaNumber(getStringValue(equipment.energy_cost_annual)),
    defectRate: getStringValue(equipment.defect_rate),
    maintenanceCostAnnual: formatCommaNumber(
      getStringValue(equipment.maintenance_cost_annual),
    ),
    currentCapacityValue: getStringValue(equipment.current_capacity_value),
    productionQty: getStringValue(equipment.production_qty),
    contributionMarginWon: formatCommaNumber(
      getStringValue(equipment.contribution_margin_won),
    ),
    scenarioAInvestment: formatCommaNumber(
      getStringValue(equipment.scenario_a_investment_manwon),
    ),
    scenarioBInvestment: formatCommaNumber(
      getStringValue(equipment.scenario_b_investment_manwon),
    ),
    status: "저장된 설비",
  };
}


export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnToDashboard = searchParams.get("return_to") === "dashboard";
  const focusRepresentative = searchParams.get("focus") === "representative";

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
  const [equipmentOptionalOpen, setEquipmentOptionalOpen] = useState<
    Record<number, boolean>
  >({});

  const [openSections, setOpenSections] = useState<
    Record<MyPagePanelKey, boolean>
  >({
    basic: false,
    company: false,
    equipment: false,
    documents: false,
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
  const [representativeEquipmentId, setRepresentativeEquipmentId] = useState("");
  const [representativeFeedback, setRepresentativeFeedback] = useState("");

  useEffect(() => {
    if (focusRepresentative || searchParams.get("panel") === "equipment") {
      setOpenSections((prev) => ({ ...prev, equipment: true }));
    }
  }, [focusRepresentative, searchParams]);

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
    let cancelled = false;

    const loadSavedOnboarding = async () => {
      if (!getAccessToken()) return;

      try {
        const response = await fetchSavedOnboarding();
        if (cancelled) return;

        const data = extractOnboardingMeData(response);
        const userProfile = getObject(data.user_profile);
        const company = getObject(data.company);
        const equipments = Array.isArray(data.equipments) ? data.equipments : [];
        const companyId = findCompanyId(response);

        if (userProfile) {
          const profileName = getStringValue(userProfile.name);
          const profileEmail = getStringValue(userProfile.email);
          const profilePhone = getStringValue(userProfile.phone);
          const managerName = getStringValue(userProfile.manager_name);
          const managerPhone = getStringValue(userProfile.manager_phone);

          setBasicInfo((prev) => ({
            ...prev,
            name: profileName || prev.name,
            email: profileEmail || prev.email,
            phone: profilePhone ? formatPhoneNumber(profilePhone) : prev.phone,
            manager: managerName || profileName || prev.manager,
            managerPhone: managerPhone
              ? formatPhoneNumber(managerPhone)
              : profilePhone
                ? formatPhoneNumber(profilePhone)
                : prev.managerPhone,
          }));
        }

        if (company) {
          const representativeId = getStringValue(company.representative_equipment_id);
          if (representativeId) {
            setRepresentativeEquipmentId(representativeId);
          }
          const industryCodes = getStringArrayValue(company.industry_code);
          const industryName = getStringValue(company.industry_name);
          const remoteIndustries = normalizeRemoteIndustries(
            industryCodes,
            industryName,
          );
          const affiliateValue = getBooleanValue(
            company.is_disclosure_group_member,
          );
          const purposeValues = getStringArrayValue(company.primary_purpose);
          const companyType = getStringValue(company.company_type);

          setCompanyInfo((prev) => ({
            ...prev,
            companyName: getStringValue(company.company_name) || prev.companyName,
            businessNumber: formatBusinessNumber(
              getStringValue(company.business_registration_no) ||
                prev.businessNumber,
            ),
            assetTotalManwon: formatCommaNumber(
              pickNumberText(company.total_assets_manwon, prev.assetTotalManwon),
            ),
            industry: remoteIndustries[0]?.industry ?? prev.industry,
            industryCode: remoteIndustries[0]?.industryCode ?? prev.industryCode,
            industries: remoteIndustries,
            region: getStringValue(company.region) || prev.region,
            employees: formatCommaNumber(
              pickNumberText(company.employee_count, prev.employees),
            ),
            annualRevenue: formatCommaNumber(
              pickNumberText(
                company.annual_revenue_manwon,
                company.annual_revenue,
                prev.annualRevenue,
              ),
            ),
            revenue2YearsAgo: formatCommaNumber(
              pickNumberText(
                company.revenue_2y_ago_manwon,
                prev.revenue2YearsAgo,
              ),
            ),
            revenue3YearsAgo: formatCommaNumber(
              pickNumberText(
                company.revenue_3y_ago_manwon,
                prev.revenue3YearsAgo,
              ),
            ),
            companyType: companyType || prev.companyType || "선택 필요",
            affiliateStatus:
              affiliateValue === null
                ? prev.affiliateStatus
                : affiliateValue
                  ? "대기업 계열사 소속"
                  : "무소속",
            purpose: purposeValues[0] || prev.purpose,
            foundedYear:
              getStringValue(company.established_year) || prev.foundedYear,
            businessSiteType:
              getStringValue(company.workplace_type) ||
              prev.businessSiteType ||
              "선택 필요",
          }));
        }

        if (equipments.length > 0) {
          const remoteEquipmentList = equipments.map(mapRemoteEquipment);
          const firstRemoteEquipment = remoteEquipmentList[0];

          setEquipmentList(remoteEquipmentList);
          setSelectedAnalysisEquipmentId(firstRemoteEquipment?.id ?? 1);

          if (firstRemoteEquipment?.equipmentId) {
            window.localStorage.setItem(
              EQUIPMENT_ID_STORAGE_KEY,
              firstRemoteEquipment.equipmentId,
            );
            window.localStorage.setItem(
              SELECTED_EQUIPMENT_ID_STORAGE_KEY,
              firstRemoteEquipment.equipmentId,
            );
          }
        } else {
          // API에서 설비 없음 → 이전 사용자의 localStorage 캐시를 덮어씀
          setEquipmentList([createEmptyEquipment(1)]);
          window.localStorage.removeItem(EQUIPMENT_ID_STORAGE_KEY);
          window.localStorage.removeItem(SELECTED_EQUIPMENT_ID_STORAGE_KEY);
        }

        if (companyId) {
          window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, companyId);
        }

        setProfileCompleted(Boolean(userProfile && company && equipments.length > 0));
      } catch (error) {
        console.warn("마이페이지 온보딩 초기값 조회 실패:", error);
      }
    };

    void loadSavedOnboarding();

    return () => {
      cancelled = true;
    };
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

  const removeIndustryRow = (id: number) => {
    setCompanyInfo((prev) => {
      const nextIndustries = prev.industries.filter((item, index) => {
        if (index === 0) return true;
        return item.id !== id;
      });

      const normalizedIndustries =
        nextIndustries.length > 0 ? nextIndustries : [createEmptyIndustry(1)];
      const first = normalizedIndustries[0] ?? createEmptyIndustry(1);

      return {
        ...prev,
        industries: normalizedIndustries,
        industry: first.industry,
        industryCode: first.industryCode,
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

  const toggleEquipmentOptional = (equipmentId: number) => {
    setEquipmentOptionalOpen((prev) => ({
      ...prev,
      [equipmentId]: !prev[equipmentId],
    }));
  };

  const isEquipmentOptionalOpen = (equipmentId: number) =>
    Boolean(equipmentOptionalOpen[equipmentId]);

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

  const handleSetRepresentativeEquipment = async (equipment: EquipmentInfo) => {
    const companyId =
      window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || getStoredCompanyId();
    const equipmentId = equipment.equipmentId?.trim();
    const equipmentLabel = equipment.name?.trim() || `설비 ${equipment.id}`;

    if (!companyId || !equipmentId) {
      window.alert("대표 설비를 저장하려면 먼저 설비 정보를 저장해주세요.");
      return;
    }

    try {
      await patchRepresentativeEquipment({ companyId, equipmentId });
      setRepresentativeEquipmentId(equipmentId);
      setRepresentativeFeedback(`대표 설비를 ${equipmentLabel}로 변경했습니다.`);
      if (returnToDashboard) {
        navigate("/dashboard");
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "대표 설비를 저장하지 못했습니다.",
      );
    }
  };

  const handleClearRepresentativeEquipment = async () => {
    const companyId =
      window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || getStoredCompanyId();

    if (!companyId) {
      window.alert("회사 정보를 먼저 저장해주세요.");
      return;
    }

    try {
      await patchRepresentativeEquipment({ companyId, equipmentId: null });
      setRepresentativeEquipmentId("");
      setRepresentativeFeedback("대표 설비를 해제했습니다.");
      if (returnToDashboard) {
        navigate("/dashboard");
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "대표 설비를 해제하지 못했습니다.",
      );
    }
  };

  const removeEquipment = async (id: number) => {
    if (equipmentList.length <= 1) {
      window.alert("설비 정보는 최소 1개 이상 필요합니다.");
      return;
    }

    const targetEquipment = equipmentList.find((equipment) => equipment.id === id);
    if (!targetEquipment) return;

    if (targetEquipment.equipmentId) {
      try {
        await deleteEquipmentPayload(targetEquipment.equipmentId);
      } catch (error) {
        window.alert(getErrorMessage(error));
        return;
      }

      if (representativeEquipmentId === targetEquipment.equipmentId) {
        setRepresentativeEquipmentId("");
      }
    }

    const nextEquipmentList = equipmentList.filter(
      (equipment) => equipment.id !== id,
    );
    const nextSelectedAnalysisEquipmentId =
      selectedAnalysisEquipmentId === id
        ? nextEquipmentList[0]?.id ?? null
        : selectedAnalysisEquipmentId;

    setEquipmentList(nextEquipmentList);
    setSelectedAnalysisEquipmentId(nextSelectedAnalysisEquipmentId);
    setEquipmentOptionalOpen((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const nextSelectedEquipmentUuid =
      nextEquipmentList.find(
        (equipment) => equipment.id === nextSelectedAnalysisEquipmentId,
      )?.equipmentId ??
      nextEquipmentList.find((equipment) => equipment.equipmentId)?.equipmentId;

    if (nextSelectedEquipmentUuid) {
      window.localStorage.setItem(EQUIPMENT_ID_STORAGE_KEY, nextSelectedEquipmentUuid);
      window.localStorage.setItem(
        SELECTED_EQUIPMENT_ID_STORAGE_KEY,
        nextSelectedEquipmentUuid,
      );
    } else {
      window.localStorage.removeItem(EQUIPMENT_ID_STORAGE_KEY);
      window.localStorage.removeItem(SELECTED_EQUIPMENT_ID_STORAGE_KEY);
    }

    const currentUserIdForStorage = window.localStorage.getItem(USER_ID_STORAGE_KEY)?.trim() ?? "";
    const storageData: MyPageStorageData = {
      basicInfo,
      companyInfo,
      equipmentList: nextEquipmentList,
      selectedAnalysisEquipmentId: nextSelectedAnalysisEquipmentId,
      profileCompleted,
      savedAt: new Date().toISOString(),
      ...(currentUserIdForStorage ? { ownerId: currentUserIdForStorage } : {}),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
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

    const equipmentPayloads = completedEquipments.map((equipment) => {
      const energyCostAnnual =
        toPositiveNumber(normalizeCommaNumber(equipment.annualEnergyCost)) ?? 0;
      const fallback = getEquipmentPayloadFallback(equipment, energyCostAnnual);

      return {
        localId: equipment.id,
        payload: {
          equipment_id: equipment.equipmentId ?? null,
          name: equipment.name.trim(),
          category:
            equipment.category === "선택 필요" ? "etc" : equipment.category,
          process: equipment.process.trim() || fallback.process,
          age_years: toPositiveNumber(equipment.years) ?? 0,
          energy_cost_annual: energyCostAnnual,
          defect_rate: toNumberOrNull(equipment.defectRate) ?? fallback.defect_rate,
          maintenance_cost_annual:
            toNumberOrNull(normalizeCommaNumber(equipment.maintenanceCostAnnual)) ??
            fallback.maintenance_cost_annual,
          current_capacity_value:
            toNumberOrNull(equipment.currentCapacityValue) ??
            fallback.current_capacity_value,
          production_qty:
            toNumberOrNull(equipment.productionQty) ?? fallback.production_qty,
          contribution_margin_won:
            toNumberOrNull(normalizeCommaNumber(equipment.contributionMarginWon)) ??
            fallback.contribution_margin_won,
          scenario_a_investment_manwon:
            toNumberOrNull(normalizeCommaNumber(equipment.scenarioAInvestment)) ??
            fallback.scenario_a_investment_manwon,
          scenario_b_investment_manwon:
            toNumberOrNull(normalizeCommaNumber(equipment.scenarioBInvestment)) ??
            fallback.scenario_b_investment_manwon,
        } satisfies EquipmentPayload,
      };
    });

    const savedProfileCompleted =
      basicInfoDone && companyInfoDone && equipmentInfoDone;

    try {
      setSaving(true);

      await submitUserPayload(userPayload);

      const { responseData: companyResponseData, companyId } =
        await submitCompanyPayload(companyPayload);
      void companyResponseData;

      let nextEquipmentList = [...equipmentList];
      const equipmentResponses = [];

      for (const item of equipmentPayloads) {
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

      const selectedEquipmentUuid =
        nextEquipmentList.find(
          (equipment) => equipment.id === selectedAnalysisEquipmentId,
        )?.equipmentId ??
        nextEquipmentList.find((equipment) => equipment.equipmentId)?.equipmentId;

      if (selectedEquipmentUuid) {
        window.localStorage.setItem(EQUIPMENT_ID_STORAGE_KEY, selectedEquipmentUuid);
        window.localStorage.setItem(
          SELECTED_EQUIPMENT_ID_STORAGE_KEY,
          selectedEquipmentUuid,
        );
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
        ...(userId ? { ownerId: userId } : {}),
      };

      const savedOnboarding = await fetchSavedOnboarding();
      void savedOnboarding;

      setEquipmentList(nextEquipmentList);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

      if (userId) {
        window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
      }

      window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, companyId);

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
    window.localStorage.removeItem(EQUIPMENT_ID_STORAGE_KEY);
    window.localStorage.removeItem(SELECTED_EQUIPMENT_ID_STORAGE_KEY);
    window.localStorage.removeItem(ANALYSIS_RESULT_STORAGE_KEY);
    window.localStorage.removeItem(MYPAGE_DOCUMENT_STORAGE_KEY);

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

    if (selectedEquipment.equipmentId) {
      window.location.assign(
        `/analysis/new?mode=existing&equipmentId=${encodeURIComponent(selectedEquipment.equipmentId)}`,
      );
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

      window.location.assign("/dashboard");
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
      <style>{`
        details > summary::-webkit-details-marker { display: none !important; }
        details > summary::marker { content: "" !important; }
        details > summary { list-style: none !important; }
        @media (max-width: 960px) {
          .ff-mypage-service-flow,
          .ff-mypage-three-col,
          .ff-mypage-four-col,
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

      <FloatingModalNotice
        open={analysisBlockNoticeOpen}
        title="필수 정보를 먼저 입력해주세요."
        description={"기본정보, 기업정보, 설비현황의 필수 항목이\n모두 입력되어야 분석을 시작할 수 있습니다."}
        description2="필수값을 입력하고 저장한 뒤 다시 분석하기를 눌러주세요."
        onClose={() => setAnalysisBlockNoticeOpen(false)}
      />

      <DashboardWorkspacePageLayout
        pageClassName="ff-mypage-workspace-page"
        contentClassName="ff-mypage-workspace-content"
      >
        <div className="ff-mypage-page-shell">
          <header className="ff-mypage-page-header">
            <h1>프로필 및 기업 설정</h1>
            <p>산업 분석 플랫폼의 개인 정보와 기업 데이터를 관리하세요.</p>
          </header>

          <div className="ff-mypage-profile-grid">
            <div className="ff-mypage-profile-main">
            <MyPageSectionCard
              title="기본 정보"
              icon={<UserRound />}
            >
              <div className="ff-mypage-two-col">
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

              <div className="ff-mypage-two-col">
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
                          text="비밀번호를 변경한 뒤에는 정보 저장하기 버튼을 눌러야 최종 적용됩니다."
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
              </div>

              <div className="ff-mypage-two-col">
                <Field
                  label="새 비밀번호"
                  value={passwordInfo.newPassword}
                  placeholder="최소 8자 이상"
                  type="password"
                  onChange={(value) =>
                    setPasswordInfo((prev) => ({ ...prev, newPassword: value }))
                  }
                />

                <Field
                  label="새 비밀번호 확인"
                  value={passwordInfo.confirmPassword}
                  placeholder="비밀번호를 다시 입력하세요"
                  type="password"
                  onChange={(value) =>
                    setPasswordInfo((prev) => ({
                      ...prev,
                      confirmPassword: value,
                    }))
                  }
                />
              </div>

              <div className="ff-mypage-password-meta">
                <div className="ff-mypage-password-bar">
                  <span
                    style={{
                      width: `${passwordStrength.percent}%`,
                      background: passwordStrength.color,
                    }}
                  />
                </div>
                <div className="ff-mypage-password-label">
                  보안 수준: {passwordStrength.label}
                </div>
              </div>
            </MyPageSectionCard>

            <MyPageSectionCard title="담당자 정보" icon={<IdCard />}>
              <div className="ff-mypage-two-col">
                <Field
                  label="담당자 성함"
                  selectable
                  value={basicInfo.manager}
                  placeholder="담당자 성함을 입력하세요"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({ ...prev, manager: value }))
                  }
                />

                <Field
                  label="담당자 연락처"
                  selectable
                  value={basicInfo.managerPhone}
                  placeholder="010-0000-0000"
                  onChange={(value) =>
                    setBasicInfo((prev) => ({
                      ...prev,
                      managerPhone: formatPhoneNumber(value),
                    }))
                  }
                />
              </div>
            </MyPageSectionCard>

            <MyPageSectionCard
              id="company-profile-form"
              title="기업 정보"
              subtitle="지원사업 추천 기준으로 사용되는 정보입니다."
              icon={<Building2 />}
            >
              <div className="ff-mypage-two-col">
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
                      labelAction={
                        <IndustryRemoveButton
                          onClick={() => removeIndustryRow(industryItem.id)}
                        />
                      }
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
            </MyPageSectionCard>

            <MyPageSectionCard title="최근 3개년 매출액" icon={<BarChart3 />}>
              <div className="ff-mypage-revenue-table-wrap">
                <table className="ff-mypage-revenue-table">
                  <thead>
                    <tr>
                      <th>회계 연도</th>
                      <th>매출액 (단위: 만원)</th>
                      <th>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        {PREVIOUS_YEAR}
                        <span style={{ color: "#94a3b8", fontWeight: 700 }}> (추정)</span>
                      </td>
                      <td>
                        <input
                          value={companyInfo.annualRevenue}
                          placeholder="매출액 입력"
                          inputMode="numeric"
                          onChange={(event) =>
                            setCompanyInfo((prev) => ({
                              ...prev,
                              annualRevenue: formatCommaNumber(event.target.value),
                            }))
                          }
                          className={companyInfo.annualRevenue.trim() ? "is-filled" : ""}
                        />
                      </td>
                      <td>
                        <MyPageRevenueStatusPill filled={!!companyInfo.annualRevenue.trim()} />
                      </td>
                    </tr>
                    <tr>
                      <td>{TWO_YEARS_AGO}</td>
                      <td>
                        <input
                          value={companyInfo.revenue2YearsAgo}
                          placeholder="매출액 입력"
                          inputMode="numeric"
                          onChange={(event) =>
                            setCompanyInfo((prev) => ({
                              ...prev,
                              revenue2YearsAgo: formatCommaNumber(event.target.value),
                            }))
                          }
                          className={companyInfo.revenue2YearsAgo.trim() ? "is-filled" : ""}
                        />
                      </td>
                      <td>
                        <MyPageRevenueStatusPill filled={!!companyInfo.revenue2YearsAgo.trim()} />
                      </td>
                    </tr>
                    <tr>
                      <td>{THREE_YEARS_AGO}</td>
                      <td>
                        <input
                          value={companyInfo.revenue3YearsAgo}
                          placeholder="매출액 입력"
                          inputMode="numeric"
                          onChange={(event) =>
                            setCompanyInfo((prev) => ({
                              ...prev,
                              revenue3YearsAgo: formatCommaNumber(event.target.value),
                            }))
                          }
                          className={companyInfo.revenue3YearsAgo.trim() ? "is-filled" : ""}
                        />
                      </td>
                      <td>
                        <MyPageRevenueStatusPill filled={!!companyInfo.revenue3YearsAgo.trim()} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="ff-mypage-optional-note">
                입력하지 않으면 직전년도 매출액을 기준으로 3년 평균값을 계산합니다.
              </p>
            </MyPageSectionCard>

            <MyPageSectionCard
              title="선택정보 입력하기"
              subtitle="* 분석 정확도가 향상됩니다."
              icon={<CirclePlus />}
            >
              <div className="ff-mypage-two-col">
                  <Field
                    label="사업자등록번호"
                    value={companyInfo.businessNumber}
                    placeholder="000-00-00000"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        businessNumber: formatBusinessNumber(value),
                      }))
                    }
                  />

                  <Field
                    label="총 자산"
                    value={companyInfo.assetTotalManwon}
                    placeholder="단위: 억원"
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

              <div className="ff-mypage-two-col">
                  <SelectField
                    label="계열사 여부"
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
                    label="설립 연도"
                    value={companyInfo.foundedYear}
                    placeholder="YYYY"
                    inputMode="numeric"
                    onChange={(value) =>
                      setCompanyInfo((prev) => ({
                        ...prev,
                        foundedYear: value,
                      }))
                    }
                  />
              </div>

              <div className="ff-mypage-two-col">
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
            </MyPageSectionCard>

            <MyPageSectionCard
              title="기업 증빙 관리"
              subtitle="정책 신청에 필요한 공통 증빙서류를 미리 등록·관리하세요."
              icon={<FileText />}
            >
              <CompanyDocumentsManagement />
            </MyPageSectionCard>

            <div className="ff-mypage-form-actions">
              <button
                type="button"
                className="ff-mypage-btn ghost"
                onClick={() => navigate("/dashboard")}
              >
                취소
              </button>
              <button
                type="button"
                className="ff-mypage-btn primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "저장 중..." : "정보 저장하기"}
              </button>
            </div>
            </div>

            <MyPageProfileStatusSidebar
              completionScore={completionScore}
              basicInfoDone={basicInfoDone}
              companyInfoDone={companyInfoDone}
              equipmentInfoDone={equipmentInfoDone}
              onGoEquipment={() => navigate("/equipment")}
            />
          </div>

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
      </DashboardWorkspacePageLayout>
    </>
  );
}
