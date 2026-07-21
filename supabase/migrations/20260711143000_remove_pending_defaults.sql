-- 1. Remove DEFAULT 'Pending' from the phase status columns
ALTER TABLE project_store_items
    ALTER COLUMN survey_status DROP DEFAULT,
    ALTER COLUMN installation_status DROP DEFAULT,
    ALTER COLUMN acceptance_status DROP DEFAULT;

-- 2. Optional: If you want to reset currently 'Pending' stores back to NULL so they show up on the left side (Chưa nhập) in the Lắp Đặt / NTXX tabs:
UPDATE project_store_items 
SET survey_status = NULL 
WHERE survey_status = 'Pending';

UPDATE project_store_items 
SET installation_status = NULL 
WHERE installation_status = 'Pending';

UPDATE project_store_items 
SET acceptance_status = NULL 
WHERE acceptance_status = 'Pending';
