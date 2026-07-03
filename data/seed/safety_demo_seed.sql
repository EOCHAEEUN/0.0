-- Demo seed for safety inspection dashboard.
-- Apply after database/migrations/20260611_create_safety_tables.sql.
-- The demo assumes three registered equipments exist with these IDs:
--   11111111-1111-4111-8111-111111111111 (press)
--   22222222-2222-4222-8222-222222222222 (cnc)
--   33333333-3333-4333-8333-333333333333 (injection)
-- Current demo company_id: 2758ab0f-4951-4afe-b819-f7252588f00d
-- If your equipment table uses different IDs, update safety_inspection.equipment_id.

BEGIN;

INSERT INTO safety_rule (
    rule_id,
    equipment_category,
    equipment_name_keywords,
    inspection_type,
    check_item,
    cycle_months,
    risk_level,
    legal_basis,
    source_url,
    note,
    basis_type,
    legal_article,
    source_name,
    evidence_text
) VALUES
(
    'safety-rule-press-guard-001',
    'press',
    ARRAY['유압프레스', '프레스', 'press'],
    '방호장치 점검',
    '양수조작식 방호장치, 광전자식 방호장치, 비상정지장치 작동 상태 확인',
    1,
    'critical',
    '산업안전보건기준에 관한 규칙의 프레스 및 전단기 방호조치 취지',
    'https://www.law.go.kr/',
    '직접 조항 번호는 운영 환경에서 재확인 필요. 법령 근거가 확인된 범위 안에서만 법령근거로 표시한다.',
    'law',
    '산업안전보건기준에 관한 규칙: 프레스 등 방호조치 관련 조항',
    '국가법령정보센터',
    '프레스 작업 시 위험점에 근로자의 신체가 들어가지 않도록 방호장치를 설치하고 정상 작동 여부를 확인해야 한다는 취지의 기준'
),
(
    'safety-rule-press-hydraulic-002',
    'press',
    ARRAY['유압프레스', '압력계', '유압'],
    '유압계통 점검',
    '유압 누유, 압력계, 배관, 실린더 이상 여부 확인',
    3,
    'high',
    'KOSHA 프레스 작업 안전 관련 기술자료',
    'https://www.kosha.or.kr/',
    '공식자료 참고 항목이며 법정점검으로 단정하지 않는다.',
    'official_guide',
    NULL,
    '한국산업안전보건공단',
    '프레스 설비의 유압계통 이상은 끼임 및 낙하 위험으로 이어질 수 있어 정기 확인이 필요하다.'
),
(
    'safety-rule-press-worker-003',
    'press',
    ARRAY['작업자', '프레스'],
    '작업자 안전교육',
    '프레스 작업 전 안전수칙, 금형 교체 절차, 비상정지 대응 교육 이수 확인',
    6,
    'high',
    '산업안전보건법의 안전보건교육 의무 취지',
    'https://www.law.go.kr/',
    '안전보건교육 의무에 근거하되, 설비별 세부 항목은 내부 점검표와 함께 운영한다.',
    'law',
    '산업안전보건법: 안전보건교육 관련 조항',
    '국가법령정보센터',
    '사업주는 근로자에게 작업 안전에 필요한 교육을 실시해야 한다는 취지의 법령 기준'
),
(
    'safety-rule-cnc-interlock-001',
    'cnc',
    ARRAY['CNC', '머시닝센터', 'machining center'],
    '도어 인터록 점검',
    '가공 중 도어 인터록, 칩 커버, 비상정지 버튼 작동 상태 확인',
    1,
    'high',
    'KOSHA 기계설비 안전 일반 지침 참고',
    'https://www.kosha.or.kr/',
    '직접 법령 조항 미확인. 공식자료 참고 항목으로 표시한다.',
    'official_guide',
    NULL,
    '한국산업안전보건공단',
    '회전체와 절삭칩 비산 위험이 있는 설비는 덮개, 인터록, 비상정지장치 상태를 확인하는 것이 권장된다.'
),
(
    'safety-rule-cnc-spindle-002',
    'cnc',
    ARRAY['CNC', '스핀들', '툴'],
    '가공부 상태 점검',
    '스핀들 진동, 공구 체결, 절삭유 누유, 칩 배출 상태 확인',
    3,
    'medium',
    NULL,
    NULL,
    '제조사 매뉴얼 또는 내부 보전 기준으로 운영한다.',
    'self_check',
    NULL,
    'FactoFit demo self-check',
    '고속 회전부와 공구 체결 상태는 품질 및 작업자 안전에 직접 영향을 주므로 자율점검 항목으로 관리한다.'
),
(
    'safety-rule-injection-door-001',
    'injection',
    ARRAY['사출성형기', 'injection', '도어'],
    '안전문 및 인터록 점검',
    '안전문 인터록, 금형 구역 접근 차단, 비상정지 버튼 작동 상태 확인',
    1,
    'high',
    'KOSHA 기계설비 끼임 위험 예방 자료 참고',
    'https://www.kosha.or.kr/',
    '직접 법령 조항 미확인. 공식자료 참고 항목으로 표시한다.',
    'official_guide',
    NULL,
    '한국산업안전보건공단',
    '금형 개폐부 접근 시 끼임 위험이 있어 안전문과 인터록 상태 확인이 필요하다.'
),
(
    'safety-rule-injection-heater-002',
    'injection',
    ARRAY['사출성형기', '히터', '온도'],
    '히터 및 온도제어 점검',
    '히터 과열, 온도센서, 전장부 절연, 냉각수 누수 상태 확인',
    3,
    'medium',
    NULL,
    NULL,
    '제조사 매뉴얼 또는 내부 보전 기준으로 운영한다.',
    'self_check',
    NULL,
    'FactoFit demo self-check',
    '가열부 과열과 누수는 화상, 전기, 품질 리스크를 만들 수 있어 주기적 확인이 필요하다.'
)
ON CONFLICT (rule_id) DO UPDATE SET
    equipment_category = EXCLUDED.equipment_category,
    equipment_name_keywords = EXCLUDED.equipment_name_keywords,
    inspection_type = EXCLUDED.inspection_type,
    check_item = EXCLUDED.check_item,
    cycle_months = EXCLUDED.cycle_months,
    risk_level = EXCLUDED.risk_level,
    legal_basis = EXCLUDED.legal_basis,
    source_url = EXCLUDED.source_url,
    note = EXCLUDED.note,
    basis_type = EXCLUDED.basis_type,
    legal_article = EXCLUDED.legal_article,
    source_name = EXCLUDED.source_name,
    evidence_text = EXCLUDED.evidence_text,
    updated_at = NOW();

