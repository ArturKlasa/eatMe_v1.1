/**
 * Spacing Styles
 *
 * Margin/padding utility classes, switch configuration, and legacy profile styles.
 */

import { StyleSheet, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createTextStyle } from './factories';

const { colors, spacing } = theme;

export const spacingUtils = StyleSheet.create({
  mt0: { marginTop: 0 } as ViewStyle,
  mt1: { marginTop: spacing.xs } as ViewStyle,
  mt2: { marginTop: spacing.sm } as ViewStyle,
  mt3: { marginTop: spacing.md } as ViewStyle,
  mt4: { marginTop: spacing.lg } as ViewStyle,
  mt5: { marginTop: spacing.xl } as ViewStyle,

  mb0: { marginBottom: 0 } as ViewStyle,
  mb1: { marginBottom: spacing.xs } as ViewStyle,
  mb2: { marginBottom: spacing.sm } as ViewStyle,
  mb3: { marginBottom: spacing.md } as ViewStyle,
  mb4: { marginBottom: spacing.lg } as ViewStyle,
  mb5: { marginBottom: spacing.xl } as ViewStyle,

  pt0: { paddingTop: 0 } as ViewStyle,
  pt1: { paddingTop: spacing.xs } as ViewStyle,
  pt2: { paddingTop: spacing.sm } as ViewStyle,
  pt3: { paddingTop: spacing.md } as ViewStyle,
  pt4: { paddingTop: spacing.lg } as ViewStyle,

  pb0: { paddingBottom: 0 } as ViewStyle,
  pb1: { paddingBottom: spacing.xs } as ViewStyle,
  pb2: { paddingBottom: spacing.sm } as ViewStyle,
  pb3: { paddingBottom: spacing.md } as ViewStyle,
  pb4: { paddingBottom: spacing.lg } as ViewStyle,

  gap1: { gap: spacing.xs } as ViewStyle,
  gap2: { gap: spacing.sm } as ViewStyle,
  gap3: { gap: spacing.md } as ViewStyle,
  gap4: { gap: spacing.lg } as ViewStyle,
});

// Switch configuration (non-style export)
export const switchConfig = {
  trackColor: { false: colors.gray200, true: colors.primary },
  thumbColor: colors.white,
  ios_backgroundColor: colors.gray200,
};

// Legacy profile styles (kept for backward compatibility)
export const profile = StyleSheet.create({
  container: atomic.flex1 as ViewStyle,
  header: {
    ...atomic.centerH,
    paddingVertical: spacing.lg,
  } as ViewStyle,
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray200,
    ...atomic.center,
    marginBottom: spacing.md,
  } as ViewStyle,
  name: createTextStyle('xl', 'bold', colors.textPrimary),
  email: createTextStyle('sm', 'normal', colors.textSecondary, { marginTop: spacing.xs }),
});
