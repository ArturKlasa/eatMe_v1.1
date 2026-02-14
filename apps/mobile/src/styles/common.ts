/**
 * Common Style System - Engineering Masterpiece Edition
 *
 * A hierarchical, DRY style system with:
 * - Base style factories for common patterns
 * - Composite styles built from base patterns
 * - Zero duplication through smart composition
 * - Clear organization and documentation
 */

import { StyleSheet, TextStyle, ViewStyle, ImageStyle } from 'react-native';
import { theme } from './theme';

const { colors, typography, spacing, layout, shadows, borderRadius } = theme;

// ============================================================================
// PART 1: BASE STYLE FACTORIES (Reusable Building Blocks)
// ============================================================================

/**
 * Factory: Creates flex container variations
 */
const createFlexContainer = (
  direction: 'row' | 'column' = 'column',
  align: 'flex-start' | 'center' | 'flex-end' | 'stretch' = 'stretch',
  justify: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' = 'flex-start'
): ViewStyle => ({
  flexDirection: direction,
  alignItems: align,
  justifyContent: justify,
});

/**
 * Factory: Creates centered containers
 */
const createCenteredContainer = (horizontal = true, vertical = true): ViewStyle => ({
  ...(horizontal && { alignItems: 'center' }),
  ...(vertical && { justifyContent: 'center' }),
});

/**
 * Factory: Creates padding variations
 */
const createPadding = (vertical?: number, horizontal?: number, all?: number): ViewStyle => ({
  ...(all !== undefined && { padding: all }),
  ...(vertical !== undefined && { paddingVertical: vertical }),
  ...(horizontal !== undefined && { paddingHorizontal: horizontal }),
});

/**
 * Factory: Creates border variations
 */
export const createBorder = (
  width: number,
  color: string,
  position?: 'top' | 'bottom' | 'left' | 'right'
): ViewStyle => {
  if (!position) {
    return { borderWidth: width, borderColor: color };
  }
  return {
    [`border${position.charAt(0).toUpperCase() + position.slice(1)}Width`]: width,
    [`border${position.charAt(0).toUpperCase() + position.slice(1)}Color`]: color,
  } as ViewStyle;
};

/**
 * Factory: Creates text style variations
 */
export const createTextStyle = (
  size: keyof typeof typography.size,
  weight: keyof typeof typography.weight,
  color: string,
  additionalProps?: Partial<TextStyle>
): TextStyle => ({
  fontSize: typography.size[size],
  fontWeight: typography.weight[weight],
  color,
  ...additionalProps,
});

/**
 * Factory: Creates rounded corner variations
 */
export const createRounded = (radius: number, positions?: string[]): ViewStyle => {
  if (!positions) {
    return { borderRadius: radius };
  }
  const style: any = {};
  positions.forEach(pos => {
    style[`border${pos}Radius`] = radius;
  });
  return style;
};

/**
 * Factory: Creates shadow variations
 */
export const createShadow = (
  elevation: number,
  shadowColor = colors.black,
  shadowOpacity = 0.25
): ViewStyle => ({
  elevation,
  shadowColor,
  shadowOpacity,
  shadowRadius: elevation,
  shadowOffset: { width: 0, height: elevation / 2 },
});

// ============================================================================
// PART 2: BASE ATOMIC STYLES (Single-purpose, composable)
// ============================================================================

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
  textWhite: { color: colors.white } as TextStyle, // Absolute positioning
  absolute: { position: 'absolute' } as ViewStyle,
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as ViewStyle,

  // Overflow
  overflowHidden: { overflow: 'hidden' } as ViewStyle,
  overflowVisible: { overflow: 'visible' } as ViewStyle,
});

// ============================================================================
// PART 3: COMPOSITE BASE STYLES (Built from atomic styles)
// ============================================================================

/**
 * Modal/Sheet Base Pattern - Used by all modal screens
 */
