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
    marginBottom: spacing.base,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
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
  },
  formContainer: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.darkBorder,
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
  inputHint: {
    fontSize: typography.size.xs,
    color: colors.darkTextMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  inputError: {
    borderColor: colors.danger,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkTertiary,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
    borderRadius: borderRadius.md,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.base,
    fontSize: typography.size.base,
    color: colors.darkText,
  },
  showPasswordButton: {
    padding: spacing.base,
  },
  showPasswordText: {
    fontSize: typography.size.lg,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  strengthBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: colors.darkQuaternary,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    width: 60,
  },
  passwordHint: {
    fontSize: typography.size.xs,
    color: colors.darkTextMuted,
    marginTop: spacing.xs,
  },
  errorHint: {
    fontSize: typography.size.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.darkDisabled,
    borderRadius: 6,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.darkDisabledBg,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  termsText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
  errorContainer: {
    backgroundColor: colors.errorSurface,
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
  registerButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.6,
    backgroundColor: colors.darkDisabled,
  },
  registerButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing['2xl'],
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
});
