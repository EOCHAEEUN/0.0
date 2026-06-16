# 대시보드용 API호출용 파일 나중에 삭제 or 수정



# from pydantic import BaseModel

# from app.models.safety_inspection import (
#     InspectionStatus,
#     SafetyInspection,
#     SafetyInspectionStatus,
# )
# from app.models.safety_rule import BasisType, RiskLevel, SafetyRule


# class SafetyRiskFactor(BaseModel):
#     key: str
#     label: str
#     score: int
#     status: InspectionStatus
#     reason: str


# class SafetyDashboardItem(BaseModel):
#     equipment_id: str
#     equipment_name: str
#     equipment_category: str
#     age_years: int
#     safety_score: int
#     status: InspectionStatus
#     priority_rank: int
#     priority_score: int
#     replacement_reasons: list[str]
#     risk_factors: list[SafetyRiskFactor]
#     rules: list[SafetyRule]
#     inspections: list[SafetyInspection]


# class SafetyDashboardSummary(BaseModel):
#     average_score: int
#     normal_count: int
#     warning_count: int
#     danger_count: int
#     total_rules: int
#     overdue_count: int


# class SafetyDashboardResponse(BaseModel):
#     company_id: str
#     summary: SafetyDashboardSummary
#     items: list[SafetyDashboardItem]


# __all__ = [
#     "BasisType",
#     "InspectionStatus",
#     "RiskLevel",
#     "SafetyDashboardItem",
#     "SafetyDashboardResponse",
#     "SafetyDashboardSummary",
#     "SafetyInspection",
#     "SafetyInspectionStatus",
#     "SafetyRiskFactor",
#     "SafetyRule",
# ]
