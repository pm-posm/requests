-- Migration: Support Google Sheet Sync Engine & Jira/ClickUp Workflow Engine

-- 1. Create workflow_statuses table for dynamic status management
CREATE TABLE IF NOT EXISTS workflow_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('to_do', 'in_progress', 'review', 'done')),
    phuong_an_scope TEXT DEFAULT 'ALL',
    color TEXT DEFAULT '#6366f1',
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for workflow_statuses
ALTER TABLE workflow_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_workflow_statuses" ON workflow_statuses;
CREATE POLICY "public_workflow_statuses" ON workflow_statuses FOR ALL USING (true) WITH CHECK (true);

-- Seed default statuses matching real Mer View 2026 sheet
INSERT INTO workflow_statuses (name, category, phuong_an_scope, color, order_index) VALUES
('Mới tiếp nhận', 'to_do', 'ALL', '#94a3b8', 1),
('Vis - Đã gửi RQ tới Agency', 'in_progress', 'Supplier Bảo Hành', '#3b82f6', 2),
('Supplier đã gửi lịch', 'in_progress', 'Supplier Bảo Hành', '#8b5cf6', 3),
('Tiếp nhận Quick Fix', 'in_progress', 'Mer Quick Fix', '#06b6d4', 4),
('Under CSP Review', 'review', 'CSP_REQUEST', '#f59e0b', 5),
('Approved', 'review', 'CSP_REQUEST', '#10b981', 6),
('Rejected', 'review', 'CSP_REQUEST', '#ef4444', 7),
('Hoàn Thành', 'done', 'ALL', '#10b981', 8),
('Cancelled', 'done', 'ALL', '#64748b', 9)
ON CONFLICT DO NOTHING;

-- 2. Create raw_requests table mapped to 35+ columns of Sheet Source "Mer View 2026"
CREATE TABLE IF NOT EXISTS raw_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_key TEXT UNIQUE NOT NULL,
    email TEXT,
    date_of_rq TEXT,
    week TEXT,
    mer TEXT,
    sr TEXT,
    store_name TEXT,
    ess_store_code TEXT,
    ka TEXT,
    customer TEXT,
    loai_rq TEXT,
    posm TEXT,
    so_luong TEXT,
    cat TEXT,
    brand TEXT,
    sr_note TEXT,
    img_overview TEXT,
    img_detail_01 TEXT,
    img_detail_02 TEXT,
    img_detail_03 TEXT,
    deadline TEXT,
    phuong_an TEXT,
    ngay_quick_fix TEXT,
    link_rq TEXT,
    status TEXT,
    tien_do TEXT,
    title_email_request TEXT,
    ma_du_an TEXT,
    supplier TEXT,
    request_id TEXT,
    vis_note TEXT,
    data_responser TEXT,
    mer_note TEXT,
    sent_mail_sr TEXT,
    sheet_row_index INTEGER,
    status_id UUID REFERENCES workflow_statuses(id) ON DELETE SET NULL,
    is_mer_modified BOOLEAN DEFAULT FALSE,
    is_deleted_in_sheet BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for raw_requests
ALTER TABLE raw_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_raw_requests" ON raw_requests;
CREATE POLICY "public_raw_requests" ON raw_requests FOR ALL USING (true) WITH CHECK (true);

-- Indexing for high-performance filtering & search
CREATE INDEX IF NOT EXISTS idx_raw_requests_key ON raw_requests(request_key);
CREATE INDEX IF NOT EXISTS idx_raw_requests_phuong_an ON raw_requests(phuong_an);
CREATE INDEX IF NOT EXISTS idx_raw_requests_status ON raw_requests(status);
CREATE INDEX IF NOT EXISTS idx_raw_requests_store ON raw_requests(ess_store_code);

