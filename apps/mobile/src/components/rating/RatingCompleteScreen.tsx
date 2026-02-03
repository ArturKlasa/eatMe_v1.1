/**
 * Rating Complete Screen
 *
 * Final step of the rating flow - shows points earned summary.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { PointsEarned, DishRatingInput, RestaurantFeedbackInput } from '../../types/rating';

interface RatingCompleteScreenProps {
  dishRatings: DishRatingInput[];
  restaurantFeedback: RestaurantFeedbackInput | null;
  pointsEarned: PointsEarned;
  onViewRewards: () => void;
  onDone: () => void;
}

export function RatingCompleteScreen({
  dishRatings,
  restaurantFeedback,
  pointsEarned,
  onViewRewards,
  onDone,
}: RatingCompleteScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.successIcon}>
          <Text style={styles.successEmoji}>🎉</Text>
        </View>

        <Text style={styles.title}>Thanks!</Text>
        <Text style={styles.subtitle}>Your feedback helps others discover great food</Text>

        {/* Points Breakdown */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsTitle}>You earned:</Text>

          {dishRatings.map((rating, index) => (
            <View key={rating.dishId} style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Rated {rating.dishName}</Text>
              <Text style={styles.pointsValue}>+10 pts</Text>
            </View>
          ))}

          {dishRatings.some(r => r.tags.length > 0) && (
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Added tags</Text>
              <Text style={styles.pointsValue}>+{pointsEarned.dishTags} pts</Text>
            </View>
          )}

          {dishRatings.some(r => r.photoUri) && (
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Added dish photo(s)</Text>
              <Text style={styles.pointsValue}>+{pointsEarned.dishPhotos} pts</Text>
            </View>
          )}

          {restaurantFeedback && (
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Restaurant feedback</Text>
              <Text style={styles.pointsValue}>+{pointsEarned.restaurantFeedback} pts</Text>
            </View>
          )}

          {restaurantFeedback?.photoUri && (
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Restaurant photo</Text>
              <Text style={styles.pointsValue}>+{pointsEarned.restaurantPhoto} pts</Text>
            </View>
          )}

          {pointsEarned.firstVisitBonus > 0 && (
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsLabel, styles.bonusLabel]}>🎁 First visit bonus!</Text>
              <Text style={[styles.pointsValue, styles.bonusValue]}>
                +{pointsEarned.firstVisitBonus} pts
              </Text>
            </View>
          )}

          <View style={styles.pointsDivider} />

          <View style={styles.pointsRow}>
            <Text style={styles.totalLabel}>Total earned</Text>
            <Text style={styles.totalValue}>+{pointsEarned.total} pts</Text>
          </View>
        </View>

        {/* Motivational Message */}
        <View style={styles.motivationCard}>
          <Text style={styles.motivationEmoji}>🌟</Text>
          <Text style={styles.motivationText}>Keep rating to unlock exclusive rewards!</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.rewardsButton} onPress={onViewRewards}>
          <Text style={styles.rewardsButtonText}>View rewards</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={onDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.success}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  pointsCard: {
    width: '100%',
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  pointsTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.white,
    marginBottom: spacing.md,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pointsLabel: {
    fontSize: typography.size.base,
    color: colors.darkText,
  },
  pointsValue: {
    fontSize: typography.size.base,
    color: colors.success,
    fontWeight: typography.weight.medium,
  },
  bonusLabel: {
    color: colors.accent,
  },
  bonusValue: {
    color: colors.accent,
  },
  pointsDivider: {
    height: 1,
    backgroundColor: colors.darkBorderLight,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  totalValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  motivationCard: {
    width: '100%',
    backgroundColor: `${colors.accent}20`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  motivationEmoji: {
    fontSize: 24,
  },
  motivationText: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  rewardsButton: {
    flex: 1,
    backgroundColor: colors.darkSecondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  rewardsButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
});
