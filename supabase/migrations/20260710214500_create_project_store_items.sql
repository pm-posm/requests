-- Migration: Create project_store_items table for store-level and item-level progress tracking

CREATE TABLE IF NOT EXISTS project_store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_project TEXT NOT NULL,
    phase_type phase_type_enum NOT NULL,
    store_code TEXT NOT NULL,
    store_name TEXT,
    category TEXT,
    supplier_name TEXT,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure a store code and category combination is unique per project phase
ALTER TABLE project_store_items 
ADD CONSTRAINT project_store_items_unique_item UNIQUE (final_project, phase_type, store_code, category);

-- Grant permissions for authenticated and anon users (read and write)
ALTER TABLE project_store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read project_store_items" 
ON project_store_items FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert project_store_items" 
ON project_store_items FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update project_store_items" 
ON project_store_items FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete project_store_items" 
ON project_store_items FOR DELETE 
USING (true);
