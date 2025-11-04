/**
 * Map-related Styles
 *
 * Contains all styles for:
 * - Map component (markers, location button)
 * - Map footer (dish carousel at bottom)
 * - Map component wrapper styles
 *
 * Extracted from common.ts to improve organization and maintainability.
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, layout, borderRadius } from './theme';
import { atomic, createTextStyle, createBorder, createShadow, createRounded } from './common';

/**
 * Map Component Styles
 * Core map view with markers and location button
 */
export const mapComponentStyles = StyleSheet.create({
  container: atomic.flex1 as ViewStyle,
  map: atomic.flex1 as ViewStyle,
  overlay: {
    ...atomic.absolute,
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  } as ViewStyle,
});

/**
 * Map Styles (Legacy)
 * Main map screen layout with header and markers
 */
export const mapStyles = StyleSheet.create({
  container: atomic.flex1 as ViewStyle,
  map: atomic.flex1 as ViewStyle,

  header: {
    ...atomic.absolute,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: layout.headerPaddingTop,
    paddingBottom: spacing.md,
    paddingHorizontal: layout.headerPaddingHorizontal,
    backgroundColor: colors.background,
    ...createBorder(1, colors.border, 'bottom'),
  } as ViewStyle,

  headerContent: {
    ...atomic.flexRowBetween,
  } as ViewStyle,

  headerText: {
    flex: 1,
    textAlign: 'center',
  } as ViewStyle,

  // Map markers
  markerContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    ...atomic.center,
    borderWidth: 2,
    borderColor: colors.white,
    ...createShadow(4),
  } as ViewStyle,

  markerInner: {
    ...atomic.center,
    width: '100%',
    height: '100%',
  } as ViewStyle,

  markerText: createTextStyle('xs', 'normal', colors.textPrimary, { textAlign: 'center' }),

  // Location button
  locationButton: {
    ...atomic.absolute,
    bottom: 170,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    ...atomic.center,
    borderWidth: 1,
    borderColor: colors.border,
    ...createShadow(4),
  } as ViewStyle,

  locationButtonText: {
    fontSize: 20,
    textAlign: 'center',
  } as TextStyle,
});

/**
 * Map Footer Styles
 * Bottom dish carousel with horizontal scroll
 */
export const mapFooterStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark,
    ...createRounded(20, ['TopLeft', 'TopRight']),
    paddingTop: 16,
    paddingBottom: 20,
    ...createShadow(8, colors.black, 0.25),
  } as ViewStyle,

  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  } as ViewStyle,

  headerTitle: createTextStyle('lg', 'bold', colors.white, { marginBottom: 4 }),

  headerSubtitle: createTextStyle('sm', 'normal', colors.darkTextSecondary),

  scrollView: { paddingLeft: 20 } as ViewStyle,

  scrollContent: { paddingRight: 20 } as ViewStyle,

  dishCard: {
    width: 160,
    backgroundColor: colors.darkSecondary,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.darkTertiary,
  } as ViewStyle,

  dishHeader: {
    ...atomic.flexRowBetween,
    marginBottom: 8,
  } as ViewStyle,

  dishEmoji: { fontSize: 24 } as TextStyle,

  dishRating: {
    backgroundColor: colors.darkTertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  } as ViewStyle,

  ratingText: createTextStyle('xs', 'semibold', colors.white),

  dishName: createTextStyle('sm', 'semibold', colors.white, {
    marginBottom: 4,
    minHeight: 34,
  }),

  restaurantName: createTextStyle('xs', 'normal', colors.darkTextSecondary, { flex: 1 }),

  restaurantRow: {
    ...atomic.flexRowBetween,
    marginBottom: 8,
  } as ViewStyle,

  dishFooter: atomic.flexRowBetween as ViewStyle,

  priceRange: createTextStyle('xs', 'bold', colors.white),

  price: createTextStyle('sm', 'semibold', colors.white),

  unavailableBadge: {
    ...atomic.absolute,
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  } as ViewStyle,

  unavailableText: createTextStyle('xs', 'semibold', colors.white),

  showMoreCard: {
    width: 100,
    backgroundColor: colors.darkTertiary,
    borderRadius: 12,
    padding: 12,
    ...atomic.center,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  } as ViewStyle,

  showMoreIcon: createTextStyle('xl', 'normal', colors.accent, { marginBottom: 4 }),

  showMoreText: createTextStyle('xs', 'medium', colors.accent, { textAlign: 'center' }),

  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    ...createBorder(1, colors.darkTertiary, 'top'),
  } as ViewStyle,

  filterButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    ...atomic.center,
    ...createShadow(4, colors.black, 0.25),
  } as ViewStyle,

  filterButtonText: createTextStyle('base', 'semibold', colors.white),
});

// Export all map styles as a single object
export const mapStylesExport = {
  component: mapComponentStyles,
  main: mapStyles,
  footer: mapFooterStyles,
};

export default mapStylesExport;
