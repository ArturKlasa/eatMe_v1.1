/**
 * Spice level utilities for the mobile app.
 *
 * Valid dish spice_level values: 'none' | 'mild' | 'hot'
 *   'none' → no spice   (no icon rendered)
 *   'mild' → 🌶️         (one chilli)
 *   'hot'  → 🌶️🌶️🌶️     (three chillies)
 */

export const DISH_SPICE_LEVELS = [
  { value: 'none' as const, label: 'No spice', icon: '' },
  { value: 'mild' as const, label: '🌶️', icon: '🌶️' },
  { value: 'hot' as const, label: '🌶️🌶️🌶️', icon: '🌶️🌶️🌶️' },
] as const;

export type DishSpiceLevel = 'none' | 'mild' | 'hot';

/**
 * Returns the chilli-icon string for the given spice level.
 * Returns an empty string when the dish is not spicy ('none' / null / undefined).
 */
export function dishSpiceIcon(level: string | null | undefined): string {
  return DISH_SPICE_LEVELS.find(l => l.value === level)?.icon ?? '';
}

/**
 * Validates a value against the three allowed spice level strings.
 * Returns null for any unknown / nullish value.
 */
export function normaliseDishSpiceLevel(level: string | null | undefined): DishSpiceLevel | null {
  if (level === 'none' || level === 'mild' || level === 'hot') return level;
  return null;
}

/**
 * Returns the chilli-icon string for the given spice level.
 * Returns an empty string when the dish is not spicy (0 / null / undefined).
 */
export function dishSpiceIcon(level: number | null | undefined): string {
  return DISH_SPICE_LEVELS.find(l => l.value === level)?.icon ?? '';
}

/**
 * Clamps/normalises an arbitrary numeric value to the nearest valid
 * spice level (0, 1 or 3).  Useful when receiving data from an external
 * source that may still use the old 0–4 scale.
 */
export function normaliseDishSpiceLevel(level: number | null | undefined): DishSpiceLevel | null {
  if (level === null || level === undefined) return null;
  if (level <= 0) return 0;
  if (level <= 1) return 1;
  if (level === 2) return 1;
  return 3; // covers 3 and 4
}
