# Research: AI Auto-Detect vs. Admin Manual Assignment for Dish Patterns

## Key Finding: GPT-4o Vision Already Extracts Patterns — Data Is Just Discarded

The most important discovery is that **the GPT-4o Vision system prompt already asks for `is_parent`, `dish_kind`, and `variants[]`** in its JSON schema (route.ts lines 44-98). The prompt includes detailed rules for detecting "choose your protein/base/main" patterns and returns structured parent-child data.

**However, this data is lost at every stage of the pipeline:**

| Stage | is_parent | dish_kind | variants[] |
|-------|-----------|-----------|------------|
| GPT-4o Vision output | Extracted | Extracted | Extracted |
| RawExtractedDish type | **MISSING** | **MISSING** | **MISSING** |
| EnrichedDish type | **MISSING** | **MISSING** | **MISSING** |
| EditableDish type | **MISSING** | **MISSING** | **MISSING** |
| ConfirmDish type | **MISSING** | **MISSING** | **MISSING** |
| confirm/route.ts | **NOT SAVED** | **NOT SAVED** | **NOT SAVED** |
| Database (schema) | Column exists | Column exists | FK exists |

The TypeScript interfaces strip these fields. The confirm endpoint doesn't write them. The DB schema is ready but never receives the data.

## Option Analysis

### Option A: AI Does Heavy Lifting — RECOMMENDED as basis

**Pros:**
- GPT-4o Vision already does this work — we're just throwing it away
- No new AI calls needed (zero additional cost)
- Vision model sees the actual menu layout (indentation, grouping, price columns) — ideal for pattern detection
- restaurantService.ts already has parent-child insertion logic (lines 448-556)

**Cons:**
- GPT may misclassify some patterns (needs admin override ability)
- Confidence varies with image quality

### Option B: Admin Does Everything Manually — NOT RECOMMENDED

**Pros:**
- Maximum control

**Cons:**
- 6-8 hours implementation vs 4-5 for hybrid
- Complex nested state management (parent tracking across dishes)
- High admin cognitive load, especially for large menus (100+ dishes)
- Easy to create invalid states (orphaned children, circular refs)
- Tedious for the common case where AI would be correct

### Option C: Hybrid (AI Proposes, Admin Reviews) — STRONGEST RECOMMENDATION

**Pros:**
- Leverages existing GPT-4o extraction (zero new AI cost)
- Admin sees proposals as visual groupings, clicks to accept/reject
- Simple UI: "These 3 dishes appear to be variants of 'Poke Bowl' — Accept / Edit / Dismiss"
- Hard to create invalid states (proposals are pre-validated)
- Scales to any menu size
- Easy override: dish_kind dropdown + "ungroup" button for corrections

**Cons:**
- Slightly more UI work than pure AI (need accept/reject controls)

## Recommendation: Option C (Hybrid)

The implementation is primarily **wiring existing data through the pipeline**, not building new AI:

1. **Add fields to TypeScript types** (RawExtractedDish → EnrichedDish → EditableDish → ConfirmDish)
2. **Preserve fields through merge/enrich** (spread operator already copies them; just need types)
3. **Show in review UI** as grouped cards with accept/reject
4. **Pass to confirm endpoint** which uses existing restaurantService.ts parent-child insertion logic
5. **Admin override**: dish_kind dropdown, "ungroup variants" button, "change parent" selector

Estimated effort: 4-5 hours total (most of it is frontend UI for grouped display + override controls).
