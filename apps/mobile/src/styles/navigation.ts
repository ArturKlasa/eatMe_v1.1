/**
 * Navigation-related Styles
 *
 * Contains all styles for:
 * - Floating menu (hamburger menu overlay)
 * - FABs (Floating Action Buttons)
 *
 * Extracted from common.ts to improve organization and maintainability.
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from './theme';
import { atomic, createTextStyle, createShadow } from './common';

/**
 * Floating Menu Styles
 * Hamburger menu overlay with animated menu items
 */
export const floatingMenuStyles = StyleSheet.create({
  container: {
    ...atomic.absoluteFill,
    zIndex: 9999,
  } as ViewStyle,

  backdrop: {
    ...atomic.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  } as ViewStyle,

  menuContainer: {
    ...atomic.absolute,
    right: 92,
    bottom: 560,
  } as ViewStyle,

  menuItem: {
    ...atomic.absolute,
    right: 0,
    backgroundColor: colors.dark,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...createShadow(16, colors.black, 0.5),
    minWidth: 180,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  } as ViewStyle,

  menuItemContent: {
    ...atomic.flexRowCenter,
    gap: 12,
  } as ViewStyle,

  menuIcon: { fontSize: 20 } as TextStyle,

  menuLabel: createTextStyle('base', 'semibold', colors.darkText),
});

/**
 * Generic FAB Styles
 * Standard floating action button pattern
 */
export const fabs = StyleSheet.create({
  container: {
    ...atomic.absolute,
    bottom: 20,
    right: 20,
  } as ViewStyle,

  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    ...atomic.center,
    ...createShadow(8),
  } as ViewStyle,

  fabIcon: { fontSize: 24, color: colors.white } as TextStyle,
});

// Export all navigation styles as a single object
export const navigationStyles = {
  floatingMenu: floatingMenuStyles,
  fabs: fabs,
};

export default navigationStyles;
