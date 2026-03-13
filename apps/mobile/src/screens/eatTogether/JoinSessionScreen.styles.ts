import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.darkText,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
    marginBottom: spacing['3xl'],
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing['2xl'],
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.darkTextSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: typography.size['2xl'],
    color: colors.darkText,
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: typography.weight.semibold,
    borderWidth: 2,
    borderColor: colors.darkBorder,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.darkTextMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: 18,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  scanButton: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    alignItems: 'center',
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
  },
  scanButtonText: {
    color: colors.darkText,
    fontSize: typography.size.base,
  },
  backButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.darkTextMuted,
    fontSize: typography.size.base,
  },
});
