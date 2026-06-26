from __future__ import annotations

import re
from typing import Any, Literal
from fastapi import APIRouter
from pydantic import BaseModel, Field

try:
    from app.prompts.router_click_chat_three import CLICK_CHAT_THREE_ROUTER_SYSTEM_PROMPT
except Exception:
    CLICK_CHAT_THREE_ROUTER_SYSTEM_PROMPT = """당신은 FactoFit Click Chat Three 전용 정보 안내 라우터입니다.
사용자 질문을 company_field/equipment_field/field_list/input_help/general 중 하나로만 분류하세요.
대화 이력: {chat_history}
현재 사용자 메시지: {user_message}"""

router = APIRouter(prefix="/click-chat-three", tags=["click-chat-three"])
Intent = Literal["company_field", "equipment_field", "field_list", "input_help", "general"]
Group = Literal["company", "equipment"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ClickChatThreeRequest(BaseModel):
    message: str = Field(..., description="사용자 질문")
    term: str | None = Field(None, description="프론트에서 선택한 단어 또는 항목명")
    chat_history: list[ChatMessage] = Field(default_factory=list)
    use_llm_router: bool = Field(False, description="True면 app.core.llm 기반 라우터 분류를 시도합니다.")


ChatMessage.model_rebuild(); ClickChatThreeRequest.model_rebuild()


FIELDS_TSV = """key	label	group	required	input_type	unit	subgroup	options	aliases	definition	easy	example	tip	validation	related
company_name	기업명	company	1	text				회사명,업체명,법인명	지원사업 추천과 신청서 생성에 사용할 기업의 공식 이름입니다.	사업자등록증이나 법인등기부등본에 적힌 회사 이름을 입력하면 됩니다.	예: 쌍용금속, 팩토핏테크, OO정밀	공고 신청서와 비교될 수 있으므로 약칭보다 공식 명칭을 쓰는 것이 좋습니다.	문자 입력	사업자등록번호,기업규모
company_size	기업규모	company	1	select			소상공인,소기업,중소기업,중견기업,대기업,확인필요	기업 규모,회사 규모,company_type	기업이 어느 규모 분류에 속하는지 나타내는 값입니다.	지원사업마다 신청 가능한 기업 규모가 달라서 매칭 기준으로 중요하게 사용됩니다.	예: 일반 제조 중소기업이면 중소기업 선택	확실하지 않으면 중소기업확인서 또는 중견기업확인서를 기준으로 확인하세요.	소상공인/소기업/중소기업/중견기업/대기업/확인필요 중 선택	중소기업확인서,대기업 계열사 여부
industry_name	업종명	company	1	text				업종,산업명,업태,종목	기업이 실제로 수행하는 제조업 분야의 이름입니다.	우리 회사가 어떤 제품이나 공정을 하는지 적는 항목입니다.	예: 금속가공업, 금속가공 제조업, 사출성형 제조업	업종코드와 함께 입력하면 지원사업 매칭 정확도가 올라갑니다.	문자 입력, 여러 업종 추가 가능	업종코드,지역
industry_code	업종코드	company	1	text				산업코드,표준산업분류코드,KSIC,C24,C25	한국표준산업분류 기준으로 업종을 구분하는 코드입니다.	지원사업에서 C24 금속 제조업처럼 업종 제한을 걸 때 사용하는 코드입니다.	예: C24는 1차 금속 제조업, C25는 금속가공제품 제조업	사업자등록증의 업태/종목과 실제 공정을 함께 확인해 입력하세요.	C로 시작하는 제조업 코드 등 문자+숫자 형식	업종명,지원사업 추천
region	지역	company	1	text				소재지,사업장 지역,주소,지역명	기업 또는 사업장이 위치한 지역입니다.	지역별 지원사업을 추천하기 위해 사용하는 정보입니다.	예: 인천, 경기 화성, 서울, 부산	본사와 공장 지역이 다르면 실제 사업장 위치를 확인하세요.	시/도 또는 시/군/구 입력	사업장 유형,지원사업 추천
employee_count	직원수	company	0	number	명			직원 수,근로자 수,상시근로자,종업원수	기업에서 근무하는 직원 수입니다.	기업 규모 조건이나 가점 판단에 활용될 수 있습니다.	예: 직원이 10명이면 10 입력	상시근로자 기준은 공고와 4대보험 가입자명부를 함께 확인하세요.	숫자 입력	4대보험 가입자명부,기업규모
annual_revenue	연 매출액	company	1	currency	만원			연매출,연매출액,매출액,직전년도 매출액	기준 연도의 직전년도 매출액입니다.	2026년에 입력한다면 보통 2025년 매출액을 만원 단위로 입력합니다.	예: 10억 원은 100000, 12억 원은 120000 입력	단위가 원이 아니라 만원이므로 10억 원을 100000으로 입력하세요.	숫자 입력, 단위 만원	최근 3개년 매출액,재무제표
annual_expected_revenue	연간 예상 매출액	company	0	currency	만원			예상 매출,예상매출액,연간예상매출,연간 예상매출,예상 연매출,예상 연매출액,앞으로 1년 매출,수주 매출,예상 수주 매출	앞으로 1년 동안 발생할 것으로 예상되는 매출액입니다.	확정된 과거 매출이 아니라 현재 수주 현황, 생산계획, 판매계획을 기준으로 추정한 예상 매출입니다.	예: 월 예상 매출이 1억 원이면 연간 12억 원으로 보고 120000 입력	지원사업의 성장성·사업화 가능성과 ROI의 매출 증가 효과를 설명할 때 활용할 수 있습니다.	숫자 입력, 단위 만원, 월평균 예상 매출 × 12 또는 예상 판매수량 × 판매단가	연 매출액,최근 3개년 매출액,지원사업 추천,ROI분석
recent_3y_revenue	최근 3개년 매출액	company	0	group	만원	최근 3개년 매출액		3개년 매출,최근 3년 매출,3년 평균 매출,최근 3개년 매출,3년 합계,연도별 매출	최근 3년 동안의 연도별 매출액을 입력하는 선택 항목입니다.	3년 합계 하나가 아니라 연도별 매출액을 나눠 입력하면 기업의 평균적인 매출 규모와 매출 흐름을 더 안정적으로 판단할 수 있습니다.	예: 2025년 120000, 2024년 110000, 2023년 105000이면 3개년 평균은 약 111667만원	한 해 매출만 보면 일시적인 급증·감소가 반영될 수 있어 지원사업 조건 판단이 흔들릴 수 있습니다. 연도별로 넣으면 평균 매출 기준이 더 정확해집니다.	연도별 숫자 입력, 단위 만원, 3년 평균 = 3개년 매출 합계 ÷ 3	2024 매출액,2023 매출액,연 매출액
revenue_2024	2024 매출액	company	0	currency	만원	최근 3개년 매출액		2024년 매출액,2024 매출,전년도 매출	2024년에 발생한 기업의 총 매출액입니다.	최근 3개년 매출 평균을 계산하기 위한 연도별 입력값입니다.	예: 11억 원이면 110000 입력	부가가치세 신고자료나 재무제표 기준으로 맞추는 것이 좋습니다.	숫자 입력, 단위 만원	최근 3개년 매출액,2023 매출액
revenue_2023	2023 매출액	company	0	currency	만원	최근 3개년 매출액		2023년 매출액,2023 매출	2023년에 발생한 기업의 총 매출액입니다.	최근 3개년 매출 평균을 계산하기 위한 연도별 입력값입니다.	예: 10억 5천만 원이면 105000 입력	연 매출액과 같은 단위인 만원으로 입력해야 계산 오류가 줄어듭니다.	숫자 입력, 단위 만원	최근 3개년 매출액,2024 매출액
business_registration_no	사업자등록번호	company	0	text				사업자 번호,사업자등록 번호,사업자번호	국세청에 등록된 사업체 고유 번호입니다.	기업을 식별하기 위한 10자리 번호입니다.	예: 321-54-09876	사업자등록증의 번호와 동일하게 입력해야 서류 검증과 신청서 생성에 유리합니다.	000-00-00000 형식 권장	사업자등록증,기업명
total_assets	기업자산 총액	company	0	currency	만원			자산총액,총자산,기업 자산,자산 총액	기업이 보유한 전체 자산 규모입니다.	현금, 설비, 재고, 건물 등 회사가 가진 자산의 합계입니다.	예: 9억 원이면 90000 입력	기업 규모 판단에 영향을 줄 수 있어 재무제표 기준으로 확인하세요.	숫자 입력, 단위 만원	재무제표,대기업 계열사 여부
conglomerate_affiliation	대기업 계열사 여부	company	0	select			무소속,대기업 계열사 소속,확인필요	대기업 계열,계열사 여부,독립성,독립성 확인	해당 기업이 대기업 집단이나 계열사에 속하는지 확인하는 항목입니다.	중소기업 지원사업은 대기업 계열 여부에 따라 제외될 수 있어 확인이 필요합니다.	예: 독립 운영 중인 중소 제조업체면 무소속 선택	확실하지 않으면 중소기업확인서와 기업집단 소속 여부를 확인하세요.	무소속/대기업 계열사 소속/확인필요 중 선택	기업규모,중소기업확인서
founded_year	설립연도	company	0	year				창업연도,설립 년도,업력,창업일	기업이 설립된 연도입니다.	업력 조건이 있는 지원사업을 판단하기 위해 사용됩니다.	예: 2019년에 설립했다면 2019 입력	창업기업 전용 사업은 사업자등록일 기준으로 업력을 계산하는 경우가 많습니다.	4자리 연도 입력	업력,사업자등록증
workplace_type	사업장 유형	company	0	select			본사,공장,연구소,지점,본사+공장,기타	사업장 형태,사업장,사업장구분	입력하는 사업장이 어떤 역할을 하는 곳인지 구분하는 항목입니다.	본사인지, 실제 생산 공장인지, 연구소인지 표시합니다.	예: 본사와 공장이 같은 장소면 본사+공장 선택	설비 ROI나 안전점검은 실제 설비가 있는 공장 기준 정보가 더 중요합니다.	본사/공장/연구소/지점/본사+공장/기타 중 선택	지역,설비현황
primary_purpose	주요 목적	company	0	select			지원사업 추천,ROI분석,설비교체,에너지 절감,안전점검,신청서 생성	이용 목적,목적,사용 목적,주요목적	FactoFit을 사용하는 핵심 목적입니다.	어떤 기능을 먼저 도와줄지 정하기 위한 선택값입니다.	예: 설비 교체 효과를 보고 싶다면 ROI분석 선택	주요 목적에 따라 AI Advisor가 우선 안내하는 내용이 달라질 수 있습니다.	지원사업 추천/ROI분석/설비교체/에너지 절감/안전점검/신청서 생성 중 선택	ROI분석,지원사업 추천,안전점검
equipment_type	설비 종류	equipment	1	select			press,cnc,injection,welding,compressor,etc	설비유형,장비 종류,장비유형,equipment_type	분석할 설비가 어떤 종류의 장비인지 구분하는 항목입니다.	프레스, CNC, 사출기, 용접기, 컴프레서처럼 설비 유형을 선택합니다.	예: CNC 선반이면 cnc, 사출성형기면 injection 선택	설비 종류에 따라 ROI 계산, 안전점검, 지원사업 매칭 기준이 달라질 수 있습니다.	press/cnc/injection/welding/compressor/etc 중 선택	설비명,공정
equipment_name	설비명	equipment	1	text				장비명,기계명,설비 이름	분석할 설비의 이름입니다.	현장에서 부르는 장비 이름이나 모델명을 입력하면 됩니다.	예: CNC 가공기 #1, 프레스 1호기, 사출기 3라인	여러 설비를 관리할 경우 번호나 라인을 함께 적으면 구분하기 쉽습니다.	문자 입력	설비 종류,설비 사용연수
process	공정	equipment	0	text				생산공정,작업공정,라인,공정명	해당 설비가 사용되는 생산 단계 또는 작업 과정입니다.	절단, 가공, 사출, 용접, 검사처럼 설비가 맡는 일을 입력합니다.	예: 금속 절삭가공, 사출성형, 용접, 압축공기 공급	공정을 함께 입력하면 정책 추천과 안전점검 항목이 더 구체화됩니다.	문자 입력	설비 종류,연간 생산량
equipment_age_years	설비 사용연수	equipment	0	number	년			사용연수,사용 년수,설비 나이,노후도,사용 기간	현재 설비를 실제로 사용한 기간입니다.	설비를 도입한 뒤 몇 년 동안 사용했는지 입력합니다.	예: 2021년에 설치하고 현재 2026년이면 약 5년 입력	노후 설비 교체 지원사업이나 유지보수 비용 판단에 활용될 수 있습니다.	숫자 입력, 단위 년	전체교체 예상 투자금,연간 유지보수 비용
annual_energy_cost	연간 에너지 비용	equipment	0	currency	만원			에너지 비용,전기요금,전기 비용,연간 전기요금,전력비	해당 설비가 1년 동안 사용하는 전기·가스 등 에너지 비용입니다.	설비 하나 때문에 1년에 얼마나 전기료가 드는지 입력하는 값입니다.	예: 월 전기요금 400만원이면 연간 약 4800만원 입력	전체 공장 전기요금이 아니라 해당 설비 기준으로 추정하면 ROI 분석이 더 정확합니다.	숫자 입력, 단위 만원	에너지 절감,ROI분석
defect_rate	불량률	equipment	0	percentage	%			불량 비율,불량율,불량,제품 불량률	전체 생산품 중 불량품이 차지하는 비율입니다.	100개를 만들었을 때 몇 개가 불량인지 보는 값입니다.	예: 1000개 중 30개가 불량이면 3%	설비 교체 후 불량률이 줄어드는 효과는 ROI 계산에서 중요한 절감 요인입니다.	숫자 입력, 단위 %	제품 개당 예상이익,연간 생산량
full_replacement_investment	전체교체 예상 투자금	equipment	0	currency	만원			전체 교체비,전체교체비,신규 설비 투자금,전체 교체 투자금,전체 교체 예상 투자금,새 설비 교체 비용	기존 설비를 새 설비로 완전히 교체할 때 필요한 총 예상 금액입니다.	새 장비를 구매하고 설치·운송·시운전까지 완료하는 데 드는 총 비용입니다.	예: CNC 장비 구매비 8000만원 + 설치비 500만원 + 운송비 200만원 + 시운전비 300만원 = 약 9000만원	견적서 기준 장비값만 보지 말고 설치비, 운송비, 시운전비, 전기·배관·기초공사 같은 부대비용까지 포함하면 ROI 분석이 더 현실적입니다.	숫자 입력, 단위 만원	부분교체 예상 투자금,ROI분석
partial_replacement_investment	부분교체 예상 투자금	equipment	0	currency	만원			부분 교체비,부분교체비,개조 비용,부품 교체비	핵심 부품, 제어장치, 모터 등을 일부 교체할 때 필요한 예상 금액입니다.	장비를 통째로 바꾸지 않고 필요한 부분만 개선하는 비용입니다.	예: 제어반 교체와 모터 교체 비용 15000만원	전체교체보다 투자금은 낮지만 절감효과가 제한적일 수 있어 비교 분석이 필요합니다.	숫자 입력, 단위 만원	전체교체 예상 투자금,연간 유지보수 비용
annual_maintenance_cost	연간 유지보수 비용	equipment	0	currency	만원			유지보수비,수리비,보전비,정비비	설비를 1년 동안 유지·수리하는 데 들어가는 비용입니다.	고장 수리, 부품 교체, 정기점검 등에 쓰는 비용입니다.	예: 월평균 80만원 수리비가 들면 연간 960만원	노후 설비는 유지보수 비용이 커져 교체 ROI가 좋아질 수 있습니다.	숫자 입력, 단위 만원	설비 사용연수,부분교체 예상 투자금
capacity_value	설비 용량 규격값	equipment	0	number				설비용량,용량,규격값,스펙,capacity	설비의 성능이나 크기를 나타내는 대표 규격값입니다.	프레스 톤수, 컴프레서 kW, CNC 가공 범위처럼 설비의 규모를 나타냅니다.	예: 프레스 150톤, 컴프레서 75kW, 사출기 250톤	설비 종류마다 단위가 다르므로 프론트에서 설비 종류별 단위 표시를 붙이면 좋습니다.	숫자 또는 숫자+단위 입력	설비 종류,연간 생산량
annual_production	연간 생산량	equipment	0	number	개/년			생산량,연 생산량,연간 생산 수량,총 생산량	해당 설비 또는 공정에서 1년 동안 생산하는 제품 수량입니다.	1년에 몇 개를 만드는지 입력하는 값입니다.	예: 월 10000개 생산이면 연간 120000개	불량률 개선 효과를 금액으로 환산할 때 중요한 기준값입니다.	숫자 입력	불량률,제품 개당 예상이익
profit_per_unit	제품 개당 예상이익	equipment	0	currency	원 또는 만원			개당 이익,제품당 이익,마진,단위 이익	제품 1개를 판매했을 때 남는 예상 이익입니다.	불량이 줄었을 때 회수되는 이익을 계산하기 위한 값입니다.	예: 제품 1개당 3000원 이익	매출액이 아니라 원가를 제외한 이익 기준으로 입력해야 ROI가 과대평가되지 않습니다.	숫자 입력, 프론트에서 단위 선택 권장	불량률,연간 생산량,ROI분석"""

OPTIONS_TSV = """label	parent_key	definition	example	tip	aliases
소상공인	company_size	상시근로자 수와 매출 규모가 작은 사업자입니다.	예: 제조업은 상시근로자 10명 미만 기준이 자주 사용됩니다.	정확한 기준은 업종별로 다르므로 소상공인확인서를 확인하세요.	
소기업	company_size	중소기업 중에서도 매출 규모가 더 작은 기업 분류입니다.	예: 일부 지원사업은 소기업을 우선 지원합니다.	중소기업확인서에 표시된 기업 유형을 기준으로 선택하세요.	
중소기업	company_size	중소기업기본법상 규모 기준을 충족하는 기업입니다.	예: 대부분의 제조업 지원사업은 중소기업을 기본 대상으로 합니다.	중소기업확인서가 있으면 가장 안전하게 판단할 수 있습니다.	
중견기업	company_size	중소기업보다 규모가 크지만 대기업은 아닌 기업 분류입니다.	예: 일부 R&D나 수출 지원사업은 중견기업도 신청 가능합니다.	중소기업 전용 사업에서는 제외될 수 있습니다.	
대기업	company_size	기업 규모가 커서 일반 중소기업 지원사업 대상에서 제외되는 경우가 많은 분류입니다.	예: 대기업은 중소기업 전용 보조금 사업에 신청하기 어렵습니다.	대기업 계열사 여부도 함께 확인해야 합니다.	
확인필요	company_size	현재 기업 규모를 확정하기 어려울 때 임시로 선택하는 값입니다.	예: 중소기업확인서가 아직 없는 경우	나중에 확인서 기준으로 반드시 수정하는 것이 좋습니다.	
무소속	conglomerate_affiliation	대기업 계열이나 기업집단에 속하지 않은 독립 기업입니다.	예: 독립 운영 중인 중소 제조업체	중소기업 지원사업에서 일반적으로 유리한 상태입니다.	
대기업 계열사 소속	conglomerate_affiliation	대기업 또는 기업집단의 계열사로 분류될 가능성이 있는 상태입니다.	예: 대기업이 지분을 보유하거나 지배관계가 있는 회사	중소기업 지원사업에서 제외될 수 있으므로 확인이 필요합니다.	
본사	workplace_type	기업의 관리·영업·대표 기능이 있는 주된 사무소입니다.	예: 대표 주소지와 경영지원 부서가 있는 장소	설비 분석은 실제 설비가 있는 공장 정보가 더 중요할 수 있습니다.	
공장	workplace_type	제품을 실제로 생산하거나 가공하는 사업장입니다.	예: CNC, 프레스, 사출기가 설치된 생산 현장	설비현황, 안전점검, 에너지 비용은 공장 기준 입력이 좋습니다.	
연구소	workplace_type	기술개발이나 시험·연구를 수행하는 사업장입니다.	예: 기업부설연구소	R&D 지원사업과 연결될 수 있습니다.	
지점	workplace_type	본사 외 별도로 운영되는 사업장입니다.	예: 지역 영업소 또는 생산 지점	지역 제한 사업은 지점 소재지 인정 여부를 확인해야 합니다.	
본사+공장	workplace_type	본사 기능과 생산 공장이 같은 장소에 있는 형태입니다.	예: 사무실과 생산라인이 같은 건물 또는 같은 부지에 있는 경우	지역, 설비, 안전 정보를 한 장소 기준으로 묶어 관리하기 좋습니다.	
기타	workplace_type	본사/공장/연구소/지점으로 구분하기 어려운 사업장입니다.	예: 물류창고, 임시 작업장	가능하면 실제 기능을 메모로 남기는 것이 좋습니다.	
지원사업 추천	primary_purpose	기업정보를 바탕으로 신청 가능한 정부지원사업을 찾는 목적입니다.	예: 인천 금속가공 중소기업에게 맞는 지원사업 추천	기업규모, 업종코드, 지역 정보가 정확해야 합니다.	
ROI분석	primary_purpose	설비 투자 대비 회수기간과 경제성을 분석하는 목적입니다.	예: CNC 교체 투자금 8천만원의 회수기간 계산	투자금, 에너지 비용, 불량률, 생산량 입력이 중요합니다.	ROI 분석,roi분석
설비교체	primary_purpose	노후 설비를 전체 또는 부분 교체하는 의사결정을 돕는 목적입니다.	예: 오래된 프레스 설비를 새 설비로 교체할지 판단	전체교체와 부분교체 투자금을 나눠 입력하면 비교가 쉽습니다.	설비 교체
에너지 절감	primary_purpose	전기료나 에너지 사용량을 줄이는 효과를 분석하는 목적입니다.	예: 고효율 컴프레서 교체로 전기요금 절감	연간 에너지 비용을 정확히 입력해야 합니다.	
안전점검	primary_purpose	설비 위험요소와 점검 항목을 확인하는 목적입니다.	예: 프레스 방호장치, 비상정지장치 점검	설비 종류와 공정 정보가 필요합니다.	안전 점검
신청서 생성	primary_purpose	지원사업 신청서나 사업계획서 초안을 만드는 목적입니다.	예: 설비교체 목적의 신청서 문장 생성	기업정보와 설비현황이 충분할수록 초안 품질이 좋아집니다.	신청서생성
press	equipment_type	금속판이나 소재를 압력으로 눌러 성형·절단하는 프레스 설비입니다.	예: 프레스 1호기, 유압프레스	안전 리스크가 높아 방호장치와 양수조작장치 확인이 중요합니다.	프레스
cnc	equipment_type	컴퓨터 제어로 절삭·가공을 수행하는 CNC 설비입니다.	예: CNC 선반, 머시닝센터	정밀도, 가동률, 공구비, 불량률이 ROI에 영향을 줍니다.	CNC,씨엔씨
injection	equipment_type	금형에 수지를 주입해 제품을 만드는 사출 설비입니다.	예: 사출성형기 250톤	금형 상태, 에너지 사용량, 불량률을 함께 보는 것이 좋습니다.	사출,사출기,사출성형기
welding	equipment_type	금속 부품을 열이나 압력으로 접합하는 용접 설비입니다.	예: 로봇용접기, CO2 용접기	흄, 화재, 보호구, 품질 안정성 확인이 필요합니다.	용접,용접기
compressor	equipment_type	압축공기를 생산해 공장 설비에 공급하는 컴프레서입니다.	예: 75kW 공기압축기	전기요금 비중이 커서 에너지 절감 ROI 분석에 자주 사용됩니다.	컴프레서,공기압축기
etc	equipment_type	목록에 없는 기타 설비입니다.	예: 포장기, 검사기, 세척기	가능하면 설비명과 공정을 자세히 적어야 AI 분석이 쉬워집니다.	기타"""


def _split(v: str | None) -> list[str]:
    return [x.strip() for x in (v or "").split(",") if x.strip()]


def _parse_tsv(raw: str) -> list[dict[str, Any]]:
    lines = [x for x in raw.strip().splitlines() if x.strip()]
    headers = lines[0].split("\t")
    return [dict(zip(headers, line.split("\t"))) for line in lines[1:]]


def _field(row: dict[str, Any]) -> dict[str, Any]:
    row = dict(row)
    row["required"] = row.get("required") == "1"
    for k in ("options", "aliases", "related"):
        row[k] = _split(row.get(k))
    return row


FIELDS = [_field(x) for x in _parse_tsv(FIELDS_TSV)]
OPTIONS = [{**x, "aliases": _split(x.get("aliases"))} for x in _parse_tsv(OPTIONS_TSV)]
FIELD_BY_KEY = {f["key"]: f for f in FIELDS}
COMPANY_FIELDS = [f for f in FIELDS if f["group"] == "company"]
EQUIPMENT_FIELDS = [f for f in FIELDS if f["group"] == "equipment"]
GROUP_LABEL = {"company": "기업정보", "equipment": "설비현황"}


def _norm(text: str) -> str:
    return re.sub(r"[^0-9a-zA-Z가-힣+]+", "", (text or "").lower())


def _terms(item: dict[str, Any], option: bool = False) -> set[str]:
    base = [item["label"], *item.get("aliases", [])] if option else [item["label"], item["key"], *item.get("aliases", [])]
    return {_norm(x) for x in base if x}


FIELD_TERMS = [(f, _terms(f)) for f in FIELDS]
OPTION_TERMS = [(o, _terms(o, True)) for o in OPTIONS]


def _path(f: dict[str, Any]) -> str:
    mid = f" > {f['subgroup']}" if f.get("subgroup") else ""
    return f"마이페이지 > {GROUP_LABEL[f['group']]}{mid} > {f['label']}"


def _badge(f: dict[str, Any]) -> str:
    return "필수" if f.get("required") else "선택"


def _history(items: list[ChatMessage]) -> str:
    return "없음" if not items else "\n".join(f"{'사용자' if m.role == 'user' else 'AI'}: {m.content}" for m in items[-8:])


def _requested(message: str, term: str | None = None) -> str:
    if term and term.strip():
        return term.strip()
    text = (message or "").strip()
    q = re.search(r"['\"‘’“”](.+?)['\"‘’“”]", text)
    if q:
        return q.group(1).strip()
    patterns = [r"에\s*대해\s*(자세히|쉽게|간단히)?\s*(설명해줘|설명해|알려줘|말해줘)", r"[이가은는]\s*뭐야\??", r"뜻이?\s*뭐야\??", r"뜻\s*알려줘", r"어떻게\s*입력해\??", r"뭘\s*입력해\??", r"설명해줘|설명해|알려줘|말해줘"]
    for p in patterns:
        text = re.sub(p, "", text, flags=re.I).strip()
    return re.split(r"[?.!,\n]", text)[0].strip() or (message or "").strip()


def _list_request(message: str) -> bool:
    text = _norm(message)
    return any(k in text for k in ["전체", "목록", "리스트", "항목", "단어", "정리", "필드", "스키마"]) and any(k in text for k in ["기업정보", "설비현황", "설비", "기업"])


def _find(message: str, term: str | None = None) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str, float]:
    req, req_norm, msg_norm = _requested(message, term), _norm(_requested(message, term)), _norm(message)
    for f, terms in FIELD_TERMS:
        if req_norm in terms:
            return f, None, req, 1.0
    for o, terms in OPTION_TERMS:
        if req_norm in terms:
            return FIELD_BY_KEY[o["parent_key"]], o, req, 1.0
    for f, terms in sorted(FIELD_TERMS, key=lambda x: len(x[0]["label"]), reverse=True):
        if any(t and t in msg_norm for t in terms):
            return f, None, req, 0.82
    for o, terms in sorted(OPTION_TERMS, key=lambda x: len(x[0]["label"]), reverse=True):
        if any(t and t in msg_norm for t in terms):
            return FIELD_BY_KEY[o["parent_key"]], o, req, 0.78
    return None, None, req, 0.0


