# Restaurant currency handling

**Status:** Shipped 2026-06-01.
- Commit 1: `373912f feat(db): add currency_code to restaurants`
- Commit 2: `04eab84 feat(shared): canonical currency module in @eatme/shared`
- Commit 3: `aedbbbe feat(menu-scan): pass restaurant currency into AI prompt`
- Commit 4: `e1f17a5 feat(admin): country + currency picker on restaurant form; currency-aware price inputs`
- Commit 5: `3c0309e feat(mobile): render dish prices in restaurant currency`

**Known follow-up:** the `feed` Edge Function builds dish payloads from the
`generate_candidates` SQL RPC, which currently does not surface
`restaurants.currency_code`. Dish prices rendered in the swipe feed therefore
fall back to USD via `formatPrice(amount, undefined)` until that RPC is
migrated. Acceptable interim state per the plan's "Risks + mitigations" table.

**Date:** 2026-05-24 (decimal policy updated 2026-05-25)
**Driver:** "Mobile shows `$25.00` for a 25 PLN dish" — `country_code` is a free-text field with no picker, no `currency_code` column anywhere, and mobile's `formatPrice` is sourced from the device locale rather than the restaurant.

## Goal

Every price in the app reflects the **restaurant's** currency, formatted via `Intl.NumberFormat` with native conventions:

| Stored value | USD | PLN | EUR | JPY |
|---|---|---|---|---|
| `12` | `$12` | `25 zł` | `12 €` | `¥1500` |
| `12.5` | `$12.5` | `24,5 zł` | `12,5 €` | `¥1500` (rounds) |
| `9.99` | `$9.99` | `9,99 zł` | `9,99 €` | n/a |

A traveling user never sees mismatched currency. Whole-number prices render without trailing zeros across all currencies — real menu prices are frequently round numbers, and `$12.00` / `25,00 zł` reads as needless noise.

## Locked decisions

