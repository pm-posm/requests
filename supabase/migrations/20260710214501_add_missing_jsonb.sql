ALTER TABLE project_store_items 
ADD COLUMN IF NOT EXISTS survey_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS installation_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS acceptance_data JSONB DEFAULT '{}'::jsonb;
