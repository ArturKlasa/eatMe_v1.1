# Project Summary: Admin Restaurant Data Ingestion

## Artifacts Created

```
.agents/planning/2026-04-10-admin-restaurant-ingestion/
├── rough-idea.md                          — Initial problem statement
├── idea-honing.md                         — 14 requirements Q&A (approved)
├── research/
│   └── data-sources.md                    — Restaurant data source comparison (7 options evaluated)
├── design/
│   └── detailed-design.md                 — Full architecture, components, data models, error handling, testing
├── implementation/
│   └── plan.md                            — 10-step implementation plan with checklist
└── summary.md                             — This document
```

## Key Design Decisions

1. **Google Places API as primary data source** — Best quality restaurant metadata, good Mexico coverage, extremely affordable (~$1 per 500 restaurants via Nearby Search with FieldMask)
2. **No separate Place Details calls** — Nearby Search (New) returns full details via FieldMask header, eliminating the need for per-restaurant detail lookups (~95% cost reduction vs two-step approach)
3. **Enterprise Plus tier** — Requesting `dineIn`/`delivery`/`takeout`/`reservable` fields ($40/1K) for real service option data
4. **Existing GPT-4o menu scanner for dish data** — Already handles Spanish menus, no new menu ingestion system needed
5. **No blocking review step** — Restaurants imported immediately on fetch, warning flags shown in admin panel for post-import review
6. **Nearby Search (default) + Text Search (optional)** — Nearby Search for area queries, Text Search for keyword queries
7. **Warning flags computed at query time** — Always fresh, no stale flags after edits
8. **CSV as secondary import method** — For non-Google data sources (spreadsheets, partner lists)
9. **`google_place_id` for deduplication** — Stored on restaurants table, enables re-import detection

## Implementation Approach

The implementation is broken into **10 incremental steps**, each producing working, testable functionality:

| Step | What it delivers |
|------|-----------------|
| 1. DB Migration | Schema foundation (`google_place_id`, import jobs, API usage tables) |
| 2. Shared Types & Services | Validation, dedup, and import logic reusable by both paths |
| 3. Google Places Client | API client with field mapping, hours conversion, cuisine inference |
| 4. Google Import Route | Single API endpoint: search + dedup + insert |
| 5. Warning Flags & Table | Warning badges in restaurant list, flagged filter, scan menu button |
| 6. Import Page UI | Map area selector, import button, results display |
| 7. CSV Import | Parse + validate + insert CSV, template download |
| 8. Menu-Scan Link | Pre-select restaurant via query param |
| 9. Sidebar & Dashboard | Nav item, import stats on dashboard |
| 10. E2E Testing & Polish | Full flow verification, edge cases, UX refinement |

## Cost Projections

Nearby Search returns full details via FieldMask (no separate Place Details calls needed). Enterprise Plus tier at $40/1K requests. First 1,000 Enterprise calls/month may be free.

| Scenario | API Calls | Est. Cost |
|----------|-----------|-----------|
| Seed 1 city (500 restaurants) | ~25 | ~$1.00 |
| Seed 3 cities (1,500 restaurants) | ~75 | ~$3.00 |
| Seed 10 cities (5,000 restaurants) | ~250 | ~$10.00 |
| Seed 50 cities (25,000 restaurants) | ~1,250 | ~$50.00 |

## Next Steps

1. Review the detailed design at `design/detailed-design.md`
2. Review the implementation plan at `implementation/plan.md`
3. Begin implementation following the step checklist
4. Set up `GOOGLE_PLACES_API_KEY` environment variable before Step 3

## Areas for Future Refinement

- **Batch menu scanning** — Upload menu photos for multiple restaurants in one session
- **Data refresh** — Re-fetch from Google Places to update hours, addresses
- **Update mode** — Support updating existing restaurants from re-imported Google data
- **OpenStreetMap supplementation** — Free additional data for European expansion
- **Import history page** — Dedicated UI for viewing past imports and their results
