# Menu-scan cleanup: drop placeholder descriptions, strip portion text, add `oz`

**Date:** 2026-05-30
**Surface:** admin web-portal menu scan (`apps/admin/`) → `menu-scan-worker` Edge Function
**Status:** planned

## Goals

Three independent fixes to the AI menu-scan pipeline, all observed in the admin portal:

1. **Empty descriptions come back as `"."`** — the model emits a placeholder dot instead of `null`. Empty descriptions must store/show as empty.
2. **Portion text is duplicated** — when the scanner lifts a size into `portion_amount`/`portion_unit`, the same text ("250g", "0.5L") stays in the dish name/description. It must be removed from name/description once structured.
3. **Add `oz` (ounces)** as a fourth portion unit, extracted as-is (US/UK menus: "8 oz steak"). Unlike kg/L, ounces are NOT converted to a metric base — there's no way to keep the imperial label otherwise.

## Background / root cause

The admin portal's only scan path is the Deno Edge Function
`infra/supabase/functions/menu-scan-worker/index.ts`. It calls OpenAI with a
prompt + Zod structured-output schema, then writes the parsed result straight to
`complete_menu_scan_job` with **no post-processing** (`index.ts:549-554`).

- The schema's `description: z.string().nullable()` accepts `"."` as valid → Problem 1 survives to the DB.
- The prompt extracts portion size (`index.ts:202-214`) but never tells the model to remove it from name/description → Problem 2.
- `portion_unit` is `z.enum(['g','ml','pcs'])` in 6 code locations + a DB CHECK constraint → Problem 3 is a sweep + migration.

The legacy `apps/web-portal/app/api/menu-scan/route.ts` has **no** portion handling and is not on the admin path — out of scope. `supabase/` is a symlink to `infra/supabase/` (single migrations dir). Generated `packages/database/src/types.ts` already types `portion_unit` as `string | null` — no change needed.