1. **DB:** `restaurants.currency_code text NOT NULL DEFAULT 'USD'` + CHECK regex `^[A-Z]{3}$`. Backfill from existing `country_code` via the country→currency map already in `currencyConfig.ts`.
2. **AI worker:** Trust `restaurant.currency_code`. Prompt mentions currency for context ("prices are in {name}, strip the symbol when extracting"). **No** AI-side mismatch detection or schema change. Avoids fail-loud risk; admin remains source of truth. Worker fetches the restaurant's `currency_code` **once at job start**, not per page — avoids N+1 Supabase queries on multi-page menus.
3. **Form:** Restaurant form gets BOTH a country picker AND a currency picker. Currency auto-fills from country on country change, but admin can override (resort-in-Mexico-with-USD-menu case).
4. **Decimal rules — uniform auto-suppress:** All fiat currencies render with `{ minimumFractionDigits: 0, maximumFractionDigits: 2 }` so trailing zeros are hidden. `12 → $12`, `12.5 → $12.5` (math value `12.50` is the same number — Intl drops the trailing zero), `12.99 → $12.99`. Currencies without minor units (JPY, COP, CLP, ARS) use `{ min: 0, max: 0 }` and round any stray decimals. Fixes the current bug where `maximumFractionDigits: 0` truncates real cents away.
5. **Supported set:** 12 currencies; **25 countries** (expand existing list of 22 by adding `EC`, `SV`, `PA` — all USD users — so the TS `COUNTRY_TO_CURRENCY` map and the migration's backfill CASE stay in lockstep). Unmapped countries silently fall back to USD; no admin warning UI (would be feature creep).

## Architecture

### Shared module (new)

```
packages/shared/src/logic/currency.ts
  ├─ SupportedCurrency type (12 codes)
  ├─ CURRENCY_CONFIG (symbol, locale, sliderRange per currency)
  ├─ COUNTRY_TO_CURRENCY map (25 countries — kept in lockstep with migration 147's backfill CASE)
  ├─ getCurrencyForCountry(countryCode): SupportedCurrency  // 'USD' fallback for unknown
  ├─ formatPrice(amount: number, currency?: SupportedCurrency | null): string
  │      // null/undefined → 'USD' silent fallback for stale data.
  │      // Decimal rule is an inline switch inside the helper:
  │      //   JPY/COP/CLP/ARS → { min: 0, max: 0 }
  │      //   everything else → { min: 0, max: 2 }
  └─ getCurrencyInfo(currency): CurrencyInfo
```

Replaces (and re-exports from) the mobile-only `apps/mobile/src/utils/currencyConfig.ts`. The mobile file shrinks to a thin re-export so existing imports keep working without a sweep.

**Decimal rule lives in the helper, not the data.** `CURRENCY_CONFIG` does **not** carry a `fractionDigits` field — the JPY-class check is an inline switch inside `formatPrice`. Less data, same outcome, easier to read.

### DB migration 147

```sql
-- 147_restaurants_currency_code.sql
ALTER TABLE public.restaurants
  ADD COLUMN currency_code text NOT NULL DEFAULT 'USD',
  ADD CONSTRAINT restaurants_currency_code_valid
    CHECK (currency_code ~ '^[A-Z]{3}$');

-- Backfill from country_code for the 25 mapped countries (must match COUNTRY_TO_CURRENCY in shared module).
UPDATE public.restaurants SET currency_code = CASE
  WHEN UPPER(country_code) IN ('US','EC','SV','PA') THEN 'USD'
  WHEN UPPER(country_code) IN ('DE','ES','FR','IT','PT','NL','BE','AT','GR','IE','FI') THEN 'EUR'
  WHEN UPPER(country_code) = 'PL' THEN 'PLN'
  WHEN UPPER(country_code) = 'GB' THEN 'GBP'
  WHEN UPPER(country_code) = 'MX' THEN 'MXN'
  WHEN UPPER(country_code) = 'CA' THEN 'CAD'
  WHEN UPPER(country_code) = 'AU' THEN 'AUD'
  WHEN UPPER(country_code) = 'BR' THEN 'BRL'
  WHEN UPPER(country_code) = 'JP' THEN 'JPY'
  WHEN UPPER(country_code) = 'CO' THEN 'COP'
  WHEN UPPER(country_code) = 'AR' THEN 'ARS'
  WHEN UPPER(country_code) = 'CL' THEN 'CLP'
  ELSE 'USD'
END;

-- 147_REVERSE_ONLY_restaurants_currency_code.sql
ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_currency_code_valid,
  DROP COLUMN IF EXISTS currency_code;
```

After applying: regen `packages/database/src/types.ts` via `supabase gen types typescript --linked`.

### Menu-scan worker (prompt enrichment, no schema change)

`infra/supabase/functions/menu-scan-worker/index.ts`:

1. Add **one** Supabase fetch at job start to read `restaurants.currency_code` for the job's restaurant. Cache the resolved `CurrencyInfo` in the per-job scope; reuse across all page extractions. Do NOT refetch per page.
2. Resolve to `{ name, symbol, code }` via an inlined copy of `getCurrencyInfo` (Deno edge runtime can't import workspace packages — same constraint as the existing inlined `countryToLanguage` usage).
3. Inject into the prompt:
   ```
   This restaurant's prices are in {NAME} ({SYMBOL}, ISO code: {CODE}).
   Extract numeric values only — strip the "{SYMBOL}" symbol if it appears next to a price.
   ```
4. **No** Zod schema change. **No** `currency_mismatch` field.

### Restaurant form — country + currency picker

Admin form gains two new fields:
- **Country** — `<select>` ISO alpha-2, sorted by name. Listed countries = the 25 in our map; "Other" available with a free-text override that still saves to `country_code` (currency picker stays on whatever it was; no toast).
- **Currency** — `<select>` from `SupportedCurrency`. Defaults to the country-mapped value when country changes. Manual override allowed and persisted as-is.

Wire-up:
- **Zod schemas** for `country_code` + `currency_code` land in **Commit 2** (shared module). The form UI consumes them in Commit 4.
- Server actions in Commit 4 propagate the new fields end-to-end.

### Mobile display refactor

Plumb `currency_code` from the restaurant query down to every dish render site.

**SELECT allowlist additions:**
- `apps/mobile/src/stores/restaurantStore.ts:277` (restaurant detail SELECT) — add `currency_code`.
- `apps/mobile/src/stores/restaurantStore.ts:329` — N/A (this query is keyed off `menu_categories`; currency comes from the parent restaurant detail).

**Edge Function:**
- `infra/supabase/functions/nearby-restaurants/index.ts` — add `currency_code` to the response payload so the swipe feed has it before drilling into detail.

**Render sites to rewrite (17 hardcoded `$` spots across 7 files):**

| File | Lines | Change |
|---|---|---|
| `DishMenuItem.tsx` | 34, 37, 46 | `formatPrice(item.price, restaurant.currency_code)` |
| `VariantPickerSheet.tsx` | 82, 84 | Same + signed delta variant |
| `ModifierGroupsList.tsx` | 140, 143 | Same |
| `DishPhotoModal.tsx` | 182, 183, 187, 344, 370 | Same |
| `SelectDishesScreen.tsx` | 57 | Same |
| `FoodTab.tsx` | 199-201 | Pass currency to existing `restaurant.fromPrice` i18n interpolation |
| `restaurant.fromPrice` i18n keys | en/es/pl | Remove hardcoded `$` from translation string; render currency separately |

Keep `i18nUtils.formatCurrency`'s device-locale fallback **only** for genuinely device-local UI (filter price slider). Dish-price callsites stop using it.

### Admin display + input refactor

| File | Sites | Change |
|---|---|---|
| `DishRowEditor.tsx` | 96, 123, 279, 384-397, 638, 642 | Replace local `formatPrice` helper (line 53-56) with `formatPrice(amount, restaurant.currency_code)`; show currency code/symbol next to price input |
| `ReviewDishEditor.tsx` | 692-705 | Prefix input with restaurant currency symbol; label `Price ({code})` |
| `ModifierGroupsEditor.tsx` | 304-320, 322-337 | Currency-aware prefix on price_delta and price_override inputs |
| `AddDishButton.tsx` | 189-197 | Same prefix on the dish-create dialog price input |

Restaurant context (currency_code) needs to flow down from the page-level loader to all four editors. The admin DAL (`apps/admin/src/lib/auth/dal.ts`) already returns a restaurant record per page — add `currency_code` to its SELECT allowlist and AdminRestaurant type.

## Rollout — 5 atomic commits

1. **`feat(db): add currency_code to restaurants`**
   - Apply migration 147 (apply via Supabase dashboard).
   - Regen `packages/database/src/types.ts`.
   - Type-check passes (no UI consumers yet).

2. **`feat(shared): canonical currency module in @eatme/shared`**
   - Create `packages/shared/src/logic/currency.ts`.
   - Fix `formatPrice` decimal-digits-per-currency bug.
   - Mobile's `currencyConfig.ts` becomes a thin re-export from `@eatme/shared`.
   - Restaurant Zod schemas accept `country_code` + `currency_code`.

3. **`feat(menu-scan): pass restaurant currency into AI prompt`**
   - Worker reads restaurant `currency_code` from DB before OpenAI call.
   - Prompt mentions currency name + symbol; AI strips symbols when extracting.
   - Deploy Edge Function manually (user-driven step).

4. **`feat(admin): country + currency picker on restaurant form; currency-aware price inputs`**
   - Country picker + currency picker on restaurant edit form.
   - Currency auto-fills from country on change; admin can override.
   - All admin price inputs render their restaurant's currency symbol.
   - DAL SELECT allowlist + AdminRestaurant type gain `currency_code`.

5. **`feat(mobile): render dish prices in restaurant currency`**
   - `restaurantStore.ts` SELECT allowlist + nearby-restaurants Edge Function response add `currency_code`.
   - 17 hardcoded `$` sites rewritten to use `formatPrice(amount, restaurant.currency_code)`.
   - `restaurant.fromPrice` i18n key restructured to take currency-formatted price.

## Acceptance criteria

- [ ] `restaurants.currency_code` is NOT NULL with CHECK constraint; every existing row has a value.
- [ ] Restaurant edit form has country + currency pickers; saving Poland defaults currency to PLN; admin can override.
- [ ] **Form interaction:** changing the country picker auto-updates the currency picker to the country's mapped currency; the admin can then override and the override is what gets persisted.
- [ ] Mobile swipe feed + restaurant detail render Polish restaurant prices as `25 zł` for whole złoty and `24,5 zł` for half (not `$25.00` and not `25,00 zł`).
- [ ] Mobile JPY restaurant prices render with no decimals (`¥1500`, not `¥1500.00`).
- [ ] Admin price inputs in modifier editor + dish row + add-dish dialog + menu-scan review all show the restaurant's currency symbol.
- [ ] Menu-scan worker prompt mentions the restaurant's currency; AI doesn't include `$` (or any symbol) in extracted numeric values.
- [ ] `formatPrice(amount, undefined)` and `formatPrice(amount, null)` both return a USD-formatted string (defensive fallback for stale/missing data).
- [ ] `pnpm turbo check-types` + `turbo lint` + admin Vitest all green after each commit.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Existing restaurants have wrong `country_code` (free-text legacy data) | Backfill defaults to USD; admin must visit each restaurant once to confirm. Could add a one-time "needs review" flag if volume warrants. |
| Mobile renders broken for restaurants in unsupported countries (beyond the 25 mapped) | `getCurrencyForCountry` returns 'USD' for unmapped countries — safe fallback. Admin can still manually pick a different currency from the supported 12. |
| AI ignores the "strip symbol" instruction and includes `$` in `price` | Catch in admin review; field is `number`-typed in Zod so a string would fail validation. Worst case the dish is dropped from the page, which is recoverable. |
| `nearby-restaurants` Edge Function adds `currency_code` to its response — mobile clients on older bundles will simply ignore the new field. Newer mobile bundles deployed before the Edge Function rolls out would read `undefined`. | Deploy the Edge Function before shipping the mobile commit that consumes it. As a belt-and-braces backstop, `formatPrice` accepts `undefined`/`null` and defaults to USD — see Acceptance criteria. |
| Plan order (DB before shared, shared before admin/mobile UI) is critical | Each commit's type-check guards the order; out-of-order applies will fail loudly. |

## Out of scope

- Per-dish currency (exotic; not needed for restaurant-scoped food apps).
- Currency conversion / FX rates (no consumer-side conversion; price is always shown in the restaurant's currency).
- Adding new currencies beyond the existing 12.
- Migrating historical dish prices between currencies if a restaurant changes its `currency_code` post-hoc (admin's responsibility to update prices too; flag with a warning maybe).

## NEXT REVISION

When this plan is executed, this file should be left in place and marked **Status: Shipped** with the commit hashes. If a follow-up currency feature is added (e.g. mismatch detection, FX conversion, per-dish currency), spawn a new plan that references this one.
