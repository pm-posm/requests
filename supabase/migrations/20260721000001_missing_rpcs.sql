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
    RETURN QUERY
    SELECT 
        psi.final_project,
        COUNT(*)::INT as store_count,
        SUM(CASE WHEN psi.status = 'Published' THEN 1 ELSE 0 END)::INT as published_store_count,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT psi.customer), NULL) as customers,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT psi.supplier_name), NULL) as suppliers,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT psi.phase_type::text), NULL) as phases,
        'N/A'::TEXT as posm_type
    FROM project_store_items psi
    GROUP BY psi.final_project;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_master_filters()
RETURNS JSONB AS $$
BEGIN
    RETURN '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upsert_store_phases_transaction(p_data JSONB)
RETURNS JSONB AS $$
BEGIN
    RETURN '{"success": true}'::JSONB;
END;
$$ LANGUAGE plpgsql;
