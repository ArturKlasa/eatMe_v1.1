/**
 * Common Style Components
 *
 * Reusable style functions and common component styles.
 * These styles are used across multiple screens to maintain consistency.
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';

const { colors, typography, spacing, layout, shadows, borderRadius } = theme;

/**
 * Common container styles
 */
export const containers = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,

  screenWithHeader: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,

  content: {
    flex: 1,
  } as ViewStyle,

  contentPadded: {
    flex: 1,
    padding: layout.screenPadding,
  } as ViewStyle,

  section: {
    padding: layout.sectionPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  } as ViewStyle,

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,

  center: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  centerHorizontal: {
    alignItems: 'center',
  } as ViewStyle,
});

/**
 * Header styles (used across multiple screens)
 */
export const headers = StyleSheet.create({
  container: {
    paddingTop: layout.headerPaddingTop,
    paddingBottom: layout.headerPaddingBottom,
    paddingHorizontal: layout.headerPaddingHorizontal,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  } as ViewStyle,

  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  } as TextStyle,

  subtitle: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  } as TextStyle,
});

/**
 * Typography styles
 */
export const text = StyleSheet.create({
  // Headings
  h1: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    lineHeight: typography.size['2xl'] * typography.lineHeight.tight,
  } as TextStyle,

  h2: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    lineHeight: typography.size.xl * typography.lineHeight.tight,
  } as TextStyle,

  h3: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    lineHeight: typography.size.lg * typography.lineHeight.tight,
  } as TextStyle,

  // Body text
  body: {
    fontSize: typography.size.base,
    color: colors.textPrimary,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  } as TextStyle,

  bodySecondary: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  } as TextStyle,

  bodySmall: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  } as TextStyle,

  // Special text styles
  caption: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  } as TextStyle,

  label: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  } as TextStyle,

  description: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  } as TextStyle,

  // List styles
  listItem: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
  } as TextStyle,

  featureItem: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
  } as TextStyle,
});

/**
 * Empty state styles
 */
export const emptyState = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing['3xl'],
    marginTop: spacing['5xl'],
  } as ViewStyle,

  icon: {
    fontSize: typography.size['7xl'],
    marginBottom: spacing.base,
  } as TextStyle,

  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  } as TextStyle,

  description: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
    marginBottom: spacing['3xl'],
  } as TextStyle,
});

/**
 * Card styles
 */
export const cards = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: theme.borderRadius.base,
    padding: spacing.base,
    marginBottom: spacing.base,
    ...theme.shadows.sm,
  } as ViewStyle,

  header: {
    marginBottom: spacing.base,
  } as ViewStyle,

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  } as TextStyle,

  content: {
    marginTop: spacing.sm,
  } as ViewStyle,
});

/**
 * Form styles
 */
export const forms = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: layout.headerHeight,
  } as ViewStyle,

  settingText: {
    flex: 1,
    marginRight: spacing.base,
  } as ViewStyle,

  settingLabel: {
    fontSize: typography.size.base,
    color: colors.textPrimary,
    fontWeight: typography.weight.medium,
  } as TextStyle,

  settingDescription: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  } as TextStyle,
});

/**
 * Profile specific styles
 */
export const profile = StyleSheet.create({
  avatar: {
    width: layout.avatarSize,
    height: layout.avatarSize,
    borderRadius: layout.avatarSize / 2,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.base,
  } as ViewStyle,

  avatarText: {
    fontSize: typography.size['4xl'],
  } as TextStyle,

  userName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  } as TextStyle,

  userSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  } as TextStyle,

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  } as ViewStyle,

  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: theme.borderRadius.base,
    marginBottom: spacing.md,
  } as ViewStyle,

  statNumber: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  } as TextStyle,

  statLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  } as TextStyle,
});

/**
 * Map styles
 */
export const mapStyles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: layout.headerPaddingTop,
    paddingBottom: spacing.md,
    paddingHorizontal: layout.headerPaddingHorizontal,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  } as ViewStyle,

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,

  headerText: {
    flex: 1,
    textAlign: 'center',
  } as ViewStyle,

  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  } as TextStyle,

  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  } as TextStyle,

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.backgroundTertiary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  } as ViewStyle,

  footerText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  } as TextStyle,

  // Map-specific components
  markerContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.md,
  } as ViewStyle,

  markerInner: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  } as ViewStyle,

  markerText: {
    fontSize: typography.size.xs,
    textAlign: 'center',
  } as TextStyle,

  locationButton: {
    position: 'absolute',
    bottom: 170,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  } as ViewStyle,

  locationButtonText: {
    fontSize: 20,
    textAlign: 'center',
  } as TextStyle,
});

