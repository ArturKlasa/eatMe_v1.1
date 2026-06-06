# Phase 6 — Data migration

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Scoped — reconciled against live schema + a prod census on 2026-06-05. Ready for dry-run.
**Last updated:** 2026-06-05
**Estimated wall time:** ~1.5 days (was 4 — see §0)
**Reversibility:** ⚠ The *drop* step (Migration 159) is a destructive cutover — run only after the conversion (158) is audited and readers are confirmed on the new shape. The *conversion* (158) is auditable via a dry-run harness that rolls back until a commit flag is flipped.

> **This section was rewritten on 2026-06-05 as part of the dish-model rewrite.** The original 2026-05-17 draft is preserved in git history. It is materially stale: it predates the allergen/dietary abandonment (migrations 155/156), the portion/currency/timezone migrations that consumed numbers 145–150, and a prod data census. Everything below is the reconciled, executable plan.

Convert the remaining legacy parent/variant rows into the modifier model, then drop the legacy columns + tables. Course-menu and template conversions are **no-ops** (zero data). All allergen/dietary heuristics are **removed** (the target columns no longer exist).

---

## 0. What changed since the 2026-05-17 draft

| Original draft said | Reconciled reality (2026-06-05) | Consequence |
|---|---|---|
| Migrations numbered **145–150** | All consumed (145/146 portion, 147 currency, 148 oz, 149 timezone, 150 currency-candidates); last is **157** | Conversion = **158**, gated drop = **159**. |
| Mig 145 §5–6 derive `removes_dietary_tags` + `adds_allergens` on `options` via sibling heuristics; uses a `_mig145_source_variant_id` tracking column | Those `options` columns were **dropped** (mig 156, allergen abandonment). `dishes.allergens` / `dietary_tags` also dropped. | 🔴 **Delete §5, §6, Steps 1 & 9 (tracking column), and the whole "data carries dietary truth" design note.** Conversion is now purely structural. |
| Mig 147 converts `dish_courses` → `option_groups` | Census: `dish_courses` = **0**, `dish_course_items` = **0** | **Delete Mig 147.** Tables drop empty in 159. |
| `is_template` handling | Census: **0** templates | No handling — just drop the column in 159. |
| Mig 149 sets `enrichment_status = 'pending'` to re-embed | In the *current* system `'pending'` re-embeds nothing: the recovery cron (mig 133) only re-embeds `'pending'/'failed'` rows where `embedding IS NULL` (converted dishes already have embeddings), and `batch-embed.ts` only targets `'none'/'failed'`. | Use **`'none'`**, then run `batch-embed.ts`. |
| Group name hardcoded `"Choose your option"` (English) | Menus are Spanish; only 3 supported languages (`en/es/pl`) | **Option 2 (source-language generic)**: name in the restaurant's language via the `COUNTRY_TO_LANGUAGE` map (`es` → "Elige una opción", `pl` → "Wybierz opcję", else "Choose an option"). |
| Mig 150 drops `price_per_person` | Still exists; **live callers** in `infra/supabase/functions/feed/index.ts` + `apps/mobile/src/stores/restaurantStore.ts` | Swap callers **before** the drop (§5). |
| `generate_candidates` filters to remove | Confirmed still present (post-155 def): `is_parent = false` (line 140), `is_template = false` (line 143), plus the EXISTS subquery (line 324) | Remove in 159, as planned. |

## 1. Census (prod, read-only, 2026-06-05)

```
parents by kind (WHERE is_parent):   configurable 126 · standard 6 · bundle 3   → 135 parents
variant children (parent_dish_id NOT NULL):                                   244
  └─ by parent kind:  configurable 222 · standard 18 · bundle 4
dish_courses / dish_course_items:                                             0 / 0
is_template:                                                                  0
```

## 2. The `standard` + `is_parent` anomaly → re-tag (not junk)

6 dishes are `dish_kind='standard'` yet `is_parent=true` (18 children). Inspection (query B) shows they are **mis-tagged configurables** — Spanish seafood with `price=0.00` and 3 size children each (Chico/Mediano/Grande):

```
Calamar · Pescado · Campechano · Pulpo · Ostión · Camarón
```

