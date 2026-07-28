-- Migration: Support Dynamic Custom Fields for Phase 3

-- 1. Thêm cột custom_properties vào project_store_items (và project_store_phases để hỗ trợ cả 2 nếu cần)
ALTER TABLE project_store_items
ADD COLUMN IF NOT EXISTS custom_properties JSONB DEFAULT '{}'::jsonb;

-- 2. Tạo bảng project_custom_fields để quản lý các trường tùy chỉnh
CREATE TABLE IF NOT EXISTS project_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT, -- Mã dự án hoặc phase_type
    field_name TEXT NOT NULL, -- Tên hiển thị (vd: "Số điện thoại")
    field_key TEXT NOT NULL, -- Khóa lưu trong JSONB (vd: "so_dien_thoai")
    field_type TEXT NOT NULL, -- text, number, date, boolean, dropdown
    options JSONB, -- Mảng lựa chọn nếu là dropdown
    is_required BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, field_key) -- Một project không thể có 2 trường trùng key
);

-- RLS Policies cho project_custom_fields
ALTER TABLE project_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read custom fields" 
ON project_custom_fields FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert custom fields" 
ON project_custom_fields FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update custom fields" 
ON project_custom_fields FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete custom fields" 
ON project_custom_fields FOR DELETE 
USING (true);
