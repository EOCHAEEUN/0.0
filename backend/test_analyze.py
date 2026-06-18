import asyncio
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.routers.analyze import analyze
from app.models.auth import CurrentUser

async def test_analyze():
    user = CurrentUser(id="123", email="test@test.com", role="user")
    res = await analyze(company_id="test_comp", current_user=user)
    print("RES:", res)

if __name__ == "__main__":
    asyncio.run(test_analyze())