def _local_intent(message: str, f: dict[str, Any] | None) -> Intent:
    if _list_request(message):
        return "field_list"
    if not f:
        return "general"
    return "input_help" if any(k in message for k in ["입력", "예시", "단위", "어떻게", "무엇", "뭘"]) else ("company_field" if f["group"] == "company" else "equipment_field")

async def _intent(req: ClickChatThreeRequest, f: dict[str, Any] | None) -> Intent:
    if req.use_llm_router:
        try:
            from app.core.llm import llm
            prompt = CLICK_CHAT_THREE_ROUTER_SYSTEM_PROMPT.format(chat_history=_history(req.chat_history), user_message=req.message.strip())
            raw = re.sub(r"[^a-z_]+", "", getattr(await llm.ainvoke(prompt), "content", "").lower())
            if raw in {"company_field", "equipment_field", "field_list", "input_help", "general"}:
                return raw  # type: ignore[return-value]
        except Exception:
            pass
    return _local_intent(req.message, f)

DETAIL_GUIDES: dict[str, dict[str, Any]] = {
    "company_name": {"include": ["사업자등록증 또는 법인등기부등본에 적힌 공식 회사명", "약칭이 아닌 대외 제출용 기업명"], "exclude": ["브랜드명만 단독 입력", "담당자 이름"], "hint": "신청서와 서류명이 비교될 수 있어서 공식 명칭으로 맞추는 게 좋아요."},
    "company_size": {"include": ["소상공인, 소기업, 중소기업, 중견기업, 대기업 중 해당 규모", "모르면 확인필요"], "exclude": ["매출액만 보고 임의 선택"], "hint": "중소기업확인서나 중견기업확인서가 있으면 그 기준을 우선으로 보면 돼요."},
    "industry_name": {"include": ["실제로 하는 제조·가공 분야", "업태/종목 또는 주력 생산품 기준 업종명"], "exclude": ["너무 넓은 표현만 입력: 제조업", "실제와 다른 업종"], "hint": "업종코드와 같이 넣으면 지원사업 매칭 정확도가 올라가요."},
    "industry_code": {"include": ["C24, C25처럼 한국표준산업분류 코드", "주력 업종에 해당하는 코드"], "exclude": ["사업자등록번호", "제품 모델명"], "hint": "제조업은 보통 C로 시작하는 코드가 많아요."},
    "region": {"include": ["본사 또는 실제 사업장이 있는 지역", "시/도 또는 시/군/구"], "exclude": ["거래처 지역", "대표자 거주지"], "hint": "지역 제한 지원사업은 사업장 소재지를 기준으로 보는 경우가 많아요."},
    "employee_count": {"include": ["상시 근무하는 직원 수", "대표 포함 여부는 공고 기준에 맞춰 확인"], "exclude": ["외주 협력사 인원", "일시적인 방문 인원"], "hint": "4대보험 가입자명부 기준으로 확인하면 가장 안정적이에요."},
    "annual_revenue": {"include": ["직전년도 연 매출액", "재무제표나 부가세 신고자료 기준 금액"], "exclude": ["월 매출", "순이익", "자산 총액"], "hint": "단위는 만원이에요. 10억 원이면 100000으로 입력해요."},
    "annual_expected_revenue": {
        "include": [
            "제품 판매 예상 매출",
            "납품 예정 매출",
            "수주계약 기반 예상 매출",
            "판매계획 또는 생산계획 기반 예상 매출",
        ],
        "exclude": [
            "순이익",
            "영업이익",
            "지원금",
            "대출금",
            "투자금",
            "보조금",
        ],
        "input_rule": "연간 예상 매출액은 앞으로 1년 동안 발생할 것으로 예상되는 매출액을 입력하는 값이에요.",
        "reason_rule": "연간 예상 매출액은 기업의 성장 가능성, 설비 투자 후 매출 증가 가능성, 지원사업의 사업화 가능성을 판단할 때 활용할 수 있어요.",
        "comparison_rule": "연 매출액은 보통 직전년도에 실제로 발생한 확정 매출이고, 연간 예상 매출액은 앞으로 1년 동안 발생할 것으로 예상되는 매출이에요.",
        "period_rule": "연간 예상 매출액은 월별 예상 매출이 아니라 앞으로 1년 동안 발생할 것으로 예상되는 총 매출액을 입력하는 값이에요.",
        "conversion_rule": "월평균 예상 매출만 알고 있다면 월평균 예상 매출에 12를 곱해 연간 예상 매출액으로 환산합니다.",
        "calculation_rule": "연간 예상 매출액 = 월평균 예상 매출액 × 12 또는 예상 판매수량 × 판매단가로 계산할 수 있습니다.",
        "amount_rule": "확정 재무제표가 아니라 수주 현황, 발주서, 판매계획표, 생산계획표를 기준으로 보수적으로 추정하는 것이 좋아요.",
        "amount_example": "월 예상 매출이 1억 원이면 1억 × 12개월 = 12억 원이고, FactoFit에는 120,000만원으로 입력합니다.",
        "evidence_documents": [
            {
                "document": "수주계약서, 발주서, 판매계획표, 생산계획표",
                "section": "계약금액, 발주금액, 예상 판매수량, 판매단가, 월별 예상 매출",
                "check_points": ["계약금액", "발주금액", "월별 예상 매출", "예상 판매수량", "판매단가"],
                "derive_rule": "월별 예상 매출을 합산하거나 월평균 예상 매출에 12를 곱해 연간 예상 매출액을 계산합니다.",
                "example": "월 예상 매출이 8,000만원이면 8,000 × 12 = 96,000만원으로 입력합니다.",
            }
        ],
        "hint": "예상값이므로 과하게 잡기보다 실제 수주·발주·판매계획 근거가 있는 금액을 기준으로 입력하는 것이 좋아요.",
    },
    "recent_3y_revenue": {
        "include": ["최근 연도별 매출액", "2024년, 2023년 같은 연도별 금액", "지원사업 조건 판단에 사용할 평균 매출 기준값"],
        "exclude": ["3년 합계만 입력", "월별 매출", "순이익"],
        "reason_rule": "최근 3개년 매출액을 입력하면 한 해 매출만 보는 것보다 기업의 평균적인 매출 규모와 매출 흐름을 더 안정적으로 판단할 수 있어요.",
        "calculation_rule": "최근 3개년 평균 매출 = 최근 3개년 매출 합계 ÷ 3으로 계산합니다.",
        "amount_example": "예를 들어 2025년 매출 120,000만원, 2024년 매출 110,000만원, 2023년 매출 105,000만원이면 3개년 평균 매출은 약 111,667만원입니다.",
        "hint": "지원사업은 특정 연도 매출만 보는 경우도 있지만, 평균 매출이나 성장 흐름을 함께 보는 경우가 있어서 연도별로 입력하는 것이 좋아요."
    },
    "revenue_2024": {"include": ["2024년에 발생한 총 매출액", "재무제표 또는 부가세 신고 기준 금액"], "exclude": ["2024년 순이익", "2023년 매출"], "hint": "단위는 연 매출액과 똑같이 만원이에요."},
    "revenue_2023": {"include": ["2023년에 발생한 총 매출액", "재무제표 또는 부가세 신고 기준 금액"], "exclude": ["2023년 순이익", "2024년 매출"], "hint": "최근 3개년 평균 계산용 값이에요."},
    "business_registration_no": {
        "include": [
            "사업자등록증에 적힌 10자리 사업자등록번호",
            "000-00-00000 형식"
        ],
        "exclude": [
            "법인등록번호",
            "대표자 주민등록번호",
            "통신판매업 신고번호"
        ],
        "evidence_documents": [
            {
                "document": "사업자등록증",
                "section": "등록번호 또는 사업자등록번호",
                "check_points": ["등록번호", "사업자등록번호"],
                "derive_rule": "사업자등록증에 표시된 10자리 번호를 000-00-00000 형식으로 입력합니다.",
                "example": "321-54-09876처럼 입력하면 됩니다.",
            }
        ],
        "hint": "법인등록번호나 대표자 주민등록번호와 혼동하지 않도록 사업자등록증의 사업자등록번호를 기준으로 입력하세요.",
    },
    "total_assets": {
        "include": ["재무제표상 자산 총액", "현금, 설비, 재고, 건물 등 자산 합계"],
        "exclude": ["연 매출액", "영업이익"],
        "evidence_documents": [
            {
                "document": "재무제표",
                "section": "재무상태표",
                "check_points": ["자산총계", "총자산", "자산의 총계"],
                "derive_rule": "재무상태표의 자산총계 값을 확인한 뒤 FactoFit 입력 단위인 만원으로 변환해 입력합니다.",
                "example": "재무상태표에 자산총계가 1,200,000,000원으로 표시되어 있다면 120,000만원으로 입력합니다.",
            }
        ],
        "reason_rule": "기업자산 총액은 회사가 보유한 전체 자산 규모를 보는 값이기 때문에 손익계산서가 아니라 재무상태표의 자산 항목을 기준으로 확인하는 것이 맞아요.",
        "hint": "기업 규모 판단에 영향을 줄 수 있으니 재무제표의 재무상태표 기준으로 입력하는 것이 좋아요.",
    },
    "conglomerate_affiliation": {"include": ["무소속, 대기업 계열사 소속, 확인필요 중 하나", "기업집단 소속 여부"], "exclude": ["거래처가 대기업이라는 이유로 계열사 선택"], "hint": "대기업 계열이면 일부 중소기업 지원사업에서 제외될 수 있어요."},
    "founded_year": {"include": ["사업자등록일 또는 법인 설립일 기준 연도", "4자리 연도"], "exclude": ["공장 이전 연도", "설비 도입 연도"], "hint": "창업기업 조건은 설립연도와 업력으로 판단하는 경우가 많아요."},
    "workplace_type": {"include": ["본사, 공장, 연구소, 지점, 본사+공장, 기타 중 하나", "입력하는 장소의 실제 역할"], "exclude": ["거래처 사업장 유형"], "hint": "설비가 있는 곳이면 공장 또는 본사+공장으로 보는 경우가 많아요."},
    "primary_purpose": {"include": ["지원사업 추천, ROI분석, 설비교체, 에너지 절감, 안전점검, 신청서 생성 중 주 목적", "가장 먼저 도움받고 싶은 기능"], "exclude": ["회사 업종명", "지원사업명"], "hint": "선택한 목적에 따라 AI가 먼저 보여주는 안내가 달라질 수 있어요."},
    "equipment_type": {"include": ["press, cnc, injection, welding, compressor, etc 중 하나", "분석할 장비의 큰 종류"], "exclude": ["설비 모델명만 입력", "공정명만 입력"], "hint": "정확한 종류를 고르면 ROI와 안전점검 기준이 더 잘 맞아요."},
    "equipment_name": {"include": ["현장에서 부르는 장비명", "모델명, 호기, 라인 번호"], "exclude": ["업체명만 입력", "공정명만 단독 입력"], "hint": "여러 설비를 구분하려면 #1, 1호기 같은 번호를 붙이면 좋아요."},
    "process": {"include": ["절단, 가공, 사출, 용접, 검사 같은 생산 단계", "설비가 맡는 작업 내용"], "exclude": ["회사 전체 업종만 입력", "설비 구매처"], "hint": "공정을 넣으면 지원사업 추천과 안전점검 안내가 더 구체화돼요."},
    "equipment_age_years": {"include": ["설비를 실제 사용한 기간", "도입 후 지난 연수"], "exclude": ["회사 설립연도", "작업자 근속연수"], "hint": "예를 들어 2021년에 설치해 2026년에 입력한다면 약 5년으로 넣으면 돼요."},
    "annual_energy_cost": {
        "include": [
            "해당 설비의 1년 전기요금",
            "가스비",
            "압축공기 사용 전력 등 설비 운전에 드는 에너지 비용",
            "월 비용을 알고 있으면 12개월로 환산한 금액",
        ],
        "exclude": [
            "공장 전체 에너지 비용을 그대로 입력",
            "유지보수비",
            "수리비",
            "신규 설비 구매비",
        ],
        "period_rule": "연간 에너지 비용은 월 전기요금이 아니라 1년 동안 사용한 전기·가스 등 에너지 비용을 입력하는 값이에요.",
        "reason_rule": "이 값을 1년치로 넣는 이유는 FactoFit이 설비 교체나 에너지 절감 효과를 연간 기준으로 계산하기 때문이에요.",
        "conversion_rule": "월평균 전기요금만 알고 있다면 월평균 비용에 12를 곱해서 입력하면 됩니다.",
        "amount_example": "월 전기요금이 400만원이면 400 × 12 = 4,800만원으로 입력하면 돼요.",
        "hint": "공장 전체 비용보다는 해당 설비 기준으로 추정하면 ROI 분석이 더 정확해요.",
    },
    "defect_rate": {"include": ["전체 생산량 중 불량품 비율", "폐기, 재작업, 기준 미달 수량 비율"], "exclude": ["고장률", "반품률만 단독 입력"], "hint": "1000개 중 30개가 불량이면 3%처럼 퍼센트로 넣으면 돼요."},
    "full_replacement_investment": {
        "include": ["신규 설비 구매비", "설치비", "운송비", "철거비", "시운전비", "전기·배관·기초공사 같은 부대공사비", "필수 옵션 비용"],
        "exclude": ["연간 유지보수비", "월 전기요금", "인건비", "소모품 비용", "부분교체 비용만 단독 입력"],
        "amount_rule": "장비 구매가만 넣기보다는 실제로 설비를 새 장비로 바꾸는 데 필요한 총액 기준으로 잡는 것이 좋아요.",
        "calculation_rule": "전체교체 예상 투자금 = 신규 설비 구매비 + 설치비 + 운송비 + 철거비 + 시운전비 + 부대공사비",
        "amount_example": "CNC 장비 구매비 8,000만원, 설치비 500만원, 운송비 200만원, 시운전비 300만원이면 약 9,000만원으로 입력하면 됩니다.",
        "hint": "정확한 견적이 없으면 공급사 견적서나 유사 장비 가격을 기준으로 보수적으로 입력하는 것이 좋아요."
    },
    "partial_replacement_investment": {
        "include": ["모터·제어반·센서 같은 핵심 부품 교체비", "개조·수리 공임", "부분 개선 시운전비", "부분 교체에 필요한 부대 작업비"],
        "exclude": ["신규 설비 전체 구매비", "정기점검비만 입력", "월 전기요금", "연간 유지보수비 전체"],
        "amount_rule": "기존 설비는 유지하고 성능 개선이나 고장 원인 해결을 위해 일부 장치만 바꾸는 비용을 입력하면 돼요.",
        "calculation_rule": "부분교체 예상 투자금 = 교체 부품비 + 개조·수리 공임 + 부분 시운전비 + 필요한 부대 작업비",
        "amount_example": "제어반 700만원, 모터 500만원, 공임 300만원이면 약 1,500만원으로 입력하면 됩니다.",
        "hint": "전체교체보다 비용은 낮지만 절감 효과가 제한될 수 있어서 전체교체 비용과 함께 비교하면 좋아요."
    },
    "annual_maintenance_cost": {"include": ["정기 점검 비용", "고장 수리/AS 비용", "소모품·부품 교체 비용", "윤활유, 필터, 벨트 같은 유지관리 소모품"], "exclude": ["신규 설비 구매비", "전체교체 예상 투자금", "부분교체 예상 투자금", "전기요금 같은 에너지 비용"], "hint": "월평균 수리·점검비가 80만원이면 연간 960만원처럼 1년 기준으로 넣으면 돼요."},
    "capacity_value": {"include": ["프레스 톤수", "컴프레서 kW", "사출기 톤수", "CNC 가공 범위처럼 대표 스펙"], "exclude": ["생산량", "구매금액"], "hint": "설비 종류마다 단위가 달라서 숫자와 단위를 함께 적어두면 좋아요."},
    "annual_production": {"include": ["해당 설비 또는 공정의 1년 생산 수량", "월 생산량을 12개월로 환산한 값"], "exclude": ["공장 전체 생산량을 무조건 입력", "매출액"], "hint": "월 10,000개 생산이면 연간 120,000개로 넣으면 돼요."},
    "profit_per_unit": {"include": ["제품 1개 판매 시 남는 예상 이익", "판매가에서 원가를 뺀 마진"], "exclude": ["제품 판매가 전체", "월 총이익"], "hint": "불량률 개선 효과를 금액으로 계산할 때 쓰이므로 매출이 아니라 이익 기준이 좋아요."},
}

