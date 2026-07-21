-- Migration: Remove default 'Pending' value from status columns and set to NULL
-- 1. Drop the old defaults
ALTER TABLE project_store_items ALTER COLUMN survey_status SET DEFAULT NULL;
ALTER TABLE project_store_items ALTER COLUMN installation_status SET DEFAULT NULL;
ALTER TABLE project_store_items ALTER COLUMN acceptance_status SET DEFAULT NULL;

-- 2. Cleanup existing 'Pending' values to NULL (to show as Trống/Chưa lên lịch)
UPDATE project_store_items SET survey_status = NULL WHERE survey_status = 'Pending';
UPDATE project_store_items SET installation_status = NULL WHERE installation_status = 'Pending';
UPDATE project_store_items SET acceptance_status = NULL WHERE acceptance_status = 'Pending';
