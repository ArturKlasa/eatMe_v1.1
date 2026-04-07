# Research: Fuzzy Category Matching for Multi-Page Menu Merge

## Recommended Approach: 3-Layer Hybrid

### Layer 1: Normalization (catches ~60% of matches)
- Lowercase, trim, strip accents (NFD decomposition)
- Replace `&` / `+` with "and"
- Strip non-alphanumeric characters
- Collapse whitespace

### Layer 2: Predefined Synonym Map (catches cross-language)
~30-50 canonical category names cover 95% of real menus:
```
appetizers: [starters, entradas, entrees, aperitivos, botanas]
main courses: [mains, entrees, platos principales, platos fuertes]
desserts: [postres, dulces, sweets]
soups and salads: [sopas y ensaladas]
beverages: [drinks, bebidas, refrescos]
sides: [accompaniments, guarniciones, acompañamientos]
```

### Layer 3: String Similarity Fallback (catches novel names)
Jaro-Winkler with threshold ~0.85 for unmatched categories.
Library: `string-similarity` (simple, zero deps, fast).

## Compound Categories
Treat "Soups & Salads" as ONE category — don't split.
If page 1 has "Soups & Salads" and page 2 has "Salads", merge into broader name.

## Qualified Categories
"Appetizers (Vegetarian)" vs "Appetizers (Meat)" — compare FULL normalized string.
Don't strip qualifiers before comparison — the parenthetical drops similarity below threshold.

## Performance
~200 category pairs max across 20 pages. Under 1ms even with slowest algorithm. No embeddings or API calls needed.

## Merge Algorithm
```
for each category on new page:
  1. normalize(name)
  2. exact match against existing? → merge
  3. synonym map lookup → merge into canonical
  4. string similarity > 0.85 against all existing? → merge into best match
  5. no match → create new category
```