def _section(key: str, title: str, icon: str, content: str = "", highlight: str | None = None, items: list[str] | None = None) -> dict[str, Any]:
    data = {"key": key, "title": title, "icon": icon, "content": content, "highlight": highlight}
    if items:
        data["items"] = items
    return data

def _question_type(message: str, f: dict[str, Any] | None = None) -> str:
    text = _norm(message)
    if any(k in text for k in ["차이", "달라", "다른점", "비교", "vs", "같은값", "같아"]):
        return "comparison"
    if any(k in text for k in ["서류", "증빙", "근거", "어디서", "확인", "어떤부분", "어느부분", "무슨자료", "자료", "보고입력", "보고", "재무제표", "재무상태표", "고지서", "견적서", "명부", "생산일보", "품질검사표", "수주계약서", "발주서", "판매계획", "판매계획표", "생산계획", "생산계획표"]):
        return "evidence_help"
    if any(k in text for k in ["월", "1년치", "일년치", "12개월", "월평균", "월전기요금", "월전기료", "1년치를", "연단위", "월예상매출", "월매출", "환산"]):
        return "period_conversion"
    if any(k in text for k in ["단위", "만원", "원으로", "원단위", "억", "억원", "퍼센트", "%"]):
        return "unit"
    if any(k in text for k in ["포함", "들어가", "내용", "뭐적", "무엇을적", "뭘적", "넣어", "작성", "매출을", "순이익", "지원금", "보조금"]):
        return "contents"
    if any(k in text for k in ["왜", "필요", "쓰는", "사용", "활용", "이유", "정확", "평균", "3년평균", "조건판단", "매출흐름", "성장", "성장성", "사업화"]):
        return "why"
    if any(k in text for k in ["어느정도", "적당", "대략", "얼마", "예산", "견적", "산정", "잡아야", "잡으면", "비용기준", "금액기준", "계산", "산식"]):
        return "amount_guidance"
    if any(k in text for k in ["선택", "골라", "고르", "옵션", "종류"]):
        return "choice"
    if any(k in text for k in ["어떻게", "입력", "예시"]):
        return "how"
    return "summary"

