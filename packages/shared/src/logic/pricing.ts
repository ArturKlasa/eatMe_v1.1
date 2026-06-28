// Card-price derivation for dishes whose price lives entirely in a size group
// (operator issue #4). When a menu prints only per-size prices ("Chica $90 /
// Mediana $120 / Grande $150") with no standalone base price, the dish row has
// price = null and the sizes arrive as a single-select group. Showing "—" on
// the card is wrong — the card should read "from $90". This helper computes
// that "from" price for the DISPLAY layer (existing data); new scans are fixed
// at the data layer by the menu-scan-worker backstop, which sets the dish price
// + display_price_prefix='from' directly.

/** Minimal structural shape — works with both the mobile and admin option types. */
interface PricedOption {
  price_delta: number;
  price_override?: number | null;
}
interface PricedGroup {
  selection_type: 'single' | 'multiple';
  min_selections?: number | null;
  options?: PricedOption[];
}

// The printed price an option contributes to a base-less size group: an override
// replaces the base outright; otherwise a positive delta IS the size's price.
// A zero/negative delta with no override carries no price (e.g. an "included"
// base option) — returns null, which disqualifies the group below.
function effectiveOptionPrice(o: PricedOption): number | null {
  if (o.price_override != null && o.price_override > 0) return o.price_override;
  if (o.price_delta > 0) return o.price_delta;
  return null;
}

/**
 * Returns the cheapest "from" price for a size-priced dish, or null.
 *
 * Returns a number ONLY when the dish has no standalone price AND exactly one
 * REQUIRED SINGLE-SELECT group (min_selections ≥ 1, ≥ 2 options) carries a
 * positive price on every option. Deliberately conservative: a based-price dish
 * (price set), an optional add-on group (min 0), a +$3 protein upgrade, or an
 * ambiguous multi-qualifying-group dish all return null so the caller falls back
 * to the dish's own price/prefix.
 */
export function deriveSizeFromPrice(
  price: number | null | undefined,
  groups: readonly PricedGroup[] | null | undefined
): number | null {
  if (price != null) return null;
  if (!groups || groups.length === 0) return null;

  const qualifying = groups.filter(g => {
    if (g.selection_type !== 'single') return false;
    if ((g.min_selections ?? 0) < 1) return false;
    const opts = g.options ?? [];
    if (opts.length < 2) return false;
    return opts.every(o => effectiveOptionPrice(o) != null);
  });
  const group = qualifying[0];
  if (qualifying.length !== 1 || !group) return null;

  const prices = (group.options ?? [])
    .map(effectiveOptionPrice)
    .filter((p): p is number => p != null);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}
