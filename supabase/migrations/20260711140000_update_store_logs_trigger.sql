-- Update Trigger Function to replace old `status` & `notes` columns with the 3 new phases
CREATE OR REPLACE FUNCTION log_project_store_items_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, new_value)
        VALUES (NEW.id, NEW.store_code, 'INSERT', 'survey_status', NEW.survey_status);
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.survey_status IS DISTINCT FROM NEW.survey_status) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'survey_status', OLD.survey_status, NEW.survey_status);
        END IF;
        IF (OLD.installation_status IS DISTINCT FROM NEW.installation_status) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'installation_status', OLD.installation_status, NEW.installation_status);
        END IF;
        IF (OLD.acceptance_status IS DISTINCT FROM NEW.acceptance_status) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'acceptance_status', OLD.acceptance_status, NEW.acceptance_status);
        END IF;
        IF (OLD.survey_notes IS DISTINCT FROM NEW.survey_notes) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'survey_notes', OLD.survey_notes, NEW.survey_notes);
        END IF;
        IF (OLD.installation_notes IS DISTINCT FROM NEW.installation_notes) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'installation_notes', OLD.installation_notes, NEW.installation_notes);
        END IF;
        IF (OLD.acceptance_notes IS DISTINCT FROM NEW.acceptance_notes) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'acceptance_notes', OLD.acceptance_notes, NEW.acceptance_notes);
        END IF;
        IF (OLD.category IS DISTINCT FROM NEW.category) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'category', OLD.category, NEW.category);
        END IF;
        IF (OLD.supplier_name IS DISTINCT FROM NEW.supplier_name) THEN
            INSERT INTO project_store_logs(store_item_id, store_code, action_type, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.store_code, 'UPDATE', 'supplier_name', OLD.supplier_name, NEW.supplier_name);
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
