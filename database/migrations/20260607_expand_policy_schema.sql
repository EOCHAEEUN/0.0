-- Migration: Expand policy table schema to match backend requirements
-- Date: 2026-06-07
-- Description: Add new columns to policy table for enhanced data tracking

BEGIN;

-- 1. 분류 관련 컬럼 추가 (기업마당 원본 분류와 우리 서비스 분류 분리)
ALTER TABLE policy ADD COLUMN IF NOT EXISTS policy_category VARCHAR(255) COMMENT '기업마당 원본 대분류';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS policy_subcategory VARCHAR(255) COMMENT '기업마당 원본 중분류';

ALTER TABLE policy ADD COLUMN IF NOT EXISTS service_category VARCHAR(255) COMMENT '우리 서비스 분류 (스마트공장, 설비/자동화 등)';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS service_subcategory VARCHAR(255) COMMENT '우리 서비스 세부분류';

-- 2. 금액 관련 컬럼 추가 (추출 과정 투명화)
ALTER TABLE policy ADD COLUMN IF NOT EXISTS max_amount_note TEXT COMMENT '금액이 불명확한 경우 설명';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS max_amount_source VARCHAR(100) COMMENT '추출 출처 (summary/detail_page/attachment_pdf/attachment_hwp 등)';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS max_amount_evidence TEXT COMMENT '추출 근거 (해당 텍스트 발췌)';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS amount_extraction_status VARCHAR(50) COMMENT '추출 상태 (extracted/not_found/attachment_error/attachment_pdf_failed 등)';

-- 3. 데이터 소스 관련 컬럼 추가 (수집처 추적 및 검증용)
ALTER TABLE policy ADD COLUMN IF NOT EXISTS source_name VARCHAR(100) COMMENT '수집처 (bizinfo/kiat/energy_corp 등)';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS source_id VARCHAR(255) COMMENT '원본 공고ID';

-- 4. 원본 데이터 보존 컬럼 추가 (RAG 검색 및 재검증용)
ALTER TABLE policy ADD COLUMN IF NOT EXISTS raw_text LONGTEXT COMMENT 'RAG/검증용 원본 텍스트 (정제된 형식)';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS raw_json JSON COMMENT 'RAG/검증용 원본 JSON';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS hashtags JSON COMMENT '태그 리스트 (배열)';

-- 5. 점수 및 선택 정보 컬럼 추가 (사용자 피드백 추적)
ALTER TABLE policy ADD COLUMN IF NOT EXISTS relevance_score INT COMMENT '제조업 관련성 점수 (점수 낮을수록 필터링됨)';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT FALSE COMMENT '사용자 또는 시스템에서 선택된 공고';
ALTER TABLE policy ADD COLUMN IF NOT EXISTS selected_reason TEXT COMMENT '선택 이유 (자동/수동 필터링 사유 등)';

-- 6. 기존 category/sub_category는 유지 (역호환성) - 필요시 뷰(VIEW)로 만들 수 있음
-- ALTER TABLE policy RENAME COLUMN category TO policy_category;
-- ALTER TABLE policy RENAME COLUMN sub_category TO policy_subcategory;

-- 7. 인덱스 추가 (검색 성능 개선)
CREATE INDEX IF NOT EXISTS idx_policy_category ON policy(policy_category);
CREATE INDEX IF NOT EXISTS idx_service_category ON policy(service_category);
CREATE INDEX IF NOT EXISTS idx_amount_status ON policy(amount_extraction_status);
CREATE INDEX IF NOT EXISTS idx_is_selected ON policy(is_selected);
CREATE INDEX IF NOT EXISTS idx_relevance_score ON policy(relevance_score);

COMMIT;
