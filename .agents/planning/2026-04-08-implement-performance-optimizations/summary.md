# Project Summary — Performance Optimizations

## Date: 2026-04-08

---

## Artifacts Created

```
.agents/planning/2026-04-08-implement-performance-optimizations/
├── rough-idea.md
├── idea-honing.md           (7 Q&A decisions)
├── summary.md               (this file)
├── design/
│   └── detailed-design.md
└── implementation/
    └── plan.md              (15 steps with checklist)
```

Research source: `.agents/planning/2026-04-07-optimize-performance/findings/`

---

## Scope Summary

**In scope:** 15 implementation steps across Sprints 1–3.
**Explicitly excluded:** `nearby-restaurants` Edge Function, two-tier feed cache key restructuring.

---

## Design Overview

Changes span 4 layers:

| Layer | Changes |
|-------|---------|
| Database | 7 new indexes (migration 076), 1 new view (migration 077) |
| Edge Functions | enrich-dish parallelization, feed payload slimming + favorites join, feed compression, new invalidate-cache function |
| Mobile App | RestaurantDetailScreen explicit select + cache, BasicMapScreen useShallow, expo-image migration, filterStore debounce, sync debounce, FlatList optimization, per-category lazy loading |
| Services | eatTogetherService + dishPhotoService explicit selects, viewHistoryService combined query |

---

## Implementation Plan Overview

### Sprint 1 — Quick Wins (~2 days)
| Step | Change | Impact |
|------|--------|--------|
| 1 | DB indexes migration | Seq scan → index scan on 6 critical columns |
| 2 | RestaurantDetail explicit select | 1-2 MB → 50-100 KB payload |
| 3 | enrich-dish Promise.all | -60 ms per enrichment |
| 4 | feed slim response + favorites join | -50% feed payload, -1 DB round-trip |
| 5 | BasicMapScreen useShallow | 5-10x fewer re-renders on filter toggle |
| 6 | Explicit selects in services | -40-60% per eat_together / photo query |
| 7 | filterStore saveFilters debounce | ~50 AsyncStorage writes → ~1 per filter session |

### Sprint 2 — Caching & Network (~3-5 days)
| Step | Change | Impact |
|------|--------|--------|
| 8 | expo-image full migration | Eliminates image re-downloads |
| 9 | Client-side restaurant cache (Zustand) | Eliminates repeat 100 KB+ fetches |
| 10 | User preferences sync debounce | Skips 1-2 DB queries per app resume |

### Sprint 3 — Architecture (future)
| Step | Change | Impact |
|------|--------|--------|
| 11 | viewHistoryService DB view | -1 DB round-trip per history screen load |
| 12 | FlatList getItemLayout | Eliminates dynamic item measurement |
| 13 | Per-category lazy loading | Initial restaurant load: all dishes → first category only |
| 14 | feed response compression | ~80 KB → ~20 KB per feed response |
| 15 | Cache invalidation webhook | Prevents stale Redis data after restaurant updates |

---

## Next Steps

1. Add project files to context: `/context add .agents/planning/2026-04-08-implement-performance-optimizations/**/*.md`
2. Start implementation with Step 1 (DB indexes — zero code risk, immediate impact)
3. Steps 1-7 can largely be done in parallel by different developers
4. Steps 8-10 depend on completing Step 2 (for the explicit select shape used in the restaurant cache)

To start implementation with the Ralph loop:
```
ralph run --config presets/pdd-to-code-assist.yml --prompt "Implement the performance optimization steps from .agents/planning/2026-04-08-implement-performance-optimizations/implementation/plan.md, starting with Step 1"
```