-- 3. High Performance RPC Bulk Upsert Function with Field Ownership Protection
CREATE OR REPLACE FUNCTION bulk_upsert_raw_requests(payload JSONB)
RETURNS INTEGER AS $$
DECLARE
    item JSONB;
    upserted_count INTEGER := 0;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(payload)
    LOOP
        INSERT INTO raw_requests (
            request_key, email, date_of_rq, week, mer, sr, store_name, ess_store_code, ka, customer,
            loai_rq, posm, so_luong, cat, brand, sr_note, img_overview, img_detail_01, img_detail_02, img_detail_03,
            deadline, phuong_an, ngay_quick_fix, link_rq, status, tien_do, title_email_request, ma_du_an,
            supplier, request_id, vis_note, data_responser, mer_note, sent_mail_sr, sheet_row_index,
            is_mer_modified, is_deleted_in_sheet, updated_at
        ) VALUES (
            item->>'request_key',
            item->>'email',
            item->>'date_of_rq',
            item->>'week',
            item->>'mer',
            item->>'sr',
            item->>'store_name',
            item->>'ess_store_code',
            item->>'ka',
            item->>'customer',
            item->>'loai_rq',
            item->>'posm',
            item->>'so_luong',
            item->>'cat',
            item->>'brand',
            item->>'sr_note',
            item->>'img_overview',
            item->>'img_detail_01',
            item->>'img_detail_02',
            item->>'img_detail_03',
            item->>'deadline',
            item->>'phuong_an',
            item->>'ngay_quick_fix',
            item->>'link_rq',
            item->>'status',
            item->>'tien_do',
            item->>'title_email_request',
            item->>'ma_du_an',
            item->>'supplier',
            item->>'request_id',
            item->>'vis_note',
            item->>'data_responser',
            item->>'mer_note',
            item->>'sent_mail_sr',
            (item->>'sheet_row_index')::INTEGER,
            FALSE,
            FALSE,
            NOW()
        )
        ON CONFLICT (request_key) DO UPDATE SET
            email = EXCLUDED.email,
            date_of_rq = EXCLUDED.date_of_rq,
            week = EXCLUDED.week,
            sr = EXCLUDED.sr,
            store_name = EXCLUDED.store_name,
            ess_store_code = EXCLUDED.ess_store_code,
            ka = EXCLUDED.ka,
            customer = EXCLUDED.customer,
            loai_rq = EXCLUDED.loai_rq,
            posm = EXCLUDED.posm,
            so_luong = EXCLUDED.so_luong,
            cat = EXCLUDED.cat,
            brand = EXCLUDED.brand,
            sr_note = EXCLUDED.sr_note,
            img_overview = EXCLUDED.img_overview,
            img_detail_01 = EXCLUDED.img_detail_01,
            img_detail_02 = EXCLUDED.img_detail_02,
            img_detail_03 = EXCLUDED.img_detail_03,
            deadline = EXCLUDED.deadline,
            link_rq = EXCLUDED.link_rq,
            title_email_request = EXCLUDED.title_email_request,
            ma_du_an = EXCLUDED.ma_du_an,
            request_id = EXCLUDED.request_id,
            sheet_row_index = EXCLUDED.sheet_row_index,
            is_deleted_in_sheet = FALSE,
            -- Protect Mer Workflow fields if modified on Dashboard!
            phuong_an = CASE WHEN raw_requests.is_mer_modified THEN raw_requests.phuong_an ELSE EXCLUDED.phuong_an END,
            status = CASE WHEN raw_requests.is_mer_modified THEN raw_requests.status ELSE EXCLUDED.status END,
            tien_do = CASE WHEN raw_requests.is_mer_modified THEN raw_requests.tien_do ELSE EXCLUDED.tien_do END,
            ngay_quick_fix = CASE WHEN raw_requests.is_mer_modified THEN raw_requests.ngay_quick_fix ELSE EXCLUDED.ngay_quick_fix END,
            supplier = CASE WHEN raw_requests.is_mer_modified THEN raw_requests.supplier ELSE EXCLUDED.supplier END,
            vis_note = CASE WHEN raw_requests.is_mer_modified THEN raw_requests.vis_note ELSE EXCLUDED.vis_note END,
            mer_note = CASE WHEN raw_requests.is_mer_modified THEN raw_requests.mer_note ELSE EXCLUDED.mer_note END,
            updated_at = NOW();

        upserted_count := upserted_count + 1;
    END LOOP;

    RETURN upserted_count;
END;
$$ LANGUAGE plpgsql;
