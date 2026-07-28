-- Migration: Support Dynamic Custom Fields for Global Projects List (Dashboard)

-- 1. Bảng lưu trữ dữ liệu tùy chỉnh của từng dự án
CREATE TABLE IF NOT EXISTS global_project_custom_data (
    final_project TEXT PRIMARY KEY,
    custom_properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies cho global_project_custom_data
ALTER TABLE global_project_custom_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read global_project_custom_data" 
ON global_project_custom_data FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert global_project_custom_data" 
ON global_project_custom_data FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update global_project_custom_data" 
ON global_project_custom_data FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete global_project_custom_data" 
ON global_project_custom_data FOR DELETE 
USING (true);
