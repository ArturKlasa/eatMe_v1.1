/**
 * @eatme/tokens — EatMe Design System Tokens
 *
 * Platform-agnostic design tokens shared between the mobile app
 * (React Native) and the web portal (Next.js).
 *
 * @example
 * ```ts
 * import { colors, spacing, typography, borderRadius, shadows } from '@eatme/tokens';
 * ```
 */

export { colors } from './colors';
export type { Colors } from './colors';

export { typography } from './typography';
export type { Typography } from './typography';

export { spacing } from './spacing';
export type { Spacing } from './spacing';

export { borderRadius } from './borderRadius';
export type { BorderRadius } from './borderRadius';

export { shadows } from './shadows';
export type { Shadows } from './shadows';

export { layout } from './layout';
export type { Layout } from './layout';

// ─── Combined theme object ────────────────────────────────────────────────────

import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { borderRadius } from './borderRadius';
import { shadows } from './shadows';
import { layout } from './layout';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
} as const;

export type Theme = typeof theme;
