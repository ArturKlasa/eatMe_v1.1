-- 132_vault_based_trigger_auth.sql
-- Created: 2026-05-15
--
-- Replaces the hardcoded legacy anon JWT in _trg_notify_enrich_dish() with a
-- Vault lookup against a secret named 'enrich_dish_service_key'.
--
-- Context (2026-05-15 incident):
--   The trigger previously embedded the project's legacy anon JWT as a literal
--   string in the function body and used it to authenticate net.http_post calls
--   to the enrich-dish Edge Function. Supabase's gateway began rejecting that
--   legacy JWT with 401 UNAUTHORIZED_LEGACY_JWT mid-day on 2026-05-15. Because
--   the trigger is fire-and-forget, the failures were silent — newly confirmed
--   dishes simply got stuck at enrichment_status='pending' with no embedding.
--
--   The fix moves auth to a service-role JWT stored in Supabase Vault. Service-
--   role is the semantically correct credential class for this trigger (it's a
--   backend-to-backend call from Postgres to an Edge Function, not a public
--   client call). Storing the key in Vault rather than the function body means
--   future rotations don't require schema migrations.
--
-- ⚠️  Per-environment prerequisite:
--   Before applying this migration on a new environment, you MUST first store
--   the service-role JWT in Vault:
--
--     SELECT vault.create_secret(
--       '<service-role JWT for this project>',
--       'enrich_dish_service_key',
--       'Service-role JWT used by _trg_notify_enrich_dish'
--     );
--
--   Without that secret, the trigger will log a WARNING and skip the http_post
--   on every dish change. enrich-dish will never be invoked.

BEGIN;

CREATE OR REPLACE FUNCTION public._trg_notify_enrich_dish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_dish_id  UUID;
  v_url      TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/enrich-dish';
  v_key      TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'enrich_dish_service_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'enrich_dish_service_key not in vault';
    RETURN COALESCE(NEW, OLD);
  END IF;

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
                 'Authorization', 'Bearer ' || v_key
               )
  );

  RETURN NEW;
END;
$function$;

COMMIT;
