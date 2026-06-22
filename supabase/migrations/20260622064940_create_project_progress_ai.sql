CREATE TABLE IF NOT EXISTS project_progress_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email_sender TEXT,
  email_subject TEXT,
  email_content_raw TEXT,
  email_received_at TIMESTAMPTZ,
  detected_store_name TEXT,
  detected_store_code TEXT,
  detected_project_name TEXT,
  detected_status TEXT,
  detected_progress_note TEXT,
  ai_confidence_score FLOAT,
  processing_status TEXT DEFAULT 'pending',
  error_log TEXT
);

ALTER TABLE project_progress_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read" ON project_progress_ai FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON project_progress_ai FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON project_progress_ai FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON project_progress_ai FOR DELETE USING (true);
