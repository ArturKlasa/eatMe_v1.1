# Menu Ingestion & Enrichment Improvements

## Objective

Improve the restaurant menu scanning, dish pattern detection, and enrichment pipeline so that the menu-scan flow can create template, combo, and experience dishes (not just standard), with better embeddings, smarter merge logic, and staged AI suggestion approval.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo) with:

- **`apps/mobile`** — React Native + Expo, map-based dish discovery, Zustand stores, recommendation feed
- **`apps/web-portal`** — Next.js, restaurant owner onboarding, admin dashboard, AI menu scanning (GPT-4o Vision)
- **Backend** — Supabase (PostgreSQL + PostGIS + pgvector), Edge Functions (feed, enrich-dish, group-recommendations, etc.), Upstash Redis
- **Shared packages** — `packages/database` (Supabase client + auto-generated types)

### The Problem

GPT-4o Vision already extracts `is_parent`, `dish_kind`, and `variants[]` from menu images, but this data is **silently discarded** because TypeScript types throughout the pipeline (`RawExtractedDish`, `EnrichedDish`, `EditableDish`, `ConfirmDish`) omit these fields. The DB schema (migration 073) fully supports parent-child variants, but no UI can manage them. Additionally, the enrichment pipeline produces weak embeddings and doesn't leverage AI-inferred data.

### The Solution (Designed & Approved)

A complete design document exists at `.agents/planning/2026-04-06-menu-ingestion-enrichment/design/detailed-design.md`. **You must follow this design document precisely.** It specifies:

- **Pipeline wiring**: Add `is_parent`, `dish_kind`, `variants`, `serves`, `display_price_prefix` to all TypeScript types and preserve through the full pipeline
- **GPT-4o Vision prompt overhaul**: Switch to Structured Outputs, cover all dish patterns, extract new fields
- **Multi-page merge improvements**: 3-layer fuzzy category matching, variant detection on duplicates, null-category fix
- **Admin review UI**: Hybrid AI-proposes / admin-reviews with grouped variant cards, accept/reject/override controls
- **Confirm endpoint update**: Three-pass insert (parents → children → options) with new fields
- **Enrichment improvements**: Better embeddings (labeled NL format, 300 char descriptions, cuisine context, parent inheritance), smarter completeness (dish_kind-aware), staged AI suggestions

### Planning Artifacts

**Design & requirements** (read these before implementing):
- `.agents/planning/2026-04-06-menu-ingestion-enrichment/design/detailed-design.md` — Complete design with architecture, components, interfaces, data models, error handling, testing strategy
- `.agents/planning/2026-04-06-menu-ingestion-enrichment/idea-honing.md` — Requirements Q&A with all decisions and rationale

**Research notes** (consult for decision rationale):
- `.agents/planning/2026-04-06-menu-ingestion-enrichment/research/dish-pattern-detection-approach.md` — Why hybrid AI+admin approach was chosen
- `.agents/planning/2026-04-06-menu-ingestion-enrichment/research/gpt4o-vision-prompt-engineering.md` — Structured Outputs, decision tree patterns, few-shot examples
- `.agents/planning/2026-04-06-menu-ingestion-enrichment/research/embedding-quality-strategies.md` — Labeled NL format, signal ranking, input length sweet spot
- `.agents/planning/2026-04-06-menu-ingestion-enrichment/research/fuzzy-category-matching.md` — 3-layer matching algorithm, synonym map, string-similarity library
- `.agents/planning/2026-04-06-menu-ingestion-enrichment/research/review-ui-patterns.md` — Card clusters, accept/reject/edit UX, batch operations

**Prior initiative** (background context for dish model):
- `.agents/planning/2026-04-05-universal-dish-structure/design/detailed-design.md` — Universal dish structure design (already implemented in migration 073)
- `.agents/planning/2026-04-05-universal-dish-structure/rough-idea.md` — All dish patterns the platform needs to support

### Key Source Files

**Menu scan pipeline** (primary focus):
- `apps/web-portal/app/api/menu-scan/route.ts` — GPT-4o Vision extraction, system prompt, JSON parsing
- `apps/web-portal/lib/menu-scan.ts` — Types (RawExtractedDish, EnrichedDish, EditableDish, ConfirmDish), merge logic, toEditableMenus, DIETARY_HINT_MAP
- `apps/web-portal/app/api/menu-scan/confirm/route.ts` — Commit scanned menu to DB
- `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts` — AI ingredient suggestions
- `apps/web-portal/app/admin/menu-scan/page.tsx` — Admin review UI (2,489 lines)

**Enrichment pipeline**:
- `infra/supabase/functions/enrich-dish/index.ts` — Edge function: completeness evaluation, AI enrichment, embedding generation

