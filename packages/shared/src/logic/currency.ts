/**
 * Currency module — canonical for the EatMe monorepo.
 *
 * Promoted from `apps/mobile/src/utils/currencyConfig.ts` (which now re-exports
 * from here) so the admin app, the menu-scan worker, and the mobile app all
 * share one map of supported currencies + one formatter.
 *
 * Currency is a per-restaurant fact (`restaurants.currency_code`). It is NOT
 * device-derived for dish/menu prices — a US tourist's phone should still
 * show Polish złoty for a Polish restaurant. The device-locale fallback
 * survives only in mobile's filter price-slider, where the user is choosing
 * their own price preference.
 *
 * Adding a 13th currency: extend SUPPORTED_CURRENCIES + CURRENCY_CONFIG, then
 * (if it has a clear country home) extend COUNTRY_TO_CURRENCY AND the
 * matching CASE in migration 147's backfill — the two must stay in lockstep.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = [
  'USD',
  'MXN',
  'PLN',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'BRL',
  'JPY',
  'COP',
  'ARS',
  'CLP',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyInfo {
  /** ISO 4217 currency code */
  code: SupportedCurrency;
  /** Display symbol (e.g. "$", "zł", "€") */
  symbol: string;
  /** Full display name */
  name: string;
  /** BCP 47 locale used for Intl.NumberFormat — chosen for native digit grouping + decimal separator. */
  locale: string;
  /** Sensible per-meal price range defaults for the mobile filter price slider. */
  priceRange: {
    min: number;
    max: number;
    /** Slider step increment */
    step: number;
    /** Absolute slider maximum (hard ceiling) */
    sliderMax: number;
  };
}

// ─── Currency definitions ─────────────────────────────────────────────────────

export const CURRENCY_CONFIG: Record<SupportedCurrency, CurrencyInfo> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    priceRange: { min: 10, max: 50, step: 5, sliderMax: 200 },
  },
  MXN: {
    code: 'MXN',
    symbol: '$',
    name: 'Mexican Peso',
    locale: 'es-MX',
    priceRange: { min: 50, max: 250, step: 25, sliderMax: 250 },
  },
  PLN: {
    code: 'PLN',
    symbol: 'zł',
    name: 'Polish Złoty',
    locale: 'pl-PL',
    priceRange: { min: 20, max: 120, step: 10, sliderMax: 500 },
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    priceRange: { min: 8, max: 35, step: 5, sliderMax: 150 },
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
    priceRange: { min: 7, max: 30, step: 5, sliderMax: 120 },
  },
  CAD: {
    code: 'CAD',
    symbol: '$',
    name: 'Canadian Dollar',
    locale: 'en-CA',
    priceRange: { min: 12, max: 55, step: 5, sliderMax: 200 },
  },
  AUD: {
    code: 'AUD',
    symbol: '$',
    name: 'Australian Dollar',
    locale: 'en-AU',
    priceRange: { min: 15, max: 60, step: 5, sliderMax: 200 },
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    locale: 'pt-BR',
    priceRange: { min: 30, max: 150, step: 10, sliderMax: 600 },
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    locale: 'ja-JP',
    priceRange: { min: 800, max: 4000, step: 200, sliderMax: 15000 },
  },
  COP: {
    code: 'COP',
    symbol: '$',
    name: 'Colombian Peso',
    locale: 'es-CO',
    priceRange: { min: 20000, max: 80000, step: 5000, sliderMax: 300000 },
  },
  ARS: {
    code: 'ARS',
    symbol: '$',
    name: 'Argentine Peso',
    locale: 'es-AR',
    priceRange: { min: 3000, max: 15000, step: 1000, sliderMax: 60000 },
  },
  CLP: {
    code: 'CLP',
    symbol: '$',
    name: 'Chilean Peso',
    locale: 'es-CL',
    priceRange: { min: 5000, max: 20000, step: 1000, sliderMax: 80000 },
  },
};

// ─── Country → Currency mapping ───────────────────────────────────────────────
// ISO 3166-1 alpha-2 → SupportedCurrency.
//
// IMPORTANT: this list MUST stay in lockstep with the CASE expression in
// migration 147 (infra/supabase/migrations/147_restaurants_currency_code.sql).
// Divergence means backend-derived defaults disagree with the frontend's
// idea of "what country implies what currency".

const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // North America
  US: 'USD',
  MX: 'MXN',
  CA: 'CAD',

  // Europe – Euro zone
  DE: 'EUR',
  ES: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  GR: 'EUR',
  IE: 'EUR',
  FI: 'EUR',

  // Europe – non-Euro
  PL: 'PLN',
  GB: 'GBP',

  // Latin America — USD users
  EC: 'USD', // Ecuador
  SV: 'USD', // El Salvador
  PA: 'USD', // Panama (alongside Balboa; USD dominant in tourism)

  // South America – own currency
  BR: 'BRL',
  CO: 'COP',
  AR: 'ARS',
  CL: 'CLP',

  // Asia-Pacific
  JP: 'JPY',
  AU: 'AUD',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_CURRENCY: SupportedCurrency = 'USD';

/** Decimal rule. JPY-class currencies have no minor units in restaurant practice. */
const JPY_CLASS: ReadonlySet<SupportedCurrency> = new Set(['JPY', 'COP', 'CLP', 'ARS']);

/**
 * Returns the currency code for a given ISO country code.
 * Falls back to USD for unmapped/unknown countries.
 */
export function getCurrencyForCountry(countryCode: string | null | undefined): SupportedCurrency {
  if (!countryCode) return FALLBACK_CURRENCY;
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? FALLBACK_CURRENCY;
}

/**
 * Returns the full CurrencyInfo for a currency code.
 * Defensive: if an unknown string slips through (cache mismatch, stale data),
 * returns the USD config rather than throwing.
 */
export function getCurrencyInfo(currency: SupportedCurrency): CurrencyInfo {
  return CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD;
}

/**
 * Type guard: is the value a supported currency code?
 */
export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Returns the price range defaults (min/max) for a given currency.
 * Used by the mobile filter price slider; consumers in admin/menu-scan don't need it.
 */
export function getPriceRangeForCurrency(currency: SupportedCurrency): {
  min: number;
  max: number;
} {
  const info = getCurrencyInfo(currency);
  return { min: info.priceRange.min, max: info.priceRange.max };
}

/**
 * Formats a price value for display, using Intl.NumberFormat with the correct
 * locale and currency.
 *
 * Decimal policy:
 *   - JPY-class (JPY, COP, CLP, ARS): `{ min: 0, max: 0 }` — no minor units.
 *   - Everything else: `{ min: 0, max: 2 }` — trailing zeros suppressed
 *     (`12 → $12`, `12.5 → $12.5`, `12.99 → $12.99`).
 *
 * Null / undefined currency: silent fallback to USD. This is the safe path
 * for cached/stale data that pre-dates the `currency_code` column landing.
 */
export function formatPrice(amount: number, currency?: SupportedCurrency | null): string {
  const resolved: SupportedCurrency = currency ?? FALLBACK_CURRENCY;
  const info = getCurrencyInfo(resolved);
  const fractionDigits = JPY_CLASS.has(resolved) ? 0 : 2;

  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    // Intl fallback — shouldn't fire in modern runtimes, but cheap insurance.
    return `${info.symbol}${amount}`;
  }
}
