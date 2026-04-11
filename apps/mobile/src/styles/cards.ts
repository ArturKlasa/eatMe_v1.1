/**
 * Card Styles
 *
 * Card containers, elevated variants, and card headers.
 */

import { StyleSheet, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createTextStyle } from './factories';
import { cardBase } from './bases';

const { colors, spacing } = theme;

export const cards = StyleSheet.create({
  base: cardBase.container,

  elevated: cardBase.elevated,

  header: {
    ...atomic.flexRowBetween,
    marginBottom: spacing.md,
  } as ViewStyle,

  title: createTextStyle('lg', 'semibold', colors.textPrimary),

  content: {
    gap: spacing.sm,
  } as ViewStyle,
});
