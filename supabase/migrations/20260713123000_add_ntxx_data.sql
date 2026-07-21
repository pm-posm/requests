ALTER TABLE project_store_items ADD COLUMN IF NOT EXISTS ntxx_data JSONB DEFAULT '{}'::jsonb;
