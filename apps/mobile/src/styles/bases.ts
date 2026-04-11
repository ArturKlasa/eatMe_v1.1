/**
 * Base Style Patterns
 *
 * Composite base patterns built from atomic styles and factories.
 * Used as foundations for component-specific style modules.
 */

import { TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createBorder, createTextStyle, createRounded, createShadow } from './factories';

const { colors, typography, spacing, layout, borderRadius } = theme;

/**
 * Modal/Sheet Base Pattern - Used by all modal screens
 */
export const modalBase = {
  container: {
    ...atomic.flex1,
    ...atomic.bgOverlay,
    justifyContent: 'flex-end',
  } as ViewStyle,

  overlay: atomic.flex1 as ViewStyle,

  modalContainer: {
    height: '100%',
    backgroundColor: colors.dark,
    ...createRounded(20, ['TopLeft', 'TopRight']),
    ...atomic.overflowHidden,
  } as ViewStyle,

  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.darkDragHandle,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  } as ViewStyle,

  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    ...createBorder(1, colors.darkBorder, 'bottom'),
  } as ViewStyle,

  title: createTextStyle('2xl', 'bold', colors.darkText, { marginBottom: 4 }),

  subtitle: createTextStyle('sm', 'normal', colors.darkTextMuted),

  scrollView: atomic.flex1 as ViewStyle,

  section: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    ...createBorder(1, colors.darkBorder, 'bottom'),
  } as ViewStyle,

  sectionTitle: createTextStyle('lg', 'semibold', colors.darkText, { marginBottom: 12 }),

  bottomSpacer: { height: 40 } as ViewStyle,
};

/**
 * Filter/Selection Base Pattern - Used by all filter components
 */
export const filterBase = {
  // Tab-based selection
  tabContainer: {
    ...atomic.flexRow,
    borderRadius: 8,
    backgroundColor: colors.darkSecondary,
    padding: 2,
  } as ViewStyle,

  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.darkQuaternary,
  } as ViewStyle,

  tabSelected: {
    backgroundColor: colors.accent,
  } as ViewStyle,

  tabText: createTextStyle('sm', 'medium', colors.darkText),

  tabTextSelected: createTextStyle('sm', 'semibold', colors.white),

  // Chip/Option-based selection
  optionsContainer: {
    ...atomic.flexRow,
    flexWrap: 'wrap',
    marginHorizontal: -4,
  } as ViewStyle,

  option: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.darkQuaternary,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  } as ViewStyle,

  optionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  } as ViewStyle,

  optionText: createTextStyle('sm', 'normal', colors.darkText),

  optionTextSelected: createTextStyle('sm', 'semibold', colors.white),

  optionDisabled: {
    opacity: 0.3,
    backgroundColor: colors.darkDisabledBg,
    borderColor: colors.darkDisabled,
  } as ViewStyle,

  optionTextDisabled: { color: colors.darkDisabledText } as TextStyle,
};

/**
 * Button Base Pattern
 */
export const buttonBase = {
  primary: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...createShadow(4),
  } as ViewStyle,

  secondary: {
    backgroundColor: colors.gray200,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  text: createTextStyle('base', 'semibold', colors.white),

  textSecondary: createTextStyle('base', 'medium', colors.textSecondary),

  small: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  } as ViewStyle,

  textSmall: createTextStyle('xs', 'medium', colors.textSecondary),
};

/**
 * Card Base Pattern
 */
export const cardBase = {
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...createShadow(2),
  } as ViewStyle,

  elevated: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...createShadow(8),
  } as ViewStyle,
};
