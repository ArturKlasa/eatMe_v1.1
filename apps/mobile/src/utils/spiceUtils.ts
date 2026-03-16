/**
 * Spice level utilities for the mobile app.
 *
 * Valid dish spice_level values: 0 | 1 | 3
 *   0 → no spice   (no icon rendered)
 *   1 → 🌶️         (one chilli)
 *   3 → 🌶️🌶️🌶️     (three chillies)
 */

export const DISH_SPICE_LEVELS = [
  { value: 0, label: 'No spice', icon: '' },
  { value: 1, label: '🌶️', icon: '🌶️' },
  { value: 3, label: '🌶️🌶️🌶️', icon: '🌶️🌶️🌶️' },
] as const;

export type DishSpiceLevel = 0 | 1 | 3;

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
