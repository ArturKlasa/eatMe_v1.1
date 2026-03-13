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
    padding: spacing.base,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  logo: {
    fontSize: typography.size['6xl'],
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.accent,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
    marginTop: spacing.xs,
  },
  formContainer: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  formTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
    marginBottom: spacing.xl,
    textAlign: 'center',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.base,
  },
  forgotPasswordText: {
    color: colors.accent,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
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
  loginButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  loginButtonDisabled: {
    opacity: 0.6,
    backgroundColor: colors.darkDisabled,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.base,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.darkBorderLight,
  },
  dividerText: {
    color: colors.darkTextMuted,
    paddingHorizontal: spacing.base,
    fontSize: typography.size.sm,
  },
  socialButton: {
    backgroundColor: colors.darkTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
  },
  googleButton: {
    backgroundColor: colors.white,
    borderColor: '#DADCE0',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  socialButtonText: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  googleButtonText: {
    color: '#3C4043',
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    marginLeft: spacing.md,
  },
  facebookButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    marginLeft: spacing.md,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  signUpText: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.sm,
  },
  signUpLink: {
    color: colors.accent,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  languageButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  languageButtonText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  languagePicker: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.base,
  },
  languageOptionActive: {
    backgroundColor: colors.darkTertiary,
  },
  languageOptionText: {
    color: colors.white,
    fontSize: typography.size.base,
  },
  checkmark: {
    color: colors.accent,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
