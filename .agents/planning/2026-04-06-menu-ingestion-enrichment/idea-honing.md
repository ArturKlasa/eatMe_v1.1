# Idea Honing: Menu Ingestion & Enrichment Improvements

## Requirements Clarification

### Q1: What is the primary pain point driving this initiative?

You mentioned three areas: onboarding, menu scan, and enrichment. From a user/business perspective, what's the biggest problem you're experiencing today? For example:

- **Extraction quality** — GPT-4o Vision misses dishes, misclassifies patterns, or produces low-confidence results that require heavy manual correction
- **Admin review burden** — Too much manual work needed after scan to fix/complete dishes before committing
- **Enrichment gaps** — Dishes end up with poor embeddings because enrichment doesn't have enough signal, leading to bad recommendations
- **Pattern support** — The scan doesn't detect complex dish patterns (templates, combos, experiences) well enough
- **Scale/cost** — Large menus fail or cost too much in API calls
- **Something else entirely**

**A1:**

After a deep codebase analysis, the user confirmed the following priorities:

**#1 Priority — Menu-scan can't create template/experience/combo dishes (Issue 4)**
All scanned dishes are forced to 'standard' even when GPT detects patterns like "Build Your Bowl — choose protein." Must be addressed.

**Must also address:**
- GPT-4o Vision prompt must align with our dish model (dish_kind, parent-child, option groups)
- Dish price should be stored in a separate DB column so embeddings don't need price signal
- Improve ingredient structure
- Issue 5: Enrichment embedding_input is weak (truncated description, no cuisine context, flat option names)
- Issue 6: GPT Vision prompt doesn't explain multi-page merge; merge deduplication is naive
- Issue 7: AI-inferred ingredients underutilized (never matched to canonical, notes field unused)
- Issue 8: Completeness threshold arbitrary (hardcoded 3 ingredients, no dish_kind weighting)
- Issue 9: No parent-child variant UI in either flow (serves, price_per_person, display_price_prefix have no UI)
- Issue 13: 'combo' missing from DISH_KINDS constants

**Explicitly out of scope (for now):**
- Issues 1-3 (silent data loss, atomic transactions, sequential ingredient matching) — not prioritized
- Issues 10-12, 14 (confidence calibration, dietary hint map, debounce, $0 price default) — not prioritized

---

### Q2: How should dish price be stored separately for embedding purposes?

You mentioned storing dish price in a separate database column so embeddings don't need to account for price. Currently:
- `dishes.price` exists as NUMERIC
- `dishes.price_per_person` is a generated column (price / serves)
- Embedding input includes: name, dish_type, description (120 chars), ingredients, options — price is NOT currently in the embedding

Since price is already in its own column and not in the embedding, could you clarify what you mean? Are you thinking about:

- **A)** A price tier/bucket column (e.g., 'budget' | 'mid' | 'premium' | 'luxury') derived from price, useful for filtering/recommendations without exact amounts?
- **B)** Storing the original menu price separately from a normalized/display price (e.g., handling currency conversion, market price dishes)?
- **C)** Something else — perhaps separating price from the dish identity entirely so the same dish at different price points shares an embedding?

**A2:**

Price should NOT influence the dish embedding vector. This is already the case — the current `buildEmbeddingInput()` does not include price. Confirmed as a design constraint going forward: embeddings represent dish identity (what the dish IS), not commercial attributes (what it costs). Price filtering should happen via SQL WHERE clauses on `dishes.price`, not via vector similarity.

No code change needed — just a confirmed design principle.

---

### Q3: What do you mean by "improve our ingredients structure"?

The current ingredient model is:
- `canonical_ingredients` table (id, canonical_name, ingredient_family_name, is_vegetarian, is_vegan)
- `ingredient_aliases` table (display_name → canonical_ingredient_id, language, search_vector)
- `dish_ingredients` junction (dish_id, ingredient_id, quantity)
- `canonical_ingredient_allergens` junction (canonical_ingredient_id → allergen_id)
- `canonical_ingredient_dietary_tags` junction (canonical_ingredient_id → dietary_tag_id)

What aspects are you looking to improve? For example:

- **A)** Richer ingredient taxonomy — adding subcategories, nutrition data, or hierarchical grouping (e.g., "proteins > poultry > chicken > chicken breast")
- **B)** Better ingredient matching during menu scan — the sequential DB lookups that timeout on large menus, or the translation pipeline
- **C)** Ingredient role/context — distinguishing "chicken as main protein" vs "chicken stock as base" vs "chicken garnish"
- **D)** Connecting ingredients to option groups — so template dishes have ingredients per option, not per dish
- **E)** Something else?

