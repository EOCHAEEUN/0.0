"""안전점검 도메인에서 공통으로 사용하는 분류 타입."""

from typing import Literal


RiskLevel = Literal["medium", "high", "critical"]
# 점검 항목 자체의 중요도/위험도.

LegalRequirement = Literal["법정점검", "자율점검"]
# 법정점검: 법조항이 명시된 검사·점검·교육 및 안전조치 항목.
# 자율점검: 회사가 자체적으로 운영 여부를 정하는 점검 프로그램.

InspectionPurpose = Literal["안전장치점검", "유지보수점검", "안전교육"]
# 점검 목적/대상 분류. 분류별 현황 집계에 사용.

InspectionCompletionStatus = Literal["pending", "overdue"]
# 회사별 점검 상태. next_due_at을 기준으로 계산한다.

SafetyRuleType = Literal["legal", "voluntary"]
# safety_check_status.rule_type에서 참조할 규칙 테이블을 구분한다.
