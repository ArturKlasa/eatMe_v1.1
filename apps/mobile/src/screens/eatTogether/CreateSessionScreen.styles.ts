import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
    marginBottom: spacing['2xl'],
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    marginBottom: spacing.base,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.accent,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.darkDragHandle,
    marginRight: spacing.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: 18,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  codeSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  label: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.darkTextSecondary,
    marginBottom: spacing.md,
  },
  codeBox: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing.sm,
  },
  codeText: {
    fontSize: 36,
    fontWeight: typography.weight.bold,
    color: colors.accent,
    letterSpacing: 4,
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    textAlign: 'center',
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  qrBox: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  shareButton: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    padding: 18,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  shareButtonText: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  continueButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: 18,
    alignItems: 'center',
  },
  continueButtonText: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
});
