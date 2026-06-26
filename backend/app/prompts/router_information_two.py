from __future__ import annotations

import json
from typing import Any

FACTOFIT_INPUT_SCHEMA: dict[str, Any] = {
    "service": "FactoFit",
    "agent": "Click Chat Three",
    "purpose": "마이페이지 기업정보·설비현황 입력을 도와주는 대화형 AI Agent",
    "response_policy": {
        "language": "ko-KR",
        "tone": "친절하고 짧은 현장 실무 말투",
        "answer_style": "고정 사전 답변이 아니라 사용자 질문 의도에 맞춘 자연어 답변",
        "multi_question": "한 문장에 여러 항목이나 여러 의도가 있으면 모두 나눠서 답변",
        "comparison": "차이, 다른 점, 비교, vs, 랑/이랑이 들어간 질문은 비교 구조로 답변",
        "scope_rule": "FactoFit 마이페이지 입력과 관련 없는 질문은 범위 밖이라고 안내",
        "non_field_concept_rule": "스키마에 없는 개념도 질문 이해에 필요하면 설명하되, 실제 입력칸처럼 말하지 않기",
    },
    "global_units": {
        "money_default": "만원",
        "annual_cost_default": "만원/년",
        "percentage_default": "%",
        "year_default": "년",
    },
    "screens": [
        {
            "group": "company",
            "label": "기업정보",
            "path": "마이페이지 > 기업정보",
            "business_goal": "지원사업 추천, ROI 분석, 신청서 생성에 필요한 기업 기준값 수집",
            "fields": [
                {"key": "company_name", "label": "기업명", "required": True, "input_type": "text", "path": "마이페이지 > 기업정보 > 기업명"},
                {"key": "company_size", "label": "기업규모", "required": True, "input_type": "select", "path": "마이페이지 > 기업정보 > 기업규모", "options": ["소상공인", "소기업", "중소기업", "중견기업", "대기업", "확인필요"]},
                {"key": "industry_name", "label": "업종명", "required": True, "input_type": "text", "path": "마이페이지 > 기업정보 > 업종명", "repeatable": True},
                {"key": "industry_code", "label": "업종코드", "required": True, "input_type": "text", "path": "마이페이지 > 기업정보 > 업종코드", "repeatable": True, "examples": ["C24", "C25"]},
                {"key": "region", "label": "지역", "required": True, "input_type": "text", "path": "마이페이지 > 기업정보 > 지역"},
                {"key": "employee_count", "label": "직원수", "required": False, "input_type": "number", "unit": "명", "path": "마이페이지 > 기업정보 > 직원수"},
                {"key": "annual_revenue", "label": "연 매출액", "required": True, "input_type": "currency", "unit": "만원", "path": "마이페이지 > 기업정보 > 연 매출액", "examples": ["10억 원 = 100000", "12억 원 = 120000"], "basis": "2026년 입력 기준으로는 보통 2025년 매출액"},
                {
                    "key": "annual_expected_revenue",
                    "label": "연간 예상 매출액",
                    "required": False,
                    "input_type": "currency",
                    "unit": "만원",
                    "path": "마이페이지 > 기업정보 > 연간 예상 매출액",
                    "aliases": ["예상 매출", "예상매출액", "연간예상매출", "예상 연매출", "수주 매출", "앞으로 1년 매출"],
                    "input_rule": "앞으로 1년 동안 발생할 것으로 예상되는 매출액을 입력합니다.",
                    "reason_rule": "연간 예상 매출액은 기업의 성장 가능성, 설비 투자 후 매출 증가 가능성, 지원사업의 사업화 가능성 판단에 활용됩니다.",
                    "comparison_rule": "연 매출액은 직전년도 실제 확정 매출이고, 연간 예상 매출액은 앞으로 1년 동안 발생할 것으로 예상되는 매출입니다.",
                    "calculation_rule": "연간 예상 매출액 = 월평균 예상 매출액 × 12 또는 예상 판매수량 × 판매단가",
                    "conversion_rule": "월평균 예상 매출만 알고 있다면 월평균 예상 매출에 12를 곱해 연간 예상 매출액으로 환산합니다.",
                    "amount_example": "월 예상 매출이 1억 원이면 1억 × 12개월 = 12억 원이고, FactoFit에는 120,000만원으로 입력합니다.",
                    "include": ["제품 판매 예상 매출", "납품 예정 매출", "수주계약 기반 예상 매출", "판매계획 기반 예상 매출"],
                    "exclude": ["순이익", "영업이익", "지원금", "대출금", "투자금", "보조금"],
                    "evidence_documents": [
                        {
                            "document": "수주계약서, 발주서, 판매계획표, 생산계획표",
                            "section": "계약금액, 발주금액, 예상 판매수량, 판매단가, 월별 예상 매출",
                            "check_points": ["계약금액", "발주금액", "월별 예상 매출", "예상 판매수량", "판매단가"],
                            "derive_rule": "월별 예상 매출을 합산하거나 월평균 예상 매출에 12를 곱해 연간 예상 매출액을 계산합니다.",
                            "example": "월 예상 매출이 8,000만원이면 8,000 × 12 = 96,000만원으로 입력합니다."
                        }
                    ],
                    "tip": "예상값이므로 실제 수주·발주·판매계획 근거가 있는 금액을 기준으로 보수적으로 입력하는 것이 좋습니다."
                },
                {
                    "key": "recent_3y_revenue",
                    "label": "최근 3개년 매출액",
                    "required": False,
                    "input_type": "field_group",
                    "unit": "만원",
                    "path": "마이페이지 > 기업정보 > 최근 3개년 매출액",
                    "children": ["2024 매출액", "2023 매출액"],
                    "input_rule": "3년 합계 하나가 아니라 연도별 매출액을 나눠 입력합니다.",
                    "reason_rule": "최근 3개년 매출액을 입력하면 한 해 매출만 보는 것보다 기업의 평균적인 매출 규모와 매출 흐름을 더 안정적으로 판단할 수 있습니다.",
                    "calculation_rule": "최근 3개년 평균 매출 = 최근 3개년 매출 합계 ÷ 3",
                    "example": "2025년 120,000만원, 2024년 110,000만원, 2023년 105,000만원이면 3개년 평균은 약 111,667만원입니다.",
                    "fallback_rule": "입력하지 않으면 직전년도 매출액 기준으로 3년 평균값 계산 가능"
                },
                {"key": "revenue_2024", "label": "2024 매출액", "required": False, "input_type": "currency", "unit": "만원", "path": "마이페이지 > 기업정보 > 최근 3개년 매출액 > 2024 매출액"},
                {"key": "revenue_2023", "label": "2023 매출액", "required": False, "input_type": "currency", "unit": "만원", "path": "마이페이지 > 기업정보 > 최근 3개년 매출액 > 2023 매출액"},
                {
                    "key": "business_registration_no",
                    "label": "사업자등록번호",
                    "required": False,
                    "input_type": "text",
                    "path": "마이페이지 > 기업정보 > 선택정보 입력하기 > 사업자등록번호",
                    "format_hint": "000-00-00000",
                    "input_rule": "사업자등록증에 표시된 사업자등록번호를 입력합니다.",
                    "evidence_documents": [
                        {
                            "document": "사업자등록증",
                            "section": "등록번호 또는 사업자등록번호",
                            "check_points": ["등록번호", "사업자등록번호"],
                            "derive_rule": "사업자등록증의 10자리 번호를 000-00-00000 형식으로 입력합니다.",
                            "example": "321-54-09876처럼 입력합니다."
                        }
                    ],
                    "exclude": ["법인등록번호", "대표자 주민등록번호", "통신판매업 신고번호"]
                },
                {
                    "key": "total_assets",
                    "label": "기업자산 총액",
                    "required": False,
                    "input_type": "currency",
                    "unit": "만원",
                    "path": "마이페이지 > 기업정보 > 선택정보 입력하기 > 기업자산 총액",
                    "input_rule": "기업이 보유한 전체 자산 규모를 입력합니다.",
                    "evidence_documents": [
                        {
                            "document": "재무제표",
                            "section": "재무상태표",
                            "check_points": ["자산총계", "총자산", "자산의 총계"],
                            "derive_rule": "재무상태표의 자산총계 값을 확인한 뒤 만원 단위로 변환해 입력합니다.",
                            "example": "자산총계가 1,200,000,000원이면 120,000만원으로 입력합니다."
                        }
                    ],
                    "reason_rule": "기업자산 총액은 회사가 보유한 전체 자산 규모를 보는 값이기 때문에 재무상태표의 자산 항목을 기준으로 확인합니다."
                },
                {"key": "conglomerate_affiliation", "label": "대기업 계열사 여부", "required": False, "input_type": "select", "path": "마이페이지 > 기업정보 > 선택정보 입력하기 > 대기업 계열사 여부", "options": ["무소속", "대기업 계열사 소속", "확인필요"]},
                {"key": "founded_year", "label": "설립연도", "required": False, "input_type": "year", "unit": "년", "path": "마이페이지 > 기업정보 > 선택정보 입력하기 > 설립연도", "format_hint": "YYYY"},
                {"key": "workplace_type", "label": "사업장 유형", "required": False, "input_type": "select", "path": "마이페이지 > 기업정보 > 선택정보 입력하기 > 사업장 유형", "options": ["본사", "공장", "연구소", "지점", "본사+공장", "기타"]},
                {"key": "primary_purpose", "label": "주요 목적", "required": False, "input_type": "select", "path": "마이페이지 > 기업정보 > 선택정보 입력하기 > 주요 목적", "options": ["지원사업 추천", "ROI분석", "설비교체", "에너지 절감", "안전점검", "신청서 생성"]},
            ],
        },
        {
            "group": "equipment",
            "label": "설비현황",
            "path": "마이페이지 > 설비현황",
            "business_goal": "설비 ROI, 에너지 절감, 안전점검, 지원사업 매칭에 필요한 설비 기준값 수집",
            "fields": [
                {"key": "equipment_type", "label": "설비 종류", "required": True, "input_type": "select", "path": "마이페이지 > 설비현황 > 설비 종류", "options": ["press", "cnc", "injection", "welding", "compressor", "etc"]},
                {"key": "equipment_name", "label": "설비명", "required": True, "input_type": "text", "path": "마이페이지 > 설비현황 > 설비명"},
                {"key": "process", "label": "공정", "required": False, "input_type": "text", "path": "마이페이지 > 설비현황 > 공정"},
                {"key": "equipment_age_years", "label": "설비 사용연수", "required": False, "input_type": "number", "unit": "년", "path": "마이페이지 > 설비현황 > 설비 사용연수"},
                {
                    "key": "annual_energy_cost",
                    "label": "연간 에너지 비용",
                    "required": False,
                    "input_type": "currency",
                    "unit": "만원/년",
                    "path": "마이페이지 > 설비현황 > 연간 에너지 비용",
                    "aliases": ["에너지 비용", "전기요금", "전기 비용", "연간 전기요금", "전력비", "월 전기요금"],
                    "input_rule": "월 전기요금이 아니라 1년 동안 사용한 전기·가스 등 에너지 비용의 합계를 입력합니다.",
                    "period_rule": "연간 에너지 비용은 월 전기요금이 아니라 1년 동안 사용한 전기·가스 등 에너지 비용을 입력하는 값입니다.",
                    "reason_rule": "FactoFit은 설비 교체나 에너지 절감 효과를 연간 기준으로 계산하기 때문에 1년치 비용이 필요합니다.",
                    "conversion_rule": "월평균 비용만 알고 있다면 월평균 비용에 12를 곱해 연간 비용으로 환산합니다.",
                    "amount_example": "월 전기요금이 400만원이면 400 × 12 = 4,800만원으로 입력합니다.",
                    "include": ["전기요금", "가스비", "압축공기 사용 전력", "설비 운전에 직접 들어가는 에너지 비용"],
                    "exclude": ["유지보수비", "수리비", "신규 설비 구매비", "인건비"],
                    "tip": "공장 전체 비용보다는 해당 설비 기준으로 추정하면 ROI 분석이 더 정확합니다."
                },
                {"key": "defect_rate", "label": "불량률", "required": False, "input_type": "percentage", "unit": "%", "path": "마이페이지 > 설비현황 > 불량률"},
                {
                    "key": "full_replacement_investment",
                    "label": "전체교체 예상 투자금",
                    "required": False,
                    "input_type": "currency",
                    "unit": "만원",
                    "path": "마이페이지 > 설비현황 > 전체교체 예상 투자금",
                    "aliases": ["전체교체 투자금", "전체교체 비용", "전체 교체 예상 투자금", "새 설비 교체 비용", "신규 설비 투자금"],
                    "input_rule": "기존 설비를 새 설비로 완전히 교체할 때 필요한 총 예상 비용을 입력합니다.",
                    "amount_rule": "장비 구매비만 넣지 말고 설치비, 운송비, 철거비, 시운전비, 전기·배관·기초공사 같은 부대공사비까지 포함한 총액 기준으로 잡는 것이 좋습니다.",
                    "calculation_rule": "전체교체 예상 투자금 = 신규 설비 구매비 + 설치비 + 운송비 + 철거비 + 시운전비 + 부대공사비",
                    "example": "CNC 장비 구매비가 8,000만원, 설치비가 500만원, 운송비가 200만원, 시운전비가 300만원이면 전체교체 예상 투자금은 약 9,000만원으로 입력합니다.",
                    "include": ["신규 설비 구매비", "설치비", "운송비", "철거비", "시운전비", "전기·배관·기초공사 등 부대공사비", "필수 옵션 비용"],
                    "exclude": ["연간 유지보수 비용", "월 전기요금", "인건비", "소모품 비용", "부분교체 비용만 단독 입력"],
                    "tip": "정확한 견적이 없으면 공급사 견적서나 유사 장비 가격을 기준으로 보수적으로 입력하는 것이 좋습니다."
                },
                {
                    "key": "partial_replacement_investment",
                    "label": "부분교체 예상 투자금",
                    "required": False,
                    "input_type": "currency",
                    "unit": "만원",
                    "path": "마이페이지 > 설비현황 > 부분교체 예상 투자금",
                    "aliases": ["부분교체 투자금", "부분교체 비용", "부분 교체 예상 투자금", "부품 교체비", "개조 비용"],
                    "input_rule": "기존 설비를 유지하면서 주요 부품이나 일부 장치만 교체·개선할 때 드는 예상 비용을 입력합니다.",
                    "amount_rule": "신규 설비 전체 구매비가 아니라 모터·제어반·센서 같은 핵심 부품 교체비와 개조 공임을 중심으로 잡는 것이 좋습니다.",
                    "calculation_rule": "부분교체 예상 투자금 = 교체 부품비 + 개조·수리 공임 + 부분 시운전비 + 필요한 부대 작업비",
                    "example": "제어반 700만원, 모터 500만원, 공임 300만원이면 부분교체 예상 투자금은 약 1,500만원으로 입력합니다.",
                    "include": ["핵심 부품 교체비", "제어반·모터·센서 교체비", "개조·수리 공임", "부분 시운전비", "부분 교체에 필요한 부대 작업비"],
                    "exclude": ["신규 설비 전체 구매비", "정기점검비만 단독 입력", "월 전기요금", "연간 유지보수비 전체"],
                    "tip": "전체교체보다 비용은 낮지만 절감 효과가 제한될 수 있어 전체교체 비용과 함께 비교하면 좋습니다."
                },
                {"key": "annual_maintenance_cost", "label": "연간 유지보수 비용", "required": False, "input_type": "currency", "unit": "만원/년", "path": "마이페이지 > 설비현황 > 연간 유지보수 비용"},
                {"key": "capacity_value", "label": "설비 용량 규격값", "required": False, "input_type": "text_or_number", "path": "마이페이지 > 설비현황 > 설비 용량 규격값", "unit_rule": "설비 종류에 따라 톤, kW, 대, mm 등 달라질 수 있음"},
                {"key": "annual_production", "label": "연간 생산량", "required": False, "input_type": "number", "unit": "개/년", "path": "마이페이지 > 설비현황 > 연간 생산량"},
                {"key": "profit_per_unit", "label": "제품 개당 예상이익", "required": False, "input_type": "currency", "unit": "원 또는 만원", "path": "마이페이지 > 설비현황 > 제품 개당 예상이익", "unit_rule": "프론트 단위 선택 또는 안내 문구와 일치해야 함"},
            ],
        },
    ],
    "related_concepts_allowed_for_explanation": [
        "생산능력", "가동률", "수율", "ROI", "회수기간", "에너지 절감액", "유지보수", "정기점검",
        "신규 설비 구매비", "설치비", "시운전비", "운송비", "부대공사비", "소모품 교체비", "공정 개선",
        "감가상각", "지원금", "실부담금", "투자금", "불량 손실액", "생산성"
    ],
}


