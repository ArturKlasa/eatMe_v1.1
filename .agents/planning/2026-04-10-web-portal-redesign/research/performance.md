# Performance Analysis

## Critical Issues

### 1. Unused Dependencies (~700KB)
- `mapbox-gl` (3.16.0) — ~600KB, **never imported anywhere**
- `react-map-gl` (8.1.0) — ~100KB, **never imported anywhere**
- App uses Leaflet for maps instead. These should be removed.

### 2. Heavily Client-Side App
- **77 files** have "use client" directives
- **0 files** have "use server" directives
- All pages render client-side — no SSR benefits
- Admin layout blocks rendering during auth check

### 3. No Suspense/Streaming
- Zero `<Suspense>` boundaries
- Zero `loading.tsx` files
- Pages block on slowest async query before rendering anything

### 4. No Image Optimization
- Zero usage of `next/image` component
- Menu-scan uses raw `<img>` tags
- Client-side image resizing (base64 encoding adds 33% overhead)

### 5. Heavy Client-Side Libraries
| Package | Size | Client? | Dynamically Imported? |
|---------|------|---------|----------------------|
| pdfjs-dist | ~2-3MB | Yes | Yes (dynamic import) |
| leaflet | ~150KB | Yes | Yes (SSR disabled) |
| openai | ~400KB | No (API route only) | N/A |
| mapbox-gl | ~600KB | **Unused** | — |
| react-map-gl | ~100KB | **Unused** | — |

### 6. No Performance Monitoring
- No web-vitals tracking
- No analytics
- No error monitoring (Sentry, etc.)

### 7. No Middleware
- No `middleware.ts` file
- Missing: auth redirects, security headers, caching headers

## Good Patterns Already in Place

- ✅ LocationPicker dynamically imported with `ssr: false`
- ✅ Turbopack configured for dev
- ✅ LoadingSkeleton component system
- ✅ `Promise.all()` for parallel data fetching in admin dashboard and menu-scan API
- ✅ 20MB body size limit appropriate for image uploads

## Limited Memoization
- Only 9 of 104 .tsx files use `useCallback` or `useMemo` (8.7%)
- RestaurantTable (299 LOC): no memoization, filters on every render
- Menu-scan page (2,921 LOC): no memoization at all

## Recommended Actions (Priority Order)

1. **Remove mapbox-gl & react-map-gl** — 5 min, -700KB
2. **Add middleware.ts** — auth redirects, security headers
3. **Add Suspense boundaries** — progressive rendering
4. **Memoize expensive components** — tables, forms, maps
5. **Consider moving some pages to RSC** — especially read-heavy admin pages
6. **Add web-vitals tracking** — measure before optimizing
