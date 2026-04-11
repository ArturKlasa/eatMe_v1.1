# @eatme/tokens Integration Analysis

## Current State

### Token Package Contents
- `colors.ts` — 60+ color values (hex format)
- `typography.ts` — Sizes (12-64px), weights, line heights
- `spacing.ts` — 4px base unit, 11 steps (xs=4px to 6xl=80px)
- `borderRadius.ts` — 9 presets (sm=4px to full=9999px)
- `shadows.ts` — 4 presets (React Native shadow properties)
- `layout.ts` — Component measurements (headerHeight=60, buttonHeight=48, etc.)

### Mobile Usage: Extensive
- 10+ files import from `@eatme/tokens`
- Theme re-export layer at `apps/mobile/src/styles/theme.ts`
- Used for: navigation, auth, modals, screens, icons

### Web Portal Usage: ZERO
- Listed in package.json dependencies
- Zero imports found anywhere in web-portal code
- All styling done via hardcoded Tailwind classes

## Key Mismatches

| Token | @eatme/tokens Value | globals.css Value | Match? |
|-------|---------------------|-------------------|--------|
| Primary | `#007AFF` (blue) | `oklch(0.651 0.201 38.2)` (#FF6B35, orange) | ❌ Different color! |
| Accent | `#FF9800` | `oklch(0.715 0.168 55.4)` (~#FF9800) | ✅ Match |
| AccentDark | `#F57C00` | `oklch(0.652 0.168 55.4)` (~#F57C00) | ✅ Match |
| AccentLight | `#FFB74D` | `oklch(0.762 0.155 47.6)` (~#FFB74D) | ✅ Match |
| Success | `#4CAF50` | Not defined | ❌ Missing |
| Error | `#F44336` | `--destructive` (different oklch) | ⚠️ Different value |

**Critical:** Token `primary` is blue (#007AFF) but web uses orange (#FF6B35) as primary brand color. The tokens package needs updating to reflect the actual brand, OR the web's "primary" should be renamed to "brand".

## Local Constants That Should Be Tokens

`lib/ui-constants.ts` defines:
- `INGREDIENT_FAMILY_COLORS` — 20 types with Tailwind class strings
- `DIETARY_TAG_COLORS` — 4 categories
- `DIETARY_TAG_COLOR_DEFAULT` — fallback badge colors
- `STATUS_VARIANTS` — active/suspended/pending
- `SPICE_LEVEL_CONFIG` — spice labels

None of these come from @eatme/tokens.

## Integration Plan

### Phase 1: Fix Token-Web Color Alignment
- Decide: Is primary blue or orange?
- Update tokens OR web to match
- Add missing semantic colors to tokens (success, warning, info)

### Phase 2: Generate CSS Variables from Tokens
- Script: `packages/tokens/scripts/generate-css-vars.ts`
- Output: `apps/web-portal/app/tokens.css`
- Import in globals.css before @theme block

### Phase 3: Map Tokens to Tailwind Theme
- Create CSS variable → Tailwind mapping in @theme inline
- Replace magic OKLch values with generated token vars

### Phase 4: Migrate Component Usage
- Replace 82 `orange-*` class instances with `brand-*`
- Replace `gray-*` hardcoded classes with semantic token classes

### Phase 5: Move Domain Constants to Tokens
- Ingredient family colors → `packages/tokens/src/ingredients.ts`
- Status variants → `packages/tokens/src/status.ts`

**Estimated effort:** 12-18 developer hours total
