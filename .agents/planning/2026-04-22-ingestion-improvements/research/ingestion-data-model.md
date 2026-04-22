# Ingestion Data Model — Dish Kind & Related Schema

File:line refs throughout.

## Dish Kind enum

**Type:** `packages/shared/src/types/restaurant.ts:24`
```ts
export type DishKind = 'standard' | 'template' | 'experience' | 'combo';
```

**Constants:** `packages/shared/src/constants/menu.ts:14-39`
```ts
DISH_KINDS = [
  { value: 'standard',   label: 'Standard',   description: 'Single item, fixed composition', icon: '🍽️' },
  { value: 'template',   label: 'Template',   description: 'Customer chooses components (protein, sauce…)', icon: '🔧' },
  { value: 'experience', label: 'Experience', description: 'Multi-course or group dining (hot pot, tasting menu…)', icon: '✨' },
  { value: 'combo',      label: 'Combo',      description: 'Bundle of multiple items (burger + fries + drink)', icon: '🎁' },
];
```

**DB column:** `infra/supabase/migrations/database_schema.sql:143`
```sql
dish_kind text NOT NULL DEFAULT 'standard'
  CHECK (dish_kind = ANY (ARRAY['standard','template','experience','combo']))
```
Stored as `text` + `CHECK`, not a native PG enum — migrations are flexible. Introduced by migration `073_universal_dish_structure.sql`.

## How `kind` is set during ingestion

**1. Menu-scan API (OpenAI Vision prompt):** `apps/web-portal/app/api/menu-scan/route.ts:125-142`
- TEMPLATE — "Choose your protein/base" → `is_parent=true`, `display_price_prefix='from'`
- COMBO — "Lunch combo", "Set menu" → `is_parent=true`, bundled price on parent, child prices null
- EXPERIENCE — "All-you-can-eat", "Hot pot", "Tasting menu" → `is_parent=true`, `display_price_prefix='per_person'`, `serves=N`
- SIZE VARIANTS — S/M/L → `dish_kind='standard'`, `is_parent=true`, `display_price_prefix='from'`
- STANDARD — default → `is_parent=false`

**2. Defaults if AI omits:** `route.ts:284-298` — coerce `dish_kind='standard'` and `is_parent=false`.

**3. Enrichment (post-ingestion):** `infra/supabase/functions/enrich-dish/index.ts` — does *not* touch `dish_kind`. Only computes allergens, categories, embedding, completeness.

**4. Manual edit:** `DishEditPanel.tsx:91-121` — kind dropdown with auto-patching of `is_parent` and `display_price_prefix`.

## Downstream consumption

- **Mobile (feed + detail):** `apps/mobile/src/components/DishPhotoModal.tsx` — only cosmetic (emoji badges for template/experience). No filter-by-kind in the feed.
- **`generate_candidates()` RPC** — returns `dish_kind` in result set but does NOT filter by it. Does filter by `is_parent=false`.
- **No pricing branching on kind** — `display_price_prefix` handles display variance.
- **No analytics** currently split on kind.

## Dishes table — full schema

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK | |
| name | text NOT NULL | |
| description | text | |
| price | numeric NOT NULL DEFAULT 0 | |
| dietary_tags | text[] | |
| allergens | text[] | |
| calories | int | |
| spice_level | text | CHECK none/mild/hot |
| image_url | text | |
| is_available | bool DEFAULT true | |
| **dish_kind** | text NOT NULL DEFAULT 'standard' | 4-value CHECK |
| **display_price_prefix** | text DEFAULT 'exact' | CHECK: exact/from/per_person/market_price/ask_server |
| description_visibility | text DEFAULT 'menu' | menu/detail |
| ingredients_visibility | text DEFAULT 'detail' | menu/detail/none |
| enrichment_status | text DEFAULT 'none' | none/pending/completed/failed |
| enrichment_source | text DEFAULT 'none' | none/ai/manual |
| enrichment_confidence | text | high/medium/low |
| enrichment_payload | jsonb | AI-inferred fields |
| embedding_input | text | |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| protein_families | text[] | computed from ingredients |
| protein_canonical_names | text[] | |
| primary_protein | text NOT NULL | enum, recent addition |
| **parent_dish_id** | uuid FK → dishes | nullable; variant → parent |
| **is_parent** | bool DEFAULT false | display-only if true |
| **serves** | int DEFAULT 1 | CHECK >=1 |
| **price_per_person** | numeric GENERATED STORED | `price / serves` |
| created_at / updated_at | timestamptz | |

