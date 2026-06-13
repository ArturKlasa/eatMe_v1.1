/**
 * ModifierGroupsList
 *
 * Renders a dish's option_groups inline beneath the dish row in the restaurant
 * detail screen. Each group becomes a labeled section with its options
 * underneath; an option whose protein matches the user's daily meat-type pick is
 * highlighted (classifyOption), and a price-delta chip shows the surcharge.
 *
 * Styled for the dark restaurant-detail menu (matches DishMenuItem). Long groups
 * collapse to the first COLLAPSED_COUNT options with an inline "+N more" toggle
 * that expands in place — the user stays on the menu page.
 *
 * The data is already loaded as part of the per-category fetch — this is a
 * near-pure render component (only local expand/collapse state).
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatPrice, isSupportedCurrency, type SupportedCurrency } from '@eatme/shared';
import { colors, spacing, typography } from '@/styles/theme';
import { classifyOption } from '../../utils/menuFilterUtils';
import type { OptionGroup, Option } from '../../lib/supabase';
import type { DailyFilters } from '../../stores/filterStore';

// How many options to show before collapsing the rest behind a "+N more" toggle.
const COLLAPSED_COUNT = 2;

interface Props {
  groups: OptionGroup[];
  daily: DailyFilters;
  basePrice: number;
  /** ISO 4217 from the parent restaurant. Drives the option-row price chip; falls
   *  back to USD via formatPrice() when missing. */
  currencyCode?: string | null;
}

export const ModifierGroupsList = React.memo(function ModifierGroupsList({
  groups,
  daily,
  basePrice: _basePrice,
  currencyCode,
}: Props) {
  const currency: SupportedCurrency | undefined = isSupportedCurrency(currencyCode)
    ? currencyCode
    : undefined;
  // Filter out inactive groups + sort by display_order. Same shape the rest of
  // the screen uses (see useRestaurantDetail.handleDishPress).
  const visible = useMemo(
    () =>
      groups
        .filter(g => g.is_active)
        .slice()
        .sort((a, b) => a.display_order - b.display_order),
    [groups]
  );

  if (visible.length === 0) return null;

  return (
    <View style={styles.container}>
      {visible.map(group => (
        <GroupSection key={group.id} group={group} daily={daily} currency={currency} />
      ))}
    </View>
  );
});

function GroupSection({
  group,
  daily,
  currency,
}: {
  group: OptionGroup;
  daily: DailyFilters;
  currency: SupportedCurrency | undefined;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const opts = useMemo(
    () =>
      (group.options ?? [])
        .filter(o => o.is_available)
        .slice()
        .sort((a, b) => a.display_order - b.display_order),
    [group.options]
  );

  if (opts.length === 0) return null;

  const meta = describeSelection(group);
  const hiddenCount = opts.length - COLLAPSED_COUNT;
  const shown = expanded ? opts : opts.slice(0, COLLAPSED_COUNT);

  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{group.name}</Text>
        {meta ? <Text style={styles.groupMeta}>{meta}</Text> : null}
      </View>
      {shown.map(opt => (
        <OptionRow key={opt.id} option={opt} daily={daily} currency={currency} />
      ))}
      {hiddenCount > 0 && (
        <TouchableOpacity
          onPress={() => setExpanded(prev => !prev)}
          activeOpacity={0.7}
          style={styles.moreToggle}
        >
          <Text style={styles.moreToggleText}>
            {expanded
              ? t('restaurant.showLessOptions', 'Show less')
              : t('restaurant.showMoreOptions', '+{{count}} more', { count: hiddenCount })}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Selection hint shown next to the group name. The app has no ordering, so the
// "required/optional" distinction is dropped — for single-select (incl. size
// variants) the group name alone is enough; constrained multi-select keeps a
// quantity hint.
function describeSelection(group: OptionGroup): string {
  const min = group.min_selections ?? 0;
  const max = group.max_selections ?? null;
  if (group.selection_type === 'single') return '';
  // multiple
  if (min === 0 && max == null) return '';
  if (min === 0 && max != null) return `up to ${max}`;
  if (min === max && max != null) return `pick ${min}`;
  if (max == null) return `at least ${min}`;
  return `${min}–${max}`;
}

function OptionRow({
  option,
  daily,
  currency,
}: {
  option: Option;
  daily: DailyFilters;
  currency: SupportedCurrency | undefined;
}) {
  const { matchesDailyMeatType: isPreferredProtein } = classifyOption(
    { primary_protein: option.primary_protein ?? null },
    daily
  );

  const priceLabel = formatOptionPrice(option, currency);

  return (
    <View style={styles.optionRow}>
      <Text style={[styles.optionName, isPreferredProtein && styles.optionNamePreferred]}>
        {option.is_default ? '★ ' : ''}
        {option.name}
      </Text>
      <View style={styles.chips}>
        {priceLabel && <Text style={styles.price}>{priceLabel}</Text>}
      </View>
    </View>
  );
}

// Wraps formatPrice() so option price overrides render as the absolute amount
// and deltas keep their explicit sign. The shared formatPrice handles all the
// currency-specific decimal + symbol logic; here we just choose what to format
// and whether to prefix a '+'.
function formatOptionPrice(option: Option, currency: SupportedCurrency | undefined): string | null {
  if (option.price_override != null) return formatPrice(option.price_override, currency);
  if (option.price_delta && option.price_delta !== 0) {
    const sign = option.price_delta > 0 ? '+' : '';
    return `${sign}${formatPrice(option.price_delta, currency)}`;
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  group: {
    gap: spacing.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  groupName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
  },
  groupMeta: {
    fontSize: typography.size.xs,
    color: colors.darkTextMuted,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  optionName: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.darkText,
  },
  optionNamePreferred: {
    fontWeight: typography.weight.semibold,
    color: colors.accent,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  price: {
    fontSize: typography.size.xs,
    color: colors.darkTextSecondary,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.xs,
  },
  moreToggle: {
    paddingVertical: 2,
  },
  moreToggleText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.accent,
  },
});
