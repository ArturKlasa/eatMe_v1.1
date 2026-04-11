/**
 * Button Styles
 *
 * Button variants including icon buttons, built from buttonBase patterns.
 */

import { StyleSheet, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createTextStyle, createShadow } from './factories';
import { buttonBase } from './bases';

const { colors } = theme;

export const buttons = StyleSheet.create({
  primary: buttonBase.primary,

  primaryText: buttonBase.text,

  secondary: buttonBase.secondary,

  secondaryText: buttonBase.textSecondary,

  small: buttonBase.small,

  smallText: buttonBase.textSmall,

  danger: {
    ...buttonBase.primary,
    backgroundColor: colors.error,
  } as ViewStyle,

  ghost: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  } as ViewStyle,

  ghostText: createTextStyle('base', 'medium', colors.primary),

  // Icon buttons
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    ...atomic.center,
  } as ViewStyle,

  iconButtonLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    ...atomic.center,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...createShadow(4),
  } as ViewStyle,
});
