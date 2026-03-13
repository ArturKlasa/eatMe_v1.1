import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    color: colors.darkText,
    fontSize: typography.size['2xl'],
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    color: colors.darkText,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  headerSubtitle: {
    color: colors.darkTextMuted,
    fontSize: typography.size.sm,
    marginTop: 2,
  },
  instructions: {
    backgroundColor: colors.darkSecondary,
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  instructionsText: {
    color: colors.darkText,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  restaurantCard: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.darkBorder,
    padding: spacing.base,
    marginBottom: spacing.md,
    position: 'relative',
  },
  restaurantCardVoted: {
    borderColor: colors.accent,
  },
  rankBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  restaurantInfo: {
    paddingRight: 40,
  },
  restaurantName: {
    color: colors.darkText,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  restaurantAddress: {
    color: colors.darkTextMuted,
    fontSize: typography.size.sm,
    marginBottom: spacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginBottom: spacing.md,
  },
  scoreItem: {
    flex: 1,
  },
  scoreLabel: {
    color: colors.darkTextMuted,
    fontSize: typography.size.xs,
    marginBottom: 2,
  },
  scoreValue: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  voteBar: {
    height: 32,
    backgroundColor: colors.darkTertiary,
    borderRadius: borderRadius.base,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.success,
    opacity: 0.3,
  },
  voteBarFillMine: {
    backgroundColor: colors.accent,
    opacity: 0.5,
  },
  voteBarText: {
    color: colors.darkText,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    zIndex: 1,
  },
  votedBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  votedBadgeText: {
    color: colors.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
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
  button: {
    backgroundColor: colors.accent,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