**A3:**

Ingredient structure improvements are OUT OF SCOPE for this initiative. Will be addressed separately.

Updated scope removes: ingredient structure changes, ingredient matching performance (issue 5 partially — ingredient-related parts only).

---

### Q4: For menu-scan dish pattern support, how much should the AI auto-detect vs. the admin manually assign?

When GPT-4o scans a menu image and encounters something like "Poke Bowl — Choose: Salmon / Tofu / Shrimp ($14/$12/$13)", it needs to decide:
- dish_kind = 'template'
- is_parent = true, with 3 variants
- option group: "Choose protein", selection_type: 'single'

Two extremes:

**A) AI does heavy lifting** — GPT-4o detects patterns, sets dish_kind, creates parent-child structure, and suggests option groups. Admin reviews and corrects mistakes.

**B) AI extracts raw data, admin structures it** — GPT-4o extracts all dishes as flat list with hints (e.g., "appears to be build-your-own"). Admin uses the review UI to set dish_kind, create parents, group variants, and define option groups.

**C) Hybrid** — AI proposes structure (dish_kind, parent-child, option groups) but the review UI makes it easy to restructure. Admin confirms or overrides.

Which approach fits your workflow best?

**A4:**

**Option C — Hybrid (AI Proposes, Admin Reviews)** confirmed.

Key decisions:
- GPT-4o Vision already extracts `is_parent`, `dish_kind`, `variants[]` — this data must be preserved through the entire pipeline (currently discarded due to missing TypeScript type fields)
- Admin review UI shows AI proposals as visual groupings with Accept/Edit/Dismiss controls
- Admin can override: dish_kind dropdown, "ungroup variants" button, "group as variants" multi-select for cases AI missed
- DB schema already supports this (migration 073: parent_dish_id, is_parent, dish_kind columns exist)
- restaurantService.ts already has parent-child insertion logic

Implementation scope:
1. Add is_parent, dish_kind, variants to all TypeScript types (RawExtractedDish → EnrichedDish → EditableDish → ConfirmDish)
2. Preserve fields through merge/enrich pipeline
3. Review UI: grouped variant cards with accept/reject/override controls
4. Confirm endpoint: use existing restaurantService parent-child insertion logic
5. Admin override: dish_kind dropdown, ungroup button, manual grouping

---

### Q5: For the enrichment improvements (embedding_input, completeness, AI-inferred data), what is the primary goal?

The enrichment pipeline generates dish embeddings for recommendations. Currently:

**Embedding quality issues:**
- Description truncated to 120 chars (loses detail)
- No cuisine context from the restaurant (e.g., "Thai" vs "French" changes dish interpretation)
- Template/experience dishes get flat option name lists instead of structured group metadata
- Child variants don't inherit any context from their parent dish
- `notes` field from AI enrichment (cuisine/prep context) is captured but never used in embedding

**Completeness logic issues:**
- Hardcoded threshold: ≥3 ingredients = "complete", skips AI enrichment
- No weighting by dish_kind (a template dish's completeness comes from option groups, not ingredients)
- A dish with rich description but 0 ingredients is "sparse" — triggers AI even when semantically complete

**AI-inferred data underutilization:**
- `inferred_ingredients` stored in payload only, never matched to canonical DB
- `inferred_dish_type` used in embedding but not for dish_category assignment
- `notes` field completely unused
- AI-suggested allergens never applied (even at high confidence)

What's your primary goal here?

- **A)** Better recommendations — improve embedding quality so users get better dish matches
- **B)** Reduce unnecessary AI calls — smarter completeness logic to avoid enriching already-good dishes
- **C)** Use AI data more aggressively — auto-apply inferred ingredients/allergens/categories when confidence is high
- **D)** All of the above, prioritized in this order

**A5:**

**All of the above (D)**, prioritized as:
1. Better embedding quality (recommendations)
2. Smarter completeness logic (reduce waste)
3. More aggressive AI data usage (auto-apply when confident)

---

### Q6: For auto-applying AI-inferred data, what confidence threshold and review model do you want?

When enrichment infers ingredients/allergens/dish_type with high confidence, we could:

**A) Auto-apply silently** — If AI confidence is high, write inferred ingredients to `dish_ingredients`, compute allergens, assign `dish_category_id`. No admin review. Flag with `enrichment_source='ai'` for traceability.

