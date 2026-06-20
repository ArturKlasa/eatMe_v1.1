# Phase 5: Dead Code & Doc Cleanup — Research

**Researched:** 2026-06-20
**Method:** Inline verification pass (read + grep against current `main`). Confirms/corrects the line numbers and cascade claimed in CONTEXT.md. No open-ended investigation — CONTEXT.md is authoritative on scope; this validates it against live code.
**Phase requirements:** CLEAN-01, CLEAN-02, CLEAN-03

---

## Headline findings

1. **CLEAN-01 cascade is real and bounded.** Every named artifact exists; the `🏪 Places` toggle IS imported + rendered today (CONTEXT.md is right, upstream finding F-09's "not rendered" claim is wrong). The deletion has exactly **6 files to delete-or-edit** plus **3 style-file edits**, and the orphan cascade stops cleanly at `mapPinRestaurants` (because `filteredRestaurants`, its data source, is shared with the surviving dish path).
2. **`handleMarkerPress` IS safely removable** — it feeds only `RestaurantMarkers`. The two other handlers (`handleDishMarkerPress`, `handleDishPress`) feed the dish path and MUST stay. This was the one "be conservative" risk in D-03; it's resolved.
3. **CLEAN-02: zero live `apps/web-portal` imports** anywhere in `apps/`, `packages/`, `infra/` (SC#2 build-clean evidence already holds). Cleanup is purely doc text across **7 files**. PROMPT.md is almost entirely `web-portal-v2` (KEEP) with only one true `apps/web-portal` (v1) line.
4. **CLEAN-03: confirmed exact rewrite.** The function loads **dish + option groups + restaurant cuisine** (verified in body, lines 135–164) — no ingredients, no parent dish. Migration 151 confirms the 3 surviving triggers.

---

## CLEAN-01 — Map view-mode removal (UI-visible)

### Files to DELETE (3)
| File | Lines | Confirmed sole-consumer? |
|------|-------|--------------------------|
| `apps/mobile/src/stores/viewModeStore.ts` | 23 | `useViewModeStore` consumed only by ViewModeToggle.tsx + BasicMapScreen.tsx (both edited/deleted here) ✓ |
| `apps/mobile/src/components/map/ViewModeToggle.tsx` | 45 | Imported only by DailyFilterModal.tsx:28 (removed here) ✓ |
| `apps/mobile/src/components/map/RestaurantMarkers.tsx` | 83 | Imported only by BasicMapScreen.tsx:30 + re-exported by map/index.ts:9 (both edited here). No barrel consumers. ✓ |

### Files to EDIT (6) — exact boundaries

**`apps/mobile/src/screens/BasicMapScreen.tsx`** (608 lines) — line numbers corrected vs CONTEXT.md:
- **Delete line 12** — `import { useViewModeStore } from '../stores/viewModeStore';`
- **Delete line 30** — `import { RestaurantMarkers } from '../components/map/RestaurantMarkers';` *(CONTEXT.md didn't name this line; it's at 30, not 12)*
- **Delete line 95** — `const mode = useViewModeStore(state => state.mode);`
- **Delete lines 158–169** — the `mapPinRestaurants` memo + its 2 comment lines (158–159). Depends on `filteredRestaurants`, which **stays** (also used by `mapPinDishes` at line 177). Cascade stops here. ✓
- **Delete lines 294/295–300** — the `handleMarkerPress` useCallback (keep the `// Handler functions` section comment at 294 — it also heads the surviving handlers). `handleMarkerPress` only navigates `RestaurantDetail` from `rootNavigation`; self-contained; fed only to RestaurantMarkers at 511. **PROVEN DEAD.**
- **Replace lines 509–514** (the conditional) with just the surviving dish branch:
  ```tsx
  <DishMarkers dishes={mapPinDishes} onMarkerPress={handleDishMarkerPress} />
  ```
  (drop the `{/* Conditional markers based on view mode */}` comment + `mode === 'restaurant' ? (...) : (...)` wrapper).

**KEEP (do NOT touch):** `filteredRestaurants`, `mapPinDishes`, `handleDishMarkerPress`, `handleDishPress`, `DishMarkers` import (line 31).

**`apps/mobile/src/components/map/DailyFilterModal.tsx`** (894 lines):
- **Delete line 28** — `import { ViewModeToggle } from './ViewModeToggle';`
- **Delete lines 145–147** — `{/* View Mode Toggle */}` comment + `<ViewModeToggle style={modals.viewModeToggleContainer} />` + the blank line. Sits between `</View>` (143) and `<ScrollView` (148) → removal leaves layout intact, no empty wrapper. **Mandatory** (else build breaks when ViewModeToggle.tsx is deleted).

**`apps/mobile/src/components/map/index.ts`** (11 lines):
- **Delete line 9** — `export { RestaurantMarkers } from './RestaurantMarkers';`

**`apps/mobile/src/styles/modalScreen.ts`** (138 lines):
- **Delete lines 115–138** — the entire `export const viewModeToggleStyles = StyleSheet.create({ ... });` block (and the blank line 114 separating it from the prior block).

**`apps/mobile/src/styles/modals.ts`** (401 lines):
- **Delete lines 284–287** — `// View mode toggle container` comment + `viewModeToggleContainer: { marginVertical: 16 } as ViewStyle,`.

**`apps/mobile/src/styles/index.ts`** (77 lines) — 3 edits:
- **Line 24** — `export { modalScreenStyles, viewModeToggleStyles } from './modalScreen';` → `export { modalScreenStyles } from './modalScreen';`
- **Line 45** — `import { modalScreenStyles, viewModeToggleStyles } from './modalScreen';` → `import { modalScreenStyles } from './modalScreen';`
- **Delete line 62** — `viewModeToggleStyles,` (inside `commonStylesBase`).

### Discretionary leave (flagged, not in scope)
- `apps/mobile/src/styles/REFACTORING_SUMMARY.md:324` lists `viewModeToggleStyles`. This is a **historical refactoring snapshot**, not live code and not a CLEAN-02 target. Per the D-05 principle (don't rewrite point-in-time archives), **leave it**. Mention to operator; do not block on it.

### Verification (CLEAN-01)
- `turbo check-types` (or `cd apps/mobile && pnpm check-types`) — catches any orphaned import/reference. This is the primary gate (SC#1 names `pnpm check-types`).
- Post-delete grep must return ZERO: `grep -rn "viewModeStore\|useViewModeStore\|ViewModeToggle\|RestaurantMarkers\|viewModeToggle" apps/mobile/src` (excluding REFACTORING_SUMMARY.md).
- **On-device (operator, D-03):** daily-filter modal renders with no `🏪 Places` tab; dish markers + dish-card navigation still work. No emulator in agent loop.

---

## CLEAN-02 — Residual doc cleanup

**Build-clean evidence (SC#2):** `grep -rn "from ['\"].*apps/web-portal" apps packages infra` (excluding `web-portal-v2`) → **ZERO live imports**. Confirmed. Deletion (`c1a7e3f`) + workspace config are already clean; this is doc text only.

### Per-file disposition (7 targets)
| File | web-portal hits | Disposition |
|------|-----------------|-------------|
| `CLAUDE.md` | 8, 21, 29, 30 (+62 = DEFER) | **Rewrite to current reality** (loads every session). Lines 8/21/29–30 describe web-portal as a live app + test target — retarget to `apps/admin` / note v1 deleted, `web-portal-v2` on ice. **Line 62 → DEFER to Phase 6** (D-07; it's inside DishKind-shim guidance). |
| `agent_docs/architecture.md` | 9, 24, 38, 61 | **Rewrite** structure tree + dep graph to reflect `apps/admin` as the portal/admin surface; `web-portal-v2` on ice. Don't leave structural gaps. |
| `.github/copilot-instructions.md` | 8, 23, 33, 56, 62, 66, 69, 121, 122, 124, 138, 171, 272, 275, 296, 297, 298, 314, 315, 321 | **Heaviest.** Describes web-portal as the current app throughout. Rewrite to current reality (admin surface) or scrub the v1-specific lib/path refs. Biggest single doc effort. |
| `INTEGRATION_COMPLETE_SUMMARY.md` | 57, 200, 201, 202, 203, 207, 208 | **Historical record** → scrubbing/removing the refs is acceptable (D-06). Note: 200–203/207–208 also reference allergen/ingredient files (`AllergenWarnings`, `DietaryTagBadges`, `ingredients.ts`) — abandoned concepts; fine to drop the whole stale block. |
| `agent_docs/conventions.md` | 6 | Single ref: kebab-case example `web-portal/`. Swap the example to a live dir (e.g. `admin/`) or `mobile/`. |
| `agent_docs/commands.md` | 10, 15 | `turbo test` (web-portal Vitest) + a "Web Portal" command section. Retarget to admin or remove the dead section. |
| `PROMPT.md` | 6, 8, 10, **13**, 51, 58, 95, 158, 166, 179, 191, 222 | **Mostly `web-portal-v2` (KEEP).** Only true `apps/web-portal` (v1) refs: line **13** ("at `apps/web-portal/` stays untouched until DNS cutover"), line **58** ("`apps/web-portal/` (v1)"), line **179** ("No edits to `apps/web-portal/`"). These describe v1 as still-present; since v1 is deleted, either scrub or annotate "(deleted 2026-06-18)". PROMPT.md is itself a v2 planning snapshot — lean toward minimal edits, only the v1-present claims. |

**LEAVE UNTOUCHED (D-05):** `infra/supabase/functions/menu-scan-worker/index.ts:510` and `infra/scripts/backfill-cuisine-from-google.ts:33,151` — code-comment provenance notes ("copy of apps/web-portal/lib/..."). Confirmed present; intentionally historical. Also all `.agents/`, `.agent/`, `.eval-sandbox/` archives.

### Verification (CLEAN-02)
- `grep -rn "from ['\"].*apps/web-portal" apps packages infra | grep -v web-portal-v2` → ZERO (already true; re-confirm = build-clean evidence; D-10 says escalate to full `turbo build` only if something surfaces).
- After edits: `grep -rn "apps/web-portal\b" <7 target files>` should show only intentional residue (CLAUDE.md:62 deferred; PROMPT.md v2 lines; provenance refs out of scope).

---

## CLEAN-03 — enrich-dish header comment (comment-only)

**Verified actual load logic** (`infra/supabase/functions/enrich-dish/index.ts`):
- Lines 135–137: `.from('dishes').select('id, restaurant_id, name, description, enrichment_status, updated_at, primary_protein')`
- Lines 158–164: `Promise.all([ option_groups.select('name, options(name)'), restaurants.select('cuisine_types') ])`
- **Loads: dish + option groups + restaurant cuisine. NO ingredients, NO parent dish.** Confirms F-06 exactly.

**Migration 151** (lines 44–46) confirms the 3 surviving triggers firing `_trg_notify_enrich_dish()`: `trg_enrich_on_dish_change` (dishes.name/description), `after_dish_embedded` (dishes.embedding → centroid), `trg_enrich_on_option_group_change` (option_groups). The ingredient triggers were retired in 151.

### Exact rewrite (header lines 8–21)
**Line 9** — `//   - _trg_notify_enrich_dish trigger on dish/ingredient/option_group writes`
→ `//   - _trg_notify_enrich_dish trigger on dish/option_group writes` *(drop `ingredient`; keep `option_group` per D-09)*

**Lines 14–15** —
```
//   1. Load dish + ingredients + option groups + restaurant cuisine
//      + parent dish (when this is a variant) + parent ingredients
```
→ collapse to a single line:
```
//   1. Load dish + option groups + restaurant cuisine
```
*(delete the entire `+ parent dish ... + parent ingredients` line; pipeline steps stay numbered 1–4)*

**KEEP unchanged:** lines 4–6 (embedding gen), line 16–18 (steps 2–4), lines 20–21 (`_trg_after_dish_embedded` centroid note — D-09 keep).

### Verification (CLEAN-03)
- `deno check infra/supabase/functions/enrich-dish/index.ts` — comment-only change can't break types, but run it to confirm nothing else moved. Deno lives at `~/.deno` (not on PATH); edge fns deploy from `infra/supabase/`. (Per memory `edge_fn_deno_tests`: `deno` invoked via full path; tests use `--node-modules-dir=none -A`.)
- grep the corrected header: zero `ingredient`/`parent` tokens in lines 8–21; `option_group` + `_trg_after_dish_embedded` still present.

---

## Validation Architecture

Nyquist note: this phase has **no new test surface** — it is delete/edit-only with the "no new tests beyond typecheck" scope lock from CONTEXT.md. Validation is the existing static-analysis + grep + on-device surface. Each requirement maps to a falsifiable check:

| Req | Validation signal | Command / check | Type |
|-----|-------------------|-----------------|------|
| CLEAN-01 | Typecheck passes after deletion (no orphaned refs) | `turbo check-types` exits 0 | Static (automated) |
| CLEAN-01 | No residual symbols | `grep -rn "viewModeStore\|useViewModeStore\|ViewModeToggle\|RestaurantMarkers\|viewModeToggle" apps/mobile/src` → only REFACTORING_SUMMARY.md | Grep (automated) |
| CLEAN-01 | Modal renders w/o Places tab; dish markers + nav still work | On-device operator check (no emulator in loop) | Manual (operator, D-03) |
| CLEAN-02 | Zero live web-portal imports | `grep -rn "from ['\"].*apps/web-portal" apps packages infra \| grep -v web-portal-v2` → empty | Grep (automated) |
| CLEAN-02 | No remaining "current-app" web-portal prose in the 7 targets (except deferred/v2/provenance) | Targeted grep of the 7 files | Grep + read (automated + judgment) |
| CLEAN-03 | enrich-dish still type-checks | `deno check .../enrich-dish/index.ts` exits 0 | Static (automated) |
| CLEAN-03 | Header matches reality | grep header lines 8–21: no `ingredient`/`parent`; `option_group` + `_trg_after_dish_embedded` present | Grep (automated) |

**Coverage:** every success criterion (SC#1/2/3) has at least one automated signal; CLEAN-01 adds the mandatory operator on-device check (the only behavior change in the phase). No sampling/Nyquist gaps — the validation surface is the full deletion, not a sample.

---

## Line-number corrections vs CONTEXT.md (for the planner)

- BasicMapScreen `RestaurantMarkers` import is at **line 30** (CONTEXT.md named only the `useViewModeStore` import at 12; both must go).
- The view-mode conditional spans **509–514** (comment 509, ternary 510–514), not "509–513".
- `mapPinRestaurants` memo: comment 158–159 + body **160–169** (CONTEXT.md said line 160 — that's the memo body start; include the 2 comment lines).
- The dead handler is **`handleMarkerPress` (lines 295–300)**; keep the `// Handler functions` header comment at 294.
- `viewModeToggleStyles` block = **modalScreen.ts:115–138**; `viewModeToggleContainer` = **modals.ts:284–287** (comment + 2 lines); `styles/index.ts` refs at **24, 45, 62** — all confirmed.

## Surprises / risk notes

- **No surprises that change scope.** The single risk flagged in D-03 (handler removal) is resolved: only `handleMarkerPress` is dead; the dish handlers stay.
- `.github/copilot-instructions.md` is the **largest CLEAN-02 effort** (~20 web-portal refs, describes v1 as the live app throughout) — size the doc plan accordingly; it may warrant its own task.
- `INTEGRATION_COMPLETE_SUMMARY.md` web-portal refs are entangled with **abandoned allergen/ingredient** file refs — dropping the whole stale block is cleaner than surgical web-portal-only edits.

## RESEARCH COMPLETE