const modalBase = {
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
}; /**
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
const cardBase = {
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

// ============================================================================
// PART 4: COMMON REUSABLE STYLES (Exported for direct use)
// ============================================================================

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

export const text = StyleSheet.create({
  h1: createTextStyle('2xl', 'bold', colors.textPrimary, {
    lineHeight: typography.size['2xl'] * typography.lineHeight.tight,
  }),

  h2: createTextStyle('xl', 'bold', colors.textPrimary, {
    lineHeight: typography.size.xl * typography.lineHeight.tight,
  }),

  h3: createTextStyle('lg', 'semibold', colors.textPrimary, {
    lineHeight: typography.size.lg * typography.lineHeight.normal,
  }),

  body: createTextStyle('base', 'normal', colors.textPrimary, {
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  }),

  bodyBold: createTextStyle('base', 'bold', colors.textPrimary, {
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  }),

  small: createTextStyle('sm', 'normal', colors.textSecondary, {
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  }),

  tiny: createTextStyle('xs', 'normal', colors.textSecondary),

  link: createTextStyle('base', 'medium', colors.primary, {
    textDecorationLine: 'underline',
  }),

  error: createTextStyle('sm', 'normal', colors.error),

  success: createTextStyle('sm', 'normal', colors.success),

  muted: createTextStyle('sm', 'normal', colors.textTertiary),

  centered: { textAlign: 'center' } as TextStyle,

  right: { textAlign: 'right' } as TextStyle,
});

export const emptyState = StyleSheet.create({
  container: {
    ...atomic.center,
    paddingTop: 60,
    paddingHorizontal: 32,
  } as ViewStyle,

  icon: {
    fontSize: 72,
    marginBottom: 16,
  } as TextStyle,

  title: createTextStyle('xl', 'bold', colors.darkText, {
    marginBottom: 12,
    textAlign: 'center',
  }),

  description: createTextStyle('base', 'normal', colors.darkTextMuted, {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  }),
});

export const cards = StyleSheet.create({
  base: cardBase.container,

  elevated: cardBase.elevated,

  header: {
    ...atomic.flexRowBetween,
    marginBottom: spacing.md,
  } as ViewStyle,

  title: createTextStyle('lg', 'semibold', colors.textPrimary),

  content: {
    gap: spacing.sm,
  } as ViewStyle,
});

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

export const spacingUtils = StyleSheet.create({
  mt0: { marginTop: 0 } as ViewStyle,
  mt1: { marginTop: spacing.xs } as ViewStyle,
  mt2: { marginTop: spacing.sm } as ViewStyle,
  mt3: { marginTop: spacing.md } as ViewStyle,
  mt4: { marginTop: spacing.lg } as ViewStyle,
  mt5: { marginTop: spacing.xl } as ViewStyle,

  mb0: { marginBottom: 0 } as ViewStyle,
  mb1: { marginBottom: spacing.xs } as ViewStyle,
  mb2: { marginBottom: spacing.sm } as ViewStyle,
  mb3: { marginBottom: spacing.md } as ViewStyle,
  mb4: { marginBottom: spacing.lg } as ViewStyle,
  mb5: { marginBottom: spacing.xl } as ViewStyle,

  pt0: { paddingTop: 0 } as ViewStyle,
  pt1: { paddingTop: spacing.xs } as ViewStyle,
  pt2: { paddingTop: spacing.sm } as ViewStyle,
  pt3: { paddingTop: spacing.md } as ViewStyle,
  pt4: { paddingTop: spacing.lg } as ViewStyle,

  pb0: { paddingBottom: 0 } as ViewStyle,
  pb1: { paddingBottom: spacing.xs } as ViewStyle,
  pb2: { paddingBottom: spacing.sm } as ViewStyle,
  pb3: { paddingBottom: spacing.md } as ViewStyle,
  pb4: { paddingBottom: spacing.lg } as ViewStyle,

  gap1: { gap: spacing.xs } as ViewStyle,
  gap2: { gap: spacing.sm } as ViewStyle,
  gap3: { gap: spacing.md } as ViewStyle,
  gap4: { gap: spacing.lg } as ViewStyle,
});

// ============================================================================
// PART 5: COMPONENT-SPECIFIC STYLES (Using base patterns)
// ============================================================================

/**
 * Modal Screen Styles - All modal screens (Filters, Favorites, Profile, Settings)
 */
