from pydantic import BaseModel

class RoiOutput(BaseModel):
    roi_percent: float           # 예: 34.5 (%)
    payback_period_years: float  # 예: 2.9 (년)
    annual_savings: int          # 만원/년
    total_savings_5yr: int       # 만원 (5년 누적)
    recommendation: str          # "투자 권장" / "재검토 필요"
