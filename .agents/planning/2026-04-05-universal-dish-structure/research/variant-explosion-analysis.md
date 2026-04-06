# Variant Explosion Analysis

## Clarification: What Are We Comparing?

The question is: **for configurable dishes (pick your protein, build-your-own, etc.), how many separate database rows do we create?**

All options assume a `parent_dish_id` FK to group variants for menu display. The difference is **what gets its own row vs. what stays as option metadata**.

### The 4 Options

| Option | What becomes a separate dish row | What stays as option_group metadata |
|--------|----------------------------------|-------------------------------------|
| **Option 1: Full Cartesian** | Every combination of every dimension (protein × sauce × size × ...) | Nothing — all combos are rows |
| **Option 2: Primary Dimension** | The choice that most affects taste/dietary profile (usually protein) | Sauce, size, toppings, extras |
| **Option 3: Dietary-Significant** | Only choices that change allergen/dietary profile (merge salmon+tuna into "Fish") | Everything else, including individual proteins within same dietary group |
| **Option 0: No Variants** | Nothing — base dish only | All choices are option_groups |

### Concrete Example: Poke Bowl
Menu says: "Choose protein (Salmon, Tuna, Shrimp, Chicken, Tofu), sauce (Ponzu, Soy, Spicy Mayo), size (Regular, Large)"

| Option | Dish rows created | Option groups on each row |
|--------|-------------------|---------------------------|
| **Full Cartesian** | 5 × 3 × 2 = **30 rows** ("Poke Bowl — Salmon + Ponzu + Regular", etc.) | None |
| **Primary Dimension** | **5 rows** ("Poke Bowl — Salmon", "— Tuna", "— Shrimp", "— Chicken", "— Tofu") | Sauce (3 choices), Size (2 choices) |
| **Dietary-Significant** | **4 rows** ("— Fish" merges Salmon+Tuna, "— Shrimp", "— Chicken", "— Tofu") | Sauce, Size, plus individual fish choice within "Fish" row |
| **No Variants** | **1 row** ("Poke Bowl") | Protein (5), Sauce (3), Size (2) |

---

## Baseline Assumptions

| Parameter | Value | Source |
|-----------|-------|--------|
| Target scale | 100,000 restaurants | User requirement |
| Avg dishes per restaurant | 50 base dishes | Industry average |
| Configurable dishes | ~10 per restaurant (20%) | Estimated |
| Breakdown of configurable | 5 protein-choice, 3 size-variant, 2 build-your-own | Estimated |
| Embedding size | 6 KB per row (1536 × 4 bytes) | pgvector |
| Embedding cost | ~$0.0001 per dish | OpenAI text-embedding-3-small |
| Current Supabase tier | Free (500 MB) | Current setup |
| generate_candidates() limit | 200 candidates | Hardcoded |
| Diversity cap | 3 dishes per restaurant | Current logic |

---

## Comprehensive Comparison Table

### 1. Scale & Storage

| Aspect | Option 0: No Variants | Option 1: Full Cartesian | Option 2: Primary Dimension | Option 3: Dietary-Significant |
|--------|----------------------|--------------------------|----------------------------|-------------------------------|
| Rows per restaurant | 50 | 184 | 78 | 67 |
| Total rows (100K restaurants) | 5M | 18.4M | 7.8M | 6.7M |
| Embedding storage | 30 GB | 110 GB | 47 GB | 40 GB |
| HNSW index size | ~10 GB | ~35 GB | ~15 GB | ~13 GB |
| Row data + B-tree indexes | ~7 GB | ~25 GB | ~11 GB | ~9 GB |
| **Total DB storage** | **~50 GB** | **~170 GB** | **~75 GB** | **~65 GB** |
| Row multiplier vs baseline | 1x | 3.7x | 1.56x | 1.34x |
| Storage multiplier vs baseline | 1x | 3.4x | 1.5x | 1.3x |

### 2. Cost

| Aspect | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| One-time embedding cost | $500 | $1,840 | $780 | $670 |
| Ongoing embed cost (100 restaurants/day) | $0.50/day | $1.84/day | $0.78/day | $0.67/day |
| Supabase tier at 100 restaurants | Free | Free | Free | Free |
| Supabase tier at 1K restaurants | Free | Pro ($25/mo) | Free/Pro edge | Free |
| Supabase tier at 10K restaurants | Pro ($25/mo) | Enterprise | Pro ($25/mo) | Pro ($25/mo) |
| Supabase tier at 100K restaurants | Self-hosted | Self-hosted | Self-hosted | Self-hosted |
| Estimated monthly at 100K (self-hosted) | $80-150/mo | $250-400/mo | $120-200/mo | $100-180/mo |

