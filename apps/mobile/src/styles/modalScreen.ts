/**
 * Modal Screen Styles
 *
 * Styles for full-screen modal views: profile, settings, favorites.
 * Also includes view mode toggle styles.
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';
import { atomic } from './atomic';
import { createBorder, createTextStyle } from './factories';
import { modalBase } from './bases';
import { emptyState } from './typography';

const { colors } = theme;

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