**Restaurant service layer**:
- `apps/web-portal/lib/restaurantService.ts` — submitRestaurantProfile(), three-pass insert (parents → children → options)
- `apps/web-portal/types/restaurant.ts` — Dish, Menu, DishKind, DisplayPricePrefix types

**Constants & shared**:
- `apps/web-portal/lib/constants.ts` — DISH_KINDS array (missing 'combo')

**Onboarding**:
- `apps/web-portal/app/onboard/menu/page.tsx` — Restaurant owner dish creation (needs serves + display_price_prefix)

**Database**:
- `infra/supabase/migrations/database_schema.sql` — Full schema
- `infra/supabase/migrations/073_universal_dish_structure.sql` — Parent-child model (already applied)

## Requirements

1. **Pipeline wiring**: Add `is_parent` (boolean), `dish_kind` (enum), `variants` (array), `serves` (integer), `display_price_prefix` (enum) to `RawExtractedDish`, `EnrichedDish`, `EditableDish`, `ConfirmDish` in `lib/menu-scan.ts`. Update `toEditableMenus()` to preserve these fields. Update `buildConfirmPayload()` to include them. Ensure no field is silently dropped at any stage.

2. **GPT-4o Vision prompt overhaul**: In `app/api/menu-scan/route.ts`, switch from `response_format: { type: 'json_object' }` to Structured Outputs (`{ type: 'json_schema', json_schema: { ... } }`). Define schema using Zod + `zodResponseFormat()`. Move JSON schema out of system prompt text. Rewrite pattern detection rules as a prioritized decision tree (template → combo → experience → size variants → market price → family/sharing → standard). Add `serves` and `display_price_prefix` extraction. Add 2-3 few-shot examples. Add multi-page context note. Remove `repairTruncatedJson()` (Structured Outputs guarantees schema compliance).

3. **Multi-page merge improvements**: In `lib/menu-scan.ts`, rewrite `mergeExtractionResults()` with 3-layer category matching: (a) normalization (lowercase, strip accents, replace &/+), (b) synonym map (~40 canonical categories covering English/Spanish), (c) string similarity fallback (Jaro-Winkler > 0.85 via `string-similarity` library). When duplicate dish names have different prices, flag as potential variants instead of dropping. Assign page-indexed placeholders for null categories. Preserve `is_parent`, `dish_kind`, `variants` through merge. Add `string-similarity` npm dependency.

4. **Menu-scan review UI**: In `app/admin/menu-scan/page.tsx`, add variant group display: `DishGroupCard` component showing parent as header with indented variant cards beneath (left-border connector). Add Accept/Reject/Edit button trio per group. Add keyboard shortcuts (A=accept, R=reject, E=edit). Add `BatchToolbar` component with "Accept all high-confidence", multi-select checkboxes, filter by confidence/dish_kind/has_grouping, progress counter. Add dish_kind dropdown per dish. Add "Ungroup" button to eject variants from a group. Add "Group as variants" typeahead to manually group standalone dishes. Add `serves` number input and `display_price_prefix` dropdown per dish. Show confidence badge per group. Use progressive disclosure for AI reasoning. Add `FlaggedDuplicateCard` for merge-detected potential variants.

5. **Confirm endpoint update**: In `app/api/menu-scan/confirm/route.ts`, accept `dish_kind`, `is_parent`, `serves`, `display_price_prefix` in `ConfirmDish`. Accept nested `variant_dishes[]` on parent dishes. Insert parents first (with `is_parent: true`, `price: 0`), collect IDs, then insert children with `parent_dish_id`. Pass `dish_kind`, `serves`, `display_price_prefix` to dish insert. Return `{ status: 'completed_with_warnings', dishes_saved, dishes_failed, errors[] }` instead of binary completed/failed.

6. **Enrichment: better embeddings**: In `infra/supabase/functions/enrich-dish/index.ts`, rewrite `buildEmbeddingInput()` to use labeled natural-language format targeting 60-120 tokens: `"{name}. {dish_type}, {cuisine_types}. {description (300 chars)}. Ingredients: {ingredients}. {structured options}."`. Load restaurant `cuisine_types` from DB and include. For child variants (`parent_dish_id` is set), fetch parent name + ingredients and prepend. Include `enrichment_payload.notes` when available. Increase description from 120 to 300 chars. Load option groups with structured group names (not flat option names).

7. **Enrichment: smarter completeness**: In `enrich-dish/index.ts`, rewrite `evaluateCompleteness()` to be dish_kind-aware: template/experience dishes are `complete` if ≥3 option names exist (regardless of ingredient count). Standard dishes: `complete` if ≥3 ingredients OR (≥1 ingredient + description ≥100 chars). Combo: `complete` if ≥2 options. `partial` if any signal exists. `sparse` if nothing.

