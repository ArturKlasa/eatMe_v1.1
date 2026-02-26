/**
 * Currency Configuration
 *
 * Maps ISO 3166-1 alpha-2 country codes to their currencies,
 * and each currency to sensible price-range defaults for a
 * single restaurant meal (slider min/max in local currency).
 *
 * Used by the country-detection hook and filter store so the
 * daily price-range slider always starts at meaningful values.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedCurrency =
  | 'USD'
  | 'MXN'
  | 'PLN'
  | 'EUR'
  | 'GBP'
  | 'CAD'
  | 'AUD'
  | 'BRL'
  | 'JPY'
  | 'COP'
  | 'ARS'
  | 'CLP';

export interface CurrencyInfo {
  /** ISO 4217 currency code */
  code: SupportedCurrency;
  /** Display symbol */
  symbol: string;
  /** Full display name */
  name: string;
  /** BCP 47 locale used for Intl.NumberFormat */
  locale: string;
  /** Sensible per-meal price range defaults */
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
    priceRange: { min: 100, max: 500, step: 50, sliderMax: 2000 },
  },
  PLN: {
    code: 'PLN',
    symbol: 'zł',
    name: 'Polish Zloty',
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
// ISO 3166-1 alpha-2 → SupportedCurrency

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

  // South America
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

/**
 * Returns the currency code for a given ISO country code.
 * Falls back to USD for unmapped countries.
 */
export function getCurrencyForCountry(countryCode: string | null | undefined): SupportedCurrency {
  if (!countryCode) return FALLBACK_CURRENCY;
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? FALLBACK_CURRENCY;
}

/**
 * Returns the full CurrencyInfo for a currency code.
 */
export function getCurrencyInfo(currency: SupportedCurrency): CurrencyInfo {
  return CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD;
}

/**
 * Returns the price range defaults (min/max) for a given currency.
 * These are sensible per-meal defaults for the daily filter slider.
 */
export function getPriceRangeForCurrency(currency: SupportedCurrency): {
  min: number;
  max: number;
} {
  const info = getCurrencyInfo(currency);
  return { min: info.priceRange.min, max: info.priceRange.max };
}

/**
 * Formats a price value for display, using Intl.NumberFormat with the
 * correct locale and currency.
 */
export function formatPrice(amount: number, currency: SupportedCurrency): string {
  const info = getCurrencyInfo(currency);
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${info.symbol}${amount}`;
  }
}
