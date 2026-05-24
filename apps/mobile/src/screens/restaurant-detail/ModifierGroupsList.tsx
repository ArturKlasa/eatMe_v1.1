/**
 * ModifierGroupsList
 *
 * Renders a dish's option_groups inline beneath the dish row in the restaurant
 * detail screen. Each group becomes a labeled section with its options
 * underneath; per-option chips surface allergy triggers, dietary-tag conflicts,
 * and price deltas resolved against the user's permanent + daily filters via
 * classifyOption().
 *
 * The data is already loaded as part of the per-category fetch — this is a
 * pure render component.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, borderRadius } from '@/styles/theme';
import { classifyOption } from '../../utils/menuFilterUtils';
import type { OptionGroup, Option } from '../../lib/supabase';
import type { DailyFilters, PermanentFilters } from '../../stores/filterStore';

interface Props {
  groups: OptionGroup[];
  permanent: PermanentFilters;
  daily: DailyFilters;
  basePrice: number;
}

export function ModifierGroupsList({ groups, permanent, daily, basePrice: _basePrice }: Props) {
  const { t: _t } = useTranslation();

  // Filter out inactive groups + sort by display_order. Same shape the rest of
  // the screen uses (see useRestaurantDetail.handleDishPress).
  const visible = groups
    .filter(g => g.is_active)
    .slice()
    .sort((a, b) => a.display_order - b.display_order);

  if (visible.length === 0) return null;

  return (
    <View style={styles.container}>
      {visible.map(group => (
        <GroupSection key={group.id} group={group} permanent={permanent} daily={daily} />
      ))}
    </View>
  );
}

function GroupSection({
  group,
  permanent,
  daily,
}: {
  group: OptionGroup;
  permanent: PermanentFilters;
  daily: DailyFilters;
}) {
  const opts = (group.options ?? [])
    .filter(o => o.is_available)
    .slice()
    .sort((a, b) => a.display_order - b.display_order);

  if (opts.length === 0) return null;

  const requiredLabel = describeSelection(group);

  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupMeta}>{requiredLabel}</Text>
      </View>
      {opts.map(opt => (
        <OptionRow key={opt.id} option={opt} permanent={permanent} daily={daily} />
      ))}
    </View>
  );
}

function describeSelection(group: OptionGroup): string {
  const min = group.min_selections ?? 0;
  const max = group.max_selections ?? null;
  if (group.selection_type === 'single') {
    return min >= 1 ? 'pick 1 — required' : 'pick 1 — optional';
  }
  // multiple
  if (min === 0 && max == null) return 'optional';
  if (min === 0 && max != null) return `up to ${max}`;
  if (min === max && max != null) return `pick ${min}`;
  if (max == null) return `at least ${min}`;
  return `${min}–${max}`;
}

function OptionRow({
  option,
  permanent,
  daily,
}: {
  option: Option;
  permanent: PermanentFilters;
  daily: DailyFilters;
}) {
  const cls = classifyOption(
    {
      adds_allergens: option.adds_allergens ?? null,
      removes_dietary_tags: option.removes_dietary_tags ?? null,
      primary_protein: option.primary_protein ?? null,
    },
    permanent,
    daily
  );

  const hasAllergyConflict = cls.triggersAllergy.length > 0;
  const hasDietConflict = cls.stripsDietaryTags.length > 0;
  const isPreferredProtein = cls.matchesDailyMeatType;

  const priceLabel = formatPrice(option);

  return (
    <View style={styles.optionRow}>
      <Text style={[styles.optionName, isPreferredProtein && styles.optionNamePreferred]}>
        {option.is_default ? '★ ' : ''}
        {option.name}
      </Text>
      <View style={styles.chips}>
        {hasAllergyConflict && (
          <Chip tone="error" label={`allergy: ${cls.triggersAllergy.join(', ')}`} />
        )}
        {hasDietConflict && (
          <Chip tone="warning" label={`removes ${cls.stripsDietaryTags.join(', ')}`} />
        )}
        {priceLabel && <Text style={styles.price}>{priceLabel}</Text>}
      </View>
    </View>
  );
}

function formatPrice(option: Option): string | null {
  if (option.price_override != null) return `$${option.price_override.toFixed(2)}`;
  if (option.price_delta && option.price_delta !== 0) {
    const sign = option.price_delta > 0 ? '+' : '';
    return `${sign}$${option.price_delta.toFixed(2)}`;
  }
  return null;
}

function Chip({ tone, label }: { tone: 'error' | 'warning'; label: string }) {
  return (
    <View style={[styles.chip, tone === 'error' ? styles.chipError : styles.chipWarning]}>
      <Text
        style={[styles.chipText, tone === 'error' ? styles.chipTextError : styles.chipTextWarning]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    color: colors.textPrimary,
  },
  groupMeta: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
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
    color: colors.textPrimary,
  },
  optionNamePreferred: {
    fontWeight: typography.weight.semibold,
    color: colors.primaryDark,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  chipError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  chipWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  chipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  chipTextError: {
    color: '#991B1B',
  },
  chipTextWarning: {
    color: '#92400E',
  },
  price: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.xs,
  },
});
