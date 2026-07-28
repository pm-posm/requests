-- 1. posm_projects (được giữ lại để thỏa mãn khóa ngoại cũ, mặc dù sau này bị gỡ)
CREATE TABLE IF NOT EXISTS posm_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT
);

-- 2. project_activities
CREATE TABLE IF NOT EXISTS project_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_type TEXT,
    title_mail TEXT,
    key TEXT,
    phase_id TEXT,
    key_project TEXT,
    project_name TEXT,
    final_project TEXT,
    nguoi_gui TEXT,
    thread_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    drive_folder_id TEXT,
    drive_url TEXT,
    status TEXT
);

-- 3. activity_attachments
CREATE TABLE IF NOT EXISTS activity_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES project_activities(id) ON DELETE CASCADE,
    file_name TEXT,
    drive_file_id TEXT,
    drive_url TEXT,
    md5 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