export const modalScreenStyles = StyleSheet.create({
  ...modalBase,

  // Profile-specific
  profileSection: {
    ...atomic.centerH,
    paddingVertical: 30,
    paddingHorizontal: 20,
    ...createBorder(1, colors.darkBorder, 'bottom'),
  } as ViewStyle,

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.darkBorder,
    ...atomic.center,
    marginBottom: 16,
  } as ViewStyle,

  avatarText: { fontSize: 40 } as TextStyle,

  userName: createTextStyle('xl', 'bold', colors.darkText, { marginBottom: 4 }),

  userSubtitle: createTextStyle('sm', 'normal', colors.textTertiary),

  sectionContent: { gap: 8 } as ViewStyle,

  preferenceText: createTextStyle('sm', 'normal', colors.darkText, { marginBottom: 8 }),

  statsGrid: {
    ...atomic.flexRow,
    flexWrap: 'wrap',
    gap: 16,
  } as ViewStyle,

  statItem: {
    width: '45%',
    backgroundColor: colors.darkSecondary,
    padding: 16,
    borderRadius: 12,
    ...atomic.centerH,
  } as ViewStyle,

  statNumber: createTextStyle('2xl', 'bold', colors.accent, { marginBottom: 4 }),

  statLabel: createTextStyle('xs', 'normal', colors.textTertiary, { textAlign: 'center' }),

  featureBullet: createTextStyle('base', 'normal', colors.accent, { marginRight: 8, marginTop: 2 }),

  featureText: createTextStyle('sm', 'normal', colors.darkText, { flex: 1, lineHeight: 20 }),

  // Favorites-specific (reuses emptyState pattern)
  emptyState: emptyState.container,
  emptyIcon: emptyState.icon,
  emptyTitle: emptyState.title,
  emptyDescription: emptyState.description,

  featuresContainer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  } as ViewStyle,

  featuresTitle: createTextStyle('lg', 'semibold', colors.darkText, { marginBottom: 16 }),

  featureItem: createTextStyle('base', 'normal', colors.darkTextLight, {
    marginBottom: 12,
    lineHeight: 22,
  }),

  // Settings-specific
  settingItem: {
    ...atomic.flexRowBetween,
    paddingVertical: 12,
    ...createBorder(1, colors.darkSecondary, 'bottom'),
  } as ViewStyle,

  settingContent: {
    flex: 1,
    marginRight: 16,
  } as ViewStyle,

  settingLabel: createTextStyle('base', 'semibold', colors.darkText, { marginBottom: 4 }),

  settingDescription: createTextStyle('xs', 'normal', colors.textTertiary, { lineHeight: 18 }),

  actionItem: {
    paddingVertical: 16,
    ...createBorder(1, colors.darkSecondary, 'bottom'),
  } as ViewStyle,

  actionText: createTextStyle('base', 'normal', colors.darkText),

  aboutContent: { gap: 8 } as ViewStyle,

  aboutText: createTextStyle('sm', 'normal', colors.textTertiary, { marginBottom: 4 }),
});

// ============================================================================
// NOTE: Filter styles moved to filters.ts
// NOTE: Map styles moved to map.ts
// NOTE: Navigation styles moved to navigation.ts
// ============================================================================

export const viewModeToggleStyles = StyleSheet.create({
  container: {
    ...atomic.flexRow,
    backgroundColor: colors.darkSecondary,
    borderRadius: 8,
    padding: 2,
    alignSelf: 'center',
  } as ViewStyle,

  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.darkQuaternary,
  } as ViewStyle,

  activeButton: {
    backgroundColor: colors.accent,
  } as ViewStyle,

  text: createTextStyle('sm', 'normal', colors.darkText),

  activeText: createTextStyle('sm', 'normal', colors.white),
});

// ============================================================================
// LEGACY STYLES (Keeping for backward compatibility - TODO: Migrate)
// ============================================================================

export const profile = StyleSheet.create({
  container: atomic.flex1 as ViewStyle,
  header: {
    ...atomic.centerH,
    paddingVertical: spacing.lg,
  } as ViewStyle,
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray200,
    ...atomic.center,
    marginBottom: spacing.md,
  } as ViewStyle,
  name: createTextStyle('xl', 'bold', colors.textPrimary),
  email: createTextStyle('sm', 'normal', colors.textSecondary, { marginTop: spacing.xs }),
});

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
    backgroundColor: '#E0E0E0', // Grey background
    borderRadius: 3,
    position: 'relative',
  } as ViewStyle,

  priceSliderActiveRange: {
    height: 6,
    backgroundColor: '#FF9800', // Orange active range
    borderRadius: 3,
    position: 'absolute',
    top: 0,
  } as ViewStyle,

  priceSliderThumb: {
    width: 24,
    height: 24,
    backgroundColor: '#FF9800', // Orange thumb
    borderRadius: 12,
    position: 'absolute',
    top: -9,
    marginLeft: -12, // Center the thumb
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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

// ============================================================================
// EXPORTS
// ============================================================================

// Switch configuration (non-style export)
export const switchConfig = {
  trackColor: { false: colors.gray200, true: colors.primary },
  thumbColor: colors.white,
  ios_backgroundColor: colors.gray200,
};

export const commonStyles = {
  // Core foundational styles
  containers,
  headers,
  text,
  emptyState,
  cards,
  forms,
  buttons,
  inputs,
  spacingUtils,

  // Modal and screen styles
  modals,
  modalScreenStyles,
  viewModeToggleStyles,

  // Legacy
  profile,
};

export default commonStyles;
