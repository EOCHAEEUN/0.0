from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FactoFit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "FactoFit API running"}

@app.post("/api/roi/simulate")
def simulate_roi(payload: dict):
    return {
        "success": True,
        "data": {
            "equipment_age": 15,
            "investment_manwon": 15000,
            "subsidy_manwon": 12400,
            "payback_years": 1.4,
            "expected_roi": 72,
            "scenario_a": {
                "title": "고효율 프레스 전체 교체",
                "energy_saving_manwon": 1440,
                "defect_reduction_manwon": 70,
                "maintenance_saving_manwon": 363,
                "net_investment_manwon": 2600,
                "payback_years": 1.4,
            },
            "scenario_b": {
                "title": "핵심 부품 교체 + 스마트 모니터링",
                "energy_saving_manwon": 480,
                "subsidy_manwon": 1500,
                "net_investment_manwon": 1750,
                "payback_years": 2.6,
            },
            "recommendation": "AI는 시나리오 A를 추천합니다.",
        },
    }