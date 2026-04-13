# LOC-09: comment-bloat-shared-types

## Current state

The `packages/shared/src/` directory has verbose file headers on every barrel/index file and multi-paragraph JSDoc on types and validation schemas. Total: ~186 raw comment lines across 12 files.

### File headers (barrel/index files)

| File | Lines | Raw comment lines |
|------|-------|-------------------|
| `src/index.ts:1-13` | 18 | 13 |
| `types/index.ts:1-10` | 33 | 10 |
| `validation/index.ts:1-16` | 33 | 16 |
| `constants/index.ts:1-14` | 22 | 14 |

All four headers restate what the sub-modules contain — obvious from the export lists below them.

**Total barrel headers: 53 lines removable.**

### Type file comments (`types/restaurant.ts`)

| Location | Content | Action |
|----------|---------|--------|
| Lines 1-15 (14 lines) | File header with relationship diagram | REMOVE — types are self-documenting |
| Line 24 | `/** Canonical ingredient alias... */` | REMOVE — restates type name |
| Line 47 | `/** A single selectable choice... */` | REMOVE — restates type name |
| Lines 61-65 (5 lines) | OptionGroup multi-line JSDoc | REMOVE — `dish_kind` context derivable from field |
| Lines 82-85 (4 lines) | OperatingHours 4-line JSDoc | CONDENSE to 1-line: `/** Omitting a day means closed. Times are HH:MM local. */` |
| Lines 96-99 (4 lines) | DishCategory 4-line JSDoc | REMOVE — restates type name |
| Lines 110-117 (8 lines) | Dish 8-line JSDoc | CONDENSE to 2 lines: `/** A menu item. parent_dish_id links variants; is_parent containers are excluded from the feed. */` |
| Lines 157-160 (4 lines) | Menu 4-line JSDoc | REMOVE — restates type name |
| Line 192 | `/** Identity and location... */` | REMOVE — restates type name |
| Line 209 | `/** Accepted payment methods... */` | REMOVE — restates type name |
| Line 212 | `/** Operational attributes... */` | REMOVE — restates type name |
| Lines 223-228 (6 lines) | RestaurantData 6-line JSDoc | REMOVE — restates type name |
| Line 235 | `/** Metadata for a single step... */` | REMOVE — restates type name |
| Lines 243-246 (4 lines) | FormProgress 4-line JSDoc | CONDENSE to 1-line: `/** Persisted to localStorage under 'restaurant-draft'; allows wizard resume after refresh. */` |

