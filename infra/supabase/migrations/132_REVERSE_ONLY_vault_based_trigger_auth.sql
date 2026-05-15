-- 132_REVERSE_ONLY_vault_based_trigger_auth.sql
-- Reverses 132_vault_based_trigger_auth.sql.
--
-- IMPORTANT: this reverse is INCOMPLETE on purpose. Re-creating the trigger
-- with the prior hardcoded legacy anon JWT would commit that key into git.
-- Even though it's a "public" key, baking secrets into version control is a
-- smell we don't want to set as precedent.
--
-- If you really need to roll back:
--   1. Retrieve the legacy anon JWT from your Supabase Dashboard → Settings →
--      API → Legacy keys, OR from a pre-2026-05-15 pg_trigger backup.
--   2. Replace <PASTE_LEGACY_ANON_JWT_HERE> below.
--   3. Run the script manually in the SQL editor (do NOT commit the populated
--      version to git).
--   4. Remember to also remove the Vault secret if you no longer want it:
--        SELECT vault.delete_secret(
--          (SELECT id FROM vault.secrets WHERE name = 'enrich_dish_service_key')
--        );
--
-- Better path: don't roll this migration back. If the Vault-based trigger has
-- a bug, fix forward with a new migration rather than reverting.

-- The skeleton below is intentionally unrunnable until the JWT placeholder
-- is replaced. Uncomment + populate manually if rollback is truly needed.

/*
BEGIN;

CREATE OR REPLACE FUNCTION public._trg_notify_enrich_dish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_dish_id  UUID;
  v_url      TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/enrich-dish';
  v_anon_key TEXT := '<PASTE_LEGACY_ANON_JWT_HERE>';
BEGIN
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

  IF TG_TABLE_NAME = 'option_groups' AND v_dish_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'dishes' AND TG_OP = 'UPDATE' THEN
    IF OLD.name IS NOT DISTINCT FROM NEW.name
       AND OLD.description IS NOT DISTINCT FROM NEW.description THEN
      RETURN NEW;
    END IF;
  END IF;

  UPDATE dishes SET enrichment_status = 'pending' WHERE id = v_dish_id;

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
$function$;

COMMIT;
*/
