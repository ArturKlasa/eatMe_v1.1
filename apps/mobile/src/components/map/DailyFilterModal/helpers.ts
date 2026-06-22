/**
 * DailyFilterModal helpers
 *
 * Shared utilities used by the modal sections and selection sub-modals.
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@eatme/tokens';

/**
 * Converts a display name like "Comfort Food" or "Fish & Chips" to the
 * camelCase locale key used in the JSON files ("comfortFood", "fishAndChips").
 */
export const toLocaleKey = (str: string): string => {
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: Café → Cafe
    .replace(/&/g, 'And'); // Fish & Chips → Fish And Chips
  const words = normalized.trim().split(/\s+/);
  return (
    words[0].toLowerCase() +
    words
      .slice(1)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
  );
};

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
