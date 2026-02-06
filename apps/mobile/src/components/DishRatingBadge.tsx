/**
 * Dish Rating Badge
 *
 * Displays dish rating information inline with dish details
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../styles/theme';
import { getRatingColor, formatRatingText } from '../services/dishRatingService';

interface DishRatingBadgeProps {
  likePercentage: number | null;
  totalRatings: number;
  topTags: string[];
  maxTags?: number; // Configurable max tags to display
}

export function DishRatingBadge({
  likePercentage,
  totalRatings,
  topTags,
  maxTags = 2,
}: DishRatingBadgeProps) {
  // Don't show anything if no ratings
  if (totalRatings === 0 || likePercentage === null) {
    return null;
  }

  const ratingColor = getRatingColor(likePercentage);
  const ratingText = formatRatingText(likePercentage, totalRatings);
  const displayTags = topTags.slice(0, maxTags);

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
