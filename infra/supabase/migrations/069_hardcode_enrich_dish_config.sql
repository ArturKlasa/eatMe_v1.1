-- 069_hardcode_enrich_dish_config.sql
-- Created: 2026-03-22
--
-- Supabase managed PostgreSQL does not allow ALTER DATABASE ... SET for
-- custom GUCs (app.*).  Replace the current_setting() lookups with
-- hardcoded values so the enrichment trigger actually fires.

CREATE OR REPLACE FUNCTION _trg_notify_enrich_dish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dish_id  UUID;
  v_url      TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/enrich-dish';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcm9xcXZ4YWJvbHlkeXpuZXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyNTQ5MDAsImV4cCI6MjA3MzgzMDkwMH0.wy8yzDPcyWwUDGwdM78-SE7zunEXxbyVGjP3s5ZdgH0';
BEGIN
  -- Determine dish_id from the triggering table
  IF TG_TABLE_NAME = 'dishes' THEN
    v_dish_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'dish_ingredients' THEN
    IF TG_OP = 'DELETE' THEN
      v_dish_id := OLD.dish_id;
    ELSE
      v_dish_id := NEW.dish_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'option_groups' THEN
    IF TG_OP = 'DELETE' THEN
      v_dish_id := OLD.dish_id;
    ELSE
      v_dish_id := NEW.dish_id;
    END IF;
  END IF;

  -- Only act on dish-level option_groups (not category-level)
  IF TG_TABLE_NAME = 'option_groups' AND v_dish_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip re-enrichment on dish UPDATE if name and description are unchanged
  -- (e.g. price edit, availability toggle, or form re-save with no text change).
  IF TG_TABLE_NAME = 'dishes' AND TG_OP = 'UPDATE' THEN
    IF OLD.name IS NOT DISTINCT FROM NEW.name
       AND OLD.description IS NOT DISTINCT FROM NEW.description THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Mark as pending (debounce guard in enrich-dish checks this)
  UPDATE dishes SET enrichment_status = 'pending' WHERE id = v_dish_id;

  -- Fire-and-forget POST with Authorization header
  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object('dish_id', v_dish_id),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_anon_key
               )
  );

  RETURN NEW;
END;
$$;