Indexes (from 073): `idx_dishes_parent_dish_id`, `idx_dishes_is_parent`.

## Restaurants table + ingestion flow

Admin page: `apps/web-portal/app/admin/restaurants/import/page.tsx`.

**Pathways:**
- Google Places (map select + radius; paginated)
- CSV (structured upload w/ dedup)

**Services:** `lib/import-service.ts:34-100` — dedup by exact `google_place_id`, fuzzy name+200m proximity flagged but inserted. Validation in `lib/import-validation.ts`.

**Captured fields** (`lib/import-types.ts:6-27`): name, address, lat/lng, phone, website, restaurant_type, cuisine_types, country/city/state/postal/neighbourhood, open_hours, delivery/takeout/dinein/reservations, payment_methods, google_place_id.

**No AI enrichment at restaurant import.** Menus/dishes come separately.

## Ingredient pipeline (concepts / variants / aliases)

**New schema:** `infra/supabase/migrations/099_new_ingredients_schema.sql`
- `ingredient_concepts` — canonical things (slug, family, vegetarian/vegan, allergens[])
- `ingredient_variants` — preparations (concept_id, modifier, is_default)
- `concept_translations`, `variant_translations` — i18n
- `ingredient_aliases_v2` — match lookup with trigram index

**Legacy still live:** `canonical_ingredients`, `ingredient_aliases`, `dish_ingredients` (FK to legacy; migration 106 made concept_id NOT NULL).

**Feature flag:** `NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED` — currently **OFF**. Used in `apps/web-portal/lib/featureFlags.ts`.

**Status:** phase 1 schema done; backfill + reader/writer wiring incomplete.

## Recent migrations

- **112** `seed_dish_categories.sql` — seeds ~900 canonical dish categories (Pizza, Taco, Ramen, Pasta, Sushi, etc.). Enables AI to map `dish_category` text → `dish_category_id` FK and create new ones on demand.
- **113** `add_non_alcoholic_dietary_tag.sql` — adds `('non_alcoholic', …)` to the `dietary_tags` table. Caused by menu-scan emitting unmapped non_alcoholic hints for NA beers / mocktails.

## Real-world menu structures NOT cleanly representable today

Derived from code — not exhaustive:

1. **Prix-fixe / tasting menus with sequenced courses.** `experience` kind lacks course ordering; all variants are interchangeable.
2. **Alternating choices across courses** ("Soup or salad → main → dessert"). Option groups can model per-group choice but not ordered sequencing.
3. **Family-style with mix-and-match components** ("3 proteins + 2 sides + 1 sauce"). `serves=N` captures headcount only.
4. **Kids menu as a first-class concept** — no `audience` field; must be tagged via dietary_tags or sectioning.
5. **Happy-hour / time-based dish pricing.** Menu-level `available_start/end_time` gates visibility, but dish-level price overrides don't exist.
6. **Build-your-own with dynamic base prices.** Option-level price_delta is additive; no way to express "chicken is base, beef +$2, fish +$5" with one as default.
7. **Brunch / daypart categories** — no schema enforcement; `menu.category` is a label string.
8. **Seasonal / rotating with date ranges** — `available_days` is weekday array; no date-range or season.
9. **Allergen severity / cross-contamination** — `allergens[]` is presence-only.
10. **Buffet / AYCE** — modeled awkwardly as `experience` with `per_person` pricing; no distinct "flat-rate access" semantics.
