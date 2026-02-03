/**
 * Rating Banner Component
 *
 * A banner displayed on the map screen to prompt users to rate their recent dining experiences.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface RatingBannerProps {
  onPress: () => void;
  recentRestaurantCount?: number;
}

export function RatingBanner({ onPress, recentRestaurantCount = 0 }: RatingBannerProps) {
  if (recentRestaurantCount === 0) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🎁</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Rate dishes, get rewards</Text>
        <Text style={styles.subtitle}>
          {recentRestaurantCount === 1
            ? 'You visited 1 restaurant recently'
            : `You visited ${recentRestaurantCount} restaurants recently`}
        </Text>
      </View>
      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  arrowContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 24,
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
});
