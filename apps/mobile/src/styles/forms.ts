/**
 * Form Styles
 *
 * Form fields, inputs, and settings items.
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createTextStyle } from './factories';

const { colors, typography, spacing, layout, borderRadius } = theme;

export const forms = StyleSheet.create({
  fieldGroup: {
    marginBottom: spacing.lg,
  } as ViewStyle,

  label: createTextStyle('sm', 'medium', colors.textPrimary, {
    marginBottom: spacing.xs,
  }),

  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.base,
    color: colors.textPrimary,
  } as ViewStyle & TextStyle,

  inputFocused: {
    borderColor: colors.primary,
  } as ViewStyle,

  inputError: {
    borderColor: colors.error,
  } as ViewStyle,

  errorText: createTextStyle('xs', 'normal', colors.error, {
    marginTop: spacing.xs,
  }),

  // Settings items
  settingItem: {
    ...atomic.flexRowBetween,
    paddingVertical: spacing.md,
    minHeight: layout.headerHeight,
  } as ViewStyle,

  settingText: {
    flex: 1,
    marginRight: spacing.base,
  } as ViewStyle,

  settingLabel: createTextStyle('base', 'medium', colors.textPrimary),

  settingDescription: createTextStyle('sm', 'normal', colors.textSecondary, {
    marginTop: spacing.xs / 2,
  }),
});

export const inputs = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  } as ViewStyle,

  label: createTextStyle('sm', 'medium', colors.textPrimary, {
    marginBottom: spacing.xs,
  }),

  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.base,
    color: colors.textPrimary,
  } as ViewStyle & TextStyle,

  inputFocused: {
    borderColor: colors.primary,
  } as ViewStyle,

  textarea: {
    height: 100,
    textAlignVertical: 'top',
  } as ViewStyle & TextStyle,
});
