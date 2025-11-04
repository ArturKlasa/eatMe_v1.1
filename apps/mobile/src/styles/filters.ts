/**
 * Filter-related Styles
 *
 * Contains all styles for:
 * - Filter components (UI elements)
 * - Drawer filters (permanent filter panel)
 * - Filter FAB (floating action button)
 *
 * Extracted from common.ts to improve organization and maintainability.
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from './theme';
import { atomic, filterBase, buttonBase, createTextStyle, createBorder } from './common';

/**
 * Filter Components - Reuses filterBase pattern
 * Used in FiltersScreen and various filter UI components
 */
export const filterComponentsStyles = StyleSheet.create({
  filterSection: { marginBottom: 32 } as ViewStyle,

  filterTitle: createTextStyle('lg', 'semibold', colors.textPrimary, { marginBottom: 16 }),

  filterSubtitle: createTextStyle('sm', 'normal', colors.textSecondary, { marginBottom: 12 }),

  filterTitleRow: {
    ...atomic.flexRowBetween,
    marginBottom: 16,
  } as ViewStyle,

  filterActions: {
    ...atomic.flexRow,
    marginHorizontal: 6,
  } as ViewStyle,

  actionButton: { ...buttonBase.small, ...buttonBase.secondary } as ViewStyle,

  actionButtonText: buttonBase.textSmall,

  // Price range
  priceRangeContainer: {
    ...atomic.centerH,
    marginBottom: 16,
  } as ViewStyle,

  priceLabel: createTextStyle('base', 'semibold', colors.primary),

  sliderContainer: { marginVertical: 8 } as ViewStyle,

  sliderLabels: {
    ...atomic.flexRowBetween,
    marginBottom: 8,
  } as ViewStyle,

  sliderLabel: createTextStyle('xs', 'normal', colors.textSecondary),

  sliderRow: {
    ...atomic.flexRow,
    marginHorizontal: 4,
  } as ViewStyle,

  slider: {
    flex: 1,
    height: 40,
  } as ViewStyle,

  sliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: colors.primary,
  } as ViewStyle,

  // Checkbox/Options (reuses filterBase)
  checkboxGrid: filterBase.optionsContainer,

  checkboxItem: {
    ...atomic.flexRowCenter,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray200,
    marginHorizontal: 4,
  } as ViewStyle,

  checkboxItemSelected: {
    backgroundColor: colors.primary + '20',
  } as ViewStyle,

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray200,
    ...atomic.center,
  } as ViewStyle,

  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  } as ViewStyle,

  checkboxCheck: createTextStyle('xs', 'bold', colors.white),

  checkboxLabel: createTextStyle('sm', 'normal', colors.textSecondary),

  checkboxLabelSelected: createTextStyle('sm', 'medium', colors.primary),

  // Toggle
  toggleList: { marginHorizontal: 8 } as ViewStyle,

  toggleItem: {
    ...atomic.flexRowBetween,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    marginBottom: 8,
  } as ViewStyle,

  toggleLabel: atomic.flexRowCenter as ViewStyle,

  toggleIcon: { fontSize: 20, marginRight: 8 } as TextStyle,

  toggleText: createTextStyle('base', 'normal', colors.textPrimary),

  // Spice level
  spiceLevelContainer: {
    ...atomic.flexRowBetween,
    marginTop: 12,
  } as ViewStyle,

  spiceLevelItem: {
    ...atomic.centerH,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.gray200,
    minWidth: 60,
  } as ViewStyle,

  spiceLevelSelected: {
    backgroundColor: colors.primary + '20',
  } as ViewStyle,

  spiceIcon: { fontSize: 20, marginBottom: 4 } as TextStyle,

  spiceLabel: createTextStyle('xs', 'normal', colors.textSecondary, { textAlign: 'center' }),

  spiceLabelSelected: createTextStyle('xs', 'medium', colors.primary),

  // Calorie
  calorieContainer: { marginTop: 12 } as ViewStyle,

  calorieLabel: createTextStyle('sm', 'normal', colors.textSecondary, {
    textAlign: 'center',
    marginBottom: 12,
  }),

  // Presets
  presetGrid: {
    ...atomic.flexRow,
    flexWrap: 'wrap',
    marginHorizontal: 6,
    marginBottom: 20,
  } as ViewStyle,

  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.gray200,
    borderWidth: 1,
    borderColor: colors.gray200,
    marginRight: 8,
    marginBottom: 8,
  } as ViewStyle,

  presetButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  } as ViewStyle,

  presetButtonText: createTextStyle('sm', 'medium', colors.textSecondary),

  presetButtonTextActive: createTextStyle('sm', 'medium', colors.white),

  resetButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.error + '20',
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  } as ViewStyle,

  resetButtonText: createTextStyle('base', 'medium', colors.error),

  // Summary
  summaryContainer: {
    padding: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    marginBottom: 16,
  } as ViewStyle,

  summaryText: createTextStyle('sm', 'medium', colors.primary, { textAlign: 'center' }),
});

/**
 * Drawer Filters - Reuses filterBase extensively
 * Used in DrawerFilters component for permanent filter panel
 */