**Preserved WHY-comments:**
- Line 17: PostGIS POINT(lng lat) layout — critical correctness note
- Line 35: "UI-only" marker on SelectedIngredient
- Lines 40-45: type alias descriptions (concise, explain the type's purpose)
- Line 53: price_delta direction semantics
- Line 73: selection_type semantics (single=radio, multiple=checkbox, quantity=stepper)
- Lines 176-179: RestaurantType sync constraint — CONDENSE to 1 line: `/** Must stay in sync with RESTAURANT_TYPES constant and Postgres enum. */`

**types/restaurant.ts: ~51 lines removed, ~5 lines added as condensed replacements = ~46 net.**

### Validation file comments (`validation/restaurant.ts`)

| Location | Content | Action |
|----------|---------|--------|
| Lines 1-13 (13 lines) | File header mapping schemas to wizard steps | REMOVE — obvious from exports |
| Lines 16-19 (4 lines) | basicInfoSchema JSDoc | REMOVE — restates schema name |
| Lines 49-52 (4 lines) | operationsSchema JSDoc | REMOVE — restates schema name |
| Lines 69-84 (16 lines) | dishSchema JSDoc | CONDENSE — keep 4 WHY-lines as inline comments (price cap rationale, NaN from RHF, auto-populated allergens, option_groups for template/experience) |
| Line 137 | menuSchema JSDoc | REMOVE — restates schema name |
| Lines 142-147 (6 lines) | restaurantDataSchema JSDoc | REMOVE — restates schema name |
| Lines 153-155 (3 lines) | Section banner `// ─── Inferred...` | REMOVE |
| Line 157 | `/** Form data shape for basic-info... */` | REMOVE |
| Line 160 | `/** Form data shape for operations... */` | REMOVE |
| Lines 163-167 (5 lines) | DishFormData JSDoc | CONDENSE to 1-line: `/** Uses z.input so .default() fields stay optional in the form. */` |
| Line 170 | `/** Form data shape for the full menu... */` | REMOVE |
| Line 172 | `/** Form data shape for the final review... */` | REMOVE |

**validation/restaurant.ts: ~56 lines removed, ~5 lines added as condensed replacements = ~51 net.**

### Constant file comments

| File | Location | Lines | Action |
|------|----------|-------|--------|
| `constants/cuisine.ts:1-7` | File header | 7 | REMOVE |
| `constants/cuisine.ts:25-30` | ALL_CUISINES 5-line JSDoc | 5 | REMOVE — "merged from web-portal and mobile" is historical, not load-bearing |
| `constants/dietary.ts:1-6` | File header | 6 | REMOVE |
| `constants/dietary.ts:8-11` | DIETARY_TAGS 4-line JSDoc | 4 | CONDENSE to 1-line: `/** Values must match dietary_tags.code in the DB. */` |
| `constants/dietary.ts:28-31` | ALLERGENS 4-line JSDoc | 4 | CONDENSE to 1-line: `/** Values must match allergens.code in the DB. */` |
| `constants/menu.ts:1-6` | File header | 6 | REMOVE |
| `constants/menu.ts:21-26` | DISH_KINDS 6-line JSDoc | 6 | REMOVE — descriptions are in the data itself |
| `constants/menu.ts:64-67` | OPTION_PRESETS 4-line JSDoc | 4 | REMOVE — name + type signature is clear |
| `constants/restaurant.ts:1-6` | File header | 6 | REMOVE |
| `constants/restaurant.ts:8-12` | RestaurantType local 5-line JSDoc | 5 | REMOVE — stale ("will be re-exported via the types barrel in Step 3") |
| `constants/calendar.ts:1-3` | File header | 3 | REMOVE |
| `constants/pricing.ts:1-6` | File header | 6 | REMOVE |

**Preserved WHY-comments in constants:**
- `cuisine.ts:9`: "Shorter curated list surfaced in the onboarding 'quick-pick' cuisine chips" — explains curation rationale. KEEP.
- `cuisine.ts:100`: backward-compatible alias note. KEEP.
- `menu.ts:8,18,43,54,57`: single-line descriptions on constants/types. KEEP (concise, useful).
- `restaurant.ts:25,43,49,71,74`: single-line descriptions on constants. KEEP.
- `dietary.ts:25`: RELIGIOUS_REQUIREMENTS subset note. KEEP.
- `calendar.ts:5,16`: single-line descriptions. KEEP.
- `pricing.ts:8,11,18,21,30`: single-line descriptions. KEEP.

**Constants total: ~62 lines removed, ~2 lines added = ~60 net.**

## Proposed reduction

Remove all file headers from barrel/index files and source files. Remove multi-paragraph JSDoc blocks that restate the type/schema name. Condense multi-line WHY-comments to single lines. Keep all single-line JSDoc that carries useful context.

No JSDoc lint stubs needed — the shared package has no ESLint config and no JSDoc lint rules.

## Estimated LOC savings

~157 raw lines removed, ~12 condensed replacements added = **~145 net lines**.

After prettier reformatting (which may re-wrap some lines), conservative estimate: **100-130 lines**.

## Risk assessment

**Zero functional risk.** All removals are comments and JSDoc — no executable code is touched.

**No lint risk.** The shared package has no `lint` script in `package.json` and no ESLint config. The web-portal ESLint config has JSDoc rules, but they apply only to web-portal source files, not to imported types from `@eatme/shared`.

**WHY-comments preserved:**
- PostGIS POINT(lng lat) ordering (`types/restaurant.ts:17`)
- UI-only markers (`types/restaurant.ts:35`)
- price_delta direction semantics (`types/restaurant.ts:53`)
- selection_type semantics (`types/restaurant.ts:73`)
- Variant hierarchy explanation (condensed from 8 to 2 lines)
- RestaurantType sync constraint (condensed from 4 to 1 line)
- z.input vs z.infer rationale (condensed from 5 to 1 line)
- Price cap, NaN, auto-populated allergens, option_groups rationale (condensed from 16 to 4 inline lines)
- DB column sync constraints on dietary/allergen constants (condensed from multi-line to 1-line each)
- Backward-compatible CUISINES alias note
- RELIGIOUS_REQUIREMENTS subset explanation

## Decision: apply

Safe to implement. Pure comment removal with no executable code changes. No lint rules apply to the shared package. All WHY-context preserved in condensed form.