No backfill of existing scanned dishes (consistent with migration 145's stance): fixes apply to future scans; operators can edit existing rows, or re-scan.

---

## Problem 1 — placeholder `"."` description

### 1a. Prompt instruction (defense in depth)
`infra/supabase/functions/menu-scan-worker/index.ts:200`

Before:
```
- description: brief description if shown, otherwise null
```
After:
```
- description: brief description if shown. Output null when there is no
    description — never output a placeholder such as ".", "-", or "N/A".
```

### 1b. Defensive normalizer (the guaranteed fix)
Add a helper near the other worker helpers, and apply it at the single
persistence chokepoint in `runExtraction` (`index.ts:435-437`).

Helper:
```ts
// Normalize an AI-emitted free-text field: trim, drop a leading stray
// punctuation token (the model sometimes emits "." / "- " as a placeholder
// for an absent value), and collapse empty / punctuation-only strings to null.
function normalizeText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim().replace(/^[.\-–—·•]+\s*/, '').trim();
  if (s === '' || /^[.\-–—·•]+$/.test(s)) return null;
  return s;
}
```

Apply in the `runExtraction` push loop (`index.ts:435-437`):
```ts
for (const d of r.value.dishes) {
  dishes.push({
    ...d,
    name: d.name.trim(),                       // names never null — trim only
    description: normalizeText(d.description),  // "." / "" → null
    source_image_index: idx,
  });
}
```

This is the same defensive pattern already used at this site to override
`source_image_index`, so it fits the existing code.

---

## Problem 2 — portion text left in name/description

Prompt-level removal is the reliable fix: the model knows the exact source
substring, whereas a code-side strip is fragile after normalization
(`1.5kg`→`1500g` no longer substring-matches).

`infra/supabase/functions/menu-scan-worker/index.ts:202-214` — replace the
portion block. (This same edit also carries the Problem 3 prompt change — see below; shown combined.)

After:
```
- portion_amount + portion_unit: explicit portion size shown on the menu.
    Extract ONLY when explicitly visible in the dish name or description.
    Units: metric weight → "g", metric volume → "ml", count → "pcs",
    imperial weight → "oz". Normalize metric to base units (kg→g, L→ml);
    keep ounces as "oz" — do NOT convert oz→g. Pieces cover "X szt." / "X uds.".
      "250g" / "250 g"             → {amount: 250,  unit: "g"}
      "1.5kg" / "1,5 kg"           → {amount: 1500, unit: "g"}
      "0.5L" / "500ml"             → {amount: 500,  unit: "ml"}
      "8 oz" / "8oz"               → {amount: 8,    unit: "oz"}
      "6 pcs" / "6 szt." / "6 uds" → {amount: 6,    unit: "pcs"}
    When you set portion_amount/portion_unit, REMOVE that portion text from
    `name` and `description` so it is not shown twice, and tidy any leftover
    separators or empty parentheses:
      "Ribeye Steak 250g"   → name "Ribeye Steak"
      "Pilsner 0.5L"        → name "Pilsner"
      "Tomato Soup (300 ml)" → name "Tomato Soup"
    Return BOTH null when:
      - no size is shown
      - size is a range ("200–250g") — avoid false precision
      - size is vague ("small", "medium", "large", "regular", "house portion")
      - size refers to a garnish or side note, not the dish itself
    Either both fields are set together or both are null.
```

---

## Problem 3 — add `oz` unit

### 3a. DB migration (must be applied for `oz` to persist)
New `infra/supabase/migrations/148_portion_unit_add_oz.sql`:
```sql
-- 148_portion_unit_add_oz.sql
-- Created: 2026-05-30
--
-- Add 'oz' (ounces) to the allowed dishes.portion_unit values.
-- US/UK menus state portions in ounces ("8 oz steak", "12oz draft"). Unlike
-- kg/L (normalized to g/ml), ounces are stored as-is so the mobile app can
-- render "8 oz" verbatim — there's no metric base unit to fold them into
-- without losing the imperial label.
--
-- Only the value-check changes; column types and the both-or-neither
-- pairing constraint (dishes_portion_both_or_neither) are untouched.
--
-- Reverse: 148_REVERSE_ONLY_portion_unit_add_oz.sql.

BEGIN;

ALTER TABLE public.dishes
  DROP CONSTRAINT dishes_portion_unit_valid,
  ADD CONSTRAINT dishes_portion_unit_valid
    CHECK (portion_unit IS NULL OR portion_unit IN ('g', 'ml', 'pcs', 'oz'));

COMMENT ON COLUMN public.dishes.portion_unit IS
  'Unit for portion_amount: g | ml | pcs | oz. NULL when not on the menu. Paired with portion_amount via CHECK constraint.';

COMMIT;
```

New `infra/supabase/migrations/148_REVERSE_ONLY_portion_unit_add_oz.sql`:
```sql
-- Reverses 148. Fails if any dishes still use portion_unit = 'oz'
-- (would violate the restored CHECK). Re-point those rows before reversing.

BEGIN;

ALTER TABLE public.dishes
  DROP CONSTRAINT dishes_portion_unit_valid,
  ADD CONSTRAINT dishes_portion_unit_valid
    CHECK (portion_unit IS NULL OR portion_unit IN ('g', 'ml', 'pcs'));

COMMENT ON COLUMN public.dishes.portion_unit IS
  'Unit for portion_amount: g | ml | pcs. NULL when not on the menu. Paired with portion_amount via CHECK constraint.';

COMMIT;
```

After applying, regenerate the `infra/supabase/migrations/database_schema.sql` snapshot (it carries the old CHECK).

### 3b. Enum / union sweep — add `'oz'`

| File | Line | Change |
|---|---|---|
| `infra/supabase/functions/menu-scan-worker/index.ts` | 93 | `z.enum(['g','ml','pcs','oz'])` |
| `packages/shared/src/validation/menuScan.ts` | 96 | `z.enum(['g','ml','pcs','oz'])` |
| `packages/shared/src/validation/dish.ts` | 50 | `z.enum(['g','ml','pcs','oz'])` |
| `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts` | 41 | `z.enum(['g','ml','pcs','oz'])` (create) |
| `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts` | 156 | `z.enum(['g','ml','pcs','oz'])` (update) |
| `apps/admin/src/app/(admin)/menu-scan/actions/confirmSchema.ts` | 85 | TS union `'g' \| 'ml' \| 'pcs' \| 'oz' \| null` |
| `apps/admin/src/app/(admin)/menu-scan/actions/confirmSchema.ts` | 104 | `z.enum(['g','ml','pcs','oz'])` |
| `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` | 70 | union `'g' \| 'ml' \| 'pcs' \| 'oz' \| null` |
| `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` | 107 | union `'g' \| 'ml' \| 'pcs' \| 'oz' \| null` |
| `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx` | 362, 373 | cast `as 'g' \| 'ml' \| 'pcs' \| 'oz'` |
| `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` | 738 | cast `as 'g' \| 'ml' \| 'pcs' \| 'oz'` |
| `apps/admin/src/lib/auth/dal.ts` | 539 | comment only — update to mention `oz` |

### 3c. UI dropdowns — add `<option value="oz">oz</option>`
- `DishRowEditor.tsx` after line 382 (`<option value="pcs">pcs</option>`)
- `ReviewDishEditor.tsx` after line 749 (`<option value="pcs">pcs</option>`)

### 3d. Mobile display
`apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx:52-56` — render `oz`
with a leading space ("8 oz") like `pcs`, vs tight `250g`/`500ml`. Update the
comment (49-51) and the spacing condition (54):
```ts
? `${item.portion_amount}${item.portion_unit === 'pcs' || item.portion_unit === 'oz' ? ' ' : ''}${t(`restaurant.portionUnit.${item.portion_unit}`)}`
```

### 3e. Mobile locales — add `"oz": "oz"` under `restaurant.portionUnit`
- `apps/mobile/src/locales/en.json:423-427`
- `apps/mobile/src/locales/es.json:423-427`
- `apps/mobile/src/locales/pl.json:423-427`

(`oz` is a unit symbol; kept identical across locales. en `pcs`→"pcs", es→"uds.", pl→"szt." — `oz` stays "oz" everywhere.)

---

## Apply / deploy steps
1. Apply migration 148 to the database **before** anyone saves an `oz` dish.
2. Deploy the Edge Function: `supabase functions deploy menu-scan-worker`.
3. Regenerate `database_schema.sql` snapshot.

## Verification
- `turbo check-types` — catches any missed enum/union mismatch across shared + admin.
- `turbo lint`.
- Check for worker unit tests under `infra/supabase/functions/` (the worker exports `processJobs`/`handleRequest` for testing); run if present.
- Manual, against the admin portal after deploy:
  - Scan a menu with a description-less dish → description field is empty, no ".".
  - Scan a dish like "Ribeye Steak 250g" → name "Ribeye Steak", portion 250 / g; text not duplicated.
  - Scan a US menu "8 oz Sirloin" → portion 8 / oz; `oz` selectable in both editors; saves without CHECK error; mobile renders "8 oz · $X".

## Commit plan
Solo project, straight to `main` (no feature branch):
1. **`fix(menu-scan): drop placeholder descriptions + strip portion text from dish name`** — Problems 1 & 2 (worker prompt + `normalizeText` + push-site application). Single file: `menu-scan-worker/index.ts`.
2. **`feat(menu-scan): support oz portion unit`** — Problem 3 (migration + reverse, worker schema/prompt `oz`, shared schemas, admin schemas/types/dropdowns, mobile spacing + locales).

(1 and 2 can be squashed if preferred — both touch the worker prompt.)

## Open decision
- `oz` mobile spacing: plan assumes **"8 oz"** (space, like `pcs`). Switch to tight "8oz" if preferred.
