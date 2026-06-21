---
phase: 06-schema-teardown-spine
reviewed: 2026-06-21T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - apps/web-portal-v2/src/components/menu/DishForm.tsx
  - apps/web-portal-v2/src/components/menu/MenuManager.tsx
  - infra/scripts/verify-phase6-teardown.ts
  - infra/supabase/migrations/171_REVERSE_ONLY_retire_ingredient_triggers_reconciled.sql
  - infra/supabase/migrations/171_retire_ingredient_triggers_reconciled.sql
  - infra/supabase/migrations/172_snapshot_ingredient_archive.sql
  - infra/supabase/migrations/173_REVERSE_ONLY_drop_ingredient_tables_restrict.sql
  - infra/supabase/migrations/173_drop_ingredient_tables_restrict.sql
  - infra/supabase/migrations/174_REVERSE_ONLY_drop_ingredient_columns_restrict.sql
  - infra/supabase/migrations/174_drop_ingredient_columns_restrict.sql
  - packages/shared/src/constants/menu.ts
  - packages/shared/src/types/index.ts
  - packages/shared/src/types/restaurant.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-21
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Schema-teardown phase: Phase B trigger retirement (171), pre-drop archive (172), RESTRICT table drop (173), dead-column drop (174), each with a paired structural-only reverse, plus the `DishKind` / `DISH_KIND_META` shim severance from `apps/web-portal-v2` and `@eatme/shared`.

The SQL is the load-bearing artifact here and it holds up well under adversarial scrutiny. I independently reconstructed the FK graph from the original `099_new_ingredients_schema.sql` (+ 102/107) and **the RESTRICT child→parent drop order in 173 is provably correct**: every table is dropped only after all its inbound FK dependents are already gone, and the one FK that points *into* the doomed set from a surviving table (`options.canonical_ingredient_id`) is severed as the first statement. RESTRICT (not CASCADE), `IF EXISTS` idempotency, and the snapshot-before-drop ordering all check out. The `canonical_ingredient_dietary_tags` asymmetry between 172 (not archived) and 173 (in drop list) is **correct, not a bug** — migration 156 already dropped that table with CASCADE, so there is nothing left to archive and the 173 drop is a guarded no-op.

No blockers. The findings below are robustness gaps in the verify script and dead-but-harmless residue in the TypeScript layer that the shim removal left behind.

## Warnings

### WR-01: verify script treats ANY error as proof an object is GONE (false-positive risk)

**File:** `infra/scripts/verify-phase6-teardown.ts:19-43`
**Issue:** The verification logic is `error ? 'GONE ✓' : 'STILL EXISTS ✗'`. It reports an object as successfully torn down whenever *any* error comes back from the query — but a network blip, an expired/invalid service-role key, an RLS/permission error, or a PostgREST schema-cache staleness error all surface as truthy `error` too. For a script whose entire job is to certify that an irreversible prod teardown landed, "any error == success" is the wrong default: a transient connection failure would print a full board of `GONE ✓` and falsely certify the drop. The check should assert on the *specific* error (PostgREST `42P01 undefined_table` / `42703 undefined_column`, codes `PGRST205`/`PGRST204` for missing relation/column) and treat any other error as INCONCLUSIVE, not as confirmation.
**Fix:**
```ts
function isMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // PostgREST: relation/column not found in schema cache, or PG undefined_table/column
  return ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '')
    || /(does not exist|could not find|schema cache)/i.test(error.message ?? '');
}
// ...
const { error } = await sb.from('dishes').select(col).limit(1);
const verdict = error == null ? 'STILL EXISTS ✗'
  : isMissingError(error) ? 'GONE ✓'
  : `INCONCLUSIVE (${error.code ?? error.message})`;
console.log(`dishes.${col.padEnd(20)}: ${verdict}`);
```

### WR-02: verify script never sets a non-zero exit code and swallows fatal errors

**File:** `infra/scripts/verify-phase6-teardown.ts:13-48`
**Issue:** `main()` is invoked without `.catch(...)`, and never tracks whether any check failed. Two consequences: (1) if `main()` rejects (e.g. missing env var dereference at line 11, or the client throws), the process exits 0 with an unhandled-rejection warning rather than failing loudly; (2) even when checks run cleanly, a `STILL EXISTS ✗` result still exits 0. Any CI/operator wrapper that keys off the exit code will read "teardown verified" from a run that actually found surviving objects or crashed mid-way. A verification tool must exit non-zero on both fatal error and on any negative finding.
**Fix:**
```ts
let allGone = true;
// ...in each loop: if the object is NOT gone, set allGone = false...
main()
  .then(() => process.exit(allGone ? 0 : 1))
  .catch((e) => { console.error(e); process.exit(2); });
```

### WR-03: `MenuManager` still carries a dead `dish_kind` field that hardcodes `'standard'` and renders it as a badge

**File:** `apps/web-portal-v2/src/components/menu/MenuManager.tsx:23` (type), `167`, `204`, `346`
**Issue:** The `DishKind`/`dish_kind` shim removal (DEBT-03) was completed in `DishForm` and `@eatme/shared`, but `MenuManager` was left half-migrated. `CategoryWithDishes.dishes[].dish_kind: string` still exists in the local type; `handleCreateDish` (line 167) and `handleUpdateDish` (line 204) both write a literal `dish_kind: 'standard'`; and line 346 renders `{dish.dish_kind}` as a visible pill on every dish row. Because the `dish_kind` column was dropped from the DB (migration 163) and the DAL now synthesizes `dish_kind: 'standard' as const` (`apps/web-portal-v2/src/lib/auth/dal.ts:76`), this badge is now guaranteed to display the constant string "standard" on every dish — dead UI that survived the teardown. The phase intent was to sever the kind concept; this is residue that contradicts that intent. (Both `setMenus` calls already require an `as never` cast at lines 179/211, which is masking exactly this kind of type drift.)
**Fix:** Drop `dish_kind` from `CategoryWithDishes`, remove the two `dish_kind: 'standard'` literals, and delete the badge at lines 345-347. Removing the field should also let you drop the `as never` casts at lines 179 and 211 (verify they were only needed for the synthesized field).

