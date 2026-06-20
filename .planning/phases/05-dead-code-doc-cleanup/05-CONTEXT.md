# Phase 5: Dead Code & Doc Cleanup - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Three independent cleanup tracks, no DB work:

1. **CLEAN-01** — Remove the dead map restaurant-view-mode code (mobile, UI-visible).
2. **CLEAN-02** — Purge residual `apps/web-portal` references from agent-facing docs (the app is already deleted + committed `c1a7e3f`).
3. **CLEAN-03** — Correct the stale `enrich-dish` edge-function header comments.

The only behavior change in the entire phase is CLEAN-01 removing the (currently user-reachable) view-mode toggle from the mobile daily-filter modal. CLEAN-02 and CLEAN-03 are documentation/comment-only. This phase must land before Phase 9 (it decomposes a pruned `BasicMapScreen`).

**Not in scope:** any DB/schema change, the DishKind-shim removal (Phase 6 / DEBT-03), the `types.ts` regen (Phase 6 / DEBT-04), deleting `apps/web-portal-v2` (on ice), and any new tests beyond what typecheck already gives.

</domain>

<decisions>
## Implementation Decisions

### CLEAN-01 — Map view-mode removal

- **D-01:** **Remove the restaurant-view-mode code fully** — do NOT park it like `web-portal-v2`. Rationale: the `🏪 Places` toggle is genuinely user-reachable today (rendered in `DailyFilterModal.tsx:146`, contradicting the F-09 "not rendered" evidence), and a half-built reachable toggle in prod is worse than a clean deletion recoverable from git history. Phase 9 (`BasicMapScreen` decompose) is explicitly gated on this code being gone.
- **D-02:** **Full cascade — leave zero residue.** Remove everything the toggle removal orphans, not just the 3 named artifacts:
  - `apps/mobile/src/stores/viewModeStore.ts` — delete the store.
  - `apps/mobile/src/components/map/ViewModeToggle.tsx` — delete the component.
  - `apps/mobile/src/screens/BasicMapScreen.tsx` — remove the `useViewModeStore` import (line 12), the `mode` selector (line 95), and the `mode === 'restaurant' ? <RestaurantMarkers/> : <DishMarkers/>` conditional (~lines 509-513), leaving just `<DishMarkers .../>`.
  - `apps/mobile/src/components/map/DailyFilterModal.tsx` — remove the `ViewModeToggle` import (line 28) and its render (line 146). **Mandatory** — otherwise the build breaks once `ViewModeToggle` is deleted.
  - Orphaned styles — `viewModeToggleStyles` (`styles/modalScreen.ts:115`), its `styles/index.ts` exports (lines 24, 45, 62), `modals.viewModeToggleContainer` (`styles/modals.ts:285`), and the related comments.
  - `apps/mobile/src/components/map/RestaurantMarkers.tsx` + its `components/map/index.ts:9` export — the removed branch is its only consumer.
  - `mapPinRestaurants` memo (`BasicMapScreen.tsx:160`) and the now-dead restaurant marker-press handler that fed `RestaurantMarkers`.
- **D-03:** This is a **UI-visible** change → operator verifies on-device that the daily-filter modal renders correctly without the Places tab and dish markers still work (no emulator in the agent loop). Be conservative on the handler removal — only remove handlers proven dead by the cascade, not anything still wired to dish markers.

### CLEAN-02 — Residual doc cleanup

