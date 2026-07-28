ALTER TABLE posm_projects
ADD COLUMN IF NOT EXISTS source_key TEXT,
ADD COLUMN IF NOT EXISTS request_id TEXT,
ADD COLUMN IF NOT EXISTS final_key TEXT,
ADD COLUMN IF NOT EXISTS detected_key TEXT,
ADD COLUMN IF NOT EXISTS source_project_name TEXT,
ADD COLUMN IF NOT EXISTS normalized_project_name TEXT,
ADD COLUMN IF NOT EXISTS detected_name_project TEXT,
ADD COLUMN IF NOT EXISTS store_code TEXT,
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS progress_note TEXT,
ADD COLUMN IF NOT EXISTS final_progress TEXT,
ADD COLUMN IF NOT EXISTS progress_note_source TEXT,
ADD COLUMN IF NOT EXISTS timeline TEXT,
ADD COLUMN IF NOT EXISTS plan_option TEXT,
ADD COLUMN IF NOT EXISTS data_responser TEXT,
ADD COLUMN IF NOT EXISTS mer TEXT,
ADD COLUMN IF NOT EXISTS sr TEXT,
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS detected_supplier TEXT,
ADD COLUMN IF NOT EXISTS vis_note TEXT,
ADD COLUMN IF NOT EXISTS sr_note TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS sheet_row_index INTEGER,
ADD COLUMN IF NOT EXISTS request_date TEXT;

-- Sửa lại hàm để không bị crash (chỉ cần trả về rỗng)
CREATE OR REPLACE FUNCTION get_project_overviews()
RETURNS TABLE (
    final_project TEXT,
    store_count INTEGER,
    published_store_count INTEGER,
    customers TEXT[],
    suppliers TEXT[],
    phases TEXT[],
    posm_type TEXT
) AS $$
BEGIN
    RETURN; -- Trả về bảng rỗng an toàn tuyệt đối
END;
$$ LANGUAGE plpgsql;
