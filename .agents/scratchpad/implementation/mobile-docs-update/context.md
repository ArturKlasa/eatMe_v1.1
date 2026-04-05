# Context: Mobile Docs Update

## Source
Rough description: "Please go through /home/art/Documents/eatMe_v1/apps/mobile/docs and update it"

## Current State
The only file in `apps/mobile/docs/` is `REFACTORING_SUMMARY.md`. It documents a component refactoring of `BasicMapScreen.tsx` and the `src/components/map/` directory.

## Staleness Analysis
The doc is significantly outdated:

| File | Doc Claims | Actual |
|------|-----------|--------|
| BasicMapScreen.tsx | 243 lines | 807 lines |
| DailyFilterModal.tsx | 195 lines | 775 lines |
| MapHeader.tsx | 32 lines | 29 lines |
| RestaurantMarkers.tsx | 44 lines | 83 lines |
| MapControls.tsx | 48 lines | 75 lines |
| MapFooter.tsx | 35 lines | 114 lines |
| index.ts | 11 lines | 11 lines (unchanged) |
| ViewModeToggle.tsx | NOT LISTED | 44 lines (new) |
| DishMarkers.tsx | NOT LISTED | 80 lines (new) |

## Acceptance Criteria
- All line counts reflect current source
- New components (ViewModeToggle, DishMarkers) are documented
- "Before/After" stats are updated or noted as historical
- Any claims about component purposes are verified against actual code
- "Next Steps" section is updated based on current state
