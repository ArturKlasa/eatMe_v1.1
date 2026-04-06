# Shared vs Per-Dish Option Groups Analysis

## The Options

### Option A: Per-Dish Duplication (Current Approach)
Each dish has its own option_groups. "Spice Level" is created 15 times for 15 curries.

### Option B: Category-Level Shared Option Groups
option_groups can be linked to a `menu_category_id` instead of a `dish_id`. All dishes in that category inherit them.

### Option C: Restaurant-Level Option Group Templates
Define reusable option_group templates at restaurant level. Link to dishes via many-to-many table (`dish_option_group_templates`). A template can be assigned to any dish.

---

## Scale Impact

### Thai restaurant example: 15 curries, 2 shared options (spice + rice), plus 3 dishes with unique options

| Metric | Option A (per-dish) | Option B (category-level) | Option C (templates) |
|--------|--------------------|--------------------------|---------------------|
| option_group rows | 33 (15×2 + 3) | 5 (2 shared + 3 unique) | 5 templates |
| option rows (4 per group avg) | 132 | 20 | 20 |
| Join tables needed | 0 | 0 (FK on option_group) | 1 (dish_option_group_templates) |

### At 100K restaurants (50 dishes avg, 1.5 option_groups per dish avg)

| Metric | Option A | Option B | Option C |
|--------|----------|----------|----------|
| option_group rows | 7.5M | ~2M | ~2M |
| option rows | ~30M | ~8M | ~8M |
| Storage (option_groups ~200 bytes/row) | 1.5 GB | 400 MB | 400 MB |
| Storage (options ~150 bytes/row) | 4.5 GB | 1.2 GB | 1.2 GB |
| **Total option storage** | **6 GB** | **1.6 GB** | **1.6 GB** |

**Context:** Total DB at 100K restaurants is ~75 GB (dominated by embeddings at 47 GB). Option storage is 6 GB vs 1.6 GB — a 4.4 GB difference, which is **~6% of total DB**. Meaningful but not critical.

---

## Comparison

### 1. Data Model Complexity

| Aspect | Option A (per-dish) | Option B (category-level) | Option C (templates) |
|--------|--------------------|--------------------------|---------------------|
| Schema change | None — current model | Add nullable `menu_category_id` FK on option_groups, make `dish_id` nullable | New `option_group_templates` table + `dish_option_group_links` join table |
| Query for dish's options | Simple: `WHERE dish_id = X` | Must merge: `WHERE dish_id = X OR menu_category_id = dish.category_id` | Must join through link table |
| Mobile menu query | Simple nested select (current) | Needs union or two-pass query per dish | Needs join through templates |
| Feed candidate query | No change | Must resolve inherited options for embedding input | Must resolve templates |
| Edge case: one curry has different spice options | Natural — just give that dish different options | Must override category-level option for one dish — needs override logic | Assign different template to that dish |
| Edge case: dish in multiple categories | N/A | Which category's options apply? Ambiguous | Clean — explicitly linked |

### 2. Admin / Restaurant Owner UX

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Creating 15 curries with same options | Add "Spice Level" to each — tedious without tooling | Define once on category — clean | Define template once, assign to 15 dishes — clean |
| Updating rice price from $2 to $3 | Update 15 option_groups — tedious without tooling | Update 1 shared option_group — done | Update 1 template — done |
| AI menu extraction output | Natural — GPT outputs per-dish options | GPT would need to detect shared patterns and deduplicate — harder | GPT would need to detect patterns and create templates — hardest |
| Onboarding wizard complexity | Simple form per dish | Need "category-level options" UI concept — new UX pattern | Need "create template" + "assign to dishes" UI — more complex |
| **Can be solved with UI tooling?** | **Yes — "Copy options from another dish" button solves 90% of pain** | Inherently simpler for maintenance | Inherently simpler for maintenance |

