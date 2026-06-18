from fastapi import APIRouter

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard():
    return {
        "success": True,
        "data": {
            "company_name": "안산금속(주)",
            "kpi": {
                "annual_energy_cost": 4800,
                "energy_vs_avg_pct": 38,
                "avg_equipment_age": 14.2,
                "matched_policies_count": 7,
                "estimated_subsidy_manwon": 20000
            },
            "equipments": [
                {
                    "equipment_id": "sample-equipment-001",
                    "name": "유압 프레스 라인 A",
                    "category": "press",
                    "age_years": 15,
                    "status": "danger",
                    "status_label": "교체 권고"
                }
            ],
            "urgent_policies": []
        }
    }
