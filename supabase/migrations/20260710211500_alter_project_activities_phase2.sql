-- Migration: Add decision columns directly to project_activities and manual upload columns to activity_attachments

-- 1. Alter project_activities to add decision fields
ALTER TABLE project_activities 
ADD COLUMN IF NOT EXISTS decision_status TEXT,
ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_by TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. Alter activity_attachments to add manual upload fields
ALTER TABLE activity_attachments 
ADD COLUMN IF NOT EXISTS is_manual_upload BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
