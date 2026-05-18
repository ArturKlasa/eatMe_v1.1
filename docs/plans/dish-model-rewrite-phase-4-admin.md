# Phase 4 — Admin app

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Proposed
**Last updated:** 2026-05-17
**Estimated wall time:** 6–7 days (including §1 test infra prerequisite)
**Reversibility:** Writes both legacy + new shape during transition; safe to revert mid-rollout.

Stand up Vitest integration tests against local Supabase (prerequisite), wrap the confirm action as a Postgres RPC, replace `VariantEditor` + `CourseEditor` with one `ModifierGroupsEditor`, and update the restaurant detail dish editor.

---

## 1. Test infrastructure prerequisite

The Phase 4a confirm RPC must roll back cleanly on partial failure. Existing admin tests use Vitest with mocked Supabase, which cannot exercise real transaction boundaries. Before §2 starts, stand up a Vitest integration-test mode that runs against a local Supabase instance.

**Decision: extend Vitest, do not adopt pgTAP.**

| Option | Pro | Con | Verdict |
|---|---|---|---|
| pgTAP (SQL-side tests) | True transaction testing; SQL-native | New test runner; SQL test ergonomics painful; new CI plumbing | Reject |
| **Vitest + local Supabase** | Reuses existing Vitest; same TS as app code; can reuse fixtures; supabase CLI already in monorepo | CI gets slower (~30s for `supabase start`) | **Accept** |
| Staging-only manual verification | Zero new infra | Not in CI = will regress silently | Reject |

**Concretely:**

```
apps/admin/vitest.integration.config.ts                    # new file — separate project
apps/admin/src/__tests__/integration/
  setup.ts                                                 # boots local supabase, applies migrations, seeds fixtures
  admin-confirm-rpc.test.ts                                # the test referenced in §5
```

`setup.ts` invokes `supabase start` (idempotent — no-op if already running), applies migrations 140–144 to the local DB, and seeds a baseline restaurant + admin user. Per-test cleanup truncates the dishes/option_groups/options tables.

Failure-injection pattern for the rollback test: pass two dishes in the same payload with the same `(restaurant_id, menu_category_id, name)` triple to violate the unique index mid-RPC. Assertions:
1. RPC returns an error response.
2. `SELECT count(*) FROM dishes WHERE restaurant_id = $1 AND created_at > $job_start` is zero.
3. `SELECT count(*) FROM option_groups WHERE dish_id IN (...)` is zero.
4. `menu_scan_jobs.status` for the job is still `'review'`, not `'completed'`.

`package.json` additions:
```json
"scripts": {
  "test": "vitest run",
  "test:integration": "vitest run --config vitest.integration.config.ts"
}
```

CI: separate GitHub Actions job runs `pnpm test:integration` after `supabase start`. Unit-test job stays fast.

**Effort:** 1 day to scaffold (config + setup + one example test). Actual Phase 4a test cases are inside Phase 4a's existing budget.

## 2. Phase 4a: confirm action as RPC (CRITICAL prerequisite)

**Why:** the existing `adminConfirmMenuScan` does 4 sequential insert passes without a transaction. Adding modifier-group inserts as a 5th pass amplifies the partial-failure problem (orphan dishes + orphan modifier rows on retry).

**New migration 144:** wrap the entire confirm logic in a Postgres function. The same migration also introduces `admin_replace_dish_modifiers` (used by §4 restaurant-detail editor) — both RPCs share identical auth/SECURITY pattern, so they ship together.

**Auth model: `SECURITY INVOKER` + service-role caller.** The admin app already uses the service-role Supabase client for admin operations (via `createAdminServiceClient()`). The service-role JWT bypasses RLS by design. Therefore:
- `SECURITY INVOKER` (the default) — function runs with caller's privileges.
- `withAdminAuth` wrapper in the app verifies `app_metadata.role === 'admin'` BEFORE calling the RPC. This is the only authorization gate.
- `REVOKE EXECUTE ... FROM public; GRANT EXECUTE ... TO service_role;` to prevent unauthenticated callers from even reaching the function.

No `SECURITY DEFINER` shenanigans, no internal `auth.uid()` checks needed — the security boundary is in app code (admin role check) + database (service-role grant + RLS bypass). Matches the existing admin RPC pattern; no new attack surface.

```sql
CREATE FUNCTION admin_confirm_menu_scan(
  p_job_id uuid,
  p_admin_id uuid,    -- supplied by app for audit logging; NOT used for authz
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER       -- explicit; the function does not need elevated privileges
AS $$
DECLARE
  v_inserted_count int;
  v_categories_created int;
  -- ...
BEGIN
  -- 1. Validate job + restaurant
  -- 2. Resolve canonical slugs + existing category IDs
  -- 3. Dedupe + upsert menu_categories
  -- 4. Insert dishes (flat, no parent/child)
  -- 5. Insert option_groups + options per dish
  -- 6. Mark job completed + return summary
  -- Single transaction. ROLLBACK on any failure.
EXCEPTION
  WHEN OTHERS THEN
    -- structured error return
END $$;

REVOKE EXECUTE ON FUNCTION admin_confirm_menu_scan FROM public;
GRANT  EXECUTE ON FUNCTION admin_confirm_menu_scan TO service_role;
```

Update `apps/admin/src/app/(admin)/menu-scan/actions/menuScan.ts`:
```ts
export const adminConfirmMenuScan = withAdminAuth(async (ctx, jobId, payload) => {
  const service = createAdminServiceClient();
  const { data, error } = await service.rpc('admin_confirm_menu_scan', {
    p_job_id: jobId,
    p_admin_id: ctx.userId,
    p_payload: payload,
  });
  if (error || !data) return { ok: false, formError: error?.message ?? 'CONFIRM_FAILED' };
  // ... audit log + revalidate
  return { ok: true, data };
});
```

