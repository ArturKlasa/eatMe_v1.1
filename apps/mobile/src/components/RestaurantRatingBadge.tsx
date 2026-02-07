/**
 * Restaurant Rating Badge
 *
 * Displays overall restaurant rating with colored labels
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  if (!rating || rating.overallPercentage === 0) {
    return null;
  }

  const getCategoryLabel = (category: string, score: number): { text: string; color: string } => {
    const percentage = score * 100;

    switch (category) {
      case 'Food':
        if (percentage >= 85) return { text: 'Delicious', color: colors.success };
        if (percentage >= 70) return { text: 'Tasty', color: '#FFB800' };
        return { text: 'Mediocre food', color: colors.error };

      case 'Service':
        if (percentage >= 85) return { text: 'Excellent service', color: colors.success };
        if (percentage >= 70) return { text: 'Good service', color: '#FFB800' };
        return { text: 'Poor service', color: colors.error };

      case 'Clean':
        if (percentage >= 85) return { text: 'Clean', color: colors.success };
        if (percentage >= 70) return { text: 'Fairly clean', color: '#FFB800' };
        return { text: 'Not clean', color: colors.error };

      case 'Wait time':
        if (percentage >= 85) return { text: 'Quick', color: colors.success };
        if (percentage >= 70) return { text: 'Reasonable wait', color: '#FFB800' };
        return { text: 'Long wait', color: colors.error };

      case 'Value':
        if (percentage >= 85) return { text: 'Great value', color: colors.success };
        if (percentage >= 70) return { text: 'Fair value', color: '#FFB800' };
        return { text: 'Overpriced', color: colors.error };

      default:
        return { text: 'OK', color: '#FFB800' };
    }
  };

  return (
    <View style={styles.container}>
      {showBreakdown && (
        <View style={styles.breakdown}>
          <BreakdownItem
            score={rating.foodScore}
            getCategoryLabel={getCategoryLabel}
            category="Food"
          />
          <BreakdownItem
            score={rating.serviceScore}
            getCategoryLabel={getCategoryLabel}
            category="Service"
          />
          <BreakdownItem
            score={rating.cleanlinessScore}
            getCategoryLabel={getCategoryLabel}
            category="Clean"
          />
          <BreakdownItem
            score={rating.waitTimeScore}
            getCategoryLabel={getCategoryLabel}
            category="Wait time"
          />
          <BreakdownItem
            score={rating.valueScore}
            getCategoryLabel={getCategoryLabel}
            category="Value"
          />
        </View>
      )}
    </View>
  );
}

interface BreakdownItemProps {
  category: string;
  score: number;
  getCategoryLabel: (category: string, score: number) => { text: string; color: string };
}

function BreakdownItem({ category, score, getCategoryLabel }: BreakdownItemProps) {
  const { text, color } = getCategoryLabel(category, score);

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