/**
 * Button styles
 */
export const buttons = StyleSheet.create({
  // Base button styles
  base: {
    height: layout.buttonHeight,
    borderRadius: borderRadius.base,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  } as ViewStyle,

  primary: {
    backgroundColor: colors.primary,
  } as ViewStyle,

  secondary: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  } as ViewStyle,

  // Icon buttons (like menu, location)
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  iconButtonLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  } as ViewStyle,

  // Text styles for buttons
  primaryText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  } as TextStyle,

  secondaryText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  } as TextStyle,
});

/**
 * Input and Form Component styles
 */
export const inputs = StyleSheet.create({
  // Common input container
  container: {
    marginBottom: spacing.base,
  } as ViewStyle,

  label: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  } as TextStyle,

  textInput: {
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.base,
    fontSize: typography.size.base,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  } as ViewStyle,

  textInputFocused: {
    borderColor: colors.primary,
    ...shadows.sm,
  } as ViewStyle,
});

/**
 * Switch component configuration
 */
const switchConfig = {
  trackColors: {
    false: colors.gray300,
    true: colors.primary,
  },
};

/**
 * Spacing utilities
 */
export const spacingUtils = StyleSheet.create({
  // Margin utilities
  marginXS: { margin: spacing.xs } as ViewStyle,
  marginSM: { margin: spacing.sm } as ViewStyle,
  marginMD: { margin: spacing.md } as ViewStyle,
  marginBase: { margin: spacing.base } as ViewStyle,
  marginLG: { margin: spacing.lg } as ViewStyle,
  marginXL: { margin: spacing.xl } as ViewStyle,

  marginTopXS: { marginTop: spacing.xs } as ViewStyle,
  marginTopSM: { marginTop: spacing.sm } as ViewStyle,
  marginTopMD: { marginTop: spacing.md } as ViewStyle,
  marginTopBase: { marginTop: spacing.base } as ViewStyle,
  marginTopLG: { marginTop: spacing.lg } as ViewStyle,
  marginTopXL: { marginTop: spacing.xl } as ViewStyle,

  marginBottomXS: { marginBottom: spacing.xs } as ViewStyle,
  marginBottomSM: { marginBottom: spacing.sm } as ViewStyle,
  marginBottomMD: { marginBottom: spacing.md } as ViewStyle,
  marginBottomBase: { marginBottom: spacing.base } as ViewStyle,
  marginBottomLG: { marginBottom: spacing.lg } as ViewStyle,
  marginBottomXL: { marginBottom: spacing.xl } as ViewStyle,

  // Padding utilities
  paddingXS: { padding: spacing.xs } as ViewStyle,
  paddingSM: { padding: spacing.sm } as ViewStyle,
  paddingMD: { padding: spacing.md } as ViewStyle,
  paddingBase: { padding: spacing.base } as ViewStyle,
  paddingLG: { padding: spacing.lg } as ViewStyle,
  paddingXL: { padding: spacing.xl } as ViewStyle,

  paddingHorizontalXS: { paddingHorizontal: spacing.xs } as ViewStyle,
  paddingHorizontalSM: { paddingHorizontal: spacing.sm } as ViewStyle,
  paddingHorizontalMD: { paddingHorizontal: spacing.md } as ViewStyle,
  paddingHorizontalBase: { paddingHorizontal: spacing.base } as ViewStyle,
  paddingHorizontalLG: { paddingHorizontal: spacing.lg } as ViewStyle,
  paddingHorizontalXL: { paddingHorizontal: spacing.xl } as ViewStyle,

  paddingVerticalXS: { paddingVertical: spacing.xs } as ViewStyle,
  paddingVerticalSM: { paddingVertical: spacing.sm } as ViewStyle,
  paddingVerticalMD: { paddingVertical: spacing.md } as ViewStyle,
  paddingVerticalBase: { paddingVertical: spacing.base } as ViewStyle,
  paddingVerticalLG: { paddingVertical: spacing.lg } as ViewStyle,
  paddingVerticalXL: { paddingVertical: spacing.xl } as ViewStyle,
});

/**
 * Modal styles (for filter modals, dialogs, etc.)
 */
