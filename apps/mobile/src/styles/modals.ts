/**
 * Modal Styles (Legacy)
 *
 * Light-theme modal overlay, container, filter option, and slider styles.
 * Used by filter/modal dialogs throughout the app.
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';

const { colors, typography, spacing, borderRadius } = theme;

export const modals = StyleSheet.create({
  // Modal overlay and container
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  } as ViewStyle,

  backdrop: atomic.bgOverlay as ViewStyle,

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

  // Dark theme variants
  darkContainer: {
    backgroundColor: colors.dark,
  } as ViewStyle,

  darkTitle: {
    color: colors.darkText,
  } as TextStyle,

  darkSectionTitle: {
    color: colors.darkText,
  } as TextStyle,

  darkTabText: {
    color: colors.darkText,
  } as TextStyle,

  darkOptionText: {
    color: colors.darkText,
  } as TextStyle,

  darkCuisineText: {
    color: colors.darkText,
  } as TextStyle,

  darkPriceLabel: {
    color: colors.darkTextLight,
  } as TextStyle,

  darkClearText: {
    color: colors.darkText,
  } as TextStyle,

  darkApplyText: {
    color: colors.white,
  } as TextStyle,

  // Tab selection pattern
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.darkSecondary,
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
    backgroundColor: colors.darkQuaternary,
  } as ViewStyle,

  selectedTab: {
    backgroundColor: colors.accent,
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

  multiOptionContainer: {
    marginTop: spacing.sm,
  } as ViewStyle,

  option: {
    margin: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.darkQuaternary,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
  } as ViewStyle,

  selectedOption: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  } as ViewStyle,

  disabledOption: {
    opacity: 0.3,
    backgroundColor: colors.darkBorder,
    borderColor: colors.darkDisabled,
  } as ViewStyle,

  optionText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  } as TextStyle,

  selectedText: {
    color: colors.white,
    fontWeight: typography.weight.semibold,
  } as TextStyle,

  disabledOptionText: {
    color: colors.darkDragHandle,
  } as TextStyle,

  cuisineOption: {
    margin: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.darkQuaternary,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  } as ViewStyle,

  cuisineText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  } as TextStyle,

  // Price slider
  priceSliderContainer: {
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
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

  // Outer hit-zone wrapper (44 px tall) so thumbs never extend outside their
  // parent bounds — Android clips touches to the parent view's bounds, which
  // caused the slider to be unresponsive on physical devices.
  priceSliderWrapper: {
    height: 44,
    width: '100%',
    position: 'relative',
  } as ViewStyle,

  // Visual track bar — centred inside the 44 px wrapper: (44 - 6) / 2 = 19
  priceSliderTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 19,
  } as ViewStyle,

  // Active (coloured) range — same vertical centre as the track bar
  priceSliderActiveRange: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
    position: 'absolute',
    top: 19,
  } as ViewStyle,

  // Thumb — centred inside the 44 px wrapper: (44 - 24) / 2 = 10
  priceSliderThumb: {
    width: 24,
    height: 24,
    backgroundColor: colors.accent,
    borderRadius: 12,
    position: 'absolute',
    top: 10,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // elevation is set per-thumb inline so it varies with active state;
    // a static elevation here would fight with zIndex on Android.
  } as ViewStyle,

  // View mode toggle container
  viewModeToggleContainer: {
    marginVertical: 16,
  } as ViewStyle,

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

  // Diet and calorie options
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

  // Price option styles
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
});
