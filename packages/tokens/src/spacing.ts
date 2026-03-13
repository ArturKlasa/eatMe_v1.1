/**
 * EatMe Design System — Spacing Tokens
 *
 * Based on a 4 px grid. Values in pixels for React Native;
 * web converts to `rem` (÷ 16).
 */

export const spacing = {
  /** 4 px base unit */
  unit: 4,

  xs: 4, // 1 unit
  sm: 8, // 2 units
  md: 12, // 3 units
  base: 16, // 4 units
  lg: 20, // 5 units
  xl: 24, // 6 units
  '2xl': 32, // 8 units
  '3xl': 40, // 10 units
  '4xl': 48, // 12 units
  '5xl': 64, // 16 units
  '6xl': 80, // 20 units
} as const;

export type Spacing = typeof spacing;