def _join(items: list[str]) -> str:
    return ", ".join(items[:-1]) + (f", {items[-1]}" if len(items) > 1 else (items[0] if items else ""))

def _topic(label: str) -> str:
    if not label:
        return "은"
    ch = label[-1]
    code = ord(ch)
    if 0xAC00 <= code <= 0xD7A3:
        return "은" if (code - 0xAC00) % 28 else "는"
    return "은"

def _answer_text(message: str, f: dict[str, Any], o: dict[str, Any] | None = None) -> tuple[str, list[dict[str, Any]]]:
    qtype, guide = _question_type(message, f), DETAIL_GUIDES.get(f["key"], {})
    include, exclude = guide.get("include", []), guide.get("exclude", [])
    hint = guide.get("hint") or f.get("tip") or "입력 기준이 애매하면 실제 증빙자료 기준으로 맞추는 게 좋아요."

    if o:
        parent = f["label"]
        answer = f"{o['label']}은 '{parent}'에서 고르는 선택값이에요. {o['definition']}"
        sections = [_section("answer", "답변", "message-circle", answer, o["label"]), _section("when_to_select", "이럴 때 선택", "check", o.get("example") or f.get("example", "")), _section("tip", "입력 팁", "lightbulb", o.get("tip") or hint)]
        return answer, sections

    if qtype == "comparison":
        comparison_rule = guide.get("comparison_rule")
        if comparison_rule:
            answer_parts = [comparison_rule]
            if guide.get("input_rule"):
                answer_parts.append(guide["input_rule"])
            if guide.get("amount_example"):
                answer_parts.append(f"예를 들어 {guide['amount_example']}")
            answer = "\n\n".join([p for p in answer_parts if p])
            sections = [_section("answer", "답변", "message-circle", answer, f["label"])]
            sections.append(_section("comparison", "비교 기준", "git-compare", comparison_rule))
            if guide.get("amount_example"):
                sections.append(_section("example", "예시", "star", guide["amount_example"]))
            sections.append(_section("tip", "입력 팁", "lightbulb", hint))
            return answer, sections

    if qtype == "evidence_help":
        evidence_docs = guide.get("evidence_documents", [])
        if evidence_docs:
            doc = evidence_docs[0]
            document = doc.get("document", "관련 서류")
            section_name = doc.get("section", "확인 항목")
            check_points = doc.get("check_points", [])
            derive_rule = doc.get("derive_rule", "")
            example = doc.get("example", "")

            answer_parts = [f"{f['label']}{_topic(f['label'])} 보통 {document}의 {section_name}에서 확인하면 돼요."]
            if check_points:
                answer_parts.append("여기서 확인할 부분은 보통 " + ", ".join(check_points) + " 항목입니다.")
            if derive_rule:
                answer_parts.append(derive_rule)
            if example:
                answer_parts.append(f"예를 들어 {example}")
            answer = "\n\n".join([p for p in answer_parts if p])

            sections = [
                _section("answer", "답변", "message-circle", answer, f["label"]),
                _section("document", "확인할 서류", "file-text", document),
                _section("section", "서류에서 볼 부분", "search", section_name),
            ]
            if check_points:
                sections.append(_section("check_points", "봐야 하는 항목", "check", items=check_points))
            if derive_rule:
                sections.append(_section("derive_rule", "도출 방식", "calculator", derive_rule))
            if example:
                sections.append(_section("example", "예시", "star", example))
            sections.append(_section("tip", "입력 팁", "lightbulb", hint))
            return answer, sections

        answer = f"{f['label']}은 관련 증빙자료에서 확인한 값을 기준으로 입력하면 돼요."
        sections = [_section("answer", "답변", "message-circle", answer, f["label"]), _section("tip", "입력 팁", "lightbulb", hint)]
        return answer, sections

    if qtype == "period_conversion":
        period_rule = guide.get("period_rule") or f"{f['label']}은 월 기준이 아니라 연간 기준으로 입력하는 항목이에요."
        reason_rule = guide.get("reason_rule") or "FactoFit은 ROI나 절감 효과를 연간 기준으로 보기 때문에 1년치 값이 필요해요."
        conversion_rule = guide.get("conversion_rule") or "월평균 비용만 알고 있다면 월평균 비용에 12를 곱해서 입력하면 됩니다."
        amount_example = guide.get("amount_example") or f.get("example", "")
        answer_parts = [period_rule, reason_rule, conversion_rule]
        if amount_example:
            answer_parts.append(f"예를 들어 {amount_example}")
        answer = "\n\n".join([p for p in answer_parts if p])
        sections = [
            _section("answer", "답변", "message-circle", answer, f["label"]),
            _section("reason", "왜 1년치로 입력하나요?", "info", reason_rule),
            _section("conversion", "환산 방법", "calculator", conversion_rule),
        ]
        if amount_example:
            sections.append(_section("example", "예시", "star", amount_example))
        if include:
            sections.append(_section("include", "포함하면 좋은 내용", "check", items=include))
        if exclude:
            sections.append(_section("exclude", "포함하지 않는 내용", "x-circle", items=exclude))
        sections.append(_section("tip", "입력 팁", "lightbulb", hint))
        return answer, sections

    if qtype == "amount_guidance":
        amount_rule = guide.get("amount_rule") or f.get("tip") or f"{f['label']}은 화면 기준에 맞춰 예상 금액을 입력하면 돼요."
        calc_rule = guide.get("calculation_rule")
        amount_example = guide.get("amount_example") or f.get("example", "")
        unit = f.get("unit") or "만원"
        answer_parts = [
            f"{f['label']}은 {f['easy']}",
            amount_rule,
        ]
        if calc_rule:
            answer_parts.append(calc_rule)
        if amount_example:
            answer_parts.append(f"예를 들어 {amount_example}")
        answer_parts.append(f"입력 단위는 {unit}입니다.")
        answer = "\n\n".join([p for p in answer_parts if p])
        sections = [_section("answer", "답변", "message-circle", answer, f["label"])]
        if include:
            sections.append(_section("include", "포함하면 좋은 내용", "check", items=include))
        if exclude:
            sections.append(_section("exclude", "포함하지 않는 내용", "x-circle", items=exclude))
        if calc_rule:
            sections.append(_section("calculation", "산정 기준", "calculator", calc_rule, unit))
        if amount_example:
            sections.append(_section("example", "예시", "star", amount_example))
        sections.append(_section("tip", "입력 팁", "lightbulb", hint))
        return answer, sections

    if qtype == "contents":
        if f.get("key") == "recent_3y_revenue" and guide.get("reason_rule"):
            answer_parts = [
                "최근 3개년 매출액은 3년 합계 하나를 넣는 것이 아니라 연도별 매출액을 나눠 입력하는 값이에요.",
                guide.get("reason_rule"),
                guide.get("calculation_rule"),
            ]
            if guide.get("amount_example"):
                answer_parts.append(f"예를 들어 {guide['amount_example']}")
            answer = "\n\n".join([p for p in answer_parts if p])
        else:
            answer = f"{f['label']}에는 {(_join(include) if include else f['easy'])}을 입력하면 돼요."
        sections = [_section("answer", "답변", "message-circle", answer, f["label"])]
        if include:
            sections.append(_section("include", "포함하면 좋은 내용", "check", items=include))
        if exclude:
            sections.append(_section("exclude", "포함하지 않는 내용", "x-circle", items=exclude))
        if guide.get("reason_rule"):
            sections.append(_section("reason", "왜 더 정확한가요?", "info", guide["reason_rule"]))
        if guide.get("calculation_rule"):
            sections.append(_section("calculation", "계산 기준", "calculator", guide["calculation_rule"]))
        if guide.get("amount_example"):
            sections.append(_section("example", "예시", "star", guide["amount_example"]))
        sections.append(_section("tip", "입력 팁", "lightbulb", hint, f.get("unit") or None))
        return answer, sections

    if qtype == "unit":
        unit = f.get("unit") or "별도 고정 단위 없음"
        answer = f"{f['label']}의 입력 단위는 {unit}입니다. {f.get('validation') or '화면의 입력 기준에 맞춰 작성하면 돼요.'}"
        sections = [_section("answer", "답변", "message-circle", answer, unit), _section("example", "입력 예", "calculator", f.get("example", "")), _section("tip", "주의할 점", "lightbulb", hint)]
        return answer, sections

    if qtype == "why":
        reason_rule = guide.get("reason_rule")
        calculation_rule = guide.get("calculation_rule")
        amount_example = guide.get("amount_example")
        answer_parts = [
            f"{f['label']}은 {f['definition']}",
            reason_rule or "이 값은 FactoFit이 지원사업 추천, ROI 분석, 신청서 생성에 필요한 기준을 잡을 때 사용해요.",
        ]
        if calculation_rule:
            answer_parts.append(calculation_rule)
        if amount_example:
            answer_parts.append(f"예를 들어 {amount_example}")
        answer = "\n\n".join([p for p in answer_parts if p])
        sections = [_section("answer", "답변", "message-circle", answer, f["label"])]
        if reason_rule:
            sections.append(_section("reason", "왜 필요한가요?", "info", reason_rule))
        if calculation_rule:
            sections.append(_section("calculation", "계산 기준", "calculator", calculation_rule))
        if amount_example:
            sections.append(_section("example", "예시", "star", amount_example))
        sections.append(_section("used_for", "주로 쓰이는 곳", "link", f"연관 항목: {', '.join(f.get('related', [])[:5])}"))
        sections.append(_section("tip", "입력 팁", "lightbulb", hint))
        return answer, sections

    if qtype == "choice" and f.get("options"):
        answer = f"{f['label']}은 아래 선택지 중에서 현재 상황에 가장 가까운 값을 고르면 돼요."
        sections = [_section("answer", "답변", "message-circle", answer, f["label"]), _section("options", "선택 가능한 값", "list", items=f["options"]), _section("tip", "선택 팁", "lightbulb", hint)]
        return answer, sections

    if qtype == "how":
        answer = f"{f['label']}은 {f['easy']} {f.get('example', '')}"
        sections = [_section("answer", "답변", "message-circle", answer, f["label"])]
        if include:
            sections.append(_section("include", "입력하면 좋은 내용", "check", items=include))
        sections.append(_section("rule", "입력 기준", "edit-3", f.get("validation") or "문자 또는 숫자로 입력", f.get("unit") or None))
        sections.append(_section("tip", "입력 팁", "lightbulb", hint))
        return answer, sections

    if guide.get("input_rule"):
        answer_parts = [guide.get("input_rule")]
        if guide.get("reason_rule"):
            answer_parts.append(guide["reason_rule"])
        answer = "\n\n".join([p for p in answer_parts if p])
    else:
        answer = f"{f['label']}은 {f['easy']}"
    sections = [_section("answer", "답변", "message-circle", answer, f["label"])]
    if include:
        sections.append(_section("include", "주로 들어가는 내용", "check", items=include[:4]))
    if f.get("options"):
        sections.append(_section("options", "선택값", "list", items=f["options"]))
    if f.get("unit"):
        sections.append(_section("unit", "단위", "calculator", f"입력 단위는 {f['unit']}입니다.", f["unit"]))
    sections.append(_section("tip", "입력 팁", "lightbulb", hint))
    return answer, sections

