/**
 * Restaurant Detail Screen Styles
 *
 * Styles for the restaurant detail/menu view screen.
 * Uses centralized theme colors and spacing for consistency.
 */

import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from './theme';

export const restaurantDetailStyles = StyleSheet.create({
  // Container & Layout
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['4xl'],
  },
  errorText: {
    color: colors.darkText,
    fontSize: typography.size.lg,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  // Header Section
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkTertiary,
  },
  headerContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  nameRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  restaurantName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.white,
    flexShrink: 1,
  },
  ratingBadge: {
    backgroundColor: colors.darkSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  ratingText: {
    fontSize: typography.size.sm,
    color: colors.white,
    fontWeight: typography.weight.semibold,
  },
  cuisineText: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    marginBottom: spacing.xs,
  },

  // Opening Hours Section
  hoursPaymentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hoursContainer: {
    padding: spacing.md,
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.base,
    alignSelf: 'flex-start',
  },
  hoursMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'nowrap',
  },
  hoursLabel: {
    fontSize: typography.size.sm,
    color: colors.darkText,
    fontWeight: typography.weight.medium,
    flexShrink: 0,
  },
  expandIcon: {
    fontSize: 10,
    color: colors.darkTextSecondary,
    marginLeft: spacing.xs,
  },
  fullWeekHours: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorderLight,
  },
  weekDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  weekDayName: {
    fontSize: typography.size.xs,
    color: colors.darkTextLight,
    textTransform: 'capitalize',
    width: 100,
  },
  weekDayHours: {
    fontSize: typography.size.xs,
    color: colors.darkTextSecondary,
  },
  openBadge: {
    fontSize: 11,
    color: colors.success,
    fontWeight: typography.weight.bold,
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },

  // Three-Dots Menu Button
  menuButton: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.darkSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 24,
    color: colors.white,
    fontWeight: typography.weight.bold,
    lineHeight: 24,
  },

  // Options Menu Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: spacing.md,
  },
  optionsMenu: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    minWidth: 198,
    ...shadows.lg,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkTertiary,
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 11,
    width: 22,
    textAlign: 'center',
  },
  optionText: {
    fontSize: 13.5,
    color: colors.darkText,
    fontWeight: typography.weight.medium,
  },

  // Close Button (Error State)
  closeButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: typography.size.sm,
    color: colors.white,
    fontWeight: typography.weight.semibold,
  },

  // Menu Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  menuCategory: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  categoryName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.accent,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    marginBottom: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkSecondary,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  menuItemName: {
    fontSize: typography.size.base - 1,
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
    flex: 1,
    marginRight: spacing.sm,
  },
  menuItemPrice: {
    fontSize: typography.size.base - 1,
    fontWeight: typography.weight.bold,
    color: colors.accent,
  },
  menuItemIngredients: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    lineHeight: 18,
  },

  // Legacy/Unused (kept for compatibility)
  rating: {
    fontSize: typography.size.sm,
    color: colors.white,
    marginRight: spacing.sm,
  },
  reviews: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginRight: spacing.sm,
  },
  closedBadge: {
    fontSize: typography.size.sm,
    color: colors.error,
    fontWeight: typography.weight.semibold,
    marginRight: spacing.sm,
  },
  paymentNote: {
    fontSize: typography.size.sm,
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
});
