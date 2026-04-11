# Style Organization Issues — Detailed Analysis

## Three Parallel Color Systems (Root Cause)

The web-portal has **three disconnected color systems** that are never synchronized:
1. `@eatme/tokens` package — JS color objects (used by mobile, ignored by web)
2. `globals.css` — OKLch CSS variables (proper system, underutilized)
3. Hardcoded Tailwind classes — 312+ instances of direct color classes in JSX

## Hardcoded Colors (50+ unique patterns, 312+ instances)

### By frequency:
- `text-gray-500` — 113x
- `text-gray-600` — 72x
- `text-gray-400` — 60x
- `border-gray-200` — 53x
- `text-gray-700` — 48x
- `text-orange-600` — 38x (brand color, not using token)
- `text-gray-900` — 37x
- `text-red-500/600` — 51x combined
- `text-green-600` — 21x

### Worst files:
1. `RestaurantTable.tsx` — 30+ hardcoded colors
2. `AdminHeader.tsx` — 15+ hardcoded colors
3. `AdminSidebar.tsx` — 18+ hardcoded colors
4. `onboard/review/page.tsx` — 50+ hardcoded colors
5. `DishCard.tsx` — 12+ hardcoded colors

## Inline Tailwind Class Bloat

Worst examples (100+ char className strings):
- `dialog.tsx:72` — 353 chars
- `dropdown-menu.tsx:45` — 280+ chars
- `dropdown-menu.tsx:77` — 300+ chars

## Inconsistent Patterns

### Status badges styled 4 different ways:
- `bg-green-50 text-green-700` (RestaurantTable)
- `bg-green-50/30` with opacity (DishGroupCard)
- `bg-green-100 text-green-800` (DishCard)
- `STATUS_VARIANTS` defined in ui-constants.ts but not used

### Action button hovers inconsistent:
- Some use `-50` background: `hover:bg-blue-50`
- Others use `-100`: `hover:bg-blue-100`

### Info card backgrounds vary:
- `bg-blue-50` (RestaurantForm)
- `bg-orange-50` (AddIngredientPanel)
- `bg-gray-50` (RestaurantTable)

## Style Duplication

### Badge pattern repeated 16+ times:
```tsx
<span className="inline-flex items-center gap-1 px-2 py-1 bg-[COLOR]-50 text-[COLOR]-700 text-xs font-medium rounded">
```

### Input border pattern repeated:
- `border-gray-300` hardcoded in DishGroupCard, AddIngredientPanel, RestaurantTable instead of `border-input` token

## @eatme/tokens Package (Unused in Web)

The tokens package defines comprehensive colors, spacing, typography, etc. — but the web-portal ignores it completely:
- tokens: `accent: '#FF9800'`
- web uses: `bg-orange-600` (different orange!)
- No integration between JS tokens and CSS variables
