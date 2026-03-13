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
  backButton: {
    padding: spacing.sm,
    width: 60,
  },
  backButtonText: {
    color: colors.darkText,
    fontSize: typography.size['2xl'],
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.darkText,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  sessionCode: {
    color: colors.accent,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.sm,
    width: 60,
    alignItems: 'flex-end',
  },
  closeButtonText: {
    color: colors.danger,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  content: {
    flex: 1,
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
  membersList: {
    gap: spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  memberAvatarText: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: colors.darkText,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  memberStatus: {
    color: colors.darkTextMuted,
    fontSize: 13,
    marginTop: 2,
  },
  locationModes: {
    gap: spacing.md,
  },
  locationModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.darkBorder,
  },
  locationModeOptionSelected: {
    borderColor: colors.accent,
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
  locationModeText: {
    flex: 1,
  },
  locationModeLabel: {
    color: colors.darkText,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  locationModeDesc: {
    color: colors.darkTextMuted,
    fontSize: 13,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: colors.darkSecondary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: spacing.sm,
  },
  infoText: {
    color: colors.darkText,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  bottomActions: {
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorder,
  },
  button: {
    backgroundColor: colors.darkTertiary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.accent,
  },
  leaveButton: {
    backgroundColor: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
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