This is roughly two-thirds extraction of existing logic into PL/pgSQL plus one-third new modifier-insert logic.

## 3. Phase 4b: menu-scan review UI rewrite

**New file:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/ModifierGroupsEditor.tsx`

Replaces `VariantEditor.tsx` + `CourseEditor.tsx` with one editor. Structure (mirrors `CourseEditor` shape but flatter):

```tsx
interface Props {
  parent: EditableDish;
  saving: boolean;
  onAddGroup: () => void;
  onRemoveGroup: (idx: number) => void;
  onMoveGroup: (from: number, to: number) => void;
  onUpdateGroup: (idx: number, patch: Partial<EditableModifierGroup>) => void;
  onAddOption: (groupIdx: number) => void;
  onRemoveOption: (groupIdx: number, optIdx: number) => void;
  onMoveOption: (groupIdx: number, from: number, to: number) => void;
  onUpdateOption: (groupIdx: number, optIdx: number, patch: Partial<EditableModifierOption>) => void;
}
```

Per group: name input, selection_type select, min_selections + max_selections inputs. Per option: name, price_delta, optional price_override, primary_protein dropdown, dietary-tag-removes checkboxes, allergen-adds checkboxes, is_default checkbox.

**File:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts`

Major rewrite:
- Drop `applyAddVariant`, `applyRemoveVariant`, all `applyAddCourse`/`applyAddCourseItem`/`applyMoveCourse` etc.
- Drop `applySetKind` (no more kind → is_parent/prefix mapping).
- Add: `applyAddModifierGroup`, `applyRemoveModifierGroup`, `applyMoveModifierGroup`, `applyUpdateModifierGroup`, `applyAddModifierOption`, `applyRemoveModifierOption`, `applyMoveModifierOption`, `applyUpdateModifierOption`.
- `EditableDish` shape: drop `is_parent`, `parent_id`, `variants`, `courses`. Add `modifier_groups: EditableModifierGroup[]`, `dining_format`, `bundled_items`.

**File:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`

- Drop the `dish_kind` select control.
- Add `dining_format` select (rarely set; null is default).
- Add `bundled_items` editor (collapsible).
- Replace variant + course editors with single `<ModifierGroupsEditor>`.
- Group-by-menu-category logic unchanged.

**File:** `apps/admin/src/app/(admin)/menu-scan/actions/confirmSchema.ts`

Drop: `DISH_KINDS` constant, `dish_kind`, `variant_dishes`, `courses`, `reviewedCourseSchema`, `reviewedCourseItemSchema`, `is_parent`.
Add: `reviewedModifierGroupSchema`, `reviewedModifierOptionSchema`, `dining_format`, `bundled_items` on `reviewedDishSchema`.

## 4. Restaurant detail dish editor

**File:** `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

- Drop the `dish_kind` select.
- Drop the read-only variants/courses sublists.
- Add a read-only modifier-groups display (collapsed by default).
- Add `dining_format` select.

**File:** `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts`

- `adminUpdateDish`: accept `dining_format`, `bundled_items`, `available_*` fields in patch.
- `adminCreateDish`: same; drop `dish_kind` from required fields (deprecated but accepted during transition).
- **New action `adminUpdateDishModifiers(dishId, groups[])`**: replaces the dish's modifier groups + options atomically. Implemented as an RPC `admin_replace_dish_modifiers` — defined in migration 144 alongside `admin_confirm_menu_scan` (same SECURITY INVOKER + service_role grant pattern, see §2). Body: validate caller-supplied groups[], `DELETE FROM option_groups WHERE dish_id = p_dish_id`, then re-insert; single transaction, ROLLBACK on failure.

**File:** `apps/admin/src/app/(admin)/restaurants/[id]/AddDishButton.tsx`

- Drop `is_parent: false`, `is_template: false` defaults.
- Drop `dish_kind` form field.
- New dish defaults: `modifier_groups: []`, `bundled_items: null`, `dining_format: null`.

**File:** `apps/admin/src/lib/auth/dal.ts`

`getAdminRestaurantMenus` query: select alongside existing `option_groups(*, options(*))` join — but the new columns appear automatically once Phase 1 lands.

## 5. Tests

- Rename `__tests__/menu-scan/confirm-multi-kind.test.ts` → `confirm-modifier-groups.test.ts`. New cases:
  - Classic (no modifiers)
  - Pad Thai (one required_single group with 4 options)
  - Caesar (one optional_multi group with 2 options)
  - Build-your-own bowl (multi-group)
  - Tasting menu (dining_format='course_menu' + sequential required_single groups)
  - Tiered wings (price_override on one option)
- Rewrite `__tests__/menu-scan/useReviewState.test.ts` for new helpers.
- New `__tests__/menu-scan/admin-confirm-rpc.test.ts`: test the RPC's transactional behaviour (insert ALL or NONE on failure).
- Existing `replay-menu-scan.test.ts` unchanged.

## 6. Acceptance criteria

- Admin scans a Pad Thai menu → sees modifier groups in review UI → confirms → RPC succeeds → modifier rows exist in DB.
- Confirm action: simulated failure mid-insert leaves DB unchanged (no orphan rows).
- Existing parent/variant rows display correctly in restaurant detail page (legacy compatibility).
- All admin tests pass.

## 7. Effort: 6–7 days

1d §1 test infra, 1.5d confirm RPC, 2d ModifierGroupsEditor + useReviewState rewrite + tests, 1d ReviewDishEditor restructure, 1d restaurant detail editor, 0.5–1d test updates.