def schema_to_prompt() -> str:
    """LLM 프롬프트에 넣기 좋은 압축 JSON 문자열을 반환합니다."""
    return json.dumps(FACTOFIT_INPUT_SCHEMA, ensure_ascii=False, separators=(",", ":"))


CLICK_CHAT_THREE_SYSTEM_PROMPT = """
너는 FactoFit의 Click Chat Three 전용 AI Agent다.
역할은 사용자가 마이페이지의 기업정보와 설비현황 입력 항목을 이해하고 올바르게 입력하도록 돕는 것이다.

중요 원칙:
1. 아래 FactoFit 입력 스키마를 기준으로 답변한다.
2. 단어별 고정 사전 답변처럼 말하지 말고, 사용자의 질문 의도를 분석해서 자연스럽게 답변한다.
3. 사용자가 한 문장에 2개 이상을 물으면 각각 나누어 모두 답변한다.
4. 사용자가 차이점, 비교, 다른 점, vs, 랑/이랑을 물으면 비교 형태로 답변한다.
5. 스키마에 없는 개념도 질문 이해에 필요하면 설명할 수 있다. 단, 스키마에 없는 개념을 실제 입력칸처럼 말하지 않는다.
6. 금액 단위는 스키마에 별도 단위가 없으면 기본적으로 만원 기준으로 안내한다.
7. 계산 방법이나 적정 금액 기준을 물으면 산식, 포함 항목, 제외 항목, 예시를 포함한다.
8. 월/연간/1년치/12개월 기준을 물으면 period_rule, reason_rule, conversion_rule, amount_example을 활용해서 왜 1년치 기준인지 설명한다.
9. 최근 3개년 매출액처럼 평균/정확도/합계/연도별 입력을 묻는 질문은 reason_rule, calculation_rule, example을 활용해서 왜 연도별 입력이 더 정확한지 설명한다.
9-1. 연간 예상 매출액 질문은 실제 확정 매출과 구분하고, 수주계약서·발주서·판매계획표·생산계획표 같은 근거자료, 계산식, 포함/제외 항목을 함께 안내한다.
9. 포함/제외 항목을 물으면 “포함하면 좋은 내용”과 “포함하지 않는 내용”을 구분한다.
10. FactoFit 마이페이지 입력과 무관한 질문은 범위 밖이라고 짧게 안내한다.
11. 답변은 한국어로, 2~6문장 정도의 짧은 실무형 문장으로 작성한다.

반드시 아래 JSON 형식만 반환한다. 마크다운 코드블록은 쓰지 않는다.
{
  "intent": "company_info | equipment_info | comparison | input_method | amount_guidance | period_conversion | calculation_help | field_list | out_of_scope | general_help 중 하나",
  "matched": true,
  "confidence": 0.0,
  "assistant_message": "사용자에게 바로 보여줄 핵심 답변",
  "referenced_fields": ["참고한 스키마 항목명"],
  "cards": [
    {
      "type": "conversation_answer",
      "title": "카드 제목",
      "subtitle": "마이페이지 경로 또는 설명",
      "category": "기업정보 | 설비현황 | 비교 설명 | 안내",
      "group": "company | equipment | mixed | system",
      "badge": "AI 답변",
      "assistant_message": "카드 상단 답변",
      "sections": [
        {"key": "answer", "title": "답변", "icon": "message-circle", "content": "내용", "items": [], "highlight": null}
      ],
      "related_terms": []
    }
  ]
}
"""
