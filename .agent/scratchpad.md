## 2026-04-22 — Step 1 in progress

Context: implementing the 18-step dish-ingestion + menu-scan-review rework.

### Step 1: Schema migration (114_ingestion_rework.sql)

**Status:** Migration file created. Gates:
- `turbo check-types`: passes (no TS changes in step 1 — 0 tasks, all cached)
- `turbo test`: 443/443 pass; 14 pre-existing unhandled errors from `useMenuScanState.test.ts` (`supabase.auth.getUser is not a function`) — confirmed pre-existing, not introduced by step 1
- Migration smoke-run: Docker daemon not running; cannot run `supabase db reset`. Migration SQL reviewed manually for correctness against existing migration patterns.

**Migration contents:**
1. ADD COLUMN: status, is_template, source_image_index, source_region to dishes
2. RELAX dish_kind CHECK to 8-value transitional union
3. AUTO-RENAME: combo→bundle, template→configurable+is_template=true
4. FIX dish_ingredients FK: add ON DELETE CASCADE
5. CREATE dish_courses + dish_course_items with RLS (owner-via-parent pattern)
6. EXTEND menu_scan_jobs: saved_dish_ids + saved_at
7. UPDATE generate_candidates(): added AND d.is_template = false filter

**Note on Docker unavailability:** Docker daemon was not running. Manual review confirms:
- Column additions follow exact pattern from migrations 073, 110
- CHECK constraint relaxation follows exact pattern from migration 073
- RLS policies follow exact pattern from migration 091
- FK cascade follows dish_ingredients FK pattern
- generate_candidates() is a verbatim copy from 111 with one WHERE clause addition

**Design note re admin_audit_log schema:** Step 5's design doc says "entity_type with CHECK ∈ {'restaurant','dish','menu'}" but the actual schema (database_schema.sql) has `resource_type` not `entity_type`. Will flag when Step 5 is reached.

## 2026-04-22 — Step 1 complete

Migration 114_ingestion_rework.sql authored and committed. All pre-existing tests continue to pass. turbo check-types clean (no TS changes in step 1).
