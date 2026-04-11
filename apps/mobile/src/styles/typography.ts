/**
 * Typography Styles
 *
 * Text hierarchy: h1-h3, body, small, tiny, link, error, success, emptyState.
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createTextStyle } from './factories';

const { colors, typography, spacing } = theme;

export const text = StyleSheet.create({
  h1: createTextStyle('2xl', 'bold', colors.textPrimary, {
    lineHeight: typography.size['2xl'] * typography.lineHeight.tight,
  }),

  h2: createTextStyle('xl', 'bold', colors.textPrimary, {
    lineHeight: typography.size.xl * typography.lineHeight.tight,
  }),

  h3: createTextStyle('lg', 'semibold', colors.textPrimary, {
    lineHeight: typography.size.lg * typography.lineHeight.normal,
  }),

  body: createTextStyle('base', 'normal', colors.textPrimary, {
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  }),

  bodyBold: createTextStyle('base', 'bold', colors.textPrimary, {
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  }),

  small: createTextStyle('sm', 'normal', colors.textSecondary, {
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  }),

  tiny: createTextStyle('xs', 'normal', colors.textSecondary),

  link: createTextStyle('base', 'medium', colors.primary, {
    textDecorationLine: 'underline',
  }),

  error: createTextStyle('sm', 'normal', colors.error),

  success: createTextStyle('sm', 'normal', colors.success),

  muted: createTextStyle('sm', 'normal', colors.textTertiary),

  centered: { textAlign: 'center' } as TextStyle,

  right: { textAlign: 'right' } as TextStyle,
});

export const emptyState = StyleSheet.create({
  container: {
    ...atomic.center,
    paddingTop: 60,
    paddingHorizontal: 32,
  } as ViewStyle,

  icon: {
    fontSize: 72,
    marginBottom: 16,
  } as TextStyle,

  title: createTextStyle('xl', 'bold', colors.darkText, {
    marginBottom: 12,
    textAlign: 'center',
  }),

  description: createTextStyle('base', 'normal', colors.darkTextMuted, {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  }),
});