- **D-04:** **Scope = all agent-facing docs**, not just the 4 named ones. Clean web-portal references from:
  - The 4 named: `CLAUDE.md`, `agent_docs/architecture.md`, `.github/copilot-instructions.md`, `INTEGRATION_COMPLETE_SUMMARY.md`.
  - Plus: `agent_docs/conventions.md`, `agent_docs/commands.md`, `PROMPT.md` (these describe web-portal as a *current* app — leaving them defeats the "stop misleading readers" goal; the roadmap's 4-file list was an assessment-time snapshot).
- **D-05:** **Leave untouched:** the two code-comment provenance refs (`infra/supabase/functions/menu-scan-worker/index.ts:510`, `infra/scripts/backfill-cuisine-from-google.ts:33,151` — historical "copy of apps/web-portal/lib/..." notes, low-stakes) and all point-in-time archives (`.agents/research/*`, `.agent/scratchpad.md`, `.eval-sandbox/*`). Rewriting history snapshots is wrong.
- **D-06:** **Edit style = rewrite to current reality** where a doc describes live architecture (e.g. `CLAUDE.md` tech-stack list, `architecture.md` structure tree): reflect that `apps/admin` is the portal/admin surface and `web-portal-v2` is on ice — don't just delete the line and leave a structural gap (`CLAUDE.md` loads every session). For purely historical records (`INTEGRATION_COMPLETE_SUMMARY.md`), scrubbing/removing the ref is acceptable.
- **D-07:** **Defer `CLAUDE.md:62` to Phase 6.** That line's web-portal mention sits inside the DishKind-shim guidance ("remove them when that app is deleted"); the shim removal is Phase 6 (DEBT-03), which will rewrite the sentence when the shims actually go (they now block `web-portal-v2`, not the deleted web-portal). Don't half-edit it now.

### CLEAN-03 — enrich-dish header comment

- **D-08:** **Match the comment to the actual code.** The executor reads `enrich-dish/index.ts`'s real load logic first, then writes the header to describe exactly what it loads today (per F-06: dish + option groups + restaurant cuisine) — accuracy, not just "less wrong." Stale spots: line 9 (`dish/ingredient/option_group writes`) and lines 14-15 (`Load dish + ingredients + option groups + restaurant cuisine + parent dish ... + parent ingredients`).
- **D-09:** **Keep `option_group`** in the corrected wording (its trigger `trg_enrich_on_option_group_change` is one of the three migration-151 keeps) and **keep** the `_trg_after_dish_embedded` centroid line. **Drop** every `ingredient` and `parent dish`/`parent ingredients`/`variant` reference. Documentation-only; no runtime change.

### Verification & commit shape

- **D-10:** **Verification = typecheck + grep, build only if needed.** `turbo check-types` (catches CLEAN-01 orphans/dead refs), a grep proving zero **live** `from '...apps/web-portal'` imports as the "build-clean" evidence for SC#2 (deletion is already committed + workspace config already clean, so a full `turbo build` re-confirms a known-good state at high cost), and `deno check` on `enrich-dish` for CLEAN-03. Escalate to a full `turbo build` only if the grep/typecheck surfaces something.
- **D-11:** **One commit per track** — separate commits for CLEAN-01 (mobile), CLEAN-02 (docs), CLEAN-03 (enrich-dish). Maps each requirement to one commit and isolates the only behavior-affecting change (CLEAN-01) so an on-device regression bisects cleanly — mirrors the Phase 9 "one refactor per commit" discipline. Commit straight to `main`.

### Claude's Discretion

- Exact corrected wording of the `enrich-dish` header (within D-08/D-09 constraints).
- Exact prose used when rewriting the web-portal architecture references to current reality (within D-06).
- Which specific handlers/imports are proven dead by the CLEAN-01 cascade (verified via typecheck, not guessed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings / scope authority
- `.planning/codebase/FINDINGS.md` — F-09 (CLEAN-01 view-mode, **note its "toggle not rendered" evidence is inaccurate** — see D-01), F-03/F-04/F-08 (web-portal already-resolved → CLEAN-02 is residual-doc only), F-06 (CLEAN-03 enrich-dish, names the exact stale lines + the verified current inputs).
- `.planning/REQUIREMENTS.md` — CLEAN-01 / CLEAN-02 / CLEAN-03 acceptance criteria.
- `.planning/ROADMAP.md` § Phase 5 — Success Criteria + the scope note (web-portal deletion already done; SC#3's "preserve migration-151 trigger language").

### CLEAN-01 target files
- `apps/mobile/src/stores/viewModeStore.ts`, `apps/mobile/src/components/map/ViewModeToggle.tsx`, `apps/mobile/src/components/map/RestaurantMarkers.tsx` — delete.
- `apps/mobile/src/screens/BasicMapScreen.tsx`, `apps/mobile/src/components/map/DailyFilterModal.tsx`, `apps/mobile/src/components/map/index.ts`, `apps/mobile/src/styles/modalScreen.ts`, `apps/mobile/src/styles/modals.ts`, `apps/mobile/src/styles/index.ts` — edit (remove orphaned usages/exports).

### CLEAN-02 target docs
- `CLAUDE.md`, `agent_docs/architecture.md`, `.github/copilot-instructions.md`, `INTEGRATION_COMPLETE_SUMMARY.md`, `agent_docs/conventions.md`, `agent_docs/commands.md`, `PROMPT.md`.

### CLEAN-03 target
- `infra/supabase/functions/enrich-dish/index.ts` (header lines 8-21).
- `infra/supabase/migrations/135_record_enrich_dish_triggers.sql` + `151` — context for which triggers stay alive (`trg_enrich_on_dish_change`, `after_dish_embedded`, `trg_enrich_on_option_group_change`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None to reuse — this phase only deletes/edits. `DishMarkers` (the surviving marker component) and the rest of `BasicMapScreen`'s dish path stay exactly as-is.

### Established Patterns
- Mobile changes are behavior-preserving and operator-verified on-device (no emulator in the agent loop) — applies to CLEAN-01.
- `CLAUDE.md` is loaded into every agent session → its accuracy matters more than a normal doc; rewrite, don't gut (D-06).
- Edge functions are Deno (cannot import workspace packages); enrich-dish is comment-only here, validate with `deno check`, not `tsc`.

### Integration Points
- `BasicMapScreen.tsx` and `DailyFilterModal.tsx` are the seams the CLEAN-01 cascade touches; both are themselves Phase 9 refactor targets, so leaving them pruned (zero view-mode residue) is the explicit Phase 9 prerequisite.
- `apps/web-portal` is already deleted + committed (`c1a7e3f`); `pnpm-workspace.yaml` / build config are already clean (per PROJECT.md) — so SC#2's "clean against workspace/build" is a confirmation step (grep for dangling imports), not a removal.

</code_context>

<specifics>
## Specific Ideas

- The F-09 assessment evidence claim — "The toggle is not rendered, so the branch is reachable only programmatically" — is **wrong**: `ViewModeToggle` is imported (`DailyFilterModal.tsx:28`) and rendered (`:146`), so the `🏪 Places` tab is tappable today. The removal is therefore a user-visible UI change, not a purely internal dead-code sweep. Captured so the planner sizes the on-device verification accordingly.
- Memory note "Mobile restaurant view mode disabled for now" was a signal that this might be a parked feature; the operator explicitly chose full removal (D-01) over parking. That memory is now superseded for this phase.

</specifics>

<deferred>
## Deferred Ideas

- **`CLAUDE.md:62` DishKind-shim sentence** → Phase 6 (DEBT-03) rewrites it when the shims are removed (D-07).
- **Code-comment provenance refs** in `menu-scan-worker/index.ts` and `backfill-cuisine-from-google.ts` → intentionally left as-is (D-05); revisit only if a future pass wants comment-level provenance cleanup.
- **`types.ts` regen** (F-07/DEBT-04) → Phase 6, once-after-teardown.

None of these are scope creep that surfaced during discussion — they are pre-existing adjacent items deliberately routed to their owning phases.

</deferred>

---

*Phase: 05-dead-code-doc-cleanup*
*Context gathered: 2026-06-20*
