"""Safety Copilot Agent — KTL 인증 + KOSHA 점검 일정 안내"""

def get_safety_checklist(industry_code: str, region: str) -> list[dict]:
    """업종별 의무 안전점검 체크리스트 — TODO: KTL 데이터 연동"""
    return [
        {"name": "소방설비 정기점검", "status": "완료", "month": 2},
        {"name": "KTL 전기안전 정기검사", "status": "예정", "deadline_month": 8, "penalty": 300},
        {"name": "KOSHA 화학물질 취급 안전점검", "status": "미확인", "penalty": 500},
    ]
