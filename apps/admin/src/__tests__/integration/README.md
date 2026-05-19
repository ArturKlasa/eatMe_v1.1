# Admin integration tests — local setup

Tests under this directory hit **local Supabase** (Docker) to exercise real
Postgres transaction boundaries. Default unit tests (`pnpm test`) skip this
directory; integration tests run via `pnpm test:integration`.

## One-time setup

Prerequisite: Docker Desktop installed.

```bash
# 1) Start Docker Desktop (CLI variant)
systemctl --user start docker-desktop

# 2) Disable the Supabase Analytics container locally (it mounts the Docker
#    socket, which Docker Desktop blocks). Already done in
#    infra/supabase/supabase/config.toml — keep `analytics.enabled = false`.

# 3) Boot local Supabase (downloads ~1.5GB on first run)
cd infra/supabase
supabase start
```

After `supabase start` completes, the rest of this guide handles the **first**
schema load. Subsequent runs only need `supabase start` (volume preserved).

## Loading the schema

`supabase db reset` would replay migrations from `infra/supabase/supabase/migrations/`
which is empty (real migrations live at `infra/supabase/migrations/`). Instead,
dump the current prod schema and apply it to local:

```bash
# Project-ref location quirk: the CLI looks at supabase/.temp/, but ours is at
# infra/supabase/.temp/. Copy it once.
mkdir -p infra/supabase/supabase/.temp
cp infra/supabase/.temp/project-ref infra/supabase/supabase/.temp/project-ref

# Pull prod schema
cd infra/supabase
supabase db dump --linked --schema public > /tmp/prod_schema.sql

# Local needs pgvector + postgis (extensions, not part of --schema public dump)
docker exec -i supabase_db_supabase psql -U postgres -d postgres \
  -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;"

# Apply the dump
docker exec -i supabase_db_supabase psql -U postgres -d postgres < /tmp/prod_schema.sql

# Seed the app_config single-row table (migration 141a INSERT — not in schema dump)
docker exec -i supabase_db_supabase psql -U postgres -d postgres -c "
  INSERT INTO app_config (id, min_supported_mobile_version, latest_mobile_version,
                          update_url_ios, update_url_android)
  VALUES (true, '0.0.0', '0.0.0', 'https://apps.apple.com/', 'https://play.google.com/')
  ON CONFLICT (id) DO NOTHING;"

# Reload PostgREST's schema cache (it cached the empty schema at startup)
docker exec -i supabase_db_supabase psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';"
```

## Running tests

From the repo root:

```bash
pnpm -C apps/admin test:integration
```

## Refreshing local schema (e.g. after applying a new migration to prod)

```bash
cd infra/supabase
supabase db dump --linked --schema public > /tmp/prod_schema.sql
docker exec -i supabase_db_supabase psql -U postgres -d postgres < /tmp/prod_schema.sql
docker exec -i supabase_db_supabase psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';"
```

## Notes for Phase 4.2 and beyond

The Phase 4.2 migration 144 introduces the `admin_confirm_menu_scan` and
`admin_replace_dish_modifiers` RPCs. To test them locally before pushing to prod,
apply the migration SQL directly:

```bash
docker exec -i supabase_db_supabase psql -U postgres -d postgres \
  < infra/supabase/migrations/144_admin_menu_scan_and_modifier_rpcs.sql
docker exec -i supabase_db_supabase psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';"
```

The proper long-term fix is to move the migrations directory to
`infra/supabase/supabase/migrations/` (Supabase CLI's standard location) so
`supabase db reset` works without these workarounds. Deferred — out of Phase 4.1
scope; tracked as a follow-up.
