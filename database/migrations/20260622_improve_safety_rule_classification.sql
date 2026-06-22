-- Improve safety_rule classification quality.
--
-- Principles:
-- 1. legal_requirement describes whether performance is explicitly required by law.
-- 2. A legal provision about installing a guard does not by itself make an arbitrary
--    monthly inspection interval a statutory inspection.
-- 3. inspection_type is a reusable classification label. Equipment-specific details
--    belong in check_item.
-- 4. Door/interlock checks and physical cover/guard checks are separate rules because
--    their failure modes and evidence are different.

BEGIN;

ALTER TABLE public.safety_rule
    DROP CONSTRAINT IF EXISTS safety_rule_legal_requirement_check,
    ADD CONSTRAINT safety_rule_legal_requirement_check
        CHECK (legal_requirement IN ('법정점검', '자율점검')),
    DROP CONSTRAINT IF EXISTS safety_rule_legal_evidence_check,
    ADD CONSTRAINT safety_rule_legal_evidence_check
        CHECK (
            legal_requirement <> '법정점검'
            OR (
                NULLIF(BTRIM(legal_basis), '') IS NOT NULL
                AND NULLIF(BTRIM(source_name), '') IS NOT NULL
                AND NULLIF(BTRIM(evidence_text), '') IS NOT NULL
            )
        );

COMMENT ON COLUMN public.safety_rule.legal_requirement IS
    '법정점검: 법령에 검사·점검·교육 등의 이행 의무와 적용 범위가 명시된 항목. 자율점검: 법령상 안전조치 또는 제조사·공단 권고를 사업장 주기로 관리하는 항목.';

COMMENT ON COLUMN public.safety_rule.inspection_type IS
    '화면 필터와 집계에 사용하는 표준 점검 분류. 설비별 세부 확인 내용은 check_item에 기록한다.';

-- Keep only directly evidenced statutory inspection/training obligations as legal.
-- The other rules remain important safety controls, but their current monthly or
-- quarterly intervals are operational self-check intervals rather than statutory ones.
UPDATE public.safety_rule
SET legal_requirement = CASE
        WHEN rule_id IN (
            'safety-rule-press-005',
            'safety-rule-press-006',
            'safety-rule-cnc-006',
            'safety-rule-injection-005',
            'safety-rule-injection-006'
        ) THEN '법정점검'
        ELSE '자율점검'
    END,
    updated_at = NOW();

-- Normalize inspection_type into stable, reusable labels.
UPDATE public.safety_rule
SET inspection_type = CASE rule_id
        WHEN 'safety-rule-cnc-001' THEN '인터록·안전문 점검'
        WHEN 'safety-rule-cnc-002' THEN '공구·체결장치 점검'
        WHEN 'safety-rule-cnc-003' THEN '절삭유·칩 배출 점검'
        WHEN 'safety-rule-cnc-004' THEN '구동·이송장치 점검'
        WHEN 'safety-rule-cnc-005' THEN '비상정지·보호장치 점검'
        WHEN 'safety-rule-cnc-006' THEN '법정 안전보건교육'
        WHEN 'safety-rule-cnc-007' THEN '전기·제어계통 점검'
        WHEN 'safety-rule-cnc-008' THEN '공작물·체결장치 점검'
        WHEN 'safety-rule-cnc-009' THEN '구동·회전부 점검'
        WHEN 'safety-rule-cnc-010' THEN '소모품·예방보전 점검'
        WHEN 'safety-rule-cnc-011' THEN '필터·냉각계통 점검'

        WHEN 'safety-rule-injection-001' THEN '인터록·안전문 점검'
        WHEN 'safety-rule-injection-002' THEN '가열·온도제어 점검'
        WHEN 'safety-rule-injection-003' THEN '금형·체결장치 점검'
        WHEN 'safety-rule-injection-004' THEN '유압계통 점검'
        WHEN 'safety-rule-injection-005' THEN '법정 안전검사'
        WHEN 'safety-rule-injection-006' THEN '법정 안전보건교육'
        WHEN 'safety-rule-injection-007' THEN '구동·마모부 점검'
        WHEN 'safety-rule-injection-008' THEN '압력·역류방지 점검'
        WHEN 'safety-rule-injection-009' THEN '형체·구동장치 점검'
        WHEN 'safety-rule-injection-010' THEN '원료공급·부대장치 점검'

        WHEN 'safety-rule-press-001' THEN '방호장치 점검'
        WHEN 'safety-rule-press-002' THEN '유압계통 점검'
        WHEN 'safety-rule-press-003' THEN '비상정지장치 점검'
        WHEN 'safety-rule-press-004' THEN '금형·체결장치 점검'
        WHEN 'safety-rule-press-005' THEN '법정 안전보건교육'
        WHEN 'safety-rule-press-006' THEN '법정 안전검사'
        WHEN 'safety-rule-press-007' THEN '윤활·마모부 점검'
        WHEN 'safety-rule-press-008' THEN '전기·제어계통 점검'
        WHEN 'safety-rule-press-009' THEN '클러치·브레이크 점검'
        WHEN 'safety-rule-press-010' THEN '구동·조정장치 점검'
        WHEN 'safety-rule-press-011' THEN '과부하 방지장치 점검'
        WHEN 'safety-rule-press-012' THEN '자동화·이송장치 점검'
        ELSE inspection_type
    END,
    updated_at = NOW();

