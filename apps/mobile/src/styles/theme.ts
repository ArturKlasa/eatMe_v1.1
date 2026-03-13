/**
 * Design System Theme
 *
 * Re-exports the canonical design tokens from @eatme/tokens and adds any
 * React-Native-specific augmentations.
 *
 * Import from here inside the mobile app:
 *   import { colors, typography, spacing, borderRadius, shadows, layout } from '@/styles/theme';
 *
 * The tokens themselves live in packages/tokens/src/ and are shared with
 * the web portal via the @eatme/tokens workspace package.
 */

export {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  theme,
} from '@eatme/tokens';

export type {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
  Theme,
} from '@eatme/tokens';