def _card(f: dict[str, Any], o: dict[str, Any] | None = None, message: str = "") -> dict[str, Any]:
    answer, sections = _answer_text(message, f, o)
    badge = "선택값" if o else _badge(f)
    title = o["label"] if o else f["label"]
    flow = "사용자 질문 분석 → 입력 항목 매칭 → 질문 의도 분류 → 대화형 답변 반환"
    return {
        "type": "conversation_answer",
        "title": title,
        "subtitle": f"{_path(f)}의 선택값" if o else _path(f),
        "category": GROUP_LABEL[f["group"]],
        "group": f["group"],
        "badge": badge,
        "assistant_message": answer,
        "answer": answer,
        "sections": sections,
        "options": f.get("options", []),
        "related_terms": ([f["label"], *f.get("related", [])[:4]] if o else f.get("related", [])),
        "backend_flow": f"백엔드 동작: {flow}",
        "actions": [
            {"label": "기업정보 전체 보기", "target": "/api/click-chat-three/fields?group=company"},
            {"label": "설비현황 전체 보기", "target": "/api/click-chat-three/fields?group=equipment"},
        ],
    }

def _list_card(group: Group | None = None) -> dict[str, Any]:
    items = [f for f in FIELDS if group is None or f["group"] == group]
    title = "기업정보·설비현황 입력 항목" if group is None else ("기업정보 입력 항목" if group == "company" else "설비현황 입력 항목")
    answer = f"{title}은 총 {len(items)}개예요. 궁금한 항목을 하나 입력하면 말풍선 형태로 무엇을 적어야 하는지 알려드릴게요."
    rows = [f"{f['label']} ({_badge(f)}{(' / ' + f['unit']) if f.get('unit') else ''})" for f in items]
    return {"type": "conversation_list", "title": title, "subtitle": "FactoFit 마이페이지 입력 사전", "category": "입력항목 목록", "group": "system", "badge": "목록", "assistant_message": answer, "answer": answer, "sections": [_section("answer", "답변", "message-circle", answer), _section("list", "질문 가능한 항목", "list", items=rows), _section("usage", "사용 예", "lightbulb", "예: '유지보수 비용에는 뭐가 들어가?', '연 매출액 단위 알려줘', 'CNC는 뭐야?'처럼 입력하면 돼요.")], "options": [], "related_terms": ["기업규모", "연 매출액", "설비 종류", "연간 유지보수 비용", "불량률"], "backend_flow": "백엔드 동작: 목록 요청 감지 → group 필터 적용 → 대화형 목록 반환", "actions": []}

