import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark,
    padding: spacing.xl,
  },
  header: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.darkText,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  subheader: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.darkTextSecondary,
    fontSize: typography.size.base,
  },
  emptyText: {
    fontSize: typography.size.lg,
    color: colors.darkText,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.lg,
  },
  itemContainer: {
    marginBottom: spacing.md,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  imagePlaceholder: {
    backgroundColor: colors.darkTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  cuisine: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginBottom: spacing.xs,
  },
  date: {
    fontSize: typography.size.xs,
    color: colors.darkTextMuted,
  },
  showButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  showButtonText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