8. **Enrichment: staged AI suggestions**: Extend `enrichment_payload` schema to include `inferred_allergens` (string[]) and `inferred_dish_category` (string). Create migration `074_enrichment_review_status.sql` adding `enrichment_review_status` column to dishes table (`CHECK: 'pending_review' | 'accepted' | 'rejected' | NULL`). After AI enrichment, set `enrichment_review_status = 'pending_review'`. Extend the enrichWithAI GPT prompt to also return `inferred_allergens` and `inferred_dish_category`.

9. **Add 'combo' to DISH_KINDS**: In `apps/web-portal/lib/constants.ts`, add `{ value: 'combo', label: 'Combo', description: 'Bundle of multiple items (burger + fries + drink)', icon: '🎁' }` to the `DISH_KINDS` array. Update `DishKindValue` type accordingly.

10. **Onboarding minor additions**: In `apps/web-portal/app/onboard/menu/page.tsx` (and the `DishFormDialog` component), add a `serves` number input (integer, min 1, default 1) and a `display_price_prefix` dropdown (exact/from/per_person/market_price/ask_server, default 'exact'). Wire through to `submitRestaurantProfile()` in `restaurantService.ts`.

11. **Expand DIETARY_HINT_MAP**: In `lib/menu-scan.ts`, add to the existing `DIETARY_HINT_MAP`: regional spellings ('végétarien', 'végétalien', 'senza glutine', 'sin lácteos', 'sans gluten', 'sans lactose'), common abbreviations ('egg-free', 'eggfree', 'soy-free', 'soyfree', 'paleo', 'keto', 'low-sodium', 'pescatarian'), emoji variants ('🌿'→vegetarian, '🌱'→vegan). Add a `normalizeDietaryHint()` function that strips brackets, asterisks, and periods before lookup.

## Constraints

- **Follow the design document**: `.agents/planning/2026-04-06-menu-ingestion-enrichment/design/detailed-design.md` is the specification. Do not deviate from type definitions, field names, enum values, or architecture specified there.
- **Read research notes**: Consult the research files in `.agents/planning/2026-04-06-menu-ingestion-enrichment/research/` for decision rationale when making implementation choices.
- **Read before writing**: Always read the current state of a file before modifying it. The codebase has recent changes from the universal dish structure initiative.
- **Migration safety**: The new migration (074) must be additive only — no data loss, no breaking changes. The `enrichment_review_status` column must be nullable with no default.
- **No new tables**: Use existing tables. Only one new column (`enrichment_review_status` on dishes).
- **Minimal new dependencies**: Only add `string-similarity` for fuzzy matching. Use existing libraries for everything else.
- **Existing parent-child insert logic**: `restaurantService.ts` already has three-pass insertion (parents → inline variants → explicit variants). Reuse this logic in the confirm endpoint, don't duplicate it.
- **Structured Outputs compatibility**: When using `json_schema` response format, the Zod schema must avoid `additionalProperties` and must handle recursive types (variants[] containing DishSchema). Use `z.lazy()`.
- **Embedding design principle**: Embeddings represent dish identity (what the dish IS), not commercial attributes. Never include price in embedding input. Keep spice_level, dietary_tags, allergens as SQL filter columns only.
- **Staged approval model**: AI-inferred ingredients, allergens, and categories must NEVER be auto-applied. They are stored in `enrichment_payload` and `enrichment_review_status='pending_review'` until admin explicitly accepts.
- **Backwards compatibility**: All existing dishes must continue working. New fields have sensible defaults. Menu-scan without variant detection still produces valid standard dishes.
- **No regressions**: Existing menu scan → review → confirm flow must continue working for simple standard-dish menus.

## Success Criteria

The task is complete when:

