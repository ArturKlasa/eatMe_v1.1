/**
 * Restaurant Rating Badge
 *
 * Displays overall restaurant rating with colored labels
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '../styles/theme';
import { RestaurantRating } from '../services/restaurantRatingService';

interface RestaurantRatingBadgeProps {
  rating: RestaurantRating | null;
  showBreakdown?: boolean;
}

export function RestaurantRatingBadge({
  rating,
  showBreakdown = false,
}: RestaurantRatingBadgeProps) {
  const { t } = useTranslation();

  if (!rating || rating.overallPercentage === 0) {
    return null;
  }

  const getCategoryLabel = (categoryKey: string, percentage: number): { text: string; color: string } => {
    switch (categoryKey) {
      case 'food':
        if (percentage >= 85) return { text: t('rating.restaurantRating.delicious'), color: colors.success };
        if (percentage >= 70) return { text: t('rating.restaurantRating.tasty'), color: colors.accentLight };
        return { text: t('rating.restaurantRating.mediocrFood'), color: colors.error };

      case 'service':
        if (percentage >= 85) return { text: t('rating.restaurantRating.excellentService'), color: colors.success };
        if (percentage >= 70) return { text: t('rating.restaurantRating.goodService'), color: colors.accentLight };
        return { text: t('rating.restaurantRating.poorService'), color: colors.error };

      case 'clean':
        if (percentage >= 85) return { text: t('rating.restaurantRating.veryClean'), color: colors.success };
        if (percentage >= 70) return { text: t('rating.restaurantRating.fairlyClean'), color: colors.accentLight };
        return { text: t('rating.restaurantRating.notClean'), color: colors.error };

      case 'waitTime':
        if (percentage >= 85) return { text: t('rating.restaurantRating.quickService'), color: colors.success };
        if (percentage >= 70) return { text: t('rating.restaurantRating.reasonableWait'), color: colors.accentLight };
        return { text: t('rating.restaurantRating.longWait'), color: colors.error };

      case 'value':
        if (percentage >= 85) return { text: t('rating.restaurantRating.greatValue'), color: colors.success };
        if (percentage >= 70) return { text: t('rating.restaurantRating.fairValue'), color: colors.accentLight };
        return { text: t('rating.restaurantRating.overpriced'), color: colors.error };

      default:
        return { text: t('common.ok'), color: colors.accentLight };
    }
  };

  return (
    <View style={styles.container}>
      {showBreakdown && (
        <View style={styles.breakdown}>
          <BreakdownItem
            score={rating.foodScore}
            getCategoryLabel={getCategoryLabel}
            categoryKey="food"
            categoryLabel={t('rating.restaurantRating.food')}
          />
          <BreakdownItem
            score={rating.servicePercentage}
            getCategoryLabel={getCategoryLabel}
            categoryKey="service"
            categoryLabel={t('rating.restaurantRating.service')}
          />
          <BreakdownItem
            score={rating.cleanlinessPercentage}
            getCategoryLabel={getCategoryLabel}
            categoryKey="clean"
            categoryLabel={t('rating.restaurantRating.clean')}
          />
          <BreakdownItem
            score={rating.waitTimePercentage}
            getCategoryLabel={getCategoryLabel}
            categoryKey="waitTime"
            categoryLabel={t('rating.restaurantRating.waitTime')}
          />
          <BreakdownItem
            score={rating.valuePercentage}
            getCategoryLabel={getCategoryLabel}
            categoryKey="value"
            categoryLabel={t('rating.restaurantRating.value')}
          />
        </View>
      )}
    </View>
  );
}

interface BreakdownItemProps {
  categoryKey: string;
  categoryLabel: string;
  score: number;
  getCategoryLabel: (categoryKey: string, score: number) => { text: string; color: string };
}

function BreakdownItem({ categoryKey, score, getCategoryLabel }: BreakdownItemProps) {
  const { text, color } = getCategoryLabel(categoryKey, score);

  return (
    <View style={[styles.button, { backgroundColor: color }]}>
      <Text style={styles.buttonText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  breakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs / 2,
  },
  button: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.white,
  },
});
