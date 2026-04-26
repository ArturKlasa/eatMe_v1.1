export const SUPPORTED_LANGUAGES = ['en', 'es', 'pl'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

// ISO-3166-1 alpha-2 country code → primary language for menu authoring.
// Restaurants in countries not listed fall back to DEFAULT_LANGUAGE.
// Multi-language countries (BE, CH, CA) get a single default — admins can
// override per scan in the review UI when the menu is in a different language.
const COUNTRY_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  // English
  US: 'en',
  GB: 'en',
  AU: 'en',
  CA: 'en',
  IE: 'en',
  NZ: 'en',
  ZA: 'en',
  // Spanish
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CL: 'es',
  CO: 'es',
  PE: 'es',
  VE: 'es',
  CR: 'es',
  EC: 'es',
  GT: 'es',
  HN: 'es',
  NI: 'es',
  PA: 'es',
  PY: 'es',
  SV: 'es',
  UY: 'es',
  DO: 'es',
  CU: 'es',
  BO: 'es',
  // Polish
  PL: 'pl',
};

export function countryToLanguage(countryCode: string | null | undefined): SupportedLanguage {
  if (!countryCode) return DEFAULT_LANGUAGE;
  return COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()] ?? DEFAULT_LANGUAGE;
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
