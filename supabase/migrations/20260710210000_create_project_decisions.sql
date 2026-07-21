-- Migration: Create project_decisions table and add manual upload fields to activity_attachments

-- 1. Create project_decisions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phase_type_enum') THEN
        CREATE TYPE phase_type_enum AS ENUM ('BRIEF', 'SURVEY', 'INSTALLATION', 'ACCEPTANCE', 'NTXX');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS project_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES posm_projects(id) ON DELETE CASCADE,
    phase_type phase_type_enum NOT NULL, -- BRIEF, SURVEY, INSTALLATION, ACCEPTANCE
    decision_status TEXT, 
    checklist_data JSONB DEFAULT '{}'::jsonb, 
    notes TEXT,                         
    updated_by TEXT,                    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, phase_type)
);

CREATE INDEX IF NOT EXISTS idx_project_decisions_project_id ON project_decisions(project_id);

-- 2. Add columns to activity_attachments if they don't exist
ALTER TABLE activity_attachments 
ADD COLUMN IF NOT EXISTS is_manual_upload BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

-- 3. Enable RLS and add policies for project_decisions
ALTER TABLE project_decisions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow all read" ON project_decisions;
    DROP POLICY IF EXISTS "Allow all insert" ON project_decisions;
    DROP POLICY IF EXISTS "Allow all update" ON project_decisions;
    DROP POLICY IF EXISTS "Allow all delete" ON project_decisions;
END $$;

CREATE POLICY "Allow all read" ON project_decisions FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON project_decisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON project_decisions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON project_decisions FOR DELETE USING (true);