INSERT INTO safety_inspection (
    inspection_id,
    company_id,
    equipment_id,
    rule_id,
    last_checked_at,
    next_due_at,
    status,
    assignee,
    evidence_file_url,
    memo
) VALUES
(
    'safety-inspection-press-guard-001',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '11111111-1111-4111-8111-111111111111',
    'safety-rule-press-guard-001',
    DATE '2026-05-15',
    DATE '2026-06-15',
    'warning',
    '생산1팀 김대리',
    NULL,
    '광전자식 방호장치 반응 속도 재확인 필요'
),
(
    'safety-inspection-press-hydraulic-002',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '11111111-1111-4111-8111-111111111111',
    'safety-rule-press-hydraulic-002',
    DATE '2026-03-01',
    DATE '2026-06-01',
    'overdue',
    '보전팀 박과장',
    NULL,
    '실린더 하부 미세 누유 의심'
),
(
    'safety-inspection-press-worker-003',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '11111111-1111-4111-8111-111111111111',
    'safety-rule-press-worker-003',
    DATE '2026-02-20',
    DATE '2026-08-20',
    'normal',
    '안전관리자',
    NULL,
    '신규 작업자 2명 보충교육 예정'
),
(
    'safety-inspection-cnc-interlock-001',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '22222222-2222-4222-8222-222222222222',
    'safety-rule-cnc-interlock-001',
    DATE '2026-06-02',
    DATE '2026-07-02',
    'normal',
    '가공팀 이대리',
    NULL,
    '이상 없음'
),
(
    'safety-inspection-cnc-spindle-002',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '22222222-2222-4222-8222-222222222222',
    'safety-rule-cnc-spindle-002',
    DATE '2026-04-05',
    DATE '2026-07-05',
    'normal',
    '보전팀 박과장',
    NULL,
    '스핀들 진동 추세 관찰'
),
(
    'safety-inspection-injection-door-001',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '33333333-3333-4333-8333-333333333333',
    'safety-rule-injection-door-001',
    DATE '2026-04-20',
    DATE '2026-05-20',
    'overdue',
    '성형팀 최주임',
    NULL,
    '안전문 닫힘 센서 점검 필요'
),
(
    'safety-inspection-injection-heater-002',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '33333333-3333-4333-8333-333333333333',
    'safety-rule-injection-heater-002',
    DATE '2026-05-25',
    DATE '2026-08-25',
    'normal',
    '성형팀 최주임',
    NULL,
    '전장부 열화상 점검 예정'
)
ON CONFLICT (inspection_id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    equipment_id = EXCLUDED.equipment_id,
    rule_id = EXCLUDED.rule_id,
    last_checked_at = EXCLUDED.last_checked_at,
    next_due_at = EXCLUDED.next_due_at,
    status = EXCLUDED.status,
    assignee = EXCLUDED.assignee,
    evidence_file_url = EXCLUDED.evidence_file_url,
    memo = EXCLUDED.memo,
    updated_at = NOW();

COMMIT;