- [x] `RawExtractedDish`, `EnrichedDish`, `EditableDish`, `ConfirmDish` types include is_parent, dish_kind, variants, serves, display_price_prefix
- [x] `toEditableMenus()` and `buildConfirmPayload()` preserve all new fields
- [x] GPT-4o Vision uses Structured Outputs (`json_schema` mode) with Zod schema
- [x] `repairTruncatedJson()` removed (no longer needed)
- [x] System prompt rewritten as decision tree covering all dish patterns with 2-3 few-shot examples
- [x] GPT extracts `serves` and `display_price_prefix` from menu images
- [x] Multi-page merge uses 3-layer fuzzy category matching (normalize → synonym → string similarity)
- [x] Duplicate dish names with different prices flagged as potential variants
- [x] Null categories get page-indexed placeholders instead of merging together
- [x] Admin review UI shows variant groups as indented card clusters with parent header
- [x] Accept/Reject/Edit buttons work on variant groups with keyboard shortcuts (A/R/E)
- [x] BatchToolbar allows "Accept all high-confidence" and multi-select operations
- [x] dish_kind dropdown, serves input, display_price_prefix dropdown available per dish
- [x] Admin can ungroup wrong AI groupings and manually group dishes AI missed
- [x] Confirm endpoint inserts parents first, then children with parent_dish_id
- [x] Confirm returns completed_with_warnings status for partial failures
- [x] `buildEmbeddingInput()` uses labeled NL format targeting 60-120 tokens
- [x] Embedding includes cuisine context from restaurant and parent context for child variants
- [x] Description truncation increased to 300 chars; AI notes included
- [x] `evaluateCompleteness()` is dish_kind-aware (templates use option count, not ingredient count)
- [x] `enrichment_payload` includes inferred_allergens and inferred_dish_category
- [x] Migration 074 adds enrichment_review_status column
- [x] enrichment_review_status set to 'pending_review' after AI enrichment
- [x] 'combo' added to DISH_KINDS in constants.ts
- [x] Onboarding DishFormDialog has serves and display_price_prefix fields
- [x] DIETARY_HINT_MAP expanded with regional spellings, abbreviations, emoji variants
- [x] normalizeDietaryHint() strips brackets, asterisks, periods before lookup
- [x] All existing menu scan → review → confirm flows still work for standard dishes
- [x] No regressions in feed results for restaurants without variants

## Notes

- The database already has `is_parent`, `parent_dish_id`, `dish_kind`, `serves`, `display_price_prefix` columns from migration 073. No schema changes needed for these.
- `restaurantService.ts` already has three-pass parent-child insertion logic — reuse it in the confirm endpoint.
- The GPT-4o Vision prompt already asks for `is_parent`, `dish_kind`, and `variants` — the data exists but is dropped by TypeScript types.
- The `string-similarity` npm package provides `compareTwoStrings()` for Jaro-Winkler-style fuzzy matching.
- When implementing the review UI, the existing `menu-scan/page.tsx` is 2,489 lines. Add new components as separate files where possible to manage complexity.
- For Structured Outputs, use `zodResponseFormat()` from `openai/helpers/zod` to convert Zod schemas.
- Parent dishes have `is_parent: true`, `price: 0`, and are excluded from the recommendation feed.
- The enrichment edge function (`enrich-dish`) already skips parent dishes (line 280-285). This doesn't need to change.
- Start by reading the design document and all research notes before implementing anything.
- Update the Progress Log checkboxes as you complete each item so the orchestrator can track progress.

## Progress Log

- [x] Pipeline wiring: TypeScript types updated (RawExtractedDish, EnrichedDish, EditableDish, ConfirmDish)
- [x] Pipeline wiring: toEditableMenus() preserves new fields
- [x] Pipeline wiring: buildConfirmPayload() includes new fields
- [x] GPT-4o Vision: Switched to Structured Outputs with Zod schema
- [x] GPT-4o Vision: System prompt rewritten as decision tree with few-shot examples
- [x] GPT-4o Vision: repairTruncatedJson() removed
- [x] GPT-4o Vision: serves and display_price_prefix extraction working
- [x] Merge: 3-layer fuzzy category matching implemented
- [x] Merge: Duplicate dish variant detection implemented
- [x] Merge: Null-category page-indexed placeholders implemented
- [x] Review UI: DishGroupCard with parent + indented variants
- [x] Review UI: Accept/Reject/Edit buttons with keyboard shortcuts
- [x] Review UI: BatchToolbar with bulk operations
- [x] Review UI: dish_kind dropdown, serves, display_price_prefix per dish
- [x] Review UI: Ungroup and manual grouping controls
- [x] Review UI: FlaggedDuplicateCard for merge-detected variants
- [x] Confirm: Parent-first insertion with parent_dish_id on children
- [x] Confirm: New fields (dish_kind, serves, display_price_prefix) persisted
- [x] Confirm: completed_with_warnings status
- [x] Enrichment: buildEmbeddingInput() rewritten (labeled NL, 300 chars, cuisine, parent context)
- [x] Enrichment: evaluateCompleteness() dish_kind-aware
- [x] Enrichment: enrichWithAI() returns inferred_allergens and inferred_dish_category
- [x] Enrichment: enrichment_review_status set after AI enrichment
- [x] Migration 074: enrichment_review_status column added
- [x] Constants: 'combo' added to DISH_KINDS
- [x] Onboarding: serves and display_price_prefix fields added
- [x] Dietary hints: DIETARY_HINT_MAP expanded
- [x] Dietary hints: normalizeDietaryHint() implemented
- [x] Backwards compatibility verified

---

The orchestrator will continue iterations until limits are reached.
