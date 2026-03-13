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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  headerButton: {
    padding: spacing.sm,
    minWidth: 60,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.base,
  },
  saveButtonText: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  headerTitle: {
    color: colors.darkText,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
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
  card: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  label: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  emailText: {
    color: colors.darkTextMuted,
    fontSize: typography.size.base,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.darkBorder,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    fontSize: typography.size.base,
    color: colors.darkText,
  },
  hint: {
    color: colors.darkTextMuted,
    fontSize: typography.size.xs,
    marginTop: 6,
    fontStyle: 'italic',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.darkDragHandle,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  radioLabel: {
    color: colors.darkText,
    fontSize: typography.size.base,
  },
  infoCard: {
    backgroundColor: colors.darkSecondary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  infoTitle: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  infoText: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.base,
  },
  bottomPadding: {
    height: spacing['4xl'],
  },
});
