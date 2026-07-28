-- ====================================================================
-- MIGRATION SCRIPT: PHASE 3 TECHNICAL DEBT & BACKEND OPTIMIZATION
-- Executable in Supabase SQL Editor
-- ====================================================================

-- 1. Create Subtask Audit Logs Table
CREATE TABLE IF NOT EXISTS public.subtask_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subtask_id TEXT NOT NULL,
    action_text TEXT NOT NULL,
    created_by TEXT DEFAULT 'System',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policy for subtask_audit_logs
ALTER TABLE public.subtask_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read audit logs" ON public.subtask_audit_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert audit logs" ON public.subtask_audit_logs
    FOR INSERT WITH CHECK (true);

-- 2. PostgreSQL Composite B-Tree Indexes for Performance at Scale
CREATE INDEX IF NOT EXISTS idx_project_store_items_store_pub 
    ON public.project_store_items(store_code, is_published);

CREATE INDEX IF NOT EXISTS idx_project_store_items_final_prj 
    ON public.project_store_items(final_project);

CREATE INDEX IF NOT EXISTS idx_raw_requests_store 
    ON public.raw_requests(ess_store_code, is_deleted_in_sheet);

CREATE INDEX IF NOT EXISTS idx_raw_requests_req_id 
    ON public.raw_requests(request_id);

CREATE INDEX IF NOT EXISTS idx_project_activities_final_prj 
    ON public.project_activities(final_project);

-- 3. Automatic Data Normalization Trigger for Raw Requests
CREATE OR REPLACE FUNCTION public.normalize_raw_requests_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Standardize phuong_an
    IF NEW.phuong_an IS NOT NULL THEN
        IF LOWER(TRIM(NEW.phuong_an)) LIKE '%bảo hành%' THEN
            NEW.phuong_an := 'Supplier Bảo Hành';
        ELSIF LOWER(TRIM(NEW.phuong_an)) LIKE '%visibility%' THEN
            NEW.phuong_an := 'Visibility Request';
        ELSIF LOWER(TRIM(NEW.phuong_an)) LIKE '%quick fix%' THEN
            NEW.phuong_an := 'Mer Quick Fix';
        ELSIF LOWER(TRIM(NEW.phuong_an)) LIKE '%by store%' THEN
            NEW.phuong_an := 'Đưa vào RQ by Store';
        ELSIF LOWER(TRIM(NEW.phuong_an)) LIKE '%rq tuần%' THEN
            NEW.phuong_an := 'Đã đưa vào RQ tuần';
        ELSE
            NEW.phuong_an := TRIM(NEW.phuong_an);
        END IF;
    END IF;

    -- Trim strings
    IF NEW.status IS NOT NULL THEN NEW.status := TRIM(NEW.status); END IF;
    IF NEW.tien_do IS NOT NULL THEN NEW.tien_do := TRIM(NEW.tien_do); END IF;
    IF NEW.request_id IS NOT NULL THEN NEW.request_id := TRIM(NEW.request_id); END IF;
    IF NEW.ma_du_an IS NOT NULL THEN NEW.ma_du_an := TRIM(NEW.ma_du_an); END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach Trigger to raw_requests
DROP TRIGGER IF EXISTS trg_normalize_raw_requests ON public.raw_requests;

CREATE TRIGGER trg_normalize_raw_requests
    BEFORE INSERT OR UPDATE ON public.raw_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_raw_requests_data();
