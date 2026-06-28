/**
 * DailyFilterModal helpers
 *
 * Shared utilities used by the modal sections and selection sub-modals.
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@eatme/tokens';

export { toLocaleKey } from '@/utils/localeKey';

// Search box used inside the "All cuisines" / "All meals" selection modals.
export const searchBox = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    paddingHorizontal: spacing.base,
  },
  input: {
    flex: 1,
    height: 40,
    color: colors.white,
    fontSize: typography.size.sm,
  },
});
