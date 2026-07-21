-- 1. Tạo bảng danh mục Nhà thầu (Suppliers)
CREATE TABLE IF NOT EXISTS project_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Khởi tạo danh sách Supplier ban đầu
INSERT INTO project_suppliers (name) VALUES 
('SDC'), ('LINK4'), ('GIA NGUYỄN'), ('INF'), ('SMART')
ON CONFLICT (name) DO NOTHING;

-- 2. Tạo bảng danh mục Nhân sự kỹ thuật (VIS-TECHs)
CREATE TABLE IF NOT EXISTS project_vis_techs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Khởi tạo danh sách VIS-TECH ban đầu
INSERT INTO project_vis_techs (name) VALUES 
('LÊ HỮU THẮNG'), ('VÕ VĂN VŨ'), ('ĐẶNG NHẬT UY'), ('PHẠM QUANG CHÍNH'), ('NGUYỄN HẢI NAM'), ('TẠ TIẾN ĐẠT')
ON CONFLICT (name) DO NOTHING;

-- 3. Tạo bảng Nhật ký hoạt động (Audit Logs)
CREATE TABLE IF NOT EXISTS project_store_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_item_id UUID,
    store_code TEXT,
    action_type TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    field_name TEXT,          -- status, supplier_name, category, notes, vis_tech
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tạo hàm Trigger tự động ghi log khi có thay đổi trên bảng project_store_items
CREATE OR REPLACE FUNCTION log_project_store_items_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, new_value)
        VALUES (NEW.id, NEW.store_code, 'INSERT', 'status', NEW.status);
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'status', OLD.status, NEW.status);
        END IF;
        IF (OLD.category IS DISTINCT FROM NEW.category) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'category', OLD.category, NEW.category);
        END IF;
        IF (OLD.supplier_name IS DISTINCT FROM NEW.supplier_name) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'supplier_name', OLD.supplier_name, NEW.supplier_name);
        END IF;
        IF (OLD.notes IS DISTINCT FROM NEW.notes) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'notes', OLD.notes, NEW.notes);
        END IF;
        IF (OLD.vis_tech IS DISTINCT FROM NEW.vis_tech) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'vis_tech', OLD.vis_tech, NEW.vis_tech);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO project_store_logs(store_item_id, store_code, action_type)
        VALUES (OLD.id, OLD.store_code, 'DELETE');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn Trigger vào bảng project_store_items
DROP TRIGGER IF EXISTS trg_log_project_store_items ON project_store_items;
CREATE TRIGGER trg_log_project_store_items
AFTER INSERT OR UPDATE OR DELETE ON project_store_items
FOR EACH ROW EXECUTE FUNCTION log_project_store_items_change();

-- Kích hoạt RLS và tạo chính sách cho các bảng mới để Frontend gọi trực tiếp
ALTER TABLE project_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read suppliers" ON project_suppliers;
CREATE POLICY "Allow public read suppliers" ON project_suppliers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write suppliers" ON project_suppliers;
CREATE POLICY "Allow public write suppliers" ON project_suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE project_vis_techs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read vis_techs" ON project_vis_techs;
CREATE POLICY "Allow public read vis_techs" ON project_vis_techs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write vis_techs" ON project_vis_techs;
CREATE POLICY "Allow public write vis_techs" ON project_vis_techs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE project_store_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read logs" ON project_store_logs;
CREATE POLICY "Allow public read logs" ON project_store_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write logs" ON project_store_logs;
CREATE POLICY "Allow public write logs" ON project_store_logs FOR INSERT WITH CHECK (true);