export const drawerFiltersStyles = StyleSheet.create({
  container: {
    ...atomic.flex1,
    ...atomic.bgDark,
    paddingHorizontal: 16,
  } as ViewStyle,

  header: {
    ...atomic.flexRowBetween,
    paddingVertical: 16,
    ...createBorder(1, colors.darkBorder, 'bottom'),
  } as ViewStyle,

  title: createTextStyle('lg', 'bold', colors.darkText),

  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.accent,
  } as ViewStyle,

  clearButtonText: createTextStyle('xs', 'semibold', colors.white),

  section: {
    paddingVertical: 16,
    ...createBorder(1, colors.darkSecondary, 'bottom'),
  } as ViewStyle,

  sectionTitle: createTextStyle('base', 'semibold', colors.darkText, { marginBottom: 12 }),

  // Reuse filterBase patterns
  tabContainer: filterBase.tabContainer,
  tab: filterBase.tab,
  selectedTab: filterBase.tabSelected,
  tabText: filterBase.tabText,
  selectedTabText: filterBase.tabTextSelected,

  optionsContainer: filterBase.optionsContainer,
  option: filterBase.option,
  selectedOption: filterBase.optionSelected,
  optionText: filterBase.optionText,
  selectedText: filterBase.optionTextSelected,
  disabledOption: filterBase.optionDisabled,
  disabledText: filterBase.optionTextDisabled,

  // Ingredients
  expandableButton: {
    ...atomic.flexRowBetween,
    padding: 16,
    backgroundColor: colors.darkSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
  } as ViewStyle,

  expandableButtonText: createTextStyle('sm', 'medium', colors.darkText),

  expandableArrow: createTextStyle('base', 'normal', colors.darkText),

  selectedIngredientsContainer: { marginTop: 12 } as ViewStyle,

  selectedIngredientsTitle: createTextStyle('xs', 'normal', colors.darkTextLight, {
    marginBottom: 8,
  }),

  selectedIngredientsRow: {
    ...atomic.flexRow,
    flexWrap: 'wrap',
    marginHorizontal: -4,
  } as ViewStyle,

  selectedIngredientTag: {
    ...atomic.flexRowCenter,
    margin: 4,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 12,
  } as ViewStyle,

  selectedIngredientText: createTextStyle('xs', 'medium', colors.white),

  removeIngredientButton: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  } as ViewStyle,

  removeIngredientText: createTextStyle('base', 'bold', colors.white),

  // Modal
  modalOverlay: {
    ...atomic.flex1,
    ...atomic.bgOverlay,
    ...atomic.center,
  } as ViewStyle,

  modalContainer: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: colors.dark,
    borderRadius: 12,
    ...atomic.overflowHidden,
  } as ViewStyle,

  modalHeader: {
    ...atomic.flexRowBetween,
    padding: 16,
    ...createBorder(1, colors.darkBorder, 'bottom'),
  } as ViewStyle,

  modalTitle: createTextStyle('lg', 'bold', colors.darkText),

  modalCloseButton: { padding: 4 } as ViewStyle,

  modalCloseText: createTextStyle('lg', 'normal', colors.darkText),

  modalContent: {
    height: 400,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.dark,
  } as ViewStyle,

  ingredientsList: {
    paddingVertical: 8,
    backgroundColor: colors.dark,
  } as ViewStyle,

  ingredientListItem: {
    paddingVertical: 4,
    ...createBorder(1, colors.darkSecondary, 'bottom'),
    backgroundColor: colors.dark,
    minHeight: 50,
  } as ViewStyle,

  ingredientListContent: {
    ...atomic.flexRowBetween,
    paddingVertical: 12,
    paddingHorizontal: 8,
  } as ViewStyle,

  ingredientListText: createTextStyle('base', 'normal', colors.darkText, { flex: 1 }),

  ingredientCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.darkDragHandle,
    backgroundColor: colors.darkSecondary,
    ...atomic.center,
  } as ViewStyle,

  ingredientCheckboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  } as ViewStyle,

  ingredientCheckboxCheck: createTextStyle('sm', 'bold', colors.white),

  ingredientsGrid: filterBase.optionsContainer,

  ingredientOption: filterBase.option,

  modalFooter: {
    padding: 20,
    ...createBorder(1, colors.darkBorder, 'top'),
  } as ViewStyle,

  modalDoneButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  } as ViewStyle,

  modalDoneText: createTextStyle('base', 'semibold', colors.white),
});

/**
 * Filter FAB (Floating Action Button)
 * Used in BasicMapScreen for filter button with badge
 */
export const filterFABStyles = StyleSheet.create({
  container: {
    ...atomic.absolute,
    bottom: 100,
    right: 20,
    zIndex: 1000,
  } as ViewStyle,

  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    ...atomic.center,
    ...{
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  } as ViewStyle,

  fabActive: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 1.1 }],
  } as ViewStyle,

  fabIcon: { fontSize: 24 } as TextStyle,

  badge: {
    ...atomic.absolute,
    top: -2,
    right: -2,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    ...atomic.center,
    borderWidth: 2,
    borderColor: colors.white,
  } as ViewStyle,

  badgeText: createTextStyle('xs', 'bold', colors.white),
});

// Export all filter styles as a single object
export const filterStyles = {
  components: filterComponentsStyles,
  drawer: drawerFiltersStyles,
  fab: filterFABStyles,
};

export default filterStyles;
