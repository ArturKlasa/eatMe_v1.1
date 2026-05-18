# Phase 3 — Shared packages

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Proposed
**Last updated:** 2026-05-17
**Estimated wall time:** 1 day
**Reversibility:** Additive — new types/constants exposed; legacy types marked `@deprecated` but kept through Phase 6.

Update `@eatme/shared` types + Zod schemas to match the new modifier model, and regenerate `@eatme/database` types from the post-Phase-1 schema.

---

## 1. `@eatme/shared` updates

**File:** `packages/shared/src/constants/menu.ts`

```ts
export const DINING_FORMATS = [
  'buffet','course_menu','interactive_table','shared_plates','sampler',
] as const;
export type DiningFormat = typeof DINING_FORMATS[number];

export const DINING_FORMAT_META: Record<DiningFormat, { label: string; icon: string; description: string }> = {
  buffet:             { label: 'Buffet',                icon: '🍽️', description: 'Flat-rate unlimited access' },
  course_menu:        { label: 'Course menu',           icon: '🍷', description: 'Multi-course sequenced meal' },
  interactive_table:  { label: 'Interactive dining',    icon: '🔥', description: 'Hot pot, KBBQ, fondue' },
  shared_plates:      { label: 'Small / shared plates', icon: '🥢', description: 'Tapas, dim sum, mezze' },
  sampler:            { label: 'Sampler / platter',     icon: '🍢', description: 'Fixed selection on one plate' },
};
```

Mark `DISH_KIND_META` and `DISH_KINDS` as `@deprecated` in JSDoc; do NOT remove yet — admin/worker/mobile still reference them through Phase 6.

**File:** `packages/shared/src/types/restaurant.ts`

Extend `Dish` interface:
```ts
export interface Dish {
  // existing fields...
  dining_format?: DiningFormat | null;
  bundled_items?: Array<{ name: string; note?: string }> | null;
  available_days?: string[] | null;
  available_hours_start?: string | null;
  available_hours_end?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  // @deprecated — remove in Phase 7
  dish_kind?: DishKind;
  parent_dish_id?: string | null;
  is_parent?: boolean;
  is_template?: boolean;
}
```

Extend `Option` interface with new columns matching migration 140.

Drop `'quantity'` from the `selection_type` union on `OptionGroup` (and from `packages/shared/src/constants/menu.ts:39`, `apps/mobile/src/lib/supabase.ts:67`). The CHECK constraint tightening in migration 140 makes the type-level removal safe.

**File:** `packages/shared/src/validation/menuScan.ts`

Update `MenuExtractionSchema` to match the new worker schema (drop `dish_kind`, add `dining_format`, `bundled_items`, `modifier_groups`).

**File:** `packages/shared/src/validation/dish.ts`

Collapse the discriminated union into a single schema (no longer keyed on `dish_kind`):
```ts
export const dishSchemaV2 = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  primary_protein: z.enum(PRIMARY_PROTEINS),
  dietary_tags: z.array(z.string()),
  allergens: z.array(z.string()),
  serves: z.number().int().min(1).default(1),
  display_price_prefix: z.enum(PRICE_PREFIXES).default('exact'),
  dining_format: z.enum(DINING_FORMATS).nullable().default(null),
  bundled_items: z.array(z.object({
    name: z.string(),
    note: z.string().optional(),
  })).nullable().default(null),
  modifier_groups: z.array(modifierGroupSchema).default([]),
});
```

## 2. `@eatme/database` regenerate

After migrations 140–143 land in staging:
```bash
supabase gen types typescript --linked > packages/database/src/types.ts
```

New columns on `options`, `dishes` appear. Verify generated types pass `tsc` across all consumers.

## 3. Acceptance criteria

- `pnpm build` passes across `packages/shared` and `packages/database`.
- All workspace packages typecheck.
- No new `@ts-expect-error` introduced.

## 4. Effort: 1 day
