-- Migration: Alter project_decisions to decouple from posm_projects

-- 1. Drop foreign key constraint on project_id referencing posm_projects
ALTER TABLE project_decisions DROP CONSTRAINT IF EXISTS project_decisions_project_id_fkey;

-- 2. Drop the unique constraint on (project_id, phase_type)
ALTER TABLE project_decisions DROP CONSTRAINT IF EXISTS project_decisions_project_id_phase_type_key;

-- 3. Remove project_id column and add final_project column
ALTER TABLE project_decisions DROP COLUMN IF EXISTS project_id;
ALTER TABLE project_decisions ADD COLUMN IF NOT EXISTS final_project TEXT NOT NULL;

-- 4. Add new unique constraint on (final_project, phase_type)
ALTER TABLE project_decisions ADD CONSTRAINT project_decisions_final_project_phase_type_key UNIQUE (final_project, phase_type);
