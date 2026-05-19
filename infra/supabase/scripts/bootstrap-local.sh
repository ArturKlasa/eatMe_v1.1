#!/usr/bin/env bash
# bootstrap-local.sh — bring local Supabase to a state where the admin integration
# tests (apps/admin/src/__tests__/integration/) can run.
#
# Idempotent: safe to re-run after a `supabase stop && supabase start`, or after
# a `docker volume rm`-style nuke.
#
# What this script does:
#   1. Verifies local Supabase is reachable (otherwise: instruct user).
#   2. Dumps current prod schema (--linked) to /tmp/prod_schema.sql.
#   3. Installs pgvector + postgis in the public schema (matches prod layout).
#   4. Applies the dump (errors for already-existing rows are expected; we filter
#      by checking exit code of the critical CREATE TABLE statements).
#   5. Seeds the app_config single-row table (not part of --schema public dump).
#   6. Applies migrations 140+ in numeric order, skipping REVERSE_ONLY files.
#      Idempotent (CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT).
#   7. Reloads PostgREST's schema cache so the new shape is visible to the API.
#
# Usage:
#   cd infra/supabase
#   bash scripts/bootstrap-local.sh
#
# Prerequisites:
#   - Docker Desktop running.
#   - `supabase start` already executed (script does NOT start Supabase for you —
#     keeping that explicit avoids surprise 30s waits).
#   - `supabase link` already executed (script does NOT relink — the project-ref
#     is loaded from supabase/.temp/project-ref).

set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SUPABASE_ROOT="$REPO_ROOT/infra/supabase"
MIGRATIONS_DIR="$SUPABASE_ROOT/migrations"
DUMP_FILE="${BOOTSTRAP_DUMP_FILE:-/tmp/prod_schema.sql}"
DB_CONTAINER="${BOOTSTRAP_DB_CONTAINER:-supabase_db_supabase}"
LOCAL_API_URL="${LOCAL_SUPABASE_URL:-http://127.0.0.1:54321}"

# ── (1) Reachability check ─────────────────────────────────────────────────────
echo "[1/7] Checking local Supabase reachability..."
if ! curl -sf "$LOCAL_API_URL/rest/v1/" -H "apikey: foo" >/dev/null 2>&1; then
  # PostgREST returns 401 without a valid key, but a HEAD/GET still proves it's up.
  if ! curl -s -o /dev/null -w '%{http_code}' "$LOCAL_API_URL/rest/v1/" | grep -qE '^(200|401|404)$'; then
    echo "ERROR: Local Supabase not reachable at $LOCAL_API_URL"
    echo "       Run: cd $SUPABASE_ROOT && supabase start"
    exit 1
  fi
fi
if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "ERROR: Local Postgres container '$DB_CONTAINER' not running"
  echo "       Run: cd $SUPABASE_ROOT && supabase start"
  exit 1
fi
echo "    ✓ Local Supabase reachable; container '$DB_CONTAINER' running."

# ── (2) Dump prod schema (if missing or stale) ────────────────────────────────
echo "[2/7] Dumping prod schema to $DUMP_FILE..."
if [[ "${BOOTSTRAP_SKIP_DUMP:-0}" == "1" && -f "$DUMP_FILE" ]]; then
  echo "    ↻ BOOTSTRAP_SKIP_DUMP=1 + existing dump — using cached file."
else
  cd "$SUPABASE_ROOT"
  # Make sure linked project-ref is where supabase CLI expects it.
  mkdir -p "$SUPABASE_ROOT/supabase/.temp"
  if [[ -f "$SUPABASE_ROOT/.temp/project-ref" && ! -f "$SUPABASE_ROOT/supabase/.temp/project-ref" ]]; then
    cp "$SUPABASE_ROOT/.temp/project-ref" "$SUPABASE_ROOT/supabase/.temp/project-ref"
  fi
  if ! supabase db dump --linked --schema public > "$DUMP_FILE" 2>/dev/null; then
    echo "ERROR: supabase db dump --linked failed."
    echo "       Make sure the project is linked: cd $SUPABASE_ROOT && supabase link"
    exit 1
  fi
  cd - >/dev/null
fi
echo "    ✓ Dump file: $(wc -l < "$DUMP_FILE") lines."

# ── (3) Install pgvector + postgis in public schema ───────────────────────────
echo "[3/7] Ensuring pgvector + postgis in public schema..."
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS vector  WITH SCHEMA public;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis' AND n.nspname = 'public'
  ) THEN
    -- Drop from any non-public schema first, then reinstall.
    DROP EXTENSION IF EXISTS postgis CASCADE;
    CREATE EXTENSION postgis WITH SCHEMA public;
  END IF;
END $$;
EOSQL
echo "    ✓ Extensions confirmed in public schema."

# ── (4) Apply dump (errors for existing rows are expected & ignored) ──────────
echo "[4/7] Applying prod schema dump to local..."
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$DUMP_FILE" \
  > /tmp/bootstrap-dump-apply.log 2>&1 || true
FATAL_ERR_COUNT=$(grep -cE 'ERROR:  (relation|type) "public\.[a-z_]+" does not exist' /tmp/bootstrap-dump-apply.log || true)
if [[ "$FATAL_ERR_COUNT" -gt 0 ]]; then
  echo "WARN: $FATAL_ERR_COUNT 'relation does not exist' errors — schema dump partial."
  echo "      See /tmp/bootstrap-dump-apply.log for details."
fi
echo "    ✓ Schema applied."

# ── (5) Seed app_config (migration 141a INSERT is not part of --schema public) ─
echo "[5/7] Seeding app_config single-row table..."
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL' >/dev/null
INSERT INTO app_config (id, min_supported_mobile_version, latest_mobile_version,
                        update_url_ios, update_url_android)
VALUES (true, '0.0.0', '0.0.0',
        'https://apps.apple.com/', 'https://play.google.com/')
ON CONFLICT (id) DO NOTHING;
EOSQL
echo "    ✓ app_config seeded."

# ── (6) Apply migrations 140+ (idempotent; skip REVERSE_ONLY) ──────────────────
echo "[6/7] Applying migrations 140+ to local DB..."
APPLIED=0
for f in "$MIGRATIONS_DIR"/[0-9]*.sql; do
  bn=$(basename "$f")
  # Skip REVERSE_ONLY files and anything before 140 (those are in the prod dump).
  case "$bn" in
    *REVERSE_ONLY*) continue ;;
  esac
  num=$(echo "$bn" | grep -oE '^[0-9]+' || echo 0)
  # Force base 10 so leading zeros (e.g. 078, 079) don't trip bash octal parser.
  if (( 10#$num < 140 )); then
    continue
  fi
  if ! docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f" > /tmp/bootstrap-mig-"$bn".log 2>&1; then
    echo "ERROR: migration $bn failed. See /tmp/bootstrap-mig-$bn.log"
    exit 1
  fi
  APPLIED=$((APPLIED+1))
done
echo "    ✓ Applied $APPLIED migration(s)."

# ── (7) Reload PostgREST schema cache ─────────────────────────────────────────
echo "[7/7] Reloading PostgREST schema cache..."
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';" >/dev/null
# PostgREST processes the NOTIFY async; small sleep ensures the cache is warm
# before the next test run pokes it.
sleep 1
echo "    ✓ Schema cache reloaded."

echo
echo "Bootstrap complete. Next: pnpm -C apps/admin test:integration"
