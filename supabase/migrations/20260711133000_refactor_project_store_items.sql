-- Migration: Refactor project_store_items to store-centric architecture

-- 1. Truncate existing data to avoid conflicts when changing schema constraints
TRUNCATE TABLE project_store_items;

-- 2. Drop the old constraint
ALTER TABLE project_store_items
DROP CONSTRAINT IF EXISTS project_store_items_unique_item;

-- 3. Drop old columns
ALTER TABLE project_store_items
DROP COLUMN IF EXISTS phase_type,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS notes;

-- 4. Add new columns for 3 phases
ALTER TABLE project_store_items
ADD COLUMN IF NOT EXISTS survey_status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS survey_notes TEXT,
ADD COLUMN IF NOT EXISTS installation_status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS installation_notes TEXT,
ADD COLUMN IF NOT EXISTS acceptance_status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS acceptance_notes TEXT;

-- 5. Add the new constraint: A store can only exist once per final project
ALTER TABLE project_store_items
ADD CONSTRAINT project_store_items_unique_store UNIQUE (final_project, store_code);