def _notice(requested: str) -> dict[str, Any]:
    answer = f"'{requested}'은 현재 기업정보나 설비현황 입력 항목에서 찾지 못했어요. 마이페이지에 있는 항목명으로 다시 질문해 주세요."
    return {"type": "conversation_notice", "title": "질문 가능한 범위를 벗어났어요", "subtitle": "Click Chat Three는 마이페이지 입력 도움 전용입니다.", "category": "안내", "group": "system", "badge": "안내", "assistant_message": answer, "answer": answer, "sections": [_section("answer", "답변", "message-circle", answer), _section("examples", "다시 질문하는 예", "star", items=["연간 유지보수 비용에는 뭐가 들어가?", "연 매출액은 어떻게 입력해?", "설비 종류는 뭘 고르면 돼?", "불량률은 어떻게 계산해?"])], "options": [], "related_terms": ["기업규모", "연 매출액", "설비 종류", "설비 사용연수", "연간 유지보수 비용"], "backend_flow": "백엔드 동작: 필드 사전 매칭 실패 → 대화형 안내 반환", "actions": []}

def _response(intent: Intent, source: str, requested: str, matched: bool, card: dict[str, Any], score: float = 0, matched_term: str | None = None, trace: list[str] | None = None) -> dict[str, Any]:
    msg = card.get("assistant_message") or (f"{matched_term or requested}에 대해 알려드릴게요." if matched else "기업정보 또는 설비현황에 있는 단어를 하나 입력해 주세요.")
    return {"screen_id": "click_chat_three_chat", "intent": intent, "assistant_message": msg, "source": source, "matched": matched, "match_score": round(score, 3) if score else 0, "requested_term": requested, "matched_term": matched_term, "cards": [card], "node_trace": trace or [], "backend_flow": card["backend_flow"]}

