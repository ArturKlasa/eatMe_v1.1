import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.darkText,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
  },
  headerSubtitle: {
    color: colors.darkTextMuted,
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  winnerCard: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 3,
    borderColor: colors.gold,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  crownBadge: {
    position: 'absolute',
    top: -20,
    backgroundColor: colors.gold,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  crownEmoji: {
    fontSize: typography.size['2xl'],
  },
  winnerLabel: {
    color: colors.gold,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  winnerName: {
    color: colors.darkText,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  winnerAddress: {
    color: colors.darkTextMuted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  winnerStats: {
    flexDirection: 'row',
    gap: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.gold,
    fontSize: typography.size['4xl'],
    fontWeight: typography.weight.bold,
  },
  statLabel: {
    color: colors.darkTextMuted,
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },
  navigationButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  navigationButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.darkText,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.md,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: spacing.sm,
  },
  resultRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.darkTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  resultRankText: {
    color: colors.darkTextMuted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: colors.darkText,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  resultStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultVotes: {
    color: colors.accent,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  resultPercentage: {
    color: colors.darkTextMuted,
    fontSize: typography.size.sm,
  },
  infoBox: {
    backgroundColor: colors.darkSecondary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  infoTitle: {
    color: colors.darkText,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  infoText: {
    color: colors.darkTextMuted,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  bottomActions: {
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorder,
  },
  button: {
    backgroundColor: colors.accent,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.darkTextMuted,
    fontSize: typography.size.base,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.base,
    marginBottom: spacing.base,
  },
});
