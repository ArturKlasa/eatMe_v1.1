/**
 * Dish Rating Badge
 *
 * Displays dish rating information inline with dish details
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../styles/theme';
import { getRatingColor, formatRatingText, getRatingTier } from '../services/dishRatingService';

interface DishRatingBadgeProps {
  likePercentage: number | null;
  totalRatings: number;
  topTags: string[];
  maxTags?: number;    // default: 2
  showBadge?: boolean; // default: true — show tier badge if qualified
  compact?: boolean;   // default: false — for map pin mode
}

export function DishRatingBadge({
  likePercentage,
  totalRatings,
  topTags,
  maxTags = 2,
  showBadge = true,
  compact = false,
}: DishRatingBadgeProps) {
  // Don't show anything below minimum threshold (cold-start: misleading with < 3 ratings)
  if (totalRatings < 3 || likePercentage === null) {
    return null;
  }

  const tier = getRatingTier(likePercentage, totalRatings);
  const tierPrefix = showBadge && tier === 'top' ? '🔥 ' : '';
  const ratingColor = getRatingColor(likePercentage);
  const baseRatingText = formatRatingText(likePercentage, totalRatings);
  const ratingText = baseRatingText ? `${tierPrefix}${baseRatingText}` : null;
  const displayTags = compact ? [] : topTags.slice(0, maxTags);

  return (
    <View style={styles.container}>
      {/* Rating percentage and count */}
      <Text style={[styles.ratingText, { color: ratingColor }]}>{ratingText}</Text>

      {/* Top tags (if available) */}
      {displayTags.length > 0 && (
        <Text style={styles.tagsText} numberOfLines={1}>
          {' · '}
          {displayTags.map((tag, index) => (
            <Text key={index}>
              {index > 0 && ' · '}
              {tag}
            </Text>
          ))}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: typography.weight.semibold,
  },
  tagsText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weight.normal,
    flexShrink: 1,
  },
});
