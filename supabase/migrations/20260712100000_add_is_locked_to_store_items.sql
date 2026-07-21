-- Migration: Thêm cột is_locked để khóa dòng store tránh ghi đè
ALTER TABLE project_store_items ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