**B) Auto-apply with admin notification** — Same as A, but surface AI-applied changes in an admin dashboard (e.g., "12 dishes had AI-inferred allergens applied today"). Admin can review and revert.

**C) Stage for approval** — AI inferences are stored as suggestions (new columns like `ai_suggested_allergens`, `ai_suggested_ingredients`). Admin must explicitly accept before they affect the dish record.

Which model fits your needs? Consider that restaurants could have hundreds of dishes — option C creates a review backlog.

**A6:**

**Option C — Stage for approval.** AI inferences are stored as suggestions that admin must explicitly accept. No auto-application to canonical dish data.

This means:
- `enrichment_payload` continues to hold AI-inferred data (ingredients, allergens, dish_type)
- New UI surface needed: admin can review AI suggestions per dish and accept/reject
- Accepted suggestions get written to canonical fields (dish_ingredients, allergens, dish_category_id)
- Rejected suggestions are dismissed (optionally flagged so AI doesn't re-suggest)
- Trade-off: review backlog at scale, but full human control over data quality

---

### Q7: How should the GPT-4o Vision prompt be improved for multi-page merge?

Currently, each menu image is sent to GPT-4o independently. The prompt says "one food menu + one drink menu" but doesn't tell GPT that other images exist or will be merged. This causes:

- GPT may create separate menus for what should be merged categories
- Merge logic deduplicates by dish name only, ignoring price differences (potential variant loss)
- Null-named categories from different pages all merge into one bucket

Two approaches:

**A) Keep per-image extraction, improve merge logic** — Each image processed independently (current approach), but improve the merge step:
  - Smarter category matching (fuzzy, not just exact name)
  - When duplicate dish names have different prices, flag as potential variants instead of dropping
  - Better null-category handling
  - Add a note to the GPT prompt: "This is one page of a multi-page menu. Other pages will be merged with yours. Focus only on what you see."

**B) Multi-image context** — Send all images (or thumbnails) to GPT in one call so it can reason across pages. More expensive (larger token input), but GPT can resolve cross-page categories itself.

Which approach?

**A7:**

**Option A — Per-image extraction with improved merge logic.** Four specific improvements:

1. **Fuzzy category matching** — Normalize names + synonym map (e.g., "Appetizers" = "Starters" = "APPETIZERS")
2. **Variant detection on duplicates** — Same dish name + different price → flag as potential variants for admin review instead of silently dropping
3. **Null-category handling** — Assign placeholder per page index, don't merge all nulls together
4. **Prompt addition** — Tell GPT: "This is one page of a multi-page menu. Other pages will be merged. Focus only on what you see."

Rationale: Multi-image context (Option B) is 10-20x more expensive, hits output token limits, and is a single point of failure. Per-image with better merge solves ~90% of issues.

Optional future enhancement: lightweight GPT-4o-mini text-only reconciliation pass on merged JSON to flag remaining conflicts.

---

### Q8: For the review UI — should parent-child variant management also be available in the onboarding flow, or just menu-scan?

Currently neither the menu-scan review UI nor the onboarding wizard can manage parent-child variants, dish_kind, serves, or display_price_prefix. You flagged this as Issue 9.

Options:

**A) Menu-scan review UI only** — Add variant management (grouped cards, accept/reject AI proposals, dish_kind dropdown, override controls) only to the admin menu-scan flow. Onboarding wizard stays as-is.

**B) Both flows** — Add variant management to both menu-scan review and the onboarding wizard. The onboarding wizard already supports dish_kind and option groups but lacks parent-child UI and serves/display_price_prefix.

**C) Both flows + shared dish editor component** — Extract a reusable DishEditor component used by both flows, ensuring consistent capabilities and reducing duplicate code.

Which scope?

**A8:**

**Option A — Menu-scan review UI only** for full variant management. Rationale:

- Menu-scan is admin-facing (bulk processing, AI proposals) — needs power tools
- Onboarding is restaurant-owner-facing (manual creation) — should stay simple; already has dish_kind + option groups
- Different interaction patterns: "accept AI proposal" vs "build from scratch" need different UIs
- Scope control: avoid doubling effort across two divergent flows

Minor additions to onboarding (not full variant management):
- Add `serves` field (simple number input)
- Add `display_price_prefix` dropdown
- These are small form field additions, not a redesign

Shared DishEditor component (Option C) deferred to a future initiative when both flows stabilize.

---

