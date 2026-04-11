/**
 * Container Styles
 *
 * Screen, section, row, and center container styles.
 */

import { StyleSheet, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createBorder, createTextStyle } from './factories';

const { colors, spacing, layout } = theme;

export const containers = StyleSheet.create({
  screen: {
    ...atomic.flex1,
    ...atomic.bgPrimary,
  } as ViewStyle,

  screenWithHeader: {
    ...atomic.flex1,
    ...atomic.bgPrimary,
  } as ViewStyle,

  content: atomic.flex1 as ViewStyle,

  contentPadded: {
    ...atomic.flex1,
    padding: layout.screenPadding,
  } as ViewStyle,

  section: {
    padding: layout.sectionPadding,
    ...createBorder(1, colors.borderLight, 'bottom'),
  } as ViewStyle,

  row: atomic.flexRowCenter as ViewStyle,

  rowSpaceBetween: atomic.flexRowBetween as ViewStyle,

  center: atomic.center as ViewStyle,

  centerHorizontal: atomic.centerH as ViewStyle,
});

export const headers = StyleSheet.create({
  container: {
    paddingTop: layout.headerPaddingTop,
    paddingBottom: layout.headerPaddingBottom,
    paddingHorizontal: layout.headerPaddingHorizontal,
    backgroundColor: colors.backgroundSecondary,
    ...createBorder(1, colors.border, 'bottom'),
  } as ViewStyle,

  title: createTextStyle('2xl', 'bold', colors.textPrimary, { textAlign: 'center' }),

  subtitle: createTextStyle('base', 'normal', colors.textSecondary, {
    textAlign: 'center',
    marginTop: spacing.xs,
  }),
});
