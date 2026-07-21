-- ============================================================
-- Phase 2 Refactor Migration
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- ============================================================

-- BƯỚC 1: Thêm các cột còn thiếu vào project_store_items
ALTER TABLE project_store_items
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS customer TEXT,
  ADD COLUMN IF NOT EXISTS ka TEXT,
  ADD COLUMN IF NOT EXISTS sr TEXT,
  ADD COLUMN IF NOT EXISTS current_phase TEXT,
  ADD COLUMN IF NOT EXISTS custom_files JSONB DEFAULT '[]'::jsonb;

-- BƯỚC 2: Tạo bảng project_store_phases (chuẩn hóa tiến độ)
CREATE TABLE IF NOT EXISTS project_store_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_item_id UUID NOT NULL REFERENCES project_store_items(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('Brief', 'Khảo sát', 'NTXX', 'Lắp đặt')),
  expected_start DATE,
  expected_end DATE,
  actual_date DATE,
  result TEXT CHECK (result IN ('pass', 'fail') OR result IS NULL),
  proof_links JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  vis_tech TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_item_id, phase)
);

-- BƯỚC 3: RLS cho bảng mới
ALTER TABLE project_store_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all_phases" ON project_store_phases;
CREATE POLICY "public_all_phases" ON project_store_phases FOR ALL USING (true) WITH CHECK (true);

-- BƯỚC 4: Di chuyển dữ liệu cũ từ JSONB blobs sang bảng project_store_phases
-- (Chỉ migrate những dòng có dữ liệu, bỏ qua nếu đã có rồi)
INSERT INTO project_store_phases (store_item_id, phase, expected_start, expected_end, actual_date, result, notes, vis_tech)
SELECT 
  id AS store_item_id,
  COALESCE(
    CASE WHEN survey_data->>'current_phase' IS NOT NULL THEN survey_data->>'current_phase' ELSE 'Khảo sát' END,
    'Khảo sát'
  ) AS phase,
  (survey_data->>'expected_start')::DATE,
  (survey_data->>'expected_end')::DATE,
  (survey_data->>'actual_date')::DATE,
  survey_data->>'result',
  survey_data->>'notes',
  vis_tech
FROM project_store_items
WHERE survey_data IS NOT NULL 
  AND survey_data::text != 'null'
  AND survey_data::text != '{}'
ON CONFLICT (store_item_id, phase) DO NOTHING;

-- BƯỚC 5: Cập nhật current_phase từ survey_data nếu chưa có
UPDATE project_store_items
SET current_phase = survey_data->>'current_phase'
WHERE current_phase IS NULL 
  AND survey_data IS NOT NULL
  AND survey_data->>'current_phase' IS NOT NULL;

-- BƯỚC 6: Thêm trigger cập nhật updated_at cho project_store_phases
CREATE OR REPLACE FUNCTION update_store_phases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_phases_updated_at ON project_store_phases;
CREATE TRIGGER trg_store_phases_updated_at
  BEFORE UPDATE ON project_store_phases
  FOR EACH ROW EXECUTE FUNCTION update_store_phases_updated_at();

-- HOÀN TẤT: Kiểm tra kết quả
SELECT 
  'project_store_items' AS table_name, COUNT(*) AS rows FROM project_store_items
UNION ALL
SELECT 'project_store_phases', COUNT(*) FROM project_store_phases;
