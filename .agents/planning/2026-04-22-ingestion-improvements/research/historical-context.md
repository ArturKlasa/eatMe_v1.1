# Historical Planning Context

Summary of past planning cycles relevant to this work. Not all decisions listed are necessarily shipped — verify against current code when inheriting.

## 2026-04-05: Universal Dish Structure

**Problem solved:** Original dish model was too flat to represent real-world menus (customizable, combos, buffets, build-your-own).

**Shipped design:**
- `dish_kind` enum: `standard | template | experience | combo`
- Parent-child variant model via `parent_dish_id` + `is_parent` on `dishes`. Only the *primary dimension* is resolved into separate rows (protein for templates, main-dish for combos, dietary-profile for experiences). Secondary choices stay as `option_group` metadata. Rationale: full cartesian explosion would grow rows ~3.7x; primary-dimension approach ~1.56x.
- Parent dishes excluded from recommendation feed (`WHERE is_parent = false` in `generate_candidates()`).
- Menu table: `schedule_type` ('regular' | 'daily' | 'rotating').
- `serves` (int), `price_per_person` (GENERATED STORED = price/serves).
- Migration: `073_universal_dish_structure.sql`.

**Rationale worth inheriting:** the primary-dimension constraint. Without it we face row explosion, embedding cost, and diversity problems in the feed.

**Known limits:** variant embedding quality not A/B tested; build-your-own with no clear primary axis has only fallback rules.

## 2026-04-06: Menu Ingestion & Enrichment Improvements

**Problem solved:** GPT-4o Vision was already emitting `is_parent`, `dish_kind`, `variants[]`, but TS types dropped those fields silently. Enrichment used naive completeness rules. AI-inferred data was not surfaced.

**Shipped design (per plan doc — verify against code):**
- Wire `is_parent`, `dish_kind`, `variants[]`, `serves`, `display_price_prefix` through all TS types (`RawExtractedDish` → `EnrichedDish` → `EditableDish` → `ConfirmDish`).
- Switched OpenAI extraction to Structured Outputs (`json_schema` with strict:true). Decision tree in prompt covering standard / size-variant / template / combo / experience / family / market-price / daily-special.
- Multi-page merge: fuzzy category matching (normalize → synonym → string similarity ≥0.85); flag same-name-different-price as potential variants.
- Review UI: indented variant card clusters with Accept/Reject/Edit + keyboard shortcuts; `dish_kind` dropdown per dish; Ungroup; "Group as variants" multi-select.
- Confirm endpoint: three-pass insert (parents → children → linkage).
- Embedding: raised desc to 300 chars; labeled NL format including cuisine; child variants prepend parent name+ingredients. Target 60–120 tokens.
- Completeness: weighted scoring; template/experience complete if ≥3 option names (ingredients irrelevant).
- Staged AI suggestions: `enrichment_payload.inferred_allergens`, `inferred_dish_category`; `enrichment_review_status` column.
- Migration: `074_*` (enrichment_review_status).

**Out of scope (deferred):** ingredient hierarchy/nutrition, atomic transactions, shared `DishEditor` extraction, AI confidence calibration thresholds.

## 2026-04-10: Admin Restaurant Ingestion

**Problem solved:** No bulk restaurant creation; onboarding was slow and unreliable.

**Shipped design:**
- Google Places (Nearby Search New + FieldMask) as primary source; CSV as secondary.
- **No blocking review.** Restaurants imported immediately; warning flags computed at query time: `missing_cuisine`, `missing_hours`, `missing_contact`, `missing_menu`, `possible_duplicate`.
- Dedup: exact `google_place_id` (silent skip) + fuzzy name + 200m proximity (insert, flag).
- `restaurant_import_jobs` (job tracking), `google_api_usage` (cost controls).
- "Scan Menu" link from restaurant row → `/admin/menu-scan?restaurant_id=…`.
- Migration: `080_*`.

**Out of scope:** batch menu scanning, data refresh from Google, update mode, OSM supplementation, import history page.

**Known limits:** cuisine inferred from Google place types; 24h/overnight hours need special handling; fuzzy dedup can false-positive.

## Key takeaways for this cycle

1. The parent-child primary-dimension architecture is sound. Don't break it; extend carefully.
2. The 2026-04-06 plan claims a lot of review-UI work shipped. The current complaint ("review page needs rework") suggests either (a) it didn't land as planned, or (b) it landed but is still insufficient. **Verify actual state against plan claims before scoping new work.**
3. The dish_kind taxonomy was last revisited on 2026-04-05; adding new kinds will need to preserve the parent-child/primary-dimension contract or introduce a new modeling dimension.
