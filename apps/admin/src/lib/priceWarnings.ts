// Soft operator guardrail (operator request 2026-06-12): flag dish prices
// that are implausibly high for the restaurant's currency — usually a scan
// misread (combo/bundle price landing on a single dish, thousands separator
// confusion) or a typo. Frontend warning only; never blocks save or confirm.
//
// Thresholds are per CURRENCY, not country — dish prices are stored in the
// restaurant's currency. Operator-set: >500 MXN, >50 USD, >100 PLN.
// Currencies not in the map produce no warning; extend as markets open.
const PRICE_WARN_THRESHOLDS: Record<string, number> = {
  MXN: 500,
  USD: 50,
  PLN: 100,
};

export function isSuspiciouslyHighPrice(
  price: number | null | undefined,
  currencyCode: string
): boolean {
  if (price == null) return false;
  const threshold = PRICE_WARN_THRESHOLDS[currencyCode];
  return threshold !== undefined && price > threshold;
}

export function priceWarnMessage(currencyCode: string): string {
  return `Unusually high (>${PRICE_WARN_THRESHOLDS[currencyCode]} ${currencyCode}) — double-check the menu`;
}
