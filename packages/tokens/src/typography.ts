/**
 * EatMe Design System — Typography Tokens
 *
 * Platform-agnostic. React Native uses numeric sizes;
 * the web layer converts them to `rem` via the CSS variable generator.
 */

export const typography = {
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
    '6xl': 48,
    '7xl': 64,
  },

  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 2,
  },
} as const;

export type Typography = typeof typography;