Left as-is they would fall through both conversion filters and then be orphaned by the `DROP COLUMN parent_dish_id` — their children would leak into the consumer feed as loose `standard` dishes. **Fix:** re-tag `standard`→`configurable` as Step 0 of Migration 158 (`WHERE is_parent AND dish_kind='standard'` hits exactly these 6); they then flow through the configurable path. After re-tag: **132 configurable** parents (240 children) + **3 bundle** parents (4 children).

## 3. Migration 158 — conversion (DRY-RUN FIRST)

Dry-run harness: **`infra/supabase/dry-runs/phase6-data-conversion.dryrun.sql`** — wraps the full conversion in one transaction, prints FK introspection + before/after counts + a per-dish CSV (base price, options, deltas), and ends in `ROLLBACK`. Promote to `migrations/158_*.sql` (flip `ROLLBACK`→`COMMIT`) only after audit.

Steps (all inside one transaction):

0. **Re-tag** the 6 anomalies `standard`→`configurable` (§2).
1. **Configurable → `option_groups` + `options`** (only for parents that have ≥1 child — no empty groups):
   - one `option_groups` row per parent: `selection_type='single'`, `min=max=1`, source-language name (Option 2), `display_in_card=false`.
   - one `options` row per child: `price_delta = child.price − MIN(sibling.price)`, `is_default = (cheapest)`, `display_order = price rank`, `primary_protein = child protein **only when it differs** from the parent` (`NULL` for pure size variants — keeps the override semantics clean).
   - set parent `price = MIN(child.price)`, `display_price_prefix = 'from'`.
2. **Bundle → `bundled_items`**: `jsonb_agg({name, note:null})` from children onto the parent.
3. **Dining format**: `dining_format='buffet'` where `dish_kind='buffet'`; `='course_menu'` where `dish_kind='course_menu'` (defensive — catches any stray tagged rows even though course *data* is empty).
4. **Queue re-embed**: `enrichment_status='none'` on every converted parent (§4).
5. **Delete** configurable + bundle children (their data now lives in options / bundled_items), **then set `is_parent=false` on the converted parents** so `generate_candidates` (which excludes `is_parent=true`) surfaces them immediately — this closes what would otherwise be a feed blackout for all 135 dishes in the window between 158 and 159. (The `is_parent` column is still dropped in 159; this just sets the right value in the interim. Childless-configurable parents stay `is_parent=true` and flagged.)

**Audit (printed by the dry-run before the deletes, so it shows even if a delete hits an FK):**
- FK constraints referencing `dishes` (so you see what deleting children touches — favorites especially).
- per-dish CSV: `name, base_price, prefix, n_options, [{opt, delta, default, protein}]`.
- flags: configurable parents with 0 children; children with `NULL` price (delta = NULL).
- before/after row counts: dishes, parents, variant_children, option_groups, options.

## 4. Re-enrichment

Converted parents change meaning (e.g. the 6 seafood containers go from `price 0` hidden parents to real "from $X" dishes). After 158 commits: they're already `enrichment_status='none'` (Step 4) → run `infra/scripts/batch-embed.ts` (targets `'none'/'failed'`) to regenerate embeddings. Monitor until all are `'completed'`.

## 5. `price_per_person` caller swap — pure deletion (partly done)

`price_per_person` is a **generated column** (`CASE WHEN serves > 0 THEN ROUND(price/serves,2) ELSE price END`, mig 073) that is **never rendered** — it's selected/forwarded but unused downstream. The original plan's "`effective_price / effective_serves`" replacement was a misnomer: `effective_serves` does not exist, and `effective_price` is already computed inside feed from option deltas. So this is a straight removal, no replacement:

- ✅ `infra/supabase/functions/feed/index.ts` — removed from the candidate-row type + the response forward.
- ✅ `apps/mobile/src/stores/restaurantStore.ts` — removed from the dish SELECT.

Safe to ship independently (the column still exists; nothing read the value). `generate_candidates` keeps emitting it harmlessly until the coordinated drop (§6). ⚠ Re-run the mobile type-check / on-device smoke after this select change.

## 6. The drop is a COORDINATED cutover (not a standalone 159)

Dependency analysis (2026-06-05) — the original plan under-scoped this. Three of the five doomed columns (`dish_kind`, `parent_dish_id`, `price_per_person`) live in **`generate_candidates`'s output signature** and flow feed→mobile; `is_parent`/`is_template` are in filter predicates *and* `admin_confirm_menu_scan`'s still-present legacy branch. Postgres won't block the `DROP` for function bodies (it doesn't dep-track them), but every reader breaks at runtime — so the drop must ship **atomically** with these rewrites. No blocking views exist (verified).

