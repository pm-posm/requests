-- Migration: Add vis_tech column to project_store_items table for field technician tracking
ALTER TABLE project_store_items ADD COLUMN IF NOT EXISTS vis_tech TEXT;
