# Dish portion size — extraction, storage, display

**Created:** 2026-05-24
**Status:** Planned, not started
**Owner:** Solo (Artur)
**Trigger:** Many menus already write portion size into dish names / descriptions
(`Burger 250g`, `Beer 0.5L`, `Pierogi 6 szt.`). Today it lives only in free text — let's
lift it to a structured field so we can render it cleanly on mobile and (later) filter on it.

## Goal

Add a single optional portion-size signal to dishes — extracted by the menu-scan AI from
text it already sees, editable in the admin portal, and shown inline next to the price on
mobile (`250g · $12.00`).

## Scope

**In:**
- DB column pair `portion_amount integer` + `portion_unit text` (enum `g`/`ml`/`pcs`).
- AI extraction of grams, millilitres, and piece counts from dish name+description.
- Admin form input (amount + unit dropdown) in both the inline dish editor and the
  menu-scan review screen.
- Mobile render inline with the price, with localized unit labels (en/es/pl).

**Out (deferred until there's a real need):**
- Filtering / sorting by portion size in the mobile feed.
- Personal preference ("show only ≥ 300g mains").
- Backfill of existing dishes — too noisy to mine retroactively without the original
  menu source; rely on natural turnover via re-scans + manual edits.
- Inferring portion from "small/medium/large" labels (kept explicit only).

## Locked design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Column shape | `portion_amount integer` + `portion_unit text` | Two narrow columns beat JSONB — easier to validate, index, query, and migrate later. |
| Unit enum | `g`, `ml`, `pcs` | Covers the three common menu conventions. Drop `kg`/`L` — AI normalizes to base units. |
| Both-or-neither | CHECK enforces both null or both non-null + amount > 0 | Prevents half-filled rows. |
| Decimal handling | `integer` (no decimals) | `1.5kg → 1500g`, `0.5L → 500ml`. Pieces are always whole. |
| Range handling | Return `null` when menu shows a range ("200–250g") | Avoid false precision. |
| Vague terms | Return `null` for "small/medium/large", "regular", "house portion" | Same — only extract when explicit. |
| Mobile placement | Inline with price: `250g · $12.00` | Treats portion as price context. Lowest visual footprint. |
| i18n | `pcs` becomes `szt.` (pl) / `uds.` (es); `g` and `ml` are universal | Locale keys under `restaurant.portionUnit.*`. |

## Known-unknowns resolved during planning

These were flagged in the original plan as "verify before implementing" — checked and answered:

| Unknown | Answer |
|---|---|
| Where does menu-scan actually write to `dishes`? | NOT in the worker. The Postgres RPC `admin_confirm_menu_scan` (defined in migration 144) does it via 3 `INSERT INTO public.dishes` statements (lines 397, 423, 481). Only the third is reachable from the current Zod schema; the other two are legacy `is_parent: true` paths kept for back-compat. We'll update all three for symmetry. |
| Is there a Zod gate before the RPC? | Yes — `reviewedDishSchema` in `apps/admin/src/app/(admin)/menu-scan/actions/confirmSchema.ts:84-99`. Must add fields here too or the payload gets rejected before reaching the DB. |
| Does `adminUpdateDish` accept unknown keys? | No. It uses `adminDishUpdateSchema` (Zod) + an explicit allow-list builder (`apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts:134-212`). Unknown keys are silently stripped. Must extend both. |
| Mobile dish query — `select('*')` or allow-list? | Allow-list. `apps/mobile/src/stores/restaurantStore.ts:319-343` explicitly names every column. New columns will NOT auto-flow — must be added to the select string. |
| How to express "both set or both null" in Zod? | `.superRefine()` — neither `menuScan.ts` nor `dish.ts` currently uses `.refine()`, but it's the natural place. Apply at schema level after the field declarations. |

## Implementation playbook

4 atomic commits, sequenced so the system is never broken mid-rollout. Each commit is independently revertable.

### Pre-flight (no code changes, ~5 min)

```bash
cd /home/art/Documents/eatMe_v1
git status                  # confirm clean tree on main
git pull --ff-only          # sync with origin
supabase --version          # confirm CLI present for type-regen
turbo check-types           # establish a clean baseline
```

If `check-types` fails before we start, stop and fix that first — we need a known-good baseline to compare against.

---

### Commit 1 — `feat(db): add portion_amount + portion_unit to dishes`

**Touches:** 3 files (2 new migrations + 1 regenerated types file).

**1. Create `infra/supabase/migrations/145_dishes_portion_size.sql`:**

```sql
-- 145_dishes_portion_size.sql
-- Created: 2026-05-24
--
-- Add portion_amount + portion_unit columns to dishes.
-- Lets the menu-scan AI extract explicit portions (250g, 0.5L, 6 szt.) into
-- structured fields, rendered on mobile next to the price.
--
-- Both columns must be set together or both null — enforced by CHECK.

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS portion_amount integer NULL,
  ADD COLUMN IF NOT EXISTS portion_unit   text    NULL;

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_portion_unit_valid
    CHECK (portion_unit IS NULL OR portion_unit IN ('g', 'ml', 'pcs')),
  ADD CONSTRAINT dishes_portion_both_or_neither
    CHECK (
      (portion_amount IS NULL AND portion_unit IS NULL)
      OR (portion_amount IS NOT NULL AND portion_unit IS NOT NULL AND portion_amount > 0)
    );

COMMENT ON COLUMN public.dishes.portion_amount IS
  'Portion size value in base units (grams, millilitres, or piece count). NULL when not on menu.';
COMMENT ON COLUMN public.dishes.portion_unit IS
  'Unit for portion_amount: g | ml | pcs. NULL when not on menu.';

COMMIT;
```

**2. Create `infra/supabase/migrations/145_REVERSE_ONLY_dishes_portion_size.sql`:**

```sql
BEGIN;
ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_portion_both_or_neither;
ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_portion_unit_valid;
ALTER TABLE public.dishes DROP COLUMN IF EXISTS portion_unit;
ALTER TABLE public.dishes DROP COLUMN IF EXISTS portion_amount;
COMMIT;
```

**3. Create `infra/supabase/migrations/146_admin_confirm_menu_scan_portion_size.sql`:**

`CREATE OR REPLACE FUNCTION public.admin_confirm_menu_scan(...)` re-creating the function from migration 144 with two added columns in **all three** dish `INSERT` statements (lines 397, 423, 481). The added columns + values are identical at each call site:

```sql
-- In each INSERT INTO public.dishes (...) column list, append:
,
portion_amount, portion_unit

-- In each VALUES (...) list, append:
,
NULLIF(v_dish->>'portion_amount', '')::integer,
NULLIF(v_dish->>'portion_unit',   '')
```

(For the variant path use `v_variant` instead of `v_dish`.)

This is by far the longest file change — the migration must include the entire ~570-line function body verbatim with just those two columns added to each INSERT. I'll generate it by copying 144's body and patching the three INSERTs.

**4. Apply locally + regen types:**

```bash
# Apply migrations (use whichever the repo uses — supabase push or psql)
supabase db push

# Regenerate database types
supabase gen types typescript --linked > packages/database/src/types.ts

# Verify
turbo check-types
```

Expect: `dishes.Row` / `Insert` / `Update` in `packages/database/src/types.ts` now include `portion_amount: number | null` and `portion_unit: string | null`. No type errors elsewhere (the columns are optional everywhere they appear, so existing code compiles unchanged).

**5. Commit:**

```bash
git add infra/supabase/migrations/145* infra/supabase/migrations/146* packages/database/src/types.ts
git commit -m "feat(db): add portion_amount + portion_unit to dishes"
git push origin main
```

---

### Commit 2 — `feat(menu-scan): extract portion size from dish text`

**Touches:** 4 files (1 worker file with prompt + schema, 2 shared validation schemas, 1 admin Zod schema).

**1. `infra/supabase/functions/menu-scan-worker/index.ts`:**

- Add to `menuExtractionDishSchema` (lines 84-124), after `confidence`:
  ```ts
  portion_amount: z.number().int().positive().nullable(),
  portion_unit: z.enum(['g', 'ml', 'pcs']).nullable(),
  ```
- Add `.superRefine()` after the object to enforce both-or-neither (one-time pattern; the existing schemas have no `.refine` to copy from).
- Add to the extraction prompt (after the `suggested_dish_category` instruction, before "After extracting all dishes"):
  ```
  - portion_amount + portion_unit: explicit portion size shown on the menu.
    Extract ONLY when explicitly visible in the dish name or description.
    Normalize to base units:
      "250g" / "250 g"             → {amount: 250,  unit: "g"}
      "1.5kg" / "1,5 kg"           → {amount: 1500, unit: "g"}
      "0.5L" / "500ml"             → {amount: 500,  unit: "ml"}
      "6 pcs" / "6 szt." / "6 uds" → {amount: 6,    unit: "pcs"}
    Return BOTH null when:
      - no size is shown
      - size is a range ("200–250g")
      - size is vague ("small", "medium", "large", "regular", "house portion")
      - size refers to a garnish or side note, not the dish itself
  ```
- **No insert/upsert change needed** — the worker doesn't write to `dishes`. It just returns the extraction; persistence happens later via `admin_confirm_menu_scan`.

**2. `packages/shared/src/validation/menuScan.ts`:**

Mirror the worker schema change exactly (the two files are kept in lockstep).

**3. `packages/shared/src/validation/dish.ts`:**

Add to `dishSchemaV2` (after the availability block, before `dish_kind`):
```ts
portion_amount: z.number().int().positive().nullable().optional(),
portion_unit: z.enum(['g', 'ml', 'pcs']).nullable().optional(),
```
Add `.superRefine()` at the schema tail for both-or-neither.

**4. `apps/admin/src/app/(admin)/menu-scan/actions/confirmSchema.ts`:**

- Add to `ReviewedDish` type (lines 67-82): `portion_amount: number | null; portion_unit: 'g' | 'ml' | 'pcs' | null;`
- Add to `reviewedDishSchema` (lines 84-99):
  ```ts
  portion_amount: z.number().int().positive().nullable().default(null),
  portion_unit: z.enum(['g', 'ml', 'pcs']).nullable().default(null),
  ```
- Add `.superRefine()` for both-or-neither.

**5. Verify + commit:**

```bash
turbo check-types
turbo lint
git add -A
git commit -m "feat(menu-scan): extract portion size from dish text"
git push origin main
```

After this commit, **the menu-scan flow is internally consistent end-to-end** — the AI extracts portion, it passes through validation, the RPC persists it. Just no UI to set/see it yet, so nobody knows.

---

### Commit 3 — `feat(admin): edit portion_amount + portion_unit on dishes`

**Touches:** 4 files (1 dish-edit action, 1 inline editor, 1 review editor, 1 review state hook).

**1. `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts`:**

- Extend `adminDishUpdateSchema` (lines 134-146):
  ```ts
  portion_amount: z.number().int().positive().nullable().optional(),
  portion_unit: z.enum(['g', 'ml', 'pcs']).nullable().optional(),
  ```
  Add `.superRefine()` for both-or-neither.
- Extend the `updatePayload` builder (lines 200-212), pairing the two — emit them together to keep the DB constraint satisfied:
  ```ts
  if (d.portion_amount !== undefined || d.portion_unit !== undefined) {
    updatePayload.portion_amount = d.portion_amount ?? null;
    updatePayload.portion_unit   = d.portion_unit   ?? null;
  }
  ```

**2. `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`:**

- Add `portion_amount` + `portion_unit` to the `draft` state shape.
- Add a paired control to the JSX. Concrete layout (slots next to the name+price grid):
  ```tsx
  <div className="flex items-center gap-1">
    <input
      type="number"
      value={draft.portion_amount ?? ''}
      min="1"
      step="1"
      onChange={e => {
        const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
        setDraft({
          ...draft,
          portion_amount: v,
          portion_unit: v === null ? null : (draft.portion_unit ?? 'g'),
        });
      }}
      placeholder="size"
      className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
    />
    <select
      value={draft.portion_unit ?? ''}
      disabled={draft.portion_amount == null}
      onChange={e => setDraft({ ...draft, portion_unit: e.target.value as 'g' | 'ml' | 'pcs' })}
      className="rounded-md border border-input bg-background px-1 py-1 text-sm"
    >
      <option value="g">g</option>
      <option value="ml">ml</option>
      <option value="pcs">pcs</option>
    </select>
  </div>
  ```
- Extend the patch-builder block (around lines 200-205 of the save handler):
  ```ts
  if (draft.portion_amount !== dish.portion_amount || draft.portion_unit !== dish.portion_unit) {
    patch.portion_amount = draft.portion_amount;
    patch.portion_unit = draft.portion_unit;
  }
  ```

**3. `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts`:**

- Add `portion_amount: number | null; portion_unit: 'g' | 'ml' | 'pcs' | null;` to `EditableDish` (lines 77-94).

**4. `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`:**

- Extend `asEditable()` (lines 62-143) — pass through:
  ```ts
  portion_amount: d.portion_amount ?? null,
  portion_unit: d.portion_unit ?? null,
  ```
- Extend the confirm payload (lines 458-492, inside `activeDishes.map`):
  ```ts
  portion_amount: d.portion_amount,
  portion_unit: d.portion_unit,
  ```
- Add the same paired control as in DishRowEditor.

**5. Verify + commit:**

```bash
turbo check-types
turbo lint
cd apps/web-portal && npx vitest run   # confirms existing test suite still green
cd /home/art/Documents/eatMe_v1
git add -A
git commit -m "feat(admin): edit portion_amount + portion_unit on dishes"
git push origin main
```

**Manual smoke test before moving to Commit 4:**
1. Run a menu scan on a Polish/German menu with explicit weights → review screen shows extracted values.
2. Edit an existing dish → set `250 g` → save → reload → still `250 g`.
3. Clear the amount on an edited dish → unit clears too → saves as both null.

---

### Commit 4 — `feat(mobile): show portion size next to price`

**Touches:** 3 files (mobile dish query, 3 locale files, dish menu item).

**1. `apps/mobile/src/stores/restaurantStore.ts`:**

- In the dish select string (lines 324-325 area), add `portion_amount, portion_unit` next to the `primary_protein, dining_format, bundled_items` group:
  ```ts
  primary_protein, dining_format, bundled_items,
  portion_amount, portion_unit,
  available_days, available_hours_start, available_hours_end,
  ```

**2. `apps/mobile/src/locales/en.json`** — under `restaurant`:
```json
"portionUnit": {
  "g": "g",
  "ml": "ml",
  "pcs": "pcs"
}
```

**3. `apps/mobile/src/locales/pl.json`** — under `restaurant`:
```json
"portionUnit": {
  "g": "g",
  "ml": "ml",
  "pcs": "szt."
}
```

**4. `apps/mobile/src/locales/es.json`** — under `restaurant`:
```json
"portionUnit": {
  "g": "g",
  "ml": "ml",
  "pcs": "uds."
}
```

**5. `apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx`:**

After the existing `priceLabel` switch (around line 47), insert:

```tsx
const portionLabel =
  item.portion_amount != null && item.portion_unit
    ? `${item.portion_amount}${item.portion_unit === 'pcs' ? ' ' : ''}${t(`restaurant.portionUnit.${item.portion_unit}`)}`
    : null;
const fullPriceLabel = portionLabel ? `${portionLabel} · ${priceLabel}` : priceLabel;
```

Replace the existing `<Text style={styles.menuItemPrice}>{priceLabel}</Text>` (line 80) with `{fullPriceLabel}`.

(The space-before-unit for `pcs` is intentional: `250g` reads better tight, but `6 pcs` / `6 szt.` needs the gap.)

No style additions — `menuItemPrice` already exists and works.

**6. Type adjustment** — `DishWithGroups` extends generated `Dish`. After Commit 1's type regen the new fields are already in `Dish`, so no change needed here.

**7. Verify + commit:**

```bash
turbo check-types
cd apps/mobile && npx expo prebuild --clean   # only if native deps changed (they didn't here)
cd /home/art/Documents/eatMe_v1
git add -A
git commit -m "feat(mobile): show portion size next to price"
git push origin main
```

**Manual smoke test on mobile:**
1. Open a restaurant whose menu includes dishes with portion info → see `250g · $12.00` style on cards.
2. Switch device locale to Polish → `6 szt. · $9.00` for piece-count dishes.
3. Confirm dishes without portion still render `$12.00` cleanly.

---

## Sequencing & safety

- **Each commit leaves the system in a usable state.** After Commit 1 the new columns exist and the RPC writes them when present, but no caller populates them — `(null, null)` everywhere is correct and the CHECK constraint passes. After Commit 2 new menu scans capture portion data into the DB. After Commit 3 operators can see/edit. After Commit 4 consumers see it.
- **Rollback strategy:** any commit reverts cleanly except Commit 1 (the migration). To roll back the DB, apply the `145_REVERSE_ONLY` migration and revert the 146 RPC migration by re-applying 144.
- **No blocking long-running queries** — the `ALTER TABLE ADD COLUMN ... NULL` with no default doesn't rewrite the table on Postgres 11+. The CHECK constraints validate against an empty (null,null) set, instant.

## Acceptance criteria

- [ ] Re-running menu scan on a sample menu with explicit weights (`Burger 250g`, `Beer 0.5L`, `Pierogi 6 szt.`) populates `portion_amount` + `portion_unit` correctly and leaves dishes without explicit sizing as `(null, null)`.
- [ ] Admin operator can change the values; saving persists them and the row reflects the new values on reload.
- [ ] Mobile dish card shows `250g · $12.00` when both fields are set, and falls back to `$12.00` cleanly when either is null.
- [ ] Polish and Spanish locales render `szt.` and `uds.` respectively for `pcs`.
- [ ] `turbo check-types` and existing Vitest suite both pass after each commit.
- [ ] CHECK constraint blocks any half-filled write (verified by attempting to save just an amount in the admin form — should not be possible because the UI pairs them; but if it slips through, the DB rejects it).

## Risks tracked

- **Prompt accuracy on noisy menus.** First runs may surface AI mistakes (mistaking serving suggestions for portions, picking up garnish weights, etc.). Plan to spot-check the first menu scan after deployment and tighten the prompt with concrete negative examples if needed.
- **Migration 146 is a verbatim copy of 144's RPC body with two-column delta.** Risk of drift if 144 changes later. Mitigated by the migration 146 file having a clear header noting "this is migration 144 + portion_size delta — when next changing this RPC, base on 146 not 144".

## Cross-references

- Precedent for "AI-extracted enum column": `infra/supabase/migrations/110_primary_protein.sql`
  + the matching prompt instructions in `menu-scan-worker/index.ts`. Same pattern, same shape.
- Recent precedent for "additive optional column pair on dishes":
  `infra/supabase/migrations/141_dishes_dining_format_and_availability.sql`.