### 3. Recommendation Engine Impact

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Embedding input | Option names read directly from dish's option_groups | Must resolve inherited options before building embedding text | Must resolve templates before building embedding text |
| Enrichment pipeline | Simple — options are on the dish | Extra query step to resolve category options | Extra query step to resolve templates |
| Any filter impact? | None — options don't affect hard/soft filters | None | None |
| Performance | Direct FK lookup | Category join + merge | Template join + merge |

### 4. Maintenance & Consistency

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Risk of inconsistency | Medium — copy-paste errors (one curry gets "Mild/Medium/Hot", another gets "Mild/Hot/Very Hot") | Low — single source of truth for shared options | Low — single source of truth |
| Updating a shared option | Must find and update all copies | Update once, propagates | Update once, propagates |
| Risk of accidental cascade | None — each dish is independent | Medium — changing category option affects all dishes silently | Medium — changing template affects all linked dishes |
| Debugging | Simple — everything is on the dish | Must check both dish-level and category-level | Must check dish-level + template links |

### 5. Migration Effort

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Schema migration | None | Alter option_groups: add menu_category_id, make dish_id nullable | New tables + FK relationships |
| Existing data migration | None | Could deduplicate existing option_groups — complex migration | Must create templates from existing data — complex migration |
| Backwards compatibility | Full | Queries must handle both dish-level and category-level | All queries must go through new join |
| Risk | None | Medium — dual-source queries can have subtle bugs | Medium — new abstraction layer |

---

## The "Copy Options" UI Alternative

Most of Option A's admin pain can be solved **without model changes** via a UI feature:

**"Copy options from another dish" button in the admin/onboarding wizard:**
1. Admin creates "Green Curry" with "Spice Level" and "Add Rice" option_groups
2. Creates "Red Curry" → clicks "Copy options from Green Curry"
3. Option_groups are duplicated onto Red Curry automatically
4. Repeat for remaining curries

**"Bulk update options" for maintenance:**
1. Admin selects 15 curry dishes
2. Changes rice price from $2 to $3
3. Applied to all selected dishes

This gives the same UX benefit as shared option_groups without any model complexity.

---

## Summary Scorecard

| Criteria | Option A (per-dish) | Option B (category-level) | Option C (templates) |
|----------|:---:|:---:|:---:|
| Model simplicity (25%) | **10/10** | 5/10 | 4/10 |
| Query simplicity (20%) | **10/10** | 5/10 | 5/10 |
| Admin UX (15%) | 5/10 (8/10 with copy UI) | **8/10** | **8/10** |
| AI extraction compatibility (15%) | **9/10** | 5/10 | 4/10 |
| Storage efficiency (10%) | 5/10 | **9/10** | **9/10** |
| Migration effort (10%) | **10/10** | 6/10 | 5/10 |
| Consistency / maintenance (5%) | 6/10 | **9/10** | **9/10** |
| **Weighted total** | **8.4/10** | **5.9/10** | **5.5/10** |
| **With "copy options" UI** | **9.0/10** | 5.9/10 | 5.5/10 |

---

## Recommendation: Option A — Per-Dish Duplication + Copy UI Tooling

### Why:
1. **Zero model complexity** — no new tables, no inheritance logic, no dual-source queries
2. **AI extraction just works** — GPT outputs per-dish options naturally, no deduplication step
3. **Mobile query stays simple** — current nested select unchanged
4. **Storage difference is marginal** — 6 GB vs 1.6 GB in a 75 GB database (6% difference)
5. **Admin pain is a UI problem, not a data model problem** — "Copy options from dish" and "Bulk update" solve it without touching the schema
6. **No accidental cascade risk** — changing one dish's options never silently affects other dishes
7. **Edge cases are free** — one curry with different spice options just works, no override logic needed

### The one real cost:
Consistency requires discipline (or UI tooling). If admin changes rice price on one curry but forgets the other 14, they're out of sync. The "bulk update" UI tool handles this.
