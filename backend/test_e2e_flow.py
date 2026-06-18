"""
E2E 흐름 테스트: 마이페이지 컨텍스트 → ROI → 정책 추천 → 신청서 초안
HTTP 서버 없이 직접 LangGraph 그래프 호출
"""
import sys, io, json, asyncio
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')

from dotenv import load_dotenv
load_dotenv()

from app.graph import factofit_graph
from app.state import FactofitState
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.core.database import get_db

SEP = "=" * 60

def get_demo_context():
    """DB에서 실제 company/equipment 가져오기. 없으면 데모 데이터 사용."""
    try:
        db = get_db()
        companies = db.table("company").select("*").limit(1).execute()
        if companies.data:
            c = companies.data[0]
            print(f"[DB] 실제 기업 데이터 사용: {c.get('company_name', 'unknown')}")
            industry_code = c.get("industry_code", [])
            if isinstance(industry_code, str):
                industry_code = [x.strip() for x in industry_code.split(",") if x.strip()]

            company = CompanyContext(
                company_id=c.get("company_id"),
                company_name=c.get("company_name", ""),
                industry_code=industry_code,
                region=c.get("region", ""),
                company_type=c.get("company_type"),
                employee_count=c.get("employee_count"),
                annual_revenue=c.get("annual_revenue"),
            )

            equips = db.table("equipment").select("*").eq("company_id", c.get("company_id")).limit(1).execute()
            equipment = None
            equipment_id = None
            if equips.data:
                eq = equips.data[0]
                equipment_id = eq.get("equipment_id")
                equipment = EquipmentInput(
                    name=eq.get("name", "프레스"),
                    category=eq.get("category", "press"),
                    age_years=eq.get("age_years", 15),
                    energy_cost_annual=eq.get("energy_cost_annual", 4800),
                    defect_rate=eq.get("defect_rate", 3.2),
                )
                print(f"[DB] 실제 설비 데이터 사용: {equipment.name}")
            else:
                print("[DB] 설비 데이터 없음 → 데모 설비 사용")
                equipment = EquipmentInput(
                    name="유압 프레스 라인 A",
                    category="press",
                    age_years=15,
                    energy_cost_annual=4800,
                    defect_rate=3.2,
                )
            return company, equipment, equipment_id
    except Exception as e:
        print(f"[DB] 연결 실패 ({e}) → 데모 데이터 사용")

    company = CompanyContext(
        company_name="데모 제조사",
        industry_code=["C25"],
        region="경기도",
        company_type="중소기업",
        employee_count=45,
        annual_revenue=320000,
    )
    equipment = EquipmentInput(
        name="유압 프레스 라인 A",
        category="press",
        age_years=15,
        energy_cost_annual=4800,
        defect_rate=3.2,
    )
    return company, equipment, None


def make_state(message, company, equipment, equipment_id, chat_history=None, matched_policies=None):
    return {
        "user_query": message,
        "intent": "",
        "is_safe": False,
        "company_info": company,
        "equipment": equipment,
        "equipment_id": equipment_id,
        "matched_policies": matched_policies or [],
        "roi_result": None,
        "draft_result": None,
        "chat_history": chat_history or [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None,
    }


def print_result(step_name, result):
    print(f"\n{SEP}")
    print(f"STEP: {step_name}")
    print(SEP)
    print(f"intent     : {result.get('intent')}")
    print(f"is_safe    : {result.get('is_safe')}")
    print(f"roi_result : {'있음' if result.get('roi_result') else '없음'}")
    policies = result.get('matched_policies', [])
    print(f"policies   : {len(policies)}건")
    for i, p in enumerate(policies[:3], 1):
        title = p.get('metadata', {}).get('title', p.get('id', '?'))
        score = p.get('llm_score', '-')
        print(f"  {i}. {title[:40]} | {score}")
    print(f"draft      : {'있음' if result.get('draft_result') else '없음'}")
    print(f"\n[final_response]\n{result.get('final_response', '')[:300]}")
    if len(result.get('final_response', '')) > 300:
        print("... (생략)")


async def run():
    company, equipment, equipment_id = get_demo_context()
    print(f"\n기업: {company.company_name} | 업종: {company.industry_code} | 지역: {company.region}")

    # ── STEP 1: ROI ──────────────────────────────────────────
    print(f"\n{SEP}\nSTEP 1: ROI 계산 요청\n{SEP}")
    msg1 = "프레스 설비가 15년 됐고 연간 에너지비가 4800만원 정도 나와. 교체랑 부분개선 중에 뭐가 나은지 ROI로 비교해줘."
    print(f"입력: {msg1}")
    state1 = make_state(msg1, company, equipment, equipment_id)
    result1 = await factofit_graph.ainvoke(state1)
    print_result("ROI 계산", result1)

    # ── STEP 2: 정책 추천 ────────────────────────────────────
    print(f"\n{SEP}\nSTEP 2: 지원금 정책 추천 요청\n{SEP}")
    msg2 = "C25 업종 경기도 제조업인데 프레스 설비 교체 지원사업 찾아줘."
    print(f"입력: {msg2}")
    chat_history_2 = [
        {"role": "user", "content": msg1},
        {"role": "assistant", "content": result1.get("final_response", "")[:200]},
    ]
    state2 = make_state(msg2, company, equipment, equipment_id, chat_history=chat_history_2)
    result2 = await factofit_graph.ainvoke(state2)
    print_result("정책 추천", result2)

    # ── STEP 3: 신청서 초안 ──────────────────────────────────
    print(f"\n{SEP}\nSTEP 3: 신청서 초안 작성 요청\n{SEP}")
    msg3 = "방금 추천해준 첫 번째 지원사업으로 신청서 초안 작성해줘."
    print(f"입력: {msg3}")
    chat_history_3 = chat_history_2 + [
        {"role": "user", "content": msg2},
        {"role": "assistant", "content": result2.get("final_response", "")[:200]},
    ]
    # 핵심: 이전 matched_policies를 state에 넘겨줌
    matched_from_step2 = result2.get("matched_policies", [])
    state3 = make_state(msg3, company, equipment, equipment_id,
                        chat_history=chat_history_3,
                        matched_policies=matched_from_step2)
    result3 = await factofit_graph.ainvoke(state3)
    print_result("신청서 초안", result3)

    # ── 요약 ─────────────────────────────────────────────────
    print(f"\n{SEP}")
    print("E2E 흐름 요약")
    print(SEP)
    checks = [
        ("STEP1 ROI intent",      result1.get('intent') == 'roi'),
        ("STEP1 roi_result 존재",  bool(result1.get('roi_result'))),
        ("STEP1 응답 있음",        bool(result1.get('final_response'))),
        ("STEP2 policy intent",   result2.get('intent') == 'policy'),
        ("STEP2 정책 1건 이상",    len(result2.get('matched_policies', [])) > 0),
        ("STEP2 응답 있음",        bool(result2.get('final_response'))),
        ("STEP3 draft intent",    result3.get('intent') == 'draft'),
        ("STEP3 draft_result 존재", bool(result3.get('draft_result'))),
        ("STEP3 응답 있음",        bool(result3.get('final_response'))),
    ]
    for label, ok in checks:
        icon = "OK" if ok else "FAIL"
        print(f"  [{icon}] {label}")

asyncio.run(run())
