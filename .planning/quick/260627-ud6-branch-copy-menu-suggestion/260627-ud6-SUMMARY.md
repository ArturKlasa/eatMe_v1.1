---
quick_id: 260627-ud6
slug: branch-copy-menu-suggestion
description: "Operator issue #1: proactively suggest copying a similarly-named restaurant's menu (branches/sucursales) in the empty-menu CopyMenuSection — trigram-ranked top-3 one-tap cards, dismissible, manual search fallback"
date: 2026-06-27
status: complete
code_commits: [faaaeb3, 9da6190]
---

# Quick Task 260627-ud6 — Summary

Closed the last original operator issue (#1): when an operator opens a
restaurant that has **no menu yet**, the admin now proactively suggests copying
the menu from a similarly-named restaurant (sucursales/branches) instead of
forcing a blind manual search.

## Key finding (scope reduction)

Copy-menu was already fully built (operator issue #16): `admin_copy_restaurant_menu`
(migration 160) deep-clones menus→categories→dishes→option_groups→options as
drafts, and `CopyMenuSection` already renders on the restaurant detail page when
`menus.length === 0` — but only offered a **manual `ilike` search**. There is no
admin "create restaurant" flow, so the empty-menu detail section is the only
consistent home. So #1 was an **enhancement** (proactive discovery), not new
machinery: copy mechanics + placement were already settled.

## Decisions (locked via --discuss, see CONTEXT.md)
- Match **all restaurants** by name similarity (no owner scoping).
- Eligible source = **any restaurant with ≥1 dish** (no published-only filter).
- UX = **top 3 ranked, dismissible** one-tap cards above the manual search;
  silent fallback (renders nothing) when no match.

## What changed

**`faaaeb3` — migration 179 `suggest_copy_source_restaurants`** (+ REVERSE_ONLY).
SQL function ranking other restaurants by trigram name similarity to a target.
Follows the migration 126 precedent: explicit
`similarity(f_unaccent(lower(r.name)), f_unaccent(lower(tgt.name))) >= 0.30`
(NOT the `%` operator, which is tied to pg_trgm's 0.3 GUC), so the threshold is
deterministic and Spanish accents/case are folded. Non-empty sources only
(`EXISTS dishes`), `CROSS JOIN LATERAL` for the target name, scalar count, top
N. `STABLE`, `SECURITY INVOKER`, granted to authenticated + service_role.

**`9da6190` — admin proactive suggestions** (`copyMenu.ts` + `CopyMenuSection.tsx`).
New `suggestCopySourceRestaurants(targetId)` server action wraps the RPC and maps
to the existing `CopySourceCandidate[]`. `CopyMenuSection` fetches suggestions
once on mount (ref guard against React StrictMode double-invoke), renders up to 3
"Looks like a branch?" cards (name · city · `N dishes · status`) that reuse the
existing `setSelected → handleCopy` copy flow. Dismissible; on empty/error it
renders nothing (suggestions are non-critical — manual search remains).

## Review pass (pre-implementation)

A self-review against the codebase caught a **real bug in the first draft**: the
plan paired `r.name % t.name` with `HAVING similarity >= 0.2`, but `%` enforces
pg_trgm's default 0.3 threshold, making the 0.2 floor dead code. Fixed by
switching to explicit `similarity()` (migration 126 pattern) + adding
`f_unaccent(lower(...))` accent folding + simplifying the query. Verified
`f_unaccent` survived the ingredient-pipeline drops (migrations 172–174).

## Verification
- Admin: `npx tsc --noEmit` clean; `npx vitest run` → **169 passed**.
- Migration SQL reviewed (parses; column list matches the action mapper).

## Out-of-band operator step
- **Apply migration 179** (`infra/supabase/`) so the suggestion RPC exists in
  prod. Until then the action returns an error → suggestions silently render
  nothing (manual search unaffected).
- Spot-check the suggestion cards on an empty restaurant whose name resembles an
  existing one.

## Known limits / tuning (intentional scope)
- `0.30` similarity cutoff is recall-favoring but a one-line tune; lower it if
  real branches are being missed, raise it if noisy.
- Explicit-similarity form can't use the GIN trgm index — fine at operator scale
  (seq scan). Revisit if the restaurants table grows large.
- No tests added (thin action; `copyMenu.ts` had none; stable admin tooling) —
  gated on tsc + existing vitest per test-ROI judgment.

## Follow-ups
- All 5 original operator menu-scan issues are now closed (#1–#5).
