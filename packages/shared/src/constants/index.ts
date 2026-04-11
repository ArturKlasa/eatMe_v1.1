/**
 * Shared Constants
 *
 * Canonical runtime constants used across mobile and web-portal.
 * All arrays are `as const` so TypeScript can narrow their element types.
 *
 * Files:
 *   calendar    — DAYS_OF_WEEK and DayKey type
 *   cuisine     — POPULAR_CUISINES and ALL_CUISINES
 *   dietary     — DIETARY_TAGS, ALLERGENS, RELIGIOUS_REQUIREMENTS
 *   menu        — MENU_CATEGORIES, DISH_KINDS, SELECTION_TYPES, OPTION_PRESETS
 *   pricing     — PRICE_RANGES, SPICE_LEVELS, DISPLAY_PRICE_PREFIXES
 *   restaurant  — RESTAURANT_TYPES, PAYMENT_METHOD_OPTIONS, COUNTRIES, etc.
 *   wizard      — WIZARD_STEPS for the onboarding multi-step form
 */

export * from './calendar';
export * from './cuisine';
export * from './dietary';
export * from './menu';
export * from './pricing';
export * from './restaurant';
export * from './wizard';