### 3. Recommendation Quality

| Aspect | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| Map pin label | "Poke Bowl" | "Poke Bowl — Salmon + Ponzu" | "Poke Bowl — Salmon" | "Poke Bowl — Fish" |
| Pin specificity | Too vague | Too verbose | **Just right** | Vague ("Fish"?) |
| User appeal of pin | Low — what protein? | Low — info overload | **High — clear & appetizing** | Medium — imprecise |
| Embedding quality | Generic (covers all variants) | Hyper-specific (many near-duplicates) | **Meaningfully distinct per protein** | Slightly diluted (salmon≈tuna) |
| Preference vector learning | Can't learn protein preference | Learns sauce+size preference (noise) | **Learns protein preference** | Can't distinguish salmon vs tuna lovers |
| Can recommend "Salmon" specifically? | No | Yes | **Yes** | No (only "Fish") |
| Candidate pool efficiency | Clean — 200 unique dishes | Wasteful — many near-duplicate combos | **Good — distinct variants only** | Decent — slightly fewer than Option 2 |

### 4. Filter Accuracy

| Filter | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| **Vegan hard filter** | BROKEN — includes/excludes entire dish | Correct | **Correct** | Correct |
| **Fish allergy** | BROKEN — can't distinguish proteins | Correct | **Correct** | Correct |
| **Shellfish allergy** | BROKEN | Correct | **Correct** | Correct |
| **Protein type boost (+0.20)** | BROKEN — dish has all proteins | Correct | **Correct** | Diluted — "Fish" row gets boost for both salmon+tuna |
| **Meat subtype boost (+0.10)** | BROKEN | Correct | **Correct** | BROKEN — no specific protein |
| **Price range filter** | BROKEN — which price? $12-$18 range | Correct but redundant precision | **Correct — exact price per protein** | Partial — "from $14" for merged Fish row |
| **Calorie range filter** | Inaccurate — avg calories across all | Correct | **Correct per protein** | Approximate — avg of merged proteins |
| **Spice level filter** | Works (same across variants) | Works | **Works** | Works |
| **Religious restrictions** | BROKEN — can't distinguish halal chicken from non-halal | Correct | **Correct** | Correct |
| **Ingredient avoidance** | Partial — flags all proteins as present | Correct | **Correct** | Partial — can't avoid salmon but allow tuna |
| **Overall filter accuracy** | **Poor** | **Perfect** | **Excellent** | **Good but imprecise** |

### 5. Price Handling

| Aspect | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| Price on recommended pin | "$12-$18" (range) or "from $12" | "$16" (exact, incl. sauce+size) | **"$16" (exact per protein)** | "from $14" (range within dietary group) |
| Price filter accuracy | Poor — range overlaps everything | Perfect but over-fragmented | **Excellent** | Partial — merged price |
| Price in menu view | Show option deltas | Each row shows full price | **Each protein shows price, size/sauce as +$X delta** | Confusing — "Fish $14-$16" |
| `display_price_prefix` usage | `from` for all configurable | `exact` for all | **`exact` for protein rows, `from` for size-variant dishes** | Mix of `from` and `exact` |

### 6. Data Entry & Maintenance

| Aspect | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| Rows admin creates per configurable dish | 1 + option groups | 30+ (impractical manually) | **1 parent + 5 variants** | 1 parent + 3-4 dietary groups |
| AI menu scan extraction | Easy — one dish + options | Very hard — enumerate all combos | **Feasible — detect "choose protein" pattern** | Hard — requires dietary reasoning |
| Menu update effort | Low | Very high (update 30 rows) | **Moderate (update 5 rows)** | Moderate (update 4 rows) |
| Adding a new protein option | Add to option_group | Create N new combo rows | **Create 1 new variant row** | Determine dietary group, maybe create row |
| Removing a protein option | Remove from option_group | Delete N combo rows | **Delete 1 variant row** | Determine if group still valid |
| Error potential | Low | Very high — missing combos | **Low** | Medium — wrong dietary grouping |

### 7. Mobile App UX — Menu View

| Aspect | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| Menu query payload | 50 rows/restaurant | 184 rows/restaurant | **78 rows/restaurant** | 67 rows/restaurant |
| Presentation of Poke Bowl | "Poke Bowl $12-$18" with nested protein/sauce/size dropdowns | 30 separate line items (unusable) | **"Poke Bowl" header with 5 protein rows + sauce/size options** | "Poke Bowl" header with 4 dietary group rows (confusing labels) |
| Readability | Compact but opaque | Extremely cluttered | **Clean and informative** | Awkward grouping |
| Matches real-world menu layout | Partially | No | **Yes — mirrors how menus show "choose your protein"** | No — menus don't say "Fish option" |
| Parent-child grouping needed | Not strictly | Essential (184 rows chaos) | **Yes — clean grouping** | Yes |

