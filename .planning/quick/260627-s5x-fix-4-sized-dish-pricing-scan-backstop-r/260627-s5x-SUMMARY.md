---
quick_id: 260627-s5x
slug: fix-4-sized-dish-pricing-scan-backstop-r
description: "Fix #4 sized-dish pricing: scan backstop reclassifies size deltas to final prices + 'from' base, plus mobile/admin display fallback for existing dishes"
date: 2026-06-27
status: complete
code_commits: [23c5aea, 2bda87a, cd9feee]
---

# Quick Task 260627-s5x — Summary

Fixed operator issue #4: a dish whose price lives entirely in size variants
showed the card price as `—` and the sizes as `+$X` deltas instead of final
prices. User-chosen approach: **both** — fix new scans at the data layer, patch
existing dishes at the display layer. No DB migration.

## Root cause
Scan prompt sets `price: null` when no standalone base is printed and captures
each size's printed price as a `price_delta` (override is reserved for
non-linear qty). `display_price_prefix` defaults to `'exact'`. So `dish.price`
is null (→ `—`) and the sizes render as `+$90` surcharges.

## What changed

**`23c5aea` — `@eatme/shared`: `deriveSizeFromPrice(price, groups)`** (+ 10 vitest
cases). Returns the cheapest "from" price only when `price == null` AND exactly
one required single-select group (`min_selections ≥ 1`, ≥2 options) carries a
positive price on every option (`price_override ?? price_delta`). Conservative:
based-price dishes, optional add-ons, `+$3` upgrades, and ambiguous multi-group
dishes return null.

**`2bda87a` — worker backstop `deriveSizeGroupPricing`** (`menu-scan-worker`, +4
deno tests, 53 total). For a base-less dish with exactly one required
single-select group whose options are all positive deltas (no override):
convert `delta → price_override` (final prices), set `dish.price = cheapest`,
set `dish.display_price_prefix = 'from'`. Runs after the zero-override collapse.
`display_price_prefix` rides `result_json` → `reviewHelpers` (`d
.display_price_prefix ?? 'exact'`) → confirm → DB. Leaves based-price dishes,
optional groups, existing override-quantity groups (`12 wings $45`), and
0-delta/included-option groups untouched.

**`cd9feee` — display fallback (admin + mobile)**. `DishRowEditor.tsx` row cell
and `DishMenuItem.tsx` card both call `deriveSizeFromPrice` and render
`from $<cheapest>` instead of `—` for existing null-price size-priced dishes.
New backstopped dishes carry `price` + `'from'` prefix and hit the normal path
(no double-handling).

## Verification
- Worker: `deno test --node-modules-dir=none -A test.ts` → **53 passed**.
- Shared: `vitest` → **100 passed**; `tsc --noEmit` clean.
- Admin: `vitest run` → **169 passed**; `tsc --noEmit` clean.
- Mobile: `tsc --noEmit` clean (card appearance verified on-device by operator).

## Out-of-band operator step
- Redeploy `menu-scan-worker` (from `infra/supabase/`) so the backstop is live.

## Known limits (intentional scope)
- An all-`price_override` group with a null base ("12 wings $45" as the sole
  pricing, no base) is rescued at DISPLAY (helper) but NOT baked into data by
  the delta-only worker backstop — the scan-REVIEW screen (`DishCard`) would
  still show `—` for that rare case. The published-row + mobile card show
  `from $X`.
- Mobile detail option list (`ModifierGroupsList`) still shows `+$X` for EXISTING
  delta-shaped sizes; new scans store overrides so they render as absolute.

## Follow-ups
- Last original operator issue open: **#1** (suggest copy-menu when a published
  restaurant with a similar name exists — sucursales/branches).