export const modals = StyleSheet.create({
  // Modal overlay and container
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  } as ViewStyle,

  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  } as ViewStyle,

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  } as TextStyle,

  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  closeText: {
    fontSize: 16,
    color: colors.textSecondary,
  } as TextStyle,

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  } as ViewStyle,

  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
  } as ViewStyle,

  // Modal sections
  section: {
    marginBottom: spacing.lg,
  } as ViewStyle,

  sectionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  } as TextStyle,

  // Filter options layout
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  } as ViewStyle,

  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  } as ViewStyle,

  // Generic option styles
  option: {
    margin: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#4A4A4A',
    borderWidth: 1,
    borderColor: '#666666',
    alignItems: 'center',
  } as ViewStyle,

  optionText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  } as TextStyle,

  selectedOption: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  } as ViewStyle,

  selectedText: {
    color: colors.white,
    fontWeight: typography.weight.semibold,
  } as TextStyle,

  // Specific option types
  priceOption: {
    margin: 4,
    paddingHorizontal: 16,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 50,
    alignItems: 'center',
  } as ViewStyle,

  priceText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  } as TextStyle,

  cuisineOption: {
    margin: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#4A4A4A',
    borderWidth: 1,
    borderColor: '#666666',
  } as ViewStyle,

  cuisineText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  } as TextStyle,

  dietOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginHorizontal: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
    minWidth: 100,
  } as ViewStyle,

  dietIcon: {
    fontSize: 16,
    marginRight: 6,
  } as TextStyle,

  dietText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  } as TextStyle,

  calorieToggle: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
    marginRight: spacing.sm,
    minWidth: 80,
    alignItems: 'center',
  } as ViewStyle,

  calorieOption: {
    padding: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: 4,
    minWidth: 60,
    alignItems: 'center',
  } as ViewStyle,

  calorieText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  } as TextStyle,

  // Preset and action buttons
  presetButton: {
    flex: 1,
    margin: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  } as ViewStyle,

  presetText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  } as TextStyle,

  clearButton: {
    flex: 1,
    padding: spacing.lg,
    marginRight: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  } as ViewStyle,

  clearText: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  } as TextStyle,

  applyButton: {
    flex: 1,
    padding: spacing.lg,
    marginLeft: 6,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  } as ViewStyle,

  applyText: {
    fontSize: typography.size.base,
    color: colors.white,
    fontWeight: typography.weight.semibold,
  } as TextStyle,

  // Price slider styles
  priceSliderContainer: {
    marginVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  } as ViewStyle,

  priceSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  } as ViewStyle,

  priceSliderLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  } as TextStyle,

  priceSliderTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    position: 'relative',
  } as ViewStyle,

  priceSliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: colors.primary,
    borderRadius: 10,
    position: 'absolute',
    top: -7,
  } as ViewStyle,

  // Tab container styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: borderRadius.md,
    padding: 2,
    marginVertical: spacing.sm,
  } as ViewStyle,

  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    backgroundColor: '#4A4A4A',
  } as ViewStyle,

  selectedTab: {
    backgroundColor: '#FF9800',
  } as ViewStyle,

  tabText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  } as TextStyle,

  selectedTabText: {
    color: colors.white,
    fontWeight: typography.weight.semibold,
  } as TextStyle,

  // Multi-option styles
  multiOptionContainer: {
    marginTop: spacing.sm,
  } as ViewStyle,
});

/**
 * Floating Action Button (FAB) styles
 */
export const fabs = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
    zIndex: 1000,
  } as ViewStyle,

  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  } as ViewStyle,

  fabActive: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 1.1 }],
  } as ViewStyle,

  fabIcon: {
    fontSize: 24,
  } as TextStyle,

  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  } as ViewStyle,

  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: typography.weight.bold,
  } as TextStyle,
});

/**
 * Map-specific component styles
 */
export const mapComponentStyles = StyleSheet.create({
  // Map container
  map: {
    flex: 1,
  } as ViewStyle,

  // Filter FAB (specific positioning)
  filterFAB: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  } as ViewStyle,

  filterFABIcon: {
    fontSize: 24,
  } as TextStyle,

  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  } as ViewStyle,

  filterBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: typography.weight.bold,
  } as TextStyle,
});

// Export all style collections
export const commonStyles = {
  containers,
  headers,
  text,
  emptyState,
  cards,
  forms,
  profile,
  mapStyles,
  buttons,
  inputs,
  spacingUtils,
  modals,
  fabs,
  mapComponentStyles,
};

export { switchConfig };

export default commonStyles;
