import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/styles/theme';

/**
 * ProfileScreen local styles.
 * The bulk of the screen uses modalScreenStyles from @/styles.
 * Only the action buttons that aren't covered by shared styles live here.
 */
export const styles = StyleSheet.create({
  editButton: {
    marginTop: spacing.base,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
  },
  editButtonText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  signOutButton: {
    backgroundColor: colors.darkTertiary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  signOutButtonText: {
    color: colors.danger,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
});
