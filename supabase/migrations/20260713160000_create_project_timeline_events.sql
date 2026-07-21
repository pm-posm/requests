-- Migration: Create project_timeline_events table for Analytics

CREATE TABLE IF NOT EXISTS project_timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_item_id UUID REFERENCES project_store_items(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    store_code TEXT NOT NULL,
    phase_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    user_name TEXT,
    evidence_url TEXT,
    notes TEXT,
    metadata JSONB
);

-- Create indexes for fast querying in Dashboards
CREATE INDEX IF NOT EXISTS idx_timeline_project ON project_timeline_events(project_name);
CREATE INDEX IF NOT EXISTS idx_timeline_store ON project_timeline_events(store_item_id);
CREATE INDEX IF NOT EXISTS idx_timeline_phase ON project_timeline_events(phase_type);
CREATE INDEX IF NOT EXISTS idx_timeline_event ON project_timeline_events(event_type);