def _serialize(f: dict[str, Any]) -> dict[str, Any]:
    return {k: f.get(k) for k in ["key", "label", "group", "subgroup", "required", "input_type", "unit", "options", "aliases", "definition", "example", "validation"]} | {"group_label": GROUP_LABEL[f["group"]], "badge": _badge(f), "path": _path(f)}

async def run_click_chat_three(req: ClickChatThreeRequest) -> dict[str, Any]:
    trace, message = ["__start__", "router_node"], (req.message or "").strip()
    if not message:
        return _response("general", "guard", "", False, _notice("빈 입력"), trace=trace + ["response_node", "__end__"])
    f, o, requested, score = _find(message, req.term)
    intent = await _intent(req, f)
    if intent == "field_list":
        has_company = any(k in message for k in ["기업", "기업정보"])
        has_equipment = any(k in message for k in ["설비", "설비현황", "장비"])
        group = "company" if has_company and not has_equipment else "equipment" if has_equipment and not has_company else None
        card = _list_card(group)  # type: ignore[arg-type]
        return _response("field_list", "field_dictionary", requested, True, card, 1.0, card["title"], trace + ["field_list_node", "response_node", "__end__"])
    if f:
        card = _card(f, o, message)
        return _response("company_field" if f["group"] == "company" else "equipment_field", "field_dictionary", requested, True, card, score, o["label"] if o else f["label"], trace + ["field_lookup_node", "response_node", "__end__"])
    return _response("general", "scope_guard", requested, False, _notice(requested), trace=trace + ["scope_guard_node", "response_node", "__end__"])

