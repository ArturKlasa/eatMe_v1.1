# Tailwind v4 + shadcn/ui Best Practices Analysis

## Current Setup Assessment

**Already Modern:**
- Tailwind v4 CSS-first config (no tailwind.config.ts — correct for v4)
- OKLch color space for perceptual consistency
- `@theme inline` block for design tokens
- `@custom-variant dark` for dark mode
- CVA (class-variance-authority) for component variants
- `data-slot` attributes for component tracking
- `cn()` utility (clsx + tailwind-merge)

**shadcn/ui Components Quality:**
- All 18 components properly use CSS variables
- All have comprehensive `dark:` prefix coverage
- Container queries used in card.tsx (`@container/card-header`)
- Proper forwardRef usage throughout

## Issues Found

### 1. Extreme className Bloat
- `select.tsx:40` — 500+ character className string
- `dropdown-menu.tsx:45` — 280+ chars
- `dialog.tsx:72` — 353 chars
- Makes components nearly unreadable

### 2. Missing Tailwind v4 Features
| Feature | Status | Opportunity |
|---------|--------|-------------|
| CSS-first config | ✅ Used | — |
| Container queries | ⚠️ Only card.tsx | Expand to more components |
| @starting-style | ❌ Not used | Smoother dialog/modal animations |
| color-mix() | ❌ Not used | Dynamic hover/active color states |
| Subgrid | ❌ Not used | Complex form layouts |

### 3. No Utility Layer
No `@layer utilities` or `@layer components` defined in globals.css.
Repeated patterns (focus rings, icon sizing, interactive states) aren't extracted.

## Recommendations

### Extract Reusable Utility Classes
Create `@layer utilities` in globals.css:
```css
@layer utilities {
  .focus-ring-primary {
    @apply focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px];
  }
  .interactive-base {
    @apply transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50;
  }
  .icon-auto-size {
    @apply [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0;
  }
}
```

### Break Up Long ClassNames
Extract className segments into named constants per component:
```tsx
const triggerBase = ["flex w-fit items-center justify-between gap-2", "rounded-md border bg-transparent px-3 py-2"]
const triggerFocus = ["focus-visible:border-ring focus-visible:ring-ring/50"]
className={cn(triggerBase, triggerFocus, className)}
```

### Use color-mix() for Dynamic States
```css
--color-brand-primary-hover: color-mix(in oklch, var(--brand-primary) 90%, black);
```

### Add Badge Size Variants
Badge currently has color variants but no sizes (sm/md/lg).
