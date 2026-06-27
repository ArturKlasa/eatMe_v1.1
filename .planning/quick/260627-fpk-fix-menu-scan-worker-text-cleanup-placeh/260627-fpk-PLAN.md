---
quick_id: 260627-fpk
slug: fix-menu-scan-worker-text-cleanup-placeh
description: "Fix menu-scan-worker text cleanup: placeholder-word descriptions (#3) + global portion-size strip so size lands in the portion box (#5)"
date: 2026-06-27
mode: quick
status: planned
---

# Quick Task 260627-fpk — Plan

Fixes two operator-reported menu-scan defects, both isolated to the worker's
post-extraction normalization in
`infra/supabase/functions/menu-scan-worker/index.ts` (+ its `test.ts`). No
prompt change, no DB change, no deploy (operator redeploys out-of-band).

## Issue #3 — `"null"` / `"N/A"` placeholder text reaches descriptions

`normalizeText()` nulls a value only when it contains **no** letter/digit, so
literal word placeholders (`null`, `N/A`, `none`, `undefined`, `nil`, `tbd`)
survive into the description and section-description fields.

## Issue #5 — printed size lands in the description instead of the portion box

`stripPortionFromDescription()` only strips the verbatim `portion_source_text`
from the **end** of the description. When the size sits mid-sentence the strip
can't remove it, so `portionStillVisible()` then **drops** the structured
portion — the grams stay in the text and the portion box is empty. This
reverses that priority: globally strip the size from the description and **keep
the box**.

## Tasks

### Task 1 — Code (index.ts)
- `normalizeText()` (~L614): after the existing trim + leading-punct strip,
  compute a compacted form (`toLowerCase()` + drop all non-alphanumerics via
  `/[^\p{L}\p{N}]/gu`) and return `null` when it whole-string matches a known
  placeholder set `{ null, na, none, undefined, nil, tbd, nodescription,
  sindescripcion }`. Substrings like `"naan"` are unaffected. Covers both dish
  `description` and `suggested_category_description` (both already route here).
- `stripPortionFromDescription()` (~L726): switch from trailing-only to a
  **global** strip — remove every occurrence of the token (optional `()`/`[]`
  wrap + leading separator class, `g`+`i` flags), replace with a space, then
  tidy (collapse 2+ spaces, drop empty bracket pairs, strip leading/trailing
  separators, trim); collapse to `null` if nothing remains.
- `runExtraction()` inline block (~L803-807): no logic change needed — because
  the description is now fully cleaned, the existing `portionStillVisible` check
  becomes effectively **name-only**, so the box is kept unless the size is stuck
  mid-NAME. Update the comment to describe the new behavior.
- Update comments on `stripPortionFromDescription` + `portionStillVisible` to
  match; note the reversal of the 2026-06-09 "text wins, drop the box" tradeoff.
- `stripPortionSourceText` (name strip) stays trailing-only/conservative —
  unchanged (protects identity names like `'12" Sub'`, `'Quarter Chicken'`).

### Task 2 — Tests (test.ts)
- Add #3 cases: description `"null"` → null; `"N/A"` → null; `"none"` → null;
  plus a guard that `"Served with naan"` survives unchanged.
- Rewrite `'portion strip: mid-sentence size keeps text, drops portion fields'`
  (~L1060) to the new behavior: `'250g de arrachera con guarnición'` →
  description `'de arrachera con guarnición'`, portion_amount `250`, unit `g`,
  source_text `'250g'` all KEPT. Update the rationale comment.
- Leave `mid-NAME` (~L1080), trailing-description (~L1024), and
  description-only-size (~L1044) tests unchanged — they must still pass.

## must_haves
- truths:
  - A description whose only content is a placeholder word (`null`/`N/A`/`none`/
    `undefined`/`nil`/`tbd`) is stored as `null`.
  - A real word containing a placeholder as a substring (e.g. `"naan"`) is kept.
  - When a printed size appears only in the description, the structured portion
    (amount/unit/source_text) is kept and the size is stripped from the text.
  - A size stuck mid-NAME still drops the structured portion (unchanged).
- artifacts:
  - `infra/supabase/functions/menu-scan-worker/index.ts` (normalizeText,
    stripPortionFromDescription, comments)
  - `infra/supabase/functions/menu-scan-worker/test.ts` (new + rewritten tests)
- key_links:
  - Gate: `cd infra/supabase/functions/menu-scan-worker && deno test
    --node-modules-dir=none -A test.ts` (all green)

## Out of scope / out-of-band
- No prompt, schema, or DB change. No bundled_items / modifier-name normalization.
- Operator redeploys `menu-scan-worker` after merge.
