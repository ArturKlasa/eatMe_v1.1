# Research: Embedding Quality Strategies for Dish Recommendations

## Signal Importance (ranked)
1. **Ingredients** — strongest signal for dish similarity
2. **Dish type / preparation method** — "grilled" vs "fried" is meaningful
3. **Name** — carries implicit cuisine/cultural context
4. **Description** — adds nuance when it contains unique info
5. **Cuisine context** — useful but partially redundant with name+ingredients
6. **Dietary profile** — better as filter column, not embedding signal

## Input Length Sweet Spot
- text-embedding-3-small accepts up to 8,191 tokens
- Sweet spot for single items: **50-200 tokens** (~40-150 words)
- Current inputs are ~20-40 tokens — too short
- Target: **60-120 tokens** per dish

## Embed vs. Filter Separately
**Embed**: name, description, ingredients, dish type, preparation method, cuisine hint
**Filter (SQL)**: spice_level, dish_kind, price, dietary_tags, allergens, protein_families

Include `cuisine_type` in both — affects semantic similarity AND needs exact filtering.

## Template/Customizable Dishes
Embed the **base concept + option space**, not every configuration.
"Build Your Bowl" → "customizable grain bowl with chicken, tofu, beef, rice, quinoa, various vegetables"
Individual child variants get their own specific embeddings.

## Child Variant Context Inheritance
**Yes, include parent context.** "Margherita - Large" should embed as "Margherita Pizza; Italian; mozzarella, tomato, basil; large size" — not just "Large".
When `parent_dish_id` is non-null, fetch parent's name + ingredients and prepend.

## Description Truncation
- 120 chars is mildly harmful
- **300 characters** (~50-60 tokens) captures most descriptions without marketing fluff
- If AI-generated, aim for 1-2 information-dense sentences

## Input Format
**Labeled natural-language hybrid** performs best:
```
Margherita Pizza. Italian wood-fired pizza.
Fresh mozzarella, San Marzano tomatoes, basil, olive oil.
```
Better than bare semicolons (current) — model needs context for what each field means.

Recommended template:
```
{name}. {inferred_dish_type or dish_kind}, {cuisine_types}.
{description (300 chars)}.
Ingredients: {allIngredients}.
Options: {optionNames} (if template).
```

## Multilingual Handling
text-embedding-3-small handles multilingual well (44.0% on MIRACL benchmark). Spanish/English cross-lingual retrieval works. No need to translate menu items.
