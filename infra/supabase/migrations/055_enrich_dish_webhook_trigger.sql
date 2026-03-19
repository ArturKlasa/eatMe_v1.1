-- 055_enrich_dish_webhook_trigger.sql
-- Created: 2026-03-19
--
-- Sets up the automatic enrichment pipeline:
--   1. A trigger function that fires AFTER INSERT or name/description UPDATE
--      on dishes and calls pg_net to POST to the enrich-dish Edge Function.
--   2. Matching triggers on dish_ingredients and option_groups so that
--      adding/removing ingredients or options also re-triggers enrichment.
--
-- Why pg_net instead of a Supabase Dashboard Webhook?
--   Database Webhooks are managed via the dashboard and can be lost on
--   project resets. A SQL migration is version-controlled and reproducible.
--   pg_net is available in all Supabase projects (enabled by default).
--
-- IMPORTANT: Set the Edge Function URL below before running.
-- Replace <PROJECT_REF> with your Supabase project reference ID, e.g. abcdefghijkl.
-- You can find it in: Settings → General → Reference ID.

-- ── Enable pg_net if not already enabled ─────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Configuration ─────────────────────────────────────────────────────────────
-- Store the Edge Function URL in a GUC so triggers can read it without
-- hard-coding it in each trigger function.
-- Set this ONCE after migration via:
--   ALTER DATABASE postgres SET app.enrich_dish_url = 'https://<ref>.supabase.co/functions/v1/enrich-dish';

-- ── Trigger function: notify enrich-dish when a dish changes ──────────────────

CREATE OR REPLACE FUNCTION _trg_notify_enrich_dish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dish_id UUID;
  v_url     TEXT;
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

  -- Read the Edge Function URL from database config
  -- Falls back gracefully if not set (enrichment just won't run)
  v_url := current_setting('app.enrich_dish_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    RAISE WARNING '_trg_notify_enrich_dish: app.enrich_dish_url not set, skipping enrichment for dish %', v_dish_id;
    RETURN NEW;
  END IF;

  -- Mark the dish as pending before the async call so the debounce guard works
  UPDATE dishes SET enrichment_status = 'pending' WHERE id = v_dish_id;

  -- Fire-and-forget POST to the Edge Function via pg_net
  -- pg_net is async: does not block the original transaction
  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object('dish_id', v_dish_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

-- ── Trigger on dishes ─────────────────────────────────────────────────────────
-- Fire on INSERT (new dish) and on UPDATE of name or description only
-- (price, availability changes do NOT need re-embedding).

DROP TRIGGER IF EXISTS trg_enrich_on_dish_change ON dishes;
CREATE TRIGGER trg_enrich_on_dish_change
  AFTER INSERT OR UPDATE OF name, description ON dishes
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_enrich_dish();

-- ── Trigger on dish_ingredients ───────────────────────────────────────────────
-- Adding or removing an ingredient changes the semantic content of a dish.

DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON dish_ingredients;
CREATE TRIGGER trg_enrich_on_ingredient_change
  AFTER INSERT OR DELETE ON dish_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_enrich_dish();

-- ── Trigger on option_groups ─────────────────────────────────────────────────
-- For template/experience dishes, option names are part of the embedding input.

DROP TRIGGER IF EXISTS trg_enrich_on_option_group_change ON option_groups;
CREATE TRIGGER trg_enrich_on_option_group_change
  AFTER INSERT OR UPDATE OF name OR DELETE ON option_groups
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_enrich_dish();
