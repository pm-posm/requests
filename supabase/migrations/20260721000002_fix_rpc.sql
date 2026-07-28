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
        p.final_key as final_project,
        0::INT as store_count,
        0::INT as published_store_count,
        ARRAY[]::TEXT[] as customers,
        ARRAY[]::TEXT[] as suppliers,
        ARRAY[]::TEXT[] as phases,
        'N/A'::TEXT as posm_type
    FROM posm_projects p;
END;
$$ LANGUAGE plpgsql;