-- The existing CNC rule now focuses on the functional door/interlock test.
UPDATE public.safety_rule
SET check_item = '운전 중 도어 개방 시 주축·이송 정지 여부, 도어 닫힘 전 재기동 방지, 인터록 우회·무효화 여부, 비상정지 연동 상태 확인',
    evidence_text = '가공구역 접근 차단과 인터록 기능을 사업장 정기 자율점검으로 확인',
    updated_at = NOW()
WHERE rule_id = 'safety-rule-cnc-001';

-- Remove wording that incorrectly presents the company-defined interval itself as
-- a statutory interval. The legal duty and the operational inspection cycle are
-- deliberately stated separately.
UPDATE public.safety_rule
SET evidence_text = CASE rule_id
        WHEN 'safety-rule-injection-001'
            THEN '사출성형기 위험구역의 안전문과 인터록 방호기능을 사업장 월간 자율점검으로 확인'
        WHEN 'safety-rule-press-001'
            THEN '프레스 방호조치의 유효성을 사업장 월간 자율점검으로 확인'
        WHEN 'safety-rule-press-003'
            THEN '비상정지장치의 기능 유지를 위해 사업장 월간 자율점검으로 작동 상태 확인'
        WHEN 'safety-rule-press-008'
            THEN '전기 위험방지 조치의 유효성을 사업장 반기 자율점검으로 확인'
        ELSE evidence_text
    END,
    note = CASE
        WHEN rule_id IN (
            'safety-rule-injection-001',
            'safety-rule-press-001',
            'safety-rule-press-003',
            'safety-rule-press-008'
        )
        THEN '법령은 안전조치 의무의 근거이며, 현재 점검주기는 사업장 관리기준이다.'
        ELSE note
    END,
    updated_at = NOW()
WHERE rule_id IN (
    'safety-rule-injection-001',
    'safety-rule-press-001',
    'safety-rule-press-003',
    'safety-rule-press-008'
);

-- Separate physical covers/guards from functional interlocks.
INSERT INTO public.safety_rule (
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
    source_name,
    evidence_text,
    legal_requirement,
    inspection_purpose
) VALUES
(
    'safety-rule-cnc-012',
    'cnc',
    ARRAY['CNC', '머시닝센터', '선반', '안전덮개', '칩커버'],
    '덮개·커버 점검',
    '주축·공구교환장치·회전부 덮개 고정 상태, 칩 커버와 안전창의 파손·균열, 체결볼트 이완, 절삭칩 비산 틈새 여부 확인',
    1,
    'high',
    '산업안전보건기준에 관한 규칙의 원동기·회전축 등 위험방지 및 기계 방호조치 관련 규정',
    'https://www.law.go.kr/법령/산업안전보건기준에관한규칙',
    '법령은 방호조치 의무의 근거이며, 월 1회 주기는 사업장 자율 관리기준이다.',
    '국가법령정보센터',
    '회전부 접촉과 절삭칩·공구 파편 비산을 막는 물리적 덮개 상태를 별도로 확인',
    '자율점검',
    '안전장치점검'
),
(
    'safety-rule-injection-011',
    'injection',
    ARRAY['사출성형기', '사출기', 'injection', '노즐가드', '히터커버'],
    '덮개·커버 점검',
    '노즐 퍼지 가드, 히터밴드 커버, 구동부·회전부 덮개의 고정·파손·탈락 여부와 고온부 노출, 용융수지 비산 가능 틈새 확인',
    1,
    'high',
    '산업안전보건기준에 관한 규칙의 사출성형기 및 기계 위험방지 관련 규정',
    'https://www.law.go.kr/법령/산업안전보건기준에관한규칙',
    '법령상 방호조치를 현장 점검표로 구체화한 자율점검 항목이다.',
    '국가법령정보센터',
    '고온부 접촉, 구동부 협착, 용융수지 비산 위험을 막는 물리적 방호 상태 확인',
    '자율점검',
    '안전장치점검'
),
(
    'safety-rule-press-013',
    'press',
    ARRAY['프레스', '유압프레스', 'press', '동력전달부', '안전덮개'],
    '덮개·커버 점검',
    '플라이휠·벨트·기어·클러치 등 동력전달부 덮개의 고정·파손·탈락 여부, 개구부와 체결볼트 이완, 회전부 노출 여부 확인',
    1,
    'critical',
    '산업안전보건기준에 관한 규칙의 원동기·회전축 등 위험방지 및 프레스 방호조치 관련 규정',
    'https://www.law.go.kr/법령/산업안전보건기준에관한규칙',
    '법령상 방호조치를 현장 점검표로 구체화한 자율점검 항목이다.',
    '국가법령정보센터',
    '동력전달부 접촉·말림 위험을 막는 물리적 덮개 상태를 방호장치 기능점검과 분리해 확인',
    '자율점검',
    '안전장치점검'
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
    source_name = EXCLUDED.source_name,
    evidence_text = EXCLUDED.evidence_text,
    legal_requirement = EXCLUDED.legal_requirement,
    inspection_purpose = EXCLUDED.inspection_purpose,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_safety_rule_legal_requirement
    ON public.safety_rule(legal_requirement);

CREATE INDEX IF NOT EXISTS idx_safety_rule_inspection_type
    ON public.safety_rule(inspection_type);

COMMIT;
