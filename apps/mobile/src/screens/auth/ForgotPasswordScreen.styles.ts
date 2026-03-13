import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  headerContainer: {
    marginBottom: spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: typography.size['7xl'],
  },
  formContainer: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.darkText,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: spacing.base,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.darkTertiary,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    fontSize: typography.size.base,
    color: colors.darkText,
  },
  errorContainer: {
    backgroundColor: '#4A2A2A',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    alignItems: 'center',
  },
  resetButtonDisabled: {
    opacity: 0.6,
    backgroundColor: colors.darkDisabled,
  },
  resetButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  loginText: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.sm,
  },
  loginLink: {
    color: colors.accent,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  // Success state styles
  successContainer: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    fontSize: 80,
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.darkText,
    marginBottom: spacing.base,
  },
  successText: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  emailHighlight: {
    color: colors.accent,
    fontWeight: typography.weight.semibold,
  },
  successHint: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  backToLoginButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    paddingHorizontal: spacing['3xl'],
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  backToLoginButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  resendButton: {
    padding: spacing.md,
  },
  resendButtonText: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.sm,
  },
});