**DB function rewrites (all inside the drop migration):**

| Function | Current def | Change | Size |
|---|---|---|---|
| `generate_candidates` | mig 155 | **DROP + CREATE** (signature change): remove `dish_kind`/`parent_dish_id`/`price_per_person` from RETURN TABLE + SELECT (lines 100/114/116, 205/232/234); remove `is_parent=false`/`is_template=false` filters (288–289, 489–490). | ≈340 ln |
| `admin_confirm_menu_scan` | mig 155 | Remove the legacy `is_parent` parent→variant→course branch (≈ 882–1000) incl. the `dish_courses` insert; drop `dish_kind`/`is_parent`/`parent_dish_id`/`is_template` from the flat INSERT. (Current admin UI sends only flat payloads — the legacy branch is already dead.) | ≈450 ln |
| `get_group_candidates` | mig 143 | Remove `is_parent=false`/`is_template=false` from the EXISTS subquery (110/113). | 2-line cut |
| `embed_recovery_cron` fn | mig 133 | Remove `is_parent=false`/`is_template=false` (59–60). | 2-line cut |

**Consumer rewrites (ship together):**

| Consumer | Change |
|---|---|
| `feed/index.ts` | remove `dish_kind` forward (940) + the `parent_dish_id` `applyDiversity` cap (569–573). `price_per_person` already removed (§5). |
| mobile `restaurantStore.ts` | drop `dish_kind`/`parent_dish_id`/`is_parent` from the SELECT (326–327). |
| mobile `DishPhotoModal.tsx` + `RestaurantDetailScreen.tsx` | the `dish_kind` `KIND_BADGE` (DishPhotoModal:216) → drive off `dining_format` or drop the badge. |
| admin `dal.ts:720` | remove the `dish_courses`/`dish_course_items` read (empty tables, about to drop). |

**Then** the drops:

```sql
DROP TABLE IF EXISTS dish_course_items;
DROP TABLE IF EXISTS dish_courses;
ALTER TABLE public.dishes
  DROP COLUMN dish_kind, DROP COLUMN parent_dish_id,
  DROP COLUMN is_parent, DROP COLUMN is_template, DROP COLUMN price_per_person;
```
Regenerate `@eatme/database` types.

**Recommendation:** fold this column drop into **Phase 7**, or run it as Phase 7's first migration — the consumer cleanup (DishGrouping.ts, applyDiversity parent logic, `dish_kind` shims/badge) is already on the Phase 7 list, and the drop is inseparable from it. The two large function rewrites should each be reproduced from their current body and validated on a replica (same dry-run discipline as 158) before promotion — not hand-authored blind.

## 7. Documentation updates (concurrent)

- `/CLAUDE.md` — replace "Dish Kind — Composition Type" with a "Dishes + Modifier Groups + Dining Format" section.
- `/agent_docs/architecture.md`, `/agent_docs/database.md`, `/agent_docs/terminology.md` — drop `dish_kind`/parent/variant/course terms; add `dining_format`, modifier groups, `bundled_items`.
- `/docs/project/06-database-schema.md`, `04-web-portal.md`, `05-mobile-app.md`.

## 8. Acceptance criteria

- Before/after counts captured (dishes ↓244, option_groups ↑132, options ↑240, bundled_items set on 3).
- No orphans: `SELECT count(*) FROM options o WHERE NOT EXISTS (SELECT 1 FROM option_groups g WHERE g.id=o.option_group_id)` = 0.
- No data loss: every former variant name appears as an option (or bundled_item) name.
- No NULL-price options unaccounted for (audit flag cleared or consciously accepted).
- All converted dishes reach `enrichment_status='completed'`.
- Feed sanity: spot-check the 6 seafood dishes + a sample of the 126 — base price = cheapest size, deltas correct, single feed entry per parent.
- 159 runs clean (no FK errors → confirms children fully removed).
- Docs updated (§7).

## 9. Effort: ~1.5 days

0.5d dry-run audit on a replica + the 6-row sanity check · 0.5d execute 158 + re-embed + §5 caller swap · 0.5d gated 159 + `generate_candidates` + docs.
