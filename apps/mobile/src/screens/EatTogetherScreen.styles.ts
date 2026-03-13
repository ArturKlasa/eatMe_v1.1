import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/styles/theme';

/**
 * EatTogetherScreen local styles.
 * The screen container/header uses shared modalScreenStyles.
 * Only action-specific elements live here.
 */
export const styles = StyleSheet.create({
  actionsContainer: {
    padding: spacing.base,
    gap: spacing.md,
  },
  primaryAction: {
    backgroundColor: colors.accent,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  secondaryAction: {
    backgroundColor: colors.darkSecondary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.darkBorder,
  },
  actionIcon: {
    fontSize: typography.size['5xl'],
    marginBottom: spacing.sm,
  },
  actionTitle: {
    color: colors.darkText,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
  },
  actionDescription: {
    color: colors.darkText,
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  stepsList: {
    gap: spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  stepIcon: {
    fontSize: typography.size['2xl'],
    marginRight: spacing.md,
  },
  stepText: {
    color: colors.darkText,
    fontSize: typography.size.sm,
    flex: 1,
    lineHeight: 20,
  },
});
