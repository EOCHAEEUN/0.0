-- Migration: Create safety inspection rule and history tables
-- Date: 2026-06-11
-- Purpose: Store equipment-specific safety rules, evidence basis, and inspection history.

BEGIN;

CREATE TABLE IF NOT EXISTS safety_rule (
    rule_id TEXT PRIMARY KEY,
    equipment_category TEXT NOT NULL,
    equipment_name_keywords TEXT[] NOT NULL DEFAULT '{}',
    inspection_type TEXT NOT NULL,
    check_item TEXT NOT NULL,
    cycle_months INTEGER NOT NULL CHECK (cycle_months > 0),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    legal_basis TEXT,
    source_url TEXT,
    note TEXT,
    basis_type TEXT NOT NULL CHECK (
        basis_type IN ('law', 'official_guide', 'manual', 'self_check')
    ),
    legal_article TEXT,
    source_name TEXT,
    evidence_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_inspection (
    inspection_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    equipment_id TEXT NOT NULL,
    rule_id TEXT NOT NULL REFERENCES safety_rule(rule_id) ON DELETE CASCADE,
    last_checked_at DATE,
    next_due_at DATE,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('normal', 'scheduled', 'warning', 'overdue', 'done', 'skipped')
    ),
    assignee TEXT,
    evidence_file_url TEXT,
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_rule_category
    ON safety_rule(equipment_category);

CREATE INDEX IF NOT EXISTS idx_safety_rule_basis_type
    ON safety_rule(basis_type);

CREATE INDEX IF NOT EXISTS idx_safety_inspection_company
    ON safety_inspection(company_id);

CREATE INDEX IF NOT EXISTS idx_safety_inspection_equipment
    ON safety_inspection(equipment_id);

CREATE INDEX IF NOT EXISTS idx_safety_inspection_rule
    ON safety_inspection(rule_id);

CREATE INDEX IF NOT EXISTS idx_safety_inspection_next_due
    ON safety_inspection(next_due_at);

COMMENT ON TABLE safety_rule IS 'Equipment-specific safety inspection rules and evidence basis.';
COMMENT ON COLUMN safety_rule.basis_type IS 'law, official_guide, manual, or self_check. Only law means directly verified legal basis.';
COMMENT ON TABLE safety_inspection IS 'Actual inspection history by company equipment and matched safety rule.';
COMMENT ON COLUMN safety_inspection.next_due_at IS 'Calculated from last_checked_at + safety_rule.cycle_months by app or seed process.';

COMMIT;