### 8. Recommendation Engine Performance

| Aspect | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| generate_candidates() pool size (10km radius, ~500 restaurants) | ~25K rows | ~92K rows | **~39K rows** | ~33.5K rows |
| pgvector HNSW query time (est.) | ~5ms | ~15-20ms | **~8ms** | ~7ms |
| Diversity cap effectiveness | Works fine | **Broken** — 3 slots eaten by same dish combos | **Works with parent-level cap** | Works with parent-level cap |
| Feed cache hit rate | High — fewer permutations | Low — more filter/variant combos | **Good** | Good |
| Embedding distinctiveness | Low for configurable dishes | Very low between similar combos | **High — each protein genuinely different** | Medium — merged proteins dilute signal |

### 9. Edge Cases & Complexity

| Aspect | Option 0 | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|----------|
| What is "primary dimension"? | N/A | N/A | **Must define per dish_kind — protein for bowls, base for pizza, etc.** | N/A |
| Combo meals (burger+fries+drink) | Simple — one row | Explodes (3 burgers × 4 sides × 5 drinks = 60) | **Burger variants as rows, sides/drinks as option_groups** | Same as Option 2 but merges similar burgers |
| Build-your-own with no clear primary | One row, all options | Full explosion | **Pick the dimension with most dietary impact** | Group by dietary profile |
| Standard fixed dishes | Perfect | Perfect | **Perfect (no variants needed)** | Perfect |
| Market-price / dynamic dishes | Simple | N/A — can't pre-compute combos | **Works — each variant can have `display_price_prefix: 'market_price'`** | Works |
| Implementation complexity | Simplest | Most complex (generation + dedup) | **Moderate — clear rules** | High — dietary equivalence logic |

---

## Summary Scorecard

| Criteria (weighted) | Option 0 | Option 1 | Option 2 | Option 3 |
|---------------------|----------|----------|----------|----------|
| Recommendation quality (25%) | 2/10 | 7/10 | **9/10** | 5/10 |
| Filter accuracy (20%) | 3/10 | 10/10 | **9/10** | 7/10 |
| Database scale/cost (15%) | 10/10 | 2/10 | **7/10** | 8/10 |
| Mobile UX — map pin (10%) | 3/10 | 4/10 | **9/10** | 5/10 |
| Mobile UX — menu view (10%) | 6/10 | 1/10 | **9/10** | 5/10 |
| Data entry & maintenance (10%) | 9/10 | 1/10 | **7/10** | 5/10 |
| AI extraction feasibility (5%) | 9/10 | 2/10 | **8/10** | 4/10 |
| Implementation complexity (5%) | 10/10 | 3/10 | **7/10** | 5/10 |
| **Weighted total** | **4.6/10** | **4.2/10** | **8.4/10** | **6.0/10** |

---

## Recommendation: Option 2 — Primary Dimension

Resolve the **primary dimension** (the choice that most affects taste, dietary profile, and allergens) into separate dish rows. Everything else stays as option_group metadata. Use `parent_dish_id` to group variants for menu display.

### What "primary dimension" means per dish type:
| Dish pattern | Primary dimension (= separate rows) | Secondary dimensions (= option_groups) |
|-------------|--------------------------------------|----------------------------------------|
| Protein-choice bowl/salad | Protein (salmon, chicken, tofu...) | Sauce, size, toppings |
| Pizza | Base type if dietary-relevant (meat vs veggie), otherwise none | Size, extra toppings |
| Burger | Patty type (beef, chicken, veggie) | Toppings, size, extras |
| Build-your-own | Main protein or base | Everything else |
| Combo meal | Main dish variant | Side choice, drink choice |
| Size-only variant | None (size as option_group) | Size |
| Standard fixed dish | None (just one row) | Optional add-ons |

### Key design requirements:
1. `parent_dish_id` FK on dishes table (NULL = standalone or parent)
2. Variant rows are full dish rows with own price, calories, allergens, dietary_tags, embedding
3. Parent row is display-only (not included in feed/recommendation)
4. Diversity cap: max 1 variant per `parent_dish_id` in feed results
5. Menu view groups by parent, shows variant prices individually, secondary options as +$X deltas
