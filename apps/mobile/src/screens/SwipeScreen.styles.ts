import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.size['2xl'],
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  statsCompact: {
    padding: spacing.sm,
  },
  statsCompactText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.base,
    fontSize: typography.size.base,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: typography.size.base,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  emptyTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  statsContainer: {
    marginTop: spacing['2xl'],
    padding: spacing.base,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  statsTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  statsText: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  cardContainer: {
    flex: 1,
    padding: spacing.base,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    ...shadows.md,
    overflow: 'hidden',
  },
  dishImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.border,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: typography.size.lg,
    color: colors.gray500,
  },
  infoContainer: {
    flex: 1,
    padding: spacing.base,
  },
  dishName: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  restaurantName: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  starIcon: {
    fontSize: typography.size.sm,
  },
  rating: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  distance: {
    fontSize: typography.size.sm,
    color: colors.gray500,
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.size.sm,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  calories: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tag: {
    backgroundColor: colors.amberLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: typography.size.xs,
    color: colors.amberDark,
    fontWeight: typography.weight.medium,
  },
  matchScore: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.success,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing['2xl'],
    paddingVertical: spacing.xl,
  },
  swipeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.base,
  },
  passButton: {
    backgroundColor: colors.error,
  },
  likeButton: {
    backgroundColor: colors.success,
  },
  buttonIcon: {
    fontSize: 32,
    color: colors.white,
  },
  progress: {
    textAlign: 'center',
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    paddingBottom: spacing.base,
  },
  personalizationBanner: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  bannerText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
