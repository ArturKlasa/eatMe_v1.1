/**
 * Atomic Styles
 *
 * Single-purpose, composable style atoms built from factory functions.
 * Used as building blocks by all other style modules.
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';
import { createFlexContainer, createCenteredContainer } from './factories';

const { colors } = theme;

export const atomic = StyleSheet.create({
  // Flex
  flex1: { flex: 1 } as ViewStyle,
  flexRow: createFlexContainer('row'),
  flexRowCenter: { ...createFlexContainer('row', 'center') } as ViewStyle,
  flexRowBetween: { ...createFlexContainer('row', 'center', 'space-between') } as ViewStyle,
  flexColumn: createFlexContainer('column'),

  // Alignment
  center: createCenteredContainer(true, true) as ViewStyle,
  centerH: createCenteredContainer(true, false) as ViewStyle,
  centerV: createCenteredContainer(false, true) as ViewStyle,
  alignStart: { alignItems: 'flex-start' } as ViewStyle,
  alignEnd: { alignItems: 'flex-end' } as ViewStyle,
  justifyStart: { justifyContent: 'flex-start' } as ViewStyle,
  justifyEnd: { justifyContent: 'flex-end' } as ViewStyle,
  justifyBetween: { justifyContent: 'space-between' } as ViewStyle,

  // Common backgrounds
  bgPrimary: { backgroundColor: colors.background } as ViewStyle,
  bgSecondary: { backgroundColor: colors.backgroundSecondary } as ViewStyle,
  bgDark: { backgroundColor: colors.dark } as ViewStyle,
  bgOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)' } as ViewStyle,

  // Common text colors
  textPrimary: { color: colors.textPrimary } as TextStyle,
  textSecondary: { color: colors.textSecondary } as TextStyle,
  textLight: { color: colors.darkText } as TextStyle,
  textMuted: { color: colors.textTertiary } as TextStyle,
  textAccent: { color: colors.primary } as TextStyle,
  textWhite: { color: colors.white } as TextStyle,

  // Absolute positioning
  absolute: { position: 'absolute' } as ViewStyle,
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as ViewStyle,

  // Overflow
  overflowHidden: { overflow: 'hidden' } as ViewStyle,
  overflowVisible: { overflow: 'visible' } as ViewStyle,
});
