# Menu-scan operator issues — triage & solutions

Source: operator feedback (16 issues), triaged 2026-06-09. Each entry: root cause
(with file refs), proposed fix, effort. Nothing here is implemented yet — each
item gets explicit go-ahead before work starts.

Key files:
- Worker: `infra/supabase/functions/menu-scan-worker/index.ts` (prompt ~315–435, extraction ~475–676)
- Upload: `apps/admin/src/lib/upload.ts`
- Review UI: `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` + `useReviewState.ts`
- Confirm RPC: migration `144_admin_menu_scan_and_modifier_rpcs.sql` (+146)
- Places import: `apps/admin/src/app/(admin)/imports/actions/places.ts`

---

## A. Extraction-quality cluster (5, 7, 8, 10 — and feeds 6)

**Symptoms:** invented names ("Pollo delight en su nido" → "Pollo general tsu"),
word substitutions ("Espagueti" → "Esparagus", "boing" → "Bonaqua", "tocino y
chorizo" → "chile y tocino"), wrong prices, missing dishes.

**Root causes (layered):**
1. **Resolution ceiling.** `compressImage` (upload.ts:5–11) caps uploads at
   **2048 px / 2 MB / q0.85**. A full menu page at 2048 px leaves each dish line
   ~15–20 px tall — exactly the regime where a vision model substitutes plausible
   words/brands instead of reading. The worker already requests `detail:
   'original'` (index.ts:505), which accepts up to ~6000 px — we're throwing away
   resolution client-side before the model ever sees the image.
2. **Model tier.** `PRIMARY_MODEL = 'gpt-5.4-mini'`; the documented escalation
   (index.ts:463–466) is `gpt-5.5`.
3. **Silent partial failures** (→ "less dishes than it should"). In
   `runExtraction` (index.ts:629–668) a failed page only `console.warn`s; the job
   still completes `needs_review` with that page's dishes simply absent. Same
   for token truncation (index.ts:524–531). The operator has no signal.

**Proposed fixes (in order of ROI):**
- **A1.** Raise upload caps: `maxWidthOrHeight` 2048 → **4096**, `maxSizeMB`
  2 → **6**. One-line-ish change; biggest single quality lever. (Worker memory
  check: 10 pages × ~8 MB base64 is fine for the edge runtime.)
- **A2.** Surface per-page failures: worker adds `failed_pages: number[]` and
  `truncated_pages: number[]` to `result_json`; review UI shows a warning banner
  ("Page 3 returned nothing — replay the scan"). Small worker + UI change.
- **A3.** Low-res warning at upload time: if the *source* image (pre-compression)
  is < ~1500 px on its long side, warn the operator before scanning. Photos of
  good paper menus taken as small screenshots were the historical root cause.
- **A4 (optional, costs more per scan).** Escalate `PRIMARY_MODEL` to `gpt-5.5`,
  or auto-rescan pages whose average dish confidence is low. Decide after A1–A3
  land — resolution may be enough.

## 1. Categories merge ("tostadas" swallowed by "entradas")

The model assigns each dish `suggested_category_name` / `canonical_category_slug`;
the review UI groups strictly by those per-dish values (ReviewDishEditor
`getGroupKey`). Merging means the model carried the previous section header
forward or mapped two distinct headers to the same canonical slug.

**Fix:** prompt hardening in `buildExtractionPrompt`: dishes belong to the
*nearest header above*; two *different printed headers must never merge*, even if
semantically close — when unsure of canonical match, emit null slug + verbatim
header. Partially mitigated by A1 (headers are often small caps text). Small.

**Priority (user, 2026-06-09): deferred — fix this one LAST.**

**Implemented 2026-06-11** (last of the 16): prompt rules (positional
attribution + no-merge with null-slug escape) **plus a deterministic backstop**
`resolveCategorySlugCollisions` in `runExtraction` — the first printed section
(menu order) to claim a slug keeps it; a later, *different* header claiming the
same slug loses the slug and falls back to the custom-category path
(`suggested_category_name` survives verbatim). Headers compared
case/diacritic-insensitively so a section restated on a later page is not a
false positive; headerless dishes are skipped (nulling them would dump dishes
in "uncategorized"). The backstop is the only cross-page enforcement — each
model call sees one image. 4 Deno tests. Awaiting worker deploy, then tune the
prompt wording against real bad scans (over-splitting / null-spam is the
failure mode to watch).

## 2. Grams doubled in description

Prompt (index.ts:339–342) says "Keep the size text in the name and description —
do NOT delete it". The model reads that as "ensure the size appears in the
description" and *adds* e.g. "250g" to descriptions that didn't print it. The
name gets cleaned app-side (`stripPortionSourceText`, index.ts:593) — the
description doesn't.

**Confirmed mechanism (operator, 2026-06-09):** "250g" stays in the description
text AND the app renders the portion chip from `portion_amount` — doubled on
screen.

**Fix (design confirmed with user):** apply the same conservative trailing-only
`stripPortionSourceText` cleanup to `description` that the name already gets
(worker, `runExtraction`), plus prompt wording: keep printed text verbatim,
never *add* size text to a field where it isn't printed. Then a final
deterministic check: if `portion_source_text` is STILL visible in the name or
description after stripping (mid-sentence, e.g. "250g de arrachera con…"), null
out `portion_amount`/`portion_unit` — the chip only renders when the size was
actually removed from the visible text, so it can never double. Small.

## 3. Description ingredients extracted as bundled items

`bundled_items` prompt (index.ts:371–376) over-triggers on ingredient
enumerations ("con arroz, frijoles y tortillas").

**Fix:** prompt rule keyed on **wording, not format** (a blunt
"sentence → description" rule would misclassify real combos written as prose):
- Inclusion/accompaniment language → `bundled_items`, even in a sentence:
  "incluye…", "viene con…", "acompañado de…", "+ papas y refresco".
- Composition/preparation language → description: "preparados con…",
  "a base de…", "con salsa de…".
Accepted downside (discussed with user): occasional under-extraction — operator
adds a missing bundled item in review, which is cheaper than deleting wrong
ones dish-by-dish. Small.

## 4. Default currency USD for Mexican restaurants

`restaurants.currency_code` is `NOT NULL DEFAULT 'USD'` (migration 147). The
backfill in 147 derived currency from `country_code` for *existing* rows, but the
Places import (places.ts:157–173) sets **neither** `country_code` nor
`currency_code`, so every imported restaurant lands as USD. Worker + review UI
already read the restaurant's currency correctly (index.ts:699–713) — it's the
stored value that's wrong.

**Fix:**
- **4a.** Places import: add `places.addressComponents` to the field mask,
  extract the ISO country code, set `country_code` + `currency_code` via the
  existing `countryToCurrency` (packages/shared/src/logic/currency.ts:207).
  Check the CSV import path for the same gap.
- **4b.** One-time backfill for already-imported rows (all current restaurants
  are Mexican): `country_code='MX'`, `currency_code='MXN'` where unset/USD —
  dry-run via infra/scripts first, per the usual prod-mutation protocol.
- Small + a guarded backfill.

## 6. Modifier options not always scanned

Three contributors: (a) quality cluster (A1–A4); (b) **structural**: extraction
is strictly per-image (`callExtraction` sees one page; index.ts:475+), so a
modifier/add-on table printed on a different page or a separate menu section can
never attach to dishes; (c) prompt already covers modifiers well otherwise.

**Fix:** A-cluster + feature 12 (scan-a-screenshot-as-modifier-group), which is
the proper answer for separated modifier sections.

## 9. Modifier option prices come out 0

Prompt says `price_delta: 0 for the base/included option`; when options carry
printed prices in a column or "choice of ingredients" pricing, the model
sometimes defaults everything to 0.

**Fix:** prompt: *if an option shows its own printed price, capture it* (delta
relative to base, or `price_override` when it replaces the base price); use 0
only when the menu explicitly shows no surcharge. Plus a cheap review-UI signal:
amber-highlight a group whose options are all zero-delta/no-override. Small.

## 11. "Pechuga de Pavo" classified as chicken

`PRIMARY_PROTEINS` has no `turkey` (packages/shared/src/logic/protein.ts:1–13);
the model picks the nearest poultry = chicken.

**Fix (recommended): add `turkey`** with families `['meat','poultry']`, following
migration 131's rename playbook:
- Migration: swap CHECK constraints on `dishes.primary_protein` +
  `user_preferences.primary_protein`; update `compute_dish_protein_families`
  (defined in prod — dump current def first; known drift, see migration 135
  header) and the reachable-families CASE in `generate_candidates`
  (155:253).
- `packages/shared` protein.ts (`PRIMARY_PROTEINS` + `deriveProteinFields`).
- Worker enum mirror + prompt line listing proteins.
- Mobile: filter labels/i18n (en/es/pl); admin dropdowns pick it up via
  `PRIMARY_PROTEINS` automatically.
Medium effort, coordinated deploy (DB → shared → apps → worker).
Cheap alternative (not recommended): leave as chicken — family-correct for
filtering but wrong on the label the operator sees.

## 12. Scan a screenshot directly as modifier group(s) during review

Scope confirmed with user (2026-06-09): runs **after the main scan**, during
review — when a modifier group was missed or scanned wrong, the operator adds a
supplementary dish-level scan. Extraction covers **modifier groups AND bundled
items**.

`OPENAI_API_KEY` is already in apps/admin env, so this can be a **synchronous
server action** (no worker/job changes): review screen gets "Scan from image"
→ operator selects target dish(es) → upload via existing `uploadMenuScanPage`
→ new action `adminScanModifierGroups` calls OpenAI with a Zod schema limited
to modifier groups + bundled items (reuse `modifierGroupSchema` /
`bundledItemSchema` shapes) → returned groups/items shown in a preview picker →
deep-cloned into each selected dish in review state (client-side; persisted on
normal confirm). Medium effort. Pairs naturally with 13's multi-select.

## 13. Bulk-apply modifier groups to multiple dishes during review

Review state already centralizes group edits (`useReviewState` +
`groupReducers`); confirm payload is per-dish, so this is **pure client-side**:
- Checkbox multi-select on dish cards (ReviewDishEditor).
- "Copy modifier group(s) to selected dishes" on a source group/dish →
  deep-clone with fresh `_id`s into each selected dish.
Small-medium effort, high ROI. Recommended first implementation alongside 14.

## 14. Basic restaurant info not editable in admin

The card is explicitly read-only (restaurants/[id]/page.tsx:99–114), but the
server action **already exists**: `updateAdminRestaurantBasics`
(actions/restaurant.ts:179) covers name/description/city/address/phone/website
(+country/currency). Fix is UI-only: convert the card to an inline-editable form
(same pattern as `LocationCurrencySection`). Small.

## 15. Dots "." in empty descriptions

Fixed in commit `689b513` (2026-06-09): any punctuation-only placeholder (".",
":", whatever the model tries next) collapses to null, prompt updated, tests
added. **Pending manual deploy of menu-scan-worker.** Dots appearing after the
deploy would be from old scans, not new extractions.

## 16. Multiple branches sharing one menu

No branch/chain concept exists in the schema; each branch is its own
`restaurants` row with its own dishes; no copy tool exists anywhere.

**Pragmatic fix (confirmed by user 2026-06-09: one-time copy is enough):** admin
"Copy menu from another restaurant" action — server-side clone of menus →
menu_categories → dishes (incl. modifier groups, portion, protein fields) from
source to target restaurant as drafts; branch keeps its own
location/hours/currency. Later edits are per-branch. Medium effort. No
shared-menu schema change.

---

## Process (confirmed 2026-06-09)

Implement one-by-one / in batches; the user confirms each fix or batch before it
is implemented, and verifies the result before the next one starts.

## Suggested batching

All items confirmed by user 2026-06-09 (each batch still gets explicit
go-ahead + user verification before the next starts).

| Batch | Items | Theme | Status |
|---|---|---|---|
| 1 | A1–A3, 2, 3, 9, 10 (+15 deploy) | One worker redeploy + upload tweak: prompt hardening + resolution + failure surfacing | done — `5e98506`, worker deployed, verified 2026-06-10 |
| 2 | 4a, 4b | Currency defaults + backfill | done — `6f3b806`, backfill applied (462 rows → MX/MXN) 2026-06-10 |
| 3 | 13, 14 | Review-UI ergonomics (client-only) | done — `34db6d8`, verified 2026-06-10 |
| 4 | 12 | Modifier/bundle scan-attach during review (selection-bar bulk + per-dish 📷 button) | done — verified 2026-06-10 |
| 5 | 11 | Turkey protein (coordinated DB change) | done — migration 159 applied 2026-06-11; also created the missing `compute_dish_protein_families` trigger + backfilled 7,104 dishes whose empty `protein_families` let meat dishes pass the vegetarian filter |
| 6 | 16 | Menu copy tool | done — `9532a9c`, migration 160 applied + smoke-tested 2026-06-11 |
| later | A4 | Model escalation — only if quality still short after batch 1 | conditional |

Issue 1 (category merging) is tracked SEPARATELY from the batch sequence
(user, 2026-06-10) — it's a worker-prompt change to be tuned on its own
against real scans, not bundled with a feature batch. Implemented 2026-06-11
(prompt rules + deterministic slug-collision backstop — see §1); pending
worker deploy + tuning against the next real merged-category scan.