@router.get("/start")
def get_start_screen() -> dict[str, Any]:
    return {"screen_id": "click_chat_three_start", "screen_type": "chat_home", "header": {"brand": "FactoFit AI", "status": "온라인", "subtitle": "기업정보·설비현황 입력 도우미", "background_image": "/static/click-chat/hero-factory.png", "character": "ai_bot"}, "welcome_card": {"title": "안녕하세요! FactoFit AI입니다.", "description": "마이페이지의 기업정보와 설비현황에 무엇을 입력해야 하는지 대화형으로 알려드릴게요.", "helper_text": "예: 유지보수 비용에는 뭐가 들어가?, 연 매출액은 어떻게 입력해?, CNC는 뭐야?"}, "quick_groups": [{"key": "company", "label": "기업정보", "icon": "building", "target": "/api/click-chat-three/fields?group=company"}, {"key": "equipment", "label": "설비현황", "icon": "robot", "target": "/api/click-chat-three/fields?group=equipment"}], "suggested_terms": [{"label": x, "question": f"{x} 설명해줘"} for x in ["기업규모", "연 매출액", "설비 종류", "연간 에너지 비용", "불량률"]], "chat_messages": [{"role": "assistant", "type": "notice", "content": "안내: 한 번에 하나의 입력 항목만 질문할 수 있어요.", "time": "오후 6:31"}, {"role": "assistant", "type": "bubble", "content": "기업정보나 설비현황에 있는 단어를 입력해 주세요.", "time": "오후 6:31"}], "chat_input": {"placeholder": "궁금한 입력 항목을 입력해 주세요.", "attach_enabled": True, "emoji_enabled": True, "send_icon": "arrow-up"}, "data_source": {"company_field_count": len(COMPANY_FIELDS), "equipment_field_count": len(EQUIPMENT_FIELDS), "option_count": len(OPTIONS)}}

@router.get("/fields")
def get_fields(group: Group | None = None) -> dict[str, Any]:
    fields = [_serialize(f) for f in FIELDS if group is None or f["group"] == group]
    return {"count": len(fields), "group": group, "fields": fields}

@router.get("/fields/{term}")
def get_field_detail(term: str) -> dict[str, Any]:
    f, o, requested, score = _find(term, term)
    return {"matched": False, "requested_term": requested, "message": "해당 항목을 찾지 못했어요."} if not f else {"matched": True, "match_score": score, "requested_term": requested, "matched_term": o["label"] if o else f["label"], "field": _serialize(f), "card": _card(f, o)}

@router.post("/chat")
async def click_chat_three_chat(req: ClickChatThreeRequest) -> dict[str, Any]:
    return await run_click_chat_three(req)

@router.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "router": "click_chat_three", "purpose": "마이페이지 기업정보·설비현황 입력 항목 안내", "company_field_count": len(COMPANY_FIELDS), "equipment_field_count": len(EQUIPMENT_FIELDS), "option_count": len(OPTIONS), "matching_policy": "field_and_option_match_with_conversation_answer"}