### Q9: For the GPT-4o Vision prompt alignment with our dish model — should we expand the prompt to cover all dish patterns from the universal dish structure?

The current prompt handles:
- Standard dishes (default)
- Parent-child variant detection ("choose your protein/base" pattern)
- dish_kind: standard | template | combo | experience

The universal dish structure defines additional patterns:
- Customizable (add-ons) — burger + extra cheese
- Build-Your-Own (multi-step) — poke bowl, salad builder
- Variant (size/quantity) — small/large pizza, 6 vs 12 wings
- Small Plates / Shared — tapas, dim sum, mezze
- Specials / Dynamic — daily specials, market price
- Group / Bulk — family meals, party platters
- Experience (interactive) — hot pot, Korean BBQ, fondue
- Combo / Set — burger + fries + drink

Some of these map to dish_kind + option_groups. Others are metadata (serves, display_price_prefix). Should the GPT prompt:

**A) Cover all patterns explicitly** — Add detection rules for each pattern type, mapping to our DB fields (dish_kind, is_parent, serves, display_price_prefix, option_groups structure)

**B) Focus on the four dish_kinds** — Only detect standard/template/combo/experience. Other patterns (size variants, shared plates, etc.) handled by enrichment or admin review.

**A9:**

**Option A — Cover all patterns explicitly**, mapped to existing DB fields. The GPT-4o Vision prompt is the only point that sees menu layout — visual cues like "serves 4", "Market Price", "Small $8 / Large $12" are lost after extraction.

Pattern → field mapping:

| Menu Pattern | dish_kind | is_parent | serves | display_price_prefix |
|---|---|---|---|---|
| Standard dish | standard | false | 1 | exact |
| Size variants (S/M/L) | standard | true + variants | 1 | from |
| Build-your-own | template | true + variants | 1 | from |
| Combo/set meal | combo | true + variants | 1 | exact |
| Experience (hot pot, BBQ) | experience | true + variants | varies | per_person |
| Market price | standard | false | 1 | market_price |
| Family/sharing plate | standard | false | N | exact |
| Daily special | standard | false | 1 | exact |
| "From $X" pricing | varies | varies | varies | from |

New fields GPT must extract: `serves` (integer), `display_price_prefix` (exact|from|per_person|market_price|ask_server).
Keep "if unsure, default to standard" fallback. Pattern rules should be examples-heavy.

---

### Q10: Do you see the scope as complete, or are there additional areas you'd like to address?

Let me summarize what's in scope for this initiative:

**Core deliverables:**
1. **Pipeline wiring** — Preserve is_parent, dish_kind, variants through all TypeScript types (RawExtractedDish → EnrichedDish → EditableDish → ConfirmDish → DB)
2. **GPT-4o Vision prompt overhaul** — Cover all dish patterns, extract serves, display_price_prefix, better parent-child detection with examples
3. **Multi-page merge improvements** — Fuzzy category matching, variant detection on duplicate names, null-category fix, prompt note about multi-page context
4. **Menu-scan review UI** — Grouped variant cards with accept/reject/override, dish_kind dropdown, ungroup button, manual grouping
5. **Confirm endpoint update** — Pass dish_kind, is_parent, parent_dish_id, serves, display_price_prefix to DB using existing restaurantService logic
6. **Enrichment: better embeddings** — Longer description (>120 chars), cuisine context from restaurant, structured option group metadata, parent context for child variants, use AI notes field
7. **Enrichment: smarter completeness** — Weighted by dish_kind (templates use option groups, not ingredient count), consider description richness
8. **Enrichment: staged AI suggestions** — Store inferred ingredients/allergens/categories as suggestions; admin reviews and accepts/rejects
9. **Add 'combo' to DISH_KINDS constants**
10. **Onboarding minor additions** — serves field, display_price_prefix dropdown

**Additional deliverable:**
11. **Expand DIETARY_HINT_MAP** — Add emoji variants (🌿), regional spellings ("Vegetariano", "Végétarien"), common abbreviations ("egg-free", "soy-free", "paleo"), symbol variants ("GF*"). Part of the GPT-4o Vision prompt overhaul.

**Out of scope:**
- Ingredient structure changes
- Silent data loss / atomic transactions (issues 1-3)
- Confidence calibration, debounce, $0 price default (issues 10, 12, 14)
- Shared DishEditor component extraction
- Sequential ingredient matching performance

Is this scope complete, or would you like to add/remove anything?

**A10:**

Scope confirmed as complete. No additions or removals.
