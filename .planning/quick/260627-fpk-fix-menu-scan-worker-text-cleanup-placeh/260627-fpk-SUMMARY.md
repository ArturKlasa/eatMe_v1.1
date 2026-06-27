---
quick_id: 260627-fpk
slug: fix-menu-scan-worker-text-cleanup-placeh
description: "Fix menu-scan-worker text cleanup: placeholder-word descriptions (#3) + global portion-size strip so size lands in the portion box (#5)"
date: 2026-06-27
status: complete
code_commit: 0957a2a
---

# Quick Task 260627-fpk — Summary

Fixed two operator-reported menu-scan defects, both in the worker's
post-extraction normalization. No prompt/schema/DB change. Operator redeploys
`menu-scan-worker` out-of-band.

## What changed (commit 0957a2a)

**`infra/supabase/functions/menu-scan-worker/index.ts`**
- **#3 — placeholder words in descriptions:** `normalizeText()` previously
  nulled a value only when it had no letter/digit, so literal word placeholders
  (`null`, `N/A`, `none`, `undefined`, `nil`, `tbd`) survived. Added a
  `PLACEHOLDER_TEXTS` set + a whole-string compacted-form check
  (`lowercase` + strip non-alphanumerics). Whole-string match only, so real
  words containing a placeholder as a substring (`naan`, `nilgai`) are kept.
  Covers both dish `description` and `suggested_category_description` (both
  already route through `normalizeText`).
- **#5 — size lands in description instead of portion box:**
  `stripPortionFromDescription()` switched from a trailing-only strip to a
  **global** strip — removes every occurrence of the verbatim
  `portion_source_text` (incl. mid-sentence) with whitespace/empty-bracket/
  separator tidy; collapses to `null` if nothing remains. Because the
  description is now fully cleaned, the existing `portionStillVisible()` check
  in `runExtraction()` is effectively **name-only**: the structured portion
  (amount/unit/source_text) is **kept** when the size only appeared in the
  description (so it renders in the portion box), and dropped only when the size
  is stuck mid-NAME. Comments on `stripPortionFromDescription`,
  `portionStillVisible`, and the `runExtraction` inline block updated.
- Name handling (`stripPortionSourceText`) unchanged — trailing-only and
  identity-safe (`'12" Sub'`, `'Quarter Chicken'`).

**`infra/supabase/functions/menu-scan-worker/test.ts`**
- Added #3 tests: `"null"` → null, `"N/A"` → null, `"none"` → null, and a
  `"Served with naan"` survives-unchanged guard.
- Rewrote `mid-sentence size` test to the new "box wins" behavior:
  `'250g de arrachera con guarnición'` → description `'de arrachera con
  guarnición'`, portion 250 / `g` / `'250g'` all kept.
- `mid-NAME`, trailing-description, and description-only-size tests unchanged.

## Accepted tradeoff (#5)
Reverses the 2026-06-09 "text wins, drop the box" decision in favor of "box
wins". Cost: an occasionally terse description when the size led the sentence
(`"250g de arrachera"` → `"de arrachera"`).

## Verification
- Gate: `cd infra/supabase/functions/menu-scan-worker && deno test
  --node-modules-dir=none -A test.ts` → **49 passed, 0 failed** (re-run after
  the pre-commit prettier pass — still green).

## Out-of-band operator step
- Redeploy `menu-scan-worker` after this merges (deploy from `infra/supabase/`).

## Follow-ups
- Original operator issues still open: **#4** (modifier price display — main card
  shows "-", deltas show in "+" box; mobile + admin) and **#1** (branch
  copy-menu suggestion for sucursales).