### WR-04: `DishCourse` / `DishCourseItem` types reference dropped schema and remain exported as live API

**File:** `packages/shared/src/types/index.ts:7-8`, `packages/shared/src/types/restaurant.ts:21-37`
**Issue:** `DishCourse` (with `parent_dish_id`) and `DishCourseItem` (with `course_id`, `links_to_dish_id`) model the `dish_courses` / `dish_course_items` tables that CLAUDE.md states were dropped 2026-06-12 (migration 163), and `parent_dish_id` is one of the columns this very phase's lineage marks for removal. They are still exported from the package barrel (`index.ts`) as first-class public types with no `@deprecated` marker — unlike the `Dish` interface's legacy fields, which are all clearly annotated. A schema-teardown phase that strips `DishKind` and the kind discriminator but leaves these course types exported as if live is internally inconsistent: a consumer can still import `DishCourse` and build against a table that no longer exists. Either delete them (preferred, matching the `DishKind` removal) or annotate `@deprecated` to match the `Dish` legacy-field convention.
**Fix:** Remove `DishCourse` / `DishCourseItem` from `restaurant.ts` and the two re-exports in `index.ts`, after grepping for external usage (`grep -rn "DishCourse" apps packages --include=*.ts --include=*.tsx`). If a consumer still depends on them, annotate with `@deprecated Phase 7 dropped dish_courses (migration 163)` instead.

## Info

### IN-01: `DishForm` knowingly drops all modifier/bundle/course form data on submit

**File:** `apps/web-portal-v2/src/components/menu/DishForm.tsx:78-89`, `211-216`
**Issue:** `buildDishInput` no longer maps `bundle_items`, `slots`, or `courses` into the persisted input, yet `BundleItemsSection`, `ConfigurableSlotsSection`, and `CourseEditorSection` are still rendered unconditionally and capture that data into form state. A user filling those sections will see their input silently discarded on save. This is **explicitly documented** as a Known Stub for the on-ice v2 app (the in-code comment and the phase context both call it out), so it is acceptable as-is — flagging only so it is not mistaken for an undocumented data-loss bug during a later audit. Consider disabling/hiding the three sections behind a "coming soon" guard so the on-ice UI does not invite data entry that is thrown away.
**Fix:** Acceptable per documented stub. Optionally gate the three modifier sections so they do not accept input until wiring is restored at v2 revival.

### IN-02: `DishFormValues` retains `slots` / `courses` / `bundle_items` shapes with no submit path

**File:** `apps/web-portal-v2/src/components/menu/DishForm.tsx:24-39`
**Issue:** The `slots` and `courses` sub-shapes in `DishFormValues` model the same retired parent/variant + dish_courses concepts removed at the schema level. They are still wired to the rendered section components (so they are not strictly dead), but they have no path to persistence. Consistent with IN-01; tracked together for v2 revival.
**Fix:** No action this phase. Revisit when modifier wiring is restored.

### IN-03: `verify-phase6-teardown.ts` uses `as any` on the Supabase client, defeating type checking

**File:** `infra/scripts/verify-phase6-teardown.ts:11`
**Issue:** `createClient(...) as any` is used so the script can query dropped tables/columns the generated types no longer know about. Understandable for a teardown-verification probe (the whole point is to query objects the type system believes are gone), but `as any` on the entire client also silences any genuine typo in a table/column name string, which would then read as a false `GONE ✓`. Low severity given the script's throwaway, operator-run nature.
**Fix:** Narrow the cast (e.g. `as unknown as SupabaseClient<any>` or a minimal local interface exposing only `.from().select().limit()`) so only the schema-shape is loosened, not the method surface.

### IN-04: `DiningFormat` / `DINING_FORMAT_META` carry inline emoji that may trip lint/encoding rules

**File:** `packages/shared/src/constants/menu.ts:33-45`
**Issue:** The meta map embeds emoji literals (🍽️ 🍷 🔥 🥢 🍢). Not introduced by this phase (pre-existing), and harmless at runtime, but some toolchains flag non-ASCII source. Noted only because this file is in scope; no change required.
**Fix:** None required.

### IN-05: Reverse migrations are intentionally degenerate — confirmed schema-only and safe

**File:** `infra/supabase/migrations/171_REVERSE_ONLY_*.sql`, `173_REVERSE_ONLY_*.sql`, `174_REVERSE_ONLY_*.sql`
**Issue:** Verified per the phase's explicit check ("REVERSE files are schema-only and don't reference dropped objects"): 171_REVERSE and 173_REVERSE are no-op markers with documented rationale (recreating the trigger functions/tables would reference 156-dropped objects and fail to apply); 174_REVERSE re-adds only the two `text[]` override columns with their original defaults and references nothing dropped. None of the reverse files reference a dropped object in executable DDL. This is a positive confirmation, not a defect.
**Fix:** None — behaving as designed.

---

_Reviewed: 2026-06-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
