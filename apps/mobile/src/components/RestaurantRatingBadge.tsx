/**
 * Restaurant Rating Badge
 *
 * Displays overall restaurant rating with optional breakdown
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { RestaurantRating } from '../services/restaurantRatingService';

interface RestaurantRatingBadgeProps {
  rating: RestaurantRating | null;
  showBreakdown?: boolean;
  compact?: boolean;
}

export function RestaurantRatingBadge({
  rating,
  showBreakdown = false,
  compact = false,
}: RestaurantRatingBadgeProps) {
  const [breakdownVisible, setBreakdownVisible] = useState(showBreakdown);

  if (!rating || rating.overallPercentage === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noRating}>No ratings yet</Text>
      </View>
    );
  }

  const getQualityLabel = (percentage: number): string => {
    if (percentage >= 85) return 'Great';
    if (percentage >= 70) return 'Good';
    if (percentage >= 50) return 'OK';
    return 'Poor';
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Header */}
      <Text style={styles.headerText}>What others think</Text>

      {/* Breakdown */}
      {showBreakdown && (
        <View style={styles.breakdown}>
          <BreakdownItem label="Food" score={rating.foodScore} />
          <BreakdownItem label="Service" score={rating.serviceScore} />
          <BreakdownItem label="Clean" score={rating.cleanlinessScore} />
          <BreakdownItem label="Wait time" score={rating.waitTimeScore} />
          <BreakdownItem label="Value" score={rating.valueScore} />
        </View>
      )}
    </View>
  );
}

interface BreakdownItemProps {
  label: string;
  score: number;
}

function BreakdownItem({ label, score }: BreakdownItemProps) {
  const getQualityLabel = (percentage: number): string => {
    if (percentage >= 85) return 'Great';
    if (percentage >= 70) return 'Good';
    if (percentage >= 50) return 'OK';
    return 'Poor';
  };

  const getColor = (s: number) => {
    if (s >= 85) return colors.success;
    if (s >= 70) return '#FFB800';
    if (s >= 50) return '#FF9800';
    return colors.error;
  };

  const qualityLabel = getQualityLabel(score);

  return (
    <View style={styles.breakdownItem}>
      <Text style={styles.breakdownLabel}>{label}:</Text>
      <Text style={[styles.breakdownScore, { color: getColor(score) }]}>{qualityLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.darkSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  containerCompact: {
    padding: spacing.xs,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  percentage: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  expandIcon: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
  },
  noRating: {
    fontSize: typography.size.sm,
    color: colors.darkText,
    fontStyle: 'italic',
  },
  headerText: {
    fontSize: typography.size.sm,
    color: colors.darkText,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  breakdown: {
    marginTop: spacing.xs,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  breakdownLabel: {
    fontSize: typography.size.sm,
    color: colors.darkText,
  },
  breakdownScore: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
  },
});
